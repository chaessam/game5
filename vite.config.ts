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
  // 내 컴퓨터에서: npm run cf:dev(서버, 8787)를 켜 두면 vite 화면에서도 로그인·기록이 된다
  server: { proxy: { '/api': 'http://127.0.0.1:8787' } },
});
