import { LEGACY_FIXED } from '../config'
import { isFixedItem, sumTotal } from '../lib/aggregate'
import { formatDay, formatMonth, monthOf, yen } from '../lib/month'
import type { IncomeRecord, Receipt } from '../types'

type Props = {
  receipts: Receipt[]
  incomeRecords: IncomeRecord[]
  onOpen: (receipt: Receipt) => void
  onOpenIncome: (record: IncomeRecord) => void
}

type Row =
  | { type: 'spend'; date: string; createdAt: number; receipt: Receipt }
  | { type: 'income'; date: string; createdAt: number; record: IncomeRecord }

/** 全件の履歴。支出と収入を日付順に混ぜ、月ごとに見出しを入れる。タップで修正画面に入る */
export const HistoryScreen = ({ receipts, incomeRecords, onOpen, onOpenIncome }: Props) => {
  const all: Row[] = [
    ...receipts.map((r) => ({
      type: 'spend' as const,
      date: r.date,
      createdAt: r.createdAt,
      receipt: r,
    })),
    ...incomeRecords.map((r) => ({
      type: 'income' as const,
      date: r.date,
      createdAt: r.createdAt,
      record: r,
    })),
  ].sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : b.date < a.date ? -1 : 1))

  if (all.length === 0) {
    return (
      <div className="screen">
        <p className="empty">まだ記録がありません。</p>
      </div>
    )
  }

  return (
    <div className="screen">
      <ul className="list">
        {all.map((row, i) => {
          // 新しい順に並んでいるので、前の行と月が変わったところに見出しを挟む
          const header =
            i === 0 || monthOf(all[i - 1].date) !== monthOf(row.date) ? monthOf(row.date) : null

          if (row.type === 'income') {
            const r = row.record
            return (
              <li key={`income-${r.id}`}>
                {header && <h2 className="list__header">{formatMonth(header)}</h2>}
                <button className="row row--tall" onClick={() => onOpenIncome(r)} type="button">
                  <span className="row__date">{formatDay(r.date)}</span>
                  <span className="row__main">
                    <span className="row__store">
                      {r.kind}
                      <span className="tag">収入</span>
                    </span>
                    {r.note && <span className="row__items">{r.note}</span>}
                  </span>
                  <span className="row__amount is-income">+{yen(r.amount)}</span>
                </button>
              </li>
            )
          }

          const r = row.receipt
          const hasFixedLine = r.source !== 'fixed' && r.items.some((it) => isFixedItem(r, it))
          return (
            <li key={r.id}>
              {header && <h2 className="list__header">{formatMonth(header)}</h2>}
              <button className="row row--tall" onClick={() => onOpen(r)} type="button">
                <span className="row__date">{formatDay(r.date)}</span>
                <span className="row__main">
                  <span className="row__store">
                    {r.store}
                    {r.source === 'fixed' && <span className="tag">固定費</span>}
                    {r.source === 'import' && <span className="tag">1ヶ月ぶん</span>}
                  </span>
                  <span className="row__items">
                    {r.items
                      .map(
                        (it) =>
                          `${it.category}${hasFixedLine && it.category !== LEGACY_FIXED && isFixedItem(r, it) ? '（固定）' : ''} ${yen(it.amount)}`,
                      )
                      .join('・')}
                  </span>
                </span>
                <span className="row__amount">{yen(sumTotal([r]))}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
