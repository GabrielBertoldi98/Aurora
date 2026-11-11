# Cloud Hub

Projeto de estudo para centralizar a navegação de arquivos em Google Drive, Dropbox e OneDrive, mantendo os arquivos nos provedores de origem.

## Fase atual

Fase 2 — banco de dados e autenticação interna. Cadastro, login, logout e sessão por cookie estão estruturados; OAuth e integrações externas ainda não foram implementados.

## Pré-requisitos

- Node.js 24.15+ ou 26.x LTS
- Corepack habilitado para usar pnpm 12.18.0
- Docker Desktop, para PostgreSQL e Redis

## Como executar após instalar os pré-requisitos

1. Copie `.env.example` para `.env`, defina um `BETTER_AUTH_SECRET` local de alta entropia (32+ caracteres) e altere somente valores locais se necessário. Os scripts da API carregam esse arquivo da raiz do monorepo.
2. Execute `pnpm install --frozen-lockfile`.
3. Inicie a infraestrutura com `docker compose up -d`.
4. Inicie web e API com `pnpm dev`.

A web estará em `http://localhost:3000`; o healthcheck público estará em `http://localhost:3000/api/health` quando o proxy da web estiver ativo.

Para aplicar a migração inicial de autenticação, com o PostgreSQL em execução, execute `pnpm --filter @cloud-hub/api db:migrate`.

## Verificações de qualidade

```text
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Decisões arquiteturais

As decisões aprovadas da Fase 0 estão em `docs/decisions/`.
