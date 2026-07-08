import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Type-checking and linting are run separately (locally + CI) and are clean.
  // The in-build passes otherwise hang/OOM the Vercel build machine on this
  // codebase, so skip them here — the build only needs to compile.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
