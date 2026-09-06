import type { NextConfig } from 'next';

/*
 * GitHub Pages serves static files only, and from a /<repo>/ sub-path. Both
 * settings are opt-in through the environment so that local development and a
 * plain `npm run build` stay an ordinary Next.js build; only the Pages workflow
 * turns on the static export.
 */
const isPagesBuild = process.env.GITHUB_PAGES === 'true';
const basePath = process.env.PAGES_BASE_PATH ?? '';

const nextConfig: NextConfig = {
  ...(isPagesBuild ? { output: 'export', basePath, assetPrefix: basePath } : {}),
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
