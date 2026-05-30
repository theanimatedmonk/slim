import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  port: parseInt(process.env.PORT ?? '3001', 10),
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  supabaseUrl: requireEnv('SUPABASE_URL'),
  supabaseServiceKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  storageBucket: process.env.SUPABASE_STORAGE_BUCKET ?? 'assets',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
};
