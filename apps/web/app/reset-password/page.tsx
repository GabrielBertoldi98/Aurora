import { Suspense } from 'react';

import { ResetPasswordForm } from './reset-password-form';

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <h1 className="text-3xl font-semibold text-slate-950">Redefinir senha</h1>
      <Suspense fallback={<p className="mt-8">Verificando link de redefinição…</p>}>
        <ResetPasswordForm />
      </Suspense>
    </main>
  );
}
