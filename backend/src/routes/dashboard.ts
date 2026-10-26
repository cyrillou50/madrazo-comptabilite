import { Router } from 'express';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import { asyncHandler, parse } from '../lib/http.js';
import { requirePermission } from '../middleware/auth.js';

type MetricValue = number | string | bigint;

interface DashboardMetricRow extends RowDataPacket {
  collectedCents?: MetricValue;
  salesCents?: MetricValue;
  grossProfitCents?: MetricValue;
  expensesCents?: MetricValue;
  cashBalanceCents?: MetricValue;
  debtCents?: MetricValue;
  orderCount?: MetricValue;
  buyerGroupCount?: MetricValue;
  contactCount?: MetricValue;
  pendingOrderCount?: MetricValue;
  lowStockCount?: MetricValue;
}

export function dashboardRouter(pool: Pool) {
  const router = Router();
  router.get('/', requirePermission('dashboard:read'), asyncHandler(async (request, response) => {
    const dateInput=z.string().regex(/^\d{4}-\d{2}-\d{2}(?:T.*)?$/);
    const q = parse(z.object({ from: dateInput.optional(), to: dateInput.optional(), period: z.enum(['day','week','month']).default('day') }), request.query);
    const from = q.from ? (q.from.includes('T')?q.from:`${q.from}T00:00:00.000Z`) : '1970-01-01T00:00:00.000Z';
    const to = q.to ? (q.to.includes('T')?q.to:`${q.to}T23:59:59.999Z`) : '2999-12-31T23:59:59.999Z';
    const [orderTotals] = await pool.execute<DashboardMetricRow[]>(
      `SELECT COALESCE(SUM(total_cents),0) salesCents,COALESCE(SUM(margin_cents),0) grossProfitCents,COUNT(*) orderCount,
              COUNT(DISTINCT group_id) buyerGroupCount
       FROM orders WHERE status<>'cancelled' AND order_date BETWEEN ? AND ?`, [from,to]);
    const [paymentTotals] = await pool.execute<DashboardMetricRow[]>('SELECT COALESCE(SUM(amount_cents),0) collectedCents FROM payments WHERE reversed_at IS NULL AND paid_at BETWEEN ? AND ?',[from,to]);
    const [expenseTotals] = await pool.execute<DashboardMetricRow[]>('SELECT COALESCE(SUM(amount_cents),0) expensesCents FROM expenses WHERE reversed_at IS NULL AND expense_date BETWEEN ? AND ?',[from,to]);
    const [cashTotals] = await pool.execute<DashboardMetricRow[]>('SELECT COALESCE(SUM(amount_cents),0) cashBalanceCents FROM cash_movements WHERE occurred_at<=?',[to]);
    const [debts] = await pool.execute<DashboardMetricRow[]>(`SELECT COALESCE(SUM(o.total_cents-COALESCE(p.paid,0)),0) debtCents FROM orders o LEFT JOIN (SELECT order_id,SUM(amount_cents)paid FROM payments WHERE reversed_at IS NULL GROUP BY order_id)p ON p.order_id=o.id WHERE o.status<>'cancelled' AND o.payment_status<>'paid'`,[]);
    const [counts] = await pool.execute<DashboardMetricRow[]>(`SELECT
      (SELECT COUNT(*) FROM contacts WHERE archived_at IS NULL) contactCount,
      (SELECT COUNT(*) FROM orders WHERE status IN ('pending','confirmed','partially_delivered')) pendingOrderCount,
      (SELECT COUNT(*) FROM items i JOIN item_inventory inv ON inv.item_id=i.id WHERE i.archived_at IS NULL AND inv.available_quantity<=i.alert_threshold) lowStockCount`);
    const bucket = q.period==='month' ? '%Y-%m-01' : q.period==='week' ? '%x-W%v' : '%Y-%m-%d';
    const [salesTimeline] = await pool.execute<RowDataPacket[]>(`SELECT DATE_FORMAT(order_date,'${bucket}') period,SUM(total_cents) salesCents,SUM(margin_cents) profitCents,COUNT(*) orderCount FROM orders WHERE status<>'cancelled' AND order_date BETWEEN ? AND ? GROUP BY period ORDER BY period`,[from,to]);
    const [collectionTimeline] = await pool.execute<RowDataPacket[]>(`SELECT DATE_FORMAT(paid_at,'${bucket}') period,SUM(amount_cents) collectedCents FROM payments WHERE reversed_at IS NULL AND paid_at BETWEEN ? AND ? GROUP BY period ORDER BY period`,[from,to]);
    const [byItem] = await pool.execute<RowDataPacket[]>(`SELECT i.id,i.name,SUM(oi.quantity) quantity,SUM(oi.line_total_cents) salesCents FROM order_items oi JOIN orders o ON o.id=oi.order_id JOIN items i ON i.id=oi.item_id WHERE o.status<>'cancelled' AND o.order_date BETWEEN ? AND ? GROUP BY i.id,i.name ORDER BY salesCents DESC LIMIT 10`,[from,to]);
    const [activeGroups] = await pool.execute<RowDataPacket[]>(`SELECT g.id,g.name,COUNT(o.id) orderCount,SUM(o.total_cents) salesCents FROM \`groups\` g JOIN orders o ON o.group_id=g.id WHERE o.status<>'cancelled' AND o.order_date BETWEEN ? AND ? GROUP BY g.id,g.name ORDER BY salesCents DESC LIMIT 10`,[from,to]);
    const [recentOrders]=await pool.execute<RowDataPacket[]>(`SELECT o.id,o.reference,o.group_id groupId,g.name groupName,u.display_name sellerName,o.order_date orderDate,o.total_cents/100 totalAmount,o.margin_cents/100 estimatedMargin,o.status,o.payment_status paymentStatus FROM orders o LEFT JOIN \`groups\` g ON g.id=o.group_id JOIN users u ON u.id=o.seller_id ORDER BY o.order_date DESC LIMIT 8`);
    const [lowStock]=await pool.execute<RowDataPacket[]>(`SELECT i.id,i.name,i.sku reference,i.unit_cost_cents/100 unitCost,i.default_price_cents/100 defaultPrice,i.minimum_price_cents/100 minimumPrice,i.unit,inv.stock_quantity stock,inv.reserved_quantity reservedStock,i.alert_threshold alertThreshold,i.is_active active FROM items i JOIN item_inventory inv ON inv.item_id=i.id WHERE i.archived_at IS NULL AND inv.available_quantity<=i.alert_threshold ORDER BY inv.available_quantity ASC LIMIT 8`);
    const empty = {} as DashboardMetricRow;
    const o=orderTotals[0]??empty,p=paymentTotals[0]??empty,e=expenseTotals[0]??empty,c=cashTotals[0]??empty,d=debts[0]??empty,n=counts[0]??empty;
    const receivedByPeriod=new Map(collectionTimeline.map(x=>[String(x.period),Number(x.collectedCents)/100]));
    const salesTrend=salesTimeline.map(x=>({date:String(x.period),sales:Number(x.salesCents)/100,profit:Number(x.profitCents)/100,received:receivedByPeriod.get(String(x.period))??0}));
    response.json({data:{
      totals:{received:Number(p.collectedCents??0)/100,revenue:Number(o.salesCents??0)/100,grossProfit:Number(o.grossProfitCents??0)/100,expenses:Number(e.expensesCents??0)/100,cashBalance:Number(c.cashBalanceCents??0)/100,outstandingDebt:Number(d.debtCents??0)/100,salesCount:Number(o.orderCount??0),groupsCount:Number(o.buyerGroupCount??0),contactsCount:Number(n.contactCount??0),pendingOrders:Number(n.pendingOrderCount??0),lowStockItems:Number(n.lowStockCount??0)},
      salesTrend,salesByItem:byItem.map(x=>({name:x.name,value:Number(x.salesCents)/100})),activeGroups:activeGroups.map(x=>({name:x.name,amount:Number(x.salesCents)/100,orders:Number(x.orderCount)})),topItems:byItem.map(x=>({name:x.name,quantity:Number(x.quantity),amount:Number(x.salesCents)/100})),recentOrders,lowStock,
      metrics:{salesCents:o.salesCents??'0',grossProfitCents:o.grossProfitCents??'0',collectedCents:p.collectedCents??'0',expensesCents:e.expensesCents??'0',cashBalanceCents:c.cashBalanceCents??'0',debtCents:d.debtCents??'0'},
    }});
  }));
  return router;
}
