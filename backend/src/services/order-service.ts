import { randomBytes } from 'node:crypto';
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { withTransaction } from '../db.js';
import { audit, type AuditContext } from '../lib/audit.js';
import { calculateOrder, assertDelivery, assertOrderCancellable, type PricedLine } from '../lib/domain.js';
import { ApiError, conflict, notFound } from '../lib/errors.js';

interface ItemRow extends RowDataPacket {
  id: string; name: string; unitCostCents: string; defaultPriceCents: string; minimumPriceCents: string;
  groupPriceCents: string | null; tierPriceCents: string | null; stockQuantity: string; reservedQuantity: string;
}
interface GroupRow extends RowDataPacket { status: string; blockOrders: number; }
interface OrderRow extends RowDataPacket { id: string; status: string; totalCents: string; }
interface DeliveryRow extends RowDataPacket { id: string; }
interface OrderItemDeliveryRow extends RowDataPacket {
  id: string; itemId: string; orderedQuantity: number; deliveredQuantity: string; reservationId: string | null;
}

export interface NewOrderLine {
  itemId: number;
  quantity: number;
  discountCents?: number | undefined;
  discountPercent?: number | undefined;
}
export interface CreateOrderInput {
  groupId?: number | null | undefined;
  contactId?: number | null | undefined;
  sellerId: number;
  notes?: string | null | undefined;
  status?: 'draft' | 'pending' | 'confirmed' | undefined;
  discountCents?: number | undefined;
  reserveStock?: boolean | undefined;
  lines: NewOrderLine[];
  allowBlockedGroup?: boolean | undefined;
}

function reference(): string {
  const day = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  return `MDR-${day}-${randomBytes(4).toString('hex').toUpperCase()}`;
}

function numeric(value: string, label: string): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result)) throw new ApiError(500, 'UNSAFE_DATABASE_VALUE', `${label} hors plage.`);
  return result;
}

