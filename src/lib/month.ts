/** 月の区切りは1日〜末日。給料日基準にはしない */

/** Dateから YYYY-MM-DD を作る。toISOStringはUTCになり日本の深夜が前日になるので使わない */
export const toDateKey = (d: Date): string => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** YYYY-MM-DD → YYYY-MM */
export const monthOf = (dateKey: string): string => dateKey.slice(0, 7)

export const todayKey = (): string => toDateKey(new Date())

export const thisMonth = (): string => monthOf(todayKey())

/** YYYY-MM をnヶ月ずらす */
export const shiftMonth = (month: string, diff: number): string => {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + diff, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** 「2026年9月」 */
export const formatMonth = (month: string): string => {
  const [y, m] = month.split('-')
  return `${y}年${Number(m)}月`
}

/** 「9/19（土）」 */
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']
export const formatDay = (dateKey: string): string => {
  const [y, m, d] = dateKey.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return `${m}/${d}（${WEEKDAYS[date.getDay()]}）`
}

/** 「¥4,280」 */
export const yen = (n: number): string => `¥${Math.round(n).toLocaleString('ja-JP')}`

/**
 * from月からto月までを古い順に並べる。固定費の未計上チェックに使う。
 * 万一startMonthが壊れていても無限ループにならないよう上限を付ける。
 */
export const monthsBetween = (from: string, to: string, limit = 24): string[] => {
  const out: string[] = []
  let cur = from
  while (cur <= to && out.length < limit) {
    out.push(cur)
    cur = shiftMonth(cur, 1)
  }
  return out
}
