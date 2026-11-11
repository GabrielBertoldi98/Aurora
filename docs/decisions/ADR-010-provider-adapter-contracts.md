# ADR-010 — Contratos normalizados e adaptadores por provedor

**Status:** Aceita em 11/11/2026.

## Decisão

Cada provedor será representado por um adaptador que implementa um contrato comum de listagem. Os contratos compartilhados definem o arquivo normalizado, o contexto de conexão, paginação e capacidades. Um registro resolve o adaptador pelo provedor solicitado.

## Motivo

Google Drive, Dropbox e OneDrive têm APIs e capacidades diferentes. A abstração permite compartilhar regras de negócio sem prometer operações que um provedor não oferece.

## Consequência

Os adaptadores atuais usam dados simulados, sem OAuth, rede ou credenciais externas. Nesta fase, somente listagem e navegação são declaradas como disponíveis; busca e download permanecem indisponíveis até uma implementação real e testada.
