<div align="center">

# 🏛️ EmpireCommunitySite

**Website oficial e portal da comunidade Empire Community.**

[![Website](https://img.shields.io/badge/Website-empirecommunity.org-00C7B7?style=for-the-badge&logo=safari&logoColor=white)](https://empirecommunity.org)
[![Discord](https://img.shields.io/badge/Discord-EmpireCommunity-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://empirecommunity.org/discord)
[![CI](https://github.com/EmpireCommunity/EmpireCommunitySite/actions/workflows/ci.yml/badge.svg)](https://github.com/EmpireCommunity/EmpireCommunitySite/actions/workflows/ci.yml)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg?style=for-the-badge)](LICENSE)

---

</div>

## 📌 Visão Geral

Este repositório armazena o código-fonte, layout e documentações do portal principal da **Empire Community**.

## 🛠️ Stack Tecnológica

- **Framework Web**: Astro 7 (site estático), TypeScript, sem React
- **Estilização**: Tailwind CSS 4, com os tokens de design em `@theme`
- **Gerenciador de pacotes**: pnpm (Node 24 LTS)
- **CI/CD**: GitHub Actions

## 🚀 Desenvolvimento

```bash
pnpm install --frozen-lockfile
pnpm dev      # servidor local
pnpm build    # gera dist/
pnpm check    # astro check
pnpm lint
pnpm test
```

Rotas em `/pt-br/` e `/en-us/` (ver `docs/contracts/routing-locale.md`). Regras para quem contribui, incluindo o fluxo
com worktrees e o mapa de risco, em [`AGENTS.md`](AGENTS.md).

## 📦 CI, imagem e release

- `ci.yml` roda em PR e em push na `main`: qualidade (check, lint, testes), build com varreduras do `dist/`, imagem com
  teste de cabeçalhos HTTP, lint dos workflows e varredura de segredos.
- `integrity.yml` verifica invariantes públicas a cada seis horas e manualmente (`node scripts/integrity.ts`).
  As flags de lançamento em `scripts/lib/integrity-pending.ts` mantêm site e raiz em aviso até o lançamento; o Worker já é verificado sem adiamento.
  Tags finais exigem essas flags em `false`; prereleases mantêm as regras existentes.
- A imagem (`Dockerfile`, `nginx/`) serve só o `dist/` em nginx-unprivileged, porta 8080, sem log de acesso.
- Release por tag `vX.Y.Z` na `main`, decidida pelo dono: [`docs/runbook/release.md`](docs/runbook/release.md).
  O template de deploy está em `deploy/compose.yml`.

## Entrada na comunidade

Os links internos levam às regras no idioma da página: `/pt-br/discord/` ou `/en-us/discord/`. O endereço público
`/discord` escolhe o idioma por país na Cloudflare; na origem, mostra uma escolha de idioma. As páginas de regras
ficam fora do sitemap, sem scripts, e só a página em português mostra o link da comunidade WhatsApp.

## 🤝 Contribuição

Antes de enviar alterações, consulte nossas diretrizes de engenharia e fluxo de trabalho no repositório [`.github`](https://github.com/EmpireCommunity/.github).

A raiz do repositório fica sempre na `main`: o trabalho acontece em um worktree, em uma branch `tipo/nome-curto`.

```bash
git worktree add worktrees/feat-minha-feature -b feat/minha-feature main
cd worktrees/feat-minha-feature
git commit -m "feat(portal): adicionar nova secao"
git push -u origin feat/minha-feature
```

Push, PR e merge têm autorização permanente do dono (decisão D-31); nunca na `main` direto. Releases e deploys exigem a
aprovação explícita do dono a cada vez.

## 📜 Licença

Distribuído sob a licença **GPL v3** (GPL-3.0-only). Consulte o arquivo [LICENSE](LICENSE) para mais detalhes.
A licença cobre apenas o código: o logotipo e os demais arquivos de marca (a marca Rack, o lockup, o conjunto de ícones e a imagem de compartilhamento) são direitos reservados da EmpireCommunity, sem licença concedida, conforme [LICENSES.md](LICENSES.md#brand-logo-and-icons).
