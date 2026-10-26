import { randomUUID } from 'node:crypto';
import cors from 'cors';
import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import type { Pool } from 'mysql2/promise';
import pino from 'pino';
import { pinoHttp } from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import type { AppConfig } from './config.js';
import { MariaDbSessionStore } from './infra/session-store.js';
import { ApiError } from './lib/errors.js';
import { asyncHandler } from './lib/http.js';
import { authenticate } from './middleware/auth.js';
import { verifyCsrf } from './middleware/csrf.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { openApiDocument } from './openapi.js';
import { settingsRouter, auditRouter } from './routes/admin.js';
import { authRouter } from './routes/auth.js';
import { dashboardRouter } from './routes/dashboard.js';
import { debtsRouter } from './routes/debts.js';
import { contactsRouter, groupsRouter, itemsRouter } from './routes/entities.js';
import { expenseReadRouter } from './routes/expense-read.js';
import { financesRouter } from './routes/finances.js';
import { expensesRouter, paymentsRouter, stocksRouter } from './routes/finance-stock.js';
import { inventoryRouter } from './routes/inventory.js';
import { ordersRouter } from './routes/orders.js';
import { bulkSettingsRouter } from './routes/settings-bulk.js';
import { usersRouter } from './routes/users.js';

export function createApp(pool: Pool, config: AppConfig) {
  const app = express();
  if (config.trustProxy) app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(pinoHttp({ logger: pino({ level: config.logLevel }), genReqId: (request, response) => {
    const id = request.headers['x-request-id']?.toString().slice(0, 100) || randomUUID();
    response.setHeader('X-Request-Id', id); return id;
  } }));
  app.use(helmet({ contentSecurityPolicy: config.env === 'production' }));
  app.use(cors({
    credentials: true,
    origin(origin, callback) {
      if (!origin || config.allowedOrigins.includes(origin)) return callback(null, true);
      callback(new ApiError(403, 'ORIGIN_DENIED', 'Origine non autorisée.'));
    },
    allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'X-Request-Id'],
  }));
  app.use(express.json({ limit: '1mb' }));
  const cookie: session.CookieOptions = {
    httpOnly: true, secure: config.env === 'production', sameSite: config.env === 'production' ? 'none' : 'lax',
    maxAge: 8 * 60 * 60 * 1000, path: '/',
  };
  if (config.sessionCookieDomain) cookie.domain = config.sessionCookieDomain;
  app.use(session({
    name: 'madrazo.sid', secret: config.sessionSecret, resave: false, saveUninitialized: false,
    rolling: true, store: new MariaDbSessionStore(pool), cookie,
  }));

  app.get('/api/health', asyncHandler(async (_request, response) => {
    try { await pool.query('SELECT 1'); response.json({ status: 'ok', database: 'ok', timestamp: new Date().toISOString() }); }
    catch { response.status(503).json({ status: 'degraded', database: 'unavailable', timestamp: new Date().toISOString() }); }
  }));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));
  app.get('/api/openapi.json', (_request, response) => response.json(openApiDocument));
  app.use('/api/auth', authRouter(pool));

  app.use('/api', authenticate(pool), verifyCsrf);
  app.use('/api/dashboard', dashboardRouter(pool));
  app.use('/api/users', usersRouter(pool));
  app.use('/api/groups', groupsRouter(pool));
  app.use('/api/contacts', contactsRouter(pool));
  app.use('/api/items', itemsRouter(pool));
  app.use('/api/orders', ordersRouter(pool));
  app.use('/api/stocks', inventoryRouter(pool));
  app.use('/api/stocks', stocksRouter(pool));
  app.use('/api/payments', debtsRouter(pool));
  app.use('/api/payments', paymentsRouter(pool));
  app.use('/api/expenses', expenseReadRouter(pool));
  app.use('/api/expenses', expensesRouter(pool));
  app.use('/api/finances', financesRouter(pool));
  app.use('/api/audit-logs', auditRouter(pool));
  app.use('/api/settings', bulkSettingsRouter(pool));
  app.use('/api/settings', settingsRouter(pool));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
