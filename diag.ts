// 実物のCSVを取り込みロジックに通して、どこに落ちているか確かめる使い捨てスクリプト。
// 金額そのものは出さず、割合と件数だけを出す（本番データなので中身は持ち出さない）。
import { readFileSync } from 'node:fs'
import { decodeCsv, summarizeZaim } from './src/lib/zaimImport'

const path = process.argv[2]
const text = decodeCsv(readFileSync(path).buffer as ArrayBuffer)
const r = summarizeZaim(text)

console.log('集計できた月数:', r.months.length)
console.log('支出として数えた行:', r.rows)
console.log('飛ばした行:', r.skipped)
console.log('対応表に無かったカテゴリ:', r.unknown.join(' / ') || 'なし')

const total = r.months.reduce((a, m) => a + m.total, 0)
const byBucket = new Map<string, number>()
for (const m of r.months) {
  for (const [b, v] of m.byBucket) byBucket.set(b, (byBucket.get(b) ?? 0) + v)
}

console.log('\n=== 金額の内訳（割合）===')
;[...byBucket.entries()]
  .sort((a, b) => b[1] - a[1])
  .forEach(([b, v]) => {
    const pct = ((v / total) * 100).toFixed(1)
    console.log(`${pct.padStart(5)}%  ${b}`)
  })

console.log('\n期間:', r.months[0]?.month, '〜', r.months[r.months.length - 1]?.month)

console.log('\n対応表に無かったぶんの割合:', (r.unknownShare * 100).toFixed(1) + '%')
