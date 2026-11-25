type ArtworkVariant = 'rings' | 'grid' | 'horizon' | 'monolith' | 'diagonal' | 'strata' | 'waves' | 'prism';

interface ArtworkSpec {
  bg: string;
  surface: string;
  accent: string;
  muted: string;
  variant: ArtworkVariant;
  code: string;
}

const ARTWORK_MAP: Record<string, ArtworkSpec> = {
  'alb-quiet-telemetry': {
    bg: '#0E1217',
    surface: '#171E26',
    accent: '#10B981',
    muted: '#334155',
    variant: 'rings',
    code: 'QT-01',
  },
  'alb-glass-fjord': {
    bg: '#111418',
    surface: '#1A2028',
    accent: '#34D399',
    muted: '#475569',
    variant: 'horizon',
    code: 'GF-02',
  },
  'alb-subterranean-grid': {
    bg: '#0C0F12',
    surface: '#161B22',
    accent: '#059669',
    muted: '#2D3748',
    variant: 'grid',
    code: 'SG-03',
  },
  'alb-cedar-tape': {
    bg: '#141210',
    surface: '#211D18',
    accent: '#D97706',
    muted: '#57534E',
    variant: 'strata',
    code: 'CT-04',
  },
  'alb-northbound-signals': {
    bg: '#101414',
    surface: '#192221',
    accent: '#10B981',
    muted: '#3F4E4A',
    variant: 'diagonal',
    code: 'NS-05',
  },
  'alb-chamber-studies': {
    bg: '#121316',
    surface: '#1D1F24',
    accent: '#94A3B8',
    muted: '#3B4252',
    variant: 'monolith',
    code: 'CS-06',
  },
  'alb-night-transit': {
    bg: '#0B0D10',
    surface: '#151921',
    accent: '#14B8A6',
    muted: '#334155',
    variant: 'waves',
    code: 'NT-07',
  },
  'alb-stillwater': {
    bg: '#101316',
    surface: '#191E24',
    accent: '#6EE7B7',
    muted: '#475569',
    variant: 'prism',
    code: 'SW-08',
  },
  'art-kaito': {
    bg: '#0F1318',
    surface: '#182028',
    accent: '#10B981',
    muted: '#334155',
    variant: 'rings',
    code: 'KM',
  },
  'art-soraia': {
    bg: '#121519',
    surface: '#1D222A',
    accent: '#6EE7B7',
    muted: '#475569',
    variant: 'horizon',
    code: 'SL',
  },
  'art-vespera': {
    bg: '#0C0F13',
    surface: '#161B23',
    accent: '#059669',
    muted: '#2D3748',
    variant: 'grid',
    code: 'VC',
  },
  'art-nolan': {
    bg: '#141210',
    surface: '#221E19',
    accent: '#D97706',
    muted: '#57534E',
    variant: 'strata',
    code: 'NV',
  },
  'art-clara': {
    bg: '#101413',
    surface: '#1A221F',
    accent: '#34D399',
    muted: '#3F4E4A',
    variant: 'diagonal',
    code: 'CP',
  },
  'art-monolith': {
    bg: '#121316',
    surface: '#1E2026',
    accent: '#94A3B8',
    muted: '#3B4252',
    variant: 'monolith',
    code: 'MQ',
  },
  'pl-deep-work': {
    bg: '#0B0F12',
    surface: '#131A20',
    accent: '#10B981',
    muted: '#2B3642',
    variant: 'grid',
    code: 'DW',
  },
  'pl-late-night': {
    bg: '#0B0C0E',
    surface: '#14171C',
    accent: '#14B8A6',
    muted: '#2E3440',
    variant: 'waves',
    code: 'LN',
  },
  'pl-acoustic-morning': {
    bg: '#131210',
    surface: '#1F1D19',
    accent: '#D97706',
    muted: '#4B463F',
    variant: 'horizon',
    code: 'AM',
  },
  'pl-low-light': {
    bg: '#0F1115',
    surface: '#181C23',
    accent: '#34D399',
    muted: '#333B48',
    variant: 'monolith',
    code: 'LL',
  },
};

