import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FileText, Hash, Cloud, RefreshCw, LogOut, Zap, PenSquare, Settings } from 'lucide-react';
import api from '../lib/axios';

const SOURCES = [
  { id: 'notion', label: 'Notion', Icon: FileText, color: '#e2e4f0', endpoint: '/api/ingest/notion' },
  { id: 'slack', label: 'Slack', Icon: Hash, color: '#36C5F0', endpoint: '/api/ingest/slack' },
  { id: 'google_drive', label: 'Google Drive', Icon: Cloud, color: '#4285F4', endpoint: '/api/ingest/google-drive' },
];

function relativeTime(iso) {
  if (!iso) return 'Never synced';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function Sidebar({ email, addToast, onNewChat }) {
  const [syncState, setSyncState] = useState({});
  const [lastSynced, setLastSynced] = useState({});
  const navigate = useNavigate();

  const companyName = localStorage.getItem('company_name');
  const initial = email ? email.charAt(0).toUpperCase() : '?';

  const sync = async (source) => {
    if (syncState[source.id] === 'loading') return;
    setSyncState((p) => ({ ...p, [source.id]: 'loading' }));

    try {
      await api.post(source.endpoint);
      const now = new Date().toISOString();
      setSyncState((p) => ({ ...p, [source.id]: 'success' }));
      setLastSynced((p) => ({ ...p, [source.id]: now }));
      addToast(`${source.label} synced`, 'success');
      setTimeout(() => setSyncState((p) => ({ ...p, [source.id]: 'idle' })), 3000);
    } catch (err) {
      if (err.response?.status !== 401) {
        setSyncState((p) => ({ ...p, [source.id]: 'error' }));
        addToast(`Failed to sync ${source.label}`, 'error');
        setTimeout(() => setSyncState((p) => ({ ...p, [source.id]: 'idle' })), 3000);
      }
    }
  };

  const logout = () => {
    localStorage.clear();
    navigate('/login');
  };

  return (
    <aside className="w-[260px] flex-shrink-0 bg-panel border-r border-rim flex flex-col h-full select-none">
      {/* Wordmark */}
      <div className="px-4 py-3.5 border-b border-rim flex items-center gap-2">
        <div className="w-6 h-6 rounded-md bg-accent flex items-center justify-center flex-shrink-0">
          <Zap size={13} className="text-white" />
        </div>
        <span className="text-[#e8eaf0] text-sm font-semibold tracking-tight">NexusAI</span>
      </div>

      {/* New chat */}
      <div className="px-3 pt-3 pb-1">
        <button
          onClick={onNewChat}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-[#e8eaf0] border border-rim hover:border-zinc-600 hover:bg-lift transition-all"
        >
          <PenSquare size={13} />
          New chat
        </button>
      </div>

      {/* Sources */}
      <div className="flex-1 px-3 py-3 overflow-y-auto">
        <div className="flex items-center justify-between px-2 mb-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
            Connected Sources
          </p>
          <Link
            to="/connections"
            title="Manage connections"
            className="text-zinc-600 hover:text-zinc-300 transition-colors"
          >
            <Settings size={11} />
          </Link>
        </div>

        <div className="space-y-0.5">
          {SOURCES.map((source) => {
            const { Icon } = source;
            const state = syncState[source.id] ?? 'idle';
            const isLoading = state === 'loading';
            const dotColor =
              state === 'success' ? '#22c55e' : state === 'error' ? '#ef4444' : '#3a3d4e';

            return (
              <div
                key={source.id}
                className="group rounded-lg px-2 py-2 hover:bg-lift transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors"
                      style={{ backgroundColor: dotColor }}
                    />
                    <Icon size={13} style={{ color: source.color }} className="flex-shrink-0" />
                    <span className="text-sm text-zinc-300 truncate">{source.label}</span>
                  </div>

                  <button
                    onClick={() => sync(source)}
                    disabled={isLoading}
                    title={`Sync ${source.label}`}
                    className="flex items-center gap-1 text-[11px] text-zinc-600 hover:text-zinc-300 transition-colors disabled:opacity-40 flex-shrink-0 opacity-0 group-hover:opacity-100"
                  >
                    <RefreshCw size={11} className={isLoading ? 'animate-spin' : ''} />
                    {isLoading ? 'Syncing' : 'Sync'}
                  </button>
                </div>

                <p className="text-[10px] text-zinc-700 mt-0.5 pl-[26px]">
                  {isLoading ? 'Syncing…' : relativeTime(lastSynced[source.id])}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* User footer */}
      <div className="border-t border-rim px-3 py-3">
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          {/* Avatar */}
          <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
            <span className="text-[10px] font-bold text-accent">{initial}</span>
          </div>

          <div className="flex-1 min-w-0">
            {companyName && (
              <p className="text-xs font-medium text-zinc-300 truncate leading-tight">{companyName}</p>
            )}
            <p className="text-[11px] text-zinc-500 truncate leading-tight">{email}</p>
          </div>

          <button
            onClick={logout}
            title="Sign out"
            className="p-1.5 rounded-md text-zinc-600 hover:text-[#e8eaf0] hover:bg-lift transition-colors flex-shrink-0"
          >
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </aside>
  );
}
