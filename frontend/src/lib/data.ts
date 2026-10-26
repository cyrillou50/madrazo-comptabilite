export function listOf<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === 'object' && Array.isArray((value as any).items)) return (value as any).items as T[];
  if (value && typeof value === 'object' && Array.isArray((value as any).data)) return (value as any).data as T[];
  return [];
}

export function metaOf(value: unknown): { page: number; totalPages: number; total: number } | undefined {
  if (!value || typeof value !== 'object') return undefined;
  return (value as any).meta;
}
