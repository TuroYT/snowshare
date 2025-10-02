import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable output as standalone to reduce runtime dependencies in Docker
  output: 'standalone',
  
  // Expose environment variables to the client
  env: {
    NEXT_PUBLIC_ALLOW_SIGNUP: process.env.ALLOW_SIGNUP || 'true',
  },
};

export default nextConfig;
