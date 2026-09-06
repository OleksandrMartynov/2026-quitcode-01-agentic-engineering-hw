import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    // The Porsche Design System palette is built on the native CSS `light-dark()`
    // function. Lightning CSS would otherwise downlevel it and break theming.
    useLightningcss: true,
    lightningCssFeatures: {
      exclude: ['light-dark'],
    },
  },
};

export default nextConfig;
