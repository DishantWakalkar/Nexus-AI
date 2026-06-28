import { useState, useRef, useCallback, useMemo } from 'react';
import { Sparkles, Copy, Check, RefreshCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import SourceCard from './SourceCard';

// Replaces [SOURCE N] with a uniquely-classnamed span so rehype-raw can pass it
// through and our custom span component can intercept it.
function embedCitations(text) {
  return (text ?? '').replace(/\[SOURCE (\d+)\]/g, '<span class="__cite__$1"></span>');
}

function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function MessageBubble({ message, onRetry }) {
  const [copied, setCopied] = useState(false);
  const sourceRefs = useRef({});

  const scrollToSource = useCallback((num) => {
    const el = sourceRefs.current[num];
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    el.style.outline = '1px solid #5b6cff';
    el.style.outlineOffset = '2px';
    setTimeout(() => {
      el.style.outline = '';
      el.style.outlineOffset = '';
    }, 1500);
  }, []);

  const copy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Memoized component map — only rebuilds if scrollToSource identity changes (never)
  const mdComponents = useMemo(
    () => ({
      // Citation badge injected via rehype-raw
      span({ className, children, ...props }) {
        const cls = typeof className === 'string' ? className : '';
        if (cls.startsWith('__cite__')) {
          const num = parseInt(cls.replace('__cite__', ''), 10);
          if (!isNaN(num)) {
            return (
              <button
                onClick={() => scrollToSource(num)}
                title={`Jump to source ${num}`}
                className="inline-flex items-center justify-center w-[18px] h-[18px] text-[10px] font-bold rounded-full bg-accent text-white mx-0.5 hover:bg-[#4a5ae8] transition-colors cursor-pointer flex-shrink-0"
                style={{ verticalAlign: 'super', lineHeight: 1 }}
              >
                {num}
              </button>
            );
          }
        }
        return <span className={className} {...props}>{children}</span>;
      },
      p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
      ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-0.5 pl-1">{children}</ul>,
      ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-0.5 pl-1">{children}</ol>,
      li: ({ children }) => <li className="leading-relaxed">{children}</li>,
      code({ inline, children, ...rest }) {
        if (inline) {
          return (
            <code
              className="bg-rim px-1.5 py-0.5 rounded text-[12px] font-mono text-[#c9d1e0]"
              {...rest}
            >
              {children}
            </code>
          );
        }
        return (
          <pre className="bg-rim rounded-lg p-3 my-2 overflow-x-auto">
            <code className="text-xs font-mono text-zinc-300 leading-5">{children}</code>
          </pre>
        );
      },
      strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
      em: ({ children }) => <em className="italic text-zinc-300">{children}</em>,
      h1: ({ children }) => <h1 className="text-base font-semibold mb-2 mt-3 first:mt-0 text-white">{children}</h1>,
      h2: ({ children }) => <h2 className="text-sm font-semibold mb-1.5 mt-3 first:mt-0 text-white">{children}</h2>,
      h3: ({ children }) => <h3 className="text-sm font-medium mb-1 mt-2 first:mt-0 text-zinc-200">{children}</h3>,
      a: ({ href, children }) => (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent underline underline-offset-2 hover:text-[#7b8bff] transition-colors"
        >
          {children}
        </a>
      ),
      blockquote: ({ children }) => (
        <blockquote className="border-l-2 border-accent/30 pl-3 my-2 text-zinc-400 italic">
          {children}
        </blockquote>
      ),
      hr: () => <hr className="border-rim my-3" />,
      table: ({ children }) => (
        <div className="overflow-x-auto my-2 rounded-lg border border-rim">
          <table className="text-xs border-collapse w-full">{children}</table>
        </div>
      ),
      thead: ({ children }) => <thead className="bg-lift">{children}</thead>,
      th: ({ children }) => (
        <th className="border-b border-rim px-3 py-1.5 text-left font-medium text-zinc-300">
          {children}
        </th>
      ),
      td: ({ children }) => (
        <td className="border-b border-rim px-3 py-1.5 text-zinc-400 last:border-b-0">
          {children}
        </td>
      ),
    }),
    [scrollToSource]
  );

  // ── USER bubble ──────────────────────────────────────────────────────────────
  if (message.role === 'user') {
    return (
      <div className="flex justify-end group">
        <div className="flex flex-col items-end gap-1 max-w-[72%]">
          <div className="bg-accent/15 border border-accent/25 rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm text-[#e8eaf0] leading-relaxed">
            {message.content}
          </div>
          {message.timestamp && (
            <span className="text-[11px] text-zinc-700 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {formatTime(message.timestamp)}
            </span>
          )}
        </div>
      </div>
    );
  }

  // ── AI bubble ────────────────────────────────────────────────────────────────
  const bubbleClass = message.isError
    ? 'bg-red-500/10 border-red-500/20'
    : message.needs_clarification
    ? 'bg-amber-500/10 border-amber-500/20'
    : 'bg-panel border-rim';

  return (
    <div className="flex items-start gap-3 group">
      {/* Avatar */}
      <div className="w-7 h-7 rounded-full bg-accent/15 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Sparkles size={13} className="text-accent" />
      </div>

      <div className="flex-1 min-w-0 space-y-2">
        {/* Bubble */}
        <div className={`relative border rounded-2xl rounded-tl-sm px-4 py-3.5 text-sm text-[#e8eaf0] ${bubbleClass}`}>
          {/* Clarification label */}
          {message.needs_clarification && (
            <div className="flex items-center gap-1.5 text-amber-400 text-xs font-medium mb-2.5">
              <span>⚡</span>
              <span>Needs clarification</span>
            </div>
          )}

          {/* Hover actions — copy */}
          {!message.isError && (
            <div className="absolute top-2.5 right-3 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={copy}
                title={copied ? 'Copied!' : 'Copy response'}
                className="p-1.5 rounded-md text-zinc-600 hover:text-zinc-300 hover:bg-rim transition-colors"
              >
                {copied
                  ? <Check size={12} className="text-green-400" />
                  : <Copy size={12} />}
              </button>
            </div>
          )}

          {/* Markdown content */}
          <div className={!message.isError ? 'pr-8' : ''}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
              components={mdComponents}
            >
              {embedCitations(message.content)}
            </ReactMarkdown>
          </div>

          {/* Retry on error */}
          {message.isError && onRetry && (
            <button
              onClick={onRetry}
              className="mt-2.5 flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <RefreshCw size={11} />
              Try again
            </button>
          )}
        </div>

        {/* Source cards */}
        {message.sources?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pl-1">
            {message.sources.map((source) => (
              <SourceCard
                key={source.source_number}
                source={source}
                ref={(el) => {
                  if (el) sourceRefs.current[source.source_number] = el;
                }}
              />
            ))}
          </div>
        )}

        {/* Meta row — timestamp + chunks, revealed on hover */}
        {(message.timestamp || message.chunks_used > 0) && (
          <div className="flex items-center gap-3 pl-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {message.timestamp && (
              <span className="text-[11px] text-zinc-700">{formatTime(message.timestamp)}</span>
            )}
            {message.chunks_used > 0 && (
              <span className="text-[11px] text-zinc-700">
                {message.chunks_used} chunk{message.chunks_used !== 1 ? 's' : ''} searched
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
