# Primeiro Milhão

Metas financeiras, rendas, gastos e investimentos. Mostra quanto guardar por mês para chegar a R$ 50 mil e R$ 1 milhão (ou as metas que você definir), em quanto tempo o seu plano chega lá, como ficam os meses e o ano, e quanto vale a sua carteira hoje.

Um app web (PWA) que também vira **app Android (.apk)**. Tudo é editável: rendas fixas e pontuais, gastos fixos e pontuais, categorias, metas, premissas e investimentos.

Abas: **Resumo** (balanço do mês, meta principal e carteira) · **Carteira** (ações, ETFs, FIIs, cripto e renda fixa com cotações) · **Simulação** · **Orçamento** · **Ajustes** (sincronização, cotações, backup).

## Estrutura

```
primeiro-milhao/
├── app/                    ← o app (HTML + CSS + JS, sem build)
│   ├── index.html
│   ├── fonts/              ← fonte Montserrat embutida (licença OFL), igual no site e no APK
│   ├── manifest.webmanifest, sw.js, icons/   ← instalável e offline (PWA)
├── site/index.html         ← site de download (botão do APK + instalar pelo navegador)
├── capacitor.config.json   ← empacota app/ como app Android
├── package.json, scripts/
├── assets/                 ← ícone e splash usados para gerar os ícones do Android
├── apps-script/Codigo.gs   ← planilha do Google: banco compartilhado celular ⇄ site + cotações da B3
├── exemplo-dados.json
└── .github/workflows/
    ├── android.yml         ← compila o APK a cada mudança em app/ e publica em Releases
    └── site.yml            ← publica o site no GitHub Pages
```

## Onde os dados ficam

1. **Banco do aparelho (IndexedDB)**: cada edição é salva na hora, sem internet. O `localStorage` é um espelho; se um dos dois for limpo, o outro restaura.
2. **Planilha do Google = banco compartilhado**: com a planilha conectada (aba **Ajustes → Sincronizar celular e site**), o celular e o site usam os mesmos dados.
   - Cada alteração é enviada em ~1 s.
   - Os outros aparelhos recebem ao abrir o app, ao voltar para ele e a cada 45 s com ele aberto.
   - Vence a alteração mais recente; a planilha recusa gravações mais antigas que a dela, então um aparelho desatualizado não apaga o que outro salvou.
   - Para conectar o segundo aparelho, copie o **código de conexão** em Ajustes e cole no outro.
3. **Cópias automáticas** no próprio banco: a cada 6 h de uso e antes de apagar, importar, restaurar exemplo, conectar ou receber dados da planilha. Ficam as 60 mais recentes; restaure em **Ajustes**.
4. **Backup em JSON**: no Android, o botão abre o menu de compartilhar (Drive, WhatsApp, e-mail).

Desinstalar o app ou limpar os dados do aparelho apaga o banco local. Com a planilha conectada, basta colar o código de novo para os dados voltarem.

## Cotações da carteira

| Ativo | Fonte | Precisa de quê |
|---|---|---|
| Criptomoedas (BTC, ETH, SOL…) | CoinGecko (preço em R$ e variação de 24 h) | nada |
| Ações, ETFs, BDRs e FIIs da B3 | `GOOGLEFINANCE` dentro da sua planilha; reserva: Yahoo Finance | planilha conectada |
| Ações e FIIs sem planilha | brapi.dev (1 ativo por consulta, 15 mil consultas/mês no plano grátis) | token grátis em Ajustes |
| Renda fixa e outros | valor que você informa | nada |

As cotações são atualizadas ao abrir a Carteira ou o Resumo, a cada 15 min com o app aberto e no botão **Atualizar**. Os preços da B3 têm atraso de alguns minutos. A opção **"Usar o total da minha carteira"** (Simulação) faz a projeção partir do valor real da carteira.

## Publicar o site e gerar o APK (GitHub)

1. Crie um repositório e envie tudo:
   ```bash
   git init && git add . && git commit -m "Primeiro Milhão"
   git branch -M main
   git remote add origin https://github.com/SEU-USUARIO/primeiro-milhao.git
   git push -u origin main
   ```
2. **Settings → Pages → Source: GitHub Actions.** O workflow *Publicar site* coloca o site em `https://SEU-USUARIO.github.io/primeiro-milhao/` e o app em `/app/`.
3. O workflow **Gerar APK do Android** roda sozinho a cada alteração em `app/` enviada para a `main` (também dá para rodar em **Actions → Run workflow** ou com uma tag `v1.0.0`). Em poucos minutos o `primeiro-milhao.apk` aparece em **Releases**, e o botão do site já aponta para a última versão.

### Assinatura (importante para atualizar o app por cima)

Sem chave própria, cada build é assinado com uma chave de teste diferente e o Android não deixa instalar a versão nova sobre a antiga (é preciso desinstalar, o que apaga os dados). Crie uma chave **uma vez** e guarde-a:

