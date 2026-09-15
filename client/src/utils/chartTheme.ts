// Mirrors the MD3 color tokens defined in tailwind.config.js. Chart.js needs
// raw hex values (it can't consume Tailwind classes), so this is the single
// place those values are duplicated instead of being hardcoded per-chart.
export const chartColors = {
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
} as const;

export const seriesColors = [
  chartColors.primary,
  chartColors.secondary,
  chartColors.tertiary,
  chartColors.error,
  chartColors.primary,
  chartColors.secondary,
] as const;

export const chartFonts = {
  mono: 'JetBrains Mono',
  body: 'Inter',
} as const;

export const tooltipTheme = {
  backgroundColor: chartColors.surfaceContainer,
  borderColor: chartColors.outlineVariant,
  borderWidth: 1,
  titleColor: chartColors.onSurfaceVariant,
  bodyColor: chartColors.onSurface,
} as const;
