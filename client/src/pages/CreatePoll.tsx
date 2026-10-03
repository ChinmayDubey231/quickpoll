import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import { isAxiosError } from "axios";
import { AnimatePresence, motion, type Transition } from "framer-motion";
import api from "../utils/api";
import QpToast, { useQpToast } from "../components/QpToast";
import { fadeUp, staggerContainer } from "../components/motion/variants";
import type { PollDTO, PollType } from "../types/api";

// Mirror the server's rules (pollController / Poll model)
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 6;
const QUESTION_MAX = 300;
const OPTION_MAX = 100;
// After creating, hold the success state briefly, then go to the dashboard
const REDIRECT_MS = 2200;

const POLL_TYPES: Array<{ value: PollType; label: string; description: string; short: string }> = [
  { value: "single", label: "Single choice", description: "Voters pick one option", short: "Pick one" },
  { value: "multi", label: "Multiple choice", description: "Voters can pick several", short: "Pick any" },
  { value: "ranked", label: "Ranked choice", description: "Voters rank every option", short: "Rank all" },
];

type ExpiryKey = "never" | "1h" | "24h" | "7d" | "custom";
const EXPIRY: Array<{ key: ExpiryKey; label: string; ms?: number }> = [
  { key: "never", label: "Never" },
  { key: "1h", label: "1 hour", ms: 3_600_000 },
  { key: "24h", label: "24 hours", ms: 86_400_000 },
  { key: "7d", label: "7 days", ms: 604_800_000 },
  { key: "custom", label: "Custom" },
];

const blankOption = () => ({ id: crypto.randomUUID(), text: "" });

const pad = (n: number) => String(n).padStart(2, "0");
// The value format <input type="datetime-local"> expects, in local time
const toLocalInput = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const formatClose = (d: Date) =>
  d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

