import type { ErrorRequestHandler, Request, Response, NextFunction } from 'express';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message);
  }
}

export function sendError(res: Response, status: number, code: string, message: string): void {
  res.status(status).json({ error: { code, message } });
}

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error && typeof error === 'object' && 'type' in error && error.type === 'entity.parse.failed') {
    sendError(res, 400, 'INVALID_INPUT', 'Request body is not valid JSON');
    return;
  }
  if (error instanceof HttpError) {
    sendError(res, error.status, error.code, error.message);
    return;
  }
  sendError(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
};

export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    void handler(req, res, next).catch(next);
  };
}
