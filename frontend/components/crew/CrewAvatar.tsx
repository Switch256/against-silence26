"use client";
// Illustrated portrait for each (fictional) crew member: flat, calm, in flight suit.
// Drawn in SVG (no photos of real people). Optional flag badge in the corner.
import { flagOf } from "@/hooks/useCrew";

type Look = { skin: string; hair: string; style: "long" | "short" | "bob"; suit: string };
const LOOKS: Record<string, Look> = {
  "crew-01": { skin: "#d6a37c", hair: "#2a1c16", style: "long", suit: "#2f5ea8" },   // Aylin Kaya
  "crew-02": { skin: "#6a4330", hair: "#15100d", style: "short", suit: "#3b4652" },  // Daniel Okello
  "crew-03": { skin: "#efc4a2", hair: "#a8692f", style: "bob", suit: "#5a6b7d" },    // Emily Carter
};
const FALLBACK: Look = { skin: "#c99a78", hair: "#2b2b2b", style: "short", suit: "#3b4652" };

export function CrewAvatar({ id, size = 36, countryCode, ring }: { id: string; size?: number; countryCode?: string; ring?: string }) {
  const l = LOOKS[id] ?? FALLBACK;
  const clip = `av-${id}`;
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden className="rounded-full" style={ring ? { boxShadow: `0 0 0 2px ${ring}` } : undefined}>
        <defs><clipPath id={clip}><circle cx="20" cy="20" r="20" /></clipPath></defs>
        <g clipPath={`url(#${clip})`}>
          <rect width="40" height="40" fill="#1b2230" />
          {/* long hair falls behind the shoulders */}
          {l.style === "long" && <path d="M10.5 17c0-7 4-11 9.5-11s9.5 4 9.5 11v14H10.5Z" fill={l.hair} />}
          {/* suit + collar */}
          <path d="M4 40c1-7.5 7-11 16-11s15 3.5 16 11Z" fill={l.suit} />
          <path d="M16 29.4 20 34l4-4.6" fill="none" stroke="#e8eaeb" strokeOpacity="0.55" strokeWidth="1.1" />
          <circle cx="29" cy="34.5" r="1.6" fill="#e8eaeb" fillOpacity="0.5" />
          {/* neck + head */}
          <path d="M17 24h6v6.2c-1 1-5 1-6 0Z" fill={l.skin} />
          <path d="M17 26.2c1.8.9 4.2.9 6 0" stroke="#000" strokeOpacity="0.12" strokeWidth="1.2" fill="none" />
          <ellipse cx="20" cy="17.6" rx="6.6" ry="7.8" fill={l.skin} />
          {/* hair on top */}
          {l.style === "short" && <path d="M13.3 16.4c-.4-5.4 2.6-8.3 6.7-8.3s7.1 2.9 6.7 8.3c-.9-2.6-2.7-3.9-6.7-3.9s-5.8 1.3-6.7 3.9Z" fill={l.hair} />}
          {l.style === "long" && <path d="M13.2 17.5c-.5-6.3 2.6-9.7 6.8-9.7s7.3 3.4 6.8 9.7c-1.3-3.8-3.6-5.2-6.3-5.6-1.6 1.8-4.4 3.4-7.3 5.6Z" fill={l.hair} />}
          {l.style === "bob" && <path d="M12.6 21c-1.4-8.3 2.3-12.9 7.4-12.9s8.8 4.6 7.4 12.9l-1.3-.2c.3-3.7-.6-6.4-2.4-7.6-2.4 1.6-5.7 2.2-9 2.1-.6 1.6-.8 3.3-.8 5.5Z" fill={l.hair} />}
          {/* face */}
          <circle cx="17.5" cy="18.2" r="0.75" fill="#1a1412" />
          <circle cx="22.5" cy="18.2" r="0.75" fill="#1a1412" />
          <path d="M18.2 21.9c1.1.8 2.5.8 3.6 0" stroke="#5a2f24" strokeOpacity="0.7" strokeWidth="0.8" fill="none" strokeLinecap="round" />
        </g>
      </svg>
      {countryCode && (
        <span className="absolute -right-1 -bottom-1 text-[13px] leading-none drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]" aria-hidden>{flagOf(countryCode)}</span>
      )}
    </span>
  );
}
