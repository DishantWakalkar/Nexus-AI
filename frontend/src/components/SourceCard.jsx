import { forwardRef } from 'react';

const PLATFORM = {
  notion:       { label: 'Notion', letter: 'N' },
  slack:        { label: 'Slack',  letter: 'S' },
  google_drive: { label: 'Drive',  letter: 'D' },
};

const SourceCard = forwardRef(function SourceCard({ source }, ref) {
  const platform = PLATFORM[source.source] ?? PLATFORM.notion;

  return (
    <a
      ref={ref}
      href={source.url || '#'}
      target="_blank"
      rel="noopener noreferrer"
      title={source.title}
      className="flex items-center gap-3 py-2 border-b border-border last:border-b-0 hover:bg-step transition-colors group px-1"
    >
      <span className="font-mono text-[11px] text-forest w-4 flex-shrink-0">
        {source.source_number}
      </span>
      <span className="w-[22px] h-[22px] rounded-[5px] bg-ink text-paper font-mono text-[10px] flex items-center justify-center flex-shrink-0">
        {platform.letter}
      </span>
      <span className="flex-1 text-[13.5px] text-ink truncate min-w-0">
        {source.title || 'Untitled'}
      </span>
      <span className="font-mono text-[10px] text-dim flex-shrink-0">{platform.label}</span>
    </a>
  );
});

export default SourceCard;
