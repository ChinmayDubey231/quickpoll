import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
  type RefObject,
} from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { isAxiosError } from "axios";
import { useReducedMotion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import api from "../utils/api";
import Logo from "../components/Logo";

// Serves both /login and /register (see App.tsx): the card holds both forms
// and slides between them, while a decorative live poll fills the page behind it.

// Seeded by the server's demo data (server/src/demo/content.ts)
const DEMO_ACCOUNT = { email: "alice@example.com", password: "password123" };

// Mirrors the minlength on the server's User model
const MIN_PASSWORD = 6;
const EMAIL_RE = /^\S+@\S+\.\S+$/;

// Tailwind's `lg` — below it the page is just the card, and the poll preview
// isn't mounted at all, so phones don't run its timers.
const DESKTOP_QUERY = "(min-width: 1024px)";

// The preview is a fake poll that keeps receiving votes; nothing here talks to the API.
const POLL_QUESTION = "Where should the 2027 offsite be?";
const POLL_OPTIONS = ["Lisbon", "Kyoto", "Mexico City"];
const START_VOTES = [512, 431, 341];
const VOTE_WEIGHTS = [1.05, 1, 0.92];

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-qp-accent focus-visible:ring-offset-2 focus-visible:ring-offset-qp-card";

const pickWeighted = (weights: number[]) => {
  let r = Math.random() * weights.reduce((sum, w) => sum + w, 0);
  const index = weights.findIndex((w) => (r -= w) < 0);
  return index === -1 ? weights.length - 1 : index;
};

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/* ------------------------------ live poll preview ------------------------------ */

// Each digit is keyed by its place and value, so only the digits that change
// remount and roll in.
function RollingNumber({ value, className = "" }: { value: number; className?: string }) {
  const chars = value.toLocaleString("en-US").split("");
  return (
    <span className={`inline-flex tabular-nums ${className}`}>
      {chars.map((ch, i) => (
        <span key={`${chars.length - i}:${ch}`} className="inline-block motion-safe:animate-qp-roll">
          {ch}
        </span>
      ))}
    </span>
  );
}

// Returns two grid items — the headline row and the full-bleed bars — which
// the page grid places around the sign-in card.
function PollPreview() {
  const live = !useReducedMotion();
  const [votes, setVotes] = useState(START_VOTES);
  const [lastVote, setLastVote] = useState<{ option: number; id: number } | null>(null);
  const [grown, setGrown] = useState(false);

  // Let the page settle before the bars sweep out
  useEffect(() => {
    if (!live) return;
    const timer = window.setTimeout(() => setGrown(true), 500);
    return () => window.clearTimeout(timer);
  }, [live]);

  // A vote every few seconds, skipped while the tab is hidden
  useEffect(() => {
    if (!live) return;
    let timer: number;
    const tick = () => {
      if (!document.hidden) {
        const option = pickWeighted(VOTE_WEIGHTS);
        setVotes((v) => v.map((n, i) => (i === option ? n + 1 : n)));
        setLastVote((prev) => ({ option, id: (prev?.id ?? 0) + 1 }));
      }
      timer = window.setTimeout(tick, 2200 + Math.random() * 2400);
    };
    timer = window.setTimeout(tick, 1800);
    return () => window.clearTimeout(timer);
  }, [live]);

  const total = votes.reduce((sum, n) => sum + n, 0);
  const max = Math.max(...votes);
  const lead = votes.indexOf(max);
  const barsOut = grown || !live;

  return (
    <>
      <section
        aria-hidden="true"
        style={{ animationDelay: "100ms" }}
        className="col-span-full row-start-1 flex items-end justify-between gap-8 px-12 pb-8 pt-2 motion-safe:animate-qp-in"
      >
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex items-center gap-2.5 font-brand-mono text-[13px] tracking-[.04em] text-qp-muted">
            <span className="h-[7px] w-[7px] rounded-full bg-qp-accent motion-safe:animate-qp-pulse" />
            LIVE POLL
          </div>
          <h2 className="text-[40px] font-medium leading-[1.05] tracking-[-0.035em] xl:text-[52px] xl:leading-none">
            {POLL_QUESTION}
          </h2>
        </div>
        <div className="flex w-[var(--qp-card-w)] shrink-0 items-baseline justify-end gap-2.5">
          <RollingNumber
            value={total}
            className="text-[40px] font-medium leading-none tracking-[-0.035em] xl:text-[52px]"
          />
          <span className="text-lg text-qp-muted">votes</span>
        </div>
      </section>

      <div aria-hidden="true" className="col-span-full row-start-2 flex flex-col gap-2.5 pb-7">
        {POLL_OPTIONS.map((name, i) => {
          const pct = Math.round((votes[i] / total) * 100);
          const ratio = votes[i] / max;
          const leading = i === lead;
          return (
            // Rows stop short of the card column so the percentages stay clear of it
            <div key={name} className="relative min-h-[88px] w-[calc(100%_-_var(--qp-card-w)_-_96px)] flex-1">
              <div className="absolute inset-0 rounded-r-2xl bg-qp-panel" />
              <div
                className="absolute inset-y-0 left-0 flex min-w-max max-w-[calc(100%_-_150px)] items-center overflow-hidden whitespace-nowrap rounded-r-2xl pl-12 pr-7"
                style={{
                  width: barsOut ? `calc(${(ratio * 100).toFixed(2)}% - ${Math.round(ratio * 150)}px)` : "0%",
                  background: leading ? "var(--qp-accent)" : "var(--qp-bar)",
                  color: leading ? "var(--qp-accent-fg)" : "var(--qp-ink)",
                  transition: live
                    ? "width 1.4s cubic-bezier(.2,.8,.2,1), background-color .6s, color .6s"
                    : "none",
                }}
              >
                <span className="text-[clamp(40px,4.6vw,72px)] font-medium leading-none tracking-[-0.045em]">
                  {name}
                </span>
              </div>
              <div className="absolute inset-y-0 right-6 flex flex-col items-end justify-center gap-1.5 whitespace-nowrap">
                <span className="text-[40px] font-medium leading-none tracking-[-0.03em] tabular-nums">{pct}%</span>
                <span className="flex gap-2 font-brand-mono text-[13px] tabular-nums text-qp-muted">
                  {lastVote?.option === i && (
                    <span key={lastVote.id} className="animate-qp-plus">
                      +1
                    </span>
                  )}
                  <span>{votes[i]} votes</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ---------------------------------- chrome ---------------------------------- */

function ThemeButton() {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === "dark";
  const label = dark ? "Switch to light theme" : "Switch to dark theme";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className={`grid h-10 w-10 place-items-center rounded-full border border-qp-line text-qp-ink hover:bg-qp-track ${focusRing}`}
    >
      {dark ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
      )}
    </button>
  );
}

/* ------------------------------- form building ------------------------------ */

type FieldName = "name" | "email" | "password";

interface FormError {
  message: string;
  fields: FieldName[];
}

// Error message plus a brief shake of the fields whenever a new one lands
function useFormError() {
  const [error, setError] = useState<FormError | null>(null);
  const [shaking, setShaking] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const fail = useCallback((message: string, fields: FieldName[] = []) => {
    setError({ message, fields });
    setShaking(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setShaking(false), 420);
  }, []);

  const clear = useCallback(() => setError(null), []);

  return { error, shaking, fail, clear };
}

const errorMessage = (err: unknown, fallback: string): string => {
  if (!isAxiosError(err)) return fallback;
  if (!err.response) return "Can't reach the server — it may be waking up. Try again in a few seconds.";
  return err.response.data?.message || fallback;
};

const errorStatus = (err: unknown) => (isAxiosError(err) ? err.response?.status : undefined);

// Focus the first field when a form slides in, but not on first load
function useFocusOnActivate(active: boolean, ref: RefObject<HTMLInputElement | null>) {
  const wasActive = useRef(active);
  useEffect(() => {
    if (active && !wasActive.current) ref.current?.focus({ preventScroll: true });
    wasActive.current = active;
  }, [active, ref]);
}

// The two forms share one grid cell so the card keeps the taller one's height.
// The entering form turns visible at once; the leaving one hides only after it has faded out.
const panelClass = (active: boolean, exitTo: "left" | "right") =>
  `col-start-1 row-start-1 flex flex-col motion-reduce:transition-none ${
    active
      ? "visible opacity-100 [transition:opacity_.35s_ease,transform_.5s_cubic-bezier(.2,.8,.2,1),visibility_0s]"
      : `invisible opacity-0 ${exitTo === "left" ? "-translate-x-7" : "translate-x-7"} [transition:opacity_.35s_ease,transform_.5s_cubic-bezier(.2,.8,.2,1),visibility_0s_.5s]`
  }`;

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "className"> {
  id: string;
  label: string;
  invalid?: boolean;
  inputRef?: Ref<HTMLInputElement>;
  trailing?: ReactNode;
  hint?: ReactNode;
}

function Field({ id, label, invalid, inputRef, trailing, hint, ...input }: FieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          ref={inputRef}
          aria-invalid={invalid || undefined}
          {...input}
          className={`h-12 w-full rounded-[10px] border bg-qp-field px-3.5 text-base text-qp-ink outline-none [transition:border-color_.2s,box-shadow_.2s] placeholder:text-qp-muted placeholder:opacity-75 focus:border-qp-accent focus:shadow-[0_0_0_3px_var(--qp-ring)] ${
            trailing ? "pr-[72px]" : ""
          } ${invalid ? "border-qp-error" : "border-qp-fieldline"}`}
        />
        {trailing}
      </div>
      {hint}
    </div>
  );
}

function RevealButton({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={shown ? "Hide password" : "Show password"}
      className={`absolute right-1 top-1 h-10 rounded-lg px-3 text-sm font-medium text-qp-muted hover:text-qp-ink ${focusRing}`}
    >
      {shown ? "Hide" : "Show"}
    </button>
  );
}

function SubmitButton({ busy, loading, children }: { busy: boolean; loading: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className={`mt-6 flex h-12 items-center justify-center gap-2.5 rounded-[10px] bg-qp-accent text-base font-semibold text-qp-accent-fg [transition:filter_.2s,transform_.12s] enabled:hover:brightness-110 enabled:active:scale-[.985] disabled:cursor-default ${focusRing}`}
    >
      {loading && (
        <span aria-hidden="true" className="h-[15px] w-[15px] animate-spin rounded-full border-2 border-current border-r-transparent" />
      )}
      <span>{children}</span>
    </button>
  );
}

function FormErrorText({ id, error }: { id: string; error: FormError | null }) {
  if (!error) return null;
  return (
    <p id={id} role="alert" className="mt-3.5 text-sm text-qp-error">
      {error.message}
    </p>
  );
}

function SwitchLink({ to, prompt, children }: { to: string; prompt: string; children: ReactNode }) {
  return (
    <p className="mt-5 text-center text-sm text-qp-muted">
      {prompt}{" "}
      <Link to={to} className={`rounded font-medium text-qp-accent-ink hover:underline ${focusRing}`}>
        {children}
      </Link>
    </p>
  );
}

/* ---------------------------------- sign in --------------------------------- */

function SignInForm({ active }: { active: boolean }) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<"idle" | "typing" | "loading">("idle");
  const { error, shaking, fail, clear } = useFormError();
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const timers = useRef<number[]>([]);

  useFocusOnActivate(active, emailRef);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const busy = status !== "idle";
  const invalid = (field: FieldName) => !!error?.fields.includes(field);
  const describedBy = (field: FieldName) => (invalid(field) ? "signin-error" : undefined);

  const update = (field: "email" | "password") => (e: ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    clear();
  };

  const signIn = async (email: string, password: string) => {
    clear();
    setStatus("loading");
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err) {
      setStatus("idle");
      fail(errorMessage(err, "Sign in failed."), errorStatus(err) === 401 ? ["email", "password"] : []);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const email = form.email.trim();
    if (!EMAIL_RE.test(email)) {
      fail("Enter a valid email address.", ["email"]);
      emailRef.current?.focus();
      return;
    }
    if (!form.password) {
      fail("Enter your password.", ["password"]);
      passwordRef.current?.focus();
      return;
    }
    signIn(email, form.password);
  };

  // Types the demo credentials into the form so it's clear what's happening, then signs in
  const handleDemo = () => {
    if (busy) return;
    clear();
    if (reduceMotion) {
      setForm(DEMO_ACCOUNT);
      signIn(DEMO_ACCOUNT.email, DEMO_ACCOUNT.password);
      return;
    }
    setStatus("typing");
    setForm({ email: "", password: "" });
    const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));
    const type = (field: "email" | "password", text: string, done: () => void) => {
      let n = 0;
      const step = () => {
        n += 1;
        setForm((f) => ({ ...f, [field]: text.slice(0, n) }));
        if (n < text.length) later(step, 32);
        else later(done, 160);
      };
      step();
    };
    type("email", DEMO_ACCOUNT.email, () =>
      type("password", DEMO_ACCOUNT.password, () => signIn(DEMO_ACCOUNT.email, DEMO_ACCOUNT.password))
    );
  };

  return (
    <form noValidate onSubmit={handleSubmit} aria-busy={busy} inert={!active} className={panelClass(active, "left")}>
      <h1 className="text-[28px] font-semibold leading-[1.1] tracking-[-0.02em]">Sign in</h1>
      <p className="mt-2 text-[15px] text-qp-muted">Welcome back to QuickPoll.</p>

      <div className={`mt-8 flex flex-col gap-[18px] ${shaking ? "motion-safe:animate-qp-shake" : ""}`}>
        <Field
          id="signin-email"
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          value={form.email}
          onChange={update("email")}
          readOnly={busy}
          inputRef={emailRef}
          invalid={invalid("email")}
          aria-describedby={describedBy("email")}
        />
        <Field
          id="signin-password"
          label="Password"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          value={form.password}
          onChange={update("password")}
          readOnly={busy}
          inputRef={passwordRef}
          invalid={invalid("password")}
          aria-describedby={describedBy("password")}
          trailing={<RevealButton shown={showPassword} onToggle={() => setShowPassword((s) => !s)} />}
        />
      </div>

      <FormErrorText id="signin-error" error={error} />

      <SubmitButton busy={busy} loading={status === "loading"}>
        {status === "loading" ? "Signing in" : "Sign in"}
      </SubmitButton>

      <div className="mt-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-qp-line" />
        <span className="text-[13px] text-qp-muted">or</span>
        <span className="h-px flex-1 bg-qp-line" />
      </div>

      <button
        type="button"
        onClick={handleDemo}
        disabled={busy}
        className={`mt-5 flex h-12 items-center justify-center gap-2.5 rounded-[10px] border border-qp-fieldline text-base font-semibold text-qp-ink [transition:background-color_.2s,border-color_.2s,transform_.12s] enabled:hover:border-qp-ink enabled:hover:bg-qp-track enabled:active:scale-[.985] disabled:cursor-default ${focusRing}`}
      >
        Try the demo account
      </button>
      <p className="mt-2.5 text-center text-[13px] text-qp-muted">
        Signs you in as <span className="font-brand-mono text-qp-ink">{DEMO_ACCOUNT.email}</span>
      </p>

      <SwitchLink to="/register" prompt="New to QuickPoll?">
        Create an account
      </SwitchLink>
    </form>
  );
}

/* ---------------------------------- sign up --------------------------------- */

function SignUpForm({ active }: { active: boolean }) {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { error, shaking, fail, clear } = useFormError();
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useFocusOnActivate(active, nameRef);

  const invalid = (field: FieldName) => !!error?.fields.includes(field);
  const describedBy = (field: FieldName) => (invalid(field) ? "signup-error" : undefined);
  const passwordOk = form.password.length >= MIN_PASSWORD;

  const update = (field: FieldName) => (e: ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    clear();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    const name = form.name.trim();
    const email = form.email.trim();
    if (!name) {
      fail("Enter your name.", ["name"]);
      nameRef.current?.focus();
      return;
    }
    if (!EMAIL_RE.test(email)) {
      fail("Enter a valid email address.", ["email"]);
      emailRef.current?.focus();
      return;
    }
    if (!passwordOk) {
      fail(`Use at least ${MIN_PASSWORD} characters for your password.`, ["password"]);
      passwordRef.current?.focus();
      return;
    }

    clear();
    setLoading(true);
    try {
      await register(name, email, form.password);
      navigate("/dashboard");
    } catch (err) {
      setLoading(false);
      fail(errorMessage(err, "Couldn't create your account."), errorStatus(err) === 409 ? ["email"] : []);
    }
  };

  return (
    <form noValidate onSubmit={handleSubmit} aria-busy={loading} inert={!active} className={panelClass(active, "right")}>
      <h1 className="text-[28px] font-semibold leading-[1.1] tracking-[-0.02em]">Create your account</h1>
      <p className="mt-2 text-[15px] text-qp-muted">Make a poll, share the link, watch it fill up.</p>

      <div className={`mt-7 flex flex-col gap-4 ${shaking ? "motion-safe:animate-qp-shake" : ""}`}>
        <Field
          id="signup-name"
          label="Name"
          type="text"
          autoComplete="name"
          placeholder="Alex Morgan"
          value={form.name}
          onChange={update("name")}
          readOnly={loading}
          inputRef={nameRef}
          invalid={invalid("name")}
          aria-describedby={describedBy("name")}
        />
        <Field
          id="signup-email"
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          value={form.email}
          onChange={update("email")}
          readOnly={loading}
          inputRef={emailRef}
          invalid={invalid("email")}
          aria-describedby={describedBy("email")}
        />
        <Field
          id="signup-password"
          label="Password"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          value={form.password}
          onChange={update("password")}
          readOnly={loading}
          inputRef={passwordRef}
          invalid={invalid("password")}
          aria-describedby={["signup-password-hint", describedBy("password")].filter(Boolean).join(" ")}
          trailing={<RevealButton shown={showPassword} onToggle={() => setShowPassword((s) => !s)} />}
          hint={
            <div
              id="signup-password-hint"
              className={`flex items-center gap-1.5 text-[13px] [transition:color_.3s] ${passwordOk ? "text-qp-accent-ink" : "text-qp-muted"}`}
            >
              {passwordOk && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              )}
              At least {MIN_PASSWORD} characters
            </div>
          }
        />
      </div>

      <FormErrorText id="signup-error" error={error} />

      <SubmitButton busy={loading} loading={loading}>
        {loading ? "Creating account" : "Create account"}
      </SubmitButton>

      <SwitchLink to="/login" prompt="Already have an account?">
        Sign in
      </SwitchLink>
    </form>
  );
}

