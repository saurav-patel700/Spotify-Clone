import fs from 'node:fs';
import express, { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import {
  authCredentialsSchema,
  focusSessionRecordSchema,
  forgotPasswordSchema,
  memoryNoteCreateSchema,
  memoryNoteUpdateSchema,
  playlistCreateSchema,
  profileUpdateSchema,
  resetPasswordSchema,
  signupSchema,
  userTagCreateSchema,
} from '@soundsphere/shared';
import type { DatabaseRepository } from '../db/repository.js';
import {
  createAuthMiddleware,
  type AuthenticatedRequest,
  type OptionalAuthRequest,
} from '../middleware/auth.js';
import { ensureWavFile } from '../lib/audioGenerator.js';
import { AudioUploadError, validateAndSaveAudioUpload } from '../lib/audioUpload.js';
import { env } from '../config/env.js';

const historyBodySchema = z.object({
  trackId: z.string().min(1),
  contextType: z
    .enum(['album', 'playlist', 'search', 'focus_flow', 'memory_mix', 'direct'])
    .default('direct'),
  contextId: z.string().optional(),
});

const playlistUpdateSchema = z.object({
  title: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(300).optional(),
  isPublic: z.boolean().optional(),
});

const playlistTrackBodySchema = z.object({
  trackId: z.string().min(1),
});

const playlistReorderSchema = z.object({
  trackIds: z.array(z.string().min(1)),
});

const queueBodySchema = z.object({
  currentTrackId: z.string().nullable(),
  currentPositionMs: z.number().int().min(0),
  queueTrackIds: z.array(z.string()),
  shuffle: z.boolean(),
  repeatMode: z.enum(['off', 'one', 'all']),
});

const bookmarkCreateSchema = z.object({
  trackId: z.string().min(1),
  timestampMs: z.number().int().min(0),
  label: z.string().trim().max(240).default(''),
});

const audioUploadJsonSchema = z.object({
  filename: z.string().trim().min(1).max(160),
  mimeType: z.string().trim().min(1),
  dataBase64: z.string().min(1),
});

export function createV1Router(repo: DatabaseRepository, audioCacheDir: string): Router {
  const router = Router();
  const { requireAuth, optionalAuth } = createAuthMiddleware(repo);

  router.get('/health', (_req: Request, res: Response) => {
    res.json({
      data: {
        status: 'ok',
        storageBackend: repo.kind,
        timestamp: new Date().toISOString(),
      },
    });
  });

  // --- Authentication & Profile ---
  router.post('/auth/signup', async (req: Request, res: Response) => {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.errors[0]?.message ?? 'Invalid signup fields.',
        },
      });
      return;
    }

    try {
      const session = await repo.signup({
        displayName: parsed.data.displayName,
        email: parsed.data.email,
        password: parsed.data.password,
      });
      res.status(201).json({ data: session });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Signup failed';
      if (msg === 'EMAIL_IN_USE' || msg.toLowerCase().includes('already')) {
        res.status(409).json({
          error: {
            code: 'EMAIL_IN_USE',
            message: 'An account with this email already exists.',
          },
        });
        return;
      }
      res.status(400).json({ error: { code: 'SIGNUP_FAILED', message: msg } });
    }
  });

  router.post('/auth/login', async (req: Request, res: Response) => {
    const parsed = authCredentialsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.errors[0]?.message ?? 'Invalid credentials.',
        },
      });
      return;
    }

    const session = await repo.login({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    if (!session) {
      res.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' },
      });
      return;
    }

    res.json({ data: session });
  });

  router.post('/auth/logout', requireAuth, async (req: Request, res: Response) => {
    const { tokenJti } = req as AuthenticatedRequest;
    if (tokenJti) {
      await repo.logout(tokenJti);
    }
    res.json({ data: { loggedOut: true } });
  });

  router.post('/auth/forgot-password', async (req: Request, res: Response) => {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.errors[0]?.message ?? 'Invalid email address.',
        },
      });
      return;
    }

    const { resetToken, expiresAt } = await repo.createPasswordReset(parsed.data.email);
    res.json({
      data: {
        message: 'If an account matches that email, password reset instructions have been issued.',
        expiresAt,
        // Expose resetToken only in non-production environments for automated/local verification
        ...(env.NODE_ENV !== 'production' && resetToken ? { resetToken } : {}),
      },
    });
  });

  router.post('/auth/reset-password', async (req: Request, res: Response) => {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.errors[0]?.message ?? 'Invalid reset payload.',
        },
      });
      return;
    }

    const ok = await repo.resetPassword(parsed.data.token, parsed.data.newPassword);
    if (!ok) {
      res.status(400).json({
        error: {
          code: 'INVALID_RESET_TOKEN',
          message: 'Password reset token is invalid or expired.',
        },
      });
      return;
    }

    res.json({ data: { reset: true } });
  });

  router.get('/auth/me', requireAuth, async (req: Request, res: Response) => {
    const { userId } = req as AuthenticatedRequest;
    const profile = await repo.getProfileById(userId);
    if (!profile) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Profile not found.' } });
      return;
    }
    res.json({ data: { user: profile } });
  });

  router.patch('/auth/me', requireAuth, async (req: Request, res: Response) => {
    const { userId } = req as AuthenticatedRequest;
    const parsed = profileUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.errors[0]?.message ?? 'Invalid profile data.',
        },
      });
      return;
    }
    const updated = await repo.updateProfile(userId, parsed.data);
    if (!updated) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Profile not found.' } });
      return;
    }
    res.json({ data: { user: updated } });
  });

  // --- Public Catalog & Discovery (Database-Backed + Paginated) ---
  router.get('/catalog', async (_req: Request, res: Response) => {
    const snapshot = await repo.getCatalogSnapshot();
    res.json({ data: snapshot });
  });

  router.get('/discover', async (_req: Request, res: Response) => {
    const snap = await repo.getCatalogSnapshot();
    res.json({
      data: {
        featuredAlbums: snap.albums.filter((a) => a.featured),
        newReleases: snap.albums.filter((a) => a.isNewRelease),
        trendingTracks: snap.tracks
          .filter((t) => t.trendingRank !== undefined)
          .sort((a, b) => (a.trendingRank ?? 999) - (b.trendingRank ?? 999)),
        recommendedPlaylists: snap.editorialPlaylists,
        recommendedArtists: snap.artists,
      },
    });
  });

  router.get('/songs', async (req: Request, res: Response) => {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);
    const maxBpm = req.query.maxBpm !== undefined ? Number(req.query.maxBpm) : undefined;
    const result = await repo.getSongs({
      q: typeof req.query.q === 'string' ? req.query.q : undefined,
      genre: typeof req.query.genre === 'string' ? req.query.genre : undefined,
      mood: typeof req.query.mood === 'string' ? req.query.mood : undefined,
      instrumentalOnly: req.query.instrumental === 'true',
      maxBpm: Number.isFinite(maxBpm) ? maxBpm : undefined,
      page: Number.isFinite(page) ? page : 1,
      limit: Number.isFinite(limit) ? limit : 20,
    });
    res.json({ data: { tracks: result.items }, meta: result.meta });
  });

  router.get('/albums', async (req: Request, res: Response) => {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);
    const result = await repo.getAlbums(
      Number.isFinite(page) ? page : 1,
      Number.isFinite(limit) ? limit : 20
    );
    res.json({ data: { albums: result.items }, meta: result.meta });
  });

  router.get('/albums/:id', async (req: Request, res: Response) => {
    const data = await repo.getAlbumById(String(req.params.id));
    if (!data) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Album not found.' } });
      return;
    }
    res.json({ data });
  });

  router.get('/artists', async (req: Request, res: Response) => {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);
    const result = await repo.getArtists(
      Number.isFinite(page) ? page : 1,
      Number.isFinite(limit) ? limit : 20
    );
    res.json({ data: { artists: result.items }, meta: result.meta });
  });

  router.get('/artists/:id', async (req: Request, res: Response) => {
    const data = await repo.getArtistById(String(req.params.id));
    if (!data) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Artist not found.' } });
      return;
    }
    res.json({ data });
  });

  router.get('/search', optionalAuth, async (req: Request, res: Response) => {
    const { userId } = req as OptionalAuthRequest;
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const type =
      req.query.type === 'tracks' ||
      req.query.type === 'albums' ||
      req.query.type === 'artists' ||
      req.query.type === 'playlists'
        ? req.query.type
        : 'all';
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);

    const results = await repo.searchCatalog({
      q,
      type,
      page: Number.isFinite(page) ? page : 1,
      limit: Number.isFinite(limit) ? limit : 20,
      userId,
    });

    res.json({
      data: {
        tracks: results.tracks.items,
        albums: results.albums,
        artists: results.artists,
        playlists: results.playlists,
      },
      meta: results.tracks.meta,
    });
  });

  // --- Audio Streaming & Validated Uploads ---
  router.get('/tracks/:id/stream', async (req: Request, res: Response) => {
    const trackId = String(req.params.id);
    const track = await repo.getTrackById(trackId);
    if (!track) {
      res.status(404).json({
        error: {
          code: 'AUDIO_UNAVAILABLE',
          message: `Audio track "${trackId}" is unavailable or removed.`,
        },
      });
      return;
    }

    res.json({
      data: {
        trackId: track.id,
        streamUrl: `/api/v1/tracks/${encodeURIComponent(track.id)}/audio`,
        durationMs: track.durationMs,
        licenseType: track.licenseType,
        attributionText: track.attributionText,
      },
    });
  });

  router.get('/tracks/:id/audio', async (req: Request, res: Response) => {
    const trackId = String(req.params.id);
    const track = await repo.getTrackById(trackId);
    if (!track) {
      res.status(404).json({
        error: {
          code: 'AUDIO_UNAVAILABLE',
          message: `Audio file for "${trackId}" is not available.`,
        },
      });
      return;
    }

    const filePath = ensureWavFile(
      { ...track, audioPath: `${track.id}.wav` },
      audioCacheDir
    );
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=3600');

    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match) {
        res.status(416).setHeader('Content-Range', `bytes */${fileSize}`).end();
        return;
      }
      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Math.min(Number(match[2]), fileSize - 1) : fileSize - 1;

      if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= fileSize) {
        res.status(416).setHeader('Content-Range', `bytes */${fileSize}`).end();
        return;
      }

      const chunkSize = end - start + 1;
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      res.setHeader('Content-Length', String(chunkSize));
      fs.createReadStream(filePath, { start, end }).pipe(res);
      return;
    }

    res.status(200);
    res.setHeader('Content-Length', String(fileSize));
    fs.createReadStream(filePath).pipe(res);
  });

  router.post(
    '/audio/upload',
    requireAuth,
    express.json({ limit: `${env.MAX_AUDIO_UPLOAD_MB + 8}mb` }),
    async (req: Request, res: Response) => {
      const parsed = audioUploadJsonSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Audio upload requires filename, mimeType, and base64 payload.',
          },
        });
        return;
      }

      const buffer = Buffer.from(parsed.data.dataBase64, 'base64');
      const maxBytes = env.MAX_AUDIO_UPLOAD_MB * 1024 * 1024;

      try {
        const saved = validateAndSaveAudioUpload({
          filename: parsed.data.filename,
          mimeType: parsed.data.mimeType,
          buffer,
          maxBytes,
          destDir: audioCacheDir,
        });
        res.status(201).json({
          data: {
            filename: saved.storedFilename,
            format: saved.format,
            sizeBytes: saved.sizeBytes,
          },
        });
      } catch (err) {
        if (err instanceof AudioUploadError) {
          res.status(err.status).json({
            error: { code: err.code, message: err.message },
          });
          return;
        }
        throw err;
      }
    }
  );

  // --- Favorites (Protected) ---
  router.get('/favorites', requireAuth, async (req: Request, res: Response) => {
    const { userId } = req as AuthenticatedRequest;
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 50);
    const result = await repo.getFavorites(
      userId,
      Number.isFinite(page) ? page : 1,
      Number.isFinite(limit) ? limit : 50
    );
    res.json({ data: { trackIds: result.items }, meta: result.meta });
  });

  router.post('/favorites/:trackId', requireAuth, async (req: Request, res: Response) => {
    const { userId } = req as AuthenticatedRequest;
    const trackId = String(req.params.trackId);
    const track = await repo.getTrackById(trackId);
    if (!track) {
      res.status(404).json({ error: { code: 'TRACK_NOT_FOUND', message: 'Track not found.' } });
      return;
    }
    const trackIds = await repo.addFavorite(userId, trackId);
    res.status(201).json({ data: { trackIds } });
  });

  router.delete('/favorites/:trackId', requireAuth, async (req: Request, res: Response) => {
    const { userId } = req as AuthenticatedRequest;
    const trackId = String(req.params.trackId);
    const trackIds = await repo.removeFavorite(userId, trackId);
    res.json({ data: { trackIds } });
  });

  // --- Playlists ---
  router.get('/playlists', requireAuth, async (req: Request, res: Response) => {
    const { userId } = req as AuthenticatedRequest;
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 50);
    const result = await repo.getPlaylists(
      userId,
      Number.isFinite(page) ? page : 1,
      Number.isFinite(limit) ? limit : 50
    );
    res.json({ data: { playlists: result.items }, meta: result.meta });
  });

  router.post('/playlists', requireAuth, async (req: Request, res: Response) => {
    const { userId, userName } = req as AuthenticatedRequest;
    const parsed = playlistCreateSchema
      .extend({ trackIds: z.array(z.string()).optional() })
      .safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.errors[0]?.message ?? 'Invalid playlist data',
        },
      });
      return;
    }
    const playlist = await repo.createPlaylist(userId, userName, {
      title: parsed.data.title ?? 'Untitled Playlist',
      description: parsed.data.description ?? '',
      isPublic: parsed.data.isPublic ?? false,
      trackIds: parsed.data.trackIds,
    });
    res.status(201).json({ data: { playlist } });
  });

  router.get('/playlists/:id', optionalAuth, async (req: Request, res: Response) => {
    const { userId } = req as OptionalAuthRequest;
    const playlist = await repo.getPlaylistById(userId, String(req.params.id));
    if (!playlist) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Playlist not found.' } });
      return;
    }
    res.json({ data: { playlist } });
  });

  router.patch('/playlists/:id', requireAuth, async (req: Request, res: Response) => {
    const { userId } = req as AuthenticatedRequest;
    const parsed = playlistUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid playlist update' } });
      return;
    }
    const updated = await repo.updatePlaylist(userId, String(req.params.id), parsed.data);
    if (!updated) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Playlist not found.' } });
      return;
    }
    res.json({ data: { playlist: updated } });
  });

  router.delete('/playlists/:id', requireAuth, async (req: Request, res: Response) => {
    const { userId } = req as AuthenticatedRequest;
    const deleted = await repo.deletePlaylist(userId, String(req.params.id));
    if (!deleted) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Playlist not found.' } });
      return;
    }
    res.json({ data: { deleted: true } });
  });

  router.post('/playlists/:id/tracks', requireAuth, async (req: Request, res: Response) => {
    const { userId } = req as AuthenticatedRequest;
    const parsed = playlistTrackBodySchema.safeParse(req.body);
    if (!parsed.success || !(await repo.getTrackById(parsed.data.trackId))) {
      res.status(400).json({ error: { code: 'INVALID_TRACK', message: 'Valid trackId is required.' } });
      return;
    }
    const updated = await repo.addTrackToPlaylist(
      userId,
      String(req.params.id),
      parsed.data.trackId
    );
    if (!updated) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Playlist not found.' } });
      return;
    }
    res.json({ data: { playlist: updated } });
  });

  router.patch('/playlists/:id/tracks/reorder', requireAuth, async (req: Request, res: Response) => {
    const { userId } = req as AuthenticatedRequest;
    const parsed = playlistReorderSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid trackIds order.' } });
      return;
    }
    const updated = await repo.reorderPlaylistTracks(
      userId,
      String(req.params.id),
      parsed.data.trackIds
    );
    if (!updated) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Playlist not found.' } });
      return;
    }
    res.json({ data: { playlist: updated } });
  });

  router.delete('/playlists/:id/tracks/:trackId', requireAuth, async (req: Request, res: Response) => {
    const { userId } = req as AuthenticatedRequest;
    const updated = await repo.removeTrackFromPlaylist(
      userId,
      String(req.params.id),
      String(req.params.trackId)
    );
    if (!updated) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Playlist not found.' } });
      return;
    }
    res.json({ data: { playlist: updated } });
  });

  // --- Recently Played History & Queue (Protected) ---
  router.get('/history', requireAuth, async (req: Request, res: Response) => {
    const { userId } = req as AuthenticatedRequest;
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 24);
    const result = await repo.getHistory(
      userId,
      Number.isFinite(page) ? page : 1,
      Number.isFinite(limit) ? limit : 24
    );
    res.json({ data: { items: result.items }, meta: result.meta });
  });

  router.post('/history', requireAuth, async (req: Request, res: Response) => {
    const { userId } = req as AuthenticatedRequest;
    const parsed = historyBodySchema.safeParse(req.body);
    if (!parsed.success || !(await repo.getTrackById(parsed.data.trackId))) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Valid trackId is required.' } });
      return;
    }
    const item = await repo.recordHistory(
      userId,
      parsed.data.trackId,
      parsed.data.contextType,
      parsed.data.contextId
    );
    res.status(201).json({ data: { item } });
  });

  router.get('/queue', requireAuth, async (req: Request, res: Response) => {
    const { userId } = req as AuthenticatedRequest;
    const queue = await repo.getQueue(userId);
    res.json({ data: { queue } });
  });

  router.put('/queue', requireAuth, async (req: Request, res: Response) => {
    const { userId } = req as AuthenticatedRequest;
    const parsed = queueBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid queue payload.' } });
      return;
    }
    const queue = await repo.saveQueue(userId, {
      currentTrackId: parsed.data.currentTrackId ?? null,
      currentPositionMs: parsed.data.currentPositionMs ?? 0,
      queueTrackIds: parsed.data.queueTrackIds ?? [],
      shuffle: parsed.data.shuffle ?? false,
      repeatMode: parsed.data.repeatMode ?? 'off',
    });
    res.json({ data: { queue } });
  });

  // --- FocusFlow Sessions (Protected) ---
  router.get('/focus/sessions', requireAuth, async (req: Request, res: Response) => {
    const { userId } = req as AuthenticatedRequest;
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 100);
    const result = await repo.getFocusSessions(
      userId,
      Number.isFinite(page) ? page : 1,
      Number.isFinite(limit) ? limit : 100
    );
    res.json({ data: { sessions: result.items }, meta: result.meta });
  });

  router.post('/focus/sessions', requireAuth, async (req: Request, res: Response) => {
    const { userId } = req as AuthenticatedRequest;
    const parsed = focusSessionRecordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.errors[0]?.message ?? 'Invalid focus session payload.',
        },
      });
      return;
    }
    const session = await repo.recordFocusSession(userId, parsed.data);
    res.status(201).json({ data: { session } });
  });

  // --- MemoryMix (Protected) ---
  router.get('/memory', requireAuth, async (req: Request, res: Response) => {
    const { userId } = req as AuthenticatedRequest;
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 50);
    const [notesResult, tags, bookmarks] = await Promise.all([
      repo.getMemoryNotes(userId, {
        q: typeof req.query.q === 'string' ? req.query.q : undefined,
        tagId: typeof req.query.tagId === 'string' ? req.query.tagId : undefined,
        trackId: typeof req.query.trackId === 'string' ? req.query.trackId : undefined,
        bookmarksOnly: req.query.bookmarksOnly === 'true',
        page: Number.isFinite(page) ? page : 1,
        limit: Number.isFinite(limit) ? limit : 50,
      }),
      repo.getMemoryTags(userId),
      repo.getTimestampBookmarks(userId),
    ]);
    res.json({
      data: { notes: notesResult.items, tags, bookmarks },
      meta: notesResult.meta,
    });
  });

  router.post('/memory', requireAuth, async (req: Request, res: Response) => {
    const { userId } = req as AuthenticatedRequest;
    const parsed = memoryNoteCreateSchema.safeParse(req.body);
    if (!parsed.success || !(await repo.getTrackById(parsed.data.trackId))) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.success
            ? 'Valid trackId is required.'
            : parsed.error.errors[0]?.message ?? 'Invalid MemoryMix entry.',
        },
      });
      return;
    }

    const result = await repo.upsertMemoryNote(userId, {
      trackId: parsed.data.trackId,
      timestampMs: parsed.data.timestampMs ?? 0,
      noteText: parsed.data.noteText ?? '',
      isBookmark: parsed.data.isBookmark ?? false,
      tagIds: parsed.data.tagIds ?? [],
    });
    res.status(result.deduplicated ? 200 : 201).json({ data: result });
  });

  router.patch('/memory/:id', requireAuth, async (req: Request, res: Response) => {
    const { userId } = req as AuthenticatedRequest;
    const parsed = memoryNoteUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid note update.' } });
      return;
    }
    const updated = await repo.updateMemoryNote(userId, String(req.params.id), parsed.data);
    if (!updated) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'MemoryMix entry not found.' } });
      return;
    }
    res.json({ data: { note: updated } });
  });

  router.delete('/memory/:id', requireAuth, async (req: Request, res: Response) => {
    const { userId } = req as AuthenticatedRequest;
    const deleted = await repo.deleteMemoryNote(userId, String(req.params.id));
    if (!deleted) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'MemoryMix entry not found.' } });
      return;
    }
    res.json({ data: { deleted: true } });
  });

  router.get('/memory/bookmarks', requireAuth, async (req: Request, res: Response) => {
    const { userId } = req as AuthenticatedRequest;
    const trackId = typeof req.query.trackId === 'string' ? req.query.trackId : undefined;
    const bookmarks = await repo.getTimestampBookmarks(userId, trackId);
    res.json({ data: { bookmarks } });
  });

  router.post('/memory/bookmarks', requireAuth, async (req: Request, res: Response) => {
    const { userId } = req as AuthenticatedRequest;
    const parsed = bookmarkCreateSchema.safeParse(req.body);
    if (!parsed.success || !(await repo.getTrackById(parsed.data.trackId))) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Valid trackId and timestampMs are required.' },
      });
      return;
    }
    const result = await repo.upsertTimestampBookmark(userId, parsed.data);
    res.status(result.deduplicated ? 200 : 201).json({ data: result });
  });

  router.delete('/memory/bookmarks/:id', requireAuth, async (req: Request, res: Response) => {
    const { userId } = req as AuthenticatedRequest;
    const deleted = await repo.deleteTimestampBookmark(userId, String(req.params.id));
    if (!deleted) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Bookmark not found.' } });
      return;
    }
    res.json({ data: { deleted: true } });
  });

  router.get('/memory/tags', requireAuth, async (req: Request, res: Response) => {
    const { userId } = req as AuthenticatedRequest;
    const tags = await repo.getMemoryTags(userId);
    res.json({ data: { tags } });
  });

  router.post('/memory/tags', requireAuth, async (req: Request, res: Response) => {
    const { userId } = req as AuthenticatedRequest;
    const parsed = userTagCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.errors[0]?.message ?? 'Invalid tag.',
        },
      });
      return;
    }
    const tag = await repo.createMemoryTag(
      userId,
      parsed.data.name ?? 'Tag',
      parsed.data.colorHex ?? '#10B981'
    );
    res.status(201).json({ data: { tag } });
  });

  router.delete('/memory/tags/:id', requireAuth, async (req: Request, res: Response) => {
    const { userId } = req as AuthenticatedRequest;
    const deleted = await repo.deleteMemoryTag(userId, String(req.params.id));
    if (!deleted) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Tag not found.' } });
      return;
    }
    res.json({ data: { deleted: true } });
  });

  return router;
}
