import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  compress: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
    unoptimized: process.env.NODE_ENV === "development",
    minimumCacheTTL: 60,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  // Multi-site redirects for legacy URLs
  async redirects() {
    return [
      // Legacy article URLs -> Default site
      {
        source: "/article/:slug",
        destination: "/site/sja-utama/:slug",
        permanent: true, // 301 redirect
      },
      {
        source: "/articles/:slug",
        destination: "/site/sja-utama/:slug",
        permanent: true,
      },
      // Legacy category pages
      {
        source: "/category/:slug",
        destination: "/site/sja-utama?category=:slug",
        permanent: true,
      },
      // Legacy search
      {
        source: "/search",
        destination: "/site/sja-utama/search",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;

