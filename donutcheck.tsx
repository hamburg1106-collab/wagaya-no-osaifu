// ホームの円グラフを実際に描かせて、弧の長さと開始位置を確かめる使い捨てスクリプト。
// 実行: npx vite build --config donut.vite.config.ts && node .donut/donutcheck.js
//
// 見た目は目で見るしかないが、弧が円周を埋めているか・隙間や重なりが無いかは
// 数字で確かめられる。ここがずれると、割合の絵が嘘になる。
import { renderToStaticMarkup } from 'react-dom/server'
import { Donut } from './src/components/Donut'
import type { BucketTotal } from './src/lib/aggregate'

const C = 2 * Math.PI * 60

const check = (label: string, buckets: BucketTotal[]) => {
  const total = buckets.reduce((a, b) => a + b.amount, 0)
  const html = renderToStaticMarkup(<Donut buckets={buckets} total={total} />)
  const lengths = [...html.matchAll(/stroke-dasharray="([\d.]+) ([\d.]+)"/g)].map((m) => Number(m[1]))
  const offsets = [...html.matchAll(/stroke-dashoffset="(-?[\d.]+)"/g)].map((m) => Number(m[1]))

  const filled = lengths.reduce((a, b) => a + b, 0) / C
  const contiguous = offsets.every(
    (o, i) => Math.abs(-o - lengths.slice(0, i).reduce((a, b) => a + b, 0)) < 1e-9,
  )
  const texts = [...html.matchAll(/<text[^>]*>([^<]+)<\/text>/g)].map((m) => m[1])
  const legend = [...html.matchAll(/class="legend__name">([^<]+)</g)].map((m) => m[1])

  console.log(`\n--- ${label} ---`)
  console.log(`${lengths.length === buckets.length ? 'OK  ' : 'NG  '}弧の本数が内訳の数と同じ  ${lengths.length}`)
  console.log(`${Math.abs(filled - 1) < 1e-9 ? 'OK  ' : 'NG  '}弧が円周をぴったり埋める  ${filled.toFixed(6)}`)
  console.log(`${contiguous ? 'OK  ' : 'NG  '}隙間も重なりも無い`)
  console.log(`${legend.length === buckets.length ? 'OK  ' : 'NG  '}凡例が多い順  ${legend.join(' > ')}`)
  console.log(`    穴の文字: ${texts.join(' / ')}`)
}

const b = (bucket: string, amount: number): BucketTotal =>
  ({ bucket, amount, color: '#000' }) as BucketTotal

check('ふつうの月', [b('固定費', 180000), b('食費', 62000), b('日用品', 9000), b('税', 1000)])
check('1カテゴリだけの月', [b('食費', 5000)])
check('12本すべて出た月', Array.from({ length: 12 }, (_, i) => b(`c${i}`, (i + 1) * 1000)))
check('端数が割り切れない', [b('食費', 1), b('日用品', 1), b('交通', 1)])
