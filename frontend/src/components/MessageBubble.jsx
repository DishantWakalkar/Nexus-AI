import { useState, useRef, useCallback, useMemo } from 'react';
import { Copy, Check, RefreshCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import SourceCard from './SourceCard';

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
    el.style.outline = '2px solid #1C8C5B';
    setTimeout(() => { el.style.outline = ''; }, 1500);
  }, []);

  const copy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const mdComponents = useMemo(() => ({
    span({ className, children, ...props }) {
      const cls = typeof className === 'string' ? className : '';
      if (cls.startsWith('__cite__')) {
        const num = parseInt(cls.replace('__cite__', ''), 10);
        if (!isNaN(num)) {
          return (
            <sup
              onClick={() => scrollToSource(num)}
              title={`Source ${num}`}
              className="font-mono text-[10px] font-semibold text-forest px-px cursor-pointer hover:underline"
            >
              {num}
            </sup>
          );
        }
      }
      return <span className={className} {...props}>{children}</span>;
    },
    p: ({ children }) => <p className="mb-3 last:mb-0 leading-[1.68] text-[#2E3A34]">{children}</p>,
    ul: ({ children }) => <ul className="list-disc list-inside mb-3 space-y-1 pl-1 text-[#2E3A34]">{children}</ul>,
    ol: ({ children }) => <ol className="list-decimal list-inside mb-3 space-y-1 pl-1 text-[#2E3A34]">{children}</ol>,
    li: ({ children }) => <li className="leading-relaxed">{children}</li>,
    code({ inline, children, ...rest }) {
      if (inline) return <code className="bg-step border border-border px-1.5 py-0.5 rounded text-[12px] font-mono text-ink" {...rest}>{children}</code>;
      return (
        <pre className="bg-step border border-border rounded p-3 my-2 overflow-x-auto">
          <code className="text-xs font-mono text-ink leading-5">{children}</code>
        </pre>
      );
    },
    strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
    h2: ({ children }) => <h2 className="font-serif text-[18px] font-normal text-ink mb-2 mt-4 first:mt-0">{children}</h2>,
    h3: ({ children }) => <h3 className="text-sm font-semibold text-ink mb-1 mt-3 first:mt-0">{children}</h3>,
    a: ({ href, children }) => (
      <a href={href} target="_blank" rel="noopener noreferrer"
        className="text-forest underline underline-offset-2 hover:text-forest-dark transition-colors">
        {children}
      </a>
    ),
    blockquote: ({ children }) => (
      <blockquote className="border-l-2 border-forest/30 pl-3 my-2 text-sage italic">{children}</blockquote>
    ),
    hr: () => <hr className="border-border my-3" />,
  }), [scrollToSource]);

  // USER message
  if (message.role === 'user') {
    return (
      <div className="group">
        <div className="font-mono text-[10px] tracking-[.2em] text-forest mb-[11px] uppercase">Question</div>
        <div className="font-serif text-[27px] leading-[1.2] tracking-[-0.01em] text-ink">
          {message.content}
        </div>
        {message.timestamp && (
          <span className="text-[11px] text-muted mt-2 block opacity-0 group-hover:opacity-100 transition-opacity">
            {formatTime(message.timestamp)}
          </span>
        )}
      </div>
    );
  }

  // AI message
  const isError = message.isError;
  const isClarify = message.needs_clarification;

  return (
    <div className="group mt-4">
      {isClarify && (
        <div className="font-mono text-[10px] tracking-[.16em] text-amber-600 mb-3 uppercase">Needs clarification</div>
      )}

      <div className={`relative ${isError ? 'border-l-2 border-red-400 pl-4' : ''}`}>
        {/* Copy button */}
        {!isError && (
          <button
            onClick={copy}
            title={copied ? 'Copied!' : 'Copy'}
            className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded text-muted hover:text-ink hover:bg-step"
          >
            {copied ? <Check size={12} className="text-forest" /> : <Copy size={12} />}
          </button>
        )}

        {/* Lead sentence in Newsreader */}
        <div className="font-serif text-[20px] leading-[1.45] text-ink mb-4 pr-8">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw]}
            components={{
              ...mdComponents,
              p: ({ children }) => <>{children}</>,
            }}
          >
            {embedCitations(message.content.split('\n')[0])}
          </ReactMarkdown>
        </div>

        {/* Rest of content */}
        {message.content.split('\n').slice(1).join('\n').trim() && (
          <div className="text-[15px] pr-8">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
              components={mdComponents}
            >
              {embedCitations(message.content.split('\n').slice(1).join('\n').trim())}
            </ReactMarkdown>
          </div>
        )}

        {/* Retry */}
        {isError && onRetry && (
          <button onClick={onRetry}
            className="mt-3 flex items-center gap-1.5 text-xs text-muted hover:text-ink transition-colors">
            <RefreshCw size={11} /> Try again
          </button>
        )}
      </div>

      {/* Sources */}
      {message.sources?.length > 0 && (
        <div className="mt-5 border-t border-border pt-3">
          <div className="flex justify-between items-baseline mb-2">
            <span className="font-mono text-[10px] tracking-[.2em] text-dim uppercase">Sources</span>
            {message.chunks_used > 0 && (
              <span className="font-mono text-[10px] tracking-[.08em] text-muted uppercase">
                {message.chunks_used} passages read
              </span>
            )}
          </div>
          {message.sources.map((source) => (
            <SourceCard
              key={source.source_number}
              source={source}
              ref={(el) => { if (el) sourceRefs.current[source.source_number] = el; }}
            />
          ))}
        </div>
      )}

      {message.timestamp && (
        <div className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="text-[11px] text-muted">{formatTime(message.timestamp)}</span>
        </div>
      )}
    </div>
  );
}
