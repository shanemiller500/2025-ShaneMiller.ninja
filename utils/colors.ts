/**
 * Centralized color definitions for the application.
 * These colors are also defined in tailwind.config.js for use with Tailwind classes.
 * Use these constants when you need programmatic color values (Chart.js, Leaflet, etc.)
 */

// Chart colors - for data visualization
export const chartColors = {
  blue: '#38a1db',
  red: '#e53e3e',
  temperature: '#ff6384',
  snowfall: '#ffce56',
  rain: '#ff9f40',
  showers: '#c9cbcf',
  price: '#38a1db',
  percent: '#e53e3e',
} as const;

// Chart colors with alpha for fills/backgrounds
export const chartColorsRgba = {
  temperature: {
    solid: 'rgba(255, 99, 132, 1)',
    light: 'rgba(255, 99, 132, 0.2)',
    medium: 'rgba(255, 99, 132, 0.6)',
  },
  snowfall: {
    solid: 'rgba(255, 206, 86, 1)',
    light: 'rgba(255, 206, 86, 0.2)',
    medium: 'rgba(255, 206, 86, 0.6)',
  },
  rain: {
    solid: 'rgba(255, 159, 64, 1)',
    light: 'rgba(255, 159, 64, 0.2)',
    medium: 'rgba(255, 159, 64, 0.6)',
  },
  showers: {
    solid: 'rgba(201, 203, 207, 1)',
    light: 'rgba(201, 203, 207, 0.2)',
    medium: 'rgba(201, 203, 207, 0.6)',
  },
  price: {
    solid: 'rgb(56, 161, 219)',
    fill: 'rgba(56, 161, 219, 0.14)',
  },
  percent: {
    solid: 'rgb(229, 62, 62)',
    fill: 'rgba(229, 62, 62, 0.14)',
  },
} as const;

// Accent colors
export const accentColors = {
  gold: '#ffd700',
  indigo: '#6366f1',
  purple: '#7F64BA',
} as const;

// Surface colors for cards, overlays, etc.
export const surfaceColors = {
  dark: '#111827',
  darker: '#0f172a',
  darkest: '#1d1d20',
  overlay: 'rgba(15, 23, 42, 0.72)',
  overlayLight: 'rgba(30, 41, 59, 0.55)',
  overlayHeavy: 'rgba(15, 23, 42, 0.86)',
} as const;

// Grid and axis colors
export const gridColors = {
  light: 'rgba(0, 0, 0, 0.05)',
  dark: 'rgba(255, 255, 255, 0.06)',
} as const;

// Border colors with opacity
export const borderColors = {
  subtle: 'rgba(255, 255, 255, 0.14)',
  shadow: 'rgba(0, 0, 0, 0.35)',
} as const;

// ISS Tracker specific colors
export const issColors = {
  trail: '#6366f1',
  terminator: '#000000',
  startMarker: {
    stroke: '#111827',
    fill: '#ffffff',
  },
} as const;

// Status colors for tables/grids (with opacity for flash effects)
export const statusColors = {
  positive: {
    flash: 'rgba(16, 185, 129, 0.18)',
    flashOverlay: 'rgba(255, 255, 255, 0.85)',
  },
  negative: {
    flash: 'rgba(244, 63, 94, 0.18)',
    flashOverlay: 'rgba(0, 0, 0, 0.30)',
  },
  neutral: 'rgba(0, 0, 0, 0)',
} as const;

// Weather map specific colors (for CSS-in-JS)
export const weatherMapColors = {
  topbar: {
    background: 'linear-gradient(135deg, rgba(15,23,42,.72), rgba(30,41,59,.55))',
    border: 'rgba(255,255,255,.08)',
  },
  pin: {
    background: 'rgba(15, 23, 42, 0.86)',
    border: 'rgba(255,255,255,.14)',
    shadow: 'rgba(0,0,0,.35)',
    text: 'rgba(255,255,255,.92)',
  },
  popup: {
    title: '#0f172a',
    pill: {
      background: 'rgba(15,23,42,.08)',
      text: 'rgba(15,23,42,.85)',
    },
    sub: 'rgba(15,23,42,.65)',
  },
  scrollbar: {
    thumb: 'rgba(255,255,255,.12)',
    track: 'rgba(255,255,255,.06)',
  },
} as const;

// Vibroacoustics/3D visualization colors
export const visualizationColors = {
  chladni: {
    board: '#333333',
    particle: '#ffd700', // Same as accentColors.gold
  },
} as const;

// Weather forecast card gradients
export const weatherGradients = {
  sunny: 'linear-gradient(135deg, #fceabb 0%, #f7b733 100%)',
  cloudy: 'linear-gradient(135deg, #83a4d4 0%, #b6fbff 100%)',
  foggy: 'linear-gradient(135deg, #d7d2cc 0%, #304352 100%)',
  rainy: 'linear-gradient(135deg, #2c3e50 0%, #4ca1af 100%)',
  snowy: 'linear-gradient(135deg, #e6dada 0%, #bdc3c7 100%)',
  stormy: 'linear-gradient(135deg, #283048 0%, #859398 100%)',
  neutral: 'linear-gradient(135deg, #ece9e6 0%, #ffffff 100%)',
} as const;

// Heatmap radial gradient colors for crypto
export const heatmapColors = {
  positive: {
    center: 'rgba(16, 185, 129, 0.85)',
    middle: 'rgba(16, 185, 129, 0.25)',
    edge: 'rgba(16, 185, 129, 0)',
  },
  negative: {
    center: 'rgba(244, 63, 94, 0.85)',
    middle: 'rgba(244, 63, 94, 0.25)',
    edge: 'rgba(244, 63, 94, 0)',
  },
} as const;

// Conic gradient for gauges (Fear/Greed index)
export const gaugeGradient = (pct: number) =>
  `conic-gradient(currentColor ${pct * 3.6}deg, #e5e7eb ${pct * 3.6}deg)`;

// Export all colors as a single object for convenience
export const colors = {
  chart: chartColors,
  chartRgba: chartColorsRgba,
  accent: accentColors,
  surface: surfaceColors,
  grid: gridColors,
  border: borderColors,
  iss: issColors,
  status: statusColors,
  weatherMap: weatherMapColors,
  visualization: visualizationColors,
  weatherGradients: weatherGradients,
  heatmap: heatmapColors,
} as const;

export default colors;
