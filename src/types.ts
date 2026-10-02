import type { CATEGORIES, INCOME_KINDS, LEGACY_FIXED } from './config'

export type Category = (typeof CATEGORIES)[number]

/** 集計の入れ物。カテゴリに加えて、以前の「固定費」カテゴリが古い記録に残っている */
export type Bucket = Category | typeof LEGACY_FIXED

/** レシート1枚の中の1行。「食費 3,800円」のような単位 */
export type Entry = {
  category: Bucket
  amount: number
  /**
   * 固定費の印。Zaimから取り込んだ住まい・水道光熱・通信に付く。
   * アプリが自動計上した固定費は記録ごと source='fixed' で分かるので付けなくてよいが、付けても害はない。
   * 無いときはフィールドごと省く（Firestoreは undefined を書けない）。
   */
  fixed?: true
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
  /**
   * 計上するカテゴリ。おむつサブスクなら「子ども」、土地ローンなら「住まい」。
   * 2026-10-01より前に作ったものには無いので、名前から推測して補う（lib/fixed.ts）
   */
  category?: Category
}

export type IncomeKind = (typeof INCOME_KINDS)[number]

/**
 * 記録した収入。売電のように毎月入るが額が変わるもの。
 * 支出（Receipt）とは別のコレクションに置く。混ぜると、支出を合計する箇所すべてで
 * 収入を除き忘れる危険があるため。
 */
export type IncomeRecord = {
  id: string
  /** YYYY-MM-DD */
  date: string
  kind: IncomeKind
  amount: number
  note: string
  createdAt: number
}

/**
 * 家計に入ってくるお金。
 *
 * ここは**給料の額ではなく、家計に入れている額**。
 * 夫婦それぞれが月11万円を家計へ拠出する取り決めで、個人の収入や個人の支出は
 * このアプリの対象外（そちらは「これ買っていい」が見る）。
 *
 * 固定費と違って毎月の記録は作らない。見通しの前提にしか使わないので、
 * 給料日ごとに入力させると「入力がめんどい」を作り直すことになる。
 */
export type IncomeSource = {
  id: string
  name: string
  /** 毎月、家計に入る額 */
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
  /**
   * 繰り返し。once=1回だけ / yearly=毎年 / biennial=2年ごと。
   *
   * 車検は2年ごと、固定資産税・火災保険・任意保険・実家からの贈与は毎年。
   * これが無いと5年ぶんの見通しを作るのに同じ予定を何度も手入力することになる。
   */
  repeat: 'once' | 'yearly' | 'biennial'
  /** 確定しているか。未確定のものを外した見通しも見せるために持つ */
  certain: boolean
  note: string
}

/**
 * 月1回の残高の照合。通帳とカードの明細を1件ずつ突き合わせる代わりに、残高だけを比べる。
 * 確定すると「通帳残高 − カードの未払い」が次の起点（Plan.balance）になる。
 */
export type BalanceCheck = {
  id: string
  /** YYYY-MM-DD */
  date: string
  /** 通帳（家計口座）の残高 */
  bank: number
  /** カードの、まだ引き落とされていない利用額 */
  cardUnpaid: number
  /** アプリの記録から出した、あるはずの残高。初回は起点が無いので null */
  expected: number | null
  createdAt: number
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