```bash
keytool -genkeypair -v -keystore primeiro-milhao.jks -alias primeiromilhao -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 primeiro-milhao.jks      # copie a saída
```

Em **Settings → Secrets and variables → Actions**, crie: `KEYSTORE_BASE64` (a saída acima), `KEYSTORE_PASSWORD` (a senha) e `KEY_ALIAS` (`primeiromilhao`). Faça backup do `.jks` e da senha: sem eles não há como atualizar o app.

## Outras formas de distribuir

- **Qualquer hospedagem estática**: copie `site/` e `app/` e ponha o `primeiro-milhao.apk` ao lado do `index.html` do site. O botão usa o arquivo local.
- **Link direto do APK** por WhatsApp, Drive ou e-mail: o Android pede para permitir a instalação da fonte.
- **PWA**: abrir `/app/` no Chrome e tocar em *Instalar app*. Não precisa de APK.
- **Play Store**: possível depois, gerando um `.aab` com `./gradlew bundleRelease` na pasta `android/`.

## Rodar e alterar

```bash
npm run serve            # abre o app em http://localhost:8080
npm install && npm run android:add && npm run android:sync   # projeto Android local (precisa do Android Studio)
```

Mude o `VERSAO` em `app/sw.js` a cada publicação do site para os aparelhos pegarem a versão nova. Ao mudar o `apps-script/Codigo.gs`, cole o novo código no Apps Script e publique uma **nova versão** da implantação (Implantar → Gerenciar implantações → editar → Nova versão).

| O que mudar | Onde (`app/index.html`) |
|---|---|
| Cores e fontes (Montserrat) | link do Google Fonts no `<head>` e bloco `:root` do `<style>` (variável `--f`) |
| Categorias padrão | `CATEGORIAS_PADRAO` |
| Taxas da tabela "E se o rendimento mudar?" | `CONFIG.TAXAS_CENARIO` |
| Dados de exemplo | `dadosExemplo()` |
| Fórmulas | `projetar`, `saldoFinal`, `aporteNecessario`, `mesesAte` |
| Tipos de investimento e cores | `TIPOS_INV` |
| Fontes de cotação | `Cotacoes` (app) e `cotacoes()` (Codigo.gs) |
| Sincronização | `Sync`, `CONFIG.SYNC_INTERVALO_MS` |
| Banco de dados | `Banco` (IndexedDB) e `Armazenamento` (adaptadores) |

Para trocar por Supabase ou Firebase, crie um adaptador com `ler()` e `salvar(dados)` no `Armazenamento` e chame-o em `agendarSalvar`.

## Formato dos dados

```json
{
  "perfil": { "inicio": "2026-11", "aporte": 2000, "saldoInicial": 5000, "taxaMensal": 1, "crescimentoAporte": 0, "inflacao": 4.5 },
  "rendas": [{ "id": "rd1", "descricao": "Salário líquido", "valor": 8000, "inicio": "", "fim": "" }],
  "rendasPontuais": [{ "id": "rp1", "mes": "2027-12", "descricao": "13º salário", "valor": 4000 }],
  "metas": [{ "id": "m1", "nome": "Reserva de 3 anos", "valor": 50000, "anos": 3 }],
  "categorias": [{ "id": "lazer", "nome": "Lazer", "cor": "#D6409F" }],
  "recorrentes": [{ "id": "a1", "catId": "lazer", "descricao": "Saídas", "valor": 450, "inicio": "", "fim": "" }],
  "pontuais": [{ "id": "b1", "mes": "2027-07", "catId": "lazer", "descricao": "Viagem", "valor": 2800 }],
  "investimentos": [
    { "id": "i1", "tipo": "acao", "ativo": "PETR4", "quantidade": 100, "precoMedio": 30, "valorManual": 0 },
    { "id": "i2", "tipo": "cripto", "ativo": "BTC", "quantidade": 0.01, "precoMedio": 300000, "valorManual": 0 },
    { "id": "i3", "tipo": "rf", "ativo": "Tesouro Selic 2029", "quantidade": 1, "precoMedio": 1000, "valorManual": 1100 }
  ]
}
```

`tipo` do investimento: `acao` (ações, ETFs, BDRs), `fii`, `cripto`, `rf` (renda fixa) ou `outro`. Em `rf` e `outro`, `precoMedio` é o valor aplicado e `valorManual` o valor atual.

Backups antigos (com `perfil.renda`) são convertidos sozinhos em uma renda fixa. Ao atualizar o `Codigo.gs` na planilha, publique uma nova versão da implantação.

## Premissas de cálculo

- Juros compostos mensais: o saldo rende a taxa informada e depois recebe o aporte.
- "Aumento do aporte/ano" eleva o valor guardado a cada 12 meses.
- Use a taxa **líquida** (depois do IR). "Em reais de hoje" desconta a inflação informada.
- É uma simulação, não recomendação de investimento.
