<div align="center">

# 🏛️ EmpireCommunitySite

**Website oficial e portal da comunidade Empire Community.**

[![Website](https://img.shields.io/badge/Website-empirehub.com.br-00C7B7?style=for-the-badge&logo=safari&logoColor=white)](https://empirehub.com.br)
[![Discord](https://img.shields.io/badge/Discord-EmpireHub-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/KgtyNg9U6H)
[![CI](https://github.com/Empire-Community/EmpireCommunitySite/actions/workflows/ci.yml/badge.svg)](https://github.com/Empire-Community/EmpireCommunitySite/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

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

## 🤝 Contribuição

Antes de enviar alterações, consulte nossas diretrizes de engenharia e fluxo de trabalho no repositório [`.github`](https://github.com/Empire-Community/.github).

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

Distribuído sob a licença **MIT**. Consulte o arquivo [LICENSE](LICENSE) para mais detalhes.
