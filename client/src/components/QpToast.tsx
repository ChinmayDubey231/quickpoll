import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";

// Bottom-centre toast for the pages styled with the .qp-ui palette. One toast at
// a time: a new one replaces the current one.

export interface QpToastAction {
  label: string;
  onClick: () => void;
}

interface ShowOptions {
  action?: QpToastAction;
  duration?: number;
  // Draw a bar that drains over `duration`, e.g. for an undo window
  countdown?: boolean;
}

export interface QpToastState {
  id: number;
  text: string;
  action?: QpToastAction;
  duration: number;
  countdown: boolean;
}

const DEFAULT_MS = 3000;

export function useQpToast() {
  const [toast, setToast] = useState<QpToastState | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const showToast = useCallback((text: string, { action, duration = DEFAULT_MS, countdown = false }: ShowOptions = {}) => {
    window.clearTimeout(timer.current);
    setToast((prev) => ({ id: (prev?.id ?? 0) + 1, text, action, duration, countdown }));
    timer.current = window.setTimeout(() => setToast(null), duration);
  }, []);

  const hideToast = useCallback(() => {
    window.clearTimeout(timer.current);
    setToast(null);
  }, []);

  return { toast, showToast, hideToast };
}

// Portalled so it stays pinned to the viewport while the page animates; it
// carries .qp-ui because it renders outside the shell that defines the palette.
// `className` positions it — pages with their own bottom bar lift it clear.
export default function QpToast({ toast, className = "bottom-24 lg:bottom-8" }: { toast: QpToastState | null; className?: string }) {
  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className={`qp-ui pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-4 font-brand ${className}`}
    >
      <AnimatePresence mode="wait">
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98, transition: { duration: 0.15 } }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className={`pointer-events-auto relative flex max-w-full items-center gap-4 overflow-hidden rounded-xl bg-qp-ink py-3 pl-[18px] text-[15px] text-qp-bg shadow-[0_20px_50px_-20px_rgba(0,0,0,.6)] ${
              toast.action ? "pr-3" : "pr-[18px]"
            }`}
          >
            <span>{toast.text}</span>
            {toast.action && (
              <button
                type="button"
                onClick={toast.action.onClick}
                className="h-8 shrink-0 whitespace-nowrap rounded-lg px-3 font-semibold underline underline-offset-2 transition-colors hover:bg-qp-bg/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-qp-accent"
              >
                {toast.action.label}
              </button>
            )}
            {toast.countdown && (
              <motion.span
                aria-hidden="true"
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration: toast.duration / 1000, ease: "linear" }}
                className="absolute inset-x-0 bottom-0 h-[2px] origin-left bg-qp-accent"
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body,
  );
}
