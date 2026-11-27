# ADR-017 — transferências assíncronas com fila e permissões mínimas de conteúdo

**Status:** Aceita em 26/11/2026.

## Contexto

A navegação das Fases 4, 5 e 7 usa somente metadados. Transferir um arquivo entre Google Drive e Dropbox requer ler seu conteúdo em um provedor e escrever seu conteúdo no outro. Esse trabalho pode demorar, sofrer rate limit ou continuar além da requisição HTTP que o iniciou.

## Decisão

- A API agenda uma transferência no Redis por BullMQ e um processo `pnpm worker` separado a executa. O worker usa concorrência global igual a um inicialmente, reduzindo consumo de banda, duplicidade e impacto de falhas.
- O estado persistente fica no PostgreSQL: `queued`, `running`, `retrying`, `succeeded`, `failed` ou `cancelled`, junto de eventos de auditoria sem token, caminho remoto ou mensagem bruta do provedor.
- O arquivo flui diretamente em streaming entre as APIs dos provedores. O Cloud Hub não cria bucket, arquivo temporário nem coluna de conteúdo. A primeira versão destina o arquivo à raiz da conta escolhida e falha em conflito de nome, em vez de sobrescrever silenciosamente.
- Serão solicitados apenas os escopos necessários: `drive.readonly` e `drive.file` para Google Drive; `files.content.read` e `files.content.write` para Dropbox, além dos escopos de metadados já usados. Conexões existentes devem passar novamente pelo consentimento; não há ampliação automática de permissão.
- Apenas indisponibilidade temporária e rate limit recebem até duas retentativas exponenciais. Falhas de autenticação, permissão, formato não suportado e conflito exigem intervenção da pessoa usuária.

## Consequências

- Redis passa a ser dependência de execução: web/API e worker precisam dele disponível.
- Em desenvolvimento são necessários dois comandos: `pnpm dev` e `pnpm worker`.
- Google classifica `drive.readonly` como escopo restrito; uma publicação para usuários externos pode exigir a verificação aplicável pelo Google. O Dropbox App Console precisa autorizar os novos escopos antes da reconexão.
- Documentos nativos do Google Workspace não são exportados automaticamente nesta fase. A transferência inicial aceita somente arquivos binários que a API do Drive fornece como download.

## Referências

- [Google Drive API — autorização específica](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
- [Google Drive API — download](https://developers.google.com/workspace/drive/api/guides/manage-downloads)
- [Google Drive API — upload resumível](https://developers.google.com/workspace/drive/api/guides/manage-uploads)
- [Dropbox — OAuth e escopos](https://developers.dropbox.com/oauth-guide)
- [Dropbox — tratamento de erros](https://developers.dropbox.com/en-us/error-handling-guide)
