import type { auth } from '../auth/auth.js';

declare global {
  namespace Express {
    interface Request {
      authSession?: typeof auth.$Infer.Session;
    }
  }
}

export {};
