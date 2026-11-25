import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  FocusMode,
  FocusPhase,
  FocusSessionRecord,
  Playlist,
  Track,
  TrackMood,
} from '@soundsphere/shared';
import { apiClient } from '@/lib/apiClient';
import { useCatalogStore } from './useCatalogStore';
import { useAuthStore } from './useAuthStore';
import { usePlayerStore } from './usePlayerStore';
import { useLibraryStore } from './useLibraryStore';
import { useUiStore } from './useUiStore';

export interface FocusConfig {
  mode: FocusMode;
  focusDurationMin: number;
  breakDurationMin: number;
  longBreakDurationMin: number;
  targetCycles: number;
  targetMood: TrackMood | 'all';
  instrumentalOnly: boolean;
  energyMax: number;
  focusPlaylistId: string; // 'adaptive' or playlist ID
  breakPlaylistId: string; // playlist ID or 'adaptive'
  autoPlayMusic: boolean;
  notificationsEnabled: boolean;
}

interface FocusState extends FocusConfig {
  phase: FocusPhase;
  isRunning: boolean;
  remainingSeconds: number;
  phaseEndAtMs: number | null;
  phaseStartedAtMs: number | null;
  completedCycles: number;
  adaptiveTrackIds: string[];
  sessions: FocusSessionRecord[];
  isLoadingSessions: boolean;

  hydrateSessions: () => Promise<void>;
  applyPreset: (mode: FocusMode) => void;
  applyQuickDuration: (targetPhase: FocusPhase, minutes: number) => void;
  updateConfig: (partial: Partial<FocusConfig>) => void;
  startTimer: () => void;
  pauseTimer: () => void;
  resetTimer: () => void;
  skipPhase: () => void;
  tick: () => void;
  regenerateAdaptiveQueue: () => string[];
  resolvePlaylistTracks: (playlistId: string) => string[];
  clearSessions: () => void;
}

const PRESETS: Record<FocusMode, Omit<FocusConfig, 'mode' | 'autoPlayMusic' | 'notificationsEnabled'>> = {
  deep_work: {
    focusDurationMin: 50,
    breakDurationMin: 10,
    longBreakDurationMin: 15,
    targetCycles: 3,
    targetMood: 'ambient',
    instrumentalOnly: true,
    energyMax: 4,
    focusPlaylistId: 'pl-deep-work',
    breakPlaylistId: 'pl-acoustic-morning',
  },
  study: {
    focusDurationMin: 25,
    breakDurationMin: 5,
    longBreakDurationMin: 10,
    targetCycles: 4,
    targetMood: 'minimal',
    instrumentalOnly: true,
    energyMax: 5,
    focusPlaylistId: 'pl-low-light',
    breakPlaylistId: 'pl-acoustic-morning',
  },
  relax: {
    focusDurationMin: 25,
    breakDurationMin: 5,
    longBreakDurationMin: 10,
    targetCycles: 3,
    targetMood: 'acoustic',
    instrumentalOnly: false,
    energyMax: 5,
    focusPlaylistId: 'pl-acoustic-morning',
    breakPlaylistId: 'pl-deep-work',
  },
  break: {
    focusDurationMin: 25,
    breakDurationMin: 5,
    longBreakDurationMin: 10,
    targetCycles: 4,
    targetMood: 'lofi',
    instrumentalOnly: true,
    energyMax: 4,
    focusPlaylistId: 'pl-deep-work',
    breakPlaylistId: 'pl-acoustic-morning',
  },
  custom: {
    focusDurationMin: 25,
    breakDurationMin: 5,
    longBreakDurationMin: 10,
    targetCycles: 4,
    targetMood: 'all',
    instrumentalOnly: true,
    energyMax: 6,
    focusPlaylistId: 'adaptive',
    breakPlaylistId: 'pl-acoustic-morning',
  },
};

