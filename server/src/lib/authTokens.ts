import crypto from 'node:crypto';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  name: string;
  jti: string;
  iat: number;
  exp: number;
}

function base64UrlEncode(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8');
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, keyHex] = storedHash.split(':');
  if (!salt || !keyHex) return false;
  const expected = Buffer.from(keyHex, 'hex');
  const actual = crypto.scryptSync(password, salt, 64);
  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(expected, actual);
}

export function signAccessToken(
  user: { id: string; email: string; displayName: string },
  secret: string,
  ttlSeconds = 60 * 60 * 24 * 7
): { token: string; expiresAt: string; jti: string } {
  const nowSec = Math.floor(Date.now() / 1000);
  const jti = crypto.randomUUID();
  const payload: AccessTokenPayload = {
    sub: user.id,
    email: user.email,
    name: user.displayName,
    jti,
    iat: nowSec,
    exp: nowSec + ttlSeconds,
  };

  const headerSegment = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payloadSegment = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${headerSegment}.${payloadSegment}`;
  const signature = crypto.createHmac('sha256', secret).update(signingInput).digest('base64url');

  return {
    token: `${signingInput}.${signature}`,
    expiresAt: new Date((nowSec + ttlSeconds) * 1000).toISOString(),
    jti,
  };
}

export function verifyAccessToken(token: string, secret: string): AccessTokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerSeg, payloadSeg, sigSeg] = parts;
  const signingInput = `${headerSeg}.${payloadSeg}`;
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(signingInput)
    .digest('base64url');

  const actualBuf = Buffer.from(sigSeg);
  const expectedBuf = Buffer.from(expectedSig);
  if (actualBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(actualBuf, expectedBuf)) return null;

  try {
    const parsed = JSON.parse(base64UrlDecode(payloadSeg)) as AccessTokenPayload;
    if (!parsed.sub || !parsed.exp || parsed.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function generateResetToken(): { rawToken: string; tokenHash: string } {
  const rawToken = crypto.randomBytes(24).toString('hex');
  const tokenHash = hashToken(rawToken);
  return { rawToken, tokenHash };
}

export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}
