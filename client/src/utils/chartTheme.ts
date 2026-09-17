// Mirrors the MD3 color tokens defined in tailwind.config.js / index.css. Chart.js
// needs raw hex values (it can't consume Tailwind classes or CSS variables), so this
// is the single place those values are duplicated instead of being hardcoded per-chart.
export type ChartTheme = 'light' | 'dark';

const palettes: Record<ChartTheme, {
  primary: string;
  secondary: string;
  tertiary: string;
  error: string;
  surfaceContainer: string;
  outline: string;
  outlineVariant: string;
  onSurface: string;
  onSurfaceVariant: string;
  primaryContainer: string;
}> = {
  dark: {
    primary: '#cdbdff',
    secondary: '#44ddc1',
    tertiary: '#bdc2ff',
    error: '#ffb4ab',
    surfaceContainer: '#201f1f',
    outline: '#948ea1',
    outlineVariant: '#494455',
    onSurface: '#e5e2e1',
    onSurfaceVariant: '#cac3d8',
    primaryContainer: '#7c4dff',
  },
  light: {
    primary: '#6833ea',
    secondary: '#007a6a',
    tertiary: '#4a4593',
    error: '#ba1a1a',
    surfaceContainer: '#f2edf6',
    outline: '#79747e',
    outlineVariant: '#cac4d0',
    onSurface: '#1b1b1f',
    onSurfaceVariant: '#48454e',
    primaryContainer: '#6833ea',
  },
};

export const getChartColors = (theme: ChartTheme) => palettes[theme];

export const getSeriesColors = (theme: ChartTheme) => {
  const c = palettes[theme];
  return [c.primary, c.secondary, c.tertiary, c.error, c.primary, c.secondary] as const;
};

export const chartFonts = {
  mono: 'JetBrains Mono',
  body: 'Inter',
} as const;

export const getTooltipTheme = (theme: ChartTheme) => {
  const c = palettes[theme];
  return {
    backgroundColor: c.surfaceContainer,
    borderColor: c.outlineVariant,
    borderWidth: 1,
    titleColor: c.onSurfaceVariant,
    bodyColor: c.onSurface,
  } as const;
};
