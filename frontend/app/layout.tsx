import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Fonts are bundled in app/fonts (Inter + JetBrains Mono, SIL OFL), so builds need no network access.
const inter = localFont({ src: "./fonts/Inter-Variable.woff2", variable: "--font-inter", weight: "100 900", display: "swap" });
const mono = localFont({ src: "./fonts/JetBrainsMono-Variable.woff2", variable: "--font-mono-face", weight: "100 800", display: "swap" });

export const metadata: Metadata = {
  title: "AEGIS-MEDLINK · Crew medical console",
  description:
    "Onboard astronaut health monitoring (AEGIS) and a delay-tolerant BPv7 medical link to Earth (MEDLINK). Team Against the Silence, NASA Space Apps 2026.",
};

export const viewport: Viewport = { themeColor: "#0e1011", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
