import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        balance: resolve(__dirname, 'balance.html'),
      },
    },
  },
  worker: { format: 'es' },
});
