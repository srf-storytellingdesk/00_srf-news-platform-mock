/**
 * Local preview harness — not part of the published surface.
 *
 * It exists to look at a mock (`pnpm dev`) and to dogfood the very plugin the
 * template forks consume, so a regression in `integration/vite.js` shows up
 * here first.
 */
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

import platformMock from './integration/vite.js'

/** Kept in sync with the mount point `preview/main.jsx` renders into. */
const MOUNT_ID = 'platform-mock-preview'

const brand = process.env.PLATFORM_MOCK_BRAND || 'srf'

export default defineConfig({
  // A non-root base on purpose: the forks deploy under /widgets/<name>/, so the
  // preview exercises the same asset-URL handling they do.
  base: '/widgets/platform-mock/',

  // The mock's assets are served by the plugin straight out of mocks/<brand>/,
  // so this repo needs no public directory of its own.
  publicDir: false,

  server: { port: 4100 },

  plugins: [
    platformMock({
      brand,
      entry: '/preview/main.jsx',
      mountId: MOUNT_ID,
      title: `Platform mock — ${brand}`,
    }),
    react(),
  ],
})
