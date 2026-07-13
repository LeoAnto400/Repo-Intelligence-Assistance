import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow development requests when the app is opened through this LAN address.
  allowedDevOrigins: ["192.168.1.7"],
  async rewrites() {
    return [{ source: "/api/backend/:path*", destination: "http://127.0.0.1:8000/api/v1/:path*" }];
  },
};

export default nextConfig;
