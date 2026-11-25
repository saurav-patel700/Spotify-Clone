import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RECOMMENDED_PLAYLISTS } from './fixtures';
import { useFocusStore, computeFocusAnalytics } from '@/stores/useFocusStore';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { FocusFlowPage } from '@/pages/FocusFlowPage';

function resetFocusAndPlayer() {
  useFocusStore.setState({
    mode: 'study',
    focusDurationMin: 25,
    breakDurationMin: 5,
    longBreakDurationMin: 10,
    targetCycles: 4,
    targetMood: 'minimal',
    instrumentalOnly: true,
    energyMax: 5,
    focusPlaylistId: 'pl-low-light',
    breakPlaylistId: 'pl-acoustic-morning',
    autoPlayMusic: true,
    notificationsEnabled: true,
    phase: 'focus',
    isRunning: false,
    remainingSeconds: 25 * 60,
    phaseEndAtMs: null,
    phaseStartedAtMs: null,
    completedCycles: 0,
    sessions: [],
  });
  usePlayerStore.setState({
    currentTrackId: 'trk-01',
    queueTrackIds: ['trk-01', 'trk-02'],
    queueIndex: 0,
    isPlaying: false,
    currentTimeMs: 0,
  });
  usePlayerStore.getState().initEngine();
}

