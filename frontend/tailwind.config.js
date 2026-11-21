/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        editorial: ['"Newsreader"', '"Cormorant Garamond"', 'Georgia', 'serif'],
        instrument: ['"Instrument Serif"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
        handwriting: ['"Caveat"', 'cursive'],
      },
      colors: {
        obsidian: '#07090E',
        panel: '#0E131F',
        hairline: '#1E293B',
        botanical: {
          dark: '#141D18',
          hero: '#18241E',
          card: '#1C2922',
          border: '#25352C',
        },
        ivory: {
          DEFAULT: '#F6F4EE',
          card: '#FFFFFF',
          border: '#E3E1D8',
          sage: '#EBF0EC',
          warm: '#FBF9F4',
        },
        champagne: {
          gold: '#D8BE8B',
          hover: '#E2CE9F',
          dark: '#C4A468',
        },
      },
    },
  },
  plugins: [],
};
