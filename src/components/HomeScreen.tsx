import { receiptsOfMonth, sumByBucket, sumTotal } from '../lib/aggregate'
import { formatDay, formatMonth, shiftMonth, thisMonth, yen } from '../lib/month'
import type { Receipt } from '../types'

type Props = {
  receipts: Receipt[]
  month: string
  onMonthChange: (month: string) => void
  onOpen: (receipt: Receipt) => void
}

const RECENT_COUNT = 5

/** 開いた瞬間に「今月いくら、何に」が分かる画面。見える化が目的なのでここが本体 */
export const HomeScreen = ({ receipts, month, onMonthChange, onOpen }: Props) => {
  const ofMonth = receiptsOfMonth(receipts, month)
  const buckets = sumByBucket(ofMonth)
  const total = sumTotal(ofMonth)
  const max = Math.max(1, ...buckets.map((b) => b.amount))
  const recent = ofMonth.slice(0, RECENT_COUNT)

  return (
    <div className="screen">
      <div className="monthbar">
        <button
          className="btn btn--icon"
          onClick={() => onMonthChange(shiftMonth(month, -1))}
          type="button"
          aria-label="前の月"
        >
          ‹
        </button>
        <span className="monthbar__label">{formatMonth(month)}</span>
        <button
          className="btn btn--icon"
          onClick={() => onMonthChange(shiftMonth(month, 1))}
          type="button"
          aria-label="次の月"
          disabled={month >= thisMonth()}
        >
          ›
        </button>
      </div>

      <p className="total">{yen(total)}</p>

      {buckets.length === 0 ? (
        <p className="empty">
          この月の記録はまだありません。
          <br />
          下のカメラでレシートを撮ってみてください。
        </p>
      ) : (
        <ul className="bars">
          {buckets.map((b) => (
            <li className="bar" key={b.bucket}>
              <span className="bar__name">{b.bucket}</span>
              <span className="bar__track">
                <span
                  className="bar__fill"
                  style={{ width: `${(b.amount / max) * 100}%`, background: b.color }}
                />
              </span>
              <span className="bar__amount">{yen(b.amount)}</span>
            </li>
          ))}
        </ul>
      )}

      {recent.length > 0 && (
        <section className="section">
          <h2 className="section__title">直近</h2>
          <ul className="list">
            {recent.map((r) => (
              <li key={r.id}>
                <button className="row" onClick={() => onOpen(r)} type="button">
                  <span className="row__date">{formatDay(r.date)}</span>
                  <span className="row__store">
                    {r.store}
                    {r.source === 'fixed' && <span className="tag">固定費</span>}
                  </span>
                  <span className="row__amount">{yen(sumTotal([r]))}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
