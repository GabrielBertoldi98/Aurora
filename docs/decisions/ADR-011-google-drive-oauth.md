# ADR-011 — OAuth do Google Drive no backend

**Status:** Aceita em 16/11/2026.

## Decisão

A conexão Google Drive usa Authorization Code Flow no backend, com PKCE, `state` aleatório de uso único e `access_type=offline`. A transação temporária vincula o fluxo ao usuário interno; access e refresh tokens são cifrados com AES-256-GCM antes de serem armazenados.

## Motivo

O fluxo evita enviar client secret ou tokens ao navegador, permite renovar o access token no backend e protege o callback contra CSRF e replay.

## Consequência

O ambiente local deve configurar Google Drive API, OAuth Client Web e o callback `http://localhost:3000/api/cloud-connections/google-drive/callback`. A integração solicita o escopo restrito `drive.metadata.readonly`, adequado à listagem de metadados de todo o Drive; publicação pública exige atender aos requisitos de verificação do Google.
