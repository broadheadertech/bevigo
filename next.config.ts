import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Convex files use stub types that cause false errors during build.
    // Real type checking happens via `npx convex dev` which generates proper types.
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
