import { forwardRef } from 'react';
import { FileText, Hash, Cloud, ExternalLink } from 'lucide-react';

const PLATFORM = {
  notion: {
    label: 'Notion',
    Icon: FileText,
    color: '#e2e4f0',
    bg: 'rgba(226,228,240,0.1)',
  },
  slack: {
    label: 'Slack',
    Icon: Hash,
    color: '#36C5F0',
    bg: 'rgba(54,197,240,0.1)',
  },
  google_drive: {
    label: 'Drive',
    Icon: Cloud,
    color: '#4285F4',
    bg: 'rgba(66,133,244,0.1)',
  },
};

const SourceCard = forwardRef(function SourceCard({ source }, ref) {
  const platform = PLATFORM[source.source] ?? PLATFORM.notion;
  const { Icon } = platform;

  return (
    <a
      ref={ref}
      href={source.url || '#'}
      target="_blank"
      rel="noopener noreferrer"
      title={source.title}
      className="flex items-center gap-2 rounded-lg border border-rim px-2.5 py-1.5 text-xs text-zinc-400 hover:border-accent/40 hover:text-[#e8eaf0] hover:bg-lift transition-all max-w-[220px] group bg-panel"
    >
      {/* Numbered badge */}
      <span className="flex-shrink-0 w-4 h-4 rounded-full bg-rim text-zinc-500 text-[9px] font-bold flex items-center justify-center leading-none">
        {source.source_number}
      </span>

      {/* Platform icon */}
      <div
        className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: platform.bg }}
      >
        <Icon size={10} style={{ color: platform.color }} />
      </div>

      <span className="truncate flex-1 min-w-0">{source.title || 'Untitled'}</span>

      <ExternalLink
        size={10}
        className="flex-shrink-0 opacity-0 group-hover:opacity-50 transition-opacity"
      />
    </a>
  );
});

export default SourceCard;
