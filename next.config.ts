import type { NextConfig } from "next";

// Every page in EcoPoints shows live data, so the scaffold's cacheComponents /
// partialPrefetching defaults are deliberately left off (see docs/GOTCHAS.md).
const nextConfig: NextConfig = {
  // AI photo checks upload a photo already shrunk on the device (~0.2–0.6 MB).
  experimental: {
    serverActions: { bodySizeLimit: "3mb" },
  },
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