function selectAdaptiveTracks(config: Pick<FocusConfig, 'instrumentalOnly' | 'energyMax' | 'targetMood' | 'focusDurationMin'>): Track[] {
  const allTracks = useCatalogStore.getState().tracks;
  let candidates = allTracks.filter((t) => {
    if (config.instrumentalOnly && !t.isInstrumental) return false;
    if (t.energyLevel > config.energyMax) return false;
    if (config.targetMood !== 'all' && t.mood !== config.targetMood) return false;
    return true;
  });

  if (candidates.length < 4) {
    candidates = allTracks.filter((t) => (config.instrumentalOnly ? t.isInstrumental : true));
  }

  const ordered = [...candidates].sort((a, b) => a.energyLevel - b.energyLevel || a.bpm - b.bpm);
  const targetMs = config.focusDurationMin * 60 * 1000;
  const picked: Track[] = [];
  let accumulatedMs = 0;

  for (const track of ordered) {
    picked.push(track);
    accumulatedMs += track.durationMs;
    if (accumulatedMs >= targetMs && picked.length >= 3) break;
  }

  return picked;
}

function getAllPlaylists(): Playlist[] {
  const userPlaylists = useLibraryStore.getState().userPlaylists;
  const editorialPlaylists = useCatalogStore.getState().editorialPlaylists;
  return [...userPlaylists, ...editorialPlaylists];
}

function sendCompletionAlert(title: string, body: string, enabled: boolean): void {
  useUiStore.getState().showToast(`${title}: ${body}`);
  if (!enabled) return;

  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, { body });
    } catch {
      // Ignore notification errors in restricted browser contexts
    }
  }
}

