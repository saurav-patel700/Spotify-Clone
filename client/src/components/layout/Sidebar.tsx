import { NavLink, Link } from 'react-router-dom';
import {
  Home,
  Compass,
  Search,
  Library,
  ListMusic,
  Timer,
  BookMarked,
  Plus,
  User,
  LogIn,
  X,
} from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { useLibraryStore } from '@/stores/useLibraryStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useFocusStore } from '@/stores/useFocusStore';
import { useUiStore } from '@/stores/useUiStore';
import { formatTimerSeconds } from '@/lib/formatters';

interface SidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
}

const PRIMARY_NAV = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/explore', label: 'Explore', icon: Compass },
  { to: '/search', label: 'Search', icon: Search },
  { to: '/library', label: 'Your Library', icon: Library },
  { to: '/playlists', label: 'Playlists', icon: ListMusic },
];

const FEATURE_NAV = [
  { to: '/focus-flow', label: 'FocusFlow', icon: Timer },
  { to: '/memory-mix', label: 'MemoryMix', icon: BookMarked },
];

export function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const userPlaylists = useLibraryStore((s) => s.userPlaylists);
  const user = useAuthStore((s) => s.user);
  const focusRunning = useFocusStore((s) => s.isRunning);
  const focusRemaining = useFocusStore((s) => s.remainingSeconds);
  const openCreatePlaylist = useUiStore((s) => s.openCreatePlaylist);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors ${
      isActive
        ? 'bg-[#171E1C] text-emerald-400 border border-emerald-500/30'
        : 'text-zinc-400 border border-transparent hover:bg-[#16191F] hover:text-zinc-100'
    }`;

  const content = (
    <div className="flex h-full flex-col bg-[#0E1014] border-r border-[#1F242D]">
      {/* Logo */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-[#1F242D]">
        <Link to="/" onClick={onClose} className="focus:outline-none">
          <BrandLogo />
        </Link>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close navigation"
          className="rounded-md p-1.5 text-zinc-400 hover:bg-[#1B1F27] hover:text-zinc-100 lg:hidden"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        <nav aria-label="Main navigation" className="space-y-1">
          {PRIMARY_NAV.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={onClose}
                className={linkClass}
              >
                <span className="flex items-center gap-3">
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </span>
              </NavLink>
            );
          })}
        </nav>

        <div>
          <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Workspace Modes
          </div>
          <nav aria-label="Workspace modes" className="space-y-1">
            {FEATURE_NAV.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onClose}
                  className={linkClass}
                >
                  <span className="flex items-center gap-3">
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </span>
                  {item.to === '/focus-flow' && focusRunning && (
                    <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-emerald-400">
                      {formatTimerSeconds(focusRemaining)}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* User Playlists */}
        <div>
          <div className="mb-2 flex items-center justify-between px-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Your Playlists
            </span>
            <button
              type="button"
              onClick={() => openCreatePlaylist()}
              title="Create playlist"
              aria-label="Create playlist"
              className="rounded p-1 text-zinc-400 hover:bg-[#1B1F27] hover:text-emerald-400 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="space-y-0.5">
            {userPlaylists.map((pl) => (
              <NavLink
                key={pl.id}
                to={`/playlist/${pl.id}`}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center justify-between rounded-md px-3 py-1.5 text-xs transition-colors ${
                    isActive
                      ? 'bg-[#16191F] font-medium text-emerald-400'
                      : 'text-zinc-400 hover:bg-[#14171D] hover:text-zinc-200'
                  }`
                }
              >
                <span className="truncate">{pl.title}</span>
                <span className="ml-2 shrink-0 text-[11px] tabular-nums text-zinc-500">
                  {pl.trackIds.length}
                </span>
              </NavLink>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Profile / Auth */}
      <div className="border-t border-[#1F242D] p-3">
        {user ? (
          <NavLink
            to="/profile"
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-md border px-3 py-2 transition-colors ${
                isActive
                  ? 'border-emerald-500/40 bg-[#171E1C] text-zinc-100'
                  : 'border-[#1F242D] bg-[#14171D] text-zinc-200 hover:border-[#2E3542]'
              }`
            }
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-emerald-500/15 text-emerald-400">
              <User className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-zinc-100">{user.displayName}</p>
              <p className="truncate text-[11px] text-zinc-500">{user.email}</p>
            </div>
          </NavLink>
        ) : (
          <NavLink
            to="/auth"
            onClick={onClose}
            className="flex items-center justify-center gap-2 rounded-md bg-emerald-500 px-3 py-2 text-xs font-semibold text-zinc-950 hover:bg-emerald-400 transition-colors"
          >
            <LogIn className="h-4 w-4" />
            Sign In
          </NavLink>
        )}
        <div className="mt-2.5 flex items-center justify-center gap-3 text-[11px] text-zinc-500">
          <Link to="/privacy" onClick={onClose} className="hover:text-zinc-300">
            Privacy
          </Link>
          <span>|</span>
          <Link to="/terms" onClick={onClose} className="hover:text-zinc-300">
            Terms
          </Link>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop persistent sidebar */}
      <aside className="hidden lg:block w-60 shrink-0 h-full">{content}</aside>

      {/* Mobile / Tablet drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-black/75" onClick={onClose} />
          <aside className="relative z-10 w-64 h-full">{content}</aside>
        </div>
      )}
    </>
  );
}

