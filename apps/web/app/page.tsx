import { AuthForm } from './auth-form';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center p-8">
      <section>
        <p className="text-sm font-medium text-sky-700">Fase 1</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight">Cloud Hub</h1>
        <p className="mt-4 text-slate-700">
          A estrutura inicial está pronta. Autenticação e conexões com provedores serão introduzidas
          nas próximas fases aprovadas.
        </p>
        <AuthForm />
      </section>
    </main>
  );
}
