import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    cssMinify: true,
    minify: 'esbuild',
  },
  server: {
    host: true,
    port: 5173,
  },
});
