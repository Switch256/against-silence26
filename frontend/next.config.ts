import type { NextConfig } from "next";

// The browser talks to the backend through a same-origin proxy (/backend/* -> API),
// so CORS never gets in the way. Change the target with NEXT_PUBLIC_API_URL.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8001";
const staticExport = process.env.GITHUB_ACTIONS === "true";
const basePath = staticExport ? "/against-silence26/demo" : "";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  // public/ assets (Earth textures) are loaded by URL, so the client needs the base path too
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  ...(staticExport ? { output: "export" as const, basePath: "/against-silence26/demo", assetPrefix: "/against-silence26/demo/" } : {}),
  async rewrites() {
    return [{ source: "/backend/:path*", destination: `${API_URL}/:path*` }];
  },
};

export default nextConfig;
