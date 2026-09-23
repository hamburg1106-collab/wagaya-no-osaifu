// 見通しの計算だけを検算する使い捨てスクリプト。
// 実行: npx vite build --config smoke.vite.config.ts && node .smoke/smoke.js
import { buildForecast, defaultPlan } from './src/lib/forecast'
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
      certain: true,
      note: '',
    },
    {
      id: 'e2',
      name: 'ボーナス',
      month: '2026-12',
      amount: 500_000,
      kind: 'income',
      certain: true,
      note: '',
    },
    {
      id: 'e3',
      name: '未確定の出費',
      month: '2026-11',
      amount: 4_000_000,
      kind: 'spend',
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
