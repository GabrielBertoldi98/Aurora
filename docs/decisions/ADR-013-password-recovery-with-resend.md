# ADR-013 — Recuperação de senha por Resend

## Decisão

O Cloud Hub usará a recuperação de senha nativa do Better Auth com entrega de e-mail pelo Resend. O token será válido por uma hora e a redefinição revogará todas as sessões existentes do usuário.

## Motivo

As senhas são armazenadas como hashes e não podem ser recuperadas. Um link de uso único enviado ao e-mail cadastrado permite criar uma senha nova sem expor credenciais, tokens ou dados da conta.

## Consequência

O ambiente precisa configurar `RESEND_API_KEY` e `RESEND_FROM_EMAIL` no `.env`; o remetente deve ser autorizado no Resend. A interface sempre confirma a solicitação de forma genérica para não revelar se um e-mail possui conta. A troca de senha encerra sessões existentes, exigindo novo login em todos os dispositivos.
