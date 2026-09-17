import { useState, type ChangeEvent, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { isAxiosError } from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import Logo from "../components/Logo";
import ThemeToggle from "../components/ThemeToggle";
import ErrorMsg from "../components/shared/ErrorMsg";
import AuroraBackground from "../components/motion/AuroraBackground";
import { fadeUp, staggerContainer } from "../components/motion/variants";

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

interface RegisterForm {
  name: string;
  email: string;
  password: string;
}

const FIELDS: { name: keyof RegisterForm; type: string; label: string; placeholder: string }[] = [
  { name: "name", type: "text", label: "Name", placeholder: "Jane Smith" },
  { name: "email", type: "email", label: "Email", placeholder: "you@example.com" },
  { name: "password", type: "password", label: "Password", placeholder: "Min. 6 characters" },
];

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState<RegisterForm>({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (form.password.length < 6)
      return setError("Password must be at least 6 characters");
    setLoading(true);
    try {
      await register(form.name, form.email, form.password);
      navigate("/dashboard");
    } catch (err) {
      const message = isAxiosError(err) ? err.response?.data?.message : undefined;
      setError(message || "Registration failed");
    } finally {
      setLoading(false);
    }
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
            <Logo size={40} />
            <span className="font-display font-bold text-3xl gradient-text tracking-tight">
              QuickPoll
            </span>
          </div>
          <p className="text-on-surface-variant text-sm">
            Real-time polling, live results
          </p>
        </motion.div>

        <motion.div variants={fadeUp} className="glass-card rounded-2xl p-8">
          <h1 className="font-display font-bold text-2xl text-on-surface mb-1">
            Create your account
          </h1>
          <p className="text-sm text-on-surface-variant mb-6">
            Start creating polls in seconds
          </p>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4 overflow-hidden"
              >
                <ErrorMsg message={error} />
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-4">
            {FIELDS.map((field) => (
              <div key={field.name}>
                <label className="block text-xs font-mono tracking-widest text-on-surface-variant uppercase mb-2">
                  {field.label}
                </label>
                <input
                  name={field.name}
                  type={field.type}
                  value={form[field.name]}
                  onChange={handleChange}
                  required
                  placeholder={field.placeholder}
                  className={`w-full px-4 py-3 bg-surface-container border border-outline-variant rounded-xl text-sm text-on-surface placeholder-on-surface-variant/50 focus:outline-none focus:border-primary/60 focus:bg-surface-container-high transition-all ${focusRing}`}
                />
              </div>
            ))}

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.97 }}
              type="submit"
              disabled={loading}
              className={`w-full py-3 bg-primary-container text-on-primary-container font-display font-bold rounded-xl transition-colors disabled:opacity-50 mt-2 ${focusRing}`}
            >
              {loading ? "Creating account…" : "Create account"}
            </motion.button>
          </form>

          <p className="mt-6 text-center text-sm text-on-surface-variant">
            Already have an account?{" "}
            <Link
              to="/login"
              className="text-primary font-semibold hover:underline"
            >
              Sign in
            </Link>
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
