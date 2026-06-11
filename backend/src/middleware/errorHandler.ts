// CORREÇÕES: #8
import { NextFunction, Request, RequestHandler, Response } from 'express';

export interface ApiError extends Error {
  status?: number;
  code?: string;
}

const IS_DEV = process.env.NODE_ENV === 'development';

export const errorHandler = (
  err: ApiError,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  const status = err.status || 500;

  // Loga detalhes completos no servidor (para debug)
  console.error(`[Error] ${status} - ${err.message}`, err);

  // Em produção nunca expõe mensagem interna nem código de erro do Node/SQLite
  // para evitar fingerprinting e disclosure de estrutura interna
  res.status(status).json({
    error: {
      message: IS_DEV ? err.message : 'An internal error occurred.',
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
