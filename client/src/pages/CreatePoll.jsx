import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api.js';
import Layout from '../components/Layout.jsx';

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 6;
const blankOption = () => ({ id: crypto.randomUUID(), text: '' });

export default function CreatePoll() {
  const navigate = useNavigate();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState([blankOption(), blankOption()]);
  const [expiresAt, setExpiresAt] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const updateOption = (id, text) =>
    setOptions(prev => prev.map(o => o.id === id ? { ...o, text } : o));
  const addOption = () => {
    if (options.length < MAX_OPTIONS) setOptions(prev => [...prev, blankOption()]);
  };
  const removeOption = (id) => {
    if (options.length > MIN_OPTIONS) setOptions(prev => prev.filter(o => o.id !== id));
  };

  const handleSubmit = async (e) => {
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
        expiresAt: expiresAt || undefined,
      });
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create poll');
    } finally { setLoading(false); }
  };

  const minDatetime = new Date(Date.now() + 5 * 60 * 1000).toISOString().slice(0, 16);

  const OPTION_COLORS = ['bg-primary-container', 'bg-secondary-container', 'bg-tertiary-container', 'bg-error-container', 'bg-primary-container', 'bg-secondary-container'];

  return (
    <Layout>
      <div className="max-w-2xl mx-auto py-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-display font-bold text-3xl text-on-surface">Create a Poll</h1>
          <p className="text-on-surface-variant text-sm mt-1">Share with anyone — no account needed to vote</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="px-4 py-3 bg-error-container/20 border border-error/30 rounded-xl text-sm text-error">
              {error}
            </div>
          )}

          {/* Question */}
          <div className="glass-card rounded-xl p-6">
            <label className="block text-xs font-mono tracking-widest text-on-surface-variant uppercase mb-3">
              Question <span className="text-outline">({question.length}/300)</span>
            </label>
            <textarea
              value={question}
              onChange={e => setQuestion(e.target.value)}
              required maxLength={300} rows={3}
              className="w-full bg-surface-container border border-outline-variant rounded-xl px-4 py-3 text-sm text-on-surface placeholder-on-surface-variant/50 focus:outline-none focus:border-primary/60 focus:bg-surface-container-high transition-all resize-none"
              placeholder="What would you like to ask?"
            />
          </div>

          {/* Options */}
          <div className="glass-card rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <label className="text-xs font-mono tracking-widest text-on-surface-variant uppercase">
                Options <span className="text-outline">({options.length}/{MAX_OPTIONS})</span>
              </label>
              {options.length < MAX_OPTIONS && (
                <button
                  type="button" onClick={addOption}
                  className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-mono font-bold transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">add_circle</span>
                  Add option
                </button>
              )}
            </div>

            <div className="space-y-3">
              {options.map((opt, idx) => (
                <div key={opt.id} className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-lg ${OPTION_COLORS[idx]} flex items-center justify-center flex-shrink-0`}>
                    <span className="text-[10px] font-mono font-bold text-on-primary-container">{idx + 1}</span>
                  </div>
                  <input
                    type="text" value={opt.text}
                    onChange={e => updateOption(opt.id, e.target.value)}
                    maxLength={100}
                    className="flex-1 bg-surface-container border border-outline-variant rounded-xl px-4 py-2.5 text-sm text-on-surface placeholder-on-surface-variant/50 focus:outline-none focus:border-primary/60 focus:bg-surface-container-high transition-all"
                    placeholder={`Option ${idx + 1}`}
                  />
                  {options.length > MIN_OPTIONS && (
                    <button
                      type="button" onClick={() => removeOption(opt.id)}
                      className="p-1.5 text-on-surface-variant hover:text-error hover:bg-surface-container-high rounded-lg transition-all"
                    >
                      <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Expiry */}
          <div className="glass-card rounded-xl p-6">
            <label className="block text-xs font-mono tracking-widest text-on-surface-variant uppercase mb-3">
              Expiry <span className="text-outline">(optional)</span>
            </label>
            <input
              type="datetime-local" value={expiresAt} min={minDatetime}
              onChange={e => setExpiresAt(e.target.value)}
              className="w-full bg-surface-container border border-outline-variant rounded-xl px-4 py-3 text-sm text-on-surface focus:outline-none focus:border-primary/60 focus:bg-surface-container-high transition-all [color-scheme:dark]"
            />
            <p className="text-xs text-on-surface-variant mt-2 font-mono">
              Leave blank to keep the poll open indefinitely
            </p>
          </div>

          {/* Submit */}
          <div className="flex gap-3">
            <button
              type="button" onClick={() => navigate('/dashboard')}
              className="flex-1 py-3 border border-outline-variant text-on-surface-variant font-display font-bold rounded-xl hover:bg-surface-container-high transition-all text-sm"
            >
              Cancel
            </button>
            <button
              type="submit" disabled={loading}
              className="flex-2 flex-grow-[2] py-3 bg-primary-container text-on-primary-container font-display font-bold rounded-xl hover:scale-[0.99] active:scale-[0.97] transition-all disabled:opacity-50 text-sm"
            >
              {loading ? 'Creating…' : 'Create Poll'}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
