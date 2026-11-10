# ADR-003 — Separar autenticação interna de OAuth dos provedores

**Status:** Aceita em 09/11/2026.

## Decisão

Better Auth será usado apenas para contas e sessões internas. Google Drive, Dropbox e OneDrive serão conexões independentes, associadas à entidade futura `CloudConnection`.

## Consequência

Um usuário poderá conectar várias contas do mesmo provedor sem confundi-las com a autenticação no Cloud Hub.
