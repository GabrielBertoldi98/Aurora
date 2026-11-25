import { afterEach, describe, expect, it, vi } from 'vitest';

import { sendPasswordResetEmail } from '../src/email/resend.service.js';

describe('sendPasswordResetEmail', () => {
  const originalApiKey = process.env.RESEND_API_KEY;
  const originalFrom = process.env.RESEND_FROM_EMAIL;

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalApiKey) {
      process.env.RESEND_API_KEY = originalApiKey;
    } else {
      delete process.env.RESEND_API_KEY;
    }
    if (originalFrom) {
      process.env.RESEND_FROM_EMAIL = originalFrom;
    } else {
      delete process.env.RESEND_FROM_EMAIL;
    }
  });

  it('sends a password reset link through Resend without exposing the API key', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    process.env.RESEND_FROM_EMAIL = 'Cloud Hub <onboarding@resend.dev>';
    let requestBody = '';
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      requestBody = String(init?.body ?? '');
      return new Response(JSON.stringify({ id: 'email-id' }));
    });
    vi.stubGlobal('fetch', fetchMock);

    await sendPasswordResetEmail({
      to: 'user@example.com',
      userName: 'User',
      resetUrl: 'http://localhost:3000/reset-password?token=reset-token',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: 'Bearer re_test_key' }),
      }),
    );
    expect(requestBody).not.toContain('re_test_key');
  });

  it('requires the Resend configuration only when an email is sent', async () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM_EMAIL;

    await expect(
      sendPasswordResetEmail({
        to: 'user@example.com',
        userName: 'User',
        resetUrl: 'http://localhost:3000/reset-password?token=reset-token',
      }),
    ).rejects.toThrow('Resend email configuration is incomplete.');
  });
});
