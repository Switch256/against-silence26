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

/** AEGIS-MEDLINK mark: a shield ring crossed by a pulse line. */
export const Logo = ({ className }: P) => (
  <svg viewBox="0 0 40 40" className={className} fill="none">
    <defs>
      <linearGradient id="lg" x1="0" y1="0" x2="40" y2="40">
        <stop offset="0" stopColor="#38e1ff" />
        <stop offset="1" stopColor="#2fe39a" />
      </linearGradient>
    </defs>
    <path d="M20 3 34 8v11c0 9-6 15.5-14 18C12 34.5 6 28 6 19V8l14-5Z" stroke="url(#lg)" strokeWidth="1.8" />
    <path d="M9 21h6l2.5-6 4 12 3-8 1.5 2H31" stroke="url(#lg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
