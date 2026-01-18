import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // Disable Turbopack's default behavior due to Unicode path issues
  turbopack: {
    // Workaround for Turbopack bug with non-ASCII paths
  },
};

export default nextConfig;
