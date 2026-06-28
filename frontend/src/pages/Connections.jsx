import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Zap, FileText, Hash, Cloud, ExternalLink, Check,
  AlertCircle, RefreshCw, Unlink, ChevronRight, X,
} from 'lucide-react';
import api from '../lib/axios';

const SOURCES = [
  {
    id: 'notion',
    label: 'Notion',
    Icon: FileText,
    color: '#e2e4f0',
    description: 'Pages and databases the integration has access to.',
    callbackPath: 'notion',
    needsFolderId: false,
  },
  {
    id: 'slack',
    label: 'Slack',
    Icon: Hash,
    color: '#36C5F0',
    description: 'Channel messages and conversations the bot is a member of.',
    callbackPath: 'slack',
    needsFolderId: false,
  },
  {
    id: 'google_drive',
    label: 'Google Drive',
    Icon: Cloud,
    color: '#4285F4',
    description: 'Google Docs inside a designated folder.',
    callbackPath: 'google-drive',
    needsFolderId: true,
  },
];

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function Toast({ toast, onDismiss }) {
  const isError = toast.type === 'error';
  return (
    <div
      className={`flex items-start gap-2.5 px-4 py-3 rounded-lg border text-sm shadow-lg transition-all ${
        isError
          ? 'bg-red-900/80 border-red-700/50 text-red-100'
          : 'bg-green-900/80 border-green-700/50 text-green-100'
      }`}
    >
      {isError ? <AlertCircle size={14} className="flex-shrink-0 mt-0.5" /> : <Check size={14} className="flex-shrink-0 mt-0.5" />}
      <span className="flex-1">{toast.message}</span>
      <button onClick={() => onDismiss(toast.id)} className="opacity-60 hover:opacity-100 transition-opacity flex-shrink-0">
        <X size={12} />
      </button>
    </div>
  );
}

