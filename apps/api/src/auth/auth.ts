import { prismaAdapter } from '@better-auth/prisma-adapter';
import { betterAuth } from 'better-auth';

import { prisma } from '../database/prisma.js';

const secret = process.env.BETTER_AUTH_SECRET;
const baseURL = process.env.WEB_URL;

if (!secret || secret.length < 32) {
  throw new Error('BETTER_AUTH_SECRET must contain at least 32 characters.');
}

if (!baseURL) {
  throw new Error('WEB_URL must be configured before starting the API.');
}

export const auth = betterAuth({
  baseURL,
  secret,
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  emailAndPassword: {
    enabled: true,
  },
  advanced: {
    database: {
      joins: true,
    },
  },
});
