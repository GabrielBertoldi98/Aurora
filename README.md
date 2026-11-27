# Cloud Hub

Projeto de estudo para centralizar a navegação de arquivos em Google Drive, Dropbox e OneDrive, mantendo os arquivos nos provedores de origem.

## Estado atual

As Fases 0 a 5 e 7 a 9 foram concluídas. Google Drive, Dropbox e recuperação de senha foram validados com integrações reais; as transferências exigem que as contas sejam reconectadas com as novas permissões de conteúdo. OneDrive permanece adiado e o MEGA foi avaliado e rejeitado para o MVP por não atender ao requisito de autenticação sem coleta de senha.

## Histórico de fases

### Fase 0 — validação técnica e decisões

- Definido `pnpm` como único gerenciador de pacotes e adotado Node.js 24/26 LTS.
- Decidida a origem pública única: a web encaminha `/api/*` para a API.
- Separados os fluxos de autenticação interna e OAuth dos provedores.
- Definidas sessões por cookie `HttpOnly`, tokens externos somente no backend e OAuth Authorization Code com PKCE.
- Adiado o MiniStack para a futura fase de transferências.
- Decisões registradas nos ADRs em `docs/decisions/`.

### Fase 1 — infraestrutura local e estrutura inicial

- Criado o monorepo com `apps/web`, `apps/api` e `packages/contracts`.
- Criados os esqueletos da web Next.js e da API NestJS, incluindo `GET /api/health`.
- Configurados PostgreSQL e Redis no Docker Compose, com volumes e healthchecks.
- Configurados TypeScript estrito, ESLint, Prettier, Vitest e CI no GitHub Actions.

### Fase 2 — banco de dados e autenticação interna

- Configurados Prisma e PostgreSQL, com schema e migração das tabelas de usuários, contas, sessões e verificações.
- Integrado Better Auth para cadastro, login, logout e sessão por cookie.
- Criada interface mínima de autenticação na web.
- Protegida a rota `GET /api/me`; requisições sem sessão recebem `401`.
- Validados cadastro e sessão no banco local, além de formatação, lint, typecheck, testes e build.

### Fase 3 — arquitetura de provedores

- Criados contratos compartilhados para provedores, arquivos normalizados, paginação e capacidades.
- Criado registro de adaptadores e adaptadores simulados para Google Drive, Dropbox e OneDrive.
- Implementada listagem e navegação simuladas, sem OAuth, rede, credenciais externas ou alterações no banco.
- Declaradas as capacidades atuais: listagem e navegação disponíveis; busca e download indisponíveis.
- Adicionados testes de contrato, registro e navegação pelos adaptadores simulados.

### Fase 4 — integração com Google Drive

- Adicionados modelos e migração para conexões externas, credenciais cifradas e transações OAuth temporárias.
- Implementado Authorization Code Flow com PKCE, `state` de uso único e refresh token no backend.
- Implementado adaptador Google Drive real para listar e navegar arquivos/pastas, incluindo paginação e renovação de access token.
- Tokens são cifrados com AES-256-GCM antes de persistirem e não são retornados pela API.
- Adicionados testes de cifragem e da normalização de respostas Google simuladas.
- Validado o OAuth com uma conta Google de desenvolvimento e uma listagem real paginada do Drive, sem expor tokens ou metadados dos arquivos nos logs.

### Fase 5 — integração com Dropbox

- Implementado OAuth Authorization Code com PKCE, `state` de uso único e solicitação de acesso offline para receber refresh token.
- Reutilizadas as tabelas de conexões, credenciais cifradas e transações OAuth já existentes; não foi necessária nova migração.
- Implementado adaptador Dropbox API v2 para identificar a conta e listar/navegar arquivos e pastas com cursor de paginação.
- Generalizada a rota de arquivos para resolver o provedor da conexão persistida, preservando a validação de propriedade pelo usuário autenticado.
- Adicionado botão de conexão Dropbox e testes de normalização e continuação de paginação.
- Validado o OAuth com uma conta Dropbox de desenvolvimento e uma listagem real, sem expor tokens ou metadados dos arquivos nos logs.

### Fase 5.1 — recuperação de senha

- Implementado fluxo “Esqueci minha senha” e página para definir a nova senha a partir de um link temporário.
- Integrado Better Auth ao Resend para envio do link de redefinição, sem registrar token ou chave de API em logs.
- Tokens de redefinição expiram em uma hora; após a troca, todas as sessões existentes são revogadas.
- A resposta à solicitação é genérica para não revelar se o e-mail possui uma conta cadastrada.
- Validado o envio real de e-mail pelo Resend; `RESEND_API_KEY` e `RESEND_FROM_EMAIL` permanecem exclusivamente no `.env`.

### Fase 6 — integração com Microsoft OneDrive (adiada)

- A integração OneDrive foi adiada e não faz parte da versão publicada enquanto a configuração Microsoft Entra não estiver disponível.

### Fase 7 — interface unificada e dashboard

- Criado dashboard autenticado para visualizar conexões Google Drive e Dropbox, seus status e as contas vinculadas.
- Implementados filtros por provedor, seleção de conta e início seguro de novas conexões OAuth.
- Implementado explorador de arquivos com raiz combinada de Google Drive e Dropbox, navegação por pastas, breadcrumbs, paginação por conexão e identificação da origem de cada item.
- Adicionadas busca e ordenação locais, limitadas intencionalmente aos itens já carregados; não há promessa de busca ou paginação global combinada.
- Tokens, credenciais, identificadores externos e metadados específicos de provedores não são expostos pela interface.

