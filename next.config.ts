import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // The optimizer rejects SVG by default ("image type is not allowed", 400),
    // which silently blanked every <Image> pointing at one, including the login
    // card's Peerly mark. Only local /public assets are served, and the CSP and
    // attachment disposition below are Next's recommended hardening.
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy:
      "default-src 'self'; script-src 'none'; sandbox;",
  },
  experimental: {
    serverActions: {
      // Lecturer verification uploads: up to 4 evidence files of 5MB each.
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