export const useFocusStore = create<FocusState>()(
  persist(
    (set, get) => {
      const resolveTracksForId = (playlistId: string): string[] => {
        if (playlistId === 'adaptive') {
          return get().adaptiveTrackIds;
        }
        const match = getAllPlaylists().find((p) => p.id === playlistId);
        if (match && match.trackIds.length > 0) {
          return match.trackIds;
        }
        return get().adaptiveTrackIds;
      };

      const startMusicForPhase = (phase: FocusPhase) => {
        const s = get();
        if (!s.autoPlayMusic) return;
        const playlistId = phase === 'focus' ? s.focusPlaylistId : s.breakPlaylistId;
        const trackIds = resolveTracksForId(playlistId);
        if (trackIds.length === 0) return;

        const player = usePlayerStore.getState();
        const alreadyPlayingFromSameList =
          player.isPlaying &&
          player.currentTrackId &&
          trackIds.includes(player.currentTrackId) &&
          player.queueTrackIds.join(',') === trackIds.join(',');

        if (!alreadyPlayingFromSameList) {
          player.playCollection(trackIds, 0, 'focus_flow', playlistId);
        }
      };

      const completeActivePhase = (autoTriggered: boolean) => {
        const s = get();
        const nowMs = Date.now();
        const nowIso = new Date(nowMs).toISOString();

        if (s.phase === 'focus') {
          const nextCompleted = s.completedCycles + 1;
          const isLong = nextCompleted % Math.max(1, s.targetCycles) === 0;
          const nextPhase: FocusPhase = isLong ? 'long_break' : 'short_break';
          const nextSec = (isLong ? s.longBreakDurationMin : s.breakDurationMin) * 60;

          const elapsedMin = s.phaseStartedAtMs
            ? Math.max(1, Math.min(s.focusDurationMin, Math.round((nowMs - s.phaseStartedAtMs) / 60000)))
            : s.focusDurationMin;
          const loggedMinutes = autoTriggered ? s.focusDurationMin : elapsedMin;

          const payload: Omit<FocusSessionRecord, 'id'> = {
            mode: s.mode,
            focusDurationMin: loggedMinutes,
            breakDurationMin: isLong ? s.longBreakDurationMin : s.breakDurationMin,
            completedCycles: 1,
            targetCycles: s.targetCycles,
            targetMood: s.targetMood,
            playlistId: s.focusPlaylistId,
            startedAt: s.phaseStartedAtMs
              ? new Date(s.phaseStartedAtMs).toISOString()
              : new Date(nowMs - loggedMinutes * 60000).toISOString(),
            endedAt: nowIso,
            status: 'completed',
          };

          const optimisticRecord: FocusSessionRecord = {
            id: `foc-${crypto.randomUUID().slice(0, 8)}`,
            ...payload,
          };

          set({
            phase: nextPhase,
            completedCycles: nextCompleted,
            remainingSeconds: nextSec,
            isRunning: false,
            phaseEndAtMs: null,
            phaseStartedAtMs: null,
            sessions: [optimisticRecord, ...s.sessions].slice(0, 100),
          });

          if (useAuthStore.getState().accessToken) {
            void apiClient
              .recordFocusSession(payload)
              .then((saved) => {
                set((state) => ({
                  sessions: state.sessions.map((item) =>
                    item.id === optimisticRecord.id ? saved : item
                  ),
                }));
              })
              .catch(() => {
                // Retained locally if transient error
              });
          }

          // Automatically switch to the break playlist when focus ends
          startMusicForPhase(nextPhase);
          sendCompletionAlert(
            'Focus session complete',
            `Switched to ${isLong ? 'long' : 'short'} break playlist.`,
            s.notificationsEnabled
          );
        } else {
          const nextSec = s.focusDurationMin * 60;
          set({
            phase: 'focus',
            remainingSeconds: nextSec,
            isRunning: false,
            phaseEndAtMs: null,
            phaseStartedAtMs: null,
          });
          startMusicForPhase('focus');
          sendCompletionAlert(
            'Break complete',
            'Ready for next focus interval.',
            s.notificationsEnabled
          );
        }
      };

      return {
        mode: 'study',
        ...PRESETS.study,
        autoPlayMusic: true,
        notificationsEnabled: true,
        phase: 'focus',
        isRunning: false,
        remainingSeconds: PRESETS.study.focusDurationMin * 60,
        phaseEndAtMs: null,
        phaseStartedAtMs: null,
        completedCycles: 0,
        adaptiveTrackIds: selectAdaptiveTracks(PRESETS.study).map((t) => t.id),
        sessions: [],
        isLoadingSessions: false,

        hydrateSessions: async () => {
          if (!useAuthStore.getState().accessToken) {
            set({ sessions: [], isLoadingSessions: false });
            return;
          }
          set({ isLoadingSessions: true });
          try {
            const serverSessions = await apiClient.getFocusSessions(100);
            set({ sessions: serverSessions, isLoadingSessions: false });
          } catch {
            set({ isLoadingSessions: false });
          }
        },

        applyPreset: (mode) => {
          const preset = PRESETS[mode];
          const s = get();
          const nextPhase: FocusPhase = mode === 'break' ? 'short_break' : 'focus';
          const durationSec =
            nextPhase === 'short_break'
              ? preset.breakDurationMin * 60
              : preset.focusDurationMin * 60;

          const tracks = selectAdaptiveTracks({
            instrumentalOnly: preset.instrumentalOnly,
            energyMax: preset.energyMax,
            targetMood: preset.targetMood,
            focusDurationMin: preset.focusDurationMin,
          });

          set({
            mode,
            ...preset,
            autoPlayMusic: s.autoPlayMusic,
            notificationsEnabled: s.notificationsEnabled,
            phase: nextPhase,
            isRunning: false,
            remainingSeconds: durationSec,
            phaseEndAtMs: null,
            phaseStartedAtMs: null,
            completedCycles: 0,
            adaptiveTrackIds: tracks.map((t) => t.id),
          });
        },

        applyQuickDuration: (targetPhase, minutes) => {
          const s = get();
          const safeMinutes = Math.max(1, Math.min(120, Math.round(minutes)));
          const updates: Partial<FocusConfig> =
            targetPhase === 'focus'
              ? { focusDurationMin: safeMinutes }
              : targetPhase === 'short_break'
                ? { breakDurationMin: safeMinutes }
                : { longBreakDurationMin: safeMinutes };

          const nextFocusMin = updates.focusDurationMin ?? s.focusDurationMin;
          const tracks = selectAdaptiveTracks({
            instrumentalOnly: s.instrumentalOnly,
            energyMax: s.energyMax,
            targetMood: s.targetMood,
            focusDurationMin: nextFocusMin,
          });

          set({
            ...updates,
            phase: targetPhase,
            isRunning: false,
            phaseEndAtMs: null,
            phaseStartedAtMs: null,
            remainingSeconds: safeMinutes * 60,
            adaptiveTrackIds: tracks.map((t) => t.id),
          });
        },

        updateConfig: (partial) => {
          set((state) => {
            const nextConfig: FocusConfig = {
              mode: partial.mode ?? state.mode,
              focusDurationMin: partial.focusDurationMin ?? state.focusDurationMin,
              breakDurationMin: partial.breakDurationMin ?? state.breakDurationMin,
              longBreakDurationMin: partial.longBreakDurationMin ?? state.longBreakDurationMin,
              targetCycles: partial.targetCycles ?? state.targetCycles,
              targetMood: partial.targetMood ?? state.targetMood,
              instrumentalOnly: partial.instrumentalOnly ?? state.instrumentalOnly,
              energyMax: partial.energyMax ?? state.energyMax,
              focusPlaylistId: partial.focusPlaylistId ?? state.focusPlaylistId,
              breakPlaylistId: partial.breakPlaylistId ?? state.breakPlaylistId,
              autoPlayMusic: partial.autoPlayMusic ?? state.autoPlayMusic,
              notificationsEnabled: partial.notificationsEnabled ?? state.notificationsEnabled,
            };

            const tracks = selectAdaptiveTracks(nextConfig);

            let nextRemaining = state.remainingSeconds;
            if (!state.isRunning) {
              if (state.phase === 'focus' && partial.focusDurationMin !== undefined) {
                nextRemaining = nextConfig.focusDurationMin * 60;
              } else if (state.phase === 'short_break' && partial.breakDurationMin !== undefined) {
                nextRemaining = nextConfig.breakDurationMin * 60;
              } else if (state.phase === 'long_break' && partial.longBreakDurationMin !== undefined) {
                nextRemaining = nextConfig.longBreakDurationMin * 60;
              }
            }

            return {
              ...nextConfig,
              remainingSeconds: nextRemaining,
              adaptiveTrackIds: tracks.map((t) => t.id),
            };
          });
        },

        startTimer: () => {
          const s = get();
          if (s.isRunning) return;
          const now = Date.now();
          const safeRemaining = Math.max(1, s.remainingSeconds);
          set({
            isRunning: true,
            phaseEndAtMs: now + safeRemaining * 1000,
            phaseStartedAtMs: s.phaseStartedAtMs ?? now,
          });
          startMusicForPhase(s.phase);
        },

        pauseTimer: () => {
          const s = get();
          if (!s.isRunning) return;
          const exactRemaining =
            s.phaseEndAtMs !== null
              ? Math.max(0, Math.ceil((s.phaseEndAtMs - Date.now()) / 1000))
              : s.remainingSeconds;
          set({
            isRunning: false,
            remainingSeconds: exactRemaining,
            phaseEndAtMs: null,
          });
        },

        resetTimer: () => {
          const s = get();
          const durationMin =
            s.phase === 'focus'
              ? s.focusDurationMin
              : s.phase === 'short_break'
                ? s.breakDurationMin
                : s.longBreakDurationMin;
          set({
            isRunning: false,
            phaseEndAtMs: null,
            phaseStartedAtMs: null,
            remainingSeconds: durationMin * 60,
          });
        },

        skipPhase: () => {
          completeActivePhase(false);
        },

        tick: () => {
          const s = get();
          if (!s.isRunning || s.phaseEndAtMs === null) return;
          const now = Date.now();
          const nextRemaining = Math.max(0, Math.ceil((s.phaseEndAtMs - now) / 1000));

          if (nextRemaining <= 0) {
            completeActivePhase(true);
          } else if (nextRemaining !== s.remainingSeconds) {
            set({ remainingSeconds: nextRemaining });
          }
        },

        regenerateAdaptiveQueue: () => {
          const s = get();
          const tracks = selectAdaptiveTracks(s);
          const ids = tracks.map((t) => t.id);
          set({ adaptiveTrackIds: ids });
          return ids;
        },

        resolvePlaylistTracks: (playlistId) => resolveTracksForId(playlistId),

        clearSessions: () => set({ sessions: [] }),
      };
    },
    {
      name: 'soundsphere-focus-v2',
      partialize: (state) => ({
        mode: state.mode,
        focusDurationMin: state.focusDurationMin,
        breakDurationMin: state.breakDurationMin,
        longBreakDurationMin: state.longBreakDurationMin,
        targetCycles: state.targetCycles,
        targetMood: state.targetMood,
        instrumentalOnly: state.instrumentalOnly,
        energyMax: state.energyMax,
        focusPlaylistId: state.focusPlaylistId,
        breakPlaylistId: state.breakPlaylistId,
        autoPlayMusic: state.autoPlayMusic,
        notificationsEnabled: state.notificationsEnabled,
        phase: state.phase,
        isRunning: state.isRunning,
        remainingSeconds: state.remainingSeconds,
        phaseEndAtMs: state.phaseEndAtMs,
        phaseStartedAtMs: state.phaseStartedAtMs,
        completedCycles: state.completedCycles,
        adaptiveTrackIds: state.adaptiveTrackIds,
        sessions: state.sessions,
      }),
    }
  )
);

