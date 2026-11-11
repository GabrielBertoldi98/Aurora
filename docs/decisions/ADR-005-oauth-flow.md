# ADR-005 — OAuth Authorization Code com PKCE

**Status:** Aceita em 09/11/2026.

## Decisão

Os três provedores usarão Authorization Code Flow, PKCE e `state` aleatório, de uso único e com expiração curta.

## Consequência

Na fase de provedores haverá uma transação OAuth temporária vinculada ao usuário que iniciou a conexão.
