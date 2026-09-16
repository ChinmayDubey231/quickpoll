import { motion } from 'framer-motion';

// Slow-drifting gradient blobs used behind auth screens and the poll voting
// page to give the dark theme depth without competing with foreground content.
export default function AuroraBackground({ variant = 'default' }: { variant?: 'default' | 'compact' }) {
  const blobs =
    variant === 'compact'
      ? [
          { className: 'w-72 h-72 bg-primary-container/15 top-10 left-1/2 -translate-x-1/2', dx: 40, dy: 30, dur: 22 },
          { className: 'w-56 h-56 bg-secondary-container/10 bottom-0 right-1/4', dx: -30, dy: -20, dur: 26 },
        ]
      : [
          { className: 'w-[28rem] h-[28rem] bg-primary-container/15 top-[-6rem] left-1/4', dx: 60, dy: 40, dur: 24 },
          { className: 'w-96 h-96 bg-secondary-container/12 bottom-[-4rem] right-1/4', dx: -50, dy: -30, dur: 28 },
          { className: 'w-64 h-64 bg-tertiary-container/10 top-1/3 right-[10%]', dx: 30, dy: -40, dur: 20 },
        ];

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
      {blobs.map((b, i) => (
        <motion.div
          key={i}
          className={`absolute rounded-full blur-3xl ${b.className}`}
          animate={{ x: [0, b.dx, 0], y: [0, b.dy, 0] }}
          transition={{ duration: b.dur, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}
