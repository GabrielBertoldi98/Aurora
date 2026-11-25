interface PasswordResetEmail {
  readonly to: string;
  readonly userName: string;
  readonly resetUrl: string;
}

export async function sendPasswordResetEmail({
  to,
  userName,
  resetUrl,
}: PasswordResetEmail): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from || apiKey.startsWith('replace_')) {
    throw new Error('Resend email configuration is incomplete.');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: 'Redefina sua senha do Cloud Hub',
      html: [
        `<p>Olá, ${escapeHtml(userName)}.</p>`,
        '<p>Recebemos uma solicitação para redefinir sua senha do Cloud Hub.</p>',
        `<p><a href="${escapeHtml(resetUrl)}">Redefinir minha senha</a></p>`,
        '<p>Este link expira em uma hora. Se você não fez esta solicitação, ignore este e-mail.</p>',
      ].join(''),
      text: [
        `Olá, ${userName}.`,
        '',
        'Recebemos uma solicitação para redefinir sua senha do Cloud Hub.',
        `Redefina sua senha: ${resetUrl}`,
        '',
        'Este link expira em uma hora. Se você não fez esta solicitação, ignore este e-mail.',
      ].join('\n'),
    }),
  });

  if (!response.ok) {
    throw new Error('Resend could not send the password reset email.');
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
