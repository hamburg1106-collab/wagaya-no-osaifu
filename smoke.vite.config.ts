// smoke.ts をNodeで動かすためだけの設定。アプリのビルドには使わない。
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    ssr: 'smoke.ts',
    outDir: '.smoke',
    emptyOutDir: true,
    target: 'node22',
  },
})
