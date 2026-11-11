# ADR-002 — Web e API na mesma origem pública

**Status:** Aceita em 09/11/2026.

## Decisão

O navegador acessa a web em uma única origem. O Next.js encaminha `/api/*` para o NestJS no desenvolvimento; em produção, um proxy reverso assumirá esse papel.

## Consequência

Cookies de sessão permanecem na mesma origem e a aplicação não depende de CORS para os fluxos normais.
