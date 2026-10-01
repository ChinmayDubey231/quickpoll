import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';

type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  // `origin` is where the new theme's reveal starts, in viewport pixels
  toggleTheme: (origin?: { x: number; y: number }) => void;
}

const REVEAL_MS = 550;

const ThemeContext = createContext<ThemeContextValue | null>(null);

const getInitialTheme = (): Theme => {
  try {
    const stored = localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // ignore
  }
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  // A layout effect, so the class flips in the same frame React renders the
  // new theme rather than one frame later
  useLayoutEffect(() => {
    const root = document.documentElement;

    // Swap every colour at once. Most elements fade their colours (the global
    // transition in index.css), and text fading one way while its background
    // fades the other passes through a moment where the two match and the
    // text vanishes. Transitions are switched off just for the swap.
    const freeze = document.createElement('style');
    freeze.textContent = '*,*::before,*::after{transition:none!important}';
    document.head.appendChild(freeze);

    root.classList.toggle('dark', theme === 'dark');
    // index.html sets this before first paint; keep it in step after a toggle
    root.style.colorScheme = theme;

    // Reading a style makes the browser apply the new colours now, while
    // transitions are off; they come back on a moment later
    void window.getComputedStyle(document.body).backgroundColor;
    const restore = window.setTimeout(() => freeze.remove(), 1);

    try {
      localStorage.setItem('theme', theme);
    } catch {
      // ignore
    }

    return () => {
      window.clearTimeout(restore);
      freeze.remove();
    };
  }, [theme]);

  // The new theme spreads out in a circle from `origin` over the old one.
  // A crossfade would put text back through the same grey as its background
  // halfway, which is the flicker the swap above avoids; with a reveal every
  // pixel is always wholly one theme or the other. Browsers without view
  // transitions, and anyone who prefers reduced motion, get the instant swap.
  const toggleTheme = (origin?: { x: number; y: number }) => {
    const flip = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
    const canReveal =
      typeof document.startViewTransition === 'function' &&
      !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!canReveal) {
      flip();
      return;
    }

    // Without an origin, start from the top-right corner, where the toggle sits
    const x = origin?.x ?? window.innerWidth - 40;
    const y = origin?.y ?? 38;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

    const transition = document.startViewTransition(() => flushSync(flip));
    transition.ready
      .then(() => {
        document.documentElement.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
          { duration: REVEAL_MS, easing: 'cubic-bezier(.4, 0, .2, 1)', pseudoElement: '::view-transition-new(root)' },
        );
      })
      // Skipped (e.g. toggled again mid-reveal): the theme still changes, just without the animation
      .catch(() => {});
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
};
