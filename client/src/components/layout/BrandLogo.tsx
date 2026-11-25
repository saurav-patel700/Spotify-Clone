export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 select-none">
      <svg
        width="28"
        height="28"
        viewBox="0 0 28 28"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        <rect x="1" y="1" width="26" height="26" rx="5" fill="#14171D" stroke="#262B36" strokeWidth="1.2" />
        <circle cx="14" cy="14" r="7.5" stroke="#10B981" strokeWidth="1.6" />
        <circle cx="14" cy="14" r="2.75" fill="#10B981" />
        <line x1="6" y1="14" x2="9.5" y2="14" stroke="#52525B" strokeWidth="1.4" />
        <line x1="18.5" y1="14" x2="22" y2="14" stroke="#52525B" strokeWidth="1.4" />
      </svg>
      {!compact && (
        <span className="text-[15px] font-semibold tracking-tight text-zinc-100">
          SoundSphere
        </span>
      )}
    </div>
  );
}

