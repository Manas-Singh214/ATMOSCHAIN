import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  basePath: process.env.NODE_ENV === "production" && !process.env.VERCEL ? "/ATMOSCHAIN" : "",
  reactCompiler: true,
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
