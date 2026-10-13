import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        balance: resolve(__dirname, 'balance.html'),
        play: resolve(__dirname, 'play.html'),
        dogam: resolve(__dirname, 'dogam.html'),
      },
    },
  },
  worker: { format: 'es' },
});
