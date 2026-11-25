import { Link } from 'react-router-dom';
import { ShieldCheck, ArrowLeft } from 'lucide-react';

export function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-10">
      <div className="border-b border-[#1F242D] pb-5">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Discover
        </Link>
        <div className="mt-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
          <ShieldCheck className="h-4 w-4" />
          Privacy Policy
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-100">
          SoundSphere Privacy Policy
        </h1>
        <p className="mt-1 text-xs text-zinc-500">Last updated: November 2026</p>
      </div>

      <div className="space-y-6 text-sm leading-relaxed text-zinc-300">
        <section className="rounded-md border border-[#1F242D] bg-[#14171D] p-5 space-y-2">
          <h2 className="text-base font-semibold text-zinc-100">1. Account Information</h2>
          <p className="text-xs text-zinc-400 leading-relaxed">
            When you create a SoundSphere account, we store your display name, email address, and a securely salted cryptographic password hash. Passwords are never stored in plain text or exposed to client code.
          </p>
        </section>

        <section className="rounded-md border border-[#1F242D] bg-[#14171D] p-5 space-y-2">
          <h2 className="text-base font-semibold text-zinc-100">2. Private Music Library and MemoryMix Journal</h2>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Personal playlists, liked tracks, listening history, FocusFlow session logs, MemoryMix notes, timestamp bookmarks, and custom tags are strictly scoped to your authenticated user ID and enforced via server ownership checks and database Row-Level Security policies.
          </p>
        </section>

        <section className="rounded-md border border-[#1F242D] bg-[#14171D] p-5 space-y-2">
          <h2 className="text-base font-semibold text-zinc-100">3. Local Storage and Session Persistence</h2>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Your browser stores your signed session token and player preferences (such as volume, shuffle, and repeat mode) in localStorage so your session persists across refreshes. Signing out revokes the session token on the server and clears private user state from the browser.
          </p>
        </section>

        <section className="rounded-md border border-[#1F242D] bg-[#14171D] p-5 space-y-2">
          <h2 className="text-base font-semibold text-zinc-100">4. Data Control and Deletion</h2>
          <p className="text-xs text-zinc-400 leading-relaxed">
            You can edit or delete your playlists, MemoryMix notes, bookmarks, and tags directly inside the application at any time. No personal listening journal entries are shared publicly or sold to third parties.
          </p>
        </section>
      </div>
    </div>
  );
}
