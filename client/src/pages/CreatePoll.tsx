import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../utils/api';
import ErrorMsg from '../components/shared/ErrorMsg';
import { fadeUp, staggerContainer } from '../components/motion/variants';
import type { PollType } from '../types/api';

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 6;
const blankOption = () => ({ id: crypto.randomUUID(), text: '' });

const POLL_TYPES: { value: PollType; label: string; description: string; icon: string }[] = [
  { value: 'single', label: 'Single choice', description: 'Voters pick one option', icon: 'radio_button_checked' },
  { value: 'multi', label: 'Multiple choice', description: 'Voters can pick several', icon: 'check_box' },
  { value: 'ranked', label: 'Ranked choice', description: 'Voters rank every option', icon: 'sort' },
];

export default function CreatePoll() {
  const navigate = useNavigate();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState([blankOption(), blankOption()]);
  const [pollType, setPollType] = useState<PollType>('single');
  const [isPublic, setIsPublic] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const updateOption = (id: string, text: string) =>
    setOptions(prev => prev.map(o => o.id === id ? { ...o, text } : o));
  const addOption = () => {
    if (options.length < MAX_OPTIONS) setOptions(prev => [...prev, blankOption()]);
  };
  const removeOption = (id: string) => {
    if (options.length > MIN_OPTIONS) setOptions(prev => prev.filter(o => o.id !== id));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const filled = options.map(o => o.text.trim()).filter(Boolean);
    if (!question.trim()) return setError('Question is required');
    if (filled.length < MIN_OPTIONS) return setError('Please provide at least 2 options');
    setLoading(true);
    try {
      await api.post('/polls', {
        question: question.trim(),
        options: filled,
        pollType,
        isPublic,
        expiresAt: expiresAt || undefined,
      });
      navigate('/dashboard');
    } catch (err) {
      const message = isAxiosError(err) ? err.response?.data?.message : undefined;
      setError(message || 'Failed to create poll');
    } finally { setLoading(false); }
  };

  const minDatetime = new Date(Date.now() + 5 * 60 * 1000).toISOString().slice(0, 16);

  const OPTION_COLORS = ['bg-primary-container', 'bg-secondary-container', 'bg-tertiary-container', 'bg-error-container', 'bg-primary-container', 'bg-secondary-container'];

  const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';

  return (
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="py-6"
      >
        {/* Header */}
        <motion.div variants={fadeUp} className="mb-8">
          <h1 className="font-display font-bold text-3xl text-on-surface">Create a Poll</h1>
          <p className="text-on-surface-variant text-sm mt-1">Share with anyone — no account needed to vote</p>
        </motion.div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <ErrorMsg message={error} />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Main column */}
            <div className="lg:col-span-2 space-y-6">
              {/* Question */}
              <motion.div variants={fadeUp} className="glass-card rounded-xl p-6">
                <label className="block text-xs font-mono tracking-widest text-on-surface-variant uppercase mb-3">
                  Question <span className="text-outline">({question.length}/300)</span>
                </label>
                <textarea
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  required maxLength={300} rows={3}
                  className={`w-full bg-surface-container border border-outline-variant rounded-xl px-4 py-3 text-sm text-on-surface placeholder-on-surface-variant/50 focus:outline-none focus:border-primary/60 focus:bg-surface-container-high transition-all resize-none ${focusRing}`}
                  placeholder="What would you like to ask?"
                />
              </motion.div>

              {/* Poll type */}
              <motion.div variants={fadeUp} className="glass-card rounded-xl p-6">
                <label className="block text-xs font-mono tracking-widest text-on-surface-variant uppercase mb-3">
                  Poll type
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {POLL_TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setPollType(t.value)}
                      className={`relative text-left p-3 rounded-xl border transition-colors overflow-hidden ${focusRing} ${
                        pollType === t.value
                          ? 'border-primary/60'
                          : 'border-outline-variant hover:bg-surface-container-high'
                      }`}
                    >
                      {pollType === t.value && (
                        <motion.span
                          layoutId="poll-type-bg"
                          className="absolute inset-0 bg-primary/10"
                          transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                        />
                      )}
                      <div className="relative flex items-center gap-2 mb-1">
                        <span className={`material-symbols-outlined text-[18px] ${pollType === t.value ? 'text-primary' : 'text-on-surface-variant'}`}>
                          {t.icon}
                        </span>
                        <span className={`text-sm font-semibold ${pollType === t.value ? 'text-primary' : 'text-on-surface'}`}>
                          {t.label}
                        </span>
                      </div>
                      <p className="relative text-xs text-on-surface-variant">{t.description}</p>
                    </button>
                  ))}
                </div>
              </motion.div>

              {/* Options */}
              <motion.div variants={fadeUp} className="glass-card rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <label className="text-xs font-mono tracking-widest text-on-surface-variant uppercase">
                    Options <span className="text-outline">({options.length}/{MAX_OPTIONS})</span>
                  </label>
                  {options.length < MAX_OPTIONS && (
                    <button
                      type="button" onClick={addOption}
                      className={`flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-mono font-bold transition-colors rounded ${focusRing}`}
                    >
                      <span className="material-symbols-outlined text-[16px]">add_circle</span>
                      Add option
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  <AnimatePresence initial={false}>
                    {options.map((opt, idx) => (
                      <motion.div
                        key={opt.id}
                        layout
                        initial={{ opacity: 0, y: -8, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: 'auto' }}
                        exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                        transition={{ type: 'spring', stiffness: 340, damping: 30 }}
                        className="flex items-center gap-3"
                      >
                        <div className={`w-6 h-6 rounded-lg ${OPTION_COLORS[idx]} flex items-center justify-center flex-shrink-0`}>
                          <span className="text-[10px] font-mono font-bold text-on-primary-container">{idx + 1}</span>
                        </div>
                        <input
                          type="text" value={opt.text}
                          onChange={e => updateOption(opt.id, e.target.value)}
                          maxLength={100}
                          className={`flex-1 bg-surface-container border border-outline-variant rounded-xl px-4 py-2.5 text-sm text-on-surface placeholder-on-surface-variant/50 focus:outline-none focus:border-primary/60 focus:bg-surface-container-high transition-all ${focusRing}`}
                          placeholder={`Option ${idx + 1}`}
                        />
                        {options.length > MIN_OPTIONS && (
                          <button
                            type="button" onClick={() => removeOption(opt.id)}
                            className={`p-1.5 text-on-surface-variant hover:text-error hover:bg-surface-container-high rounded-lg transition-all ${focusRing}`}
                          >
                            <span className="material-symbols-outlined text-[18px]">close</span>
                          </button>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </motion.div>
            </div>

            {/* Settings column */}
            <div className="space-y-6">
              {/* Visibility */}
              <motion.div variants={fadeUp} className="glass-card rounded-xl p-6">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={e => setIsPublic(e.target.checked)}
                    className={`mt-0.5 w-4 h-4 rounded border-outline-variant bg-surface-container accent-primary ${focusRing}`}
                  />
                  <span>
                    <span className="block text-sm font-semibold text-on-surface">List on public Discover page</span>
                    <span className="block text-xs text-on-surface-variant mt-0.5">
                      Anyone can find and vote on this poll from the Discover page. Leave unchecked to only share via direct link.
                    </span>
                  </span>
                </label>
              </motion.div>

              {/* Expiry */}
              <motion.div variants={fadeUp} className="glass-card rounded-xl p-6">
                <label className="block text-xs font-mono tracking-widest text-on-surface-variant uppercase mb-3">
                  Expiry <span className="text-outline">(optional)</span>
                </label>
                <input
                  type="datetime-local" value={expiresAt} min={minDatetime}
                  onChange={e => setExpiresAt(e.target.value)}
                  className={`w-full bg-surface-container border border-outline-variant rounded-xl px-4 py-3 text-sm text-on-surface focus:outline-none focus:border-primary/60 focus:bg-surface-container-high transition-all [color-scheme:dark] ${focusRing}`}
                />
                <p className="text-xs text-on-surface-variant mt-2 font-mono">
                  Leave blank to keep the poll open indefinitely
                </p>
              </motion.div>
            </div>
          </div>

          {/* Submit */}
          <motion.div variants={fadeUp} className="flex gap-3">
            <motion.button
              whileTap={{ scale: 0.97 }}
              type="button" onClick={() => navigate('/dashboard')}
              className={`flex-1 py-3 border border-outline-variant text-on-surface-variant font-display font-bold rounded-xl hover:bg-surface-container-high transition-colors text-sm ${focusRing}`}
            >
              Cancel
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.97 }}
              type="submit" disabled={loading}
              className={`flex-2 flex-grow-[2] py-3 bg-primary-container text-on-primary-container font-display font-bold rounded-xl transition-colors disabled:opacity-50 text-sm ${focusRing}`}
            >
              {loading ? 'Creating…' : 'Create Poll'}
            </motion.button>
          </motion.div>
        </form>
      </motion.div>
  );
}
