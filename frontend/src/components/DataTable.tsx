import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button, EmptyState } from './ui';

export interface Column<T> {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  className?: string;
}

export function DataTable<T>({ columns, rows, rowKey, emptyTitle = 'Aucun résultat', emptyDescription = 'Modifiez vos filtres ou ajoutez une nouvelle entrée.', onRowClick, page, totalPages, onPage }: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  emptyTitle?: string;
  emptyDescription?: string;
  onRowClick?: (row: T) => void;
  page?: number;
  totalPages?: number;
  onPage?: (page: number) => void;
}) {
  if (!rows.length) return <EmptyState title={emptyTitle} description={emptyDescription} />;
  return <>
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
        <thead><tr className="border-b border-white/[.07] text-[10px] uppercase tracking-[.16em] text-zinc-600">{columns.map((column) => <th key={column.key} className={`px-5 py-3.5 font-bold ${column.className || ''}`}>{column.label}</th>)}</tr></thead>
        <tbody>{rows.map((row) => <tr key={rowKey(row)} onClick={() => onRowClick?.(row)} tabIndex={onRowClick ? 0 : undefined} onKeyDown={(e) => { if (onRowClick && (e.key === 'Enter' || e.key === ' ')) onRowClick(row); }} className={`border-b border-white/[.045] text-zinc-300 transition last:border-0 ${onRowClick ? 'cursor-pointer hover:bg-white/[.035] focus:bg-white/[.04] focus:outline-none' : ''}`}>{columns.map((column) => <td key={column.key} className={`px-5 py-4 ${column.className || ''}`}>{column.render(row)}</td>)}</tr>)}</tbody>
      </table>
    </div>
    {totalPages && totalPages > 1 && <div className="flex items-center justify-between border-t border-white/[.07] px-5 py-3"><span className="text-xs text-zinc-600">Page {page} sur {totalPages}</span><div className="flex gap-1"><Button variant="ghost" size="sm" aria-label="Page précédente" disabled={!page || page <= 1} onClick={() => onPage?.((page || 1) - 1)}><ChevronLeft className="h-4 w-4" /></Button><Button variant="ghost" size="sm" aria-label="Page suivante" disabled={!page || page >= totalPages} onClick={() => onPage?.((page || 1) + 1)}><ChevronRight className="h-4 w-4" /></Button></div></div>}
  </>;
}
