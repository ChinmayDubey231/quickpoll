import { useEffect, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { MotionConfig, motion, type Transition } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import Logo from "./Logo";
import NavIcon, { type NavIconName } from "./motion/NavIcon";
import ThemeButton from "./ThemeButton";

const navItems: Array<{ icon: NavIconName; label: string; path: string }> = [
  { icon: "dashboard", label: "Dashboard", path: "/dashboard" },
  { icon: "create", label: "New Poll", path: "/create" },
  { icon: "discover", label: "Discover", path: "/discover" },
];

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-qp-accent focus-visible:ring-offset-2 focus-visible:ring-offset-qp-bg";

// The active-item highlight glides between links rather than jumping
const navSpring: Transition = { type: "spring", stiffness: 400, damping: 32 };

// The shell uses the brand palette (.qp-ui). Page content keeps its own styles;
// the header is 76px tall and the lg+ sidebar is clamp(188px,18vw,232px) wide,
// which is what <main> offsets itself by.
export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout, isLoggedIn } = useAuth();
  const { pathname } = useLocation();

  // The shell itself no longer uses Material Symbols, but the pages inside do;
  // start fetching the font now so their icons don't flash as ligature text.
  useEffect(() => {
    document.fonts?.load('24px "Material Symbols Outlined"').catch(() => {});
  }, []);

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "?";

  // Straight to where "/" would redirect. The "/" route sits outside this
  // shell's layout route, so linking there unmounts the header and sidebar for
  // the redirect and remounts them, replaying their entrance animation.
  const home = isLoggedIn ? "/dashboard" : "/login";

  return (
    <MotionConfig reducedMotion="user">
      <div className="qp-ui min-h-screen bg-qp-bg">
        <motion.header
          initial={{ y: -16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="fixed inset-x-0 top-0 z-50 flex h-[76px] items-center justify-between gap-4 border-b border-qp-line bg-qp-bg px-[clamp(16px,2.5vw,32px)] font-brand text-qp-ink"
        >
          <Link to={home} className={`flex items-center gap-2.5 rounded-lg ${focusRing}`}>
            <motion.span
              whileHover={{ rotate: -6, scale: 1.05 }}
              transition={{ type: "spring", stiffness: 300, damping: 15 }}
              className="flex"
            >
              <Logo size={28} />
            </motion.span>
            <span className="text-xl font-semibold tracking-[-0.02em]">QuickPoll</span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-4">
            <ThemeButton />
            {isLoggedIn ? (
              <>
                <div className="flex items-center gap-2.5 text-[15px] font-medium">
                  <motion.span
                    whileHover={{ scale: 1.08 }}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-qp-line bg-qp-panel font-brand-mono text-xs font-bold"
                  >
                    {initials}
                  </motion.span>
                  <span className="hidden whitespace-nowrap sm:block">{user?.name}</span>
                </div>
                <button
                  type="button"
                  onClick={logout}
                  aria-label="Sign out"
                  className={`group grid h-10 w-10 place-items-center rounded-full text-qp-muted transition-colors hover:bg-qp-track hover:text-qp-ink lg:hidden ${focusRing}`}
                >
                  <NavIcon name="logout" size={18} />
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className={`flex h-10 items-center rounded-[10px] px-4 text-[15px] font-semibold text-qp-accent-ink transition-colors hover:bg-qp-track ${focusRing}`}
              >
                Log in
              </Link>
            )}
          </div>
        </motion.header>

        <aside className="fixed bottom-0 left-0 top-[76px] z-40 hidden w-[clamp(188px,18vw,232px)] flex-col border-r border-qp-line px-[clamp(10px,1.2vw,16px)] py-6 font-brand lg:flex">
          <nav aria-label="Main" className="flex flex-col gap-1">
            {navItems.map((item) => {
              const active = pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex h-11 items-center gap-3 rounded-[10px] px-3 text-[15px] ${focusRing} ${
                    active
                      ? "font-semibold text-qp-ink"
                      : "font-medium text-qp-muted transition-colors hover:bg-qp-track hover:text-qp-ink"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-active"
                      transition={navSpring}
                      className="absolute inset-0 rounded-[10px] bg-qp-track"
                    >
                      <span className="absolute bottom-3 left-0 top-3 w-[3px] rounded-sm bg-qp-accent" />
                    </motion.span>
                  )}
                  <NavIcon name={item.icon} active={active} size={18} />
                  <span className="relative">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {isLoggedIn && (
            <button
              type="button"
              onClick={logout}
              className={`group mt-auto flex h-11 items-center gap-3 rounded-[10px] px-3 text-[15px] font-medium text-qp-muted transition-colors hover:bg-qp-track hover:text-qp-ink ${focusRing}`}
            >
              <NavIcon name="logout" size={18} />
              Sign out
            </button>
          )}
        </aside>

        <main className="px-[clamp(20px,4vw,56px)] pb-24 pt-[92px] lg:ml-[clamp(188px,18vw,232px)] lg:pb-16">
          <div className="mx-auto max-w-[1120px]">{children}</div>
        </main>

        {/* Fixed at h-16 so pages can pin their own bars just above it (bottom-16) */}
        <nav
          aria-label="Main"
          className="fixed inset-x-0 bottom-0 z-50 flex h-16 items-center justify-around border-t border-qp-line bg-qp-bg px-4 font-brand lg:hidden"
        >
          {navItems.map((item) => {
            const active = pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                aria-current={active ? "page" : undefined}
                className={`relative flex flex-col items-center gap-0.5 rounded-lg px-4 py-1 ${focusRing} ${
                  active ? "text-qp-ink" : "text-qp-muted transition-colors hover:text-qp-ink"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active-mobile"
                    transition={navSpring}
                    className="absolute inset-0 rounded-lg bg-qp-track"
                  />
                )}
                <NavIcon name={item.icon} active={active} size={22} />
                <span className="relative text-[11px] font-semibold">{item.label}</span>
              </Link>
            );
          })}
          {isLoggedIn && (
            <button
              type="button"
              onClick={logout}
              className={`group flex flex-col items-center gap-0.5 rounded-lg px-4 py-1 text-qp-muted transition-colors hover:text-qp-ink ${focusRing}`}
            >
              <NavIcon name="logout" size={22} />
              <span className="text-[11px] font-semibold">Sign out</span>
            </button>
          )}
        </nav>
      </div>
    </MotionConfig>
  );
}
