# Handoff — Cloud Hub

**Atualizado em:** 16/11/2026

## Estado atual

As Fases 0 a 4 estão implementadas e validadas. O Cloud Hub já possui autenticação interna, arquitetura de adaptadores e integração real com Google Drive.

## Entregas por fase

- **Fase 0:** decisões arquiteturais registradas em ADRs, incluindo pnpm, mesma origem pública, Better Auth separado do OAuth externo, PKCE e tokens externos no backend.
- **Fase 1:** monorepo, Next.js, NestJS, Docker Compose com PostgreSQL/Redis e pipeline de qualidade.
- **Fase 2:** Better Auth, Prisma, PostgreSQL, cadastro/login/logout, sessão por cookie `HttpOnly` e rota protegida `GET /api/me`.
- **Fase 3:** contratos Zod/tipos compartilhados, registro de adaptadores e fakes de Google Drive, Dropbox e OneDrive.
- **Fase 4:** conexões externas, credenciais cifradas, transações OAuth, callback Google, refresh de token e adaptador Google Drive real para listagem/navegação; validada com uma conta Google de desenvolvimento.

## Fase 4 — pontos técnicos

- A migração `20261116000000_add_cloud_connections` foi aplicada ao PostgreSQL local. Ela cria `cloud_connection`, `cloud_credential` e `oauth_transaction`.
- Tokens são cifrados por `TokenEncryptionService` com AES-256-GCM; a chave vem exclusivamente de `TOKEN_ENCRYPTION_KEY`.
- Endpoints previstos:
  - `GET /api/cloud-connections`
  - `POST /api/cloud-connections/google-drive/connect`
  - `GET /api/cloud-connections/google-drive/callback`
  - `GET /api/cloud-connections/:connectionId/files`
- Dropbox e OneDrive continuam como adaptadores simulados. Não há upload, download, exclusão, transferência ou interface unificada nesta etapa.

## Validação Google real

Em 16/11/2026, o fluxo OAuth foi concluído com uma conta Google de desenvolvimento. A conexão ativa foi encontrada no PostgreSQL e o adaptador realizou uma listagem real com 10 itens e cursor de próxima página. Tokens e nomes de arquivos não foram exibidos.

## Qualidade e próximo passo

Formatação, lint, typecheck, testes e build passaram em 16/11/2026; o lint mantém somente o aviso preexistente de `apps/web/postcss.config.mjs`. O próximo trabalho deve ser planejado e aprovado antes de iniciar integrações reais com Dropbox ou OneDrive.
