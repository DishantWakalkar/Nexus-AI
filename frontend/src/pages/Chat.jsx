import { useState, useRef, useEffect, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import MessageBubble from '../components/MessageBubble';
import ChatInput from '../components/ChatInput';
import Toast from '../components/Toast';
import api from '../lib/axios';

const STORAGE_KEY = 'nexusai_messages';

const SOURCE_FILTERS = [
  { value: null,           label: 'ALL' },
  { value: 'notion',       label: 'NOTION' },
  { value: 'slack',        label: 'SLACK' },
  { value: 'google_drive', label: 'DRIVE' },
];

const EXAMPLES = [
  { n: '01', q: 'What is our vacation policy?',                    cat: 'PEOPLE' },
  { n: '02', q: "Summarize last week's engineering standup",       cat: 'ENGINEERING' },
  { n: '03', q: 'What are our Q3 OKRs?',                          cat: 'STRATEGY' },
  { n: '04', q: 'How do I set up the dev environment?',           cat: 'ENGINEERING' },
  { n: '05', q: 'What does onboarding look like for new hires?',  cat: 'PEOPLE' },
  { n: '06', q: 'What was decided in the latest product review?', cat: 'PRODUCT' },
];

function loadMessages() {
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : []; }
  catch { return []; }
}

export default function Chat() {
  const [messages, setMessages] = useState(loadMessages);
  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [sourceFilter, setSourceFilter] = useState(null);
  const messagesEndRef = useRef(null);
  const email = localStorage.getItem('email') ?? '';

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages)); }
    catch { /* storage full */ }
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const addToast = useCallback((message) => {
    const id = Date.now();
    setToasts((p) => [...p, { id, message }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 4000);
  }, []);

  const newChat = () => { setMessages([]); localStorage.removeItem(STORAGE_KEY); };

  const fetchAnswer = useCallback(async (query, appendUserMsg = true) => {
    if (appendUserMsg) {
      setMessages((p) => [...p, { role: 'user', content: query, timestamp: new Date().toISOString() }]);
    }
    setLoading(true);
    try {
      const { data } = await api.post('/api/ask', { query, source_filter: sourceFilter });
      setMessages((p) => [...p, {
        role: 'assistant',
        content: data.answer,
        sources: data.sources ?? [],
        needs_clarification: data.needs_clarification ?? false,
        chunks_used: data.chunks_used ?? 0,
        timestamp: new Date().toISOString(),
        retryQuery: query,
      }]);
    } catch (err) {
      if (err.response?.status !== 401) {
        setMessages((p) => [...p, {
          role: 'assistant',
          content: 'Something went wrong - the server may be unavailable. Please try again.',
          sources: [],
          needs_clarification: false,
          isError: true,
          retryQuery: query,
          timestamp: new Date().toISOString(),
        }]);
      }
    } finally {
      setLoading(false);
    }
  }, [sourceFilter]);

  const sendMessage = (text) => { if (!text.trim() || loading) return; fetchAnswer(text, true); };

  const retryMessage = (retryQuery, errorIndex) => {
    setMessages((p) => p.filter((_, i) => i !== errorIndex));
    fetchAnswer(retryQuery, false);
  };

  return (
    <div className="flex h-screen bg-paper dot-grid overflow-hidden">
      <Sidebar email={email} addToast={addToast} onNewChat={newChat} />

      <main className="flex-1 flex flex-col min-w-0 bg-paper">
        {/* Scrollable thread */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <EmptyState onSelect={sendMessage} />
          ) : (
            <div className="max-w-[760px] mx-auto px-9 py-12">
              {messages.map((msg, i) => (
                <div key={i} className={i === 0 ? '' : msg.role === 'user' ? 'mt-11' : 'mt-4'}>
                  <MessageBubble
                    message={msg}
                    onRetry={msg.isError ? () => retryMessage(msg.retryQuery, i) : undefined}
                  />
                </div>
              ))}
              {loading && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="border-t border-border-soft bg-step flex-shrink-0">
          <div className="max-w-[760px] mx-auto px-9 py-3.5 pb-[22px]">
            {/* Source filters */}
            <div className="flex items-center gap-2 mb-[11px]">
              <span className="font-mono text-[10px] tracking-[.14em] text-dim mr-0.5">SEARCH IN</span>
              {SOURCE_FILTERS.map((f) => (
                <button
                  key={String(f.value)}
                  onClick={() => setSourceFilter(f.value)}
                  className={`font-mono text-[10px] tracking-[.08em] px-3 py-[5px] rounded-[20px] border transition-all ${
                    sourceFilter === f.value
                      ? 'border-forest bg-forest/10 text-forest'
                      : 'border-border-input bg-transparent text-sage hover:text-ink hover:border-ink'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <ChatInput onSend={sendMessage} disabled={loading} />
            <p className="text-center font-mono text-[11px] text-muted mt-[11px]">
              Nexus can make mistakes. Every answer links to its sources - verify what matters.
            </p>
          </div>
        </div>
      </main>

      {/* Toasts */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-2.5 z-50 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <Toast toast={t} onDismiss={() => setToasts((p) => p.filter((x) => x.id !== t.id))} />
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ onSelect }) {
  return (
    <div className="max-w-[720px] mx-auto px-9 py-[74px]">
      <div className="font-mono text-[11px] tracking-[.22em] text-forest mb-[18px] uppercase">Start here</div>
      <h2 className="font-serif font-normal text-[38px] leading-[1.1] tracking-[-0.012em] text-ink mb-3">
        Ask across everything<br />you've connected.
      </h2>
      <p className="text-[15px] text-sage max-w-[470px] mb-[42px]">
        Every answer arrives with numbered citations you can trace straight back to the original Notion page,
        Slack thread, or Drive doc.
      </p>

      <div className="font-mono text-[10px] tracking-[.2em] text-muted border-b border-border pb-[11px] uppercase">
        Try one of these
      </div>
      {EXAMPLES.map(({ n, q, cat }) => (
        <button
          key={q}
          onClick={() => onSelect(q)}
          className="w-full flex items-center gap-[18px] border-b border-border py-4 px-1.5 text-left hover:bg-step transition-colors group"
        >
          <span className="font-mono text-[12px] text-forest w-6 flex-shrink-0">{n}</span>
          <span className="flex-1 font-serif text-[19px] text-ink leading-[1.3] group-hover:text-forest-dark transition-colors">
            {q}
          </span>
          <span className="font-mono text-[10px] tracking-[.14em] text-dim uppercase">{cat}</span>
        </button>
      ))}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="mt-4 flex items-center gap-2.5">
      <span className="font-mono text-[10px] tracking-[.2em] text-dim uppercase">Reading sources</span>
      <span className="inline-flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-[5px] h-[5px] rounded-full bg-forest inline-block animate-blink"
            style={{ animationDelay: `${i * 0.18}s` }}
          />
        ))}
      </span>
    </div>
  );
}
