import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, LogOut, Check, Heart, ListMusic, Timer, BookMarked } from 'lucide-react';
import { profileUpdateSchema } from '@soundsphere/shared';
import { useAuthStore } from '@/stores/useAuthStore';
import { useLibraryStore } from '@/stores/useLibraryStore';
import { useFocusStore } from '@/stores/useFocusStore';
import { useMemoryStore } from '@/stores/useMemoryStore';
import { useUiStore } from '@/stores/useUiStore';
import { formatRelativeDate } from '@/lib/formatters';

export function ProfilePage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const signOut = useAuthStore((s) => s.signOut);

  const favoriteCount = useLibraryStore((s) => s.favoriteTrackIds.length);
  const playlistCount = useLibraryStore((s) => s.userPlaylists.length);
  const focusSessions = useFocusStore((s) => s.sessions.length);
  const memoryCount = useMemoryStore((s) => s.notes.length);
  const showToast = useUiStore((s) => s.showToast);

  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [focusMin, setFocusMin] = useState(user?.preferredFocusMinutes ?? 25);
  const [breakMin, setBreakMin] = useState(user?.preferredBreakMinutes ?? 5);
  const [longBreakMin, setLongBreakMin] = useState(user?.preferredLongBreakMinutes ?? 15);
  const [error, setError] = useState<string | null>(null);

  if (!user) {
    return (
      <div className="mx-auto max-w-lg rounded-lg border border-[#1F242D] bg-[#14171D] p-8 text-center space-y-4">
        <h1 className="text-lg font-semibold text-zinc-100">You are signed out</h1>
        <p className="text-xs text-zinc-400">
          Sign in to manage your profile preferences and FocusFlow defaults.
        </p>
        <Link
          to="/auth"
          className="inline-block rounded-md bg-emerald-500 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-emerald-400"
        >
          Go to Sign In
        </Link>
      </div>
    );
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = profileUpdateSchema.safeParse({
      displayName,
      preferredFocusMinutes: Number(focusMin),
      preferredBreakMinutes: Number(breakMin),
      preferredLongBreakMinutes: Number(longBreakMin),
    });
    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message ?? 'Invalid profile values');
      return;
    }
    const res = await updateProfile(parsed.data);
    if (!res.ok) {
      setError(res.error ?? 'Could not save preferences');
      return;
    }
    showToast('Profile settings saved');
  };

  const summaryItems = [
    { label: 'Favorite Tracks', value: favoriteCount, icon: Heart, to: '/library' },
    { label: 'Personal Playlists', value: playlistCount, icon: ListMusic, to: '/playlists' },
    { label: 'FocusFlow Sessions', value: focusSessions, icon: Timer, to: '/focus-flow' },
    { label: 'MemoryMix Entries', value: memoryCount, icon: BookMarked, to: '/memory-mix' },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-8">
      <div className="flex flex-col gap-4 border-b border-[#1F242D] pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-md border border-emerald-500/40 bg-[#17231E] text-emerald-400">
            <User className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
              {user.displayName}
            </h1>
            <p className="text-xs text-zinc-400">
              {user.email} | Member since {formatRelativeDate(user.createdAt)}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={async () => {
            await signOut();
            showToast('Signed out');
            navigate('/auth');
          }}
          className="inline-flex items-center gap-2 self-start rounded-md border border-[#262B36] bg-[#14171D] px-3.5 py-2 text-xs font-medium text-zinc-300 hover:border-red-500/40 hover:text-red-400"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign Out
        </button>
      </div>

      {/* Real library summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {summaryItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              to={item.to}
              className="rounded-md border border-[#1F242D] bg-[#14171D] p-4 hover:border-[#2E3542] transition-colors"
            >
              <div className="flex items-center justify-between text-zinc-400">
                <span className="text-xs">{item.label}</span>
                <Icon className="h-4 w-4 text-emerald-400" />
              </div>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-zinc-100">
                {item.value}
              </p>
            </Link>
          );
        })}
      </div>

      {/* Editable Preferences */}
      <form
        onSubmit={handleSave}
        className="rounded-lg border border-[#1F242D] bg-[#14171D] p-6 space-y-5"
      >
        <div>
          <h2 className="text-base font-semibold text-zinc-100">Account & Timer Preferences</h2>
          <p className="mt-0.5 text-xs text-zinc-400">
            Update your profile name and default Pomodoro durations.
          </p>
        </div>

        {error && (
          <div className="rounded-md border border-red-500/40 bg-red-950/30 px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-zinc-300">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1.5 w-full max-w-md rounded-md border border-[#262B36] bg-[#0A0B0D] px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300">
              Default Focus Duration (minutes)
            </label>
            <input
              type="number"
              min={5}
              max={90}
              value={focusMin}
              onChange={(e) => setFocusMin(Number(e.target.value))}
              className="mt-1.5 w-full rounded-md border border-[#262B36] bg-[#0A0B0D] px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300">
              Short Break (minutes)
            </label>
            <input
              type="number"
              min={1}
              max={30}
              value={breakMin}
              onChange={(e) => setBreakMin(Number(e.target.value))}
              className="mt-1.5 w-full rounded-md border border-[#262B36] bg-[#0A0B0D] px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300">
              Long Break (minutes)
            </label>
            <input
              type="number"
              min={5}
              max={60}
              value={longBreakMin}
              onChange={(e) => setLongBreakMin(Number(e.target.value))}
              className="mt-1.5 w-full rounded-md border border-[#262B36] bg-[#0A0B0D] px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-md bg-emerald-500 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-emerald-400 transition-colors"
          >
            <Check className="h-3.5 w-3.5" />
            Save Preferences
          </button>
        </div>
      </form>
    </div>
  );
}

