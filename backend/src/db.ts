import mysql, { type Pool, type PoolConnection, type PoolOptions } from 'mysql2/promise';
import type { AppConfig } from './config.js';

export type DbExecutor = Pick<Pool | PoolConnection, 'execute' | 'query'>;

export function createPool(config: AppConfig): Pool {
  const options: PoolOptions = {
    ...config.database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4',
    timezone: 'Z',
    decimalNumbers: false,
    supportBigNumbers: true,
    bigNumberStrings: true,
    enableKeepAlive: true,
  };
  return mysql.createPool(options);
}

export async function withTransaction<T>(pool: Pool, action: (connection: PoolConnection) => Promise<T>): Promise<T> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await action(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
