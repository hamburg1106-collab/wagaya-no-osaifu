import { LEGACY_FIXED } from '../config'
import type { Category, FixedCost, Receipt } from '../types'

/**
 * 名前からカテゴリを推測する。
 * 固定費にカテゴリを持たせる前（2026-10-01より前）に作ったテンプレと、その計上記録のため。
 * 外れていたら設定の固定費から選び直せる。
 */
const guessCategory = (name: string): Category => {
  if (/おむつ|オムツ|保育|学童|習い/.test(name)) return '子ども'
  if (/ローン|家賃|管理費|住宅|土地/.test(name)) return '住まい'
  if (/電気|ガス|水道/.test(name)) return '水道光熱'
  if (/ネット|携帯|スマホ|通信|回線|wi-?fi/i.test(name)) return '通信'
  if (/車|駐車場|ガソリン/.test(name)) return '車'
  return 'その他'
}

export const categoryOfFixed = (cost: Pick<FixedCost, 'name' | 'category'>): Category =>
  cost.category ?? guessCategory(cost.name)

/**
 * 以前の「固定費」カテゴリで自動計上された記録を、中身に合ったカテゴリへ付け替えたもの。
 * 書き直しが要る記録だけを返す。Zaimから取り込んだぶんは分けられないので触らない。
 */
export const relabelLegacyFixed = (receipts: Receipt[], costs: FixedCost[]): Receipt[] =>
  receipts
    .filter((r) => r.source === 'fixed' && r.items.some((i) => i.category === LEGACY_FIXED))
    .map((r) => {
      const cost = costs.find((c) => c.name === r.store)
      const category = cost ? categoryOfFixed(cost) : guessCategory(r.store)
      return {
        ...r,
        items: r.items.map((i) =>
          i.category === LEGACY_FIXED ? { category, amount: i.amount, fixed: true as const } : i,
        ),
      }
    })
