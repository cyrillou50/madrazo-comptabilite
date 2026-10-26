import { z } from 'zod';

const booleanString = z.enum(['0', '1']).transform((value) => value === '1');
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3002),
  TRUST_PROXY: booleanString.default(false),
  DATABASE_HOST: z.string().min(1).default('127.0.0.1'),
  DATABASE_PORT: z.coerce.number().int().min(1).max(65535).default(3306),
  DATABASE_NAME: z.string().min(1).default('madrazo'),
  DATABASE_USER: z.string().min(1).default('madrazo_app'),
  DATABASE_PASSWORD: z.string().default(''),
  SESSION_SECRET: z.string().min(32).default('development-only-change-this-secret-now'),
  SESSION_COOKIE_DOMAIN: z.string().optional(),
  ALLOWED_ORIGINS: z.string().default('http://localhost:5173'),
  LOG_LEVEL: z.string().default('info'),
});

export type AppConfig = ReturnType<typeof loadConfig>;

export function loadConfig(environment: NodeJS.ProcessEnv = process.env) {
  const parsed = schema.parse(environment);
  if (parsed.NODE_ENV === 'production' && parsed.SESSION_SECRET.startsWith('development-')) {
    throw new Error('SESSION_SECRET doit être remplacé en production.');
  }
  if (parsed.NODE_ENV === 'production' && !parsed.DATABASE_PASSWORD) {
    throw new Error('DATABASE_PASSWORD est obligatoire en production.');
  }
  if (parsed.NODE_ENV === 'production' && parsed.ALLOWED_ORIGINS.split(',').some((origin) => /localhost|127\.0\.0\.1/.test(origin))) {
    throw new Error('ALLOWED_ORIGINS ne doit pas contenir une origine locale en production.');
  }
  return {
    env: parsed.NODE_ENV,
    port: parsed.PORT,
    trustProxy: parsed.TRUST_PROXY,
    database: {
      host: parsed.DATABASE_HOST,
      port: parsed.DATABASE_PORT,
      database: parsed.DATABASE_NAME,
      user: parsed.DATABASE_USER,
      password: parsed.DATABASE_PASSWORD,
    },
    sessionSecret: parsed.SESSION_SECRET,
    sessionCookieDomain: parsed.SESSION_COOKIE_DOMAIN || undefined,
    allowedOrigins: parsed.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean),
    logLevel: parsed.LOG_LEVEL,
  };
}
