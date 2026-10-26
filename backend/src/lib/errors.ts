export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const notFound = (message = 'Ressource introuvable.') => new ApiError(404, 'NOT_FOUND', message);
export const conflict = (message: string, details?: unknown) => new ApiError(409, 'CONFLICT', message, details);
export const forbidden = (message = 'Action non autorisée.') => new ApiError(403, 'FORBIDDEN', message);