describe('FocusFlow Productivity Mode', () => {
  beforeEach(() => {
    resetFocusAndPlayer();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('supports all 5 productivity modes and Pomodoro quick presets', () => {
    render(
      <MemoryRouter>
        <FocusFlowPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /Deep Work/i }));
    expect(useFocusStore.getState().mode).toBe('deep_work');
    expect(screen.getByTestId('focus-timer-display')).toHaveTextContent('50:00');

    fireEvent.click(screen.getByRole('button', { name: /Relax/i }));
    expect(useFocusStore.getState().mode).toBe('relax');
    expect(screen.getByTestId('focus-timer-display')).toHaveTextContent('25:00');

    fireEvent.click(screen.getByRole('button', { name: /^Break/i }));
    expect(useFocusStore.getState().mode).toBe('break');
    expect(screen.getByTestId('focus-phase-badge')).toHaveTextContent('Short Break');
    expect(screen.getByTestId('focus-timer-display')).toHaveTextContent('05:00');

    fireEvent.click(screen.getByRole('button', { name: '10m Long Break' }));
    expect(useFocusStore.getState().phase).toBe('long_break');
    expect(screen.getByTestId('focus-timer-display')).toHaveTextContent('10:00');

    fireEvent.click(screen.getByRole('button', { name: '25m Focus' }));
    expect(useFocusStore.getState().phase).toBe('focus');
    expect(screen.getByTestId('focus-timer-display')).toHaveTextContent('25:00');
  });

  it('auto-plays selected focus playlist, switches to break playlist on completion, and allows manual skipping', async () => {
    render(
      <MemoryRouter>
        <FocusFlowPage />
      </MemoryRouter>
    );

    const focusPlaylist = RECOMMENDED_PLAYLISTS.find((p) => p.id === 'pl-low-light')!;
    const breakPlaylist = RECOMMENDED_PLAYLISTS.find((p) => p.id === 'pl-acoustic-morning')!;

    fireEvent.click(screen.getByRole('button', { name: 'Start Focus' }));

    await waitFor(() => expect(usePlayerStore.getState().isPlaying).toBe(true));
    expect(usePlayerStore.getState().queueTrackIds).toEqual(focusPlaylist.trackIds);
    expect(usePlayerStore.getState().currentTrackId).toBe(focusPlaylist.trackIds[0]);

    // Manual song skip from FocusFlow dashboard
    fireEvent.click(screen.getByRole('button', { name: 'FocusFlow skip track' }));
    await waitFor(() =>
      expect(usePlayerStore.getState().currentTrackId).toBe(focusPlaylist.trackIds[1])
    );

    // Completing focus phase logs a real session and automatically switches to break playlist
    fireEvent.click(screen.getByRole('button', { name: /Complete & Switch to Break/i }));
    expect(useFocusStore.getState().phase).toBe('short_break');
    expect(useFocusStore.getState().sessions).toHaveLength(1);
    expect(usePlayerStore.getState().queueTrackIds).toEqual(breakPlaylist.trackIds);
    expect(usePlayerStore.getState().currentTrackId).toBe(breakPlaylist.trackIds[0]);
  });

  it('calculates remaining time from wall-clock timestamps across browser tab inactivity', () => {
    const baseTime = 1_795_580_000_000;
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(baseTime);

    useFocusStore.getState().applyQuickDuration('focus', 25);
    useFocusStore.getState().startTimer();

    expect(useFocusStore.getState().remainingSeconds).toBe(1500);

    // Simulate 10 minutes of inactive background tab throttling
    nowSpy.mockReturnValue(baseTime + 600_000);
    act(() => {
      useFocusStore.getState().tick();
    });
    expect(useFocusStore.getState().remainingSeconds).toBe(900);

    // Simulate returning after full 25 minutes elapsed
    nowSpy.mockReturnValue(baseTime + 1_505_000);
    act(() => {
      useFocusStore.getState().tick();
    });

    expect(useFocusStore.getState().phase).toBe('short_break');
    expect(useFocusStore.getState().isRunning).toBe(false);
    expect(useFocusStore.getState().sessions).toHaveLength(1);
    expect(useFocusStore.getState().sessions[0].focusDurationMin).toBe(25);
  });

  it('allows custom durations, playlist selection, notification toggle, and computes real non-fabricated analytics', () => {
    render(
      <MemoryRouter>
        <FocusFlowPage />
      </MemoryRouter>
    );

    // Initially 0 completed sessions and 0 focus minutes (no fabricated metrics)
    expect(screen.getByTestId('stat-total-minutes')).toHaveTextContent('0');
    expect(screen.getByTestId('stat-completed-sessions')).toHaveTextContent('0');

    const focusInput = screen.getByLabelText('Focus (min)');
    fireEvent.change(focusInput, { target: { value: '40' } });
    expect(useFocusStore.getState().focusDurationMin).toBe(40);
    expect(useFocusStore.getState().mode).toBe('custom');

    const breakSelect = screen.getByLabelText(/Break Playlist/i);
    fireEvent.change(breakSelect, { target: { value: 'pl-late-night' } });
    expect(useFocusStore.getState().breakPlaylistId).toBe('pl-late-night');

    const notifBtn = screen.getByRole('button', { name: /Notifications On/i });
    fireEvent.click(notifBtn);
    expect(useFocusStore.getState().notificationsEnabled).toBe(false);

    // Verify analytics calculation on real recorded sessions
    const analytics = computeFocusAnalytics(
      [
        {
          id: 's1',
          mode: 'deep_work',
          focusDurationMin: 50,
          breakDurationMin: 10,
          completedCycles: 1,
          targetCycles: 3,
          targetMood: 'ambient',
          startedAt: '2026-11-25T08:00:00.000Z',
          endedAt: '2026-11-25T08:50:00.000Z',
          status: 'completed',
        },
        {
          id: 's2',
          mode: 'study',
          focusDurationMin: 25,
          breakDurationMin: 5,
          completedCycles: 1,
          targetCycles: 4,
          targetMood: 'minimal',
          startedAt: '2026-11-24T10:00:00.000Z',
          endedAt: '2026-11-24T10:25:00.000Z',
          status: 'completed',
        },
      ],
      new Date('2026-11-25T12:00:00.000Z')
    );

    expect(analytics.totalFocusMinutes).toBe(75);
    expect(analytics.completedSessions).toBe(2);
    expect(analytics.todayMinutes).toBe(50);
    expect(analytics.weeklyMinutes).toBe(75);
    expect(analytics.dailyHistory).toHaveLength(2);
  });
});
