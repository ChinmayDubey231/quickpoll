import { useEffect, useRef } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip } from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

const COLORS = ['#cdbdff', '#44ddc1', '#bdc2ff', '#ffb4ab', '#cdbdff', '#44ddc1'];

export default function LiveBarChart({ options = [], counts = [] }) {
  const chartRef = useRef(null);

  const data = options.map((_, i) => counts.find(c => c.optionIndex === i)?.count ?? 0);
  const total = data.reduce((s, n) => s + n, 0);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.data.datasets[0].data = data;
    chart.update('active');
  }, [counts]); // eslint-disable-line

  const chartData = {
    labels: options.map(o => o.text),
    datasets: [{
      data,
      backgroundColor: options.map((_, i) => COLORS[i % COLORS.length] + 'cc'),
      borderColor: options.map((_, i) => COLORS[i % COLORS.length]),
      borderWidth: 1,
      borderRadius: 6,
      borderSkipped: false,
    }],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 400 },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#201f1f',
        borderColor: '#494455',
        borderWidth: 1,
        titleColor: '#cac3d8',
        bodyColor: '#e5e2e1',
        callbacks: {
          label: ctx => {
            const v = ctx.parsed.y;
            const pct = total > 0 ? Math.round((v / total) * 100) : 0;
            return ` ${v} vote${v !== 1 ? 's' : ''} (${pct}%)`;
          },
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
        ticks: {
          color: '#cac3d8',
          font: { family: 'Inter', size: 12 },
          maxRotation: 0,
          callback: function(val) {
            const label = this.getLabelForValue(val);
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
