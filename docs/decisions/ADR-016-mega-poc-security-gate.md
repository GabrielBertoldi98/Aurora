# ADR-016 — PoC do MEGA: não adotar autenticação de conta no MVP

**Status:** Aceita em 26/11/2026.

## Contexto

A Fase 8 avaliou se o MEGA poderia ser adicionado ao Cloud Hub sem a aplicação solicitar, receber ou persistir a senha da pessoa usuária.

O SDK oficial do MEGA é nativo e requer uma application key. A documentação do MEGAcmd informa que o primeiro login de conta ocorre com e-mail e senha; uma sessão pode ser retomada depois, mas essa sessão representa uma credencial de acesso à conta. O projeto oficial `mega-mcp` demonstra uma alternativa de login fora da aplicação: a pessoa usuária autentica diretamente no terminal do MEGAcmd, e a ferramenta posterior não recebe a senha nem retorna a sessão.

Esse modelo é apropriado para uma ferramenta local controlada pela própria pessoa usuária. Ele não fornece, porém, uma autorização delegada equivalente a OAuth para o backend web multiusuário do Cloud Hub: o servidor teria de compartilhar ou administrar uma sessão local do MEGAcmd por usuário.

## Decisão

Não será adicionada integração de conta MEGA ao MVP atual.

O Cloud Hub não aceitará senha MEGA, recovery key, master key nem session string por interface, API, `.env`, banco de dados ou logs. Também não será adotada a biblioteca não oficial MEGAJS, cuja forma documentada de login recebe e-mail e senha.

Não foi executada uma listagem real na PoC: fazê-lo exigiria uma credencial de conta ou uma sessão externa que o modelo atual não pode receber com segurança. Nenhuma migração, adaptador, botão ou tabela de credencial MEGA será criada.

## Consequências

- A Fase 8 encerra com decisão **no-go** para contas MEGA no MVP, preservando o requisito de não coletar senha.
- Google Drive e Dropbox permanecem os provedores disponíveis no dashboard. OneDrive continua adiado e separado da versão publicada.
- A integração poderá ser reavaliada somente se o MEGA oferecer autorização delegada revogável adequada a aplicações web, ou se for aprovado um companion local com isolamento de sessão por usuário e revisão de segurança própria.
- A Fase 9 continuará focada em transferências entre os provedores já validados.

## Referências

- [MEGA SDK](https://github.com/meganz/sdk)
- [MEGAcmd — login](https://github.com/meganz/MEGAcmd/blob/master/contrib/docs/commands/login.md)
- [MEGA MCP — login out-of-band](https://github.com/meganz/mega-mcp)
- [MEGAJS — biblioteca não oficial](https://mega.js.org/)
