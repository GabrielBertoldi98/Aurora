'use client';

import { FormEvent, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import { authClient } from '../../lib/auth-client';

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const invalidToken = searchParams.get('error');
  const [message, setMessage] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      setMessage('Este link de redefinição é inválido ou expirou. Solicite um novo link.');
      return;
    }

    const form = new FormData(event.currentTarget);
    const password = String(form.get('password') ?? '');
    const passwordConfirmation = String(form.get('passwordConfirmation') ?? '');

    if (password !== passwordConfirmation) {
      setMessage('As senhas não coincidem.');
      return;
    }

    setIsSubmitting(true);
    setMessage(undefined);

    try {
      const result = await authClient.resetPassword({ newPassword: password, token });

      setMessage(
        result.error?.message ??
          (result.error
            ? 'Não foi possível redefinir a senha. Solicite um novo link e tente novamente.'
            : 'Senha redefinida com sucesso. Você já pode entrar com a nova senha.'),
      );
    } catch {
      setMessage('Não foi possível redefinir a senha porque a API não respondeu.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (invalidToken || !token) {
    return (
      <p className="mt-8 text-red-700">
        Este link de redefinição é inválido ou expirou. Volte à página inicial para solicitar outro.
      </p>
    );
  }

  return (
    <form
      className="mt-8 grid max-w-md gap-4 rounded-lg border border-slate-200 p-6"
      onSubmit={onSubmit}
    >
      <label className="grid gap-1">
        Nova senha
        <input
          className="rounded border border-slate-300 p-2"
          minLength={8}
          name="password"
          required
          type="password"
        />
      </label>
      <label className="grid gap-1">
        Confirme a nova senha
        <input
          className="rounded border border-slate-300 p-2"
          minLength={8}
          name="passwordConfirmation"
          required
          type="password"
        />
      </label>
      {message ? <p className="text-red-700">{message}</p> : null}
      <button
        className="rounded bg-sky-700 px-4 py-2 text-white disabled:opacity-50"
        disabled={isSubmitting}
      >
        {isSubmitting ? 'Redefinindo…' : 'Redefinir senha'}
      </button>
    </form>
  );
}
