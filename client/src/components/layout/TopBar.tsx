import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Menu,
  ListMusic,
  Timer,
  User,
  X,
} from 'lucide-react';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { useFocusStore } from '@/stores/useFocusStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { formatTimerSeconds } from '@/lib/formatters';

interface TopBarProps {
  onOpenMobileSidebar: () => void;
}

export function TopBar({ onOpenMobileSidebar }: TopBarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const isQueueOpen = usePlayerStore((s) => s.isQueueOpen);
  const toggleQueueOpen = usePlayerStore((s) => s.toggleQueueOpen);
  const focusRunning = useFocusStore((s) => s.isRunning);
  const focusRemaining = useFocusStore((s) => s.remainingSeconds);
  const focusPhase = useFocusStore((s) => s.phase);
  const user = useAuthStore((s) => s.user);

  const searchParams = new URLSearchParams(location.search);
  const urlQuery = location.pathname === '/search' ? searchParams.get('q') ?? '' : '';
  const [query, setQuery] = useState(urlQuery);

  useEffect(() => {
    if (location.pathname === '/search') {
      setQuery(urlQuery);
    }
  }, [location.pathname, urlQuery]);

  const handleSearchChange = (value: string) => {
    setQuery(value);
    if (value.trim()) {
      navigate(`/search?q=${encodeURIComponent(value)}`, { replace: location.pathname === '/search' });
    } else if (location.pathname === '/search') {
      navigate('/search', { replace: true });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(query.trim() ? `/search?q=${encodeURIComponent(query.trim())}` : '/search');
  };

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-[#1F242D] bg-[#0A0B0D] px-4 lg:px-6">
      <div className="flex items-center gap-2.5 flex-1 max-w-2xl">
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          aria-label="Open navigation menu"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#1F242D] bg-[#14171D] text-zinc-300 hover:border-[#2E3542] hover:text-zinc-100 lg:hidden"
        >
          <Menu className="h-4 w-4" />
        </button>

        <div className="hidden sm:flex items-center gap-1">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Go back"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-[#1F242D] bg-[#14171D] text-zinc-400 hover:border-[#2E3542] hover:text-zinc-100"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => navigate(1)}
            aria-label="Go forward"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-[#1F242D] bg-[#14171D] text-zinc-400 hover:border-[#2E3542] hover:text-zinc-100"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="search"
            value={query}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search songs, artists, albums, or playlists"
            aria-label="Search music catalog"
            className="h-9 w-full rounded-md border border-[#1F242D] bg-[#14171D] pl-9 pr-8 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => handleSearchChange('')}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-zinc-500 hover:text-zinc-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </form>
      </div>

      <div className="flex items-center gap-2">
        {focusRunning && (
          <Link
            to="/focus-flow"
            className="hidden md:inline-flex items-center gap-2 rounded-md border border-emerald-500/35 bg-[#121D19] px-2.5 py-1.5 text-xs font-medium text-emerald-400 hover:border-emerald-500/60"
          >
            <Timer className="h-3.5 w-3.5" />
            <span className="capitalize">{focusPhase.replace('_', ' ')}</span>
            <span className="tabular-nums font-semibold">{formatTimerSeconds(focusRemaining)}</span>
          </Link>
        )}

        <button
          type="button"
          onClick={toggleQueueOpen}
          aria-label="Toggle playback queue"
          className={`inline-flex h-9 items-center gap-2 rounded-md border px-3 text-xs font-medium transition-colors ${
            isQueueOpen
              ? 'border-emerald-500/50 bg-[#171E1C] text-emerald-400'
              : 'border-[#1F242D] bg-[#14171D] text-zinc-300 hover:border-[#2E3542] hover:text-zinc-100'
          }`}
        >
          <ListMusic className="h-4 w-4" />
          <span className="hidden sm:inline">Queue</span>
        </button>

        <Link
          to={user ? '/profile' : '/auth'}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-[#1F242D] bg-[#14171D] px-3 text-xs font-medium text-zinc-200 hover:border-[#2E3542] hover:text-zinc-100"
        >
          <User className="h-4 w-4 text-emerald-400" />
          <span className="hidden md:inline">{user ? user.displayName : 'Sign In'}</span>
        </Link>
      </div>
    </header>
  );
}

