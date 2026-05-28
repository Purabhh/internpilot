import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
    "node-cron",
    "@anthropic-ai/sdk",
  ],
};

export default nextConfig;
