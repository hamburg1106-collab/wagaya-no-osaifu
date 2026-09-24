import type { CATEGORIES, FIXED_BUCKET } from './config'

export type Category = (typeof CATEGORIES)[number]

/** 集計の入れ物。カテゴリ10個＋固定費の計11本 */
export type Bucket = Category | typeof FIXED_BUCKET

/** レシート1枚の中の1行。「食費 3,800円」のような単位 */
export type Entry = {
  category: Bucket
  amount: number
}

/**
 * 記録の出どころ。履歴で見分けたい。
 * import は Zaim から取り込んだ月ごとの集計で、1ヶ月ぶんが1件にまとまっている。
 */
export type Source = 'receipt' | 'manual' | 'fixed' | 'import'

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

/**
 * 家計の収入。月の平均額を1本ずつ登録する。
 *
 * 固定費と違って毎月の記録は作らない。見通しの前提にしか使わないので、
 * 給料日ごとに入力させると「入力がめんどい」を作り直すことになる。
 * 残業で上下するぶんは均した手取りを入れてもらう。
 */
export type IncomeSource = {
  id: string
  name: string
  /** 月あたりの手取り平均 */
  amount: number
  active: boolean
}

/**
 * ライフイベント。将来の大きな出入り。
 * ボーナスのような臨時収入も kind='income' でここに置く（月の余剰には混ぜない）。
 */
export type LifeEvent = {
  id: string
  name: string
  /** YYYY-MM */
  month: string
  /** 家計が出す額（kind='income' なら受け取る額）。常に正の数 */
  amount: number
  kind: 'spend' | 'income'
  /** 確定しているか。未確定のものを外した見通しも見せるために持つ */
  certain: boolean
  note: string
}

/** 見通しの前提。1ドキュメントだけ */
export type Plan = {
  /** 家計の貯蓄残高 */
  balance: number
  /** その残高がいつ時点か YYYY-MM-DD */
  balanceAsOf: string
  /** 記録が貯まるまで使う、月の支出の想定額。実績が1ヶ月でもあればそちらを優先する */
  assumedSpend: number
  updatedAt: number
}

/** Geminiがレシートから読み取った内容。保存前の下書き */
export type ParsedReceipt = {
  date: string
  store: string
  total: number
  items: { category: Category; amount: number }[]
}
