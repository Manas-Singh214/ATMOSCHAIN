import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: "export",
  basePath: process.env.NODE_ENV === "production" ? "/ATMOSCHAIN" : "",
  reactCompiler: true,
};

export default nextConfig;
