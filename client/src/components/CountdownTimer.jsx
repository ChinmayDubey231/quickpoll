import { useEffect, useState } from 'react';

const pad = (n) => String(n).padStart(2, '0');

const formatRemaining = (ms) => {
  if (ms <= 0) return null;
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hrs = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (days > 0) return `${days}d ${pad(hrs)}h ${pad(mins)}m`;
  if (hrs > 0) return `${pad(hrs)}h ${pad(mins)}m ${pad(secs)}s`;
  return `${pad(mins)}m ${pad(secs)}s`;
};

export default function CountdownTimer({ expiresAt, onExpired }) {
  const [remaining, setRemaining] = useState(() =>
    expiresAt ? new Date(expiresAt).getTime() - Date.now() : null
  );

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const ms = new Date(expiresAt).getTime() - Date.now();
      setRemaining(ms);
      if (ms <= 0) onExpired?.();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt, onExpired]);

  if (!expiresAt) return null;
  const label = formatRemaining(remaining);
  const isUrgent = remaining < 60_000;

  if (!label) return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-error-container/20 border border-error/30 rounded-full text-[10px] font-mono font-bold text-error">
      <span className="w-1.5 h-1.5 rounded-full bg-error" />Expired
    </span>
  );

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold border ${
      isUrgent
        ? 'bg-error-container/20 border-error/30 text-error'
        : 'bg-surface-container border-outline-variant text-on-surface-variant'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${isUrgent ? 'bg-error animate-pulse' : 'bg-secondary'}`} />
      {label} left
    </span>
  );
}
