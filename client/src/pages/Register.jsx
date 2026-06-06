import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import Logo from "../components/Logo.jsx";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.password.length < 6)
      return setError("Password must be at least 6 characters");
    setLoading(true);
    try {
      await register(form.name, form.email, form.password);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0E14] flex items-center justify-center px-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary-container/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/3 w-64 h-64 bg-secondary-container/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative">
        {/* Logo + wordmark */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Logo size={40} />
            <span className="font-display font-bold text-3xl text-primary tracking-tight">
              QuickPoll
            </span>
          </div>
          <p className="text-on-surface-variant text-sm">
            Real-time polling, live results
          </p>
        </div>

        <div
          className="glass-card rounded-2xl p-8"
          style={{ animation: "fadeIn 350ms ease" }}
        >
          <h1 className="font-display font-bold text-2xl text-on-surface mb-1">
            Create your account
          </h1>
          <p className="text-sm text-on-surface-variant mb-6">
            Start creating polls in seconds
          </p>

          {error && (
            <div className="mb-4 px-4 py-3 bg-error-container/20 border border-error/30 rounded-lg text-sm text-error">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {[
              {
                name: "name",
                type: "text",
                label: "Name",
                placeholder: "Jane Smith",
              },
              {
                name: "email",
                type: "email",
                label: "Email",
                placeholder: "you@example.com",
              },
              {
                name: "password",
                type: "password",
                label: "Password",
                placeholder: "Min. 6 characters",
              },
            ].map((field) => (
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
                  className="w-full px-4 py-3 bg-surface-container border border-outline-variant rounded-xl text-sm text-on-surface placeholder-on-surface-variant/50 focus:outline-none focus:border-primary/60 focus:bg-surface-container-high transition-all"
                />
              </div>
            ))}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-primary-container text-on-primary-container font-display font-bold rounded-xl transition-all hover:scale-[0.99] active:scale-[0.97] disabled:opacity-50 mt-2"
            >
              {loading ? "Creating account…" : "Create account"}
            </button>
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
        </div>
      </div>
    </div>
  );
}
