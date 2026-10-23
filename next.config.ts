import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Vercel builds omit standalone; Docker / Cloud Run use it when VERCEL is unset.
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
  serverExternalPackages: ["mongodb"],
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
