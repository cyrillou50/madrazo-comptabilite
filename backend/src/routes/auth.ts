import argon2 from 'argon2';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import { withTransaction } from '../db.js';
import { audit } from '../lib/audit.js';
import { ApiError } from '../lib/errors.js';
import { asyncHandler, parse } from '../lib/http.js';
import { authenticate } from '../middleware/auth.js';
import { issueCsrfToken, verifyCsrf } from '../middleware/csrf.js';

interface LoginRow extends RowDataPacket {
  id: string; passwordHash: string; isActive: number; lockedUntil: Date | null;
}
interface SettingRow extends RowDataPacket { value: unknown; }

function numberSetting(value: unknown, fallback: number): number {
  let decoded = value;
  if (typeof value === 'string') {
    try { decoded = JSON.parse(value) as unknown; } catch { decoded = value; }
  }
  const parsed = Number(decoded);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const loginSchema = z.object({
  email: z.string().optional(), identifier: z.string().optional(), username: z.string().optional(), password: z.string().min(8).max(256),
}).transform((value, context) => {
  const candidate=(value.email??value.identifier??value.username??'').trim().toLowerCase();
  const checked=z.email().max(254).safeParse(candidate);
  if(!checked.success){context.addIssue({code:'custom',message:'Adresse e-mail invalide.',path:['email']});return z.NEVER;}
  return {email:checked.data,password:value.password};
});
const loginLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 10, standardHeaders: true, legacyHeaders: false });

const regenerate = (request: Express.Request) => new Promise<void>((resolve, reject) => request.session.regenerate((error) => error ? reject(error) : resolve()));
const save = (request: Express.Request) => new Promise<void>((resolve, reject) => request.session.save((error) => error ? reject(error) : resolve()));
const destroy = (request: Express.Request) => new Promise<void>((resolve, reject) => request.session.destroy((error) => error ? reject(error) : resolve()));

export function authRouter(pool: Pool) {
  const router = Router();
  router.get('/csrf', (request, response) => response.json({ csrfToken: issueCsrfToken(request) }));
  router.post('/login', loginLimiter, verifyCsrf, asyncHandler(async (request, response) => {
    const input = parse(loginSchema, request.body);
    const [rows] = await pool.execute<LoginRow[]>(
      `SELECT id, password_hash AS passwordHash, is_active AS isActive, locked_until AS lockedUntil
       FROM users WHERE email = ? AND archived_at IS NULL LIMIT 1`, [input.email],
    );
    const user = rows[0];
    const valid = user ? await argon2.verify(user.passwordHash, input.password).catch(() => false) : false;
    if (!user || !valid || !user.isActive || (user.lockedUntil && user.lockedUntil > new Date())) {
      if (user && !valid) {
        await pool.execute(
          `UPDATE users SET failed_login_attempts = failed_login_attempts + 1,
             locked_until = IF(failed_login_attempts + 1 >= 5, DATE_ADD(NOW(3), INTERVAL 15 MINUTE), locked_until) WHERE id = ?`, [user.id],
        );
      }
      await pool.execute(
        `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, ip_address, user_agent, after_data)
         VALUES (?, 'auth.login_failed', 'user', ?, ?, ?, ?)`,
        [user?.id ?? null, user?.id ?? null, request.ip ?? null, request.get('user-agent')?.slice(0, 500) ?? null, JSON.stringify({ email: input.email })],
      );
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Identifiants invalides ou compte temporairement verrouillé.');
    }
    await regenerate(request);
    request.session.userId = Number(user.id);
    const [sessionSettings] = await pool.execute<SettingRow[]>(
      "SELECT value_json AS value FROM settings WHERE setting_key = 'sessionDurationMinutes' LIMIT 1",
    );
    const sessionMinutes = Math.min(1440, Math.max(15, numberSetting(sessionSettings[0]?.value, 480)));
    request.session.cookie.maxAge = sessionMinutes * 60_000;
    const csrfToken = issueCsrfToken(request);
    await save(request);
    await withTransaction(pool, async (connection) => {
      await connection.execute('UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = NOW(3) WHERE id = ?', [user.id]);
      await audit(connection, { actorId: Number(user.id), ip: request.ip, userAgent: request.get('user-agent') }, 'auth.login_succeeded', 'user', user.id);
    });
    const [profiles]=await pool.execute<RowDataPacket[]>(`SELECT u.id,u.email,u.display_name displayName,u.avatar_url avatarUrl,r.code role FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=?`,[user.id]);
    const [permissionRows]=await pool.execute<RowDataPacket[]>(`SELECT p.code,COALESCE(up.effect,'allow') effect FROM permissions p JOIN roles r JOIN users u ON u.role_id=r.id LEFT JOIN role_permissions rp ON rp.role_id=r.id AND rp.permission_id=p.id LEFT JOIN user_permissions up ON up.user_id=u.id AND up.permission_id=p.id WHERE u.id=? AND (rp.permission_id IS NOT NULL OR up.permission_id IS NOT NULL)`,[user.id]);
    const permissions=clientPermissions(permissionRows.filter(row=>row.effect==='allow').map(row=>String(row.code)));
    response.json({ data: { ...profiles[0], permissions }, csrfToken });
  }));
  router.post('/logout', verifyCsrf, asyncHandler(async (request, response) => {
    const userId = request.session.userId;
    await destroy(request);
    if (userId) {
      await pool.execute(
        `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, ip_address, user_agent)
         VALUES (?, 'auth.logout', 'user', ?, ?, ?)`, [userId, userId, request.ip ?? null, request.get('user-agent')?.slice(0, 500) ?? null],
      );
    }
    response.clearCookie('madrazo.sid').status(204).end();
  }));
  router.get('/me', authenticate(pool), (request, response) => {
    const principal = request.principal!;
    response.json({ data: { ...principal, permissions: clientPermissions([...principal.permissions]) } });
  });
  return router;
}

function clientPermissions(permissions:string[]):string[]{
  const aliases:Record<string,string[]>= {
    'groups:write':['groups.create','groups.update','groups.archive'],'contacts:write':['contacts.create','contacts.update','contacts.archive'],
    'catalog:write':['items.create','items.update','items.archive'],'orders:write':['orders.create','orders.update'],'orders:deliver':['deliveries.create'],
    'stocks:write':['stocks.adjust'],'payments:write':['payments.create'],'payments:reverse':['payments.cancel'],'expenses:write':['expenses.create'],
    'users:write':['users.create','users.update','users.permissions'],
  };
  return [...new Set(permissions.flatMap(code=>[code,code.replace(':','.'),...(aliases[code]??[])]))].sort();
}