/* ----------------------------------- page ----------------------------------- */

export default function Login() {
  const { pathname } = useLocation();
  const signingUp = pathname === "/register";
  const isDesktop = useMediaQuery(DESKTOP_QUERY);

  // The API host sleeps when idle (Render free tier); ping it on page load so
  // it's awake by the time the visitor submits.
  useEffect(() => {
    api.get("/health").catch(() => {});
  }, []);

  return (
    <div className="qp-auth flex min-h-screen flex-col bg-qp-bg font-brand text-qp-ink">
      <header className="flex items-center justify-between px-5 py-5 sm:px-8 lg:px-12 lg:py-7 motion-safe:animate-qp-in">
        <div className="flex items-center gap-2.5">
          <Logo size={28} />
          <span className="text-xl font-semibold tracking-[-0.02em]">QuickPoll</span>
        </div>
        <ThemeButton />
      </header>

      {/* On lg+ the bars span the full width and the card sits over their right end */}
      <div className="grid flex-1 lg:grid-cols-[minmax(0,1fr)_auto] lg:grid-rows-[auto_1fr]">
        {isDesktop && <PollPreview />}

        <main className="relative z-10 flex justify-center self-start px-5 pb-10 pt-2 sm:self-center sm:pt-6 lg:col-start-2 lg:row-start-2 lg:px-0 lg:pb-[68px] lg:pr-12 lg:pt-2">
          <div
            style={{ animationDelay: "200ms" }}
            className="w-full max-w-[400px] rounded-[18px] border border-qp-line bg-qp-card px-6 py-7 shadow-[var(--qp-shadow)] sm:px-9 sm:py-8 lg:w-[var(--qp-card-w)] lg:max-w-none motion-safe:animate-qp-in"
          >
            <div className="grid">
              <SignInForm active={!signingUp} />
              <SignUpForm active={signingUp} />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
