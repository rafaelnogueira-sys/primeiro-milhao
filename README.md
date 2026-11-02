# Primeiro Milhão

Metas financeiras, rendas e gastos. Mostra quanto guardar por mês para chegar a R$ 50 mil e R$ 1 milhão (ou as metas que você definir), em quanto tempo o seu plano chega lá e como ficam os meses e o ano.

Um app web (PWA) que também vira **app Android (.apk)**. Tudo é editável: rendas fixas e pontuais, gastos fixos e pontuais, categorias, metas e premissas.

## Estrutura

```
primeiro-milhao/
├── app/                    ← o app (HTML + CSS + JS, sem build)
│   ├── index.html
│   ├── manifest.webmanifest, sw.js, icons/   ← instalável e offline (PWA)
├── site/index.html         ← site de download (botão do APK + instalar pelo navegador)
├── capacitor.config.json   ← empacota app/ como app Android
├── package.json, scripts/
├── assets/                 ← ícone e splash usados para gerar os ícones do Android
├── apps-script/Codigo.gs   ← conector opcional do Google Sheets
├── exemplo-dados.json
└── .github/workflows/
    ├── android.yml         ← compila o APK e publica em Releases
    └── site.yml            ← publica o site no GitHub Pages
```

## Onde os dados ficam

1. **Banco do aparelho (IndexedDB)**: cópia principal. Cada edição é salva na hora, sem internet. O `localStorage` é um espelho; se um dos dois for limpo, o outro restaura.
2. **Cópias automáticas** no próprio banco: a cada 6 h de uso e antes de apagar, importar, restaurar exemplo ou carregar da planilha. Ficam as 60 mais recentes; restaure na aba **Dados e conexão**.
3. **Google Sheets (opcional)**: os dados vão para uma planilha sua, fora do aparelho. É a proteção contra perder o celular ou desinstalar o app. Passo a passo na própria aba.
4. **Backup em JSON**: no Android, o botão abre o menu de compartilhar (Drive, WhatsApp, e-mail).

Desinstalar o app ou limpar os dados do aparelho apaga o banco local. Conecte a planilha ou guarde um backup.

## Publicar o site e gerar o APK (GitHub)

1. Crie um repositório e envie tudo:
   ```bash
   git init && git add . && git commit -m "Primeiro Milhão"
   git branch -M main
   git remote add origin https://github.com/SEU-USUARIO/primeiro-milhao.git
   git push -u origin main
   ```
2. **Settings → Pages → Source: GitHub Actions.** O workflow *Publicar site* coloca o site em `https://SEU-USUARIO.github.io/primeiro-milhao/` e o app em `/app/`.
3. **Actions → Gerar APK do Android → Run workflow** (ou `git tag v1.0.0 && git push --tags`). Em poucos minutos o `primeiro-milhao.apk` aparece em **Releases**, e o botão do site já aponta para a última versão.

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

Mude o `VERSAO` em `app/sw.js` a cada publicação do site para os aparelhos pegarem a versão nova.

| O que mudar | Onde (`app/index.html`) |
|---|---|
| Cores e fontes | `<style>`, bloco `:root` |
| Categorias padrão | `CATEGORIAS_PADRAO` |
| Taxas da tabela "E se o rendimento mudar?" | `CONFIG.TAXAS_CENARIO` |
| Dados de exemplo | `dadosExemplo()` |
| Fórmulas | `projetar`, `saldoFinal`, `aporteNecessario`, `mesesAte` |
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
  "pontuais": [{ "id": "b1", "mes": "2027-07", "catId": "lazer", "descricao": "Viagem", "valor": 2800 }]
}
```

Backups antigos (com `perfil.renda`) são convertidos sozinhos em uma renda fixa. Ao atualizar o `Codigo.gs` na planilha, publique uma nova versão da implantação.

## Premissas de cálculo

- Juros compostos mensais: o saldo rende a taxa informada e depois recebe o aporte.
- "Aumento do aporte/ano" eleva o valor guardado a cada 12 meses.
- Use a taxa **líquida** (depois do IR). "Em reais de hoje" desconta a inflação informada.
- É uma simulação, não recomendação de investimento.
