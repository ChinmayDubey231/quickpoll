interface SkeletonCardProps {
  className?: string;
  lines?: number;
}

// Layout-stable loading placeholder — replaces full-page spinners on
// Dashboard's poll list and PollAnalytics so content doesn't jump on arrival.
export default function SkeletonCard({ className = '', lines = 3 }: SkeletonCardProps) {
  return (
    <div className={`glass-card rounded-2xl p-5 animate-pulse ${className}`}>
      <div className="h-4 w-2/3 bg-surface-container-high rounded mb-3" />
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-3 bg-surface-container-high rounded mb-2 last:mb-0"
          style={{ width: `${90 - i * 15}%` }}
        />
      ))}
    </div>
  );
}
