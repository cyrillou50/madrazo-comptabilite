import type { Pool } from 'mysql2/promise';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

describe('GET /api/health', () => {
  it('vérifie réellement la disponibilité du pool injecté', async () => {
    const pool = { query: vi.fn().mockResolvedValue([[{ok:1}]]), execute: vi.fn() } as unknown as Pool;
    const config = loadConfig({ NODE_ENV:'test',SESSION_SECRET:'a-secure-test-secret-that-is-long-enough',ALLOWED_ORIGINS:'http://localhost:5173' });
    const response = await request(createApp(pool,config)).get('/api/health');
    expect(response.status).toBe(200); expect(response.body.status).toBe('ok'); expect(pool.query).toHaveBeenCalledWith('SELECT 1');
  });
});
