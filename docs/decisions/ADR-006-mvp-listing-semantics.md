# ADR-006 — Sem cache e sem paginação global no MVP inicial

**Status:** Aceita em 09/11/2026.

## Decisão

Listagem, busca e ordenação serão inicialmente por conexão de provedor. A interface será unificada por filtros, sem prometer cursor ou ordenação global entre APIs heterogêneas.

## Consequência

Cache de metadados e busca global só serão projetados quando existir necessidade concreta e critérios de invalidação.
