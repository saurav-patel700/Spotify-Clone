import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { HomePage } from '@/pages/HomePage';
import { ExplorePage } from '@/pages/ExplorePage';
import { SearchPage } from '@/pages/SearchPage';
import { LibraryPage } from '@/pages/LibraryPage';
import { PlaylistsPage } from '@/pages/PlaylistsPage';
import { AlbumDetailPage } from '@/pages/AlbumDetailPage';
import { ArtistDetailPage } from '@/pages/ArtistDetailPage';
import { PlaylistDetailPage } from '@/pages/PlaylistDetailPage';
import { FocusFlowPage } from '@/pages/FocusFlowPage';
import { MemoryMixPage } from '@/pages/MemoryMixPage';
import { SongMemoryPage } from '@/pages/SongMemoryPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { AuthPage } from '@/pages/AuthPage';
import { PrivacyPolicyPage } from '@/pages/PrivacyPolicyPage';
import { TermsPage } from '@/pages/TermsPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route element={<AppShell />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/explore" element={<ExplorePage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/album/:id" element={<AlbumDetailPage />} />
          <Route path="/artist/:id" element={<ArtistDetailPage />} />
          <Route path="/playlist/:id" element={<PlaylistDetailPage />} />
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route
            path="/library"
            element={
              <ProtectedRoute>
                <LibraryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/playlists"
            element={
              <ProtectedRoute>
                <PlaylistsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/focus-flow"
            element={
              <ProtectedRoute>
                <FocusFlowPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/memory-mix"
            element={
              <ProtectedRoute>
                <MemoryMixPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/memory-mix/song/:trackId"
            element={
              <ProtectedRoute>
                <SongMemoryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
