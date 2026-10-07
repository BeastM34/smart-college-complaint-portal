import { Request, Response } from 'express';
import { env } from '../config/env';
import { HealthCheckResponse } from '../types';
import { testSupabaseConnection } from '../utils/supabaseTest';

export const getHealth = async (_req: Request, res: Response): Promise<void> => {
  const dbStatus = await testSupabaseConnection();

  res.status(200).json({
    success: true,
    message: 'Smart College Complaint Portal API is running',
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    database: {
      configured: dbStatus.configured,
      connected: dbStatus.connected,
      status: !dbStatus.configured ? 'not_configured' : dbStatus.connected ? 'connected' : 'error',
      message: dbStatus.message,
      error: dbStatus.error,
    },
  });
};
