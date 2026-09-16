import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

interface ErrorStateProps {
  icon?: string;
  title: string;
  description?: string;
  backTo?: string;
  backLabel?: string;
}

// Shared "not found" / error-page layout — used by PollView and PollAnalytics,
// which previously duplicated near-identical icon+message+back-link markup.
export default function ErrorState({
  icon = 'error',
  title,
  description,
  backTo,
  backLabel = 'Go back',
}: ErrorStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4"
    >
      <motion.div
        initial={{ scale: 0.7 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.05 }}
        className="w-16 h-16 bg-surface-container rounded-full flex items-center justify-center mb-4 border border-outline-variant"
      >
        <span className="material-symbols-outlined text-3xl text-error">{icon}</span>
      </motion.div>
      <h2 className="font-display font-bold text-on-surface text-lg mb-1">{title}</h2>
      {description && <p className="text-sm text-on-surface-variant mb-4 max-w-sm">{description}</p>}
      {backTo && (
        <Link
          to={backTo}
          className="text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
        >
          {backLabel}
        </Link>
      )}
    </motion.div>
  );
}
