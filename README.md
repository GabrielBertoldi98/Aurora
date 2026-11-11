# Cloud Hub

Projeto de estudo para centralizar a navegação de arquivos em Google Drive, Dropbox e OneDrive, mantendo os arquivos nos provedores de origem.

## Estado atual

As Fases 0, 1, 2 e 3 foram concluídas. A próxima etapa é a Fase 4 — integração com Google Drive, que exige plano e aprovação antes de começar. OAuth e integrações reais com provedores externos ainda não foram implementados.

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

## Tecnologias utilizadas

| Tecnologia        | Uso no projeto                                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Node.js 24/26 LTS | Ambiente de execução da aplicação e das ferramentas de desenvolvimento.                                                        |
| TypeScript        | Tipagem estática e contratos mais seguros em web, API e pacotes compartilhados.                                                |
| pnpm Workspaces   | Gerenciamento de dependências e organização do monorepo.                                                                       |
| Next.js e React   | Interface web, páginas e proxy da mesma origem para a API.                                                                     |
| Tailwind CSS      | Estilização utilitária da interface web.                                                                                       |
| NestJS            | API HTTP, módulos, controllers e guardas de autorização.                                                                       |
| Better Auth       | Cadastro, login, logout e gerenciamento de sessão por cookies `HttpOnly`.                                                      |
| Prisma            | Schema, migrações, cliente tipado e acesso da API ao PostgreSQL.                                                               |
| PostgreSQL        | Banco persistente de usuários, contas e sessões; futuramente, conexões de nuvem.                                               |
| Redis             | Serviço em memória já disponível para necessidades futuras de cache, rate limiting ou filas; ainda não é usado pela aplicação. |
| Docker Compose    | Inicialização reproduzível de PostgreSQL e Redis no desenvolvimento local.                                                     |
| Zod               | Base para validação de contratos compartilhados; será empregado conforme os contratos de domínio forem criados.                |
| Vitest            | Execução de testes automatizados.                                                                                              |
| ESLint e Prettier | Verificação de qualidade e padronização de código.                                                                             |
| GitHub Actions    | CI que executa formatação, lint, typecheck, testes e build em pushes e pull requests.                                          |

## Pré-requisitos

- Node.js 24.15+ ou 26.x LTS
- Corepack habilitado para usar pnpm 12.18.0
- Docker Desktop, para PostgreSQL e Redis

## Como executar após instalar os pré-requisitos

1. Copie `.env.example` para `.env`, defina um `BETTER_AUTH_SECRET` local de alta entropia (32+ caracteres) e altere somente valores locais se necessário. Os scripts da API carregam esse arquivo da raiz do monorepo.
2. Execute `pnpm install --frozen-lockfile`.
3. Inicie a infraestrutura com `docker compose up -d`.
4. Inicie web e API com `pnpm dev`.

A web estará em `http://localhost:3000`; o healthcheck público estará em `http://localhost:3000/api/health` quando o proxy da web estiver ativo.

Para aplicar a migração inicial de autenticação, com o PostgreSQL em execução, execute `pnpm --filter @cloud-hub/api db:migrate`.

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
