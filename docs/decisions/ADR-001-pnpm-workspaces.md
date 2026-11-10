# ADR-001 — pnpm workspaces

**Status:** Aceita em 09/11/2026.

## Decisão

Usar pnpm 12.18.0 como único gerenciador de pacotes e `pnpm-workspace.yaml` para o monorepo.

## Motivo

O protocolo `workspace:` evita que uma dependência interna seja resolvida acidentalmente do registro público e o lockfile único torna a instalação reproduzível.
