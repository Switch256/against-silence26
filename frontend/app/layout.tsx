import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AEGIS-MEDLINK · Care Beyond Connectivity",
  description:
    "Onboard astronaut health monitoring (AEGIS) and a delay-tolerant BPv7 medical link to Earth (MEDLINK). Team Against the Silence, NASA Space Apps 2026.",
};

export const viewport: Viewport = { themeColor: "#010309", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans">{children}</body>
    </html>
  );
}
