import { Router } from 'express';
import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import { withTransaction } from '../db.js';
import { audit } from '../lib/audit.js';
import { conflict, notFound } from '../lib/errors.js';
import { asyncHandler, idSchema, paginationMeta, paginationSchema, parse } from '../lib/http.js';
import { requirePermission } from '../middleware/auth.js';

const groupSchema = z.object({
  name: z.string().trim().min(2).max(150), type: z.enum(['organisation', 'gang', 'mc', 'revendeur', 'independant', 'autre']),
  managerName: z.string().trim().max(150).nullish(), phone: z.string().trim().max(50).nullish(), description: z.string().max(5000).nullish(),
  status: z.enum(['actif', 'regulier', 'occasionnel', 'vip', 'surveillance', 'blackliste', 'inactif']).default('actif'),
  internalNotes: z.string().max(10000).nullish(), blockOrders: z.boolean().default(false),
});

export function groupsRouter(pool: Pool) {
  const router = Router();
  router.get('/', requirePermission('groups:read'), asyncHandler(async (request, response) => {
    const q = parse(paginationSchema.extend({ status: z.string().max(30).optional(), type: z.string().max(30).optional() }), request.query);
    const conditions = [q.archived === 'true' ? 'g.archived_at IS NOT NULL' : 'g.archived_at IS NULL']; const params: Array<string | number> = [];
    if (q.search) { conditions.push('(g.name LIKE ? OR g.manager_name LIKE ? OR g.phone LIKE ?)'); const term = `%${q.search}%`; params.push(term, term, term); }
    if (q.status) { conditions.push('g.status = ?'); params.push(q.status); } if (q.type) { conditions.push('g.type = ?'); params.push(q.type); }
    const where = conditions.join(' AND '); const offset = (q.page - 1) * q.limit;
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT g.id, g.name, g.type, g.manager_name AS managerName, g.phone, g.status, g.block_orders AS blockOrders,
              g.last_activity_at AS lastActivityAt, g.created_at AS createdAt,
              COALESCE(SUM(o.total_cents),0) AS totalPurchasesCents,
              COALESCE(SUM(o.total_cents - COALESCE(p.paid,0)),0) AS debtCents
       FROM \`groups\` g LEFT JOIN orders o ON o.group_id=g.id AND o.status <> 'cancelled'
       LEFT JOIN (SELECT order_id,SUM(amount_cents) paid FROM payments WHERE reversed_at IS NULL GROUP BY order_id) p ON p.order_id=o.id
       WHERE ${where} GROUP BY g.id ORDER BY g.last_activity_at DESC, g.name LIMIT ? OFFSET ?`, [...params, q.limit, offset],
    );
    const [counts] = await pool.execute<RowDataPacket[]>(`SELECT COUNT(*) total FROM \`groups\` g WHERE ${where}`, params);
    response.json({ data: rows, meta: paginationMeta(q.page, q.limit, Number(counts[0]?.total ?? 0)) });
  }));
  router.get('/:id', requirePermission('groups:read'), asyncHandler(async (request, response) => {
    const id = parse(idSchema, request.params.id);
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT g.*, COALESCE(SUM(o.total_cents),0) AS totalPurchasesCents,
              COALESCE(SUM(o.total_cents - COALESCE(p.paid,0)),0) AS debtCents
       FROM \`groups\` g LEFT JOIN orders o ON o.group_id=g.id AND o.status <> 'cancelled'
       LEFT JOIN (SELECT order_id,SUM(amount_cents) paid FROM payments WHERE reversed_at IS NULL GROUP BY order_id) p ON p.order_id=o.id
       WHERE g.id=? GROUP BY g.id`, [id],
    );
    if (!rows[0]) throw notFound('Groupe introuvable.');
    const [contacts] = await pool.execute<RowDataPacket[]>('SELECT id,first_name AS firstName,last_name AS lastName,nickname,phone,role_in_group AS roleInGroup,status FROM contacts WHERE group_id=? AND archived_at IS NULL', [id]);
    const [prices] = await pool.execute<RowDataPacket[]>(
      `SELECT gp.id,gp.item_id AS itemId,i.name,gp.price_cents AS priceCents,gp.valid_from AS validFrom,gp.valid_until AS validUntil
       FROM group_prices gp JOIN items i ON i.id=gp.item_id WHERE gp.group_id=? ORDER BY gp.valid_from DESC`, [id],
    );
    const group = { ...rows[0] };
    if (!request.principal!.permissions.has('groups:write')) delete group.internal_notes;
    response.json({ data: { ...group, contacts, prices } });
  }));
  router.post('/', requirePermission('groups:write'), asyncHandler(async (request, response) => {
    const input = parse(groupSchema, request.body);
    const id = await withTransaction(pool, async (connection) => {
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO \`groups\` (name,type,manager_name,phone,description,status,internal_notes,block_orders) VALUES (?,?,?,?,?,?,?,?)`,
        [input.name,input.type,input.managerName??null,input.phone??null,input.description??null,input.status,input.internalNotes??null,input.blockOrders],
      );
      await audit(connection,{actorId:request.principal!.id,ip:request.ip,userAgent:request.get('user-agent')},'group.created','group',result.insertId,null,input);
      return result.insertId;
    });
    response.status(201).json({ data: { id, ...input } });
  }));
  router.put('/:id', requirePermission('groups:write'), asyncHandler(async (request, response) => {
    const id=parse(idSchema,request.params.id); const input=parse(groupSchema,request.body);
    const [result]=await pool.execute<ResultSetHeader>(
      `UPDATE \`groups\` SET name=?,type=?,manager_name=?,phone=?,description=?,status=?,internal_notes=?,block_orders=? WHERE id=? AND archived_at IS NULL`,
      [input.name,input.type,input.managerName??null,input.phone??null,input.description??null,input.status,input.internalNotes??null,input.blockOrders,id]);
    if(!result.affectedRows) throw notFound('Groupe introuvable.'); response.json({data:{id,...input}});
  }));
  router.post('/:id/archive', requirePermission('groups:write'), asyncHandler(async (request,response)=>{
    const id=parse(idSchema,request.params.id); const [result]=await pool.execute<ResultSetHeader>('UPDATE `groups` SET archived_at=NOW(3) WHERE id=? AND archived_at IS NULL',[id]);
    if(!result.affectedRows) throw notFound('Groupe introuvable.'); response.json({data:{id,archived:true}});
  }));
  router.post('/:id/prices', requirePermission('catalog:write'), asyncHandler(async (request,response)=>{
    const groupId=parse(idSchema,request.params.id); const input=parse(z.object({itemId:idSchema,priceCents:z.number().int().nonnegative(),validUntil:z.iso.datetime().nullish()}),request.body);
    const [items]=await pool.execute<RowDataPacket[]>('SELECT minimum_price_cents minimum FROM items WHERE id=? AND archived_at IS NULL',[input.itemId]);
    if(!items[0]) throw notFound('Article introuvable.'); if(input.priceCents<Number(items[0].minimum)) throw conflict('Prix inférieur au prix minimum.');
    const [result]=await pool.execute<ResultSetHeader>('INSERT INTO group_prices(group_id,item_id,price_cents,valid_until,created_by) VALUES(?,?,?,?,?)',[groupId,input.itemId,input.priceCents,input.validUntil??null,request.principal!.id]);
    response.status(201).json({data:{id:result.insertId,groupId,...input}});
  }));
  return router;
}

