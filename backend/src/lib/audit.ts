import type { PoolConnection } from 'mysql2/promise';

export interface AuditContext {
  actorId?: number | undefined;
  ip?: string | undefined;
  userAgent?: string | undefined;
}

export async function audit(
  connection: PoolConnection,
  context: AuditContext,
  action: string,
  entityType: string,
  entityId: string | number | null,
  before: unknown = null,
  after: unknown = null,
) {
  await connection.execute(
    `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, ip_address, user_agent, before_data, after_data)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [context.actorId ?? null, action, entityType, entityId === null ? null : String(entityId), context.ip ?? null,
      context.userAgent?.slice(0, 500) ?? null, before === null ? null : JSON.stringify(before), after === null ? null : JSON.stringify(after)],
  );
}
