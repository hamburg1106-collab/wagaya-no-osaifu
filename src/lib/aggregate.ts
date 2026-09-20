import { BUCKET_COLORS, CATEGORIES, FIXED_BUCKET } from '../config'
import type { Bucket, Receipt } from '../types'
import { monthOf } from './month'

/** ホームのバーの並び順。固定費を先頭に置き、残りはカテゴリの定義順 */
const BUCKET_ORDER: Bucket[] = [FIXED_BUCKET, ...CATEGORIES]

export type BucketTotal = {
  bucket: Bucket
  amount: number
  color: string
}

export const receiptsOfMonth = (receipts: Receipt[], month: string): Receipt[] =>
  receipts.filter((r) => monthOf(r.date) === month)

/**
 * 内訳を足し合わせる。レシートのtotalではなく内訳の合計を使う。
 * 検算が合っていないレシートがあっても、カテゴリ別の棒とその合計が食い違わないようにするため。
 */
export const sumByBucket = (receipts: Receipt[]): BucketTotal[] => {
  const map = new Map<Bucket, number>()
  for (const r of receipts) {
    for (const item of r.items) {
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

/** 内訳の合計。確認画面の検算に使う */
export const sumItems = (items: { amount: number }[]): number =>
  items.reduce((acc, i) => acc + i.amount, 0)
