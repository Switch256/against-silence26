// Minimal line icons (no external icon set).
type P = { className?: string };
const base = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export const HeartIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}>
    <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" fill="currentColor" stroke="none" />
  </svg>
);
export const CheckIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base} strokeWidth={2.4}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
);
export const SendIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><path d="M4 12 20 4l-6 16-3-7-7-1Z" /></svg>
);
export const SignalIcon = ({ className, level = 3 }: P & { level?: number }) => (
  <svg viewBox="0 0 24 24" className={className} {...base}>
    {[0, 1, 2, 3].map((i) => (
      <rect key={i} x={3 + i * 5} y={17 - i * 4} width="3" height={4 + i * 4} rx="1" fill={i < level ? "currentColor" : "none"} opacity={i < level ? 1 : 0.35} />
    ))}
  </svg>
);
export const ActivityIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><path d="M3 12h4l3-7 4 14 3-7h4" /></svg>
);
export const SatIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}>
    <path d="m13 7 4 4M9.5 10.5l4 4M6 14l4 4" />
    <rect x="9" y="7" width="6" height="10" rx="1" transform="rotate(45 12 12)" />
    <path d="M17 3a4 4 0 0 1 4 4M16 6a1.5 1.5 0 0 1 2 2" />
  </svg>
);
export const LinkIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg>
);
export const CutIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><path d="M4 12h5M15 12h5M10 8l4 8" /></svg>
);
export const WindowIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><path d="M4 12h3l2-5 3 10 2-5h6" /></svg>
);
export const ResetIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4" /></svg>
);

/** AEGIS-MEDLINK mark: a shield crossed by a pulse line (monochrome). */
export const Logo = ({ className }: P) => (
  <svg viewBox="0 0 40 40" className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 4 33 8.5v10c0 8.4-5.6 14.4-13 17-7.4-2.6-13-8.6-13-17v-10L20 4Z" strokeWidth="2" />
    <path d="M11 21h5l2.4-5.5 3.6 11 2.8-7.5 1.4 2H30" strokeWidth="2" />
  </svg>
);

/** Caution / warning triangle (shape redundancy so status never relies on colour alone). */
export const AlertTriangle = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}>
    <path d="M12 3.5 2.5 20h19L12 3.5Z" />
    <path d="M12 10v4.5M12 17.2v.3" strokeWidth={2} />
  </svg>
);
export const ChevronIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><path d="m6 9 6 6 6-6" /></svg>
);
export const ExternalIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>
);
export const SunIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" />
  </svg>
);
export const BellIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><path d="M6 10a6 6 0 1 1 12 0c0 4.5 1.5 6 2 7H4c.5-1 2-2.5 2-7ZM10 20a2 2 0 0 0 4 0" /></svg>
);
export const CloseIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><path d="M6 6l12 12M18 6 6 18" /></svg>
);
export const UserIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" /></svg>
);
export const DownloadIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>
);