export async function createOrder(pool: Pool, input: CreateOrderInput, context: AuditContext) {
  return withTransaction(pool, async (connection) => {
    if (input.groupId) {
      const [groups] = await connection.execute<GroupRow[]>(
        'SELECT status, block_orders AS blockOrders FROM `groups` WHERE id = ? AND archived_at IS NULL FOR UPDATE', [input.groupId],
      );
      const group = groups[0];
      if (!group) throw notFound('Groupe introuvable.');
      if ((group.status === 'blackliste' || Boolean(group.blockOrders)) && !input.allowBlockedGroup) {
        throw new ApiError(403, 'GROUP_BLOCKED', 'Les nouvelles commandes sont bloquées pour ce groupe.');
      }
    }
    const ids = input.lines.map((line) => line.itemId);
    if (new Set(ids).size !== ids.length) throw conflict('Un article ne peut apparaître qu’une fois par commande.');
    const priced: PricedLine[] = [];
    const snapshots: Array<{ item: ItemRow; price: number; line: NewOrderLine }> = [];
    let minimumOrderTotal = 0;
    for (const line of input.lines) {
      const [items] = await connection.execute<ItemRow[]>(
        `SELECT i.id, i.name, i.unit_cost_cents AS unitCostCents, i.default_price_cents AS defaultPriceCents,
                i.minimum_price_cents AS minimumPriceCents,
                (SELECT gp.price_cents FROM group_prices gp
                 WHERE gp.group_id <=> ? AND gp.item_id = i.id AND gp.valid_from <= NOW(3)
                   AND (gp.valid_until IS NULL OR gp.valid_until > NOW(3)) ORDER BY gp.valid_from DESC LIMIT 1) AS groupPriceCents,
                (SELECT qt.price_cents FROM quantity_tiers qt
                 WHERE qt.item_id = i.id AND qt.minimum_quantity <= ? AND qt.is_active = TRUE
                 ORDER BY qt.minimum_quantity DESC LIMIT 1) AS tierPriceCents,
                COALESCE((SELECT SUM(sm.quantity_delta) FROM stock_movements sm WHERE sm.item_id = i.id), 0) AS stockQuantity,
                COALESCE((SELECT SUM(sr.quantity - sr.released_quantity) FROM stock_reservations sr
                          WHERE sr.item_id = i.id AND sr.status = 'active'), 0) AS reservedQuantity
         FROM items i WHERE i.id = ? AND i.is_active = TRUE AND i.archived_at IS NULL FOR UPDATE`,
        [input.groupId ?? null, line.quantity, line.itemId],
      );
      const item = items[0];
      if (!item) throw notFound(`Article ${line.itemId} introuvable ou archivé.`);
      const prices = [item.groupPriceCents, item.tierPriceCents, item.defaultPriceCents].filter((p): p is string => p !== null).map(Number);
      const price = Math.min(...prices);
      const minimum = numeric(item.minimumPriceCents, 'Prix minimum');
      minimumOrderTotal += minimum * line.quantity;
      if (!Number.isSafeInteger(minimumOrderTotal)) {
        throw new ApiError(422, 'UNSAFE_AMOUNT', 'Le prix minimum cumulé dépasse la plage autorisée.');
      }
      const discount = line.discountPercent !== undefined
        ? Math.round(price * line.quantity * line.discountPercent / 100)
        : (line.discountCents ?? 0);
      if (price * line.quantity - discount < minimum * line.quantity) {
        throw new ApiError(422, 'PRICE_BELOW_MINIMUM', `La remise place ${item.name} sous son prix minimum.`);
      }
      const available = numeric(item.stockQuantity, 'Stock') - numeric(item.reservedQuantity, 'Réservation');
      if ((input.reserveStock ?? true) && available < line.quantity) {
        throw conflict(`Stock disponible insuffisant pour ${item.name}.`, { itemId: line.itemId, available, requested: line.quantity });
      }
      priced.push({ itemId: line.itemId, quantity: line.quantity, unitPriceCents: price, unitCostCents: numeric(item.unitCostCents, 'Coût'), discountCents: discount });
      snapshots.push({ item, price, line: { ...line, discountCents: discount } });
    }
    const totals = calculateOrder(priced, input.discountCents ?? 0);
    if (totals.totalCents < minimumOrderTotal) {
      throw new ApiError(422, 'PRICE_BELOW_MINIMUM', 'La remise globale place la commande sous les prix minimums autorisés.');
    }
    const orderReference = reference();
    const [orderResult] = await connection.execute<ResultSetHeader>(
      `INSERT INTO orders (reference, group_id, contact_id, seller_id, subtotal_cents, discount_cents, total_cents, cost_cents, margin_cents, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [orderReference, input.groupId ?? null, input.contactId ?? null, input.sellerId, totals.subtotalCents,
        totals.discountCents, totals.totalCents, totals.costCents, totals.marginCents, input.notes ?? null, input.status ?? 'pending'],
    );
    for (const snapshot of snapshots) {
      const discount = snapshot.line.discountCents ?? 0;
      const [lineResult] = await connection.execute<ResultSetHeader>(
        `INSERT INTO order_items (order_id, item_id, item_name_snapshot, quantity, unit_price_cents, unit_cost_cents, discount_cents, line_total_cents)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [orderResult.insertId, snapshot.line.itemId, snapshot.item.name, snapshot.line.quantity, snapshot.price,
          numeric(snapshot.item.unitCostCents, 'Coût'), discount, snapshot.price * snapshot.line.quantity - discount],
      );
      if (input.reserveStock ?? true) {
        await connection.execute(
          'INSERT INTO stock_reservations (order_item_id, item_id, quantity) VALUES (?, ?, ?)',
          [lineResult.insertId, snapshot.line.itemId, snapshot.line.quantity],
        );
      }
    }
    if (input.groupId) await connection.execute('UPDATE `groups` SET last_activity_at = NOW(3) WHERE id = ?', [input.groupId]);
    await audit(connection, context, 'order.created', 'order', orderResult.insertId, null, { reference: orderReference, ...totals });
    return { id: orderResult.insertId, reference: orderReference, ...totals, status: input.status ?? 'pending', paymentStatus: 'unpaid' };
  });
}

export interface DeliveryInput {
  idempotencyKey: string;
  notes?: string | null | undefined;
  deliveredBy: number;
  lines: Array<{ orderItemId: number; quantity: number }>;
}

