// diag.ts をNodeで動かすためだけの設定。アプリのビルドには使わない。
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    ssr: 'diag.ts',
    outDir: '.diag',
    emptyOutDir: true,
    target: 'node22',
  },
})
