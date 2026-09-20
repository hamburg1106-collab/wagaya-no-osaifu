import type { CATEGORIES, FIXED_BUCKET } from './config'

export type Category = (typeof CATEGORIES)[number]

/** 集計の入れ物。カテゴリ10個＋固定費の計11本 */
export type Bucket = Category | typeof FIXED_BUCKET

/** レシート1枚の中の1行。「食費 3,800円」のような単位 */
export type Entry = {
  category: Bucket
  amount: number
}

/** 記録の出どころ。固定費は自動計上されたものなので履歴で見分けたい */
export type Source = 'receipt' | 'manual' | 'fixed'

export type Receipt = {
  id: string
  /** YYYY-MM-DD */
  date: string
  store: string
  /** レシートに印字された合計。内訳の合計とずれることがあるので別に持つ */
  total: number
  items: Entry[]
  source: Source
  /** 並び替え用。Firestoreのサーバ時刻ではなく端末時刻でよい（順序が多少ずれても困らない） */
  createdAt: number
}

/** 固定費テンプレ。毎月同額のものと、毎月金額を聞くものがある */
export type FixedCost = {
  id: string
  name: string
  /** same=毎月同額（黙って計上） / variable=毎月変わる（起動時に金額を聞く） */
  type: 'same' | 'variable'
  /** type==='same' のときだけ使う */
  amount: number
  /** 計上を始める月（YYYY-MM）。これより前の月には遡らない */
  startMonth: string
  active: boolean
}

/** Geminiがレシートから読み取った内容。保存前の下書き */
export type ParsedReceipt = {
  date: string
  store: string
  total: number
  items: { category: Category; amount: number }[]
}
