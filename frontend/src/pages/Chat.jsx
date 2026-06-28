import { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import MessageBubble from '../components/MessageBubble';
import ChatInput from '../components/ChatInput';
import Toast from '../components/Toast';
import api from '../lib/axios';

const STORAGE_KEY = 'nexusai_messages';

const SOURCE_FILTERS = [
  { value: null, label: 'All sources' },
  { value: 'notion', label: 'Notion' },
  { value: 'slack', label: 'Slack' },
  { value: 'google_drive', label: 'Drive' },
];

const EXAMPLES = [
  { q: 'What is our vacation policy?', cat: 'HR' },
  { q: "Summarize last week's engineering standup", cat: 'Engineering' },
  { q: 'What are our Q3 OKRs?', cat: 'Strategy' },
  { q: 'How do I set up the dev environment?', cat: 'Engineering' },
  { q: 'What is our onboarding process for new hires?', cat: 'HR' },
  { q: 'What was discussed in the latest product review?', cat: 'Product' },
];

function loadMessages() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export default function Chat() {
  const [messages, setMessages] = useState(loadMessages);
  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [sourceFilter, setSourceFilter] = useState(null);
  const messagesEndRef = useRef(null);
  const email = localStorage.getItem('email') ?? '';

  // Persist messages
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch { /* storage full */ }
  }, [messages]);

  // Auto-scroll on new message or while loading
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts((p) => [...p, { id, message, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 4000);
  }, []);

  const newChat = () => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  // Core fetch — shared by send and retry
  const fetchAnswer = useCallback(async (query, appendUserMsg = true) => {
    if (appendUserMsg) {
      setMessages((p) => [
        ...p,
        { role: 'user', content: query, timestamp: new Date().toISOString() },
      ]);
    }
    setLoading(true);

    try {
      const { data } = await api.post('/api/ask', {
        query,
        source_filter: sourceFilter,
      });

      setMessages((p) => [
        ...p,
        {
          role: 'assistant',
          content: data.answer,
          sources: data.sources ?? [],
          needs_clarification: data.needs_clarification ?? false,
          chunks_used: data.chunks_used ?? 0,
          timestamp: new Date().toISOString(),
          retryQuery: query,
        },
      ]);
    } catch (err) {
      if (err.response?.status !== 401) {
        setMessages((p) => [
          ...p,
          {
            role: 'assistant',
            content: 'Something went wrong — the server may be unavailable. Please try again.',
            sources: [],
            needs_clarification: false,
            isError: true,
            retryQuery: query,
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    } finally {
      setLoading(false);
    }
  }, [sourceFilter]);

  const sendMessage = (text) => {
    if (!text.trim() || loading) return;
    fetchAnswer(text, true);
  };

  // Retry: remove the error message (user message stays), re-fetch without duplicating it
  const retryMessage = (retryQuery, errorIndex) => {
    setMessages((p) => p.filter((_, i) => i !== errorIndex));
    fetchAnswer(retryQuery, false);
  };

  return (
    <div className="flex h-screen bg-ink overflow-hidden">
      <Sidebar email={email} addToast={addToast} onNewChat={newChat} />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Scrollable messages */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <EmptyState onSelect={sendMessage} />
          ) : (
            <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
              {messages.map((msg, i) => (
                <MessageBubble
                  key={i}
                  message={msg}
                  onRetry={
                    msg.isError
                      ? () => retryMessage(msg.retryQuery, i)
                      : undefined
                  }
                />
              ))}
              {loading && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="border-t border-rim flex-shrink-0">
          <div className="max-w-3xl mx-auto px-6 pt-3 pb-5">
            {/* Source filter */}
            <div className="flex items-center gap-1.5 mb-2.5">
              <span className="text-[11px] text-zinc-600 mr-0.5">Search in</span>
              {SOURCE_FILTERS.map((f) => (
                <button
                  key={String(f.value)}
                  onClick={() => setSourceFilter(f.value)}
                  className={`text-[11px] px-2.5 py-0.5 rounded-full border transition-all ${
                    sourceFilter === f.value
                      ? 'border-accent bg-accent/15 text-accent'
                      : 'border-rim text-zinc-500 hover:text-zinc-300 hover:border-zinc-600'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <ChatInput onSend={sendMessage} disabled={loading} />

            <p className="text-[11px] text-zinc-700 text-center mt-2.5">
              NexusAI may make mistakes. Always verify critical information.
            </p>
          </div>
        </div>
      </main>

      {/* Toast stack */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-50 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <Toast
              toast={t}
              onDismiss={() => setToasts((p) => p.filter((x) => x.id !== t.id))}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ onSelect }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-12">
      <div className="text-center mb-10">
        <div className="w-12 h-12 rounded-2xl bg-accent/15 flex items-center justify-center mb-4 mx-auto">
          <Sparkles size={22} className="text-accent" />
        </div>
        <h2 className="text-[#e8eaf0] text-xl font-semibold mb-1.5">Ask NexusAI anything</h2>
        <p className="text-zinc-500 text-sm max-w-xs mx-auto leading-relaxed">
          Instant answers from your Notion, Slack, and Google Drive — every response is cited.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 max-w-lg w-full">
        {EXAMPLES.map(({ q, cat }) => (
          <button
            key={q}
            onClick={() => onSelect(q)}
            className="group text-left bg-panel border border-rim rounded-xl p-3.5 hover:border-accent/40 transition-all"
          >
            <span className="block text-[10px] font-semibold text-accent/60 mb-1 uppercase tracking-wider">
              {cat}
            </span>
            <span className="text-sm text-zinc-400 group-hover:text-zinc-200 transition-colors leading-snug">
              {q}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-start gap-3">
      <div className="w-7 h-7 rounded-full bg-accent/15 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Sparkles size={13} className="text-accent" />
      </div>
      <div className="bg-panel border border-rim rounded-2xl rounded-tl-sm px-4 py-3.5 flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