export async function deliverOrder(pool: Pool, orderId: number, input: DeliveryInput, context: AuditContext) {
  return withTransaction(pool, async (connection) => {
    const [prior] = await connection.execute<DeliveryRow[]>(
      'SELECT id FROM deliveries WHERE order_id = ? AND idempotency_key = ?', [orderId, input.idempotencyKey],
    );
    if (prior[0]) return { id: Number(prior[0].id), idempotent: true };
    const [orders] = await connection.execute<OrderRow[]>('SELECT id, status, total_cents AS totalCents FROM orders WHERE id = ? FOR UPDATE', [orderId]);
    const order = orders[0];
    if (!order) throw notFound('Commande introuvable.');
    if (['draft', 'cancelled'].includes(order.status)) throw conflict('Cette commande ne peut pas être livrée dans son état actuel.');
    if (new Set(input.lines.map((line) => line.orderItemId)).size !== input.lines.length) throw conflict('Ligne de livraison dupliquée.');
    const [delivery] = await connection.execute<ResultSetHeader>(
      'INSERT INTO deliveries (order_id, idempotency_key, delivered_by, notes) VALUES (?, ?, ?, ?)',
      [orderId, input.idempotencyKey, input.deliveredBy, input.notes ?? null],
    );
    for (const line of input.lines) {
      const [rows] = await connection.execute<OrderItemDeliveryRow[]>(
        `SELECT oi.id, oi.item_id AS itemId, oi.quantity AS orderedQuantity,
                COALESCE(SUM(di.quantity), 0) AS deliveredQuantity, sr.id AS reservationId
         FROM order_items oi
         LEFT JOIN delivery_items di ON di.order_item_id = oi.id
         LEFT JOIN stock_reservations sr ON sr.order_item_id = oi.id
         WHERE oi.id = ? AND oi.order_id = ? GROUP BY oi.id, sr.id FOR UPDATE`, [line.orderItemId, orderId],
      );
      const item = rows[0];
      if (!item) throw notFound(`Ligne de commande ${line.orderItemId} introuvable.`);
      assertDelivery(line.quantity, item.orderedQuantity, Number(item.deliveredQuantity));
      await connection.execute('SELECT id FROM items WHERE id = ? FOR UPDATE', [item.itemId]);
      const [stockRows] = await connection.execute<RowDataPacket[]>(
        'SELECT COALESCE(SUM(quantity_delta), 0) AS stockQuantity FROM stock_movements WHERE item_id = ?',
        [item.itemId],
      );
      const stockQuantity = Number(stockRows[0]?.stockQuantity ?? 0);
      if (!Number.isSafeInteger(stockQuantity) || stockQuantity < line.quantity) {
        throw conflict('Stock physique insuffisant pour cette livraison.', {
          itemId: Number(item.itemId),
          available: stockQuantity,
          requested: line.quantity,
        });
      }
      const [deliveryItem] = await connection.execute<ResultSetHeader>(
        'INSERT INTO delivery_items (delivery_id, order_item_id, quantity) VALUES (?, ?, ?)',
        [delivery.insertId, line.orderItemId, line.quantity],
      );
      await connection.execute(
        `INSERT INTO stock_movements (item_id, movement_type, quantity_delta, reason, source_type, source_id, created_by)
         VALUES (?, 'delivery', ?, ?, 'delivery_item', ?, ?)`,
        [item.itemId, -line.quantity, `Livraison commande #${orderId}`, deliveryItem.insertId, input.deliveredBy],
      );
      if (item.reservationId) {
        await connection.execute(
          `UPDATE stock_reservations SET released_quantity = released_quantity + ?,
             status = IF(released_quantity + ? >= quantity, 'consumed', 'active') WHERE id = ?`,
          [line.quantity, line.quantity, item.reservationId],
        );
      }
    }
    const [remaining] = await connection.execute<RowDataPacket[]>(
      `SELECT SUM(oi.quantity - COALESCE(d.delivered, 0)) AS remaining
       FROM order_items oi LEFT JOIN (SELECT order_item_id, SUM(quantity) delivered FROM delivery_items GROUP BY order_item_id) d ON d.order_item_id = oi.id
       WHERE oi.order_id = ?`, [orderId],
    );
    const nextStatus = Number(remaining[0]?.remaining ?? 0) === 0 ? 'delivered' : 'partially_delivered';
    await connection.execute('UPDATE orders SET status = ?, version = version + 1 WHERE id = ?', [nextStatus, orderId]);
    await audit(connection, context, 'order.delivered', 'order', orderId, { status: order.status }, { status: nextStatus, deliveryId: delivery.insertId });
    return { id: delivery.insertId, status: nextStatus, idempotent: false };
  });
}

export async function cancelOrder(pool: Pool, orderId: number, actorId: number, reason: string, context: AuditContext) {
  return withTransaction(pool, async (connection: PoolConnection) => {
    const [orders] = await connection.execute<OrderRow[]>('SELECT id, status, total_cents AS totalCents FROM orders WHERE id = ? FOR UPDATE', [orderId]);
    const order = orders[0];
    if (!order) throw notFound('Commande introuvable.');
    if (order.status === 'cancelled') return { id: orderId, status: 'cancelled', idempotent: true };
    const [deliveries] = await connection.execute<RowDataPacket[]>('SELECT COUNT(*) AS count FROM deliveries WHERE order_id = ?', [orderId]);
    const [payments] = await connection.execute<RowDataPacket[]>('SELECT COUNT(*) AS count FROM payments WHERE order_id = ? AND reversed_at IS NULL', [orderId]);
    assertOrderCancellable(Number(deliveries[0]?.count ?? 0), Number(payments[0]?.count ?? 0));
    await connection.execute(
      `UPDATE stock_reservations sr JOIN order_items oi ON oi.id = sr.order_item_id
       SET sr.released_quantity = sr.quantity, sr.status = 'released' WHERE oi.order_id = ? AND sr.status = 'active'`, [orderId],
    );
    await connection.execute("UPDATE orders SET status = 'cancelled', cancelled_at = NOW(3), notes = CONCAT_WS('\n', notes, ?), version = version + 1 WHERE id = ?", [`Annulation: ${reason}`, orderId]);
    await audit(connection, { ...context, actorId }, 'order.cancelled', 'order', orderId, { status: order.status }, { status: 'cancelled', reason });
    return { id: orderId, status: 'cancelled', idempotent: false };
  });
}
