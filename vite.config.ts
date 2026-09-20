import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // GitHub Pages（https://hamburg1106-collab.github.io/wagaya-no-osaifu/）で公開する
  base: '/wagaya-no-osaifu/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'わが家のお財布',
        short_name: 'お財布',
        description: 'レシートを撮ると記録される、夫婦2人用の家計簿',
        lang: 'ja',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f7f5f0',
        theme_color: '#2f7a5e',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
        // Firestore SDKは動的importで後から読むので、
        // オフライン起動でもチャンクが取れるようプリキャッシュ対象に入れておく。
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
})
