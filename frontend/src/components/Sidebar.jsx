import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../lib/axios';

const SOURCES = [
  { id: 'notion',       label: 'Notion',       letter: 'N', endpoint: '/api/ingest/notion' },
  { id: 'slack',        label: 'Slack',         letter: 'S', endpoint: '/api/ingest/slack' },
  { id: 'google_drive', label: 'Google Drive',  letter: 'D', endpoint: '/api/ingest/google-drive' },
];

export default function Sidebar({ email, addToast, onNewChat }) {
  const [syncState, setSyncState] = useState({});
  const navigate = useNavigate();
  const companyName = localStorage.getItem('company_name') ?? '';
  const initial = email ? email.charAt(0).toUpperCase() : '?';

  const sync = async (source) => {
    if (syncState[source.id] === 'loading') return;
    setSyncState((p) => ({ ...p, [source.id]: 'loading' }));
    try {
      await api.post(source.endpoint);
      setSyncState((p) => ({ ...p, [source.id]: 'done' }));
      addToast(`${source.label} sync started`);
      setTimeout(() => setSyncState((p) => ({ ...p, [source.id]: null })), 3000);
    } catch (err) {
      if (err.response?.status !== 401) {
        addToast(`Failed to sync ${source.label}`);
        setSyncState((p) => ({ ...p, [source.id]: null }));
      }
    }
  };

  const logout = () => { localStorage.clear(); navigate('/'); };

  return (
    <aside className="w-[274px] flex-shrink-0 bg-sidebar border-r border-border-soft flex flex-col h-full select-none">
      {/* Wordmark */}
      <button
        onClick={() => navigate('/login')}
        className="flex items-baseline gap-2.5 px-[22px] py-[21px] border-b border-border-soft text-left hover:opacity-80 transition-opacity"
      >
        <span className="font-serif font-medium text-[20px] text-ink">Nexus</span>
        <span className="font-mono text-[9px] tracking-[.2em] text-muted uppercase">Workspace</span>
      </button>

      {/* New thread */}
      <div className="px-4 py-4">
        <button
          onClick={onNewChat}
          className="w-full flex items-center gap-2.5 bg-surface border border-border-input hover:border-forest hover:text-forest text-ink text-[13.5px] font-medium px-3.5 py-[11px] rounded-[4px] transition-all"
        >
          <span className="text-base leading-none">＋</span>
          New thread
        </button>
      </div>

      {/* Sources */}
      <div className="flex-1 px-4 overflow-y-auto">
        <div className="font-mono text-[9px] tracking-[.22em] text-muted uppercase px-2 pb-3">
          Connected Sources
        </div>

        {SOURCES.map((source) => {
          const state = syncState[source.id];
          const syncing = state === 'loading';
          return (
            <div
              key={source.id}
              className="flex items-center justify-between gap-2 px-2 py-[9px] rounded-[5px] hover:bg-[#E0E7E1] transition-colors"
            >
              <div className="flex items-center gap-[11px] min-w-0">
                <span className="w-[21px] h-[21px] rounded-[5px] bg-ink text-paper font-mono text-[9px] flex items-center justify-center flex-shrink-0">
                  {source.letter}
                </span>
                <div className="min-w-0">
                  <div className="text-[13px] text-ink truncate">{source.label}</div>
                  {syncing && (
                    <div className="font-mono text-[10.5px] text-dim mt-0.5">Syncing…</div>
                  )}
                  {state === 'done' && !syncing && (
                    <div className="font-mono text-[10.5px] text-forest mt-0.5">Queued ✓</div>
                  )}
                </div>
              </div>
              <button
                onClick={() => sync(source)}
                title={`Sync ${source.label}`}
                className="text-[13px] text-muted hover:text-forest transition-colors flex-shrink-0"
              >
                ↻
              </button>
            </div>
          );
        })}

        <Link
          to="/connections"
          className="w-full flex items-center gap-2.5 mt-3 px-2 py-[10px] rounded-[5px] text-[12.5px] text-sage hover:bg-[#E0E7E1] hover:text-ink transition-all"
        >
          ⚙&nbsp;&nbsp;Manage connections
        </Link>
      </div>

      {/* User footer */}
      <div className="border-t border-border-soft px-4 py-3.5 flex items-center gap-[11px]">
        <div className="w-[30px] h-[30px] rounded-full bg-forest text-[#F2FBF6] font-serif text-[15px] flex items-center justify-center flex-shrink-0">
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          {companyName && (
            <div className="text-[12.5px] font-semibold text-ink leading-tight truncate">{companyName}</div>
          )}
          <div className="text-[11px] text-dim leading-tight truncate">{email}</div>
        </div>
        <button
          onClick={logout}
          title="Sign out"
          className="text-[13px] text-muted hover:text-ink transition-colors flex-shrink-0"
        >
          ↩
        </button>
      </div>
    </aside>
  );
}
