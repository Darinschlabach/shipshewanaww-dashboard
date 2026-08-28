import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A lockfile in the user home directory made Next treat C:\Users\darin as
  // the workspace root, which stalls compiles and leaves localhost spinning.
  outputFileTracingRoot: path.resolve(process.cwd()),
};

export default nextConfig;
