import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { SearchPage } from '@/pages/SearchPage';
import { PrivacyPolicyPage } from '@/pages/PrivacyPolicyPage';
import { TermsPage } from '@/pages/TermsPage';
import { BottomPlayer } from '@/components/player/BottomPlayer';
import { MobileNav } from '@/components/layout/MobileNav';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { useAuthStore } from '@/stores/useAuthStore';

describe('Search, Legal Pages, Session Persistence, and Responsive Mobile UI', () => {
  beforeEach(() => {
    usePlayerStore.setState({
      currentTrackId: 'trk-01',
      queueTrackIds: ['trk-01', 'trk-02'],
      queueIndex: 0,
      isPlaying: false,
      currentTimeMs: 0,
      durationMs: 214000,
      isMobileSheetOpen: false,
    });
    useAuthStore.setState({
      user: null,
      accessToken: null,
      isHydrating: false,
    });
    vi.restoreAllMocks();
  });

  it('filters songs, albums, artists, and playlists on SearchPage', () => {
    render(
      <MemoryRouter initialEntries={['/search?q=Horizon']}>
        <Routes>
          <Route path="/search" element={<SearchPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'Results for "Horizon"' })).toBeInTheDocument();
    expect(screen.getByText('Signal Horizon')).toBeInTheDocument();
    expect(screen.queryByText('Concrete Pulse')).not.toBeInTheDocument();

    // Filter to non-matching term shows empty state
    fireEvent.change(screen.getByPlaceholderText('Filter catalog...'), {
      target: { value: 'zzzz-unknown' },
    });
    expect(screen.getByText('No matching results found')).toBeInTheDocument();
  });

  it('renders Privacy Policy and Terms and Conditions pages', () => {
    render(
      <MemoryRouter initialEntries={['/privacy']}>
        <Routes>
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/terms" element={<TermsPage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByRole('heading', { name: 'SoundSphere Privacy Policy' })).toBeInTheDocument();

    render(
      <MemoryRouter initialEntries={['/terms']}>
        <Routes>
          <Route path="/terms" element={<TermsPage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(
      screen.getByRole('heading', { name: 'SoundSphere Terms and Conditions' })
    ).toBeInTheDocument();
  });

  it('renders responsive MobileNav and expands mobile mini-player into full-screen sheet', () => {
    render(
      <MemoryRouter>
        <BottomPlayer />
        <MobileNav />
      </MemoryRouter>
    );

    // Mobile bottom navigation links
    expect(screen.getByRole('navigation', { name: 'Mobile navigation' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Focus' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Memory' })).toBeInTheDocument();

    // Tapping compact mini-player opens mobile Now Playing sheet
    fireEvent.click(screen.getByRole('button', { name: /Signal Horizon/i }));
    expect(usePlayerStore.getState().isMobileSheetOpen).toBe(true);
    expect(screen.getByText('Now Playing')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close player sheet' }));
    expect(usePlayerStore.getState().isMobileSheetOpen).toBe(false);
  });

  it('restores authenticated session via /auth/me and clears session on logout', async () => {
    useAuthStore.setState({ accessToken: 'valid-jwt' });
    globalThis.fetch = vi.fn(async (url: string) => {
      if (String(url).endsWith('/auth/me')) {
        return new Response(
          JSON.stringify({
            data: {
              user: {
                id: 'usr-1',
                email: 'alex@example.com',
                displayName: 'Alex Mercer',
                preferredFocusMinutes: 25,
                preferredBreakMinutes: 5,
                preferredLongBreakMinutes: 15,
                createdAt: '2026-11-01T00:00:00.000Z',
              },
            },
          }),
          { status: 200 }
        );
      }
      if (String(url).endsWith('/auth/logout')) {
        return new Response(JSON.stringify({ data: { loggedOut: true } }), { status: 200 });
      }
      return new Response('{}', { status: 404 });
    }) as unknown as typeof fetch;

    await useAuthStore.getState().hydrateSession();
    expect(useAuthStore.getState().user?.email).toBe('alex@example.com');

    await useAuthStore.getState().signOut();
    await waitFor(() => expect(useAuthStore.getState().user).toBeNull());
    expect(useAuthStore.getState().accessToken).toBeNull();
  });
});
