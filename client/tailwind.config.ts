import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          base: '#0A0B0D',
          sidebar: '#0E1014',
          card: '#14171D',
          elevated: '#1B1F27',
          hover: '#222732',
        },
        border: {
          subtle: '#1F242D',
          strong: '#2E3542',
        },
        emerald: {
          accent: '#10B981',
          hover: '#059669',
          muted: '#064E3B',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;

