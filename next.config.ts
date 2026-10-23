import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Smaller image for Cloud Run / Docker (`node server.js` in .next/standalone).
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
