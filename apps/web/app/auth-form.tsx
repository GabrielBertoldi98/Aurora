'use client';

import { FormEvent, useState } from 'react';

import { authClient } from '../lib/auth-client';
import { Dashboard } from './dashboard';

type Mode = 'sign-in' | 'sign-up' | 'forgot-password';

export function AuthForm() {
  const { data: session, isPending } = authClient.useSession();
  const [mode, setMode] = useState<Mode>('sign-in');
  const [message, setMessage] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '');
    const password = String(form.get('password') ?? '');
    const name = String(form.get('name') ?? '');

    setIsSubmitting(true);
    setMessage(undefined);

    try {
      const result =
        mode === 'sign-up'
          ? await authClient.signUp.email({ email, name, password })
          : mode === 'forgot-password'
            ? await authClient.requestPasswordReset({
                email,
                redirectTo: `${window.location.origin}/reset-password`,
              })
            : await authClient.signIn.email({ email, password });

      if (result.error) {
        setMessage(
          result.error.message ??
            (mode === 'sign-up'
              ? 'Não foi possível criar a conta. O e-mail pode já estar cadastrado ou a senha não atende aos requisitos.'
              : mode === 'forgot-password'
                ? 'Não foi possível solicitar a redefinição da senha. Tente novamente mais tarde.'
                : 'Não foi possível entrar. Verifique o e-mail e a senha.'),
        );
      } else if (mode === 'forgot-password') {
        setMessage(
          'Se houver uma conta para esse e-mail, enviaremos um link de redefinição em instantes.',
        );
      }
    } catch {
      setMessage(
        mode === 'sign-up'
          ? 'Não foi possível criar a conta porque a API não respondeu.'
          : mode === 'forgot-password'
            ? 'Não foi possível solicitar a redefinição porque a API não respondeu.'
            : 'Não foi possível entrar porque a API não respondeu.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isPending) {
    return <p>Verificando sessão…</p>;
  }

  if (session) {
    return <Dashboard userEmail={session.user.email} />;
  }

  return (
    <section className="mt-8 max-w-md rounded-lg border border-slate-200 p-6">
      <div className="mb-4 flex gap-3">
        <button className="font-medium underline" onClick={() => setMode('sign-in')} type="button">
          Entrar
        </button>
        <button className="font-medium underline" onClick={() => setMode('sign-up')} type="button">
          Criar conta
        </button>
        <button
          className="font-medium underline"
          onClick={() => setMode('forgot-password')}
          type="button"
        >
          Esqueci minha senha
        </button>
      </div>
      <form className="grid gap-4" onSubmit={onSubmit}>
        {mode === 'sign-up' ? (
          <label className="grid gap-1">
            Nome
            <input className="rounded border border-slate-300 p-2" name="name" required />
          </label>
        ) : null}
        <label className="grid gap-1">
          E-mail
          <input
            className="rounded border border-slate-300 p-2"
            name="email"
            required
            type="email"
          />
        </label>
        {mode !== 'forgot-password' ? (
          <label className="grid gap-1">
            Senha
            <input
              className="rounded border border-slate-300 p-2"
              name="password"
              required
              type="password"
            />
          </label>
        ) : null}
        {message ? <p className="text-red-700">{message}</p> : null}
        <button
          className="rounded bg-sky-700 px-4 py-2 text-white disabled:opacity-50"
          disabled={isSubmitting}
        >
          {isSubmitting
            ? 'Enviando…'
            : mode === 'sign-up'
              ? 'Criar conta'
              : mode === 'forgot-password'
                ? 'Enviar link de redefinição'
                : 'Entrar'}
        </button>
      </form>
    </section>
  );
}
