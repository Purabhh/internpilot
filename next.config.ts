import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep dev and production build output apart. `next dev --turbo` (Claude's
  // preview on :3007) and `next build` (what launch.bat serves on :3000) used
  // to share `.next`; dev's manifests overwrote the production build's, which
  // left `next start` serving stale prerendered pages and 404ing a route that
  // existed on disk. Production keeps `.next` so launch.bat's BUILD_ID check
  // is unchanged.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  serverExternalPackages: [
    "better-sqlite3",
    "bindings",
    "node-gyp-build",
    "googleapis",
    "google-auth-library",
    "gaxios",
    "gtoken",
    "https-proxy-agent",
    "agent-base",
    "@anthropic-ai/sdk",
  ],
};

export default nextConfig;
