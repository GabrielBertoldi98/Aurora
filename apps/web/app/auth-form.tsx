'use client';

import { FormEvent, useState } from 'react';

import { authClient } from '../lib/auth-client';

type Mode = 'sign-in' | 'sign-up' | 'forgot-password';
type ConnectableProvider = 'google-drive' | 'dropbox';

export function AuthForm() {
  const { data: session, isPending } = authClient.useSession();
  const [mode, setMode] = useState<Mode>('sign-in');
  const [message, setMessage] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [connectingProvider, setConnectingProvider] = useState<ConnectableProvider>();

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

  async function connectProvider(provider: ConnectableProvider, displayName: string) {
    setConnectingProvider(provider);
    setMessage(undefined);

    try {
      const response = await fetch(`/api/cloud-connections/${provider}/connect`, {
        method: 'POST',
      });
      const payload: unknown = await response.json();

      if (
        !response.ok ||
        !payload ||
        typeof payload !== 'object' ||
        !('authorizationUrl' in payload) ||
        typeof payload.authorizationUrl !== 'string'
      ) {
        throw new Error(`Não foi possível iniciar a conexão com o ${displayName}.`);
      }

      window.location.assign(payload.authorizationUrl);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : `Não foi possível conectar o ${displayName}.`,
      );
      setConnectingProvider(undefined);
    }
  }

  if (isPending) {
    return <p>Verificando sessão…</p>;
  }

  if (session) {
    return (
      <section className="mt-8 rounded-lg border border-slate-200 p-6">
        <p className="font-medium">Sessão ativa: {session.user.email}</p>
        {message ? <p className="mt-3 text-red-700">{message}</p> : null}
        <button
          className="mt-4 rounded bg-sky-700 px-4 py-2 text-white disabled:opacity-50"
          disabled={Boolean(connectingProvider)}
          onClick={() => void connectProvider('google-drive', 'Google Drive')}
          type="button"
        >
          {connectingProvider === 'google-drive' ? 'Redirecionando…' : 'Conectar Google Drive'}
        </button>
        <button
          className="ml-3 mt-4 rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50"
          disabled={Boolean(connectingProvider)}
          onClick={() => void connectProvider('dropbox', 'Dropbox')}
          type="button"
        >
          {connectingProvider === 'dropbox' ? 'Redirecionando…' : 'Conectar Dropbox'}
        </button>
        <button
          className="ml-3 mt-4 rounded bg-slate-900 px-4 py-2 text-white"
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
