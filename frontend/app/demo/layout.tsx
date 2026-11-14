import type { Metadata } from "next";

const TITLE = "AEGIS-MEDLINK · Live mission console";
const DESCRIPTION =
  "The live AEGIS-MEDLINK console: a 3D habitat, simulated crew vitals checked by AEGIS, and medical events crossing a real BPv7 link to Earth.";

// Next replaces (does not merge) nested openGraph/twitter objects, so every field is repeated here.
export const metadata: Metadata = {
  title: "Live mission console",
  description: DESCRIPTION,
  alternates: { canonical: "/demo" },
  openGraph: { type: "website", url: "/demo", siteName: "AEGIS-MEDLINK", title: TITLE, description: DESCRIPTION, locale: "en_US" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
