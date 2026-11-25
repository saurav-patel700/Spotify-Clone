import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { useMemoryStore } from '@/stores/useMemoryStore';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { MemoryMixPage } from '@/pages/MemoryMixPage';
import { SongMemoryPage } from '@/pages/SongMemoryPage';

function resetStores() {
  useMemoryStore.setState({
    ownerId: 'usr-demo-01',
    notes: [],
    tags: [],
    isLoading: false,
    syncError: null,
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

describe('MemoryMix Private Listening Journal', () => {
  beforeEach(() => {
    resetStores();
  });

  it('starts with an empty journal for new users without fake entries', () => {
    render(
      <MemoryRouter>
        <MemoryMixPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Your MemoryMix journal is empty')).toBeInTheDocument();
    expect(useMemoryStore.getState().notes).toHaveLength(0);
    expect(useMemoryStore.getState().tags).toHaveLength(0);
  });

  it('creates custom tags, writes/edits/deletes notes, deduplicates bookmarks, searches/filters, and resumes playback', async () => {
    render(
      <MemoryRouter>
        <MemoryMixPage />
      </MemoryRouter>
    );

    // Create custom tag and quick-add tag
    fireEvent.change(screen.getByLabelText('New personal tag name'), {
      target: { value: 'Gym' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create tag' }));
    expect(useMemoryStore.getState().tags).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Travel' }));
    expect(useMemoryStore.getState().tags).toHaveLength(2);

    // Write a personal note with timestamp bookmark and both tags
    fireEvent.change(screen.getByLabelText(/Timestamp \(seconds\)/i), {
      target: { value: '75' },
    });
    fireEvent.change(screen.getByLabelText('Personal Note'), {
      target: { value: 'Morning run along the river' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Gym' })[0]);
    fireEvent.click(screen.getAllByRole('button', { name: 'Travel' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Save to Journal' }));

    expect(useMemoryStore.getState().notes).toHaveLength(1);
    expect(screen.getByText('Morning run along the river')).toBeInTheDocument();

    // Duplicate bookmark at the same second updates existing entry instead of duplicating
    fireEvent.change(screen.getByLabelText(/Timestamp \(seconds\)/i), {
      target: { value: '75' },
    });
    fireEvent.change(screen.getByLabelText('Personal Note'), {
      target: { value: 'Morning run along the river in autumn' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save to Journal' }));

    expect(useMemoryStore.getState().notes).toHaveLength(1);
    expect(screen.getByText('Morning run along the river in autumn')).toBeInTheDocument();

    // Clicking the timestamp bookmark resumes playback from exact millisecond (75000ms)
    fireEvent.click(screen.getByRole('button', { name: '1:15' }));
    await waitFor(() => expect(usePlayerStore.getState().isPlaying).toBe(true));
    expect(usePlayerStore.getState().currentTrackId).toBe('trk-01');
    expect(usePlayerStore.getState().currentTimeMs).toBe(75000);

    // Search by keyword
    fireEvent.change(screen.getByLabelText('Search journal notes'), {
      target: { value: 'nonexistent-query' },
    });
    expect(
      screen.getByText('No journal entries match the current search or tag filters.')
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Search journal notes'), {
      target: { value: 'autumn' },
    });
    expect(screen.getByText('Morning run along the river in autumn')).toBeInTheDocument();

    // Clear search before editing note text
    fireEvent.change(screen.getByLabelText('Search journal notes'), {
      target: { value: '' },
    });

    // Edit note
    fireEvent.click(screen.getByRole('button', { name: 'Edit note' }));
    const editBox = screen.getByDisplayValue('Morning run along the river in autumn');
    fireEvent.change(editBox, { target: { value: 'Updated river run memory' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(screen.getByText('Updated river run memory')).toBeInTheDocument();

    // Delete note
    fireEvent.click(screen.getByRole('button', { name: 'Delete note' }));
    expect(useMemoryStore.getState().notes).toHaveLength(0);
    expect(screen.getByText('Your MemoryMix journal is empty')).toBeInTheDocument();
  });

  it('renders dedicated SongMemoryPage with album artwork, artist details, saved timestamps, and tags', async () => {
    const tag = useMemoryStore.getState().createTag('Study', '#10B981');
    useMemoryStore.getState().createNote({
      trackId: 'trk-04',
      timestampMs: 64000,
      noteText: 'Piano refrain works for deep reading',
      isBookmark: true,
      tagIds: [tag.id],
    });

    render(
      <MemoryRouter initialEntries={['/memory-mix/song/trk-04']}>
        <Routes>
          <Route path="/memory-mix/song/:trackId" element={<SongMemoryPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'North Shore Felt' })).toBeInTheDocument();
    expect(screen.getByText('Soraia Lind')).toBeInTheDocument();
    expect(screen.getByAltText('Glass Fjord')).toBeInTheDocument();
    expect(screen.getByText('Piano refrain works for deep reading')).toBeInTheDocument();
    expect(screen.getAllByText('Study').length).toBeGreaterThanOrEqual(1);

    fireEvent.click(screen.getByRole('button', { name: 'Resume at 1:04' }));
    await waitFor(() => expect(usePlayerStore.getState().isPlaying).toBe(true));
    expect(usePlayerStore.getState().currentTrackId).toBe('trk-04');
    expect(usePlayerStore.getState().currentTimeMs).toBe(64000);
  });
});
