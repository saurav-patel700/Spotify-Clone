import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createApp } from '../src/app.js';
import { SqliteRepository } from '../src/db/sqliteStore.js';

async function signupAndGetToken(
  app: ReturnType<typeof createApp>['app'],
  displayName: string,
  email: string,
  password = 'password123'
): Promise<{ token: string; userId: string }> {
  const res = await request(app)
    .post('/api/v1/auth/signup')
    .send({ displayName, email, password })
    .expect(201);
  return {
    token: res.body.data.accessToken as string,
    userId: res.body.data.user.id as string,
  };
}

describe('SoundSphere Backend API & Database Integration', () => {
  let tmpDir: string;
  let dbPath: string;
  let audioDir: string;
  let openRepos: SqliteRepository[] = [];

  const openRepo = () => {
    const repo = new SqliteRepository(dbPath);
    openRepos.push(repo);
    return repo;
  };

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'soundsphere-test-'));
    dbPath = path.join(tmpDir, 'test.db');
    audioDir = path.join(tmpDir, 'audio');
    openRepos = [];
  });

  afterEach(() => {
    for (const repo of openRepos) {
      repo.close();
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('supports signup, login, logout token revocation, forgot password, and password reset', async () => {
    const repo = openRepo();
    const { app } = createApp({ repository: repo, audioCacheDir: audioDir });

    // Protected route rejects unauthenticated requests
    await request(app).get('/api/v1/auth/me').expect(401);
    await request(app).get('/api/v1/favorites').expect(401);

    // Signup
    const { token } = await signupAndGetToken(app, 'Alice', 'alice@example.com', 'secret123');

    // Duplicate email rejected with 409
    await request(app)
      .post('/api/v1/auth/signup')
      .send({ displayName: 'Alice 2', email: 'alice@example.com', password: 'secret123' })
      .expect(409);

    // Session persistence via /auth/me
    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(meRes.body.data.user.email).toBe('alice@example.com');

    // Logout revokes token
    await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);

    // Forgot password -> Reset password -> Login with new password
    const forgotRes = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'alice@example.com' })
      .expect(200);
    const resetToken = forgotRes.body.data.resetToken as string;
    expect(resetToken).toBeTruthy();

    await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: resetToken, newPassword: 'newpassword456' })
      .expect(200);

    // Old password fails
    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'alice@example.com', password: 'secret123' })
      .expect(401);

    // New password succeeds
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'alice@example.com', password: 'newpassword456' })
      .expect(200);
    expect(loginRes.body.data.accessToken).toBeTruthy();
  });

  it('serves database-backed catalog, discovery, and paginated songs/search', async () => {
    const repo = openRepo();
    const { app } = createApp({ repository: repo, audioCacheDir: audioDir });

    const discoverRes = await request(app).get('/api/v1/discover').expect(200);
    expect(discoverRes.body.data.featuredAlbums.length).toBeGreaterThan(0);
    expect(discoverRes.body.data.trendingTracks.length).toBeGreaterThan(0);

    const page1 = await request(app).get('/api/v1/songs?page=1&limit=5').expect(200);
    expect(page1.body.data.tracks).toHaveLength(5);
    expect(page1.body.meta.page).toBe(1);
    expect(page1.body.meta.total).toBe(21);
    expect(page1.body.meta.totalPages).toBe(5);

    const searchRes = await request(app).get('/api/v1/search?q=Horizon').expect(200);
    expect(searchRes.body.data.tracks[0].title).toBe('Signal Horizon');
  });

  it('persists favorites, playlist CRUD, and history across DB restarts under JWT auth', async () => {
    const repo1 = openRepo();
    const { app: app1 } = createApp({ repository: repo1, audioCacheDir: audioDir });
    const { token } = await signupAndGetToken(app1, 'Bob', 'bob@example.com');

    await request(app1)
      .post('/api/v1/favorites/trk-07')
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    const createPl = await request(app1)
      .post('/api/v1/playlists')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Focus Set', description: 'Study list', trackIds: ['trk-01'] })
      .expect(201);
    const playlistId = createPl.body.data.playlist.id as string;

    await request(app1)
      .post(`/api/v1/playlists/${playlistId}/tracks`)
      .set('Authorization', `Bearer ${token}`)
      .send({ trackId: 'trk-04' })
      .expect(200);

    await request(app1)
      .post('/api/v1/history')
      .set('Authorization', `Bearer ${token}`)
      .send({ trackId: 'trk-02', contextType: 'album', contextId: 'alb-quiet-telemetry' })
      .expect(201);

    // Re-open database and verify persistence
    const repo2 = openRepo();
    const { app: app2 } = createApp({ repository: repo2, audioCacheDir: audioDir });

    const favRes = await request(app2)
      .get('/api/v1/favorites')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(favRes.body.data.trackIds).toEqual(['trk-07']);

    const plRes = await request(app2)
      .get(`/api/v1/playlists/${playlistId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(plRes.body.data.playlist.trackIds).toEqual(['trk-01', 'trk-04']);

    const histRes = await request(app2)
      .get('/api/v1/history')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(histRes.body.data.items[0].trackId).toBe('trk-02');
  });

  it('persists FocusFlow sessions and MemoryMix notes, bookmarks, and tags with owner privacy', async () => {
    const repo1 = openRepo();
    const { app: app1 } = createApp({ repository: repo1, audioCacheDir: audioDir });
    const alice = await signupAndGetToken(app1, 'Alice', 'alice2@example.com');
    const bob = await signupAndGetToken(app1, 'Bob', 'bob2@example.com');

    await request(app1)
      .post('/api/v1/focus/sessions')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({
        mode: 'deep_work',
        focusDurationMin: 50,
        breakDurationMin: 10,
        completedCycles: 1,
        targetCycles: 3,
        targetMood: 'ambient',
        playlistId: 'pl-deep-work',
        startedAt: '2026-11-25T09:00:00.000Z',
        endedAt: '2026-11-25T09:50:00.000Z',
        status: 'completed',
      })
      .expect(201);

    const tagRes = await request(app1)
      .post('/api/v1/memory/tags')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ name: 'Motivation', colorHex: '#10B981' })
      .expect(201);

    const noteRes = await request(app1)
      .post('/api/v1/memory')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({
        trackId: 'trk-01',
        timestampMs: 42000,
        noteText: 'Key motif',
        isBookmark: true,
        tagIds: [tagRes.body.data.tag.id],
      })
      .expect(201);

    // Duplicate bookmark within same second deduplicates
    const dupRes = await request(app1)
      .post('/api/v1/memory')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({
        trackId: 'trk-01',
        timestampMs: 42300,
        noteText: 'Key motif updated',
        isBookmark: true,
        tagIds: [],
      })
      .expect(200);
    expect(dupRes.body.data.deduplicated).toBe(true);
    expect(dupRes.body.data.note.id).toBe(noteRes.body.data.note.id);

    // Bob cannot read or mutate Alice's private data
    const bobMemory = await request(app1)
      .get('/api/v1/memory')
      .set('Authorization', `Bearer ${bob.token}`)
      .expect(200);
    expect(bobMemory.body.data.notes).toEqual([]);
    expect(bobMemory.body.data.bookmarks).toEqual([]);

    await request(app1)
      .delete(`/api/v1/memory/${noteRes.body.data.note.id}`)
      .set('Authorization', `Bearer ${bob.token}`)
      .expect(404);

    // Re-open DB and confirm Alice's focus sessions, notes, and timestamp bookmarks persisted
    const repo2 = openRepo();
    const { app: app2 } = createApp({ repository: repo2, audioCacheDir: audioDir });

    const focusRes = await request(app2)
      .get('/api/v1/focus/sessions')
      .set('Authorization', `Bearer ${alice.token}`)
      .expect(200);
    expect(focusRes.body.data.sessions).toHaveLength(1);
    expect(focusRes.body.data.sessions[0].focusDurationMin).toBe(50);

    const aliceMemory = await request(app2)
      .get('/api/v1/memory')
      .set('Authorization', `Bearer ${alice.token}`)
      .expect(200);
    expect(aliceMemory.body.data.notes).toHaveLength(1);
    expect(aliceMemory.body.data.bookmarks).toHaveLength(1);
    expect(aliceMemory.body.data.bookmarks[0].label).toBe('Key motif updated');
  });

  it('validates audio uploads (magic bytes & size limit) and streams WAV audio with HTTP 206 Range', async () => {
    const repo = openRepo();
    const { app } = createApp({ repository: repo, audioCacheDir: audioDir });
    const { token } = await signupAndGetToken(app, 'Uploader', 'up@example.com');

    // Reject disguised text payload pretending to be .mp3
    const fakeMp3 = Buffer.from('not-actually-an-audio-file-just-text').toString('base64');
    const invalidRes = await request(app)
      .post('/api/v1/audio/upload')
      .set('Authorization', `Bearer ${token}`)
      .send({ filename: 'fake.mp3', mimeType: 'audio/mpeg', dataBase64: fakeMp3 })
      .expect(400);
    expect(invalidRes.body.error.code).toBe('INVALID_AUDIO_SIGNATURE');

    // Accept valid RIFF/WAVE binary
    const wavHeader = Buffer.alloc(64);
    wavHeader.write('RIFF', 0, 'ascii');
    wavHeader.writeUInt32LE(56, 4);
    wavHeader.write('WAVE', 8, 'ascii');
    const uploadRes = await request(app)
      .post('/api/v1/audio/upload')
      .set('Authorization', `Bearer ${token}`)
      .send({
        filename: 'session.wav',
        mimeType: 'audio/wav',
        dataBase64: wavHeader.toString('base64'),
      })
      .expect(201);
    expect(uploadRes.body.data.format).toBe('wav');

    // Range streaming
    const rangeRes = await request(app)
      .get('/api/v1/tracks/trk-01/audio')
      .set('Range', 'bytes=0-1023')
      .expect(206);
    expect(rangeRes.headers['accept-ranges']).toBe('bytes');
    expect(rangeRes.headers['content-range']).toMatch(/^bytes 0-1023\/\d+$/);
  });
});
