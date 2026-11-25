import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { ARTISTS, ALBUMS, TRACKS, RECOMMENDED_PLAYLISTS } from './fixtures';
import { useCatalogStore } from '@/stores/useCatalogStore';

beforeEach(() => {
  useCatalogStore.setState({
    artists: ARTISTS,
    albums: ALBUMS,
    tracks: TRACKS,
    editorialPlaylists: RECOMMENDED_PLAYLISTS,
    isLoading: false,
    hasLoaded: true,
    error: null,
  });
});

afterEach(() => {
  cleanup();
});

// Mock URL.createObjectURL for jsdom
if (!URL.createObjectURL) {
  URL.createObjectURL = vi.fn(() => 'blob:mock-audio');
}

// Track all created Audio elements to enforce single global HTMLAudioElement invariant
export const createdAudioInstances: MockAudioElement[] = [];

export class MockAudioElement {
  public src = '';
  public preload = 'metadata';
  public currentTime = 0;
  public duration = 214;
  public volume = 1;
  public muted = false;
  public paused = true;
  public ended = false;
  public readyState = 4;

  public onloadedmetadata: (() => void) | null = null;
  public ontimeupdate: (() => void) | null = null;
  public onloadstart: (() => void) | null = null;
  public onwaiting: (() => void) | null = null;
  public oncanplay: (() => void) | null = null;
  public onplaying: (() => void) | null = null;
  public onpause: (() => void) | null = null;
  public onended: (() => void) | null = null;
  public onerror: (() => void) | null = null;

  constructor() {
    createdAudioInstances.push(this);
  }

  load() {
    this.onloadstart?.();
    this.onloadedmetadata?.();
    this.oncanplay?.();
  }

  async play() {
    this.paused = false;
    this.ended = false;
    this.onplaying?.();
  }

  pause() {
    this.paused = true;
    this.onpause?.();
  }

  triggerTimeUpdate(sec: number) {
    this.currentTime = sec;
    this.ontimeupdate?.();
  }

  triggerEnded() {
    this.paused = true;
    this.ended = true;
    this.onended?.();
  }

  triggerError() {
    this.paused = true;
    this.onerror?.();
  }
}

Object.defineProperty(globalThis, 'Audio', {
  writable: true,
  value: MockAudioElement,
});

// Reset fetch mock gracefully so offline fallback works cleanly unless overridden per test
globalThis.fetch = vi.fn(() => Promise.reject(new Error('offline-test-mode'))) as unknown as typeof fetch;
