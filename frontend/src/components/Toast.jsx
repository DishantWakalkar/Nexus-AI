export default function Toast({ toast, onDismiss }) {
  return (
    <div className="flex items-center gap-[11px] bg-ink text-paper px-[17px] py-3 rounded-[5px] animate-rise min-w-[210px]"
      style={{ boxShadow: '0 18px 44px -18px rgba(24,36,32,.55)' }}>
      <span className="text-forest text-[9px]">●</span>
      <span className="text-[13px] flex-1">{toast.message}</span>
      <button onClick={() => onDismiss(toast.id)} className="text-muted hover:text-paper transition-colors text-xs ml-2">✕</button>
    </div>
  );
}
