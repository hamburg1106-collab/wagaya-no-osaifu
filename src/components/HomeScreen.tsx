import { useState } from 'react'
import { receiptsOfMonth, sumByBucket, sumFixed, sumTotal } from '../lib/aggregate'
import { formatDay, formatMonth, monthOf, shiftMonth, thisMonth, yen } from '../lib/month'
import type { IncomeRecord, Receipt } from '../types'
import { Donut } from './Donut'

type Props = {
  receipts: Receipt[]
  incomeRecords: IncomeRecord[]
  month: string
  onMonthChange: (month: string) => void
  onOpen: (receipt: Receipt) => void
}

const RECENT_COUNT = 5

/** 開いた瞬間に「今月いくら、何に」が分かる画面。見える化が目的なのでここが本体 */
export const HomeScreen = ({ receipts, incomeRecords, month, onMonthChange, onOpen }: Props) => {
  /**
   * 固定費を除いて円を描くか。
   * 土地ローンが「住まい」として円の大半を占めると、やりくりで動かせるお金の内訳が読めない。
   * 画面を開くたびに全部込みから始める（合計と円が食い違って見えないように）。
   */
  const [excludeFixed, setExcludeFixed] = useState(false)

  const ofMonth = receiptsOfMonth(receipts, month)
  const total = sumTotal(ofMonth)
  const fixed = sumFixed(ofMonth)
  // 月を送った先が固定費だけの月なら、除くと空になるので全部込みに戻して見せる
  const canExclude = fixed > 0 && fixed < total
  const exclude = excludeFixed && canExclude
  const buckets = sumByBucket(ofMonth, exclude)
  const shown = exclude ? total - fixed : total
  const recent = ofMonth.slice(0, RECENT_COUNT)
  const income = incomeRecords
    .filter((r) => monthOf(r.date) === month)
    .reduce((acc, r) => acc + r.amount, 0)

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
      {(fixed > 0 || income > 0) && (
        <p className="total__sub">
          {fixed > 0 && <span>うち固定費 {yen(fixed)}</span>}
          {income > 0 && <span className="is-income">収入 +{yen(income)}</span>}
        </p>
      )}

      {canExclude && (
        <div className="choices choices--kind">
          <button
            className={`btn ${exclude ? 'btn--ghost' : 'btn--primary'}`}
            onClick={() => setExcludeFixed(false)}
            type="button"
            aria-pressed={!exclude}
          >
            全部
          </button>
          <button
            className={`btn ${exclude ? 'btn--primary' : 'btn--ghost'}`}
            onClick={() => setExcludeFixed(true)}
            type="button"
            aria-pressed={exclude}
          >
            固定費を除く
          </button>
        </div>
      )}

      {buckets.length === 0 ? (
        <p className="empty">
          この月の記録はまだありません。
          <br />
          下のカメラでレシートを撮ってみてください。
        </p>
      ) : (
        <>
          {exclude && <p className="note">固定費を除いた {yen(shown)} の内訳です。</p>}
          <Donut buckets={buckets} total={shown} />
        </>
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
