import argon2 from 'argon2';
import { Router } from 'express';
import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import { withTransaction } from '../db.js';
import { audit } from '../lib/audit.js';
import { conflict, notFound } from '../lib/errors.js';
import { asyncHandler, idSchema, paginationMeta, paginationSchema, parse } from '../lib/http.js';
import { requirePermission } from '../middleware/auth.js';

const userSchema = z.object({
  email: z.email().max(254).transform((value) => value.toLowerCase()), displayName: z.string().trim().min(2).max(100),
  password: z.string().min(12).max(256), roleCode: z.enum(['patron', 'bras_droit', 'vendeur', 'lecture']),
});

const permissionOverrideSchema = z.object({
  overrides: z.array(z.object({
    code: z.string().min(1).max(100),
    effect: z.enum(['allow', 'deny', 'inherit']),
  })).max(200),
});

export function usersRouter(pool: Pool) {
  const router = Router();
  router.get('/', requirePermission('users:read'), asyncHandler(async (request, response) => {
    const query = parse(paginationSchema, request.query); const offset = (query.page - 1) * query.limit;
    const term = `%${query.search ?? ''}%`;
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT u.id, u.email, u.display_name AS displayName, u.avatar_url AS avatarUrl, u.is_active AS isActive,
              u.last_login_at AS lastLoginAt, u.created_at AS createdAt, r.code AS role
       FROM users u JOIN roles r ON r.id = u.role_id WHERE u.archived_at IS NULL AND (u.email LIKE ? OR u.display_name LIKE ?)
       ORDER BY u.created_at DESC LIMIT ? OFFSET ?`, [term, term, query.limit, offset],
    );
    const [count] = await pool.execute<RowDataPacket[]>('SELECT COUNT(*) total FROM users WHERE archived_at IS NULL AND (email LIKE ? OR display_name LIKE ?)', [term, term]);
    response.json({ data: rows, meta: paginationMeta(query.page, query.limit, Number(count[0]?.total ?? 0)) });
  }));
  router.post('/', requirePermission('users:write'), asyncHandler(async (request, response) => {
    const input = parse(userSchema, request.body); const hash = await argon2.hash(input.password, { type: argon2.argon2id });
    const result = await withTransaction(pool, async (connection) => {
      const [roles] = await connection.execute<RowDataPacket[]>('SELECT id FROM roles WHERE code = ?', [input.roleCode]);
      if (!roles[0]) throw notFound('Rôle introuvable.');
      try {
        const [created] = await connection.execute<ResultSetHeader>(
          'INSERT INTO users (role_id, email, display_name, password_hash) VALUES (?, ?, ?, ?)',
          [roles[0].id, input.email, input.displayName, hash],
        );
        await audit(connection, { actorId: request.principal!.id, ip: request.ip, userAgent: request.get('user-agent') }, 'user.created', 'user', created.insertId, null, { email: input.email, role: input.roleCode });
        return created.insertId;
      } catch (error: unknown) {
        if ((error as { code?: string }).code === 'ER_DUP_ENTRY') throw conflict('Cette adresse e-mail existe déjà.');
        throw error;
      }
    });
    response.status(201).json({ data: { id: result, email: input.email, displayName: input.displayName, role: input.roleCode } });
  }));
  router.get('/:id/permissions', requirePermission('users:read'), asyncHandler(async (request, response) => {
    const id = parse(idSchema, request.params.id);
    const [users] = await pool.execute<RowDataPacket[]>(
      'SELECT id, role_id AS roleId FROM users WHERE id = ? AND archived_at IS NULL',
      [id],
    );
    if (!users[0]) throw notFound('Utilisateur introuvable.');
    const [permissions] = await pool.execute<RowDataPacket[]>(
      `SELECT p.code, p.description,
              IF(rp.permission_id IS NULL, FALSE, TRUE) AS roleGranted,
              up.effect AS overrideEffect,
              CASE WHEN up.effect = 'deny' THEN FALSE
                   WHEN up.effect = 'allow' THEN TRUE
                   WHEN rp.permission_id IS NOT NULL THEN TRUE ELSE FALSE END AS effective
       FROM permissions p
       LEFT JOIN role_permissions rp ON rp.permission_id = p.id AND rp.role_id = ?
       LEFT JOIN user_permissions up ON up.permission_id = p.id AND up.user_id = ?
       ORDER BY p.code`,
      [users[0].roleId, id],
    );
    response.json({ data: permissions });
  }));
  router.put('/:id/permissions', requirePermission('users:write'), asyncHandler(async (request, response) => {
    const id = parse(idSchema, request.params.id);
    const input = parse(permissionOverrideSchema, request.body);
    const unique = new Set(input.overrides.map((entry) => entry.code));
    if (unique.size !== input.overrides.length) throw conflict('Une permission ne peut apparaître qu’une fois.');
    if (id === request.principal!.id && input.overrides.some((entry) => entry.code === 'users:write' && entry.effect === 'deny')) {
      throw conflict('Vous ne pouvez pas vous retirer votre propre droit de gestion des utilisateurs.');
    }
    await withTransaction(pool, async (connection) => {
      const [users] = await connection.execute<RowDataPacket[]>('SELECT id FROM users WHERE id = ? AND archived_at IS NULL FOR UPDATE', [id]);
      if (!users[0]) throw notFound('Utilisateur introuvable.');
      const [before] = await connection.execute<RowDataPacket[]>(
        `SELECT p.code, up.effect FROM user_permissions up
         JOIN permissions p ON p.id = up.permission_id WHERE up.user_id = ?`,
        [id],
      );
      await connection.execute('DELETE FROM user_permissions WHERE user_id = ?', [id]);
      for (const entry of input.overrides) {
        if (entry.effect === 'inherit') continue;
        const [result] = await connection.execute<ResultSetHeader>(
          `INSERT INTO user_permissions (user_id, permission_id, effect)
           SELECT ?, id, ? FROM permissions WHERE code = ?`,
          [id, entry.effect, entry.code],
        );
        if (!result.affectedRows) throw notFound(`Permission ${entry.code} introuvable.`);
      }
      await audit(
        connection,
        { actorId: request.principal!.id, ip: request.ip, userAgent: request.get('user-agent') },
        'user.permissions_updated',
        'user',
        id,
        before,
        input.overrides,
      );
    });
    response.json({ data: { id, updated: true } });
  }));
  router.patch('/:id/status', requirePermission('users:write'), asyncHandler(async (request, response) => {
    const id = parse(idSchema, request.params.id); const input = parse(z.object({ isActive: z.boolean() }), request.body);
    if (id === request.principal!.id && !input.isActive) throw conflict('Vous ne pouvez pas désactiver votre propre compte.');
    const [result] = await pool.execute<ResultSetHeader>('UPDATE users SET is_active = ? WHERE id = ? AND archived_at IS NULL', [input.isActive, id]);
    if (!result.affectedRows) throw notFound('Utilisateur introuvable.');
    if (!input.isActive) await pool.execute('DELETE FROM user_sessions WHERE user_id = ?', [id]);
    response.json({ data: { id, isActive: input.isActive } });
  }));
  return router;
}
