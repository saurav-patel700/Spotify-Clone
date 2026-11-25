import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ALLOWED_MIME_TYPES = new Set([
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/mpeg',
  'audio/mp3',
  'audio/ogg',
  'audio/flac',
  'audio/mp4',
  'audio/aac',
]);

const ALLOWED_EXTENSIONS = new Set(['.wav', '.mp3', '.ogg', '.flac', '.m4a', '.aac']);

export class AudioUploadError extends Error {
  public readonly status: number;
  public readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function detectAudioSignature(buf: Buffer): 'wav' | 'mp3' | 'ogg' | 'flac' | 'mp4' | null {
  if (buf.length < 12) return null;

  // RIFF....WAVE
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WAVE') {
    return 'wav';
  }
  // ID3 tag or MPEG frame sync (11 set bits: 0xFF 0xE0+)
  if (
    buf.toString('ascii', 0, 3) === 'ID3' ||
    (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)
  ) {
    return 'mp3';
  }
  // OggS
  if (buf.toString('ascii', 0, 4) === 'OggS') {
    return 'ogg';
  }
  // fLaC
  if (buf.toString('ascii', 0, 4) === 'fLaC') {
    return 'flac';
  }
  // ISO Base Media (ftyp at byte 4)
  if (buf.toString('ascii', 4, 8) === 'ftyp') {
    return 'mp4';
  }

  return null;
}

export function validateAndSaveAudioUpload(input: {
  filename: string;
  mimeType: string;
  buffer: Buffer;
  maxBytes: number;
  destDir: string;
}): { storedFilename: string; storedPath: string; format: string; sizeBytes: number } {
  const { filename, mimeType, buffer, maxBytes, destDir } = input;

  if (buffer.byteLength === 0) {
    throw new AudioUploadError(400, 'EMPTY_AUDIO_FILE', 'Uploaded audio file is empty.');
  }

  if (buffer.byteLength > maxBytes) {
    throw new AudioUploadError(
      413,
      'FILE_TOO_LARGE',
      `Audio file exceeds the maximum allowed limit of ${Math.round(maxBytes / (1024 * 1024))} MB.`
    );
  }

  const ext = path.extname(filename).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new AudioUploadError(
      400,
      'UNSUPPORTED_EXTENSION',
      'Unsupported file extension. Allowed formats: .wav, .mp3, .ogg, .flac, .m4a, .aac.'
    );
  }

  const normalizedMime = mimeType.split(';')[0].trim().toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(normalizedMime)) {
    throw new AudioUploadError(
      400,
      'UNSUPPORTED_MIME_TYPE',
      'Unsupported MIME type for audio upload.'
    );
  }

  const detected = detectAudioSignature(buffer);
  if (!detected) {
    throw new AudioUploadError(
      400,
      'INVALID_AUDIO_SIGNATURE',
      'File content does not match a valid audio container signature.'
    );
  }

  fs.mkdirSync(destDir, { recursive: true });
  const storedFilename = `upload-${crypto.randomUUID()}.${detected}`;
  const storedPath = path.join(destDir, storedFilename);
  fs.writeFileSync(storedPath, buffer);

  return {
    storedFilename,
    storedPath,
    format: detected,
    sizeBytes: buffer.byteLength,
  };
}
