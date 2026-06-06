import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip } from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip);

export default function VoteTimelineChart({ timeline = [] }) {
  if (timeline.length === 0) return (
    <div className="flex items-center justify-center h-40 text-sm text-on-surface-variant font-mono">
      No timeline data yet
    </div>
  );

  const chartData = {
    labels: timeline.map(t => t.time),
    datasets: [{
      data: timeline.map(t => t.votes),
      borderColor: '#7c4dff',
      backgroundColor: 'rgba(124, 77, 255, 0.08)',
      borderWidth: 2,
      pointBackgroundColor: '#cdbdff',
      pointBorderColor: '#7c4dff',
      pointRadius: 4,
      pointHoverRadius: 6,
      tension: 0.35,
      fill: true,
    }],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 500 },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#201f1f',
        borderColor: '#494455',
        borderWidth: 1,
        titleColor: '#cac3d8',
        bodyColor: '#e5e2e1',
        callbacks: {
          label: ctx => ` ${ctx.parsed.y} vote${ctx.parsed.y !== 1 ? 's' : ''}`,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { stepSize: 1, precision: 0, color: '#948ea1', font: { family: 'JetBrains Mono', size: 11 } },
        grid: { color: '#30363D' },
        border: { color: '#494455' },
      },
      x: {
        grid: { display: false },
        border: { color: '#494455' },
        ticks: { maxRotation: 30, maxTicksLimit: 8, color: '#cac3d8', font: { family: 'JetBrains Mono', size: 10 } },
      },
    },
  };

  return (
    <div className="relative w-full flex-1" style={{ height: 200 }}>
      <Line data={chartData} options={options} />
    </div>
  );
}
