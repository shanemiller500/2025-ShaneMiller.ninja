/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        inter: ['var(--font-inter)', 'sans-serif'],
        aspekta: ['var(--font-aspekta)', 'sans-serif'],
      },
      colors: {
        slate: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
        brand: {
          100: '#F3F4F6',
          200: '#E5E7EB',
          300: '#BFC4CD',
          400: '#9CA3AF',
          500: '#6B7280',
          600: '#4B5563',
          700: '#374151',
          800: '#7F64BA', // Purple accent
          900: '#1D1D20', // Background black
          950: 'rgb(126 126 126 / 7%)',
          101: 'rgb(199 210 254 / 65%)',
        },
        // Chart colors - for data visualization
        chart: {
          blue: '#38a1db',
          red: '#e53e3e',
          temperature: '#ff6384',
          snowfall: '#ffce56',
          rain: '#ff9f40',
          showers: '#c9cbcf',
          price: '#38a1db',
          percent: '#e53e3e',
        },
        // Accent colors
        accent: {
          gold: '#ffd700',
          indigo: '#6366f1',
          purple: '#7F64BA',
        },
        // Surface colors for cards, overlays, etc.
        surface: {
          dark: '#111827',
          darker: '#0f172a',
          darkest: '#1d1d20',
          overlay: 'rgba(15, 23, 42, 0.72)',
          'overlay-light': 'rgba(30, 41, 59, 0.55)',
          'overlay-heavy': 'rgba(15, 23, 42, 0.86)',
        },
        // Grid and border colors
        grid: {
          light: 'rgba(0, 0, 0, 0.05)',
          dark: 'rgba(255, 255, 255, 0.06)',
        },
        // Border colors with opacity
        border: {
          subtle: 'rgba(255, 255, 255, 0.14)',
          shadow: 'rgba(0, 0, 0, 0.35)',
        },
      },
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1.5' }],
        sm: ['0.875rem', { lineHeight: '1.5715' }],
        base: ['1rem', { lineHeight: '1.5', letterSpacing: '-0.01em' }],
        lg: ['1.125rem', { lineHeight: '1.5', letterSpacing: '-0.01em' }],
        xl: ['1.25rem', { lineHeight: '1.5', letterSpacing: '-0.01em' }],
        '2xl': ['1.5rem', { lineHeight: '1.415', letterSpacing: '-0.01em' }],
        '3xl': ['1.875rem', { lineHeight: '1.333', letterSpacing: '-0.01em' }],
        '4xl': ['2.25rem', { lineHeight: '1.277', letterSpacing: '-0.01em' }],
        '5xl': ['3rem', { lineHeight: '1', letterSpacing: '-0.01em' }],
        '6xl': ['3.75rem', { lineHeight: '1', letterSpacing: '-0.01em' }],
        '7xl': ['4.5rem', { lineHeight: '1', letterSpacing: '-0.01em' }],
      },
      letterSpacing: {
        tighter: '-0.02em',
        tight: '-0.01em',
        normal: '0',
        wide: '0.01em',
        wider: '0.02em',
        widest: '0.4em',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
    function ({ addUtilities }) {
      addUtilities({
        '.bg-brand-gradient': {
          '@apply bg-gradient-to-r from-indigo-600 to-purple-600': {},
        },
      });
    },
  ],
};
