import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable output as standalone to reduce runtime dependencies in Docker
  output: 'standalone',
  
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
    // Optimize images for better performance on mobile
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // Enable compression for better performance
  compress: true,
};

export default nextConfig;
