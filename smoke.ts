// 見通しの計算だけを検算する使い捨てスクリプト。
// 実行: npx vite build --config smoke.vite.config.ts && node .smoke/smoke.js
import { buildForecast, defaultPlan, expandRepeats } from './src/lib/forecast'
import { parseCsv, summarizeZaim, toReceipts } from './src/lib/zaimImport'
import type { IncomeSource, LifeEvent, Plan, Receipt } from './src/types'

const receipt = (date: string, amount: number): Receipt => ({
  id: crypto.randomUUID(),
  date,
  store: 'テスト',
  total: amount,
  items: [{ category: '食費', amount }],
  source: 'receipt',
  createdAt: Date.now(),
})

const plan: Plan = {
  balance: 1_000_000,
  balanceAsOf: '2026-09-23',
  assumedSpend: 300_000,
  updatedAt: Date.now(),
}

const income: IncomeSource[] = [
  { id: '1', name: '給料', amount: 400_000, active: true },
  { id: '2', name: '止まってるやつ', amount: 999_999, active: false },
]

const ok = (label: string, cond: boolean, detail = '') =>
  console.log(`${cond ? 'OK  ' : 'NG  '}${label}${detail ? `  ${detail}` : ''}`)

/* 1. 実績が無いときは手置きの想定額を使う */
{
  const f = buildForecast([], income, [], plan, true)
  ok('実績なし→想定額を使う', !f.spendFromActual && f.monthlySpend === 300_000)
  ok('余剰 = 収入400,000 − 支出300,000', f.monthlySurplus === 100_000, `${f.monthlySurplus}`)
  ok('停止中の収入は数えない', f.monthlyIncome === 400_000, `${f.monthlyIncome}`)
  ok('ずっと黒字なら不足月は出ない', f.shortfallMonth === null)
}

/* 2. 実績があればそちらを優先。今月は平均に入れない */
{
  const receipts = [
    receipt('2026-07-10', 200_000),
    receipt('2026-08-10', 240_000),
    // 今月ぶん。月初だと極端に軽いので平均から外れるはず
    receipt('2026-09-01', 3_000),
  ]
  const f = buildForecast(receipts, income, [], plan, true)
  ok('実績を使う', f.spendFromActual)
  ok('今月を除く2ヶ月の平均 220,000', f.monthlySpend === 220_000, `${f.monthlySpend}`)
  ok('平均に使った月数は2', f.actualMonths === 2, `${f.actualMonths}`)
}

/* 3. ライフイベントで残高が削られ、尽きる月が出る */
{
  const events: LifeEvent[] = [
    {
      id: 'e1',
      name: '大物',
      month: '2026-12',
      amount: 5_000_000,
      kind: 'spend',
      repeat: 'once',
      certain: true,
      note: '',
    },
    {
      id: 'e2',
      name: 'ボーナス',
      month: '2026-12',
      amount: 500_000,
      kind: 'income',
      repeat: 'once',
      certain: true,
      note: '',
    },
    {
      id: 'e3',
      name: '未確定の出費',
      month: '2026-11',
      amount: 4_000_000,
      kind: 'spend',
      repeat: 'once',
      certain: false,
      note: '',
    },
  ]

  const withUncertain = buildForecast([], income, events, plan, true)
  ok('未確定を含めると11月に落ちる', withUncertain.shortfallMonth === '2026-11', `${withUncertain.shortfallMonth}`)

  const certainOnly = buildForecast([], income, events, plan, false)
  ok('未確定を外すと12月に落ちる', certainOnly.shortfallMonth === '2026-12', `${certainOnly.shortfallMonth}`)

  // 10月・11月・12月の残高を手で検算する（未確定を外した場合）
  // 起点100万 → 10月 +10万=110万 → 11月 +10万=120万 → 12月 +10万 -500万 +50万 = -320万
  const dec = certainOnly.points.find((p) => p.month === '2026-12')
  ok('12月末の残高 −3,200,000', dec?.balance === -3_200_000, `${dec?.balance}`)

  const nov = certainOnly.points.find((p) => p.month === '2026-11')
  ok('11月末の残高 1,200,000', nov?.balance === 1_200_000, `${nov?.balance}`)
}

