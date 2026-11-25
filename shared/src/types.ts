export type AlbumType = 'album' | 'ep' | 'single';
export type TrackMood = 'ambient' | 'lofi' | 'minimal' | 'electronic' | 'acoustic';
export type RepeatMode = 'off' | 'one' | 'all';
export type FocusMode = 'deep_work' | 'study' | 'relax' | 'break' | 'custom';
export type FocusPhase = 'focus' | 'short_break' | 'long_break';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  preferredFocusMinutes: number;
  preferredBreakMinutes: number;
  preferredLongBreakMinutes: number;
  createdAt: string;
}

export interface Artist {
  id: string;
  name: string;
  slug: string;
  bio: string;
  primaryGenre: string;
  artworkUrl: string;
  country: string;
}

export interface Album {
  id: string;
  artistId: string;
  title: string;
  slug: string;
  coverUrl: string;
  releaseDate: string;
  albumType: AlbumType;
  genre: string;
  featured?: boolean;
  isNewRelease?: boolean;
}

export interface SynthSpec {
  baseFreq: number;
  chordIntervals: number[];
  tempoBpm: number;
  waveform: 'sine' | 'triangle';
  padLevel: number;
  pulseLevel: number;
}

export interface Track {
  id: string;
  albumId: string;
  artistId: string;
  title: string;
  trackNumber: number;
  durationMs: number;
  genre: string;
  mood: TrackMood;
  bpm: number;
  energyLevel: number; // 1 to 10
  isInstrumental: boolean;
  licenseType: string;
  attributionText: string;
  trendingRank?: number;
  synth: SynthSpec;
}

export interface Playlist {
  id: string;
  ownerId: string;
  ownerName: string;
  title: string;
  description: string;
  coverUrl: string;
  isPublic: boolean;
  isSystemRecommended?: boolean;
  trackIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PlayHistoryItem {
  id: string;
  trackId: string;
  playedAt: string;
  contextType: 'album' | 'playlist' | 'search' | 'focus_flow' | 'memory_mix' | 'direct';
  contextId?: string;
}

export interface FocusSessionRecord {
  id: string;
  mode: FocusMode;
  focusDurationMin: number;
  breakDurationMin: number;
  completedCycles: number;
  targetCycles: number;
  targetMood: TrackMood | 'all';
  playlistId?: string;
  startedAt: string;
  endedAt?: string;
  status: 'active' | 'completed' | 'ended_early';
}

export interface UserTag {
  id: string;
  name: string;
  colorHex: string;
}

export interface MemoryNote {
  id: string;
  trackId: string;
  timestampMs: number;
  noteText: string;
  isBookmark: boolean;
  tagIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TimestampBookmark {
  id: string;
  trackId: string;
  timestampMs: number;
  label: string;
  createdAt: string;
}

export interface PaginatedMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

