import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Lecturer verification uploads: up to 4 evidence files of 5MB each.
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