export default function Connections() {
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionState, setActionState] = useState({});
  const [toasts, setToasts] = useState([]);
  const [folderIdInput, setFolderIdInput] = useState('');

  const addToast = (message, type = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
  };

  const dismissToast = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    for (const src of SOURCES) {
      const status = params.get(src.id);
      if (status === 'success') addToast(`${src.label} connected successfully!`, 'success');
      if (status === 'error') addToast(`Could not connect ${src.label}. Please try again.`, 'error');
    }
    window.history.replaceState({}, '', '/connections');
    fetchConnections();
  }, []);

  const fetchConnections = async () => {
    try {
      const { data } = await api.get('/api/connections');
      setConnections(data);
    } catch (err) {
      if (err.response?.status !== 401) {
        addToast('Failed to load connection status.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const connect = (src) => {
    const token = localStorage.getItem('access_token');
    const folderParam =
      src.needsFolderId && folderIdInput.trim()
        ? `&folder_id=${encodeURIComponent(folderIdInput.trim())}`
        : '';
    window.location.href =
      `${import.meta.env.VITE_API_URL}/api/connections/${src.callbackPath}/start` +
      `?token=${token}${folderParam}`;
  };

  const disconnect = async (src) => {
    setActionState((p) => ({ ...p, [src.id]: 'disconnecting' }));
    try {
      await api.delete(`/api/connections/${src.id}`);
      addToast(`${src.label} disconnected.`, 'success');
      fetchConnections();
    } catch {
      addToast(`Failed to disconnect ${src.label}.`, 'error');
    } finally {
      setActionState((p) => ({ ...p, [src.id]: 'idle' }));
    }
  };

  const sync = async (src) => {
    setActionState((p) => ({ ...p, [src.id]: 'syncing' }));
    const endpoint = src.id === 'google_drive' ? 'google-drive' : src.id;
    try {
      await api.post(`/api/ingest/${endpoint}`);
      addToast(`${src.label} sync started.`, 'success');
    } catch (err) {
      const msg = err.response?.data?.detail ?? `Failed to sync ${src.label}.`;
      addToast(msg, 'error');
    } finally {
      setActionState((p) => ({ ...p, [src.id]: 'idle' }));
    }
  };

  const connectionMap = Object.fromEntries(connections.map((c) => [c.source, c]));

  return (
    <div className="min-h-screen bg-ink text-[#e8eaf0] font-sans">
      {/* Toast stack */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-80 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <Toast toast={t} onDismiss={dismissToast} />
          </div>
        ))}
      </div>

      {/* Header */}
      <header className="border-b border-rim px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Link to="/chat" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-7 h-7 rounded-md bg-accent flex items-center justify-center">
              <Zap size={14} className="text-white" />
            </div>
            <span className="font-semibold tracking-tight text-sm">NexusAI</span>
          </Link>
          <ChevronRight size={13} className="text-zinc-600" />
          <span className="text-sm text-zinc-400">Connections</span>
        </div>
        <Link
          to="/chat"
          className="text-sm text-zinc-500 hover:text-[#e8eaf0] transition-colors"
        >
          ← Back to chat
        </Link>
      </header>

      {/* Main */}
      <main className="max-w-2xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-lg font-semibold mb-1.5">Data Connections</h1>
          <p className="text-sm text-zinc-500 leading-relaxed">
            Connect your company's knowledge sources. Tokens are encrypted at rest and scoped
            to your workspace.
          </p>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[88px] bg-panel border border-rim rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {SOURCES.map((src) => {
              const conn = connectionMap[src.id];
              const isConnected = conn?.connected ?? false;
              const state = actionState[src.id] ?? 'idle';
              const busy = state !== 'idle';
              const { Icon } = src;

              const metaLine = [
                conn?.metadata?.workspace_name,
                conn?.metadata?.team_name,
                conn?.metadata?.folder_id
                  ? `Folder: ${conn.metadata.folder_id.slice(0, 16)}…`
                  : null,
              ]
                .filter(Boolean)
                .join(' · ');

              return (
                <div
                  key={src.id}
                  className="bg-panel border border-rim rounded-xl p-5 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ backgroundColor: `${src.color}18` }}
                    >
                      <Icon size={17} style={{ color: src.color }} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium">{src.label}</span>
                        {isConnected && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/25">
                            <Check size={8} strokeWidth={3} />
                            Connected
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500">{src.description}</p>
                      {isConnected && (
                        <p className="text-[11px] text-zinc-600 mt-1">
                          Since {formatDate(conn.connected_at)}
                          {metaLine && ` · ${metaLine}`}
                        </p>
                      )}

                      {/* Folder ID — only for Google Drive when not yet connected */}
                      {src.needsFolderId && !isConnected && (
                        <div className="mt-2.5 space-y-1">
                          <input
                            value={folderIdInput}
                            onChange={(e) => setFolderIdInput(e.target.value)}
                            placeholder="Folder ID (optional — leave empty for full Drive access)"
                            className="w-full bg-ink border border-rim rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-accent transition-colors"
                          />
                          <p className="text-[10px] text-zinc-600">
                            Find it in the folder URL: drive.google.com/drive/folders/<span className="text-zinc-500">{'<this part>'}</span>
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
                      {isConnected ? (
                        <>
                          <button
                            onClick={() => sync(src)}
                            disabled={busy}
                            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-rim text-zinc-400 hover:text-[#e8eaf0] hover:border-zinc-600 disabled:opacity-40 transition-all"
                          >
                            <RefreshCw
                              size={11}
                              className={state === 'syncing' ? 'animate-spin' : ''}
                            />
                            {state === 'syncing' ? 'Syncing…' : 'Sync'}
                          </button>
                          <button
                            onClick={() => disconnect(src)}
                            disabled={busy}
                            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 disabled:opacity-40 transition-all"
                          >
                            <Unlink size={11} />
                            {state === 'disconnecting' ? 'Removing…' : 'Disconnect'}
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => connect(src)}
                          className="flex items-center gap-1.5 text-xs font-medium px-3.5 py-1.5 rounded-lg bg-accent hover:bg-[#4a5ae8] text-white transition-colors"
                        >
                          <ExternalLink size={11} />
                          Connect
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Setup reminder — only shown while at least one source is not connected */}
        {!loading && connections.some((c) => !c.connected) && (
          <div className="mt-8 p-4 bg-amber-500/10 border border-amber-500/25 rounded-xl">
            <div className="flex gap-3">
              <AlertCircle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-xs font-medium text-amber-300">Register callback URLs first</p>
                <p className="text-xs text-amber-400/75 leading-relaxed">
                  Each provider requires a redirect URI registered in its developer console:
                </p>
                <ul className="text-[11px] text-amber-400/60 space-y-0.5 mt-1 font-mono">
                  <li>{import.meta.env.VITE_API_URL}/api/connections/notion/callback</li>
                  <li>{import.meta.env.VITE_API_URL}/api/connections/slack/callback</li>
                  <li>{import.meta.env.VITE_API_URL}/api/connections/google-drive/callback</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
