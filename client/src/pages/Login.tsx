import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { isAxiosError } from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";
import Logo from "../components/Logo";
import ThemeToggle from "../components/ThemeToggle";
import ErrorMsg from "../components/shared/ErrorMsg";
import AuroraBackground from "../components/motion/AuroraBackground";
import { fadeUp, popIn, staggerContainer } from "../components/motion/variants";

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

// Seeded by the server's demo data (server/src/demo/content.ts)
const DEMO_ACCOUNT = { email: "alice@example.com", password: "password123" };

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  // The API host sleeps when idle (Render free tier); ping it on page load so
  // it's awake by the time the visitor submits.
  useEffect(() => {
    api.get("/health").catch(() => {});
  }, []);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const signIn = async (email: string, password: string, setBusy: (busy: boolean) => void) => {
    setError("");
    setBusy(true);
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err) {
      if (isAxiosError(err) && !err.response) {
        setError("Can't reach the server — it may be waking up. Try again in a few seconds.");
        return;
      }
      const message = isAxiosError(err) ? err.response?.data?.message : undefined;
      setError(message || "Login failed");
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    signIn(form.email, form.password, setLoading);
  };

  const handleDemo = () => {
    setForm(DEMO_ACCOUNT);
    signIn(DEMO_ACCOUNT.email, DEMO_ACCOUNT.password, setDemoLoading);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 relative overflow-hidden">
      <AuroraBackground />
      <ThemeToggle className="fixed top-4 right-4 z-10" />

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="w-full max-w-md relative"
      >
        {/* Logo + wordmark */}
        <motion.div variants={fadeUp} className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-3 mb-2">
            <motion.div
              initial={{ opacity: 0, scale: 0.5, rotate: -25 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.1 }}
              whileHover={{ rotate: -6, scale: 1.08 }}
            >
              <Logo size={40} />
            </motion.div>
            <span className="font-display font-bold text-3xl gradient-text tracking-tight">
              QuickPoll
            </span>
          </div>
          <p className="text-on-surface-variant text-sm">
            Real-time polling, live results
          </p>
        </motion.div>

        <motion.div
          variants={fadeUp}
          whileHover={{ y: -3, boxShadow: "0 20px 40px -20px rgba(124, 77, 255, 0.35)" }}
          transition={{ type: "spring", stiffness: 300, damping: 24 }}
          className="glass-card rounded-2xl p-8"
        >
          <motion.h1
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="font-display font-bold text-2xl text-on-surface mb-1"
          >
            Welcome back
          </motion.h1>
          <p className="text-sm text-on-surface-variant mb-6">
            Sign in to your account
          </p>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{
                  opacity: 1,
                  height: "auto",
                  x: [0, -8, 8, -6, 6, -2, 2, 0],
                }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ x: { duration: 0.4, delay: 0.05 } }}
                className="mb-4 overflow-hidden"
              >
                <ErrorMsg message={error} />
              </motion.div>
            )}
          </AnimatePresence>

          <motion.form
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            onSubmit={handleSubmit}
            className="space-y-4"
          >
            <motion.div variants={fadeUp}>
              <label className="block text-xs font-mono tracking-widest text-on-surface-variant uppercase mb-2">
                Email
              </label>
              <motion.input
                whileFocus={{ scale: 1.015 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                required
                placeholder="you@example.com"
                className={`w-full px-4 py-3 bg-surface-container border border-outline-variant rounded-xl text-sm text-on-surface placeholder-on-surface-variant/50 focus:outline-none focus:border-primary/60 focus:bg-surface-container-high transition-all ${focusRing}`}
              />
            </motion.div>
            <motion.div variants={fadeUp}>
              <label className="block text-xs font-mono tracking-widest text-on-surface-variant uppercase mb-2">
                Password
              </label>
              <motion.input
                whileFocus={{ scale: 1.015 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                name="password"
                type="password"
                value={form.password}
                onChange={handleChange}
                required
                placeholder="••••••••"
                className={`w-full px-4 py-3 bg-surface-container border border-outline-variant rounded-xl text-sm text-on-surface placeholder-on-surface-variant/50 focus:outline-none focus:border-primary/60 focus:bg-surface-container-high transition-all ${focusRing}`}
              />
            </motion.div>
            <motion.button
              variants={popIn}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.97 }}
              type="submit"
              disabled={loading || demoLoading}
              className={`w-full py-3 bg-primary-container text-on-primary-container font-display font-bold rounded-xl transition-colors disabled:opacity-50 mt-2 ${focusRing}`}
            >
              <AnimatePresence mode="wait" initial={false}>
                {loading ? (
                  <motion.span
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="inline-flex items-center gap-2"
                  >
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                      className="material-symbols-outlined text-[18px]"
                    >
                      progress_activity
                    </motion.span>
                    Signing in…
                  </motion.span>
                ) : (
                  <motion.span
                    key="idle"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    Sign in
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </motion.form>

          <div className="my-6 flex items-center gap-3 text-xs font-mono tracking-widest text-on-surface-variant uppercase">
            <span className="h-px flex-1 bg-outline-variant" />
            or
            <span className="h-px flex-1 bg-outline-variant" />
          </div>

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.97 }}
            type="button"
            onClick={handleDemo}
            disabled={loading || demoLoading}
            className={`w-full py-3 border border-primary/40 text-primary font-display font-bold rounded-xl hover:bg-primary/10 transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2 ${focusRing}`}
          >
            <span className="material-symbols-outlined text-[18px]">
              {demoLoading ? "progress_activity" : "rocket_launch"}
            </span>
            {demoLoading ? "Opening demo…" : "Try the demo account"}
          </motion.button>
          <p className="mt-2 text-center text-xs text-on-surface-variant">
            Just looking around? Sign in as{" "}
            <span className="font-mono text-on-surface">{DEMO_ACCOUNT.email}</span> /{" "}
            <span className="font-mono text-on-surface">{DEMO_ACCOUNT.password}</span>
          </p>

          <p className="mt-6 text-center text-sm text-on-surface-variant">
            No account?{" "}
            <Link
              to="/register"
              className="text-primary font-semibold hover:underline"
            >
              Create one
            </Link>
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
