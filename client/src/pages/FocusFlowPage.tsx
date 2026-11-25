import { useMemo } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  SkipBack,
  RefreshCw,
  Timer,
  Sliders,
  CheckCircle2,
  Bell,
  BellOff,
  BarChart3,
  Clock,
  ListMusic,
} from 'lucide-react';
import type { FocusMode, FocusPhase, TrackMood } from '@soundsphere/shared';
import { TrackRow } from '@/components/cards/TrackRow';
import {
  formatDuration,
  formatRelativeDate,
  formatTimerSeconds,
  formatTotalMinutes,
} from '@/lib/formatters';
import { useCatalogStore } from '@/stores/useCatalogStore';
import { computeFocusAnalytics, useFocusStore } from '@/stores/useFocusStore';
import { useLibraryStore } from '@/stores/useLibraryStore';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { useUiStore } from '@/stores/useUiStore';

const MODE_OPTIONS: { id: FocusMode; label: string; desc: string }[] = [
  { id: 'deep_work', label: 'Deep Work', desc: '50m focus / 10m break' },
  { id: 'study', label: 'Study', desc: '25m focus / 5m break' },
  { id: 'relax', label: 'Relax', desc: '25m acoustic / 5m break' },
  { id: 'break', label: 'Break', desc: '5m reset / break music' },
  { id: 'custom', label: 'Custom', desc: 'Custom intervals and mix' },
];

const QUICK_TIMERS: { label: string; phase: FocusPhase; minutes: number }[] = [
  { label: '25m Focus', phase: 'focus', minutes: 25 },
  { label: '5m Short Break', phase: 'short_break', minutes: 5 },
  { label: '50m Focus', phase: 'focus', minutes: 50 },
  { label: '10m Long Break', phase: 'long_break', minutes: 10 },
];

const MOOD_OPTIONS: { id: TrackMood | 'all'; label: string }[] = [
  { id: 'all', label: 'Any Mood' },
  { id: 'ambient', label: 'Ambient' },
  { id: 'minimal', label: 'Minimal' },
  { id: 'lofi', label: 'Lo-Fi' },
  { id: 'acoustic', label: 'Acoustic' },
  { id: 'electronic', label: 'Electronic' },
];

