import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import Logo from "./Logo";

const navItems = [
  { icon: "dashboard", label: "Dashboard", path: "/dashboard" },
  { icon: "add_circle", label: "New Poll", path: "/create" },
  { icon: "explore", label: "Discover", path: "/discover" },
];

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout, isLoggedIn } = useAuth();
  const { pathname } = useLocation();

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "?";

  return (
    <div className="min-h-screen bg-[#0B0E14]">
      {/* Top nav */}
      <motion.header
        initial={{ y: -16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="fixed top-0 w-full z-50 flex justify-between items-center px-4 md:px-8 h-16 bg-surface/90 backdrop-blur-md border-b border-outline-variant"
      >
        {/* Logo + wordmark */}
        <Link to="/" className={`flex items-center gap-2.5 rounded-lg ${focusRing}`}>
          <motion.div whileHover={{ rotate: -6, scale: 1.05 }} transition={{ type: "spring", stiffness: 300, damping: 15 }}>
            <Logo size={28} />
          </motion.div>
          <span className="font-display font-bold text-xl gradient-text tracking-tight">
            QuickPoll
          </span>
        </Link>

        {/* Right — avatar first, then name, then logout on small screens */}
        <div className="flex items-center gap-3">
          {isLoggedIn ? (
            <>
              <motion.div
                whileHover={{ scale: 1.08 }}
                className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container font-bold text-xs font-display flex-shrink-0 shadow-[0_0_0_2px_rgba(124,77,255,0.25)]"
              >
                {initials}
              </motion.div>
              <span className="hidden sm:block text-sm text-on-surface-variant">
                {user?.name}
              </span>
              <button
                onClick={logout}
                className={`lg:hidden flex items-center gap-1 px-2.5 py-1.5 text-sm text-on-surface-variant hover:text-error hover:bg-surface-container-high rounded-lg transition-colors ${focusRing}`}
              >
                <span className="material-symbols-outlined text-[18px]">
                  logout
                </span>
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className={`px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors ${focusRing}`}
            >
              Log In
            </Link>
          )}
        </div>
      </motion.header>

      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col fixed left-0 top-16 h-[calc(100vh-64px)] w-60 p-3 z-40 bg-surface-container-low border-r border-outline-variant">
        <div className="flex flex-col gap-1 mt-3">
          {navItems.map((item) => {
            const active = pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`relative flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm ${focusRing} ${
                  active
                    ? "text-secondary font-semibold"
                    : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-lg bg-secondary-container/10 border border-secondary/20"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <span className="relative material-symbols-outlined text-[20px]">
                  {item.icon}
                </span>
                <span className="relative font-mono text-xs tracking-wide">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>

        {/* Logout */}
        {isLoggedIn && (
          <div className="mt-auto pt-3 border-t border-outline-variant">
            <button
              onClick={logout}
              className={`flex items-center gap-3 px-4 py-2.5 text-on-surface-variant hover:text-error w-full transition-colors rounded-lg hover:bg-surface-container-high text-sm ${focusRing}`}
            >
              <span className="material-symbols-outlined text-[20px]">
                logout
              </span>
              <span className="font-mono text-xs tracking-wide">Sign Out</span>
            </button>
          </div>
        )}
      </aside>

      {/* Main content */}
      <main className="pt-20 pb-20 lg:pb-8 lg:ml-60 px-4 md:px-8 min-h-screen">
        <div className="max-w-5xl mx-auto">{children}</div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 py-2 bg-surface-container/95 backdrop-blur-md border-t border-outline-variant">
        {navItems.map((item) => {
          const active = pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`relative flex flex-col items-center gap-0.5 px-4 py-1 rounded-lg ${focusRing} ${
                active ? "text-primary" : "text-on-surface-variant hover:text-primary transition-colors"
              }`}
            >
              {active && (
                <motion.span
                  layoutId="nav-pill-mobile"
                  className="absolute inset-0 rounded-lg bg-primary/10"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              <span className="relative material-symbols-outlined text-[22px]">
                {item.icon}
              </span>
              <span className="relative text-[10px] font-mono">{item.label}</span>
            </Link>
          );
        })}
        {isLoggedIn && (
          <button
            onClick={logout}
            className={`flex flex-col items-center gap-0.5 px-4 py-1 text-on-surface-variant hover:text-error transition-colors ${focusRing}`}
          >
            <span className="material-symbols-outlined text-[22px]">logout</span>
            <span className="text-[10px] font-mono">Sign Out</span>
          </button>
        )}
      </nav>
    </div>
  );
}
