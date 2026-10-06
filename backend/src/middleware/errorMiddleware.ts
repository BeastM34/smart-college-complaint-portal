import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

/**
 * 404 Not Found Middleware for unhandled API routes
 */
export const notFoundHandler = (req: Request, res: Response, _next: NextFunction): void => {
  res.status(404).json({
    success: false,
    message: `API endpoint not found: ${req.method} ${req.originalUrl}`,
  });
};

/**
 * Centralized Error Handling Middleware
 * Ensures safe JSON error responses and prevents stack trace leakage in production.
 */
export const errorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const statusCode = typeof err.statusCode === 'number' && err.statusCode >= 400 && err.statusCode < 600
    ? err.statusCode
    : typeof err.status === 'number' && err.status >= 400 && err.status < 600
    ? err.status
    : 500;

  const message = err.message || 'Internal server error';

  if (env.NODE_ENV !== 'test') {
    console.error(`[Error] ${statusCode} - ${message}`);
    if (err.stack && env.NODE_ENV === 'development') {
      console.error(err.stack);
    }
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(env.NODE_ENV === 'development' && err.stack ? { stack: err.stack } : {}),
  });
};
