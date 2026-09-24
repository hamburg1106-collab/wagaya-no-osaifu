import { FIXED_BUCKET } from '../config'
import type { Bucket, Receipt } from '../types'

/**
 * ZaimのCSVを月ごとの集計に変える。
 *
 * 明細を1件ずつ持たない。目的は見通しの前提（月いくら使うか）を実績にすることで、
 * そのためには月の合計があれば足りる。明細はZaimに残っているので二重に持たない。
 * 1年ぶんでも12件にしかならないので、履歴もアプリの動きも重くならない。
 */

/**
 * Zaimの既定カテゴリ → このアプリの集計先。
 *
 * 通信・水道光熱・住宅・保険は固定費にまとめる。このアプリでは
 * それらを固定費として別枠で扱っているので、揃えないと推移が比べられなくなる。
 */
const CATEGORY_MAP: Record<string, Bucket> = {
  食費: '食費',
  日用雑貨: '日用品',
  日用品: '日用品',
  交通: '交通',
  自動車: '交通',
  '健康・医療': '医療・薬',
  '医療・健康': '医療・薬',
  '衣服・美容': '衣類',
  '教育・教養': '娯楽・趣味',
  '趣味・娯楽': '娯楽・趣味',
  子育て: '子ども',
  子ども: '子ども',
  交際費: '交際費',
  大型出費: 'その他',
  '税・社会保険': 'その他',
  その他: 'その他',
  通信: FIXED_BUCKET,
  '水道・光熱': FIXED_BUCKET,
  住宅: FIXED_BUCKET,
  保険: FIXED_BUCKET,
}

/** 振替など、支出ではない行。合計に入れると二重計上になる */
const NOT_SPENDING = new Set(['現金・カード', '振替', 'その他振替'])

export type MonthSummary = {
  /** YYYY-MM */
  month: string
  /** 集計先ごとの合計 */
  byBucket: Map<Bucket, number>
  total: number
}

export type ImportResult = {
  months: MonthSummary[]
  /** 読み取った支出の行数 */
  rows: number
  /** 振替などで飛ばした行数 */
  skipped: number
  /** 対応表に無かったカテゴリ。「その他」に入れたことを伝えるため */
  unknown: string[]
  /** 参考表示用。収入は月平均のテンプレなので自動では入れない */
  incomeMonthlyAverage: number
}

export class ZaimImportError extends Error {}

/**
 * 文字コードを判定して読む。
 * ZaimのCSVはUTF-8のこともShift_JISのこともあるので、
 * まずUTF-8で読んで、文字化け（U+FFFD）が出たらShift_JISで読み直す。
 */
export const decodeCsv = (buffer: ArrayBuffer): string => {
  const utf8 = new TextDecoder('utf-8').decode(buffer)
  if (!utf8.includes('�')) return utf8.replace(/^﻿/, '')
  try {
    return new TextDecoder('shift_jis').decode(buffer)
  } catch {
    return utf8.replace(/^﻿/, '')
  }
}