function renderPattern(spec: ArtworkSpec): string {
  switch (spec.variant) {
    case 'rings':
      return `
        <circle cx="200" cy="200" r="130" fill="none" stroke="${spec.muted}" stroke-width="1.5" opacity="0.55"/>
        <circle cx="200" cy="200" r="96" fill="none" stroke="${spec.accent}" stroke-width="2" opacity="0.85"/>
        <circle cx="200" cy="200" r="62" fill="${spec.surface}" stroke="${spec.muted}" stroke-width="1.5"/>
        <circle cx="200" cy="200" r="14" fill="${spec.accent}"/>
        <line x1="40" y1="200" x2="360" y2="200" stroke="${spec.muted}" stroke-width="1" opacity="0.35"/>
      `;
    case 'grid':
      return `
        <g stroke="${spec.muted}" stroke-width="1" opacity="0.45">
          <line x1="80" y1="40" x2="80" y2="360"/><line x1="140" y1="40" x2="140" y2="360"/>
          <line x1="200" y1="40" x2="200" y2="360"/><line x1="260" y1="40" x2="260" y2="360"/>
          <line x1="320" y1="40" x2="320" y2="360"/>
          <line x1="40" y1="80" x2="360" y2="80"/><line x1="40" y1="140" x2="360" y2="140"/>
          <line x1="40" y1="200" x2="360" y2="200"/><line x1="40" y1="260" x2="360" y2="260"/>
          <line x1="40" y1="320" x2="360" y2="320"/>
        </g>
        <rect x="140" y="140" width="120" height="120" fill="${spec.surface}" stroke="${spec.accent}" stroke-width="2"/>
        <rect x="180" y="180" width="40" height="40" fill="${spec.accent}"/>
      `;
    case 'horizon':
      return `
        <rect x="40" y="210" width="320" height="110" fill="${spec.surface}"/>
        <line x1="40" y1="210" x2="360" y2="210" stroke="${spec.accent}" stroke-width="2.5"/>
        <line x1="40" y1="234" x2="360" y2="234" stroke="${spec.muted}" stroke-width="1" opacity="0.6"/>
        <line x1="40" y1="258" x2="360" y2="258" stroke="${spec.muted}" stroke-width="1" opacity="0.4"/>
        <circle cx="200" cy="150" r="44" fill="none" stroke="${spec.accent}" stroke-width="2"/>
        <circle cx="200" cy="150" r="10" fill="${spec.accent}"/>
      `;
    case 'monolith':
      return `
        <rect x="88" y="70" width="56" height="260" fill="${spec.surface}" stroke="${spec.muted}" stroke-width="1.5"/>
        <rect x="172" y="100" width="56" height="230" fill="${spec.surface}" stroke="${spec.accent}" stroke-width="2"/>
        <rect x="256" y="135" width="56" height="195" fill="${spec.surface}" stroke="${spec.muted}" stroke-width="1.5"/>
        <rect x="172" y="100" width="56" height="16" fill="${spec.accent}"/>
      `;
    case 'diagonal':
      return `
        <g stroke="${spec.muted}" stroke-width="1.5" opacity="0.5">
          <line x1="60" y1="340" x2="340" y2="60"/>
          <line x1="100" y1="340" x2="340" y2="100"/>
          <line x1="60" y1="300" x2="300" y2="60"/>
        </g>
        <polygon points="120,280 280,120 280,280" fill="${spec.surface}" stroke="${spec.accent}" stroke-width="2"/>
        <circle cx="145" cy="145" r="18" fill="${spec.accent}"/>
      `;
    case 'strata':
      return `
        <rect x="64" y="88" width="272" height="32" fill="${spec.surface}" stroke="${spec.muted}" stroke-width="1"/>
        <rect x="64" y="138" width="272" height="32" fill="${spec.surface}" stroke="${spec.accent}" stroke-width="2"/>
        <rect x="64" y="188" width="200" height="32" fill="${spec.surface}" stroke="${spec.muted}" stroke-width="1"/>
        <rect x="64" y="238" width="272" height="32" fill="${spec.surface}" stroke="${spec.muted}" stroke-width="1"/>
        <rect x="284" y="188" width="52" height="32" fill="${spec.accent}"/>
      `;
    case 'waves':
      return `
        <path d="M40 160 Q 120 110, 200 160 T 360 160" fill="none" stroke="${spec.muted}" stroke-width="1.5"/>
        <path d="M40 200 Q 120 150, 200 200 T 360 200" fill="none" stroke="${spec.accent}" stroke-width="2.5"/>
        <path d="M40 240 Q 120 190, 200 240 T 360 240" fill="none" stroke="${spec.muted}" stroke-width="1.5"/>
        <rect x="192" y="192" width="16" height="16" fill="${spec.accent}"/>
      `;
    case 'prism':
      return `
        <polygon points="200,72 316,288 84,288" fill="${spec.surface}" stroke="${spec.muted}" stroke-width="1.5"/>
        <polygon points="200,122 272,262 128,262" fill="none" stroke="${spec.accent}" stroke-width="2"/>
        <line x1="200" y1="72" x2="200" y2="288" stroke="${spec.muted}" stroke-width="1" opacity="0.6"/>
        <circle cx="200" cy="212" r="10" fill="${spec.accent}"/>
      `;
  }
}

const artworkCache = new Map<string, string>();

export function getArtworkUrl(key: string): string {
  const existing = artworkCache.get(key);
  if (existing) return existing;

  const spec: ArtworkSpec = ARTWORK_MAP[key] ?? {
    bg: '#101317',
    surface: '#181C22',
    accent: '#10B981',
    muted: '#334155',
    variant: 'monolith',
    code: key.slice(0, 4).toUpperCase(),
  };

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
    <rect width="400" height="400" fill="${spec.bg}"/>
    <rect x="24" y="24" width="352" height="352" fill="none" stroke="${spec.muted}" stroke-width="1" opacity="0.4"/>
    ${renderPattern(spec)}
    <text x="40" y="56" fill="#94A3B8" font-family="Inter, system-ui, sans-serif" font-size="13" font-weight="600" letter-spacing="2">${spec.code}</text>
    <rect x="336" y="44" width="24" height="4" fill="${spec.accent}"/>
  </svg>`;

  const url = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  artworkCache.set(key, url);
  return url;
}

