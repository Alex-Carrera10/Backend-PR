import type { ErrorRequestHandler } from 'express';
import { AppError } from '../../domain/errors/AppError.js';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.httpStatus).json({ error: { code: err.code, message: err.message } });
    return;
  }

  console.error(err);
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado.' },
  });
};
