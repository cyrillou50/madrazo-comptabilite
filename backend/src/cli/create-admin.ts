import 'dotenv/config';
import argon2 from 'argon2';
import type { RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import { loadConfig } from '../config.js';
import { createPool, withTransaction } from '../db.js';

const input = z.object({
  FIRST_ADMIN_EMAIL: z.email().transform((value) => value.toLowerCase()),
  FIRST_ADMIN_PASSWORD: z.string().min(14).max(256),
  FIRST_ADMIN_DISPLAY_NAME: z.string().min(2).max(100).default('Patron'),
}).parse(process.env);
const pool = createPool(loadConfig());
try {
  await withTransaction(pool, async (connection) => {
    const [counts] = await connection.execute<RowDataPacket[]>('SELECT COUNT(*) count FROM users FOR UPDATE');
    if (Number(counts[0]?.count ?? 0) !== 0) throw new Error('Création refusée: un utilisateur existe déjà. Utilisez l’administration sécurisée.');
    const [roles] = await connection.execute<RowDataPacket[]>('SELECT id FROM roles WHERE code=\'patron\'');
    if (!roles[0]) throw new Error('Migration initiale absente: rôle patron introuvable.');
    const hash = await argon2.hash(input.FIRST_ADMIN_PASSWORD, { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 });
    await connection.execute('INSERT INTO users(role_id,email,display_name,password_hash) VALUES(?,?,?,?)', [roles[0].id,input.FIRST_ADMIN_EMAIL,input.FIRST_ADMIN_DISPLAY_NAME,hash]);
  });
  console.info(`Premier administrateur créé: ${input.FIRST_ADMIN_EMAIL}. Effacez FIRST_ADMIN_PASSWORD de l’environnement.`);
} finally { await pool.end(); }
