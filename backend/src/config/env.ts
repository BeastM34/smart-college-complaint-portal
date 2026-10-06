import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

/**
 * Sanitizes environment variable values by trimming whitespace,
 * stripping surrounding quotes, and converting empty strings to undefined.
 */
export const cleanEnvVar = (val: string | undefined): string | undefined => {
  if (!val) return undefined;
  const trimmed = val.trim();
  const unquoted = trimmed.replace(/^["'](.*)["']$/, '$1').trim();
  return unquoted.length > 0 ? unquoted : undefined;
};

// Locate .env across common execution contexts:
// 1. backend/.env relative to this config file (__dirname)
// 2. backend/.env relative to cwd (when running from project root)
// 3. .env in current working directory (when running inside backend or root)
const candidateEnvPaths = [
  path.resolve(__dirname, '../../.env'), // backend/.env when running from src/config or dist/config
  path.resolve(__dirname, '../.env'),
  path.resolve(process.cwd(), 'backend/.env'),
  path.resolve(process.cwd(), '.env'),
];

let envLoadedPath: string | null = null;
for (const envPath of candidateEnvPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    envLoadedPath = envPath;
    break;
  }
}

// Fallback to default dotenv load if none found
if (!envLoadedPath) {
  dotenv.config();
}

export interface EnvConfig {
  PORT: number;
  NODE_ENV: 'development' | 'production' | 'test';
  FRONTEND_URL: string;
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_JWKS_URL?: string;
  _envFilePath?: string | null;
}

const parsePort = (val: string | undefined, defaultPort: number): number => {
  if (!val) return defaultPort;
  const parsed = parseInt(val, 10);
  return isNaN(parsed) || parsed <= 0 ? defaultPort : parsed;
};

export const env: EnvConfig = {
  PORT: parsePort(process.env.PORT, 5000),
  NODE_ENV: (process.env.NODE_ENV as EnvConfig['NODE_ENV']) || 'development',
  FRONTEND_URL: cleanEnvVar(process.env.FRONTEND_URL) || 'http://localhost:5173',
  SUPABASE_URL: cleanEnvVar(process.env.SUPABASE_URL),
  // Support both SUPABASE_PUBLISHABLE_KEY and legacy SUPABASE_ANON_KEY
  SUPABASE_PUBLISHABLE_KEY: cleanEnvVar(process.env.SUPABASE_PUBLISHABLE_KEY) || cleanEnvVar(process.env.SUPABASE_ANON_KEY),
  // Support both SUPABASE_SECRET_KEY and legacy SUPABASE_SERVICE_ROLE_KEY
  SUPABASE_SECRET_KEY: cleanEnvVar(process.env.SUPABASE_SECRET_KEY) || cleanEnvVar(process.env.SUPABASE_SERVICE_ROLE_KEY),
  SUPABASE_JWKS_URL: cleanEnvVar(process.env.SUPABASE_JWKS_URL),
  _envFilePath: envLoadedPath,
};
