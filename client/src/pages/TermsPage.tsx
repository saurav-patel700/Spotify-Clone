import { Link } from 'react-router-dom';
import { FileText, ArrowLeft } from 'lucide-react';

export function TermsPage() {
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
          <FileText className="h-4 w-4" />
          Terms of Use
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-100">
          SoundSphere Terms and Conditions
        </h1>
        <p className="mt-1 text-xs text-zinc-500">Last updated: November 2026</p>
      </div>

      <div className="space-y-6 text-sm leading-relaxed text-zinc-300">
        <section className="rounded-md border border-[#1F242D] bg-[#14171D] p-5 space-y-2">
          <h2 className="text-base font-semibold text-zinc-100">1. Service Scope</h2>
          <p className="text-xs text-zinc-400 leading-relaxed">
            SoundSphere is a music streaming, productivity timer (FocusFlow), and personal listening journal (MemoryMix) web application. Access to personal library, FocusFlow history, and MemoryMix features requires a registered account.
          </p>
        </section>

        <section className="rounded-md border border-[#1F242D] bg-[#14171D] p-5 space-y-2">
          <h2 className="text-base font-semibold text-zinc-100">2. Licensed Audio and Attribution</h2>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Catalog tracks streamed in SoundSphere use legally licensed CC0 1.0 Public Domain and CC BY 4.0 demo audio with explicit attribution metadata shown on album and song detail pages. Users uploading audio files must hold the necessary rights and comply with supported format and size limits.
          </p>
        </section>

        <section className="rounded-md border border-[#1F242D] bg-[#14171D] p-5 space-y-2">
          <h2 className="text-base font-semibold text-zinc-100">3. User Content and Conduct</h2>
          <p className="text-xs text-zinc-400 leading-relaxed">
            You retain ownership of the personal playlists, MemoryMix notes, bookmarks, and tags you create. You agree not to abuse API rate limits, attempt unauthorized access to other accounts, or upload malicious or non-audio files.
          </p>
        </section>

        <section className="rounded-md border border-[#1F242D] bg-[#14171D] p-5 space-y-2">
          <h2 className="text-base font-semibold text-zinc-100">4. Availability</h2>
          <p className="text-xs text-zinc-400 leading-relaxed">
            SoundSphere is provided on an as-is basis. Administrators may update catalog items, security controls, or storage limits to maintain service reliability.
          </p>
        </section>
      </div>
    </div>
  );
}
