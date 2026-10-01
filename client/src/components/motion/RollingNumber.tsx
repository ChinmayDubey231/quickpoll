// Each digit is keyed by its place and value, so only the digits that change
// remount and roll in. The digits are inline-blocks inside a plain inline span
// (not a flex container), so the number still reads and copies as one word.
export default function RollingNumber({ value, className = "" }: { value: number; className?: string }) {
  const chars = value.toLocaleString("en-US").split("");
  return (
    <span className={`whitespace-nowrap tabular-nums ${className}`}>
      {chars.map((ch, i) => (
        <span key={`${chars.length - i}:${ch}`} className="inline-block motion-safe:animate-qp-roll">
          {ch}
        </span>
      ))}
    </span>
  );
}
