import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { withTransaction } from '../db.js';
import { audit, type AuditContext } from '../lib/audit.js';
import { ApiError, notFound } from '../lib/errors.js';
import { applyStockMovement } from '../lib/domain.js';

interface StockRow extends RowDataPacket { id: string; stockQuantity: string; }

export async function createStockMovement(
  pool: Pool,
  input: {
    itemId: number;
    type: 'entry' | 'adjustment' | 'return';
    quantityDelta: number;
    reason: string;
    actorId: number;
    occurredAt?: Date | undefined;
  },
  context: AuditContext,
) {
  return withTransaction(pool, async (connection) => {
    const [rows] = await connection.execute<StockRow[]>(
      `SELECT i.id, COALESCE((SELECT SUM(quantity_delta) FROM stock_movements WHERE item_id = i.id), 0) AS stockQuantity
       FROM items i WHERE i.id = ? AND i.archived_at IS NULL FOR UPDATE`, [input.itemId],
    );
    const item = rows[0];
    if (!item) throw notFound('Article introuvable.');
    if (!Number.isInteger(input.quantityDelta) || input.quantityDelta === 0) throw new ApiError(422, 'INVALID_QUANTITY', 'Le mouvement doit être un entier non nul.');
    const nextStock = applyStockMovement(Number(item.stockQuantity), input.quantityDelta);
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO stock_movements (item_id, movement_type, quantity_delta, reason, created_by, occurred_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [input.itemId, input.type, input.quantityDelta, input.reason, input.actorId, input.occurredAt ?? new Date()],
    );
    await audit(connection, context, 'stock.movement_created', 'stock_movement', result.insertId, null, { ...input, occurredAt: input.occurredAt?.toISOString() });
    return { id: result.insertId, itemId: input.itemId, quantityDelta: input.quantityDelta, stockQuantity: nextStock };
  });
}
