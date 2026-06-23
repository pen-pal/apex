/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev serves at root; the production build is served from /apex/ on GitHub Pages.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/apex/' : '/',
  plugins: [react()],
  test: {
    // core/protocol tests are pure logic and need no DOM; view tests can opt into jsdom per-file
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
}));
