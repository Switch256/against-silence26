import type { NextConfig } from "next";

// The browser talks to the backend through a same-origin proxy (/backend/* -> API),
// so CORS never gets in the way. Change the target with NEXT_PUBLIC_API_URL.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8001";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  async rewrites() {
    return [{ source: "/backend/:path*", destination: `${API_URL}/:path*` }];
  },
};

export default nextConfig;
