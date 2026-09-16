import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export default function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center py-16 text-center"
    >
      <motion.div
        initial={{ scale: 0.7, rotate: -8 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.05 }}
        className="w-16 h-16 bg-surface-container rounded-full flex items-center justify-center mb-4 border border-outline-variant"
      >
        <span className="material-symbols-outlined text-3xl text-on-surface-variant">ballot</span>
      </motion.div>
      <h3 className="font-display font-semibold text-on-surface mb-1">{title}</h3>
      {description && <p className="text-sm text-on-surface-variant mb-4">{description}</p>}
      {action}
    </motion.div>
  );
}
