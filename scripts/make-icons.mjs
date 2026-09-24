// アプリアイコンを生成する。`npm run icons` で public/ に書き出す。
//
// モチーフは財布。文字を入れないのは、環境によってフォントが無く崩れるため。
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const here = dirname(fileURLToPath(import.meta.url))
const publicDir = resolve(here, '..', 'public')

const GREEN = '#d96f4c'
const LEAF = '#e8a06a'
const FG = '#ffffff'

const svg = (size) => {
  const s = (v) => (size * v).toFixed(2)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${GREEN}"/>
      <stop offset="1" stop-color="${LEAF}"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${s(0.22)}" fill="url(#g)"/>
  <!-- 財布の本体 -->
  <rect x="${s(0.22)}" y="${s(0.3)}" width="${s(0.56)}" height="${s(0.4)}" rx="${s(0.07)}" fill="${FG}"/>
  <!-- かぶせのフタ。本体より少し濃くして段差を出す -->
  <path d="M${s(0.22)} ${s(0.42)} h${s(0.56)} v${s(-0.05)} a${s(0.07)} ${s(0.07)} 0 0 0 ${s(-0.07)} ${s(-0.07)} h${s(-0.42)} a${s(0.07)} ${s(0.07)} 0 0 0 ${s(-0.07)} ${s(0.07)} Z" fill="${FG}" opacity="0.72"/>
  <!-- 留め具 -->
  <circle cx="${s(0.66)}" cy="${s(0.52)}" r="${s(0.055)}" fill="${GREEN}"/>
</svg>`
}

await mkdir(publicDir, { recursive: true })

for (const size of [192, 512]) {
  await sharp(Buffer.from(svg(size))).png().toFile(resolve(publicDir, `icon-${size}.png`))
}
// iOSのホーム画面追加用（角丸はOS側で付くので同じ絵でよい）
await sharp(Buffer.from(svg(180))).png().toFile(resolve(publicDir, 'apple-touch-icon.png'))
await writeFile(resolve(publicDir, 'favicon.svg'), svg(64), 'utf8')

console.log('アイコンを public/ に書き出しました')