/** 引用符とその中の改行・カンマを扱える最小限のCSV解析 */
export const parseCsv = (text: string): string[][] => {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let i = 0; i < text.length; i += 1) {
    const c = text[i]

    if (quoted) {
      if (c === '"') {
        // 連続する二重引用符は、引用符そのもの
        if (text[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          quoted = false
        }
      } else {
        field += c
      }
      continue
    }

    if (c === '"') {
      quoted = true
    } else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      // CRLFで2回区切らないようにする
      if (c === '\r' && text[i + 1] === '\n') i += 1
      row.push(field)
      field = ''
      rows.push(row)
      row = []
    } else {
      field += c
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

/** 列の位置ではなく見出しの名前で探す。Zaimの列構成が変わっても壊れないように */
const findColumn = (header: string[], ...names: string[]): number =>
  header.findIndex((h) => names.some((n) => h.trim() === n))

/** 「2026-08-15」「2026/8/15」どちらでも YYYY-MM を取り出す */
const monthOfCell = (cell: string): string | null => {
  const m = cell.trim().match(/^(\d{4})[-/](\d{1,2})/)
  if (!m) return null
  return `${m[1]}-${m[2].padStart(2, '0')}`
}

/** 「1,234」「¥1,234」「-1234」を数値にする */
const toAmount = (cell: string): number => {
  const n = Number(cell.replace(/[,¥￥\s]/g, ''))
  return Number.isFinite(n) ? n : 0
}

export const summarizeZaim = (text: string): ImportResult => {
  const rows = parseCsv(text)
  if (rows.length < 2) throw new ZaimImportError('CSVの中身が読み取れませんでした')

  const header = rows[0]
  const iDate = findColumn(header, '日付')
  const iCategory = findColumn(header, 'カテゴリ')
  const iSpend = findColumn(header, '支出')
  const iIncome = findColumn(header, '収入')

  if (iDate < 0 || iCategory < 0 || iSpend < 0) {
    throw new ZaimImportError(
      'ZaimのCSVではないようです（「日付」「カテゴリ」「支出」の列が見つかりません）',
    )
  }

  const byMonth = new Map<string, Map<Bucket, number>>()
  const incomeByMonth = new Map<string, number>()
  const unknown = new Set<string>()
  let counted = 0
  let skipped = 0

  for (const row of rows.slice(1)) {
    const month = monthOfCell(row[iDate] ?? '')
    if (!month) {
      skipped += 1
      continue
    }

    if (iIncome >= 0) {
      const income = toAmount(row[iIncome] ?? '')
      if (income > 0) incomeByMonth.set(month, (incomeByMonth.get(month) ?? 0) + income)
    }

    const spend = toAmount(row[iSpend] ?? '')
    const category = (row[iCategory] ?? '').trim()

    // 支出が無い行（収入・振替・残高調整）は集計しない
    if (spend <= 0 || NOT_SPENDING.has(category)) {
      skipped += 1
      continue
    }

    const bucket = CATEGORY_MAP[category]
    if (!bucket && category) unknown.add(category)

    const target = bucket ?? 'その他'
    const buckets = byMonth.get(month) ?? new Map<Bucket, number>()
    buckets.set(target, (buckets.get(target) ?? 0) + spend)
    byMonth.set(month, buckets)
    counted += 1
  }

  if (counted === 0) throw new ZaimImportError('支出の行が1件も見つかりませんでした')

  const months: MonthSummary[] = [...byMonth.entries()]
    .map(([month, byBucket]) => ({
      month,
      byBucket,
      total: [...byBucket.values()].reduce((a, b) => a + b, 0),
    }))
    .sort((a, b) => a.month.localeCompare(b.month))

  const incomeTotal = [...incomeByMonth.values()].reduce((a, b) => a + b, 0)
  const incomeMonthlyAverage =
    incomeByMonth.size > 0 ? Math.round(incomeTotal / incomeByMonth.size) : 0

  return { months, rows: counted, skipped, unknown: [...unknown], incomeMonthlyAverage }
}

/**
 * 集計を記録に変える。
 *
 * IDを import-YYYY-MM に固定しているので、取り込み直しても増えずに上書きされる。
 * 日付は月末にする。1日にすると履歴の先頭に固まって見づらい。
 */
export const toReceipts = (months: MonthSummary[]): Receipt[] =>
  months.map((m) => {
    const [y, mm] = m.month.split('-').map(Number)
    const lastDay = new Date(y, mm, 0).getDate()
    return {
      id: `import-${m.month}`,
      date: `${m.month}-${String(lastDay).padStart(2, '0')}`,
      store: 'Zaimから取り込み',
      total: m.total,
      items: [...m.byBucket.entries()]
        .filter(([, amount]) => amount > 0)
        .map(([category, amount]) => ({ category, amount: Math.round(amount) })),
      source: 'import' as const,
      createdAt: Date.now(),
    }
  })
