import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

const candidateEnvPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../.env'),
];

for (const envPath of candidateEnvPaths) {
  if (fs.existsSync(envPath) && typeof process.loadEnvFile === 'function') {
    process.loadEnvFile(envPath);
    break;
  }
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  JWT_SECRET: z.string().min(16).default('soundsphere-dev-jwt-secret-change-in-production'),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SQLITE_PATH: z.string().default('./data/soundsphere.db'),
  AUDIO_CACHE_DIR: z.string().default('./storage/audio'),
  MAX_AUDIO_UPLOAD_MB: z.coerce.number().positive().max(100).default(15),
});

export const env = envSchema.parse(process.env);

if (
  env.NODE_ENV === 'production' &&
  env.JWT_SECRET === 'soundsphere-dev-jwt-secret-change-in-production'
) {
  throw new Error('JWT_SECRET environment variable must be configured in production.');
}

if (env.NODE_ENV === 'production' && env.CLIENT_ORIGIN.includes('localhost')) {
  throw new Error('CLIENT_ORIGIN must be set to your production frontend origin (not localhost).');
}

export const hasSupabaseConfig = Boolean(
  env.SUPABASE_URL &&
    env.SUPABASE_SERVICE_ROLE_KEY &&
    !env.SUPABASE_URL.includes('your-project')
);
