import type { Track } from '@soundsphere/shared';
import { apiClient, ApiClientError, resolveApiAssetUrl } from './apiClient';
import { getOrCreateTrackAudioUrl } from './audioSynth';

export type AudioEngineStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

export type AudioCallbacks = {
  onTimeUpdate: (currentTimeMs: number, durationMs: number) => void;
  onEnded: () => void;
  onStatusChange: (status: AudioEngineStatus, errorMessage?: string | null) => void;
};

declare global {
  var __soundsphereAudioElement: HTMLAudioElement | undefined;
}

function getOrCreateGlobalAudioElement(): HTMLAudioElement {
  if (globalThis.__soundsphereAudioElement) {
    return globalThis.__soundsphereAudioElement;
  }
  const el = new Audio();
  el.preload = 'metadata';
  globalThis.__soundsphereAudioElement = el;
  return el;
}

class SoundSphereAudioEngine {
  private audio: HTMLAudioElement;
  private callbacks: AudioCallbacks | null = null;
  private loadedTrackId: string | null = null;
  private pendingStartMs = 0;
  private loadGeneration = 0;

  constructor() {
    this.audio = getOrCreateGlobalAudioElement();
    this.attachListeners();
  }

  private attachListeners(): void {
    this.audio.onloadedmetadata = () => {
      if (this.pendingStartMs > 0) {
        const targetSec = Math.max(0, this.pendingStartMs / 1000);
        this.audio.currentTime = targetSec;
        this.pendingStartMs = 0;
      }
      if (this.callbacks) {
        const durationMs = Number.isFinite(this.audio.duration)
          ? Math.round(this.audio.duration * 1000)
          : 0;
        this.callbacks.onTimeUpdate(Math.round(this.audio.currentTime * 1000), durationMs);
      }
    };

    this.audio.ontimeupdate = () => {
      if (!this.callbacks) return;
      const currentMs = Math.round(this.audio.currentTime * 1000);
      const durationMs = Number.isFinite(this.audio.duration)
        ? Math.round(this.audio.duration * 1000)
        : 0;
      this.callbacks.onTimeUpdate(currentMs, durationMs);
    };

    this.audio.onloadstart = () => {
      this.callbacks?.onStatusChange('loading', null);
    };

    this.audio.onwaiting = () => {
      this.callbacks?.onStatusChange('loading', null);
    };

    this.audio.oncanplay = () => {
      if (this.audio.paused) {
        this.callbacks?.onStatusChange('paused', null);
      }
    };

    this.audio.onplaying = () => {
      this.callbacks?.onStatusChange('playing', null);
    };

    this.audio.onpause = () => {
      if (!this.audio.ended) {
        this.callbacks?.onStatusChange('paused', null);
      }
    };

    this.audio.onended = () => {
      this.callbacks?.onEnded();
    };

    this.audio.onerror = () => {
      this.loadedTrackId = null;
      this.callbacks?.onStatusChange(
        'error',
        'Audio file could not be loaded or decoded.'
      );
    };
  }

  public getAudioElement(): HTMLAudioElement {
    return this.audio;
  }

  public bindCallbacks(callbacks: AudioCallbacks): void {
    this.callbacks = callbacks;
  }

  private async resolveAudioSource(track: Track): Promise<string> {
    try {
      const streamInfo = await apiClient.getStreamInfo(track.id);
      return resolveApiAssetUrl(streamInfo.streamUrl);
    } catch (err) {
      // If the server explicitly reports this track is unavailable (404/410/403), surface the error
      if (err instanceof ApiClientError && (err.status === 404 || err.status === 410 || err.status === 403)) {
        throw err;
      }
      // If backend server is offline or running standalone client mode, fall back to deterministic local WAV
      return getOrCreateTrackAudioUrl(track.id, track.durationMs, track.synth);
    }
  }

  public async loadAndPlay(track: Track, startMs = 0, forceReload = false): Promise<void> {
    const generation = ++this.loadGeneration;

    if (this.loadedTrackId !== track.id || forceReload) {
      this.audio.pause();
      this.callbacks?.onStatusChange('loading', null);
      this.pendingStartMs = startMs;

      let src: string;
      try {
        src = await this.resolveAudioSource(track);
      } catch (err) {
        if (generation !== this.loadGeneration) return;
        this.loadedTrackId = null;
        const msg =
          err instanceof Error ? err.message : 'Audio track is currently unavailable.';
        this.callbacks?.onStatusChange('error', msg);
        return;
      }

      if (generation !== this.loadGeneration) return;

      this.audio.src = src;
      this.loadedTrackId = track.id;
      this.audio.load();
    } else if (startMs >= 0) {
      const targetSec = Math.max(0, startMs / 1000);
      if (this.audio.readyState >= 1) {
        this.audio.currentTime = targetSec;
      } else {
        this.pendingStartMs = startMs;
      }
    }

    try {
      await this.audio.play();
      if (generation === this.loadGeneration) {
        this.callbacks?.onStatusChange('playing', null);
      }
    } catch (err) {
      if (generation !== this.loadGeneration) return;
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        this.callbacks?.onStatusChange('paused', null);
      } else {
        this.callbacks?.onStatusChange(
          'error',
          'Playback could not start for this track.'
        );
      }
    }
  }

  public pause(): void {
    this.loadGeneration++;
    this.audio.pause();
    this.callbacks?.onStatusChange('paused', null);
  }

  public seek(ms: number): void {
    const targetSec = Math.max(0, ms / 1000);
    if (Number.isFinite(this.audio.duration) && this.audio.duration > 0) {
      this.audio.currentTime = Math.min(this.audio.duration, targetSec);
    } else if (this.audio.readyState >= 1) {
      this.audio.currentTime = targetSec;
    } else {
      this.pendingStartMs = ms;
    }
  }

  public setVolume(volume01: number, muted: boolean): void {
    this.audio.volume = Math.max(0, Math.min(1, volume01));
    this.audio.muted = muted;
  }

  public resetTrackCache(): void {
    this.loadedTrackId = null;
  }
}

export const audioEngine = new SoundSphereAudioEngine();
