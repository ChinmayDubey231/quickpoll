import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import Logo from "./Logo.jsx";

const navItems = [
  { icon: "dashboard", label: "Dashboard", path: "/dashboard" },
  { icon: "add_circle", label: "New Poll", path: "/create" },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
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
      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-4 md:px-8 h-16 bg-surface border-b border-outline-variant">
        {/* Logo + wordmark */}
        <div className="flex items-center gap-2.5">
          <Logo size={28} />
          <span className="font-display font-bold text-xl text-primary tracking-tight">
            QuickPoll
          </span>
        </div>

        {/* Center nav */}
        <nav className="hidden items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                pathname === item.path
                  ? "text-primary bg-primary/10"
                  : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">
                {item.icon}
              </span>
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Right — avatar first, then name, then logout on small screens */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container font-bold text-xs font-display flex-shrink-0">
            {initials}
          </div>
          <span className="hidden sm:block text-sm text-on-surface-variant">
            {user?.name}
          </span>
          <button
            onClick={logout}
            className="lg:hidden flex items-center gap-1 px-2.5 py-1.5 text-sm text-on-surface-variant hover:text-error hover:bg-surface-container-high rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">
              logout
            </span>
          </button>
        </div>
      </header>

      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col fixed left-0 top-16 h-[calc(100vh-64px)] w-60 p-3 z-40 bg-surface-container-low border-r border-outline-variant">
        <div className="flex flex-col gap-1 mt-3">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all text-sm ${
                pathname === item.path
                  ? "text-secondary font-semibold bg-secondary-container/10 translate-x-0.5"
                  : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">
                {item.icon}
              </span>
              <span className="font-mono text-xs tracking-wide">
                {item.label}
              </span>
            </Link>
          ))}
        </div>

        {/* Pro upsell */}
        <div className="mt-auto p-4 bg-primary-container/10 rounded-xl border border-primary/20">
          <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">
            Pro Feature
          </p>
          <p className="text-xs text-on-surface-variant mb-3">
            Export detailed CSV reports for all polls.
          </p>
          <button className="w-full py-2 bg-primary text-on-primary font-bold rounded-lg text-xs hover:scale-[0.98] transition-transform font-display">
            Upgrade Pro
          </button>
        </div>

        {/* Logout */}
        <div className="mt-3 pt-3 border-t border-outline-variant">
          <button
            onClick={logout}
            className="flex items-center gap-3 px-4 py-2.5 text-on-surface-variant hover:text-error w-full transition-colors rounded-lg hover:bg-surface-container-high text-sm"
          >
            <span className="material-symbols-outlined text-[20px]">
              logout
            </span>
            <span className="font-mono text-xs tracking-wide">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="pt-20 pb-20 lg:pb-8 lg:ml-60 px-4 md:px-8 min-h-screen">
        <div className="max-w-5xl mx-auto">{children}</div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 py-2 bg-surface-container border-t border-outline-variant">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex flex-col items-center gap-0.5 px-4 py-1 rounded-lg transition-all ${
              pathname === item.path
                ? "text-primary"
                : "text-on-surface-variant hover:text-primary"
            }`}
          >
            <span className="material-symbols-outlined text-[22px]">
              {item.icon}
            </span>
            <span className="text-[10px] font-mono">{item.label}</span>
          </Link>
        ))}
        <button
          onClick={logout}
          className="flex flex-col items-center gap-0.5 px-4 py-1 text-on-surface-variant hover:text-error transition-colors"
        >
          <span className="material-symbols-outlined text-[22px]">logout</span>
          <span className="text-[10px] font-mono">Sign Out</span>
        </button>
      </nav>
    </div>
  );
}
