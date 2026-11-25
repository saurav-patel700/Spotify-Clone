import { Link } from 'react-router-dom';
import { Play, Pause } from 'lucide-react';

interface MediaCardProps {
  title: string;
  subtitle: string;
  artworkUrl: string;
  to: string;
  badge?: string;
  isPlaying?: boolean;
  onPlayClick?: () => void;
}

export function MediaCard({
  title,
  subtitle,
  artworkUrl,
  to,
  badge,
  isPlaying = false,
  onPlayClick,
}: MediaCardProps) {
  return (
    <div className="group flex flex-col rounded-md border border-[#1F242D] bg-[#14171D] p-3 transition-colors hover:border-[#2E3542] hover:bg-[#191D25]">
      <div className="relative mb-3 aspect-square w-full overflow-hidden rounded-md bg-[#0E1014]">
        <Link to={to} className="block h-full w-full">
          <img
            src={artworkUrl}
            alt={title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </Link>
        {onPlayClick && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onPlayClick();
            }}
            aria-label={isPlaying ? `Pause ${title}` : `Play ${title}`}
            className={`absolute bottom-2.5 right-2.5 flex h-9 w-9 items-center justify-center rounded-md border transition-colors ${
              isPlaying
                ? 'border-emerald-400/50 bg-emerald-500 text-zinc-950'
                : 'border-[#2E3542] bg-[#0E1014]/95 text-zinc-100 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:border-emerald-500/60 hover:bg-emerald-500 hover:text-zinc-950'
            }`}
          >
            {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current ml-0.5" />}
          </button>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <Link
            to={to}
            className="truncate text-sm font-medium text-zinc-100 hover:text-emerald-400 transition-colors"
          >
            {title}
          </Link>
          {badge && (
            <span className="shrink-0 rounded border border-[#262B36] bg-[#0E1014] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
              {badge}
            </span>
          )}
        </div>
        <p className="mt-1 truncate text-xs text-zinc-400">{subtitle}</p>
      </div>
    </div>
  );
}

