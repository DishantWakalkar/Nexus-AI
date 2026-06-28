import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/axios';

function parseApiError(err) {
  if (err.code === 'ECONNABORTED' || err.message?.includes('timeout'))
    return 'Request timed out. Check that the backend is running.';
  if (!err.response) return 'Cannot reach the server. Make sure the backend is running.';
  const detail = err.response.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map((d) => d.msg ?? JSON.stringify(d)).join(' · ');
  const s = err.response.status;
  if (s === 401) return 'Incorrect email or password.';
  if (s === 400) return detail ?? 'Request error.';
  return 'Something went wrong. Please try again.';
}

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
      const { data } = await api.post('/api/auth/register', { email, password, company_name: 'Demo' });
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
    setError('');
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
      const isR = mode === 'register';
      const { data } = await api.post(
        isR ? '/api/auth/register' : '/api/auth/login',
        isR
          ? { email: form.email, password: form.password, company_name: form.company_name }
          : { email: form.email, password: form.password }
      );
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('company_id', data.company_id);
      localStorage.setItem('user_id', data.user_id);
      localStorage.setItem('email', data.email);
      if (isR) localStorage.setItem('company_name', form.company_name);
      navigate('/chat');
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    'w-full bg-paper border border-border-input rounded-sm px-3 py-2.5 text-sm text-ink placeholder-muted focus:outline-none focus:border-ink transition-colors';

  if (showSignIn) {
    return (
      <div className="min-h-screen dot-grid bg-paper flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <button
            onClick={() => setShowSignIn(false)}
            className="font-serif font-medium text-2xl text-ink mb-10 block"
          >
            Nexus
          </button>
          <div className="bg-surface border border-border rounded-sm p-8">
            <div className="flex mb-6 border border-border-input rounded-sm overflow-hidden">
              {[{ id: 'login', label: 'Sign in' }, { id: 'register', label: 'Create account' }].map((t) => (
                <button
                  key={t.id}
                  onClick={() => { setMode(t.id); setError(''); }}
                  className={`flex-1 py-2 text-sm font-medium transition-all ${
                    mode === t.id ? 'bg-ink text-paper' : 'bg-surface text-sage hover:text-ink'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {error && <p className="text-red-600 text-sm mb-4 leading-snug">{error}</p>}

            <form onSubmit={handleSignIn} className="space-y-4">
              {mode === 'register' && (
                <div>
                  <label className="block font-mono text-[10px] tracking-[.16em] text-muted mb-1.5 uppercase">
                    Company name
                  </label>
                  <input
                    name="company_name"
                    value={form.company_name}
                    onChange={handleChange}
                    placeholder="Acme Inc."
                    className={inputCls}
                  />
                </div>
              )}
              <div>
                <label className="block font-mono text-[10px] tracking-[.16em] text-muted mb-1.5 uppercase">
                  Email
                </label>
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="you@company.com"
                  autoComplete="email"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block font-mono text-[10px] tracking-[.16em] text-muted mb-1.5 uppercase">
                  Password
                </label>
                <input
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  className={inputCls}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-ink hover:bg-forest-dark disabled:opacity-50 text-paper font-mono text-xs tracking-[.12em] py-3 rounded-sm transition-colors uppercase"
              >
                {loading ? 'Please wait…' : mode === 'login' ? 'Sign in →' : 'Create account →'}
              </button>
            </form>
          </div>
          <button
            onClick={() => setShowSignIn(false)}
            className="block w-full text-center font-mono text-[10px] tracking-[.12em] text-muted hover:text-ink mt-5 transition-colors uppercase"
          >
            ← Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen dot-grid bg-paper flex flex-col">
      {/* Nav */}
      <header className="flex items-center justify-between px-11 py-[22px] border-b border-border">
        <div className="flex items-baseline gap-3">
          <span className="font-serif font-medium text-[23px] tracking-[.005em] text-ink">Nexus</span>
          <span className="font-mono text-[10px] tracking-[.26em] text-muted uppercase">Index of Knowledge</span>
        </div>
        <div className="flex items-center gap-7">
          <button
            onClick={() => setShowSignIn(true)}
            className="font-mono text-[11px] tracking-[.12em] text-sage hover:text-ink transition-colors uppercase"
          >
            Connections
          </button>
          <button
            onClick={tryDemo}
            disabled={demoLoading}
            className="inline-flex items-center gap-2 bg-ink hover:bg-forest disabled:opacity-60 text-paper font-mono text-[11px] tracking-[.12em] px-[17px] py-[10px] rounded-sm transition-colors uppercase"
          >
            {demoLoading ? 'Opening…' : 'Open Workspace →'}
          </button>
        </div>
      </header>

      {/* Hero grid */}
      <div className="flex-1 grid grid-cols-[1.05fr_.95fr] gap-16 max-w-[1280px] w-full mx-auto px-11 py-20 items-center">
        <div>
          <div className="font-mono text-[11px] tracking-[.22em] text-forest mb-7 uppercase">
            Answers from all your tools
          </div>
          <h1 className="font-serif font-normal text-[62px] leading-[1.04] tracking-[-0.018em] text-ink mb-7">
            Ask your company<br />
            <em className="text-forest not-italic" style={{ fontStyle: 'italic' }}>anything.</em>
          </h1>
          <p className="text-[17px] leading-[1.62] text-sage max-w-[445px] mb-10">
            Nexus reads across your Notion, Slack, and Google Drive and answers in plain English - with every
            fact linked back to the source it came from. No more hunting through tabs and old threads.
          </p>
          {error && <p className="text-red-600 text-sm mb-5">{error}</p>}
          <div className="flex items-center gap-5">
            <button
              onClick={tryDemo}
              disabled={demoLoading}
              className="inline-flex items-center gap-2.5 bg-forest hover:bg-forest-dark disabled:opacity-60 text-[#F2FBF6] text-[15px] font-semibold px-7 py-[15px] rounded-[3px] transition-colors"
              style={{ boxShadow: '0 0 26px -6px rgba(28,140,91,.65)' }}
            >
              {demoLoading ? 'Starting…' : 'Try it now →'}
            </button>
            <button
              onClick={() => setShowSignIn(true)}
              className="text-[14px] text-sage hover:text-ink underline underline-offset-4 transition-colors"
            >
              Connect your tools
            </button>
          </div>
        </div>

        {/* Terminal demo */}
        <div
          className="relative bg-[#0E1714] border border-[rgba(47,215,154,.22)] rounded-lg overflow-hidden"
          style={{ boxShadow: '0 40px 90px -40px rgba(14,23,20,.7),0 0 70px -24px rgba(47,215,154,.35)' }}
        >
          <div
            className="absolute top-0 left-0 right-0 h-[60px] pointer-events-none animate-scan"
            style={{ background: 'linear-gradient(180deg,rgba(47,215,154,.10),transparent)' }}
          />
          {/* Corner brackets */}
          <span className="absolute top-[11px] left-[11px] w-[11px] h-[11px] border-t border-l border-[rgba(47,215,154,.5)]" />
          <span className="absolute top-[11px] right-[11px] w-[11px] h-[11px] border-t border-r border-[rgba(47,215,154,.5)]" />
          <span className="absolute bottom-[11px] left-[11px] w-[11px] h-[11px] border-b border-l border-[rgba(47,215,154,.5)]" />
          <span className="absolute bottom-[11px] right-[11px] w-[11px] h-[11px] border-b border-r border-[rgba(47,215,154,.5)]" />

          <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[.06]">
            <div className="flex items-center gap-2">
              <span
                className="w-1.5 h-1.5 rounded-full bg-[#2FD79A] animate-blink inline-block"
                style={{ boxShadow: '0 0 9px #2FD79A' }}
              />
              <span className="font-mono text-[9px] tracking-[.2em] text-[#2FD79A]">LIVE ANSWER</span>
            </div>
            <span className="font-mono text-[9px] tracking-[.12em] text-[#5E6E66]">ANSWERED IN 0.4s</span>
          </div>

          <div className="px-6 py-6">
            <div className="font-mono text-[9px] tracking-[.2em] text-[#5E6E66] mb-2.5 uppercase">Question</div>
            <div className="font-serif text-[23px] leading-[1.25] text-[#EAF2EE] mb-5">
              Why did the mobile app slip to Q4?
            </div>
            <div className="h-px bg-white/[.07] mb-4" />
            <p className="text-[14px] leading-[1.66] text-[#9FB0A8] mb-3">
              The launch moved to Q4 so engineering could finish hardening the new connectors first
              <sup className="font-mono text-[10px] font-semibold text-[#2FD79A] px-px" style={{ textShadow: '0 0 8px rgba(47,215,154,.6)' }}>1</sup>.
              The decision was made in the September product review and confirmed in{' '}
              <strong className="font-semibold text-[#EAF2EE]">#product</strong> that same week
              <sup className="font-mono text-[10px] font-semibold text-[#2FD79A] px-px" style={{ textShadow: '0 0 8px rgba(47,215,154,.6)' }}>2</sup>.
            </p>
            <div className="mt-4 pt-3.5 border-t border-white/[.07]">
              <div className="font-mono text-[9px] tracking-[.2em] text-[#5E6E66] mb-2 uppercase">Sources</div>
              {[['1','N','Product → Review Notes','Notion'],['2','S','#product','Slack']].map(([n, l, title, plat]) => (
                <div key={n} className="flex items-center gap-3 py-[7px]">
                  <span className="font-mono text-[11px] text-[#2FD79A] w-3.5">{n}</span>
                  <span className="w-5 h-5 rounded-[5px] bg-[rgba(47,215,154,.12)] border border-[rgba(47,215,154,.3)] text-[#2FD79A] font-mono text-[9px] flex items-center justify-center flex-shrink-0">
                    {l}
                  </span>
                  <span className="text-[13px] text-[#C7D4CE] flex-1">{title}</span>
                  <span className="font-mono text-[10px] text-[#5E6E66]">{plat}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 3-step bar */}
      <div className="border-t border-border bg-step">
        <div className="max-w-[1280px] mx-auto px-11 grid grid-cols-3">
          {[
            ['STEP 01', 'Connect your tools', 'Link Notion, Slack, and Google Drive in a couple of clicks.'],
            ['STEP 02', 'Ask in plain English', 'No keywords or filters. Just type the question you actually have.'],
            ['STEP 03', 'Get a cited answer', 'Every response links straight back to the source it came from.'],
          ].map(([step, title, desc], i) => (
            <div
              key={step}
              className={`py-8 ${
                i === 0 ? 'pr-8 border-r border-border' : i === 1 ? 'px-8 border-r border-border' : 'pl-8'
              }`}
            >
              <div className="font-mono text-[11px] tracking-[.14em] text-forest mb-3 uppercase">{step}</div>
              <div className="font-serif text-[21px] text-ink mb-1.5">{title}</div>
              <div className="text-[13.5px] text-sage leading-[1.5]">{desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
