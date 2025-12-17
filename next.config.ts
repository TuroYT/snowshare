import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable output as standalone to reduce runtime dependencies in Docker
  output: 'standalone',
  
  experimental: {
    middlewareClientMaxBodySize: '50gb',
  },
  // Expose environment variables to the client
  env: {
    NEXT_PUBLIC_ALLOW_SIGNUP: process.env.ALLOW_SIGNUP || 'true',
  },

  // Configure allowed image domains for external logos
  images: {
    remotePatterns: [ 
      {
        protocol: 'https',
        hostname: '**', // Allow all HTTPS domains for flexibility
      },
    ],
  },
};

export default nextConfig;
