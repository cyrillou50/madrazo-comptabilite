import { Router } from 'express';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import { asyncHandler, paginationMeta, paginationSchema, parse } from '../lib/http.js';
import { requirePermission } from '../middleware/auth.js';

type SqlParameter = string | number;

export function debtsRouter(pool: Pool) {
  const router = Router();

  router.get('/', requirePermission('payments:read'), asyncHandler(async (request, response) => {
    const dateValue = z.string().regex(/^\d{4}-\d{2}-\d{2}(?:T.*)?$/);
    const query = parse(paginationSchema.extend({
      groupId: z.coerce.number().int().positive().optional(),
      from: dateValue.optional(),
      to: dateValue.optional(),
    }), request.query);
    const conditions = ['1=1'];
    const parameters: SqlParameter[] = [];
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push('(o.reference LIKE ? OR g.name LIKE ? OR p.reference LIKE ?)');
      parameters.push(term, term, term);
    }
    if (query.groupId) { conditions.push('o.group_id = ?'); parameters.push(query.groupId); }
    if (query.from) { conditions.push('p.paid_at >= ?'); parameters.push(query.from); }
    if (query.to) { conditions.push('p.paid_at <= ?'); parameters.push(query.to.includes('T') ? query.to : `${query.to} 23:59:59.999`); }
    const where = conditions.join(' AND ');
    const offset = (query.page - 1) * query.limit;
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT p.id, p.order_id AS orderId, o.reference AS orderReference, g.name AS groupName,
              p.amount_cents AS amountCents, p.method, p.reference AS paymentReference, p.notes,
              p.paid_at AS paymentDate, p.reversed_at AS reversedAt
       FROM payments p JOIN orders o ON o.id = p.order_id
       LEFT JOIN \`groups\` g ON g.id = o.group_id
       WHERE ${where} ORDER BY p.paid_at DESC LIMIT ? OFFSET ?`,
      [...parameters, query.limit, offset],
    );
    const [countRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM payments p JOIN orders o ON o.id = p.order_id
       LEFT JOIN \`groups\` g ON g.id = o.group_id WHERE ${where}`,
      parameters,
    );
    response.json({ data: rows, meta: paginationMeta(query.page, query.limit, Number(countRows[0]?.total ?? 0)) });
  }));

  router.get('/debts', requirePermission('payments:read'), asyncHandler(async (request, response) => {
    const query = parse(paginationSchema.extend({
      age: z.coerce.number().int().min(1).max(3650).optional(),
      groupId: z.coerce.number().int().positive().optional(),
    }), request.query);
    const conditions = ["o.status <> 'cancelled'", "o.payment_status <> 'paid'", '(o.total_cents - COALESCE(p.paid, 0)) > 0'];
    const parameters: SqlParameter[] = [];
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push('(o.reference LIKE ? OR g.name LIKE ?)');
      parameters.push(term, term);
    }
    if (query.age) { conditions.push('o.order_date < DATE_SUB(NOW(3), INTERVAL ? DAY)'); parameters.push(query.age); }
    if (query.groupId) { conditions.push('o.group_id = ?'); parameters.push(query.groupId); }
    const where = conditions.join(' AND ');
    const offset = (query.page - 1) * query.limit;
    const aggregate = '(SELECT order_id, SUM(amount_cents) AS paid FROM payments WHERE reversed_at IS NULL GROUP BY order_id)';
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT o.id, o.reference, o.group_id AS groupId, g.name AS groupName, o.order_date AS orderDate,
              o.total_cents AS totalCents, COALESCE(p.paid, 0) AS paidCents,
              o.total_cents - COALESCE(p.paid, 0) AS dueCents, o.status,
              o.payment_status AS paymentStatus
       FROM orders o LEFT JOIN \`groups\` g ON g.id = o.group_id
       LEFT JOIN ${aggregate} p ON p.order_id = o.id
       WHERE ${where} ORDER BY o.order_date ASC LIMIT ? OFFSET ?`,
      [...parameters, query.limit, offset],
    );
    const [countRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM orders o LEFT JOIN \`groups\` g ON g.id = o.group_id
       LEFT JOIN ${aggregate} p ON p.order_id = o.id WHERE ${where}`,
      parameters,
    );
    response.json({ data: rows, meta: paginationMeta(query.page, query.limit, Number(countRows[0]?.total ?? 0)) });
  }));
  return router;
}
