# ADR-012 — OAuth e listagem do Dropbox

## Decisão

O Dropbox será integrado por OAuth 2.0 Authorization Code Flow com PKCE (`S256`), `state` de uso único e `token_access_type=offline`. O backend realizará a troca de código, armazenará tokens somente cifrados e chamará a Dropbox API v2 para identificar a conta e listar arquivos ou pastas.

## Motivo

O Dropbox emite access tokens de curta duração e pode emitir refresh tokens quando o acesso offline é solicitado. Reutilizar a infraestrutura de `CloudConnection`, `CloudCredential` e `OAuthTransaction` preserva o mesmo isolamento por usuário e evita criar um mecanismo de credenciais específico por provedor.

## Consequência

O ambiente local deve criar uma aplicação Dropbox com permissões de leitura de conta e metadados, registrar o callback `http://localhost:3000/api/cloud-connections/dropbox/callback` e configurar `DROPBOX_CLIENT_ID` e `DROPBOX_CLIENT_SECRET` no `.env`, sem versioná-los. A aplicação solicita os escopos `account_info.read` e `files.metadata.read`; para navegar pelo conteúdo existente do usuário, a configuração da aplicação deve permitir acesso ao Dropbox completo.
