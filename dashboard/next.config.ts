import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_API_URL: process.env.CLAUDIO_API_URL || "http://localhost:17280",
  },
};

export default nextConfig;
