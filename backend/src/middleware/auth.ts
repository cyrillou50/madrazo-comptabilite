import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { ApiError } from '../lib/errors.js';
import { asyncHandler } from '../lib/http.js';

interface PrincipalRow extends RowDataPacket {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: string;
  roleId: string;
}
interface PermissionRow extends RowDataPacket { permission:string; effect:'allow'|'deny'; }

export interface Principal {
  id: number;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: string;
  permissions: Set<string>;
}

export function authenticate(pool: Pool): RequestHandler {
  return asyncHandler(async (request, _response, next) => {
    if (!request.session.userId) throw new ApiError(401, 'AUTH_REQUIRED', 'Connexion requise.');
    const [rows] = await pool.execute<PrincipalRow[]>(
      `SELECT u.id, u.email, u.display_name AS displayName, u.avatar_url AS avatarUrl, r.id AS roleId, r.code AS role
       FROM users u JOIN roles r ON r.id = u.role_id
       WHERE u.id = ? AND u.is_active = TRUE AND u.archived_at IS NULL`,
      [request.session.userId],
    );
    if (!rows[0]) {
      request.session.destroy(() => undefined);
      throw new ApiError(401, 'SESSION_INVALID', 'Session invalide ou compte désactivé.');
    }
    const [permissionRows]=await pool.execute<PermissionRow[]>(
      `SELECT p.code permission,COALESCE(up.effect,'allow') effect FROM permissions p
       LEFT JOIN role_permissions rp ON rp.permission_id=p.id AND rp.role_id=?
       LEFT JOIN user_permissions up ON up.permission_id=p.id AND up.user_id=?
       WHERE rp.permission_id IS NOT NULL OR up.permission_id IS NOT NULL`,[rows[0].roleId,rows[0].id]);
    const explicit = new Map<string, 'allow' | 'deny'>();
    for (const row of permissionRows) explicit.set(row.permission,row.effect);
    const permissions = new Set([...explicit].filter(([, effect]) => effect === 'allow').map(([code]) => code));
    request.principal = {
      id: Number(rows[0].id), email: rows[0].email, displayName: rows[0].displayName,
      avatarUrl: rows[0].avatarUrl, role: rows[0].role, permissions,
    };
    next();
  });
}

export function requirePermission(...required: string[]): RequestHandler {
  return (request: Request, _response: Response, next: NextFunction) => {
    if (!request.principal) return next(new ApiError(401, 'AUTH_REQUIRED', 'Connexion requise.'));
    if (!required.every((permission) => request.principal?.permissions.has(permission))) {
      return next(new ApiError(403, 'PERMISSION_DENIED', 'Permission insuffisante.'));
    }
    next();
  };
}
