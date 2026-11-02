/**
 * Primeiro Milhão — conector do Google Sheets
 * Banco de dados compartilhado entre o celular e o site + cotações da B3.
 *
 * Como usar:
 * 1. Crie uma planilha nova no Google Sheets.
 * 2. Extensões → Apps Script → apague tudo e cole este arquivo.
 * 3. Troque o TOKEN abaixo por uma senha só sua e salve (Ctrl+S).
 * 4. Implantar → Nova implantação → tipo "App da Web"
 *      Executar como: Eu
 *      Quem pode acessar: Qualquer pessoa
 * 5. Autorize, copie a URL que termina em /exec e cole no app
 *    (aba "Ajustes" → Sincronizar celular e site), junto com o mesmo TOKEN.
 *
 * Sempre que alterar este código, faça Implantar → Gerenciar implantações →
 * lápis (editar) → Versão: "Nova versão" → Implantar. A URL continua a mesma.
 */

const TOKEN = 'troque-este-token';

// Estrutura das abas da planilha. Pode acrescentar colunas no fim de cada lista.
const ABAS = {
  Perfil:      ['chave', 'valor'],
  Metas:       ['id', 'nome', 'valor', 'anos'],
  Categorias:  ['id', 'nome', 'cor'],
  Rendas:      ['id', 'descricao', 'valor', 'inicio', 'fim'],
  RendasPontuais: ['id', 'mes', 'descricao', 'valor'],
  Recorrentes: ['id', 'catId', 'descricao', 'valor', 'inicio', 'fim'],
  Pontuais:    ['id', 'mes', 'catId', 'descricao', 'valor'],
  Investimentos: ['id', 'tipo', 'ativo', 'quantidade', 'precoMedio', 'valorManual']
};
const COLUNAS_NUMERICAS = ['valor', 'anos', 'quantidade', 'precoMedio', 'valorManual'];
const ABA_COTACOES = '_Cotacoes';

function doGet() {
  return json({ ok: true, app: 'Primeiro Milhão', versaoConector: 3, mensagem: 'Conector ativo. O app conversa por POST.' });
}

function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents);
    if (req.token !== TOKEN) return json({ ok: false, erro: 'Token inválido. Confira o token em Ajustes.' });

    if (req.acao === 'versao') return json({ ok: true, atualizadoEm: atualizadoEm(), temDados: temDados(), versaoConector: 3 });
    if (req.acao === 'ler') return json({ ok: true, dados: ler(), atualizadoEm: atualizadoEm() });

    if (req.acao === 'salvar') {
      const lock = LockService.getScriptLock();
      lock.waitLock(20000);
      try {
        // Proteção: um aparelho com dados mais antigos não apaga o que outro salvou depois.
        const atual = atualizadoEm();
        const novo = Number(req.dados && req.dados.atualizadoEm) || Date.now();
        if (!req.forcar && atual && novo < atual) {
          return json({ ok: false, conflito: true, atualizadoEm: atual, erro: 'A planilha tem alterações mais novas de outro aparelho.' });
        }
        salvar(req.dados);
        PropertiesService.getScriptProperties().setProperty('atualizadoEm', String(novo));
        return json({ ok: true, atualizadoEm: novo, salvoEm: new Date().toISOString() });
      } finally { lock.releaseLock(); }
    }

    if (req.acao === 'cotacoes') {
      const lock = LockService.getScriptLock();
      lock.waitLock(20000);
      try { return json({ ok: true, cotacoes: cotacoes(req.lista || []) }); }
      finally { lock.releaseLock(); }
    }

    return json({ ok: false, erro: 'Ação desconhecida: ' + req.acao });
  } catch (err) {
    return json({ ok: false, erro: String(err && err.message || err) });
  }
}

function atualizadoEm() {
  return Number(PropertiesService.getScriptProperties().getProperty('atualizadoEm')) || 0;
}
function temDados() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Perfil');
  return !!(sh && sh.getLastRow() > 1);
}

/* ---------------- leitura ---------------- */
function ler() {
  const perfil = {};
  linhas('Perfil').forEach(function (r) { if (r.chave) perfil[r.chave] = r.valor; });
  return {
    perfil: perfil,
    atualizadoEm: atualizadoEm(),
    metas: linhas('Metas'),
    categorias: linhas('Categorias'),
    rendas: linhas('Rendas'),
    rendasPontuais: linhas('RendasPontuais'),
    recorrentes: linhas('Recorrentes'),
    pontuais: linhas('Pontuais'),
    investimentos: linhas('Investimentos')
  };
}

function linhas(nome) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nome);
  if (!sh || sh.getLastRow() < 2) return [];
  const v = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
  const cab = v[0].map(String);
  return v.slice(1)
    .filter(function (r) { return r.some(function (x) { return x !== ''; }); })
    .map(function (r) {
      const o = {};
      cab.forEach(function (c, i) { o[c] = normalizar(r[i]); });
      return o;
    });
}

// Datas digitadas na planilha (ex.: 2027-01) viram "aaaa-mm" de novo.
function normalizar(x) {
  if (x instanceof Date) return Utilities.formatDate(x, Session.getScriptTimeZone(), 'yyyy-MM');
  return x;
}

