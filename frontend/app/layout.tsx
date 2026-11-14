import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono-face", display: "swap" });

export const metadata: Metadata = {
  title: "AEGIS-MEDLINK · Care Beyond Connectivity",
  description:
    "Onboard astronaut health monitoring (AEGIS) and a delay-tolerant BPv7 medical link to Earth (MEDLINK). Team Against the Silence, NASA Space Apps 2026.",
};

export const viewport: Viewport = { themeColor: "#010309", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
