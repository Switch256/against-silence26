import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Fonts are bundled in app/fonts (Inter + JetBrains Mono, SIL OFL), so builds need no network access.
const inter = localFont({ src: "./fonts/Inter-Variable.woff2", variable: "--font-inter", weight: "100 900", display: "swap" });
const mono = localFont({ src: "./fonts/JetBrainsMono-Variable.woff2", variable: "--font-mono-face", weight: "100 800", display: "swap" });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://againstsilence.earth";
const DESCRIPTION =
  "Astronaut health monitoring that keeps working when Earth goes silent, and gets every medical event home, headline first. Team Against the Silence, NASA Space Apps 2026.";

// The share image is app/opengraph-image.jpg (and twitter-image.jpg); Next adds its URL, size and alt text.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "AEGIS-MEDLINK · Care beyond connectivity", template: "%s · AEGIS-MEDLINK" },
  description: DESCRIPTION,
  applicationName: "AEGIS-MEDLINK",
  keywords: ["NASA Space Apps 2026", "astronaut health", "delay-tolerant networking", "BPv7", "AEGIS-MEDLINK", "Against the Silence"],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "AEGIS-MEDLINK",
    title: "AEGIS-MEDLINK · Care beyond connectivity",
    description: DESCRIPTION,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEGIS-MEDLINK · Care beyond connectivity",
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = { themeColor: "#0e1011", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
