import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  transpilePackages: ["@skillcontest/ui", "@skillcontest/shared-types"],
}

export default nextConfig