### Fase 8 — PoC do MEGA

- Avaliados o SDK e as ferramentas oficiais do MEGA, incluindo o modelo de login fora da aplicação via MEGAcmd.
- Confirmado que o primeiro login de conta depende de senha ou de uma sessão já existente; não há, no caminho avaliado, autorização delegada equivalente a OAuth para o backend web multiusuário.
- Rejeitada a adoção de bibliotecas não oficiais que recebem e-mail e senha.
- Decisão **no-go**: nenhuma senha, recovery key, master key ou session string MEGA será aceita, persistida ou registrada pelo Cloud Hub.
- Nenhuma migração, adaptador ou botão MEGA foi criado; a decisão está registrada no ADR-016.

### Fase 9 — transferências assíncronas entre nuvens

- Criados os modelos `transfer` e `transfer_log`, com estados de fila, execução, nova tentativa, sucesso, falha e cancelamento. Os contadores de bytes usam `BIGINT` no PostgreSQL e são serializados como texto na API para evitar perda de precisão no navegador.
- Adicionada fila persistente BullMQ sobre o Redis já existente. A API somente agenda, consulta e cancela trabalhos; o comando `pnpm worker` inicia o processo separado que executa uma transferência por vez.
- Implementado streaming direto Google Drive ↔ Dropbox. O conteúdo passa do download do provedor de origem para o upload do provedor de destino, sem arquivo temporário, bucket ou conteúdo no banco do Cloud Hub.
- Adicionados progresso, retentativas exponenciais para indisponibilidade temporária, mensagens de erro seguras e cancelamento enquanto o trabalho ainda está na fila.
- A interface permite selecionar um arquivo e uma conta de destino na pasta raiz, acompanhar a fila e cancelar transferências pendentes.
- O OAuth agora pede somente as permissões adicionais necessárias: leitura de conteúdo no Google Drive e leitura/escrita de conteúdo no Dropbox. As conexões antigas não ganham permissões automaticamente: devem ser reconectadas pela pessoa usuária antes de transferir.

## Tecnologias utilizadas

| Tecnologia        | Uso no projeto                                                                                                  |
| ----------------- | --------------------------------------------------------------------------------------------------------------- |
| Node.js 24/26 LTS | Ambiente de execução da aplicação e das ferramentas de desenvolvimento.                                         |
| TypeScript        | Tipagem estática e contratos mais seguros em web, API e pacotes compartilhados.                                 |
| pnpm Workspaces   | Gerenciamento de dependências e organização do monorepo.                                                        |
| Next.js e React   | Interface web, páginas e proxy da mesma origem para a API.                                                      |
| Tailwind CSS      | Estilização utilitária da interface web.                                                                        |
| NestJS            | API HTTP, módulos, controllers e guardas de autorização.                                                        |
| Better Auth       | Cadastro, login, logout e gerenciamento de sessão por cookies `HttpOnly`.                                       |
| Prisma            | Schema, migrações, cliente tipado e acesso da API ao PostgreSQL.                                                |
| PostgreSQL        | Banco persistente de usuários, contas e sessões; futuramente, conexões de nuvem.                                |
| Redis             | Armazena a fila persistente de transferências, sem guardar os arquivos em si.                                   |
| BullMQ            | Coordena os trabalhos de transferência, suas retentativas e o worker separado sobre o Redis.                    |
| Docker Compose    | Inicialização reproduzível de PostgreSQL e Redis no desenvolvimento local.                                      |
| Zod               | Base para validação de contratos compartilhados; será empregado conforme os contratos de domínio forem criados. |
| Vitest            | Execução de testes automatizados.                                                                               |
| ESLint e Prettier | Verificação de qualidade e padronização de código.                                                              |
| GitHub Actions    | CI que executa formatação, lint, typecheck, testes e build em pushes e pull requests.                           |
| Google Drive API  | Fonte externa de metadados de arquivos e pastas da primeira integração real de provedor.                        |
| Dropbox API v2    | Fonte externa de metadados de arquivos e pastas da integração Dropbox.                                          |
| Resend            | Entrega de e-mails transacionais para recuperação de senha.                                                     |

## Pré-requisitos

- Node.js 24.15+ ou 26.x LTS
- Corepack habilitado para usar pnpm 12.18.0
- Docker Desktop, para PostgreSQL e Redis

## Como executar após instalar os pré-requisitos

1. Copie `.env.example` para `.env`, defina um `BETTER_AUTH_SECRET` local de alta entropia (32+ caracteres) e altere somente valores locais se necessário. Os scripts da API carregam esse arquivo da raiz do monorepo.
2. Execute `pnpm install --frozen-lockfile`.
3. Inicie a infraestrutura com `docker compose up -d`.
4. Inicie web e API com `pnpm dev`.
5. Em outro terminal, inicie o worker de transferências com `pnpm worker`.

A web estará em `http://localhost:3000`; o healthcheck público estará em `http://localhost:3000/api/health` quando o proxy da web estiver ativo.

Para aplicar a migração inicial de autenticação, com o PostgreSQL em execução, execute `pnpm --filter @cloud-hub/api db:migrate`.

Para habilitar transferências, reconecte Google Drive e Dropbox no dashboard. No console da aplicação Dropbox, as permissões `files.content.read` e `files.content.write` também precisam estar habilitadas antes da reconexão. Consulte o ADR-017 para os limites e a justificativa de segurança.

## Verificações de qualidade

```text
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Decisões arquiteturais

As decisões aprovadas da Fase 0 estão em `docs/decisions/`.
