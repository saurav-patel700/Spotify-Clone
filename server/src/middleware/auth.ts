import type { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { env, hasSupabaseConfig } from '../config/env.js';
import type { DatabaseRepository } from '../db/repository.js';
import { verifyAccessToken } from '../lib/authTokens.js';

export interface AuthenticatedRequest extends Request {
  userId: string;
  userName: string;
  tokenJti?: string;
}

export interface OptionalAuthRequest extends Request {
  userId: string | null;
  userName: string | null;
}

const supabaseAuthClient =
  hasSupabaseConfig && env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

async function extractUserFromHeader(
  req: Request,
  repo: DatabaseRepository
): Promise<{ userId: string; userName: string; tokenJti?: string } | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;

  // 1. Check Supabase JWT if configured
  if (supabaseAuthClient && repo.kind === 'supabase') {
    try {
      const { data } = await supabaseAuthClient.auth.getUser(token);
      if (data.user) {
        return {
          userId: data.user.id,
          userName:
            (data.user.user_metadata?.display_name as string | undefined) ??
            data.user.email ??
            'Listener',
        };
      }
    } catch {
      return null;
    }
  }

  // 2. Verify signed HMAC-SHA256 JWT + check revocation list + check user still exists
  const payload = verifyAccessToken(token, env.JWT_SECRET);
  if (!payload) return null;

  if (await repo.isTokenRevoked(payload.jti)) {
    return null;
  }

  const profile = await repo.getProfileById(payload.sub);
  if (!profile) return null;

  return {
    userId: profile.id,
    userName: profile.displayName,
    tokenJti: payload.jti,
  };
}

export function createAuthMiddleware(repo: DatabaseRepository) {
  const requireAuth = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const resolved = await extractUserFromHeader(req, repo);
    if (!resolved) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required. Please sign in to continue.',
        },
      });
      return;
    }

    const authReq = req as AuthenticatedRequest;
    authReq.userId = resolved.userId;
    authReq.userName = resolved.userName;
    authReq.tokenJti = resolved.tokenJti;
    next();
  };

  const optionalAuth = async (
    req: Request,
    _res: Response,
    next: NextFunction
  ): Promise<void> => {
    const resolved = await extractUserFromHeader(req, repo);
    const optReq = req as OptionalAuthRequest;
    optReq.userId = resolved?.userId ?? null;
    optReq.userName = resolved?.userName ?? null;
    next();
  };

  return { requireAuth, optionalAuth };
}
