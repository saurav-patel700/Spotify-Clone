import { z } from 'zod';

export const authCredentialsSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const signupSchema = authCredentialsSchema.extend({
  displayName: z.string().trim().min(2, 'Display name must be at least 2 characters').max(48),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
});

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(10, 'Invalid reset token'),
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
});

export const profileUpdateSchema = z.object({
  displayName: z.string().trim().min(2).max(48),
  preferredFocusMinutes: z.number().int().min(5).max(90),
  preferredBreakMinutes: z.number().int().min(1).max(30),
  preferredLongBreakMinutes: z.number().int().min(5).max(60),
});

export const playlistCreateSchema = z.object({
  title: z.string().trim().min(1, 'Playlist title is required').max(80),
  description: z.string().trim().max(300).optional().default(''),
  isPublic: z.boolean().optional().default(false),
});

export const focusSessionConfigSchema = z.object({
  mode: z.enum(['deep_work', 'study', 'relax', 'break', 'custom']),
  focusDurationMin: z.number().int().min(1).max(120),
  breakDurationMin: z.number().int().min(1).max(45),
  longBreakDurationMin: z.number().int().min(5).max(60),
  targetCycles: z.number().int().min(1).max(8),
  targetMood: z.enum(['all', 'ambient', 'lofi', 'minimal', 'electronic', 'acoustic']),
  instrumentalOnly: z.boolean(),
  energyMin: z.number().int().min(1).max(10),
  energyMax: z.number().int().min(1).max(10),
});

export const focusSessionRecordSchema = z.object({
  mode: z.enum(['deep_work', 'study', 'relax', 'break', 'custom']),
  focusDurationMin: z.number().int().min(1).max(120),
  breakDurationMin: z.number().int().min(1).max(45),
  completedCycles: z.number().int().min(1).max(20).default(1),
  targetCycles: z.number().int().min(1).max(12).default(4),
  targetMood: z.enum(['all', 'ambient', 'lofi', 'minimal', 'electronic', 'acoustic']).default('all'),
  playlistId: z.string().optional(),
  startedAt: z.string(),
  endedAt: z.string().optional(),
  status: z.enum(['active', 'completed', 'ended_early']).default('completed'),
});

export const memoryNoteCreateSchema = z.object({
  trackId: z.string().min(1),
  timestampMs: z.number().int().min(0),
  noteText: z.string().trim().max(2000),
  isBookmark: z.boolean().default(false),
  tagIds: z.array(z.string()).default([]),
});

export const memoryNoteUpdateSchema = z.object({
  noteText: z.string().trim().max(2000).optional(),
  isBookmark: z.boolean().optional(),
  timestampMs: z.number().int().min(0).optional(),
  tagIds: z.array(z.string()).optional(),
});

export const userTagCreateSchema = z.object({
  name: z.string().trim().min(1, 'Tag name is required').max(28),
  colorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});

