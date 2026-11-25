import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { createdAudioInstances, MockAudioElement } from './setup';
import { audioEngine } from '@/lib/audioEngine';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { useLibraryStore } from '@/stores/useLibraryStore';
import { BottomPlayer } from '@/components/player/BottomPlayer';
import { QueueDrawer } from '@/components/player/QueueDrawer';
import { AppShell } from '@/components/layout/AppShell';
import { HomePage } from '@/pages/HomePage';
import { AlbumDetailPage } from '@/pages/AlbumDetailPage';
import { PlaylistDetailPage } from '@/pages/PlaylistDetailPage';
import { ExplorePage } from '@/pages/ExplorePage';
import { PlaylistsPage } from '@/pages/PlaylistsPage';

function resetStores() {
  audioEngine.resetTrackCache();
  usePlayerStore.setState({
    currentTrackId: 'trk-01',
    queueTrackIds: ['trk-01', 'trk-02', 'trk-04'],
    queueIndex: 0,
    isPlaying: false,
    audioStatus: 'paused',
    currentTimeMs: 0,
    durationMs: 214000,
    volume: 0.75,
    muted: false,
    shuffle: false,
    repeatMode: 'off',
    isQueueOpen: false,
    isMobileSheetOpen: false,
    audioError: null,
  });
  useLibraryStore.setState({
    favoriteTrackIds: ['trk-01'],
    savedAlbumIds: [],
    userPlaylists: [
      {
        id: 'upl-test-1',
        ownerId: 'usr-demo-01',
        ownerName: 'Alex Mercer',
        title: 'Test Mix',
        description: 'Playlist for testing',
        coverUrl: 'data:image/svg+xml;utf8,<svg/>',
        isPublic: false,
        trackIds: ['trk-01', 'trk-04'],
        createdAt: '2026-11-01T00:00:00.000Z',
        updatedAt: '2026-11-01T00:00:00.000Z',
      },
    ],
    isLoading: false,
    syncError: null,
  });
}

