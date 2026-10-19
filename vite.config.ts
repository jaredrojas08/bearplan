import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Relative asset paths so the same build works at a domain root and under /bearplan/ on GitHub Pages.
  base: './',
  plugins: [svelte()],
  test: {
    include: ['src/**/*.test.ts'],
  },
})