const closeDateFor = (expiry: ExpiryKey, customAt: string): Date | null => {
  const preset = EXPIRY.find((e) => e.key === expiry)?.ms;
  if (preset) return new Date(Date.now() + preset);
  if (expiry === "custom" && customAt) {
    const d = new Date(customAt);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
};

const errorMessage = (err: unknown, fallback: string): string => {
  if (!isAxiosError(err)) return fallback;
  if (!err.response) return "Can't reach the server. It may be waking up, so try again in a few seconds.";
  return err.response.data?.message || fallback;
};

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-qp-accent focus-visible:ring-offset-2 focus-visible:ring-offset-qp-bg";
const labelText = "font-brand-mono text-xs uppercase tracking-[.06em] text-qp-muted";
const easeOut = [0.2, 0.8, 0.2, 1] as const;
const slide: Transition = { type: "spring", stiffness: 420, damping: 34 };
const collapse: Transition = { duration: 0.22, ease: easeOut };

/* ---------------------------------- pieces ---------------------------------- */

function Hint({ id, error, children }: { id?: string; error?: boolean; children: ReactNode }) {
  return (
    <p id={id} role={error ? "alert" : undefined} className={`text-sm transition-colors ${error ? "text-qp-error" : "text-qp-muted"}`}>
      {children}
    </p>
  );
}

function PlusIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className={className}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

// Voter-eye view of the poll as it's typed. Decorative: the form itself carries
// the same information for assistive tech.
function Preview({ question, options, pollType }: { question: string; options: Array<{ id: string; text: string }>; pollType: PollType }) {
  const type = POLL_TYPES.find((t) => t.value === pollType) ?? POLL_TYPES[0];
  const trimmedQuestion = question.trim();

  return (
    <div aria-hidden="true" className="flex flex-col gap-[18px] rounded-2xl border border-qp-line bg-qp-panel p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <span className={`flex items-center gap-2 ${labelText}`}>
          <span className="h-[7px] w-[7px] rounded-full bg-qp-accent motion-safe:animate-qp-pulse" />
          Preview
        </span>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={pollType}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className={labelText}
          >
            {type.short}
          </motion.span>
        </AnimatePresence>
      </div>

      <p className={`break-words text-xl font-medium leading-tight tracking-[-0.02em] ${trimmedQuestion ? "text-qp-ink" : "text-qp-muted"}`}>
        {trimmedQuestion || "Your question appears here"}
      </p>

      <ul className="flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {options.map((opt, i) => (
            <motion.li
              key={opt.id}
              layout="position"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={collapse}
              className="overflow-hidden"
            >
              <span className="flex min-h-11 items-center gap-3 rounded-[10px] border border-qp-line bg-qp-bg px-3.5 py-2">
                {/* Circle for pick-one, square for pick-any, numbered for ranked */}
                <span
                  className={`grid h-[18px] w-[18px] flex-none place-items-center border-[1.5px] border-qp-muted font-brand-mono text-[10px] font-bold text-qp-muted [transition:border-radius_.3s] ${
                    pollType === "single" ? "rounded-full" : "rounded-[5px]"
                  }`}
                >
                  {pollType === "ranked" && i + 1}
                </span>
                <span className={`break-words text-[15px] ${opt.text.trim() ? "text-qp-ink" : "text-qp-muted"}`}>
                  {opt.text.trim() || `Option ${i + 1}`}
                </span>
              </span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}

/* ----------------------------------- page ----------------------------------- */

export default function CreatePoll() {
  const navigate = useNavigate();
  const { toast, showToast } = useQpToast();

  const [question, setQuestion] = useState("");
  const [pollType, setPollType] = useState<PollType>("single");
  const [options, setOptions] = useState(() => [blankOption(), blankOption()]);
  const [isPublic, setIsPublic] = useState(false);
  const [expiry, setExpiry] = useState<ExpiryKey>("never");
  const [customAt, setCustomAt] = useState("");
  // Errors for missing fields only show once a submit has been attempted
  const [tried, setTried] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");

  const questionRef = useRef<HTMLTextAreaElement>(null);
  const customRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef(new Map<string, HTMLInputElement>());
  const pendingFocus = useRef<string | null>(null);
  const shakeTimer = useRef<number | undefined>(undefined);
  const redirectTimer = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      window.clearTimeout(shakeTimer.current);
      window.clearTimeout(redirectTimer.current);
    },
    [],
  );

  // A newly added option only mounts on the next render, so focus it from here
  useEffect(() => {
    if (!pendingFocus.current) return;
    optionRefs.current.get(pendingFocus.current)?.focus();
    pendingFocus.current = null;
  });

  // The question box grows with its text instead of scrolling
  const fitQuestion = useCallback(() => {
    const el = questionRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;
  }, []);
  useLayoutEffect(fitQuestion, [question, fitQuestion]);
  useEffect(() => {
    window.addEventListener("resize", fitQuestion);
    return () => window.removeEventListener("resize", fitQuestion);
  }, [fitQuestion]);

  /* ------------------------------- validation ------------------------------- */

  const trimmed = options.map((o) => o.text.trim());
  const lower = trimmed.map((t) => t.toLowerCase());
  const duplicateAt = trimmed.map((t, i) => Boolean(t) && lower.indexOf(lower[i]) !== i);
  const filledCount = trimmed.filter(Boolean).length;
  const noQuestion = !question.trim();
  const tooFew = filledCount < MIN_OPTIONS;
  const hasDuplicate = duplicateAt.some(Boolean);
  const closeAt = closeDateFor(expiry, customAt);
  const badExpiry = expiry === "custom" && (!closeAt || closeAt.getTime() <= Date.now());

  // When too few are filled, flag just enough of the empty boxes to reach the minimum
  let stillMissing = tried && tooFew ? MIN_OPTIONS - filledCount : 0;
  const emptyFlagged = trimmed.map((t) => {
    if (t || stillMissing <= 0) return false;
    stillMissing -= 1;
    return true;
  });

  const questionError = tried && noQuestion;
  const optionsError = hasDuplicate || (tried && tooFew);
  const optionsHint = hasDuplicate
    ? "Two options are the same."
    : tried && tooFew
      ? `Add at least ${MIN_OPTIONS} options.`
      : options.length < MAX_OPTIONS
        ? "Press Enter to add the next option."
        : `That's the maximum of ${MAX_OPTIONS} options.`;
  const expiryHint = badExpiry
    ? "Pick a date and time in the future."
    : closeAt
      ? `Voting ends ${formatClose(closeAt)}.`
      : "Stays open until you close it.";

  /* -------------------------------- handlers -------------------------------- */

  const setOptionText = (id: string, text: string) =>
    setOptions((prev) => prev.map((o) => (o.id === id ? { ...o, text } : o)));

  const addOption = () => {
    if (options.length >= MAX_OPTIONS) return;
    const opt = blankOption();
    setOptions((prev) => [...prev, opt]);
    pendingFocus.current = opt.id;
  };

  const removeOption = (id: string, focusPrevious = false) => {
    if (options.length <= MIN_OPTIONS) return;
    const i = options.findIndex((o) => o.id === id);
    const neighbour = focusPrevious ? (options[i - 1] ?? options[i + 1]) : (options[i + 1] ?? options[i - 1]);
    setOptions((prev) => prev.filter((o) => o.id !== id));
    pendingFocus.current = neighbour?.id ?? null;
  };

  // Enter moves to the next option (adding one at the end); Backspace in an
  // empty option removes it
  const onOptionKeyDown = (e: KeyboardEvent<HTMLInputElement>, index: number) => {
    const opt = options[index];
    if (e.key === "Enter") {
      e.preventDefault();
      const next = options[index + 1];
      if (next) optionRefs.current.get(next.id)?.focus();
      else addOption();
    } else if (e.key === "Backspace" && !opt.text && options.length > MIN_OPTIONS) {
      e.preventDefault();
      removeOption(opt.id, true);
    }
  };

  const chooseExpiry = (key: ExpiryKey) => {
    setExpiry(key);
    if (key === "custom" && !customAt) setCustomAt(toLocalInput(new Date(Date.now() + 86_400_000)));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (status !== "idle") return;

    if (noQuestion || tooFew || hasDuplicate || badExpiry) {
      setTried(true);
      setShaking(true);
      window.clearTimeout(shakeTimer.current);
      shakeTimer.current = window.setTimeout(() => setShaking(false), 420);
      if (noQuestion) {
        questionRef.current?.focus();
      } else if (tooFew || hasDuplicate) {
        const target = options.find((_, i) => (tooFew && !trimmed[i]) || duplicateAt[i]) ?? options[0];
        optionRefs.current.get(target.id)?.focus();
      } else {
        customRef.current?.focus();
      }
      return;
    }

    setStatus("loading");
    try {
      const { data } = await api.post<PollDTO>("/polls", {
        question: question.trim(),
        options: trimmed.filter(Boolean),
        pollType,
        isPublic,
        // ISO with the offset, so the server doesn't read local time as UTC
        expiresAt: closeAt ? closeAt.toISOString() : undefined,
      });
      let copied = false;
      try {
        await navigator.clipboard.writeText(`${window.location.origin}/poll/${data._id}`);
        copied = true;
      } catch {
        // Clipboard can be refused (permissions, unfocused tab); the link is on the dashboard anyway
      }
      setStatus("done");
      showToast(copied ? "Poll created. Link copied to clipboard." : "Poll created.", {
        action: { label: "View dashboard", onClick: () => navigate("/dashboard") },
        duration: REDIRECT_MS,
      });
      redirectTimer.current = window.setTimeout(() => navigate("/dashboard"), REDIRECT_MS);
    } catch (err) {
      setStatus("idle");
      showToast(errorMessage(err, "Couldn't create the poll."));
    }
  };

  const busy = status !== "idle";
  const typeInfo = POLL_TYPES.find((t) => t.value === pollType) ?? POLL_TYPES[0];

  /* --------------------------------- render --------------------------------- */

  return (
    // The negative bottom margin cancels the shell's padding so the pinned
    // action bar ends flush with the page (above the bottom nav on phones)
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="-mb-8 pt-3 font-brand text-qp-ink md:pt-6 lg:-mb-16 lg:pt-8"
    >
      <motion.div variants={fadeUp} className="flex flex-col gap-2">
        <h1 className="text-[36px] font-medium leading-none tracking-[-0.035em] sm:text-[44px]">Create a poll</h1>
        <p className="text-base text-qp-muted">Share with anyone. No account needed to vote.</p>
      </motion.div>

      <form noValidate onSubmit={handleSubmit} className="mt-8 sm:mt-10">
        <fieldset
          disabled={busy}
          className="grid min-w-0 gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(300px,360px)] xl:gap-12"
        >
          {/* ----------------------------- main column ----------------------------- */}
          <motion.div variants={fadeUp} className="min-w-0 border-t border-qp-line">
            <section className="flex flex-col gap-3 border-b border-qp-line py-7">
              <div className="flex items-baseline justify-between">
                <label htmlFor="np-question" className={labelText}>
                  Question
                </label>
                <span className={`font-brand-mono text-xs tabular-nums ${question.length > QUESTION_MAX - 30 ? "text-qp-error" : "text-qp-muted"}`}>
                  {question.length}/{QUESTION_MAX}
                </span>
              </div>
              <textarea
                id="np-question"
                ref={questionRef}
                rows={1}
                enterKeyHint="next"
                maxLength={QUESTION_MAX}
                value={question}
                // One line of text: newlines become spaces, and Enter moves on to the options
                onChange={(e) => setQuestion(e.target.value.replace(/\n/g, " "))}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  optionRefs.current.get(options[0].id)?.focus();
                }}
                placeholder="What would you like to ask?"
                aria-invalid={questionError || undefined}
                aria-describedby={questionError ? "np-question-error" : undefined}
                className={`w-full resize-none overflow-hidden border-0 border-b-2 bg-transparent px-0 pb-3 pt-1 text-2xl font-medium leading-tight tracking-[-0.02em] text-qp-ink outline-none placeholder:text-qp-muted placeholder:opacity-70 focus:border-qp-accent sm:text-[30px] ${
                  questionError ? "border-qp-error" : "border-qp-fieldline"
                } ${shaking && questionError ? "motion-safe:animate-qp-shake" : ""}`}
              />
              <AnimatePresence initial={false}>
                {questionError && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={collapse}
                  >
                    <Hint id="np-question-error" error>
                      Add a question before creating the poll.
                    </Hint>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>

            <section className="flex flex-col gap-3.5 border-b border-qp-line py-7">
              <span id="np-type" className={labelText}>
                Poll type
              </span>
              <div role="radiogroup" aria-labelledby="np-type" className="grid gap-2.5 sm:grid-cols-3">
                {POLL_TYPES.map((t) => {
                  const selected = pollType === t.value;
                  return (
                    <label
                      key={t.value}
                      className={`relative flex cursor-pointer flex-col gap-1 rounded-xl border p-3.5 transition-colors sm:gap-1.5 sm:p-4 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-qp-accent has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-qp-bg ${
                        selected ? "border-transparent" : "border-qp-line hover:border-qp-muted"
                      }`}
                    >
                      <input
                        type="radio"
                        name="pollType"
                        value={t.value}
                        checked={selected}
                        onChange={() => setPollType(t.value)}
                        className="sr-only"
                      />
                      {/* One highlight that glides to whichever card is picked */}
                      {selected && (
                        <motion.span
                          layoutId="poll-type-highlight"
                          transition={slide}
                          className="absolute inset-0 rounded-xl border border-qp-accent bg-[color:color-mix(in_srgb,var(--qp-accent)_8%,transparent)] shadow-[0_0_0_1px_var(--qp-accent)]"
                        />
                      )}
                      <span className="relative flex items-center justify-between gap-2">
                        <span className="text-base font-semibold">{t.label}</span>
                        <span
                          className={`h-[18px] w-[18px] flex-none rounded-full [transition:border-width_.2s,border-color_.2s] ${
                            selected ? "border-[5px] border-qp-accent" : "border-[1.5px] border-qp-muted"
                          }`}
                        />
                      </span>
                      <span className="relative text-sm text-qp-muted">{t.description}</span>
                    </label>
                  );
                })}
              </div>
            </section>

            <section className="flex flex-col gap-3.5 pb-10 pt-7">
              <div className="flex items-baseline justify-between">
                <span id="np-options" className={labelText}>
                  Options
                </span>
                <span className="font-brand-mono text-xs tabular-nums text-qp-muted">
                  {options.length}/{MAX_OPTIONS}
                </span>
              </div>

              <div
                role="group"
                aria-labelledby="np-options"
                className={`flex flex-col ${shaking && optionsError ? "motion-safe:animate-qp-shake" : ""}`}
              >
                <AnimatePresence initial={false}>
                  {options.map((opt, i) => {
                    const invalid = duplicateAt[i] || emptyFlagged[i];
                    const locked = options.length <= MIN_OPTIONS;
                    return (
                      <motion.div
                        key={opt.id}
                        layout="position"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={collapse}
                        className="overflow-hidden"
                      >
                        {/* py-1 leaves room for the focus rings inside the clipped row */}
                        <div className="flex items-center gap-3 py-1">
                          <span className="grid h-7 w-7 flex-none place-items-center rounded-lg border border-qp-line font-brand-mono text-xs text-qp-muted">
                            {i + 1}
                          </span>
                          <input
                            ref={(el) => {
                              if (el) optionRefs.current.set(opt.id, el);
                              else optionRefs.current.delete(opt.id);
                            }}
                            type="text"
                            maxLength={OPTION_MAX}
                            value={opt.text}
                            onChange={(e) => setOptionText(opt.id, e.target.value)}
                            onKeyDown={(e) => onOptionKeyDown(e, i)}
                            enterKeyHint="next"
                            placeholder={`Option ${i + 1}`}
                            aria-label={`Option ${i + 1}`}
                            aria-invalid={invalid || undefined}
                            aria-describedby="np-options-hint"
                            className={`h-12 min-w-0 flex-1 rounded-[10px] border bg-qp-field px-3.5 text-base text-qp-ink outline-none [transition:border-color_.2s,box-shadow_.2s] placeholder:text-qp-muted placeholder:opacity-70 focus:border-qp-accent focus:shadow-[0_0_0_3px_var(--qp-ring)] ${
                              invalid ? "border-qp-error" : "border-qp-fieldline"
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => removeOption(opt.id)}
                            disabled={locked}
                            aria-label={`Remove option ${i + 1}`}
                            title={locked ? `A poll needs at least ${MIN_OPTIONS} options` : `Remove option ${i + 1}`}
                            className={`group/rm grid h-10 w-10 flex-none place-items-center rounded-[9px] text-qp-muted transition-colors enabled:hover:bg-qp-track enabled:hover:text-qp-ink disabled:cursor-not-allowed disabled:opacity-30 ${focusRing}`}
                          >
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              aria-hidden="true"
                              className="transition-transform duration-300 motion-safe:group-hover/rm:rotate-90"
                            >
                              <path d="M6 6l12 12M18 6 6 18" />
                            </svg>
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>

              <AnimatePresence initial={false}>
                {options.length < MAX_OPTIONS && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={collapse}
                    className="overflow-hidden pl-10"
                  >
                    <div className="py-1">
                      <button
                        type="button"
                        onClick={addOption}
                        className={`group/add flex h-10 items-center gap-2 rounded-[10px] border border-dashed border-qp-fieldline px-3.5 text-[15px] font-medium transition-colors hover:border-qp-ink hover:bg-qp-track ${focusRing}`}
                      >
                        <PlusIcon className="transition-transform duration-300 motion-safe:group-hover/add:rotate-90" />
                        Add option
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="pl-10">
                <Hint id="np-options-hint" error={optionsError}>
                  {optionsHint}
                </Hint>
              </div>
            </section>
          </motion.div>

          {/* ------------------------------- sidebar ------------------------------- */}
          {/* Beside the form (and pinned) on wide screens; below it otherwise, with
              the settings first so they aren't buried under the preview on phones */}
          <motion.aside
            variants={fadeUp}
            className="grid min-w-0 content-start gap-4 self-start sm:grid-cols-2 xl:sticky xl:top-[100px] xl:grid-cols-1 short:static"
          >
            <div className="xl:order-2">
              <div className="flex flex-col rounded-2xl border border-qp-line px-5 py-2 sm:px-6">
                <div className="flex items-start justify-between gap-4 border-b border-qp-line py-4">
                  <div className="flex flex-col gap-1">
                    <span id="np-public" className="text-[15px] font-semibold">
                      List on Discover
                    </span>
                    <span id="np-public-hint" className="text-sm leading-snug text-qp-muted">
                      {isPublic ? "Anyone can find and vote on it from Discover." : "Only people with the link can vote."}
                    </span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isPublic}
                    aria-labelledby="np-public"
                    aria-describedby="np-public-hint"
                    onClick={() => setIsPublic((v) => !v)}
                    className={`mt-0.5 flex h-[26px] w-11 flex-none rounded-full p-[3px] transition-colors ${isPublic ? "bg-qp-accent" : "bg-qp-fieldline"} ${focusRing}`}
                  >
                    <span
                      className={`h-5 w-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.3)] [transition:transform_.25s_cubic-bezier(.3,1.3,.5,1)] ${
                        isPublic ? "translate-x-[18px]" : ""
                      }`}
                    />
                  </button>
                </div>

                <div className="flex flex-col gap-3 pb-[18px] pt-4">
                  <div className="flex flex-col gap-1">
                    <span id="np-expiry" className="text-[15px] font-semibold">
                      Closes
                    </span>
                    <Hint id="np-expiry-hint" error={tried && badExpiry}>
                      {expiryHint}
                    </Hint>
                  </div>
                  <div
                    role="radiogroup"
                    aria-labelledby="np-expiry"
                    className={`flex flex-wrap gap-1.5 ${shaking && badExpiry ? "motion-safe:animate-qp-shake" : ""}`}
                  >
                    {EXPIRY.map((e) => {
                      const selected = expiry === e.key;
                      return (
                        <label key={e.key} className="relative cursor-pointer">
                          <input
                            type="radio"
                            name="closes"
                            value={e.key}
                            checked={selected}
                            onChange={() => chooseExpiry(e.key)}
                            aria-describedby="np-expiry-hint"
                            className="peer sr-only"
                          />
                          {selected && (
                            <motion.span layoutId="expiry-highlight" transition={slide} className="absolute inset-0 rounded-full bg-qp-ink" />
                          )}
                          <span
                            className={`relative flex h-[34px] items-center whitespace-nowrap rounded-full border px-3 text-sm font-medium transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-qp-accent peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-qp-bg ${
                              selected ? "border-transparent text-qp-bg" : "border-qp-line hover:border-qp-muted"
                            }`}
                          >
                            {e.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <AnimatePresence initial={false}>
                    {expiry === "custom" && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={collapse}
                        className="overflow-hidden"
                      >
                        <div className="p-1">
                          <input
                            ref={customRef}
                            type="datetime-local"
                            aria-label="Custom close date and time"
                            aria-describedby="np-expiry-hint"
                            aria-invalid={(tried && badExpiry) || undefined}
                            value={customAt}
                            min={toLocalInput(new Date(Date.now() + 5 * 60_000))}
                            onChange={(e) => setCustomAt(e.target.value)}
                            className={`h-11 w-full rounded-[10px] border bg-qp-field px-3 text-[15px] text-qp-ink outline-none [color-scheme:light] [transition:border-color_.2s,box-shadow_.2s] focus:border-qp-accent focus:shadow-[0_0_0_3px_var(--qp-ring)] dark:[color-scheme:dark] ${
                              tried && badExpiry ? "border-qp-error" : "border-qp-fieldline"
                            }`}
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            <div className="xl:order-1">
              <Preview question={question} options={options} pollType={pollType} />
            </div>
          </motion.aside>
        </fieldset>

        {/* ---------------------------- pinned action bar ---------------------------- */}
        {/* Sticks to the bottom of the screen while the form scrolls; on phones it
            sits on top of the 64px bottom nav. Screen chrome, like the header, so
            it arrives with the page rather than as the last step of the staggered
            entrance: fading in late, it let the form show through its spot and
            then slid up over it, which read as a flicker. */}
        <div className="sticky bottom-16 z-20 mt-8 flex items-center gap-3 border-t border-qp-line bg-qp-bg py-4 lg:bottom-0 lg:pb-6">
          <span className="mr-auto hidden text-sm text-qp-muted sm:block">
            {filledCount} of {options.length} options filled · {typeInfo.label.toLowerCase()}
          </span>
          <Link
            to="/dashboard"
            className={`flex h-12 flex-1 items-center justify-center whitespace-nowrap rounded-[10px] border border-qp-fieldline px-5 text-[15px] font-semibold transition-colors hover:border-qp-ink hover:bg-qp-track sm:flex-none ${focusRing}`}
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={busy}
            className={`flex h-12 flex-[2] items-center justify-center gap-2.5 whitespace-nowrap rounded-[10px] bg-qp-accent px-[22px] text-[15px] font-semibold text-qp-accent-fg [transition:filter_.2s,transform_.12s] enabled:hover:brightness-110 enabled:active:scale-[.985] disabled:cursor-default sm:min-w-[168px] sm:flex-none ${focusRing}`}
          >
            <AnimatePresence mode="popLayout" initial={false}>
              {status === "loading" && (
                <motion.span
                  key="spinner"
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  aria-hidden="true"
                  className="h-[15px] w-[15px] animate-spin rounded-full border-2 border-current border-r-transparent"
                />
              )}
              {status === "done" && (
                <motion.svg
                  key="check"
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <motion.path d="M20 6 9 17l-5-5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.3 }} />
                </motion.svg>
              )}
            </AnimatePresence>
            <span>{status === "loading" ? "Creating" : status === "done" ? "Created" : "Create poll"}</span>
          </button>
        </div>
      </form>

      {/* Lifted clear of the action bar (and the bottom nav on phones) */}
      <QpToast toast={toast} className="bottom-40 lg:bottom-[104px]" />
    </motion.div>
  );
}
