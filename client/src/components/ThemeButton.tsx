import { AnimatePresence, motion } from "framer-motion";
import { useTheme } from "../context/ThemeContext";

// Sun/moon toggle for the screens styled with the .qp-ui palette. It shows the
// theme you'd switch to, the icon spins through whenever it changes, and the
// new theme spreads out from the button.
export default function ThemeButton() {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === "dark";
  const label = dark ? "Switch to light theme" : "Switch to dark theme";

  return (
    <motion.button
      type="button"
      onClick={(e) => {
        // The new theme is revealed from the centre of this button
        const r = e.currentTarget.getBoundingClientRect();
        toggleTheme({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
      }}
      whileTap={{ scale: 0.92 }}
      aria-label={label}
      title={label}
      className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full border border-qp-line text-qp-ink hover:bg-qp-track focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-qp-accent focus-visible:ring-offset-2 focus-visible:ring-offset-qp-bg"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.svg
          key={theme}
          initial={{ opacity: 0, rotate: -90, scale: 0.6 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 90, scale: 0.6 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {dark ? (
            <>
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
            </>
          ) : (
            <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
          )}
        </motion.svg>
      </AnimatePresence>
    </motion.button>
  );
}
