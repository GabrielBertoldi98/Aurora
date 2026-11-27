# Handoff — Cloud Hub

**Atualizado em:** 26/11/2026

## Estado atual

As Fases 0 a 5 e 7 a 9 estão concluídas. O Cloud Hub já possui autenticação interna, arquitetura de adaptadores, integrações Google Drive e Dropbox reais validadas, recuperação de senha validada com envio real pelo Resend, dashboard unificado e transferências assíncronas Google Drive ↔ Dropbox. O OneDrive permanece adiado; a PoC do MEGA encerrou em no-go por segurança.

## Entregas por fase

- **Fase 0:** decisões arquiteturais registradas em ADRs, incluindo pnpm, mesma origem pública, Better Auth separado do OAuth externo, PKCE e tokens externos no backend.
- **Fase 1:** monorepo, Next.js, NestJS, Docker Compose com PostgreSQL/Redis e pipeline de qualidade.
- **Fase 2:** Better Auth, Prisma, PostgreSQL, cadastro/login/logout, sessão por cookie `HttpOnly` e rota protegida `GET /api/me`.
- **Fase 3:** contratos Zod/tipos compartilhados, registro de adaptadores e fakes de Google Drive, Dropbox e OneDrive.
- **Fase 4:** conexões externas, credenciais cifradas, transações OAuth, callback Google, refresh de token e adaptador Google Drive real para listagem/navegação; validada com uma conta Google de desenvolvimento.
- **Fase 5:** OAuth Dropbox com PKCE e acesso offline, adaptador Dropbox API v2, listagem/navegação paginada, interface de conexão e testes; validada com uma conta Dropbox de desenvolvimento.
- **Fase 5.1:** recuperação de senha por link temporário do Better Auth, envio Resend, expiração de uma hora e revogação de sessões; validada com entrega real de e-mail.
- **Fase 6:** integração OneDrive adiada; não faz parte da versão publicada.
- **Fase 7:** dashboard autenticado e explorador unificado para Google Drive e Dropbox, com raiz combinada no filtro Todas, navegação por pastas, paginação por conexão e busca/ordenação locais.
- **Fase 8:** PoC MEGA concluída em no-go. O modelo oficial avaliado exige senha inicial ou sessão prévia e não oferece autorização delegada segura para o backend multiusuário; nenhum código, credencial ou migração MEGA foi adicionado.
- **Fase 9:** transferências assíncronas entre Google Drive e Dropbox: tabelas `transfer`/`transfer_log`, fila BullMQ no Redis, worker isolado, streaming direto entre provedores, progresso, retentativas e cancelamento de trabalhos pendentes. As contas devem ser reconectadas com permissões de conteúdo antes do primeiro uso.

## Fase 9 — transferência de arquivos

- A migração `20261127010000_add_transfers` cria `transfer` e `transfer_log`. Foi aplicada ao PostgreSQL local e as duas tabelas foram confirmadas sem consultar dados de usuários.
- A API cria, lista e cancela transferências em `/api/transfers`; todas as rotas exigem a sessão autenticada e validam que origem e destino pertencem ao mesmo usuário.
- BullMQ persiste trabalhos no Redis. A API não executa o trabalho: iniciar `pnpm worker` em outro terminal para processar, inicialmente, uma transferência por vez.
- O worker faz streaming entre Google Drive e Dropbox; não persiste conteúdo de arquivo, token, mensagem bruta de erro do provedor ou caminho de destino em logs de auditoria.
- Antes da validação real, habilitar `files.content.read` e `files.content.write` no Dropbox App Console e reconectar ambas as contas no dashboard. O Google solicitará `drive.readonly` e `drive.file`. Usar primeiro um arquivo pequeno e não sensível.

## Fase 4 — pontos técnicos

- A migração `20261116000000_add_cloud_connections` foi aplicada ao PostgreSQL local. Ela cria `cloud_connection`, `cloud_credential` e `oauth_transaction`.
- Tokens são cifrados por `TokenEncryptionService` com AES-256-GCM; a chave vem exclusivamente de `TOKEN_ENCRYPTION_KEY`.
- Endpoints previstos:
  - `GET /api/cloud-connections`
  - `POST /api/cloud-connections/google-drive/connect`
  - `GET /api/cloud-connections/google-drive/callback`
  - `POST /api/cloud-connections/dropbox/connect`
  - `GET /api/cloud-connections/dropbox/callback`
  - `GET /api/cloud-connections/:connectionId/files`
- Google Drive e Dropbox usam adaptadores reais e são apresentados no dashboard. OneDrive permanece adiado. Não há upload, download, exclusão ou transferência nesta etapa.

## Validação Google real

Em 16/11/2026, o fluxo OAuth foi concluído com uma conta Google de desenvolvimento. A conexão ativa foi encontrada no PostgreSQL e o adaptador realizou uma listagem real com 10 itens e cursor de próxima página. Tokens e nomes de arquivos não foram exibidos.

## Validação Dropbox real

Em 24/11/2026, o fluxo OAuth foi concluído com uma conta Dropbox de desenvolvimento. A conexão ativa foi encontrada no PostgreSQL e o adaptador realizou uma listagem real com 2 itens, sem próxima página. Tokens, e-mails e nomes de arquivos não foram exibidos.

## Validação de recuperação de senha

Em 24/11/2026, o envio real de e-mail de recuperação foi validado pelo usuário com o Resend. As credenciais do Resend permanecem exclusivamente no `.env`; links e tokens de redefinição não foram registrados na documentação.

## Qualidade e próximo passo

Após a implementação da Fase 9, é necessário executar a bateria completa de qualidade e validar uma transferência real controlada. O próximo trabalho recomendado é suportar seleção de pasta de destino, exportação explícita de documentos nativos do Google Workspace e cancelamento cooperativo de uma transferência já em streaming.
