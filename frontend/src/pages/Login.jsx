import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, AlertCircle, ArrowRight, FileText, Hash, Cloud } from 'lucide-react';
import api from '../lib/axios';

function parseApiError(err) {
  if (err.code === 'ECONNABORTED' || err.message?.includes('timeout'))
    return 'Request timed out. Check that the backend is running.';
  if (!err.response)
    return 'Cannot reach the server. Make sure the backend is running on port 8000.';
  const detail = err.response.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail))
    return detail.map((d) => d.msg ?? d.message ?? JSON.stringify(d)).join(' · ');
  const status = err.response.status;
  if (status === 401) return 'Incorrect email or password.';
  if (status === 400) return detail ?? 'Request error. Please check your input.';
  if (status === 500) return 'Server error. Please try again later.';
  return 'Something went wrong. Please try again.';
}

const SOURCES = [
  { Icon: FileText, label: 'Notion', color: '#e2e4f0' },
  { Icon: Hash, label: 'Slack', color: '#36C5F0' },
  { Icon: Cloud, label: 'Google Drive', color: '#4285F4' },
];

export default function Login() {
  const [showSignIn, setShowSignIn] = useState(false);
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ email: '', password: '', company_name: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const navigate = useNavigate();

  const tryDemo = async () => {
    setDemoLoading(true);
    setError('');
    try {
      const id = Math.random().toString(36).slice(2, 9);
      const email = `guest_${id}@demo.nexusai`;
      const password = Math.random().toString(36).slice(2) + id;
      const { data } = await api.post('/api/auth/register', {
        email,
        password,
        company_name: 'Demo',
      });
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('company_id', data.company_id);
      localStorage.setItem('user_id', data.user_id);
      localStorage.setItem('email', email);
      localStorage.setItem('company_name', 'Demo');
      navigate('/chat');
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setDemoLoading(false);
    }
  };

  const handleChange = (e) => {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
    if (error) setError('');
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    if (!form.email.trim()) return setError('Email is required.');
    if (!form.password) return setError('Password is required.');
    if (mode === 'register') {
      if (!form.company_name.trim()) return setError('Company name is required.');
      if (form.password.length < 8) return setError('Password must be at least 8 characters.');
    }
    setError('');
    setLoading(true);
    try {
      const isRegister = mode === 'register';
      const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
      const body = isRegister
        ? { email: form.email, password: form.password, company_name: form.company_name }
        : { email: form.email, password: form.password };
      const { data } = await api.post(endpoint, body);
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('company_id', data.company_id);
      localStorage.setItem('user_id', data.user_id);
      localStorage.setItem('email', data.email);
      if (isRegister) localStorage.setItem('company_name', form.company_name);
      navigate('/chat');
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full bg-ink border rounded-lg px-3 py-2.5 text-sm text-[#e8eaf0] placeholder-zinc-600 focus:outline-none transition-colors ' +
    (error ? 'border-red-500/50 focus:border-red-500' : 'border-rim focus:border-accent');

  // ── Sign-in / register form ───────────────────────────────────────────────
  if (showSignIn) {
    return (
      <div className="min-h-screen bg-ink flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2.5 mb-8 justify-center">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
              <Zap size={16} className="text-white" />
            </div>
            <span className="text-[#e8eaf0] text-xl font-semibold tracking-tight">NexusAI</span>
          </div>

          <div className="bg-panel rounded-xl border border-rim p-8">
            <div className="flex gap-1 p-1 bg-ink rounded-lg mb-6">
              {[{ id: 'login', label: 'Sign in' }, { id: 'register', label: 'Create account' }].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => { setMode(tab.id); setError(''); }}
                  className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${
                    mode === tab.id ? 'bg-panel text-[#e8eaf0]' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {error && (
              <div className="flex items-start gap-2.5 rounded-lg bg-red-500/15 border border-red-500/40 px-3.5 py-3 mb-4">
                <AlertCircle size={15} className="text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-300 leading-snug">{error}</p>
              </div>
            )}

            <form onSubmit={handleSignIn} className="space-y-4">
              {mode === 'register' && (
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">Company name</label>
                  <input name="company_name" value={form.company_name} onChange={handleChange} placeholder="Acme Inc." className={inputClass} />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Email</label>
                <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="you@company.com" autoComplete="email" className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Password</label>
                <input name="password" type="password" value={form.password} onChange={handleChange} placeholder="••••••••" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} className={inputClass} />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-accent hover:bg-[#4a5ae8] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
              >
                {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
              </button>
            </form>
          </div>

          <button
            onClick={() => { setShowSignIn(false); setError(''); }}
            className="block w-full text-center text-xs text-zinc-600 hover:text-zinc-400 mt-5 transition-colors"
          >
            ← Back
          </button>
        </div>
      </div>
    );
  }

  // ── Landing page ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-ink flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg text-center">
        {/* Logo */}
        <div className="flex items-center gap-3 justify-center mb-10">
          <div className="w-11 h-11 rounded-xl bg-accent flex items-center justify-center shadow-lg shadow-accent/30">
            <Zap size={22} className="text-white" />
          </div>
          <span className="text-[#e8eaf0] text-3xl font-bold tracking-tight">NexusAI</span>
        </div>

        {/* Hero */}
        <h1 className="text-4xl font-bold text-[#e8eaf0] leading-tight mb-4">
          Your company's knowledge,<br />
          <span className="text-accent">instantly searchable.</span>
        </h1>
        <p className="text-zinc-500 text-base leading-relaxed mb-10 max-w-md mx-auto">
          Ask questions in plain English. Get cited answers pulled directly from Notion, Slack, and Google Drive - in seconds.
        </p>

        {/* Source pills */}
        <div className="flex items-center justify-center gap-3 mb-10">
          {SOURCES.map(({ Icon, label, color }) => (
            <div
              key={label}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-rim bg-panel text-xs text-zinc-400"
            >
              <Icon size={12} style={{ color }} />
              {label}
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2.5 rounded-lg bg-red-500/15 border border-red-500/40 px-3.5 py-3 mb-5 text-left max-w-sm mx-auto">
            <AlertCircle size={15} className="text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-300 leading-snug">{error}</p>
          </div>
        )}

        {/* CTA */}
        <button
          onClick={tryDemo}
          disabled={demoLoading}
          className="inline-flex items-center gap-2.5 bg-accent hover:bg-[#4a5ae8] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold px-8 py-3.5 rounded-xl text-base transition-all shadow-lg shadow-accent/25 hover:shadow-accent/40 hover:-translate-y-0.5"
        >
          {demoLoading ? 'Starting…' : 'Try NexusAI'}
          {!demoLoading && <ArrowRight size={18} />}
        </button>

        <p className="text-xs text-zinc-700 mt-3">No sign-up required · Your session is private</p>

        <button
          onClick={() => setShowSignIn(true)}
          className="block mx-auto mt-9 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          Have an account? Sign in
        </button>
      </div>
    </div>
  );
}
