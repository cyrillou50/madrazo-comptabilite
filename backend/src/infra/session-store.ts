import session from 'express-session';
import type { Pool, RowDataPacket } from 'mysql2/promise';

interface SessionRow extends RowDataPacket { data: string; }

export class MariaDbSessionStore extends session.Store {
  constructor(private readonly pool: Pool) { super(); }

  override get(sid: string, callback: (error: unknown, session?: session.SessionData | null) => void): void {
    void this.pool.execute<SessionRow[]>('SELECT data FROM user_sessions WHERE sid = ? AND expires_at > NOW(3)', [sid])
      .then(([rows]) => callback(null, rows[0] ? JSON.parse(rows[0].data) as session.SessionData : null))
      .catch(callback);
  }

  override set(sid: string, value: session.SessionData, callback?: (error?: unknown) => void): void {
    const expiry = value.cookie.expires ?? new Date(Date.now() + (value.cookie.maxAge ?? 8 * 60 * 60 * 1000));
    void this.pool.execute(
      `INSERT INTO user_sessions (sid, data, expires_at, user_id) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE data = VALUES(data), expires_at = VALUES(expires_at), user_id = VALUES(user_id)`,
      [sid, JSON.stringify(value), expiry, value.userId ?? null],
    ).then(() => callback?.()).catch((error: unknown) => callback?.(error));
  }

  override destroy(sid: string, callback?: (error?: unknown) => void): void {
    void this.pool.execute('DELETE FROM user_sessions WHERE sid = ?', [sid])
      .then(() => callback?.()).catch((error: unknown) => callback?.(error));
  }

  override touch(sid: string, value: session.SessionData, callback?: (error?: unknown) => void): void {
    const expiry = value.cookie.expires ?? new Date(Date.now() + (value.cookie.maxAge ?? 8 * 60 * 60 * 1000));
    void this.pool.execute('UPDATE user_sessions SET expires_at = ? WHERE sid = ?', [expiry, sid])
      .then(() => callback?.()).catch((error: unknown) => callback?.(error));
  }

  prune(): Promise<unknown> {
    return this.pool.execute('DELETE FROM user_sessions WHERE expires_at <= NOW(3)');
  }
}
