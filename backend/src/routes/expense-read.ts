import { Router } from 'express';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import { asyncHandler, paginationMeta, paginationSchema, parse } from '../lib/http.js';
import { requirePermission } from '../middleware/auth.js';

type SqlParameter = string | number;

export function expenseReadRouter(pool: Pool) {
  const router = Router();
  router.get('/', requirePermission('expenses:read'), asyncHandler(async (request, response) => {
    const dateValue = z.string().regex(/^\d{4}-\d{2}-\d{2}(?:T.*)?$/);
    const query = parse(paginationSchema.extend({
      from: dateValue.optional(),
      to: dateValue.optional(),
      categoryId: z.coerce.number().int().positive().optional(),
    }), request.query);
    const conditions = ['e.reversed_at IS NULL'];
    const parameters: SqlParameter[] = [];
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push('(e.label LIKE ? OR c.name LIKE ?)');
      parameters.push(term, term);
    }
    if (query.categoryId) { conditions.push('e.category_id = ?'); parameters.push(query.categoryId); }
    if (query.from) { conditions.push('e.expense_date >= ?'); parameters.push(query.from); }
    if (query.to) { conditions.push('e.expense_date <= ?'); parameters.push(query.to.includes('T') ? query.to : `${query.to} 23:59:59.999`); }
    const where = conditions.join(' AND ');
    const offset = (query.page - 1) * query.limit;
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT e.id, e.category_id AS categoryId, c.name AS category, e.label,
              e.amount_cents AS amountCents, e.notes, e.expense_date AS expenseDate,
              u.display_name AS createdBy, e.reversed_at AS reversedAt
       FROM expenses e JOIN expense_categories c ON c.id = e.category_id
       JOIN users u ON u.id = e.created_by
       WHERE ${where} ORDER BY e.expense_date DESC LIMIT ? OFFSET ?`,
      [...parameters, query.limit, offset],
    );
    const [countRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM expenses e JOIN expense_categories c ON c.id = e.category_id WHERE ${where}`,
      parameters,
    );
    response.json({ data: rows, meta: paginationMeta(query.page, query.limit, Number(countRows[0]?.total ?? 0)) });
  }));
  return router;
}