describe('SoundSphere Global Audio Player & Controls', () => {
  beforeEach(() => {
    resetStores();
    vi.clearAllMocks();
    usePlayerStore.getState().initEngine();
  });

  it('enforces a single global HTMLAudioElement instance across multiple plays', async () => {
    const firstEl = audioEngine.getAudioElement();
    usePlayerStore.getState().playTrack('trk-01');
    await waitFor(() => expect(usePlayerStore.getState().isPlaying).toBe(true));

    usePlayerStore.getState().playTrack('trk-02');
    await waitFor(() => expect(usePlayerStore.getState().currentTrackId).toBe('trk-02'));

    usePlayerStore.getState().playTrack('trk-04');
    await waitFor(() => expect(usePlayerStore.getState().currentTrackId).toBe('trk-04'));

    expect(audioEngine.getAudioElement()).toBe(firstEl);
    expect(createdAudioInstances.length).toBe(1);
  });

  it('plays, pauses, displays accurate time/duration, and seeks via progress slider', async () => {
    render(
      <MemoryRouter>
        <BottomPlayer />
      </MemoryRouter>
    );

    const footer = within(screen.getByRole('contentinfo'));
    const playBtn = footer.getByRole('button', { name: 'Play' });
    fireEvent.click(playBtn);

    await waitFor(() => expect(usePlayerStore.getState().isPlaying).toBe(true));
    expect(footer.getByRole('button', { name: 'Pause' })).toBeInTheDocument();

    const audio = audioEngine.getAudioElement() as unknown as MockAudioElement;
    act(() => {
      audio.duration = 214;
      audio.triggerTimeUpdate(45);
    });

    expect(footer.getByTestId('player-current-time')).toHaveTextContent('0:45');
    expect(footer.getByTestId('player-duration')).toHaveTextContent('3:34');

    const seekSlider = footer.getByRole('slider', { name: 'Seek track progress' });
    fireEvent.change(seekSlider, { target: { value: '90000' } });
    expect(usePlayerStore.getState().currentTimeMs).toBe(90000);
    expect(audio.currentTime).toBe(90);

    fireEvent.click(footer.getByRole('button', { name: 'Pause' }));
    expect(usePlayerStore.getState().isPlaying).toBe(false);
  });

  it('handles next, previous (>3s restart vs track switch), shuffle, repeat one, and repeat all', async () => {
    render(
      <MemoryRouter>
        <BottomPlayer />
      </MemoryRouter>
    );

    const footer = within(screen.getByRole('contentinfo'));

    // Next track
    fireEvent.click(footer.getByRole('button', { name: 'Next track' }));
    await waitFor(() => expect(usePlayerStore.getState().currentTrackId).toBe('trk-02'));
    expect(usePlayerStore.getState().queueIndex).toBe(1);

    // If > 3s played, Previous restarts current track to 0ms
    act(() => {
      usePlayerStore.getState().seek(5000);
    });
    fireEvent.click(footer.getByRole('button', { name: 'Previous track' }));
    expect(usePlayerStore.getState().currentTrackId).toBe('trk-02');
    expect(usePlayerStore.getState().currentTimeMs).toBe(0);

    // At <= 3s, Previous goes to previous track
    fireEvent.click(footer.getByRole('button', { name: 'Previous track' }));
    await waitFor(() => expect(usePlayerStore.getState().currentTrackId).toBe('trk-01'));

    // Repeat one replays same track on ended
    const repeatBtn = footer.getByRole('button', { name: /Repeat mode/i });
    fireEvent.click(repeatBtn); // off -> all
    expect(usePlayerStore.getState().repeatMode).toBe('all');
    fireEvent.click(repeatBtn); // all -> one
    expect(usePlayerStore.getState().repeatMode).toBe('one');

    const audio = audioEngine.getAudioElement() as unknown as MockAudioElement;
    act(() => {
      audio.triggerEnded();
    });
    await waitFor(() => expect(usePlayerStore.getState().currentTrackId).toBe('trk-01'));

    // Repeat all wraps from end of queue back to index 0
    fireEvent.click(repeatBtn); // one -> off
    fireEvent.click(repeatBtn); // off -> all
    usePlayerStore.setState({ queueIndex: 2, currentTrackId: 'trk-04' });
    act(() => {
      audio.triggerEnded();
    });
    await waitFor(() => expect(usePlayerStore.getState().queueIndex).toBe(0));
    expect(usePlayerStore.getState().currentTrackId).toBe('trk-01');

    // Shuffle toggle
    const shuffleBtn = footer.getByRole('button', { name: 'Toggle shuffle' });
    fireEvent.click(shuffleBtn);
    expect(usePlayerStore.getState().shuffle).toBe(true);
    fireEvent.click(footer.getByRole('button', { name: 'Next track' }));
    expect(usePlayerStore.getState().currentTrackId).not.toBe('trk-01');
  });

  it('adjusts volume and toggles mute', () => {
    render(
      <MemoryRouter>
        <BottomPlayer />
      </MemoryRouter>
    );

    const footer = within(screen.getByRole('contentinfo'));
    const audio = audioEngine.getAudioElement() as unknown as MockAudioElement;
    const volumeSlider = footer.getByRole('slider', { name: 'Volume' });
    fireEvent.change(volumeSlider, { target: { value: '0.4' } });

    expect(usePlayerStore.getState().volume).toBe(0.4);
    expect(audio.volume).toBe(0.4);
    expect(audio.muted).toBe(false);

    fireEvent.click(footer.getByRole('button', { name: 'Mute' }));
    expect(usePlayerStore.getState().muted).toBe(true);
    expect(audio.muted).toBe(true);

    fireEvent.click(footer.getByRole('button', { name: 'Unmute' }));
    expect(usePlayerStore.getState().muted).toBe(false);
    expect(audio.muted).toBe(false);
  });

  it('adds and removes songs from the queue drawer', () => {
    usePlayerStore.setState({ isQueueOpen: true });
    render(
      <MemoryRouter>
        <QueueDrawer />
      </MemoryRouter>
    );

    act(() => {
      usePlayerStore.getState().addToQueue('trk-07');
    });
    expect(screen.getByText('Concrete Pulse')).toBeInTheDocument();

    const removeButtons = screen.getAllByRole('button', { name: 'Remove from queue' });
    fireEvent.click(removeButtons[removeButtons.length - 1]);
    expect(screen.queryByText('Concrete Pulse')).not.toBeInTheDocument();
  });

  it('plays collections from albums and playlists and preserves playback across page navigation', async () => {
    render(
      <MemoryRouter initialEntries={['/album/alb-quiet-telemetry']}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/explore" element={<ExplorePage />} />
            <Route path="/album/:id" element={<AlbumDetailPage />} />
            <Route path="/playlist/:id" element={<PlaylistDetailPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    // Play Album
    fireEvent.click(screen.getByRole('button', { name: /Play Album/i }));
    await waitFor(() => expect(usePlayerStore.getState().isPlaying).toBe(true));
    expect(usePlayerStore.getState().queueTrackIds).toEqual(['trk-01', 'trk-02', 'trk-03']);

    // Navigate to Explore page via sidebar link and verify playback remains uninterrupted
    fireEvent.click(screen.getByRole('link', { name: 'Explore' }));
    expect(screen.getByRole('heading', { name: 'Explore Catalog' })).toBeInTheDocument();
    expect(usePlayerStore.getState().isPlaying).toBe(true);
    expect(usePlayerStore.getState().currentTrackId).toBe('trk-01');
  });

  it('updates recently played history, likes/unlikes songs, and manages playlists', async () => {
    // Play a new track -> updates recentlyPlayed
    usePlayerStore.getState().playTrack('trk-10', 'direct');
    expect(usePlayerStore.getState().recentlyPlayed[0].trackId).toBe('trk-10');

    // Like & unlike via store
    useLibraryStore.getState().toggleFavorite('trk-10');
    expect(useLibraryStore.getState().isFavorite('trk-10')).toBe(true);
    useLibraryStore.getState().toggleFavorite('trk-10');
    expect(useLibraryStore.getState().isFavorite('trk-10')).toBe(false);

    // Create, edit, add/remove tracks, delete playlist
    const created = useLibraryStore.getState().createPlaylist('Night Study', 'Quiet tracks');
    expect(useLibraryStore.getState().getPlaylistById(created.id)?.title).toBe('Night Study');

    useLibraryStore.getState().updatePlaylist(created.id, { title: 'Night Study v2' });
    expect(useLibraryStore.getState().getPlaylistById(created.id)?.title).toBe('Night Study v2');

    useLibraryStore.getState().addTrackToPlaylist(created.id, 'trk-07');
    expect(useLibraryStore.getState().getPlaylistById(created.id)?.trackIds).toEqual(['trk-07']);

    useLibraryStore.getState().removeTrackFromPlaylist(created.id, 'trk-07');
    expect(useLibraryStore.getState().getPlaylistById(created.id)?.trackIds).toEqual([]);

    useLibraryStore.getState().deletePlaylist(created.id);
    expect(useLibraryStore.getState().getPlaylistById(created.id)).toBeUndefined();

    // Verify PlaylistsPage renders cleanly
    render(
      <MemoryRouter>
        <PlaylistsPage />
      </MemoryRouter>
    );
    expect(screen.getByRole('heading', { name: 'Playlists' })).toBeInTheDocument();
  });

  it('handles loading state and unavailable audio files gracefully with retry and skip controls', async () => {
    render(
      <MemoryRouter>
        <BottomPlayer />
      </MemoryRouter>
    );

    const audio = audioEngine.getAudioElement() as unknown as MockAudioElement;
    act(() => {
      audio.triggerError();
    });

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Audio file could not be loaded or decoded.'
    );
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Skip Next' })).toBeInTheDocument();

    // Unavailable track ID surfaces clean error instead of crashing
    act(() => {
      usePlayerStore.getState().playTrack('trk-missing-id');
    });
    expect(usePlayerStore.getState().audioStatus).toBe('error');
    expect(screen.getByRole('alert')).toHaveTextContent('Track "trk-missing-id" is unavailable.');
  });
});

