import { BUCKET_COLORS, CATEGORIES, LEGACY_FIXED } from '../config'
import type { Bucket, Entry, Receipt } from '../types'
import { monthOf } from './month'

/** バーの並び順。カテゴリの定義順で、古い記録に残る「固定費」は最後 */
export const BUCKET_ORDER: Bucket[] = [...CATEGORIES, LEGACY_FIXED]

export type BucketTotal = {
  bucket: Bucket
  amount: number
  color: string
}

export const receiptsOfMonth = (receipts: Receipt[], month: string): Receipt[] =>
  receipts.filter((r) => monthOf(r.date) === month)

/**
 * 固定費か。固定費はカテゴリではなく印なので、次のどれかで決まる。
 * - アプリが自動計上した記録（source='fixed'）
 * - Zaimから取り込んだ住まい・水道光熱・通信（行に fixed が付いている）
 * - 以前の「固定費」カテゴリのまま残っている行
 */
export const isFixedItem = (receipt: Receipt, item: Entry): boolean =>
  receipt.source === 'fixed' || item.fixed === true || item.category === LEGACY_FIXED

/**
 * 内訳を足し合わせる。レシートのtotalではなく内訳の合計を使う。
 * 検算が合っていないレシートがあっても、カテゴリ別の棒とその合計が食い違わないようにするため。
 *
 * excludeFixed なら固定費の行を除く。土地ローンが「住まい」として円の大半を占めると、
 * 日々のやりくりで動かせるお金の内訳が読めなくなるため。
 */
export const sumByBucket = (receipts: Receipt[], excludeFixed = false): BucketTotal[] => {
  const map = new Map<Bucket, number>()
  for (const r of receipts) {
    for (const item of r.items) {
      if (excludeFixed && isFixedItem(r, item)) continue
      map.set(item.category, (map.get(item.category) ?? 0) + item.amount)
    }
  }
  return BUCKET_ORDER.filter((b) => (map.get(b) ?? 0) !== 0).map((b) => ({
    bucket: b,
    amount: map.get(b) ?? 0,
    color: BUCKET_COLORS[b] ?? '#a0a0a0',
  }))
}

export const sumTotal = (receipts: Receipt[]): number =>
  receipts.reduce((acc, r) => acc + r.items.reduce((a, i) => a + i.amount, 0), 0)

/** 固定費の行だけの合計 */
export const sumFixed = (receipts: Receipt[]): number =>
  receipts.reduce(
    (acc, r) => acc + r.items.reduce((a, i) => a + (isFixedItem(r, i) ? i.amount : 0), 0),
    0,
  )

/** 内訳の合計。確認画面の検算に使う */
export const sumItems = (items: { amount: number }[]): number =>
  items.reduce((acc, i) => acc + i.amount, 0)
