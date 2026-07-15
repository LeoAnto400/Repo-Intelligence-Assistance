import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow development requests when the app is opened through this LAN address.
  allowedDevOrigins: ["192.168.1.7"],
  // No rewrite proxy to the backend here on purpose: next dev's internal
  // proxy for external rewrite destinations has its own hardcoded timeout
  // (~20s) that a real repository ingest routinely exceeds, and tearing
  // down that connection crashes the whole dev server process. The
  // frontend calls the FastAPI backend directly instead (see api-client.ts).
};

export default nextConfig;
