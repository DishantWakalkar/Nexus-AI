import { useRef, useEffect } from 'react';

export default function ChatInput({ onSend, disabled }) {
  const textareaRef = useRef(null);

  useEffect(() => {
    if (!disabled) textareaRef.current?.focus();
  }, [disabled]);

  const resize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  };

  const submit = () => {
    const text = textareaRef.current?.value.trim();
    if (!text || disabled) return;
    onSend(text);
    textareaRef.current.value = '';
    textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
  };

  return (
    <div className="flex items-end gap-3 bg-surface border border-border-input rounded-[8px] px-[14px] py-[13px] focus-within:border-ink transition-colors">
      <textarea
        ref={textareaRef}
        rows={1}
        disabled={disabled}
        onInput={resize}
        onKeyDown={handleKeyDown}
        placeholder="Ask a question about your company knowledge…"
        className="flex-1 bg-transparent text-[15px] text-ink placeholder-muted resize-none focus:outline-none leading-[1.5] disabled:opacity-50"
        style={{ minHeight: '22px', maxHeight: '160px' }}
      />
      <button
        onClick={submit}
        disabled={disabled}
        title="Send (Enter)"
        className="w-[34px] h-[34px] rounded-[6px] bg-forest hover:bg-forest-dark disabled:opacity-40 disabled:cursor-not-allowed text-[#F2FBF6] text-[16px] flex items-center justify-center flex-shrink-0 transition-colors"
        style={{ boxShadow: '0 0 18px -4px rgba(28,140,91,.7)' }}
      >
        ↑
      </button>
    </div>
  );
}
