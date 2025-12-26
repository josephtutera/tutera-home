import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable dev indicators that cause async params/searchParams warnings
  // The component inspector in dev overlay accesses these props synchronously
  devIndicators: {
    appIsrStatus: false,
    buildActivity: false,
  },
  // Experimental settings for handling async dynamic APIs
  experimental: {
    // Opt out of the async params/searchParams behavior warnings in development
    dynamicIO: false,
  },
};

export default nextConfig;
