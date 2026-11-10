# Cloud Hub

Projeto de estudo para centralizar a navegação de arquivos em Google Drive, Dropbox e OneDrive, mantendo os arquivos nos provedores de origem.

## Fase atual

Fase 1 — infraestrutura local e estrutura inicial. Ainda não há autenticação, schema de banco, OAuth ou integrações externas.

## Pré-requisitos

- Node.js 24.15+ (linha 24 LTS)
- Corepack habilitado para usar pnpm 12.18.0
- Docker Desktop, para PostgreSQL e Redis

## Como executar após instalar os pré-requisitos

1. Copie `.env.example` para `.env` e altere somente valores locais se necessário.
2. Execute `pnpm install --frozen-lockfile`.
3. Inicie a infraestrutura com `docker compose up -d`.
4. Inicie web e API com `pnpm dev`.

A web estará em `http://localhost:3000`; o healthcheck público estará em `http://localhost:3000/api/health` quando o proxy da web estiver ativo.

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
