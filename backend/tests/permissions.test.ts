import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { requirePermission } from '../src/middleware/auth.js';

function requestWith(permissions: string[]) {
  return { principal: { id:1,email:'test@example.invalid',displayName:'Test',avatarUrl:null,role:'vendeur',permissions:new Set(permissions) } } as unknown as Request;
}

describe('permissions fines', () => {
  it('autorise uniquement si toutes les permissions demandées sont présentes', () => {
    const next = vi.fn();
    requirePermission('orders:write','payments:read')(requestWith(['orders:write','payments:read']),{} as Response,next);
    expect(next).toHaveBeenCalledWith();
  });
  it('retourne une erreur 403 si une permission manque', () => {
    const next = vi.fn();
    requirePermission('users:write')(requestWith(['orders:write']),{} as Response,next);
    expect((next.mock.calls[0]?.[0] as {status:number}).status).toBe(403);
  });
});