export interface DailyFocusEntry {
  dateKey: string;
  label: string;
  minutes: number;
  sessionsCount: number;
}

export interface FocusAnalytics {
  totalFocusMinutes: number;
  completedSessions: number;
  todayMinutes: number;
  weeklyMinutes: number;
  weeklyDays: DailyFocusEntry[];
  dailyHistory: DailyFocusEntry[];
}

function toLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function computeFocusAnalytics(
  sessions: FocusSessionRecord[],
  now: Date = new Date()
): FocusAnalytics {
  const completed = sessions.filter((s) => s.status === 'completed');
  const byDay = new Map<string, { minutes: number; count: number }>();

  let totalFocusMinutes = 0;
  for (const sess of completed) {
    totalFocusMinutes += sess.focusDurationMin;
    const d = new Date(sess.endedAt ?? sess.startedAt);
    if (Number.isNaN(d.getTime())) continue;
    const key = toLocalDateKey(d);
    const prev = byDay.get(key) ?? { minutes: 0, count: 0 };
    byDay.set(key, {
      minutes: prev.minutes + sess.focusDurationMin,
      count: prev.count + 1,
    });
  }

  const todayKey = toLocalDateKey(now);
  const todayMinutes = byDay.get(todayKey)?.minutes ?? 0;

  // Build 7-day rolling weekly summary ending today
  const weeklyDays: DailyFocusEntry[] = [];
  let weeklyMinutes = 0;
  for (let offset = 6; offset >= 0; offset--) {
    const d = new Date(now);
    d.setDate(now.getDate() - offset);
    const key = toLocalDateKey(d);
    const bucket = byDay.get(key) ?? { minutes: 0, count: 0 };
    weeklyMinutes += bucket.minutes;
    weeklyDays.push({
      dateKey: key,
      label: d.toLocaleDateString('en-US', { weekday: 'short' }),
      minutes: bucket.minutes,
      sessionsCount: bucket.count,
    });
  }

  const dailyHistory: DailyFocusEntry[] = Array.from(byDay.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([dateKey, bucket]) => {
      const [y, m, d] = dateKey.split('-').map(Number);
      const parsed = new Date(y, m - 1, d);
      return {
        dateKey,
        label:
          dateKey === todayKey
            ? 'Today'
            : parsed.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              }),
        minutes: bucket.minutes,
        sessionsCount: bucket.count,
      };
    });

  return {
    totalFocusMinutes,
    completedSessions: completed.length,
    todayMinutes,
    weeklyMinutes,
    weeklyDays,
    dailyHistory,
  };
}