const contactSchema=z.object({
  groupId:idSchema.nullish(),firstName:z.string().trim().min(1).max(100),lastName:z.string().trim().min(1).max(100),nickname:z.string().trim().max(100).nullish(),
  phone:z.string().trim().max(50).nullish(),roleInGroup:z.string().trim().max(100).nullish(),status:z.enum(['actif','vip','surveillance','blackliste','inactif']).default('actif'),
  notes:z.string().max(10000).nullish(),lastContactAt:z.iso.datetime().nullish(),
});

export function contactsRouter(pool:Pool){
  const router=Router();
  router.get('/',requirePermission('contacts:read'),asyncHandler(async(request,response)=>{
    const q=parse(paginationSchema.extend({groupId:idSchema.optional()}),request.query); const params:Array<string | number>=[]; const conditions=[q.archived==='true'?'c.archived_at IS NOT NULL':'c.archived_at IS NULL'];
    if(q.search){const t=`%${q.search}%`;conditions.push('(c.first_name LIKE ? OR c.last_name LIKE ? OR c.nickname LIKE ? OR c.phone LIKE ? OR g.name LIKE ?)');params.push(t,t,t,t,t);} if(q.groupId){conditions.push('c.group_id=?');params.push(q.groupId);}
    const where=conditions.join(' AND '),offset=(q.page-1)*q.limit;
    const [rows]=await pool.execute<RowDataPacket[]>(`SELECT c.id,c.group_id groupId,c.first_name firstName,c.last_name lastName,c.nickname,c.phone,c.role_in_group roleInGroup,c.status,c.last_contact_at lastContactAt,g.name groupName FROM contacts c LEFT JOIN \`groups\` g ON g.id=c.group_id WHERE ${where} ORDER BY c.last_contact_at DESC,c.last_name LIMIT ? OFFSET ?`,[...params,q.limit,offset]);
    const [count]=await pool.execute<RowDataPacket[]>(`SELECT COUNT(*) total FROM contacts c LEFT JOIN \`groups\` g ON g.id=c.group_id WHERE ${where}`,params);
    response.json({data:rows,meta:paginationMeta(q.page,q.limit,Number(count[0]?.total??0))});
  }));
  router.get('/:id',requirePermission('contacts:read'),asyncHandler(async(request,response)=>{
    const id=parse(idSchema,request.params.id);const [rows]=await pool.execute<RowDataPacket[]>('SELECT c.*,g.name groupName FROM contacts c LEFT JOIN `groups` g ON g.id=c.group_id WHERE c.id=?',[id]);if(!rows[0])throw notFound('Contact introuvable.');
    const [orders]=await pool.execute<RowDataPacket[]>('SELECT id,reference,total_cents totalCents,status,payment_status paymentStatus,order_date orderDate FROM orders WHERE contact_id=? ORDER BY order_date DESC LIMIT 100',[id]);
    const [interactions]=await pool.execute<RowDataPacket[]>('SELECT id,interaction_type interactionType,notes,occurred_at occurredAt FROM contact_interactions WHERE contact_id=? ORDER BY occurred_at DESC',[id]);
    const contact = { ...rows[0] };
    if (!request.principal!.permissions.has('contacts:private_notes')) delete contact.notes;
    response.json({data:{...contact,orders,interactions}});
  }));
  router.post('/',requirePermission('contacts:write'),asyncHandler(async(request,response)=>{const i=parse(contactSchema,request.body);const [r]=await pool.execute<ResultSetHeader>('INSERT INTO contacts(group_id,first_name,last_name,nickname,phone,role_in_group,status,notes,last_contact_at) VALUES(?,?,?,?,?,?,?,?,?)',[i.groupId??null,i.firstName,i.lastName,i.nickname??null,i.phone??null,i.roleInGroup??null,i.status,i.notes??null,i.lastContactAt??null]);response.status(201).json({data:{id:r.insertId,...i}});}));
  router.put('/:id',requirePermission('contacts:write'),asyncHandler(async(request,response)=>{const id=parse(idSchema,request.params.id),i=parse(contactSchema,request.body);const[r]=await pool.execute<ResultSetHeader>('UPDATE contacts SET group_id=?,first_name=?,last_name=?,nickname=?,phone=?,role_in_group=?,status=?,notes=?,last_contact_at=? WHERE id=? AND archived_at IS NULL',[i.groupId??null,i.firstName,i.lastName,i.nickname??null,i.phone??null,i.roleInGroup??null,i.status,i.notes??null,i.lastContactAt??null,id]);if(!r.affectedRows)throw notFound('Contact introuvable.');response.json({data:{id,...i}});}));
  router.post('/:id/archive',requirePermission('contacts:write'),asyncHandler(async(request,response)=>{const id=parse(idSchema,request.params.id);const[r]=await pool.execute<ResultSetHeader>('UPDATE contacts SET archived_at=NOW(3) WHERE id=? AND archived_at IS NULL',[id]);if(!r.affectedRows)throw notFound('Contact introuvable.');response.json({data:{id,archived:true}});}));
  router.post('/:id/interactions',requirePermission('contacts:write'),asyncHandler(async(request,response)=>{const contactId=parse(idSchema,request.params.id);const i=parse(z.object({type:z.string().min(1).max(50),notes:z.string().min(1).max(5000),occurredAt:z.iso.datetime()}),request.body);const[r]=await pool.execute<ResultSetHeader>('INSERT INTO contact_interactions(contact_id,author_id,interaction_type,notes,occurred_at) VALUES(?,?,?,?,?)',[contactId,request.principal!.id,i.type,i.notes,i.occurredAt]);response.status(201).json({data:{id:r.insertId,contactId,...i}});}));
  return router;
}