/* 4. 残高の記録日が古くても、そこから追いついて積み上げる */
{
  const old: Plan = { ...plan, balanceAsOf: '2026-06-15' }
  const f = buildForecast([], income, [], old, true)
  ok('7月から始まる', f.points[0]?.month === '2026-07', `${f.points[0]?.month}`)
  ok('7月末は110万', f.points[0]?.balance === 1_100_000, `${f.points[0]?.balance}`)
}

/* 5. 未保存の前提は updatedAt=0。見通し画面がこれで「まだ出せない」を判定している */
{
  const d = defaultPlan()
  ok('未保存の前提はupdatedAt=0', d.updatedAt === 0, `${d.updatedAt}`)
  ok('未保存なら残高も想定支出も0', d.balance === 0 && d.assumedSpend === 0)

  // 支出の見積りが0のまま見通しを描くと、収入がまるごと余剰になって甘く出る。
  // 画面側でこれを弾いているが、計算そのものは0を返すことを確認しておく
  const f = buildForecast([], income, [], d, true)
  ok('支出0なら余剰=収入まるごと（画面で弾く前提）', f.monthlySpend === 0 && f.monthlySurplus === 400_000)
}

/* 6. 赤字なら必ずいつか尽きる */
{
  const poor: IncomeSource[] = [{ id: '1', name: '給料', amount: 100_000, active: true }]
  const f = buildForecast([], poor, [], plan, true)
  ok('毎月20万の赤字', f.monthlySurplus === -200_000, `${f.monthlySurplus}`)
  // 100万 ÷ 20万 = 5ヶ月で尽きる → 6ヶ月目にマイナス
  ok('2027-03に尽きる', f.shortfallMonth === '2027-03', `${f.shortfallMonth}`)
}

/* 7. ZaimのCSVを月ごとの集計に変える */
{
  // 引用符の中にカンマと改行がある行を混ぜてある
  const csv = [
    '日付,方法,カテゴリ,カテゴリの内訳,品目,メモ,お店,収入,支出,振替',
    '2026-08-03,payment,食費,食料品,,"りんご, みかん",スーパーA,0,1200,0',
    '2026-08-15,payment,食費,外食,,,店B,0,800,0',
    '2026-08-20,payment,日用雑貨,消耗品,,,店C,0,500,0',
    '2026-08-25,payment,水道・光熱,電気,,,,0,9000,0',
    '2026-08-28,payment,ペット,えさ,,,,0,300,0',
    '2026-08-31,income,給与,,,,,400000,0,0',
    '2026-08-31,transfer,現金・カード,,,,,0,50000,0',
    '2026/9/1,payment,食費,食料品,,"改行を',
    '含むメモ",スーパーA,0,2000,0',
  ].join('\n')

  const r = summarizeZaim(csv)

  ok('2ヶ月ぶんにまとまる', r.months.length === 2, `${r.months.length}`)

  const aug = r.months[0]
  ok('8月になる', aug.month === '2026-08', aug.month)
  // 食費 1200+800=2000 / 日用品 500 / 固定費 9000 / その他(ペット) 300
  ok('8月の合計 11,800', aug.total === 11800, `${aug.total}`)
  ok('食費は2件で2,000', aug.byBucket.get('食費') === 2000, `${aug.byBucket.get('食費')}`)
  ok('日用雑貨→日用品', aug.byBucket.get('日用品') === 500, `${aug.byBucket.get('日用品')}`)
  ok('水道・光熱→固定費', aug.byBucket.get('固定費') === 9000, `${aug.byBucket.get('固定費')}`)
  ok('未知のカテゴリは その他', aug.byBucket.get('その他') === 300, `${aug.byBucket.get('その他')}`)
  ok('未知のカテゴリを報告する', r.unknown.includes('ペット'), r.unknown.join(','))

  ok('収入は支出に混ぜない', !aug.byBucket.has('収入' as never))
  ok('収入の月平均を拾う', r.incomeMonthlyAverage === 400000, `${r.incomeMonthlyAverage}`)
  ok('振替(現金・カード)は除く', aug.total === 11800)

  // 「2026/9/1」のスラッシュ区切りと、引用符内の改行をまたいだ行
  const sep = r.months[1]
  ok('スラッシュ区切りも読める', sep.month === '2026-09', sep.month)
  ok('引用符内の改行をまたげる', sep.total === 2000, `${sep.total}`)

  const receipts = toReceipts(r.months)
  ok('IDは月で固定（入れ直しで上書き）', receipts[0].id === 'import-2026-08', receipts[0].id)
  ok('日付は月末', receipts[0].date === '2026-08-31', receipts[0].date)
  ok('内訳の合計とtotalが一致', receipts[0].items.reduce((a, i) => a + i.amount, 0) === receipts[0].total)
}

