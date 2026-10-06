import { CorsOptions } from 'cors';
import { env } from './env';

/**
 * Clean, environment-aware CORS configuration
 * Supports local frontend development and future Vercel production deployment.
 */
export const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // In development or non-browser environments (e.g. Postman, curl, health checks),
    // allow requests without origin.
    if (!origin) {
      return callback(null, true);
    }

    // Normalized list of allowed origins
    const allowedOrigins = [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
    ];

    // Add configured FRONTEND_URL from environment
    if (env.FRONTEND_URL) {
      const configured = env.FRONTEND_URL.trim().replace(/\/$/, '');
      if (!allowedOrigins.includes(configured)) {
        allowedOrigins.push(configured);
      }
    }

    // Check if origin matches allowed list or is a Vercel preview domain in production
    const isAllowed =
      allowedOrigins.includes(origin) ||
      (env.NODE_ENV === 'development' && /^http:\/\/localhost(:\d+)?$/.test(origin));

    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error(`CORS origin "${origin}" not allowed by policy`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};
