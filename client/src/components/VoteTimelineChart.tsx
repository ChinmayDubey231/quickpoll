import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { chartColors, chartFonts, tooltipTheme } from '../utils/chartTheme';
import type { AnalyticsTimelinePointDTO } from '../types/api';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip);

interface VoteTimelineChartProps {
  timeline?: AnalyticsTimelinePointDTO[];
}

export default function VoteTimelineChart({ timeline = [] }: VoteTimelineChartProps) {
  if (timeline.length === 0) return (
    <div className="flex items-center justify-center h-40 text-sm text-on-surface-variant font-mono">
      No timeline data yet
    </div>
  );

  const chartData: ChartData<'line'> = {
    labels: timeline.map((t) => t.time),
    datasets: [{
      data: timeline.map((t) => t.votes),
      borderColor: chartColors.primaryContainer,
      backgroundColor: 'rgba(124, 77, 255, 0.08)',
      borderWidth: 2,
      pointBackgroundColor: chartColors.primary,
      pointBorderColor: chartColors.primaryContainer,
      pointRadius: 4,
      pointHoverRadius: 6,
      tension: 0.35,
      fill: true,
    }],
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 500 },
    plugins: {
      legend: { display: false },
      tooltip: {
        ...tooltipTheme,
        callbacks: {
          label: (ctx) => ` ${ctx.parsed.y} vote${ctx.parsed.y !== 1 ? 's' : ''}`,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { stepSize: 1, precision: 0, color: chartColors.outline, font: { family: chartFonts.mono, size: 11 } },
        grid: { color: chartColors.outlineVariant },
        border: { color: chartColors.outlineVariant },
      },
      x: {
        grid: { display: false },
        border: { color: chartColors.outlineVariant },
        ticks: { maxRotation: 30, maxTicksLimit: 8, color: chartColors.onSurfaceVariant, font: { family: chartFonts.mono, size: 10 } },
      },
    },
  };

  return (
    <div className="relative w-full flex-1" style={{ height: 200 }}>
      <Line data={chartData} options={options} />
    </div>
  );
}
