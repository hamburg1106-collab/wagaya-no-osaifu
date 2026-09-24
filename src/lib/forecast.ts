import { FORECAST_MONTHS } from '../config'
import type { IncomeSource, LifeEvent, Plan, Receipt } from '../types'
import { sumTotal } from './aggregate'
import { monthOf, monthsBetween, shiftMonth, thisMonth, todayKey } from './month'

/** 支出の実績を何ヶ月ぶん平均するか */
const LOOKBACK = 6

export type ForecastPoint = {
  month: string
  /** その月を終えた時点の残高 */
  balance: number
  events: LifeEvent[]
}

export type Forecast = {
  points: ForecastPoint[]
  /** 初めて残高がマイナスになる月。最後まで持つなら null */
  shortfallMonth: string | null
  monthlyIncome: number
  monthlySpend: number
  monthlySurplus: number
  /** 支出に実績を使えたか。falseなら手置きの想定額を使っている */
  spendFromActual: boolean
  /** 実績の平均に使った月数 */
  actualMonths: number
}

/**
 * まだ一度も保存されていない状態の前提。
 * updatedAt が 0 であることが「未保存」の目印になっている。
 * ここをDate.now()にすると、残高を入れていないのに入れた扱いになり、
 * 見通しが「収入まるごと余剰」で描かれて極端に甘く出る。
 */
export const defaultPlan = (): Plan => ({
  balance: 0,
  balanceAsOf: todayKey(),
  assumedSpend: 0,
  updatedAt: 0,
})

/**
 * 月の支出を見積もる。
 *
 * 記録があるならその平均を使う。手で置いた想定額より実測のほうが当たるし、
 * レシートを撮り続ける意味もここにある。
 *
 * ただし**今月は数えない**。月初に開くと「今月はまだ3千円」となり、
 * 月の支出が極端に軽く見えて見通しが甘く出るため。
 */
const estimateSpend = (
  receipts: Receipt[],
  plan: Plan,
): { spend: number; fromActual: boolean; months: number } => {
  const current = thisMonth()
  const byMonth = new Map<string, number>()
  for (const r of receipts) {
    const m = monthOf(r.date)
    if (m >= current) continue
    byMonth.set(m, (byMonth.get(m) ?? 0) + sumTotal([r]))
  }

  // 直近から数えてLOOKBACKヶ月ぶん。記録が飛んでいる月は平均に入れない
  const months = [...byMonth.keys()].sort().reverse().slice(0, LOOKBACK)
  if (months.length === 0) {
    return { spend: Math.max(0, plan.assumedSpend), fromActual: false, months: 0 }
  }

  const total = months.reduce((acc, m) => acc + (byMonth.get(m) ?? 0), 0)
  return { spend: Math.round(total / months.length), fromActual: true, months: months.length }
}

/** 繰り返しの間隔（月数）。once は繰り返さない */
const STEP_MONTHS: Record<LifeEvent['repeat'], number> = {
  once: 0,
  yearly: 12,
  biennial: 24,
}

/**
 * 繰り返す予定を、見通しの範囲に入る回数ぶんに展開する。
 *
 * 車検は2年ごと、固定資産税や保険は毎年やってくる。1回ぶんしか置けないと
 * 5年先の見通しが実際よりずっと楽観的になる。
 */
export const expandRepeats = (
  events: LifeEvent[],
  until: string,
): { month: string; event: LifeEvent }[] => {
  const out: { month: string; event: LifeEvent }[] = []

  for (const event of events) {
    const step = STEP_MONTHS[event.repeat] ?? 0
    if (step === 0) {
      out.push({ month: event.month, event })
      continue
    }
    // 月の書式が壊れていても無限に回らないよう、回数でも止める
    let month = event.month
    for (let i = 0; month <= until && i < 120; i += 1) {
      out.push({ month, event })
      month = shiftMonth(month, step)
    }
  }
  return out
}

/**
 * 残高の見通しを作る。
 *
 * 起点は手で入れた貯蓄残高。そこから毎月の余剰を足し、
 * ライフイベントをその月に足し引きしていくだけの素直な積み上げ。
 * 利回りも物価上昇も入れない。入れると前提が増えて、外れたときに理由が分からなくなる。
 */
export const buildForecast = (
  receipts: Receipt[],
  income: IncomeSource[],
  events: LifeEvent[],
  plan: Plan,
  /** 未確定のイベントを含めるか */
  includeUncertain: boolean,
): Forecast => {
  const monthlyIncome = income
    .filter((i) => i.active)
    .reduce((acc, i) => acc + Math.max(0, i.amount), 0)

  const { spend, fromActual, months: actualMonths } = estimateSpend(receipts, plan)
  const monthlySurplus = monthlyIncome - spend

  const used = events.filter((e) => includeUncertain || e.certain)
  const byMonth = new Map<string, LifeEvent[]>()
  for (const { month, event } of expandRepeats(used, shiftMonth(thisMonth(), FORECAST_MONTHS))) {
    byMonth.set(month, [...(byMonth.get(month) ?? []), event])
  }

  // 残高を入れた月の翌月から積み上げる。過去日付で入れていればそこから追いつく
  const from = shiftMonth(monthOf(plan.balanceAsOf), 1)
  const to = shiftMonth(thisMonth(), FORECAST_MONTHS)
  const span = monthsBetween(from, to, FORECAST_MONTHS + 24)

  let balance = plan.balance
  let shortfallMonth: string | null = null
  const points: ForecastPoint[] = []

  for (const month of span) {
    balance += monthlySurplus
    const inMonth = byMonth.get(month) ?? []
    for (const e of inMonth) {
      balance += e.kind === 'income' ? e.amount : -e.amount
    }
    if (shortfallMonth === null && balance < 0) shortfallMonth = month
    points.push({ month, balance, events: inMonth })
  }

  return {
    points,
    shortfallMonth,
    monthlyIncome,
    monthlySpend: spend,
    monthlySurplus,
    spendFromActual: fromActual,
    actualMonths,
  }
}
