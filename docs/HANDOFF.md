# Handoff — Cloud Hub

**Atualizado em:** 11/11/2026
**Branch/HEAD:** `main` em `d02943e` (`chore: bootstrap fase 1`)

> Nota: a árvore de trabalho contém a implementação não commitada da Fase 2; o commit acima continua sendo a base mais recente de `main`.

## Estado atual

O projeto está no início da **Fase 1 — infraestrutura local e estrutura inicial**. O commit `d02943e` criou o monorepo e o esqueleto executável; ainda não há autenticação, schema Prisma, banco integrado à aplicação, OAuth, persistência de tokens ou adaptadores de provedores.

O objetivo do produto é centralizar a navegação de arquivos de Google Drive, Dropbox e OneDrive sem armazenar os arquivos no Cloud Hub. O MVP deve permitir múltiplas contas por provedor, navegação/listagem por conexão, filtros por provedor/conta e desconexão. MEGA, transferências e operações de escrita ficam fora do escopo atual.

## Entregue no bootstrap

- Monorepo `pnpm` com os workspaces `apps/web`, `apps/api` e `packages/contracts`.
- Web Next.js/React/Tailwind em `apps/web`, com página indicativa da Fase 1.
- API NestJS em `apps/api`, com healthcheck `GET /api/health` (a aplicação Nest escuta internamente em `API_PORT`, padrão `3001`).
- Rewrite do Next.js: `/api/*` é encaminhado para a API interna, preservando uma única origem pública.
- Contratos compartilhados preparados com TypeScript e Zod, mas sem contratos de domínio definidos.
- Docker Compose com PostgreSQL 17.11 e Redis 8.8, ambos com volumes e healthchecks.
- Configuração de TypeScript estrito, ESLint, Prettier, testes iniciais com Vitest e CI GitHub Actions.
- `.env.example` com URLs e valores locais de desenvolvimento; nenhum segredo real deve ser versionado.

## Decisões arquiteturais aprovadas

1. **pnpm 12.18.0** é o único gerenciador de pacotes; Node aceito: `>=24.15.0 <27` (linhas LTS 24 e 26).
2. **Mesma origem pública:** a web faz proxy de `/api/*`; o fluxo normal não depende de CORS.
3. **Autenticação interna separada do OAuth externo:** Better Auth servirá apenas às contas/sessões do Cloud Hub; as contas dos provedores serão `CloudConnection` independentes.
4. **Segurança de sessão/tokens:** sessão interna por cookie `HttpOnly`; tokens externos nunca chegam ao navegador e deverão ser criptografados no banco com AES-256-GCM e versão de chave.
5. **OAuth:** Authorization Code Flow com PKCE e `state` aleatório, descartável e de curta duração para Google Drive, Dropbox e OneDrive.
6. **Sem cache ou paginação global no MVP inicial:** listagem, busca e ordenação são por conexão; a interface unificada usa filtros.
7. **MiniStack adiado:** não faz parte da Fase 1 nem do login/listagem; reavaliar somente nas transferências.

## Como executar

Pré-requisitos: Node.js 24.15+ ou 26.x LTS, Corepack e Docker Desktop.

1. Copiar `.env.example` para `.env` e ajustar apenas valores locais se necessário.
2. Executar `pnpm install --frozen-lockfile`.
3. Executar `docker compose up -d`.
4. Executar `pnpm dev`.

A web fica em `http://localhost:3000` e o healthcheck público em `http://localhost:3000/api/health` quando o proxy da web está ativo.

Comandos de qualidade configurados: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build`. Esta atualização de handoff não os reexecutou.

## Fases 2 e 3 concluídas e validadas

- Adicionados Prisma 7, PostgreSQL driver e Better Auth 1.7.20 à API, com schema e migração inicial para `User`, `Session`, `Account` e `Verification`.
- Better Auth é atendido pela API NestJS em `/api/auth/*`; sessões usam cookies e o guard global protege `/api/me`.
- A web possui formulário mínimo de cadastro, login e logout pelo cliente Better Auth.
- A migração inicial foi aplicada ao PostgreSQL local em 11/11/2026. Há uma conta de desenvolvimento e uma sessão persistidas para validação local.
- O healthcheck responde com sucesso; `/api/me` rejeita chamadas sem sessão com `401`.
- Formatação, lint, typecheck, testes e build passam. O lint mantém somente um aviso preexistente em `apps/web/postcss.config.mjs`.
- A Fase 3 adicionou contratos Zod/tipos para provedores e arquivos normalizados, o registro de adaptadores e fakes de Google Drive, Dropbox e OneDrive. Não há rede, OAuth, tokens externos, conexões persistidas ou alteração de banco nessa arquitetura.

## Próximo ponto de retomada

A próxima fase proposta é a Fase 4 — integração com Google Drive: configurar OAuth, persistir uma conexão externa protegida e listar/navegar dados reais no ambiente de desenvolvimento. Não iniciar sem plano e aprovação explícita.

Não antecipar OAuth, adaptadores, listagem de provedores, cache ou transferências. Cada fase requer plano e aprovação explícita, conforme o SDD.

## Estado do worktree observado

No momento da elaboração, `main` aponta para `d02943e`. O status também reportava `dasd` e `.git.codex-hidden/` como não rastreados; eles não foram modificados por esta atualização e devem ser avaliados antes de qualquer commit.
