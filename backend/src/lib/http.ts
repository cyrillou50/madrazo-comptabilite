import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { z } from 'zod';
import { ApiError } from './errors.js';

export const asyncHandler = (handler: (request: Request, response: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (request, response, next) => { void handler(request, response, next).catch(next); };

export function parse<T extends z.ZodType>(schema: T, value: unknown): z.output<T> {
  const result = schema.safeParse(value);
  if (!result.success) throw new ApiError(400, 'VALIDATION_ERROR', 'Données invalides.', result.error.flatten());
  return result.data;
}

export const idSchema = z.coerce.number().int().positive();
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(100).optional(),
  archived: z.enum(['true', 'false']).optional(),
});

export function paginationMeta(page: number, limit: number, total: number) {
  return { page, limit, total, pages: Math.ceil(total / limit) };
}
