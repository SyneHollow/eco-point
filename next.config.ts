import type { NextConfig } from "next";

// Every page in EcoPoints shows live data, so the scaffold's cacheComponents /
// partialPrefetching defaults are deliberately left off (see docs/GOTCHAS.md).
const nextConfig: NextConfig = {
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
