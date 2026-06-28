import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/axios';

const SOURCES = [
  {
    id: 'notion',
    label: 'Notion',
    letter: 'N',
    num: '01',
    desc: 'Pages and databases the integration can access.',
    callbackPath: 'notion',
    needsFolderId: false,
  },
  {
    id: 'slack',
    label: 'Slack',
    letter: 'S',
    num: '02',
    desc: 'Messages from channels the bot has joined.',
    callbackPath: 'slack',
    needsFolderId: false,
  },
  {
    id: 'google_drive',
    label: 'Google Drive',
    letter: 'D',
    num: '03',
    desc: 'Google Docs inside a designated folder.',
    callbackPath: 'google-drive',
    needsFolderId: true,
  },
];

export default function Connections() {
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionState, setActionState] = useState({});
  const [toasts, setToasts] = useState([]);
  const [folderIdInput, setFolderIdInput] = useState('');

  const addToast = (message) => {
    const id = Date.now();
    setToasts((p) => [...p, { id, message }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 4000);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    for (const src of SOURCES) {
      const status = params.get(src.id);
      if (status === 'success') addToast(`${src.label} connected successfully`);
      if (status === 'error') addToast(`Could not connect ${src.label}. Please try again.`);
      if (status === 'cancelled') addToast(`${src.label} authorization was cancelled.`);
    }
    window.history.replaceState({}, '', '/connections');
    fetchConnections();
  }, []);

  const fetchConnections = async () => {
    try {
      const { data } = await api.get('/api/connections');
      setConnections(data);
    } catch (err) {
      if (err.response?.status !== 401) addToast('Failed to load connection status.');
    } finally {
      setLoading(false);
    }
  };

  const openFolderPicker = useCallback(async () => {
    setActionState((p) => ({ ...p, google_drive: 'picking' }));
    try {
      const { data } = await api.get('/api/connections/google-drive/picker-token');
      await new Promise((resolve, reject) => {
        if (window.google?.picker) return resolve();
        const load = () => window.gapi.load('picker', resolve);
        if (window.gapi) return load();
        const s = document.createElement('script');
        s.src = 'https://apis.google.com/js/api.js';
        s.onload = load; s.onerror = reject;
        document.head.appendChild(s);
      });
      const view = new window.google.picker.DocsView(window.google.picker.ViewId.FOLDERS)
        .setIncludeFolders(true).setSelectFolderEnabled(true)
        .setMimeTypes('application/vnd.google-apps.folder');
      const builder = new window.google.picker.PickerBuilder()
        .addView(view).setOAuthToken(data.access_token)
        .setCallback(async (result) => {
          if (result[window.google.picker.Response.ACTION] === window.google.picker.Action.PICKED) {
            const folder = result[window.google.picker.Response.DOCUMENTS][0];
            await api.patch('/api/connections/google-drive/folder', {
              folder_id: folder[window.google.picker.Document.ID],
              folder_name: folder[window.google.picker.Document.NAME],
            });
            addToast(`Folder set to "${folder[window.google.picker.Document.NAME]}"`);
            fetchConnections();
          }
          setActionState((p) => ({ ...p, google_drive: 'idle' }));
        });
      if (data.developer_key) builder.setDeveloperKey(data.developer_key);
      builder.build().setVisible(true);
    } catch {
      addToast('Could not open folder picker.');
      setActionState((p) => ({ ...p, google_drive: 'idle' }));
    }
  }, []);

  const connect = (src) => {
    const token = localStorage.getItem('access_token');
    const folderParam = src.needsFolderId && folderIdInput.trim()
      ? `&folder_id=${encodeURIComponent(folderIdInput.trim())}` : '';
    window.location.href =
      `${import.meta.env.VITE_API_URL}/api/connections/${src.callbackPath}/start?token=${token}${folderParam}`;
  };

  const disconnect = async (src) => {
    setActionState((p) => ({ ...p, [src.id]: 'disconnecting' }));
    try {
      await api.delete(`/api/connections/${src.id}`);
      addToast(`${src.label} disconnected.`);
      fetchConnections();
    } catch { addToast(`Failed to disconnect ${src.label}.`); }
    finally { setActionState((p) => ({ ...p, [src.id]: 'idle' })); }
  };

  const sync = async (src) => {
    setActionState((p) => ({ ...p, [src.id]: 'syncing' }));
    const endpoint = src.id === 'google_drive' ? 'google-drive' : src.id;
    try {
      await api.post(`/api/ingest/${endpoint}`);
      addToast(`${src.label} sync started.`);
    } catch (err) {
      addToast(err.response?.data?.detail ?? `Failed to sync ${src.label}.`);
    } finally { setActionState((p) => ({ ...p, [src.id]: 'idle' })); }
  };

  const connectionMap = Object.fromEntries(connections.map((c) => [c.source, c]));
  const btnBase = 'font-mono text-[11px] tracking-[.06em] px-[14px] py-[9px] rounded-[3px] cursor-pointer border transition-all';

  return (
    <div className="min-h-screen dot-grid bg-paper">
      {/* Toasts */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-2.5 z-50 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto flex items-center gap-3 bg-ink text-paper px-[17px] py-3 rounded-[5px] animate-rise min-w-[210px]"
            style={{ boxShadow: '0 18px 44px -18px rgba(24,36,32,.55)' }}>
            <span className="text-forest text-[9px]">●</span>
            <span className="text-[13px]">{t.message}</span>
          </div>
        ))}
      </div>

      {/* Header */}
      <header className="flex items-center justify-between px-11 py-5 border-b border-border">
        <div className="flex items-baseline gap-3">
          <Link to="/chat" className="font-serif font-medium text-[21px] text-ink hover:text-forest transition-colors">
            Nexus
          </Link>
          <span className="text-[#BCC9BF]">/</span>
          <span className="font-mono text-[11px] tracking-[.16em] text-sage uppercase">Connections</span>
        </div>
        <Link to="/chat" className="font-mono text-[11px] tracking-[.1em] text-sage hover:text-ink transition-colors uppercase">
          ← Back to Workspace
        </Link>
      </header>

      <div className="max-w-[860px] mx-auto px-11 py-16">
        <div className="font-mono text-[11px] tracking-[.22em] text-forest mb-[18px] uppercase">Data Sources</div>
        <h1 className="font-serif font-normal text-[46px] leading-[1.05] tracking-[-0.018em] text-ink mb-3.5">
          The sources Nexus<br />reads from.
        </h1>
        <p className="text-[15.5px] text-sage max-w-[520px] mb-[46px] leading-relaxed">
          Connect a workspace and Nexus indexes it continuously. Tokens are encrypted at rest and never leave your tenant.
        </p>

        <div className="border-t border-divider">
          {loading
            ? [0, 1, 2].map((i) => (
                <div key={i} className="h-[100px] border-b border-border animate-pulse bg-step/50" />
              ))
            : SOURCES.map((src) => {
                const conn = connectionMap[src.id];
                const isConnected = conn?.connected ?? false;
                const state = actionState[src.id] ?? 'idle';
                const busy = state !== 'idle';

                const metaText = isConnected
                  ? `Connected since ${new Date(conn.connected_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}${conn?.metadata?.workspace_name ? ' · ' + conn.metadata.workspace_name : ''}${conn?.metadata?.team_name ? ' · ' + conn.metadata.team_name : ''}`
                  : 'Authorize to begin indexing';

                return (
                  <div key={src.id} className="flex items-start gap-6 py-7 border-b border-border">
                    {/* Num */}
                    <span className="font-mono text-[13px] text-forest pt-2 w-6 flex-shrink-0">{src.num}</span>
                    {/* Letter box */}
                    <span className="w-11 h-11 rounded-[9px] bg-ink text-paper font-mono text-[15px] flex items-center justify-center flex-shrink-0 mt-0.5">
                      {src.letter}
                    </span>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1.5">
                        <span className="font-serif text-[22px] text-ink">{src.label}</span>
                        {isConnected && (
                          <span className="font-mono text-[9px] tracking-[.12em] px-[9px] py-[3px] rounded-[20px] border bg-forest/10 text-forest border-forest/30 uppercase">
                            Connected
                          </span>
                        )}
                        {!isConnected && (
                          <span className="font-mono text-[9px] tracking-[.12em] px-[9px] py-[3px] rounded-[20px] border bg-transparent text-dim border-divider uppercase">
                            Not connected
                          </span>
                        )}
                      </div>
                      <p className="text-[14px] text-sage mb-1.5 max-w-[430px]">{src.desc}</p>
                      <div className="font-mono text-[11px] text-dim">{metaText}</div>

                      {/* GDrive folder picker when connected */}
                      {src.id === 'google_drive' && isConnected && (
                        <button
                          onClick={openFolderPicker}
                          disabled={busy}
                          className={`mt-3 ${btnBase} bg-surface border-border-input text-sage hover:border-ink hover:text-ink disabled:opacity-40`}
                        >
                          {state === 'picking' ? 'Opening…' : conn?.metadata?.folder_name ? `📁 ${conn.metadata.folder_name}` : 'Choose folder'}
                        </button>
                      )}

                      {/* Folder ID input for Google Drive when not connected */}
                      {src.needsFolderId && !isConnected && (
                        <div className="mt-3 space-y-1 max-w-[380px]">
                          <input
                            value={folderIdInput}
                            onChange={(e) => setFolderIdInput(e.target.value)}
                            placeholder="Folder ID (optional - leave empty for full Drive)"
                            className="w-full bg-surface border border-border-input rounded-sm px-3 py-2 text-[12px] text-ink placeholder-muted focus:outline-none focus:border-ink transition-colors"
                          />
                          <p className="font-mono text-[10px] text-dim">
                            drive.google.com/drive/folders/<span className="text-muted">{'<this part>'}</span>
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2.5 flex-shrink-0 pt-1.5">
                      {isConnected ? (
                        <>
                          <button onClick={() => sync(src)} disabled={busy}
                            className={`${btnBase} bg-surface border-border-input text-sage hover:border-ink hover:text-ink disabled:opacity-40`}>
                            {state === 'syncing' ? 'SYNCING…' : 'SYNC'}
                          </button>
                          <button onClick={() => disconnect(src)} disabled={busy}
                            className={`${btnBase} bg-transparent border-forest/30 text-forest hover:border-forest hover:bg-forest/5 disabled:opacity-40`}>
                            {state === 'disconnecting' ? 'REMOVING…' : 'DISCONNECT'}
                          </button>
                        </>
                      ) : (
                        <button onClick={() => connect(src)} disabled={busy}
                          className={`${btnBase} bg-ink border-ink text-paper hover:bg-forest hover:border-forest`}>
                          CONNECT →
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
        </div>

        <div className="flex gap-3 mt-[34px] px-5 py-[18px] bg-step border border-border rounded-[6px]">
          <span className="text-forest text-sm leading-relaxed">◆</span>
          <p className="text-[13px] text-sage leading-[1.6] m-0">
            Each provider requires a redirect URI registered in its developer console. Nexus stores only OAuth
            tokens, encrypted with per-tenant keys - never your raw documents.
          </p>
        </div>
      </div>
    </div>
  );
}
