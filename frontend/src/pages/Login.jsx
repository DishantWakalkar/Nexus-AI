import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, AlertCircle } from 'lucide-react';
import api from '../lib/axios';

const TABS = [
  { id: 'login', label: 'Sign in' },
  { id: 'register', label: 'Create account' },
];

function validate(mode, form) {
  if (mode === 'register' && !form.company_name.trim()) {
    return 'Company name is required.';
  }
  if (!form.email.trim()) return 'Email is required.';
  if (!form.password) return 'Password is required.';
  if (mode === 'register' && form.password.length < 8) {
    return 'Password must be at least 8 characters.';
  }
  return null;
}

function parseApiError(err) {
  if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
    return 'Request timed out. The server is taking too long — check that the backend is running.';
  }
  if (!err.response) {
    return 'Cannot reach the server. Make sure the backend is running on port 8000.';
  }
  const detail = err.response.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail.map((d) => d.msg ?? d.message ?? JSON.stringify(d)).join(' · ');
  }
  const status = err.response.status;
  if (status === 401) return 'Incorrect email or password.';
  if (status === 400) return detail ?? 'Request error. Please check your input.';
  if (status === 500) return 'Server error. Please try again later.';
  return 'Something went wrong. Please try again.';
}

export default function Login() {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ email: '', password: '', company_name: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (error) setError('');
  };

  const switchMode = (next) => {
    setMode(next);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validationError = validate(mode, form);
    if (validationError) {
      setError(validationError);
      return;
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
      if (isRegister) {
        localStorage.setItem('company_name', form.company_name);
      }

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

  return (
    <div className="min-h-screen bg-ink flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
            <Zap size={16} className="text-white" />
          </div>
          <span className="text-[#e8eaf0] text-xl font-semibold tracking-tight">NexusAI</span>
        </div>

        <div className="bg-panel rounded-xl border border-rim p-8">
          {/* Mode toggle */}
          <div className="flex gap-1 p-1 bg-ink rounded-lg mb-6">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => switchMode(tab.id)}
                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${
                  mode === tab.id
                    ? 'bg-panel text-[#e8eaf0]'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Error banner — shown above the form so it's impossible to miss */}
          {error && (
            <div className="flex items-start gap-2.5 rounded-lg bg-red-500/15 border border-red-500/40 px-3.5 py-3 mb-4">
              <AlertCircle size={15} className="text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-300 leading-snug">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Company name
                </label>
                <input
                  name="company_name"
                  value={form.company_name}
                  onChange={handleChange}
                  placeholder="Acme Inc."
                  className={inputClass}
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Email</label>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@company.com"
                autoComplete="email"
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Password</label>
              <input
                name="password"
                type="password"
                value={form.password}
                onChange={handleChange}
                placeholder="••••••••"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                className={inputClass}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-accent hover:bg-[#4a5ae8] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
            >
              {loading
                ? 'Please wait…'
                : mode === 'login'
                ? 'Sign in'
                : 'Create account'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-zinc-600 mt-6">
          Company knowledge, instantly searchable.
        </p>
      </div>
    </div>
  );
}
