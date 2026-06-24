/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Base path differs by host:
//  • GitHub Pages serves the build under /apex/ (project page), so assets must be /apex/…
//  • Vercel serves it at the domain root, so assets must be /…  (Vercel sets VERCEL=1 at build time)
//  • the dev server always runs at /
// One build config, correct on both. Override with APEX_BASE if you host it somewhere else.
const buildBase = process.env.APEX_BASE ?? (process.env.VERCEL ? '/' : '/apex/');
export default defineConfig(({ command }) => ({
  base: command === 'build' ? buildBase : '/',
  plugins: [react()],
  test: {
    // core/protocol tests are pure logic and need no DOM; view tests can opt into jsdom per-file
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
}));
