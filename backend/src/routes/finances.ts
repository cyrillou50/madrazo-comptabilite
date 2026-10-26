import { Router } from 'express';
import JSZip from 'jszip';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import { asyncHandler, parse } from '../lib/http.js';
import { requirePermission } from '../middleware/auth.js';

interface CashRow extends RowDataPacket {
  occurredAt: Date | string;
  type: string;
  label: string;
  amountCents: string | number;
  sourceType: string | null;
  sourceId: string | number | null;
  createdBy: string;
}

const exportQuery = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}(?:T.*)?$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}(?:T.*)?$/).optional(),
});

function escapeXml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function csvCell(value: unknown): string {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

function columnName(index: number): string {
  let value = index + 1;
  let result = '';
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function isoDate(value: Date | string): string {
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

async function ledgerRows(pool: Pool, rawQuery: unknown): Promise<CashRow[]> {
  const query = parse(exportQuery, rawQuery);
  const conditions = ['1=1'];
  const parameters: string[] = [];
  if (query.from) { conditions.push('cm.occurred_at >= ?'); parameters.push(query.from); }
  if (query.to) { conditions.push('cm.occurred_at <= ?'); parameters.push(query.to.includes('T') ? query.to : `${query.to} 23:59:59.999`); }
  const [rows] = await pool.execute<CashRow[]>(
    `SELECT cm.occurred_at AS occurredAt, cm.movement_type AS type, cm.label,
            cm.amount_cents AS amountCents, cm.source_type AS sourceType,
            cm.source_id AS sourceId, u.display_name AS createdBy
     FROM cash_movements cm JOIN users u ON u.id = cm.created_by
     WHERE ${conditions.join(' AND ')} ORDER BY cm.occurred_at DESC`,
    parameters,
  );
  return rows;
}

async function xlsxBuffer(rows: CashRow[]): Promise<Buffer> {
  const headers = ['Date', 'Type', 'Libellé', 'Montant', 'Source', 'Utilisateur'];
  const values: Array<Array<string | number>> = rows.map((row) => [
    isoDate(row.occurredAt),
    row.type,
    row.label,
    Number(row.amountCents) / 100,
    row.sourceType ? `${row.sourceType}${row.sourceId === null ? '' : ` #${row.sourceId}`}` : '',
    row.createdBy,
  ]);
  const sheetRows = [headers, ...values].map((row, rowIndex) => {
    const cells = row.map((value, columnIndex) => {
      const reference = `${columnName(columnIndex)}${rowIndex + 1}`;
      if (typeof value === 'number') return `<c r="${reference}" s="2"><v>${value}</v></c>`;
      return `<c r="${reference}" t="inlineStr"${rowIndex === 0 ? ' s="1"' : ''}><is><t>${escapeXml(value)}</t></is></c>`;
    }).join('');
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join('');

  const zip = new JSZip();
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`);
  zip.folder('_rels')!.file('.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`);
  zip.folder('xl')!.file('workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Registre" sheetId="1" r:id="rId1"/></sheets>
</workbook>`);
  zip.folder('xl')!.folder('_rels')!.file('workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`);
  zip.folder('xl')!.file('styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF7F1D1D"/><bgColor indexed="64"/></patternFill></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>
</styleSheet>`);
  zip.folder('xl')!.folder('worksheets')!.file('sheet1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <cols><col min="1" max="1" width="24" customWidth="1"/><col min="2" max="2" width="18" customWidth="1"/><col min="3" max="3" width="42" customWidth="1"/><col min="4" max="4" width="16" customWidth="1"/><col min="5" max="6" width="24" customWidth="1"/></cols>
  <sheetData>${sheetRows}</sheetData>
  <autoFilter ref="A1:F${Math.max(1, rows.length + 1)}"/>
</worksheet>`);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

export function financesRouter(pool: Pool) {
  const router = Router();
  const permissions = requirePermission('payments:read', 'expenses:read');

  router.get('/export.csv', permissions, asyncHandler(async (request, response) => {
    const rows = await ledgerRows(pool, request.query);
    const csv = [
      ['Date', 'Type', 'Libellé', 'Montant', 'Source', 'Utilisateur'].map(csvCell).join(','),
      ...rows.map((row) => [
        isoDate(row.occurredAt), row.type, row.label, Number(row.amountCents) / 100,
        row.sourceType ? `${row.sourceType}${row.sourceId === null ? '' : ` #${row.sourceId}`}` : '', row.createdBy,
      ].map(csvCell).join(',')),
    ].join('\n');
    response.type('text/csv').attachment('finances-madrazo.csv').send(`\uFEFF${csv}`);
  }));

  router.get('/export.xlsx', permissions, asyncHandler(async (request, response) => {
    const rows = await ledgerRows(pool, request.query);
    const workbook = await xlsxBuffer(rows);
    response
      .type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .attachment('finances-madrazo.xlsx')
      .send(workbook);
  }));

  return router;
}
