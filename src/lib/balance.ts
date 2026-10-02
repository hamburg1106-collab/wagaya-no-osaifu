import { CONTRIBUTION_DAY } from '../config'
import type { IncomeRecord, IncomeSource, Plan, Receipt } from '../types'
import { sumTotal } from './aggregate'
import { monthOf, shiftMonth, todayKey } from './month'

/**
 * 前回の照合から今日までに、拠出日（毎月15日）が何回来たか。
 * 照合した当日の拠出は、その日の通帳残高にもう入っている前提で数えない。
 */
const contributionDaysBetween = (after: string, upTo: string): number => {
  const day = String(CONTRIBUTION_DAY).padStart(2, '0')
  let count = 0
  // 月の書式が壊れていても無限に回らないよう、回数でも止める
  for (let m = monthOf(after), i = 0; m <= monthOf(upTo) && i < 120; m = shiftMonth(m, 1), i += 1) {
    const date = `${m}-${day}`
    if (date > after && date <= upTo) count += 1
  }
  return count
}

export type BalanceEstimate = {
  /** 今あるはずの残高（カードの未払いを引いた額） */
  amount: number
  /** 基準にした照合の日 */
  baseDate: string
  /** 内訳。照合画面で「なぜこの額か」を見せるため */
  base: number
  contributions: number
  income: number
  spend: number
}

/**
 * 今あるはずの家計の残高を出す。
 *
 * 前回照合した残高（通帳残高 − カードの未払い）を起点に、
 *   ＋ その後の拠出（毎月15日に、設定の「家計に入るお金」の合計）
 *   ＋ その後に記録した収入（売電など）
 *   − その後に記録した支出
 * を足し引きする。カードで払った支出は記録した日に引くので、
 * 比べる相手も「通帳残高 − カードの未払い」にする（引き落としの時期のずれを消すため）。
 *
 * 今日より先の日付の記録は数えない。固定費は月末の日付で前もって計上されるため。
 */
export const estimateBalance = (
  plan: Plan,
  sources: IncomeSource[],
  incomeRecords: IncomeRecord[],
  receipts: Receipt[],
  today = todayKey(),
): BalanceEstimate | null => {
  // 一度も残高を入れていない。起点が無いので出せない
  if (plan.updatedAt === 0) return null

  const after = plan.balanceAsOf
  const inRange = (date: string) => date > after && date <= today

  const monthly = sources.filter((s) => s.active).reduce((a, s) => a + Math.max(0, s.amount), 0)
  const contributions = monthly * contributionDaysBetween(after, today)
  const income = incomeRecords.filter((r) => inRange(r.date)).reduce((a, r) => a + r.amount, 0)
  const spend = sumTotal(receipts.filter((r) => inRange(r.date)))

  return {
    amount: plan.balance + contributions + income - spend,
    baseDate: after,
    base: plan.balance,
    contributions,
    income,
    spend,
  }
}
