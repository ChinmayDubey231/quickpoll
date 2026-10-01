import { useEffect, useState } from "react";

const pad = (n: number) => String(n).padStart(2, "0");

// Coarse while there's plenty of time left, down to the second in the last hour
const formatRemaining = (ms: number) => {
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hrs = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (days > 0) return `${days}d ${hrs}h`;
  if (hrs > 0) return `${hrs}h ${pad(mins)}m`;
  return `${mins}m ${pad(secs)}s`;
};

interface CountdownTimerProps {
  expiresAt: string;
  onExpired?: () => void;
}

// Time left before a poll closes itself, sized for the poll page's meta row.
// Not a live region: a label that changes every second would be read out
// every second.
export default function CountdownTimer({ expiresAt, onExpired }: CountdownTimerProps) {
  const [remaining, setRemaining] = useState(() => new Date(expiresAt).getTime() - Date.now());

  useEffect(() => {
    const tick = () => {
      const ms = new Date(expiresAt).getTime() - Date.now();
      setRemaining(ms);
      if (ms <= 0) {
        window.clearInterval(id);
        onExpired?.();
      }
    };
    const id = window.setInterval(tick, 1000);
    tick();
    return () => window.clearInterval(id);
  }, [expiresAt, onExpired]);

  if (remaining <= 0) return null;

  return (
    <span className={`tabular-nums transition-colors ${remaining < 60_000 ? "text-qp-error" : ""}`}>
      Closes in {formatRemaining(remaining)}
    </span>
  );
}
