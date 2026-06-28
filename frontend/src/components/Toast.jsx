import { X, CheckCircle, AlertCircle } from 'lucide-react';

export default function Toast({ toast, onDismiss }) {
  const isSuccess = toast.type === 'success';

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-sm shadow-xl max-w-xs animate-in ${
        isSuccess
          ? 'bg-panel border-green-500/30'
          : 'bg-panel border-red-500/30'
      }`}
    >
      {isSuccess
        ? <CheckCircle size={15} className="text-green-400 flex-shrink-0" />
        : <AlertCircle size={15} className="text-red-400 flex-shrink-0" />}
      <span className="flex-1 text-[#e8eaf0]">{toast.message}</span>
      <button
        onClick={onDismiss}
        className="text-zinc-500 hover:text-[#e8eaf0] transition-colors flex-shrink-0"
      >
        <X size={13} />
      </button>
    </div>
  );
}