/* ---------------- gravação ---------------- */
function salvar(d) {
  if (!d || typeof d !== 'object') throw new Error('Nada para salvar.');
  const perfil = Object.keys(d.perfil || {}).map(function (k) { return { chave: k, valor: d.perfil[k] }; });
  escrever('Perfil', perfil);
  escrever('Metas', d.metas || []);
  escrever('Categorias', d.categorias || []);
  escrever('Rendas', d.rendas || []);
  escrever('RendasPontuais', d.rendasPontuais || []);
  escrever('Recorrentes', d.recorrentes || []);
  escrever('Pontuais', d.pontuais || []);
  escrever('Investimentos', d.investimentos || []);
  pintarCategorias(d.categorias || []);
}

function escrever(nome, itens) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(nome) || ss.insertSheet(nome);
  const cab = ABAS[nome];
  sh.clearContents();
  const corpo = itens.map(function (o) {
    return cab.map(function (c) {
      const v = o[c];
      if (v === undefined || v === null) return '';
      if (nome !== 'Perfil' && COLUNAS_NUMERICAS.indexOf(c) >= 0) return Number(v) || 0;
      return String(v);
    });
  });
  const tudo = [cab].concat(corpo);
  // Colunas de texto ficam como texto puro, para "2027-01" não virar data.
  cab.forEach(function (c, i) {
    const texto = nome === 'Perfil' || COLUNAS_NUMERICAS.indexOf(c) < 0;
    sh.getRange(1, i + 1, Math.max(tudo.length, 2), 1).setNumberFormat(texto ? '@' : '#,##0.00######');
  });
  sh.getRange(1, 1, tudo.length, cab.length).setValues(tudo);
  sh.getRange(1, 1, 1, cab.length).setFontWeight('bold');
  sh.setFrozenRows(1);
}

// Pinta a coluna "cor" da aba Categorias com a própria cor, para enxergar na planilha.
function pintarCategorias(cats) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Categorias');
  if (!sh || !cats.length) return;
  const fundos = cats.map(function (c) { return [/^#[0-9a-f]{6}$/i.test(c.cor) ? c.cor : '#ffffff']; });
  sh.getRange(2, 3, cats.length, 1).setBackgrounds(fundos);
}

/* ---------------- cotações ----------------
 * Recebe chaves como "B3:PETR4", "B3:MXRF11" ou "CRIPTO:BTC" e devolve
 * { "B3:PETR4": { preco: 38.2, varDia: 1.3, fonte: "Google Finance" }, ... }
 * Ações, ETFs e FIIs: GOOGLEFINANCE da própria planilha; se falhar, Yahoo Finance.
 * Cripto: Yahoo Finance (BTC-BRL); se falhar, GOOGLEFINANCE("CURRENCY:BTCBRL").
 */
function cotacoes(lista) {
  const chaves = lista.map(String).filter(function (k) { return /^(B3|CRIPTO):[A-Z0-9.\-]{1,15}$/.test(k); }).slice(0, 80);
  const out = {};
  if (!chaves.length) return out;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(ABA_COTACOES) || ss.insertSheet(ABA_COTACOES);
  try { sh.hideSheet(); } catch (e) {}
  sh.clearContents();
  const formulas = chaves.map(function (k) {
    const p = k.split(':'), cripto = p[0] === 'CRIPTO';
    const simbolo = cripto ? 'CURRENCY:' + p[1] + 'BRL' : 'BVMF:' + p[1];
    return ['=GOOGLEFINANCE("' + simbolo + '","price")', cripto ? '' : '=GOOGLEFINANCE("' + simbolo + '","changepct")'];
  });
  sh.getRange(1, 1, chaves.length, 1).setValues(chaves.map(function (k) { return [k]; }));
  sh.getRange(1, 2, chaves.length, 2).setFormulas(formulas);
  SpreadsheetApp.flush();
  const v = sh.getRange(1, 1, chaves.length, 3).getValues();

  chaves.forEach(function (k, i) {
    const cripto = k.indexOf('CRIPTO:') === 0, t = k.split(':')[1];
    const preco = Number(v[i][1]), varDia = v[i][2] === '' ? NaN : Number(v[i][2]);
    const doGoogle = isFinite(preco) && preco > 0 ? { preco: preco, varDia: isFinite(varDia) ? varDia : null, fonte: 'Google Finance' } : null;
    if (cripto) out[k] = yahoo(t + '-BRL') || doGoogle;
    else out[k] = doGoogle || yahoo(t + '.SA');
    if (!out[k]) delete out[k];
  });
  return out;
}

function yahoo(simbolo) {
  try {
    const r = UrlFetchApp.fetch('https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(simbolo) + '?range=1d&interval=1d',
      { muteHttpExceptions: true, headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (r.getResponseCode() !== 200) return null;
    const m = JSON.parse(r.getContentText()).chart.result[0].meta;
    const p = Number(m.regularMarketPrice), ant = Number(m.chartPreviousClose || m.previousClose);
    return p > 0 ? { preco: p, varDia: ant > 0 ? (p / ant - 1) * 100 : null, fonte: 'Yahoo Finance' } : null;
  } catch (e) { return null; }
}

function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
