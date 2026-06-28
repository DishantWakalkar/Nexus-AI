import { useRef, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';

export default function ChatInput({ onSend, disabled }) {
  const textareaRef = useRef(null);

  // Re-focus input after each response comes back
  useEffect(() => {
    if (!disabled) textareaRef.current?.focus();
  }, [disabled]);

  const resize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 180) + 'px';
  };

  const submit = () => {
    const text = textareaRef.current?.value.trim();
    if (!text || disabled) return;
    onSend(text);
    textareaRef.current.value = '';
    // reset height
    textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="flex items-end gap-3 bg-panel border border-rim rounded-[14px] px-4 py-3 focus-within:border-accent/50 transition-colors">
      <textarea
        ref={textareaRef}
        rows={1}
        disabled={disabled}
        onInput={resize}
        onKeyDown={handleKeyDown}
        placeholder="Ask a question about your company knowledge…"
        className="flex-1 bg-transparent text-sm text-[#e8eaf0] placeholder-zinc-600 resize-none focus:outline-none leading-5 disabled:opacity-50"
        style={{ minHeight: '20px', maxHeight: '180px' }}
      />
      <button
        onClick={submit}
        disabled={disabled}
        title="Send (Enter)"
        className="w-[30px] h-[30px] rounded-[8px] disabled:opacity-40 disabled:cursor-not-allowed text-white transition-all flex-shrink-0 flex items-center justify-center hover:-translate-y-0.5"
        style={{background:'linear-gradient(135deg,#5b6cff,#4a5ae8)',boxShadow:'0 2px 8px rgba(91,108,255,.3)'}}
      >
        <ArrowUp size={14} />
      </button>
    </div>
  );
}
