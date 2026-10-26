import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ApiError } from '../lib/errors.js';

export const notFoundHandler: RequestHandler = (request, _response, next) => {
  next(new ApiError(404, 'ROUTE_NOT_FOUND', `Route ${request.method} ${request.path} introuvable.`));
};

export const errorHandler: ErrorRequestHandler = (error: unknown, request, response, _next) => {
  const known = error instanceof ApiError;
  if (!known) request.log?.error({ err: error }, 'Unhandled request error');
  const status = known ? error.status : 500;
  response.status(status).json({
    error: {
      code: known ? error.code : 'INTERNAL_ERROR',
      message: known ? error.message : 'Une erreur interne est survenue.',
      ...(known && error.details !== undefined ? { details: error.details } : {}),
      requestId: response.getHeader('X-Request-Id'),
    },
  });
};
