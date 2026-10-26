import { Router } from 'express';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import { asyncHandler, idSchema, paginationMeta, paginationSchema, parse } from '../lib/http.js';
import { requirePermission } from '../middleware/auth.js';

type SqlParameter = string | number;

export function inventoryRouter(pool: Pool) {
  const router = Router();

  router.get('/', requirePermission('stocks:read'), asyncHandler(async (request, response) => {
    const query = parse(paginationSchema.extend({
      status: z.enum(['low', 'out', 'available']).optional(),
      categoryId: idSchema.optional(),
    }), request.query);
    const conditions = ['i.archived_at IS NULL'];
    const parameters: SqlParameter[] = [];
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push('(i.name LIKE ? OR i.sku LIKE ? OR c.name LIKE ?)');
      parameters.push(term, term, term);
    }
    if (query.categoryId) { conditions.push('i.category_id = ?'); parameters.push(query.categoryId); }
    if (query.status === 'low') conditions.push('inv.available_quantity <= i.alert_threshold');
    if (query.status === 'out') conditions.push('inv.available_quantity <= 0');
    if (query.status === 'available') conditions.push('inv.available_quantity > i.alert_threshold');
    const where = conditions.join(' AND ');
    const offset = (query.page - 1) * query.limit;
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT i.id, i.name, i.sku, i.category_id AS categoryId, c.name AS categoryName,
              i.description, i.unit_cost_cents AS unitCostCents, i.default_price_cents AS defaultPriceCents,
              i.minimum_price_cents AS minimumPriceCents, i.unit, i.alert_threshold AS alertThreshold,
              i.is_active AS isActive, inv.stock_quantity AS stockQuantity,
              inv.reserved_quantity AS reservedQuantity, inv.available_quantity AS availableQuantity
       FROM items i
       JOIN item_categories c ON c.id = i.category_id
       JOIN item_inventory inv ON inv.item_id = i.id
       WHERE ${where}
       ORDER BY (inv.available_quantity <= 0) DESC, (inv.available_quantity <= i.alert_threshold) DESC, i.name
       LIMIT ? OFFSET ?`,
      [...parameters, query.limit, offset],
    );
    const [countRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM items i
       JOIN item_categories c ON c.id = i.category_id
       JOIN item_inventory inv ON inv.item_id = i.id WHERE ${where}`,
      parameters,
    );
    response.json({ data: rows, meta: paginationMeta(query.page, query.limit, Number(countRows[0]?.total ?? 0)) });
  }));

  router.get('/movements', requirePermission('stocks:read'), asyncHandler(async (request, response) => {
    const query = parse(paginationSchema.extend({
      itemId: idSchema.optional(),
      type: z.enum(['entry', 'delivery', 'adjustment', 'return', 'reservation', 'release']).optional(),
    }), request.query);
    const conditions = ['1=1'];
    const parameters: SqlParameter[] = [];
    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push('(i.name LIKE ? OR i.sku LIKE ? OR sm.reason LIKE ?)');
      parameters.push(term, term, term);
    }
    if (query.itemId) { conditions.push('sm.item_id = ?'); parameters.push(query.itemId); }
    if (query.type) { conditions.push('sm.movement_type = ?'); parameters.push(query.type); }
    const where = conditions.join(' AND ');
    const offset = (query.page - 1) * query.limit;
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT sm.id, sm.item_id AS itemId, i.name AS itemName, sm.movement_type AS type,
              sm.quantity_delta AS quantityDelta, sm.reason, u.display_name AS createdBy,
              sm.occurred_at AS occurredAt
       FROM stock_movements sm JOIN items i ON i.id = sm.item_id JOIN users u ON u.id = sm.created_by
       WHERE ${where} ORDER BY sm.occurred_at DESC LIMIT ? OFFSET ?`,
      [...parameters, query.limit, offset],
    );
    const [countRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM stock_movements sm JOIN items i ON i.id = sm.item_id WHERE ${where}`,
      parameters,
    );
    response.json({ data: rows, meta: paginationMeta(query.page, query.limit, Number(countRows[0]?.total ?? 0)) });
  }));

  return router;
}
