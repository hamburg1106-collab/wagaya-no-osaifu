// donutcheck.tsx をNodeで動かすためだけの設定。アプリのビルドには使わない。
// JSXを含むので、smoke用の設定と違ってreactプラグインが必要。
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  build: {
    ssr: 'donutcheck.tsx',
    outDir: '.donut',
    emptyOutDir: true,
    target: 'node22',
  },
})
