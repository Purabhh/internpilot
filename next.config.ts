import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // instrumentationHook is enabled by default in Next 15 (no longer in experimental).
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
