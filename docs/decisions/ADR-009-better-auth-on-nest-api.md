# ADR-009 — Better Auth servido pela API NestJS

**Status:** Aceita em 10/11/2026.

## Decisão

O Better Auth é instanciado na API NestJS, persiste dados via Prisma 7/PostgreSQL e é servido diretamente pelo adaptador Express em `/api/auth/*`. O Next.js continua encaminhando `/api/*` para a API, preservando a origem pública única.

## Motivo

A opção mantém o backend como autoridade única para autenticação, sessão e futura autorização de `CloudConnection`. Evita duplicar configuração e acesso ao banco entre web e API. O handler é montado antes do parser JSON do Express, requisito do Better Auth.

## Consequência

As rotas Nest usam um guard global que resolve a sessão pelo cookie e rejeita requisições não autenticadas. Healthcheck e endpoints futuros explicitamente públicos devem usar `@PublicRoute()`. A web usa somente o cliente Better Auth e não recebe o segredo da sessão.
