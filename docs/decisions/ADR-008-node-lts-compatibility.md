# ADR-008 — Compatibilidade com Node.js 24 e 26 LTS

**Status:** Aceita em 10/11/2026.

## Decisão

Aceitar Node.js a partir de 24.15.0 e antes da versão 27. Isso inclui as linhas LTS 24 e 26.

## Motivo

O ambiente de desenvolvimento usa Node.js 26.13.0. A linha é LTS e é compatível com as versões escolhidas de Next.js, NestJS e Prisma. Aceitá-la evita exigir duas instalações de Node sem reduzir a compatibilidade do projeto.