const itemSchema=z.object({categoryId:idSchema,name:z.string().trim().min(2).max(150),description:z.string().max(5000).nullish(),sku:z.string().trim().min(2).max(80),unitCostCents:z.number().int().nonnegative(),defaultPriceCents:z.number().int().nonnegative(),minimumPriceCents:z.number().int().nonnegative(),unit:z.string().trim().min(1).max(30).default('unité'),alertThreshold:z.number().int().nonnegative().default(0),isActive:z.boolean().default(true)}).refine(i=>i.defaultPriceCents>=i.minimumPriceCents,{message:'Le prix par défaut doit être supérieur au prix minimum.',path:['defaultPriceCents']});

export function itemsRouter(pool:Pool){const router=Router();
  router.get('/categories',requirePermission('catalog:read'),asyncHandler(async(_q,r)=>{const[rows]=await pool.execute<RowDataPacket[]>('SELECT id,name,description FROM item_categories WHERE is_active=TRUE ORDER BY name');r.json({data:rows});}));
  router.get('/',requirePermission('catalog:read'),asyncHandler(async(request,response)=>{const q=parse(paginationSchema.extend({categoryId:idSchema.optional(),lowStock:z.enum(['true','false']).optional()}),request.query);const params:Array<string | number>=[];const c=[q.archived==='true'?'i.archived_at IS NOT NULL':'i.archived_at IS NULL'];if(q.search){const t=`%${q.search}%`;c.push('(i.name LIKE ? OR i.sku LIKE ?)');params.push(t,t);}if(q.categoryId){c.push('i.category_id=?');params.push(q.categoryId);}if(q.lowStock==='true')c.push('inv.stock_quantity <= i.alert_threshold');const where=c.join(' AND '),off=(q.page-1)*q.limit;const[rows]=await pool.execute<RowDataPacket[]>(`SELECT i.id,i.category_id categoryId,c.name categoryName,i.name,i.description,i.sku,i.unit_cost_cents unitCostCents,i.default_price_cents defaultPriceCents,i.minimum_price_cents minimumPriceCents,i.unit,i.alert_threshold alertThreshold,i.is_active isActive,inv.stock_quantity stockQuantity,inv.reserved_quantity reservedQuantity,inv.available_quantity availableQuantity FROM items i JOIN item_categories c ON c.id=i.category_id JOIN item_inventory inv ON inv.item_id=i.id WHERE ${where} ORDER BY i.name LIMIT ? OFFSET ?`,[...params,q.limit,off]);const[count]=await pool.execute<RowDataPacket[]>(`SELECT COUNT(*) total FROM items i JOIN item_inventory inv ON inv.item_id=i.id WHERE ${where}`,params);response.json({data:rows,meta:paginationMeta(q.page,q.limit,Number(count[0]?.total??0))});}));
  router.post('/',requirePermission('catalog:write'),asyncHandler(async(request,response)=>{const i=parse(itemSchema,request.body);try{const[r]=await pool.execute<ResultSetHeader>('INSERT INTO items(category_id,name,description,sku,unit_cost_cents,default_price_cents,minimum_price_cents,unit,alert_threshold,is_active) VALUES(?,?,?,?,?,?,?,?,?,?)',[i.categoryId,i.name,i.description??null,i.sku,i.unitCostCents,i.defaultPriceCents,i.minimumPriceCents,i.unit,i.alertThreshold,i.isActive]);response.status(201).json({data:{id:r.insertId,...i}});}catch(e){if((e as{code?:string}).code==='ER_DUP_ENTRY')throw conflict('Cette référence interne existe déjà.');throw e;}}));
  router.put('/:id',requirePermission('catalog:write'),asyncHandler(async(request,response)=>{const id=parse(idSchema,request.params.id),i=parse(itemSchema,request.body);await withTransaction(pool,async c=>{const[before]=await c.execute<RowDataPacket[]>('SELECT default_price_cents price FROM items WHERE id=? FOR UPDATE',[id]);if(!before[0])throw notFound('Article introuvable.');await c.execute('UPDATE items SET category_id=?,name=?,description=?,sku=?,unit_cost_cents=?,default_price_cents=?,minimum_price_cents=?,unit=?,alert_threshold=?,is_active=? WHERE id=?',[i.categoryId,i.name,i.description??null,i.sku,i.unitCostCents,i.defaultPriceCents,i.minimumPriceCents,i.unit,i.alertThreshold,i.isActive,id]);if(Number(before[0].price)!==i.defaultPriceCents)await c.execute('INSERT INTO price_history(item_id,old_price_cents,new_price_cents,changed_by,reason) VALUES(?,?,?,?,?)',[id,before[0].price,i.defaultPriceCents,request.principal!.id,'Modification de l’article']);});response.json({data:{id,...i}});}));
  router.post('/:id/archive',requirePermission('catalog:write'),asyncHandler(async(request,response)=>{const id=parse(idSchema,request.params.id);const[r]=await pool.execute<ResultSetHeader>('UPDATE items SET archived_at=NOW(3),is_active=FALSE WHERE id=? AND archived_at IS NULL',[id]);if(!r.affectedRows)throw notFound('Article introuvable.');response.json({data:{id,archived:true}});}));
  router.get('/:id/history',requirePermission('catalog:read'),asyncHandler(async(request,response)=>{const id=parse(idSchema,request.params.id);const[prices]=await pool.execute<RowDataPacket[]>('SELECT id,old_price_cents oldPriceCents,new_price_cents newPriceCents,reason,created_at createdAt FROM price_history WHERE item_id=? ORDER BY created_at DESC',[id]);const[sales]=await pool.execute<RowDataPacket[]>('SELECT o.id,o.reference,o.order_date orderDate,oi.quantity,oi.unit_price_cents unitPriceCents,oi.line_total_cents lineTotalCents FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE oi.item_id=? ORDER BY o.order_date DESC LIMIT 100',[id]);response.json({data:{prices,sales}});}));
  return router;}
