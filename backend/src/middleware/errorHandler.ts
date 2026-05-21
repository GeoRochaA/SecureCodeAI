import { NextFunction, Request, RequestHandler, Response } from 'express';

export interface ApiError extends Error {
  status?: number;
  code?: string;
}

export const errorHandler = (
  err: ApiError,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  const code = err.code || 'INTERNAL_ERROR';

  console.error(`[Error] ${status} - ${message}`, err);

  res.status(status).json({
    error: {
      message,
      code,
      status,
      timestamp: new Date().toISOString(),
    },
  });
};

export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler => (req, res, next) => {
  void Promise.resolve(fn(req, res, next)).catch(next);
};
