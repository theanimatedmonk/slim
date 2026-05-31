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

function parseAllowedOrigins(): string[] {
  const raw = process.env.FRONTEND_URL ?? 'http://localhost:5173';
  return raw
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

export const config = {
  port: parseInt(process.env.PORT ?? '3001', 10),
  /** Normalized allowed browser origins (comma-separated in FRONTEND_URL). */
  allowedOrigins: parseAllowedOrigins(),
  frontendUrl: parseAllowedOrigins()[0] ?? 'http://localhost:5173',
  supabaseUrl: requireEnv('SUPABASE_URL'),
  supabaseServiceKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? '',
  assetRetentionDays: parseInt(process.env.ASSET_RETENTION_DAYS ?? '30', 10),
  storageBucket: process.env.SUPABASE_STORAGE_BUCKET ?? 'assets',
  cronSecret: requireEnv('CRON_SECRET'),
};
