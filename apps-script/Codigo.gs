/**
 * Primeiro Milhão — conector do Google Sheets
 *
 * Como usar:
 * 1. Crie uma planilha nova no Google Sheets.
 * 2. Extensões → Apps Script → apague tudo e cole este arquivo.
 * 3. Troque o TOKEN abaixo por uma senha só sua e salve (Ctrl+S).
 * 4. Implantar → Nova implantação → tipo "App da Web"
 *      Executar como: Eu
 *      Quem pode acessar: Qualquer pessoa
 * 5. Autorize, copie a URL que termina em /exec e cole no dashboard
 *    (aba "Dados e conexão"), junto com o mesmo TOKEN.
 *
 * Sempre que alterar este código, faça Implantar → Gerenciar implantações →
 * editar → "Nova versão" para a URL passar a usar o código novo.
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
  Pontuais:    ['id', 'mes', 'catId', 'descricao', 'valor']
};
const COLUNAS_NUMERICAS = ['valor', 'anos'];

function doGet() {
  return json({ ok: true, app: 'Primeiro Milhão', mensagem: 'Conector ativo. O dashboard conversa por POST.' });
}

function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents);
    if (req.token !== TOKEN) return json({ ok: false, erro: 'Token inválido. Confira o token na aba Dados e conexão.' });
    if (req.acao === 'ler') return json({ ok: true, dados: ler() });
    if (req.acao === 'salvar') {
      const lock = LockService.getScriptLock();
      lock.waitLock(20000);
      try { salvar(req.dados); } finally { lock.releaseLock(); }
      return json({ ok: true, salvoEm: new Date().toISOString() });
    }
    return json({ ok: false, erro: 'Ação desconhecida: ' + req.acao });
  } catch (err) {
    return json({ ok: false, erro: String(err && err.message || err) });
  }
}

/* ---------------- leitura ---------------- */
function ler() {
  const perfil = {};
  linhas('Perfil').forEach(function (r) { if (r.chave) perfil[r.chave] = r.valor; });
  return {
    perfil: perfil,
    metas: linhas('Metas'),
    categorias: linhas('Categorias'),
    rendas: linhas('Rendas'),
    rendasPontuais: linhas('RendasPontuais'),
    recorrentes: linhas('Recorrentes'),
    pontuais: linhas('Pontuais')
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
    sh.getRange(1, i + 1, Math.max(tudo.length, 2), 1).setNumberFormat(texto ? '@' : '#,##0.00');
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

function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
