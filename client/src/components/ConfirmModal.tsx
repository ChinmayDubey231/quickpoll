import { motion } from 'framer-motion';

interface ConfirmModalProps {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({ title, message, onConfirm, onCancel }: ConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />
      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 6 }}
        transition={{ type: 'spring', stiffness: 340, damping: 28 }}
        className="relative glass-card rounded-2xl p-6 w-full max-w-sm"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-error-container/20 border border-error/30 flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-error text-[20px]">
              delete
            </span>
          </div>
          <h2 className="font-display font-bold text-on-surface text-lg">
            {title}
          </h2>
        </div>
        <p className="text-sm text-on-surface-variant mb-6">{message}</p>
        <div className="flex gap-3">
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={onCancel}
            className="flex-1 py-2.5 border border-outline-variant text-on-surface-variant rounded-xl text-sm font-medium hover:bg-surface-container-high transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Cancel
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={onConfirm}
            className="flex-1 py-2.5 bg-error-container/20 border border-error/30 text-error rounded-xl text-sm font-bold hover:bg-error-container/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error"
          >
            Delete
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
