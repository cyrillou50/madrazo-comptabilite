import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ApiError } from '../lib/errors.js';

export function issueCsrfToken(request: Request): string {
  request.session.csrfToken ??= randomBytes(32).toString('base64url');
  return request.session.csrfToken;
}

export const verifyCsrf: RequestHandler = (request: Request, _response: Response, next: NextFunction) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return next();
  const expected = request.session.csrfToken;
  const received = request.get('X-CSRF-Token');
  if (!expected || !received) return next(new ApiError(403, 'CSRF_INVALID', 'Jeton CSRF manquant ou invalide.'));
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return next(new ApiError(403, 'CSRF_INVALID', 'Jeton CSRF invalide.'));
  next();
};
