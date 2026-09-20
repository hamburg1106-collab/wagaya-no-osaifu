import { sumTotal } from '../lib/aggregate'
import { formatDay, formatMonth, monthOf, yen } from '../lib/month'
import type { Receipt } from '../types'

type Props = {
  receipts: Receipt[]
  onOpen: (receipt: Receipt) => void
}

/** 全件の履歴。月ごとに見出しを入れて、タップで修正画面に入る */
export const HistoryScreen = ({ receipts, onOpen }: Props) => {
  if (receipts.length === 0) {
    return (
      <div className="screen">
        <p className="empty">まだ記録がありません。</p>
      </div>
    )
  }

  // 新しい順に並んでいるので、前の行と月が変わったところに見出しを挟む
  const rows = receipts.map((r, i) => ({
    receipt: r,
    header: i === 0 || monthOf(receipts[i - 1].date) !== monthOf(r.date) ? monthOf(r.date) : null,
  }))

  return (
    <div className="screen">
      <ul className="list">
        {rows.map(({ receipt: r, header }) => {
          return (
            <li key={r.id}>
              {header && <h2 className="list__header">{formatMonth(header)}</h2>}
              <button className="row row--tall" onClick={() => onOpen(r)} type="button">
                <span className="row__date">{formatDay(r.date)}</span>
                <span className="row__main">
                  <span className="row__store">
                    {r.store}
                    {r.source === 'fixed' && <span className="tag">固定費</span>}
                  </span>
                  <span className="row__items">
                    {r.items.map((i) => `${i.category} ${yen(i.amount)}`).join('・')}
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
