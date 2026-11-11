# ADR-004 — Sessão por cookie e tokens externos no backend

**Status:** Aceita em 09/11/2026.

## Decisão

Sessões internas usarão cookies `HttpOnly`. Tokens de provedores nunca serão enviados ao navegador e serão criptografados no banco com AES-256-GCM e versão de chave.

## Consequência

As próximas fases precisarão separar o segredo do Better Auth do material de criptografia dos tokens externos.
