'use client';

import { FormEvent, useState } from 'react';

import { authClient } from '../lib/auth-client';

type Mode = 'sign-in' | 'sign-up';

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

    const result =
      mode === 'sign-up'
        ? await authClient.signUp.email({ email, name, password })
        : await authClient.signIn.email({ email, password });

    setIsSubmitting(false);
    setMessage(
      result.error?.message ?? (result.error ? 'Não foi possível autenticar.' : undefined),
    );
  }

  if (isPending) {
    return <p>Verificando sessão…</p>;
  }

  if (session) {
    return (
      <section className="mt-8 rounded-lg border border-slate-200 p-6">
        <p className="font-medium">Sessão ativa: {session.user.email}</p>
        <button
          className="mt-4 rounded bg-slate-900 px-4 py-2 text-white"
          onClick={() => void authClient.signOut()}
          type="button"
        >
          Sair
        </button>
      </section>
    );
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
        <label className="grid gap-1">
          Senha
          <input
            className="rounded border border-slate-300 p-2"
            name="password"
            required
            type="password"
          />
        </label>
        {message ? <p className="text-red-700">{message}</p> : null}
        <button
          className="rounded bg-sky-700 px-4 py-2 text-white disabled:opacity-50"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Enviando…' : mode === 'sign-up' ? 'Criar conta' : 'Entrar'}
        </button>
      </form>
    </section>
  );
}