export function FocusFlowPage() {
  const mode = useFocusStore((s) => s.mode);
  const phase = useFocusStore((s) => s.phase);
  const isRunning = useFocusStore((s) => s.isRunning);
  const remainingSeconds = useFocusStore((s) => s.remainingSeconds);
  const completedCycles = useFocusStore((s) => s.completedCycles);
  const targetCycles = useFocusStore((s) => s.targetCycles);
  const focusDurationMin = useFocusStore((s) => s.focusDurationMin);
  const breakDurationMin = useFocusStore((s) => s.breakDurationMin);
  const longBreakDurationMin = useFocusStore((s) => s.longBreakDurationMin);
  const targetMood = useFocusStore((s) => s.targetMood);
  const instrumentalOnly = useFocusStore((s) => s.instrumentalOnly);
  const energyMax = useFocusStore((s) => s.energyMax);
  const focusPlaylistId = useFocusStore((s) => s.focusPlaylistId);
  const breakPlaylistId = useFocusStore((s) => s.breakPlaylistId);
  const autoPlayMusic = useFocusStore((s) => s.autoPlayMusic);
  const notificationsEnabled = useFocusStore((s) => s.notificationsEnabled);
  const sessions = useFocusStore((s) => s.sessions);

  const applyPreset = useFocusStore((s) => s.applyPreset);
  const applyQuickDuration = useFocusStore((s) => s.applyQuickDuration);
  const updateConfig = useFocusStore((s) => s.updateConfig);
  const startTimer = useFocusStore((s) => s.startTimer);
  const pauseTimer = useFocusStore((s) => s.pauseTimer);
  const resetTimer = useFocusStore((s) => s.resetTimer);
  const skipPhase = useFocusStore((s) => s.skipPhase);
  const regenerateAdaptiveQueue = useFocusStore((s) => s.regenerateAdaptiveQueue);
  const resolvePlaylistTracks = useFocusStore((s) => s.resolvePlaylistTracks);

  const editorialPlaylists = useCatalogStore((s) => s.editorialPlaylists);
  const getTrackById = useCatalogStore((s) => s.getTrackById);
  const getArtistById = useCatalogStore((s) => s.getArtistById);
  const getAlbumById = useCatalogStore((s) => s.getAlbumById);

  const userPlaylists = useLibraryStore((s) => s.userPlaylists);

  const currentTrackId = usePlayerStore((s) => s.currentTrackId);
  const isAudioPlaying = usePlayerStore((s) => s.isPlaying);
  const currentTimeMs = usePlayerStore((s) => s.currentTimeMs);
  const durationMs = usePlayerStore((s) => s.durationMs);
  const playCollection = usePlayerStore((s) => s.playCollection);
  const togglePlayPause = usePlayerStore((s) => s.togglePlayPause);
  const nextTrack = usePlayerStore((s) => s.nextTrack);
  const prevTrack = usePlayerStore((s) => s.prevTrack);

  const showToast = useUiStore((s) => s.showToast);

  const allPlaylists = useMemo(
    () => [...userPlaylists, ...editorialPlaylists],
    [userPlaylists, editorialPlaylists]
  );

  const activePlaylistId = phase === 'focus' ? focusPlaylistId : breakPlaylistId;
  const activePlaylistTrackIds = resolvePlaylistTracks(activePlaylistId);
  const activePlaylistTracks = activePlaylistTrackIds
    .map((id) => getTrackById(id))
    .filter((t): t is NonNullable<typeof t> => Boolean(t));

  const activePlaylistTitle =
    activePlaylistId === 'adaptive'
      ? 'Adaptive FocusFlow Mix'
      : allPlaylists.find((p) => p.id === activePlaylistId)?.title ?? 'Adaptive FocusFlow Mix';

  const totalQueueMs = activePlaylistTracks.reduce((sum, t) => sum + t.durationMs, 0);

  const currentTrack = currentTrackId ? getTrackById(currentTrackId) : undefined;
  const currentArtist = currentTrack ? getArtistById(currentTrack.artistId) : undefined;
  const currentAlbum = currentTrack ? getAlbumById(currentTrack.albumId) : undefined;

  const currentPhaseTotalSeconds =
    (phase === 'focus'
      ? focusDurationMin
      : phase === 'short_break'
        ? breakDurationMin
        : longBreakDurationMin) * 60;

  const timerProgressPct = Math.min(
    100,
    Math.max(
      0,
      ((currentPhaseTotalSeconds - remainingSeconds) / Math.max(1, currentPhaseTotalSeconds)) *
        100
    )
  );

  const analytics = useMemo(() => computeFocusAnalytics(sessions), [sessions]);
  const maxWeeklyMinutes = Math.max(1, ...analytics.weeklyDays.map((d) => d.minutes));

  const handleToggleNotifications = async () => {
    const nextEnabled = !notificationsEnabled;
    updateConfig({ notificationsEnabled: nextEnabled });
    if (
      nextEnabled &&
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'default'
    ) {
      try {
        await Notification.requestPermission();
      } catch {
        // Ignore permission request failure
      }
    }
    showToast(nextEnabled ? 'FocusFlow notifications enabled' : 'FocusFlow notifications muted');
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-8">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-[#1F242D] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
            <Timer className="h-4 w-4" />
            FocusFlow Workspace
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-100">
            Timed Productivity Sessions and Synchronized Audio
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Select a productivity mode, customize session intervals, and automatically transition between focus and break playlists.
          </p>
        </div>

        <button
          type="button"
          onClick={handleToggleNotifications}
          aria-pressed={notificationsEnabled}
          className={`inline-flex items-center gap-2 self-start rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
            notificationsEnabled
              ? 'border-emerald-500/40 bg-[#15201B] text-emerald-400'
              : 'border-[#262B36] bg-[#14171D] text-zinc-400 hover:text-zinc-200'
          }`}
        >
          {notificationsEnabled ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
          <span>{notificationsEnabled ? 'Notifications On' : 'Notifications Off'}</span>
        </button>
      </div>

      {/* 5 Productivity Modes */}
      <section aria-label="Productivity modes">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {MODE_OPTIONS.map((opt) => {
            const active = mode === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => applyPreset(opt.id)}
                className={`rounded-md border p-3.5 text-left transition-colors ${
                  active
                    ? 'border-emerald-500/60 bg-[#15201B]'
                    : 'border-[#1F242D] bg-[#14171D] hover:border-[#2E3542]'
                }`}
              >
                <div className="text-sm font-semibold text-zinc-100">{opt.label}</div>
                <div className="mt-1 text-xs text-zinc-400">{opt.desc}</div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Main Grid: Large Readable Timer + Synchronized Player & Customization */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Timer + Synchronized Now Playing */}
        <div className="lg:col-span-7 space-y-6">
          <div className="rounded-lg border border-[#1F242D] bg-[#14171D] p-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span
                data-testid="focus-phase-badge"
                className="rounded border border-emerald-500/35 bg-[#121D19] px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-400"
              >
                {phase === 'focus'
                  ? 'Focus Session'
                  : phase === 'short_break'
                    ? 'Short Break'
                    : 'Long Break'}
              </span>
              <span className="text-xs font-medium tabular-nums text-zinc-400">
                Cycle {Math.min(completedCycles + 1, targetCycles)} of {targetCycles}
              </span>
            </div>

            <div>
              <div
                data-testid="focus-timer-display"
                className="text-6xl font-bold tracking-tight tabular-nums text-zinc-100 sm:text-7xl"
              >
                {formatTimerSeconds(remainingSeconds)}
              </div>
              <div className="mt-4 h-2 w-full overflow-hidden rounded bg-[#0A0B0D]">
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{ width: `${timerProgressPct}%` }}
                />
              </div>
            </div>

            {/* Quick Pomodoro Presets */}
            <div className="flex flex-wrap items-center gap-1.5">
              {QUICK_TIMERS.map((preset) => {
                const isSelected =
                  phase === preset.phase &&
                  ((preset.phase === 'focus' && focusDurationMin === preset.minutes) ||
                    (preset.phase === 'short_break' && breakDurationMin === preset.minutes) ||
                    (preset.phase === 'long_break' && longBreakDurationMin === preset.minutes));
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => applyQuickDuration(preset.phase, preset.minutes)}
                    className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                      isSelected
                        ? 'border-emerald-500/50 bg-[#17231E] text-emerald-400'
                        : 'border-[#262B36] bg-[#0E1014] text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            {/* Primary Session Controls */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              {isRunning ? (
                <button
                  type="button"
                  onClick={pauseTimer}
                  className="inline-flex items-center gap-2 rounded-md bg-emerald-500 px-4 py-2.5 text-xs font-semibold text-zinc-950 hover:bg-emerald-400"
                >
                  <Pause className="h-4 w-4 fill-current" />
                  Pause Session
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    startTimer();
                    showToast(
                      phase === 'focus'
                        ? 'Focus session started'
                        : 'Break timer started'
                    );
                  }}
                  className="inline-flex items-center gap-2 rounded-md bg-emerald-500 px-4 py-2.5 text-xs font-semibold text-zinc-950 hover:bg-emerald-400"
                >
                  <Play className="h-4 w-4 fill-current" />
                  {phase === 'focus' ? 'Start Focus' : 'Start Break'}
                </button>
              )}

              <button
                type="button"
                onClick={resetTimer}
                className="inline-flex items-center gap-1.5 rounded-md border border-[#262B36] bg-[#0E1014] px-3.5 py-2.5 text-xs font-medium text-zinc-300 hover:border-[#2E3542]"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </button>

              <button
                type="button"
                onClick={skipPhase}
                className="inline-flex items-center gap-1.5 rounded-md border border-[#262B36] bg-[#0E1014] px-3.5 py-2.5 text-xs font-medium text-zinc-300 hover:border-[#2E3542]"
              >
                <SkipForward className="h-3.5 w-3.5" />
                {phase === 'focus' ? 'Complete & Switch to Break' : 'Switch to Focus'}
              </button>
            </div>
          </div>

          {/* Synchronized Music Strip */}
          <div className="rounded-lg border border-[#1F242D] bg-[#14171D] p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ListMusic className="h-4 w-4 text-emerald-400" />
                <h2 className="text-sm font-semibold text-zinc-100">
                  Synchronized Audio ({activePlaylistTitle})
                </h2>
              </div>
              <button
                type="button"
                onClick={() => playCollection(activePlaylistTrackIds, 0, 'focus_flow', activePlaylistId)}
                className="rounded-md border border-[#262B36] bg-[#0E1014] px-2.5 py-1 text-xs font-medium text-emerald-400 hover:border-emerald-500/40"
              >
                Load Playlist
              </button>
            </div>

            {currentTrack && currentAlbum ? (
              <div className="flex flex-col gap-4 rounded-md border border-[#1F242D] bg-[#0E1014] p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={currentAlbum.coverUrl}
                    alt={currentAlbum.title}
                    className="h-12 w-12 shrink-0 rounded border border-[#262B36] object-cover"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-100">
                      {currentTrack.title}
                    </p>
                    <p className="truncate text-xs text-zinc-400">
                      {currentArtist?.name} | {formatDuration(currentTimeMs)} /{' '}
                      {formatDuration(durationMs || currentTrack.durationMs)}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={prevTrack}
                    aria-label="FocusFlow previous track"
                    className="flex h-8 w-8 items-center justify-center rounded-md border border-[#262B36] bg-[#14171D] text-zinc-200 hover:border-[#2E3542]"
                  >
                    <SkipBack className="h-3.5 w-3.5 fill-current" />
                  </button>
                  <button
                    type="button"
                    onClick={togglePlayPause}
                    aria-label={isAudioPlaying ? 'FocusFlow pause audio' : 'FocusFlow play audio'}
                    className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-500 text-zinc-950 hover:bg-emerald-400"
                  >
                    {isAudioPlaying ? (
                      <Pause className="h-3.5 w-3.5 fill-current" />
                    ) : (
                      <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={nextTrack}
                    aria-label="FocusFlow skip track"
                    className="flex h-8 w-8 items-center justify-center rounded-md border border-[#262B36] bg-[#14171D] text-zinc-200 hover:border-[#2E3542]"
                  >
                    <SkipForward className="h-3.5 w-3.5 fill-current" />
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-zinc-500">Select a track or press Start Focus to begin playback.</p>
            )}
          </div>
        </div>

        {/* Customization & Playlist Pairing */}
        <div className="lg:col-span-5 rounded-lg border border-[#1F242D] bg-[#14171D] p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Sliders className="h-4 w-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-zinc-100">Session Customization</h2>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <div>
              <label htmlFor="ff-focus-min" className="block text-[11px] font-medium text-zinc-400">
                Focus (min)
              </label>
              <input
                id="ff-focus-min"
                type="number"
                min={1}
                max={120}
                value={focusDurationMin}
                onChange={(e) =>
                  updateConfig({
                    mode: 'custom',
                    focusDurationMin: Math.max(1, Math.min(120, Number(e.target.value) || 25)),
                  })
                }
                className="mt-1 w-full rounded-md border border-[#262B36] bg-[#0A0B0D] px-2.5 py-1.5 text-sm tabular-nums text-zinc-100 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="ff-break-min" className="block text-[11px] font-medium text-zinc-400">
                Short Break
              </label>
              <input
                id="ff-break-min"
                type="number"
                min={1}
                max={45}
                value={breakDurationMin}
                onChange={(e) =>
                  updateConfig({
                    mode: 'custom',
                    breakDurationMin: Math.max(1, Math.min(45, Number(e.target.value) || 5)),
                  })
                }
                className="mt-1 w-full rounded-md border border-[#262B36] bg-[#0A0B0D] px-2.5 py-1.5 text-sm tabular-nums text-zinc-100 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="ff-long-break-min" className="block text-[11px] font-medium text-zinc-400">
                Long Break
              </label>
              <input
                id="ff-long-break-min"
                type="number"
                min={5}
                max={60}
                value={longBreakDurationMin}
                onChange={(e) =>
                  updateConfig({
                    mode: 'custom',
                    longBreakDurationMin: Math.max(5, Math.min(60, Number(e.target.value) || 10)),
                  })
                }
                className="mt-1 w-full rounded-md border border-[#262B36] bg-[#0A0B0D] px-2.5 py-1.5 text-sm tabular-nums text-zinc-100 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <div>
              <label htmlFor="ff-focus-playlist" className="block text-[11px] font-medium text-zinc-400">
                Focus Playlist
              </label>
              <select
                id="ff-focus-playlist"
                value={focusPlaylistId}
                onChange={(e) => updateConfig({ focusPlaylistId: e.target.value })}
                className="mt-1 w-full rounded-md border border-[#262B36] bg-[#0A0B0D] px-3 py-2 text-xs text-zinc-100 focus:border-emerald-500 focus:outline-none"
              >
                <option value="adaptive">Adaptive FocusFlow Mix</option>
                {allPlaylists.map((pl) => (
                  <option key={pl.id} value={pl.id}>
                    {pl.title} ({pl.trackIds.length} tracks)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="ff-break-playlist" className="block text-[11px] font-medium text-zinc-400">
                Break Playlist (auto-switches when focus ends)
              </label>
              <select
                id="ff-break-playlist"
                value={breakPlaylistId}
                onChange={(e) => updateConfig({ breakPlaylistId: e.target.value })}
                className="mt-1 w-full rounded-md border border-[#262B36] bg-[#0A0B0D] px-3 py-2 text-xs text-zinc-100 focus:border-emerald-500 focus:outline-none"
              >
                {allPlaylists.map((pl) => (
                  <option key={pl.id} value={pl.id}>
                    {pl.title} ({pl.trackIds.length} tracks)
                  </option>
                ))}
                <option value="adaptive">Adaptive FocusFlow Mix</option>
              </select>
            </div>
          </div>

          {/* Adaptive Sound Controls */}
          <div className="border-t border-[#1F242D] pt-3 space-y-3">
            <div>
              <span className="block text-[11px] font-medium text-zinc-400">Adaptive Mood Filter</span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {MOOD_OPTIONS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => updateConfig({ targetMood: m.id })}
                    className={`rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${
                      targetMood === m.id
                        ? 'border-emerald-500/50 bg-[#17231E] text-emerald-400'
                        : 'border-[#262B36] bg-[#0E1014] text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[11px] font-medium text-zinc-400">
                <span>Max Energy Intensity</span>
                <span className="tabular-nums text-zinc-200">{energyMax} / 10</span>
              </div>
              <input
                type="range"
                min={2}
                max={10}
                value={energyMax}
                onChange={(e) => updateConfig({ energyMax: Number(e.target.value) })}
                className="ss-range mt-1.5 w-full"
                style={{
                  background: `linear-gradient(to right, #10B981 ${((energyMax - 2) / 8) * 100}%, #262B36 ${((energyMax - 2) / 8) * 100}%)`,
                }}
              />
            </div>

            <div className="space-y-2 pt-1">
              <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={instrumentalOnly}
                  onChange={(e) => updateConfig({ instrumentalOnly: e.target.checked })}
                  className="h-4 w-4 rounded border-[#262B36] bg-[#0A0B0D] accent-emerald-500"
                />
                Instrumental tracks only in adaptive mix
              </label>

              <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoPlayMusic}
                  onChange={(e) => updateConfig({ autoPlayMusic: e.target.checked })}
                  className="h-4 w-4 rounded border-[#262B36] bg-[#0A0B0D] accent-emerald-500"
                />
                Auto-play and switch playlists with timer phases
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Productivity Summary & Weekly History (Real Recorded Sessions Only) */}
      <section aria-labelledby="focus-analytics-heading" className="space-y-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-emerald-400" />
          <h2 id="focus-analytics-heading" className="text-lg font-semibold text-zinc-100">
            Session Tracking and Weekly Summary
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-md border border-[#1F242D] bg-[#14171D] p-4">
            <div className="text-xs text-zinc-400">Total Focus Minutes</div>
            <div data-testid="stat-total-minutes" className="mt-1.5 text-2xl font-semibold tabular-nums text-zinc-100">
              {analytics.totalFocusMinutes}
            </div>
          </div>
          <div className="rounded-md border border-[#1F242D] bg-[#14171D] p-4">
            <div className="text-xs text-zinc-400">Completed Sessions</div>
            <div data-testid="stat-completed-sessions" className="mt-1.5 text-2xl font-semibold tabular-nums text-zinc-100">
              {analytics.completedSessions}
            </div>
          </div>
          <div className="rounded-md border border-[#1F242D] bg-[#14171D] p-4">
            <div className="text-xs text-zinc-400">Today Focus Minutes</div>
            <div className="mt-1.5 text-2xl font-semibold tabular-nums text-emerald-400">
              {analytics.todayMinutes}
            </div>
          </div>
          <div className="rounded-md border border-[#1F242D] bg-[#14171D] p-4">
            <div className="text-xs text-zinc-400">Last 7 Days Total</div>
            <div className="mt-1.5 text-2xl font-semibold tabular-nums text-zinc-100">
              {analytics.weeklyMinutes} min
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* 7-Day Weekly Breakdown */}
          <div className="lg:col-span-6 rounded-md border border-[#1F242D] bg-[#14171D] p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-100">Weekly Productivity Summary</h3>
              <span className="text-xs text-zinc-500">Rolling 7 days</span>
            </div>

            <div className="grid grid-cols-7 gap-2 items-end h-36 pt-4">
              {analytics.weeklyDays.map((day) => {
                const heightPct = day.minutes > 0 ? Math.max(12, (day.minutes / maxWeeklyMinutes) * 100) : 4;
                return (
                  <div key={day.dateKey} className="flex h-full flex-col items-center justify-end gap-1.5">
                    <span className="text-[10px] tabular-nums text-zinc-400">
                      {day.minutes > 0 ? `${day.minutes}m` : '0'}
                    </span>
                    <div className="flex w-full flex-1 items-end">
                      <div
                        className={`w-full rounded-sm ${
                          day.minutes > 0 ? 'bg-emerald-500' : 'bg-[#222732]'
                        }`}
                        style={{ height: `${heightPct}%` }}
                        title={`${day.label}: ${day.minutes} focus minutes (${day.sessionsCount} sessions)`}
                      />
                    </div>
                    <span className="text-[11px] font-medium text-zinc-400">{day.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Daily Focus History */}
          <div className="lg:col-span-6 rounded-md border border-[#1F242D] bg-[#14171D] p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-100">Daily Focus History</h3>
              <Clock className="h-4 w-4 text-zinc-500" />
            </div>

            {analytics.dailyHistory.length === 0 ? (
              <div className="rounded border border-[#1F242D] bg-[#0E1014] p-6 text-center text-xs text-zinc-400">
                No completed sessions recorded yet. Start and finish a focus block to track daily minutes here.
              </div>
            ) : (
              <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                {analytics.dailyHistory.map((day) => (
                  <div
                    key={day.dateKey}
                    className="flex items-center justify-between rounded border border-[#1F242D] bg-[#0E1014] px-3 py-2 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      <span className="font-medium text-zinc-100">{day.label}</span>
                    </div>
                    <div className="flex items-center gap-3 tabular-nums text-zinc-400">
                      <span>{day.sessionsCount} sessions</span>
                      <span className="font-semibold text-emerald-400">{day.minutes} min</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Active Phase Track Queue */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">
              {activePlaylistTitle} ({activePlaylistTracks.length} tracks | {formatTotalMinutes(totalQueueMs)})
            </h2>
            <p className="text-xs text-zinc-400">
              {phase === 'focus'
                ? 'Active playlist for the current focus interval.'
                : 'Active playlist for the current break interval.'}
            </p>
          </div>
          {activePlaylistId === 'adaptive' && (
            <button
              type="button"
              onClick={() => {
                regenerateAdaptiveQueue();
                showToast('Adaptive mix refreshed');
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-[#262B36] bg-[#14171D] px-3 py-1.5 text-xs font-medium text-zinc-300 hover:border-[#2E3542]"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh Adaptive Mix
            </button>
          )}
        </div>

        <div className="rounded-md border border-[#1F242D] bg-[#0E1014] p-2 space-y-0.5">
          {activePlaylistTracks.map((track, idx) => (
            <TrackRow
              key={track.id}
              track={track}
              index={idx}
              onPlay={() => playCollection(activePlaylistTrackIds, idx, 'focus_flow', activePlaylistId)}
            />
          ))}
        </div>
      </section>

      {/* Recent Completed Sessions */}
      {sessions.length > 0 && (
        <section>
          <h2 className="mb-3 text-base font-semibold text-zinc-100">Recent Completed Blocks</h2>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {sessions.slice(0, 6).map((sess) => (
              <div
                key={sess.id}
                className="flex items-center justify-between rounded-md border border-[#1F242D] bg-[#14171D] px-3.5 py-2.5"
              >
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <div>
                    <p className="text-xs font-medium capitalize text-zinc-100">
                      {sess.mode.replace('_', ' ')} ({sess.focusDurationMin} min)
                    </p>
                    <p className="text-[11px] text-zinc-400">
                      {formatRelativeDate(sess.endedAt ?? sess.startedAt)}
                    </p>
                  </div>
                </div>
                <span className="text-[11px] uppercase text-zinc-500">{sess.targetMood}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