/* 8. CSVの引用符まわり */
{
  const rows = parseCsv('a,"b,c",d\r\n1,"2""3",4\r\n')
  ok('引用符内のカンマ', rows[0][1] === 'b,c', rows[0][1])
  ok('二重引用符のエスケープ', rows[1][1] === '2"3', rows[1][1])
  ok('CRLFで2行', rows.length === 2, `${rows.length}`)
}

/* 9. 繰り返す予定を展開する */
{
  const base = { id: 'r1', amount: 1_000_000, kind: 'income' as const, certain: true, note: '' }

  const once = expandRepeats([{ ...base, name: '一度だけ', month: '2027-03', repeat: 'once' }], '2031-09')
  ok('1回だけなら1件', once.length === 1, `${once.length}`)

  const yearly = expandRepeats([{ ...base, name: '実家からの贈与', month: '2027-03', repeat: 'yearly' }], '2031-09')
  ok('毎年なら5件', yearly.length === 5, `${yearly.length}`)
  ok('1回目は2027-03', yearly[0].month === '2027-03', yearly[0].month)
  ok('2回目は1年後', yearly[1].month === '2028-03', yearly[1].month)
  ok('範囲を超えない', yearly[yearly.length - 1].month <= '2031-09', yearly[yearly.length - 1].month)

  const car = expandRepeats([{ ...base, name: '車検', month: '2028-09', repeat: 'biennial' }], '2031-09')
  ok('2年ごとなら2件', car.length === 2, `${car.length}`)
  ok('2回目は2年後', car[1].month === '2030-09', car[1].month)
}

/* 10. 繰り返しが残高に効く */
{
  // 収入40万 − 支出30万 = 余剰10万。5年で+600万だが、
  // 毎年150万の出費があると毎年50万ずつ減っていく
  const yearlyCost: LifeEvent[] = [
    { id: 'y1', name: '毎年の大物', month: '2026-12', amount: 1_500_000, kind: 'spend', repeat: 'yearly', certain: true, note: '' },
  ]
  const f = buildForecast([], income, yearlyCost, plan, true)

  // 起点100万。2026-12に 100万+30万(10-12月) -150万 = -20万 → ここで落ちる
  ok('繰り返しで不足月が出る', f.shortfallMonth === '2026-12', `${f.shortfallMonth}`)

  // 1回だけなら翌年以降は回復するので、5年後の残高が繰り返し版より大きいはず
  const onceOnly = buildForecast([], income, [{ ...yearlyCost[0], repeat: 'once' }], plan, true)
  const last = (x: typeof f) => x.points[x.points.length - 1].balance
  ok('繰り返しのほうが最終残高は小さい', last(f) < last(onceOnly), `${last(f)} < ${last(onceOnly)}`)

  // 毎年150万 × 5回 = 750万 ぶんの差が出る（範囲内の回数ぶん）
  const times = f.points.filter((p) => p.events.length > 0).length
  ok('範囲内で5回起きる', times === 5, `${times}`)
}

/* 11. repeat が無い古いデータでも落ちない */
{
  const legacy = { id: 'old', name: '昔のデータ', month: '2026-12', amount: 100_000, kind: 'spend' as const, certain: true, note: '' } as LifeEvent
  const got = expandRepeats([legacy], '2031-09')
  ok('repeat未設定は1回だけ扱い', got.length === 1, `${got.length}`)
}
