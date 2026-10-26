import type { Principal } from '../middleware/auth.js';

declare global {
  namespace Express {
    interface Request { principal?: Principal; }
  }
}

declare module 'express-session' {
  interface SessionData { userId?: number; csrfToken?: string; }
}

export {};
