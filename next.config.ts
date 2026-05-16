import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  turbopack: {},
  ...(process.env.TAURI_STATIC_EXPORT === "1" ? { output: "export" } : {}),
};

export default nextConfig;