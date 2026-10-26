import { Router } from 'express';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import { withTransaction } from '../db.js';
import { audit } from '../lib/audit.js';
import { asyncHandler, parse } from '../lib/http.js';
import { requirePermission } from '../middleware/auth.js';

const settingsSchema = z.object({
  organizationName: z.string().trim().min(1).max(100),
  currency: z.enum(['USD', 'EUR']),
  stockReservationEnabled: z.boolean(),
  sessionDurationMinutes: z.number().int().min(15).max(1440),
  debtWarningDays: z.number().int().min(1).max(3650),
  defaultPageSize: z.number().int().min(10).max(100),
});
interface SettingRow extends RowDataPacket { key: string; value: unknown; }

function decodeSetting(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value) as unknown; } catch { return value; }
}

export function bulkSettingsRouter(pool: Pool) {
  const router = Router();
  router.get('/', requirePermission('settings:read'), asyncHandler(async (_request, response) => {
    const [rows] = await pool.execute<SettingRow[]>(
      'SELECT setting_key AS `key`, value_json AS value FROM settings WHERE is_sensitive = FALSE',
    );
    response.json({ data: Object.fromEntries(rows.map((row) => [row.key, decodeSetting(row.value)])) });
  }));
  router.put('/', requirePermission('settings:write'), asyncHandler(async (request, response) => {
    const settings = parse(settingsSchema, request.body);
    await withTransaction(pool, async (connection) => {
      for (const [key, value] of Object.entries(settings)) {
        await connection.execute(
          `INSERT INTO settings (setting_key, value_json, is_sensitive, updated_by) VALUES (?, ?, FALSE, ?)
           ON DUPLICATE KEY UPDATE value_json = VALUES(value_json), updated_by = VALUES(updated_by)`,
          [key, JSON.stringify(value), request.principal!.id],
        );
      }
      await audit(connection, { actorId: request.principal!.id, ip: request.ip, userAgent: request.get('user-agent') },
        'settings.updated', 'settings', null, null, settings);
    });
    response.json({ data: settings });
  }));
  return router;
}
