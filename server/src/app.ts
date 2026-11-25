import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env, hasSupabaseConfig } from './config/env.js';
import { SqliteRepository } from './db/sqliteStore.js';
import { SupabaseRepository } from './db/supabaseStore.js';
import type { DatabaseRepository } from './db/repository.js';
import { createV1Router } from './routes/v1.js';

export interface AppOptions {
  repository?: DatabaseRepository;
  audioCacheDir?: string;
}

export function createRepository(): DatabaseRepository {
  if (hasSupabaseConfig) {
    return new SupabaseRepository(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!);
  }
  return new SqliteRepository(env.SQLITE_PATH);
}

export function createApp(options: AppOptions = {}) {
  const app = express();
  const repo = options.repository ?? createRepository();
  const audioCacheDir = options.audioCacheDir ?? env.AUDIO_CACHE_DIR;

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );
  app.use(
    cors({
      origin: env.CLIENT_ORIGIN.split(',').map((o) => o.trim()),
      credentials: true,
    })
  );
  app.use(express.json({ limit: '1mb' }));

  if (env.NODE_ENV !== 'test') {
    app.use(
      '/api',
      rateLimit({
        windowMs: 60 * 1000,
        max: 300,
        standardHeaders: true,
        legacyHeaders: false,
      })
    );
  }

  app.use('/api/v1', createV1Router(repo, audioCacheDir));

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    void _next;
    const status =
      typeof err === 'object' && err !== null && 'status' in err && typeof (err as { status: number }).status === 'number'
        ? (err as { status: number }).status
        : 500;
    const message = err instanceof Error ? err.message : 'Internal server error';
    res.status(status).json({
      error: {
        code: status === 413 ? 'PAYLOAD_TOO_LARGE' : 'INTERNAL_ERROR',
        message,
      },
    });
  });

  return { app, repo };
}
