# ADR-015 — Dashboard unificado com listagem por conexão

**Status:** Aceita em 26/11/2026.

## Contexto

Google Drive e Dropbox oferecem paginação, ordenação e identificadores de pasta diferentes. Combinar respostas em um cursor global exigiria armazenar metadados localmente, definir invalidação e apresentar uma ordenação que não corresponderia necessariamente ao provedor de origem.

## Decisão

A Fase 7 apresenta um único dashboard autenticado. No filtro **Todas**, a raiz combina a primeira página de cada conexão ativa e identifica a origem de cada item. Ao escolher uma conta ou abrir uma pasta, a navegação passa a ocorrer em uma conexão por vez.

A busca e a ordenação são executadas somente no conjunto de itens já carregados na interface. A UI declara essa limitação explicitamente. O cursor de paginação continua opaco e é enviado apenas de volta para a mesma conexão da API.

O dashboard expõe apenas identificadores de conexão, nome/e-mail da conta vinculada e metadados normalizados de arquivos. Tokens, credenciais, identificadores externos e metadados específicos do provedor permanecem no backend.

## Consequências

- Não há busca global, cursor global ou cache de arquivos nesta fase. O filtro **Todas** não oferece paginação combinada: cada origem contribui somente com sua primeira página carregada.
- A autorização continua no backend: `GET /cloud-connections/:connectionId/files` confere a propriedade da conexão antes de acessar o adaptador.
- Google Drive e Dropbox são os únicos provedores apresentados na Fase 7; OneDrive permanece adiado até sua configuração e validação reais.
