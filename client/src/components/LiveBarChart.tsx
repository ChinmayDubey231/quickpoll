import { useEffect, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { chartColors, seriesColors, chartFonts, tooltipTheme } from '../utils/chartTheme';
import type { OptionDTO, OptionCountDTO } from '../types/api';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

interface LiveBarChartProps {
  options?: OptionDTO[];
  counts?: OptionCountDTO[];
}

export default function LiveBarChart({ options = [], counts = [] }: LiveBarChartProps) {
  const chartRef = useRef<ChartJS<'bar'> | null>(null);

  const data = options.map((_, i) => counts.find((c) => c.optionIndex === i)?.count ?? 0);
  const total = data.reduce((s, n) => s + n, 0);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.data.datasets[0].data = data;
    chart.update('active');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counts]);

  const chartData: ChartData<'bar'> = {
    labels: options.map((o) => o.text),
    datasets: [{
      data,
      backgroundColor: options.map((_, i) => seriesColors[i % seriesColors.length] + 'cc'),
      borderColor: options.map((_, i) => seriesColors[i % seriesColors.length]),
      borderWidth: 1,
      borderRadius: 6,
      borderSkipped: false,
    }],
  };

  const chartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 400 },
    plugins: {
      legend: { display: false },
      tooltip: {
        ...tooltipTheme,
        callbacks: {
          label: (ctx) => {
            const v = ctx.parsed.y ?? 0;
            const pct = total > 0 ? Math.round((v / total) * 100) : 0;
            return ` ${v} vote${v !== 1 ? 's' : ''} (${pct}%)`;
          },
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
        ticks: {
          color: chartColors.onSurfaceVariant,
          font: { family: chartFonts.body, size: 12 },
          maxRotation: 0,
          callback: function (val) {
            const label = this.getLabelForValue(Number(val));
            return label.length > 16 ? label.slice(0, 14) + '…' : label;
          },
        },
      },
    },
  };

  return (
    <div className="relative w-full" style={{ height: 220 }}>
      <Bar ref={chartRef} data={chartData} options={chartOptions} />
    </div>
  );
}
