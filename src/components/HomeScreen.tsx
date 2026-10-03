import { useState } from 'react'
import { CHECK_REMIND_DAYS } from '../config'
import { receiptsOfMonth, sumByBucket, sumFixed, sumTotal } from '../lib/aggregate'
import type { BalanceEstimate } from '../lib/balance'
import { formatDay, formatMonth, monthOf, shiftMonth, thisMonth, todayKey, yen } from '../lib/month'
import type { IncomeRecord, Receipt } from '../types'
import { Donut } from './Donut'

type Props = {
  receipts: Receipt[]
  incomeRecords: IncomeRecord[]
  /** 今あるはずの家計の残高。まだ一度も残高を入れていなければ null */
  balance: BalanceEstimate | null
  /** 最後に照合した日。照合したことが無ければ null */
  lastCheck: string | null
  onOpenCheck: () => void
  month: string
  onMonthChange: (month: string) => void
  onOpen: (receipt: Receipt) => void
}

const RECENT_COUNT = 5

/** 開いた瞬間に「今月いくら、何に」が分かる画面。見える化が目的なのでここが本体 */
export const HomeScreen = ({
  receipts,
  incomeRecords,
  balance,
  lastCheck,
  onOpenCheck,
  month,
  onMonthChange,
  onOpen,
}: Props) => {
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
  // 固定費は外す。月の初めに月末の日付で前もって計上されるので、新しい順に並べると
  // いつも先頭に固まり、実際に使ったものが見えなくなる。固定費は合計の下と履歴で見られる
  const recent = ofMonth.filter((r) => r.source !== 'fixed').slice(0, RECENT_COUNT)
  const income = incomeRecords
    .filter((r) => monthOf(r.date) === month)
    .reduce((acc, r) => acc + r.amount, 0)

  return (
    <div className="screen">
      <BalanceCard balance={balance} lastCheck={lastCheck} onOpenCheck={onOpenCheck} />

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
                  <span className="row__store">{r.store}</span>
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

/** 2つの日付（YYYY-MM-DD）の間の日数 */
const daysBetween = (from: string, to: string): number =>
  Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000)

/**
 * 家計の残高（推定）。前回の照合から、その後の拠出・収入・支出の記録を足し引きした額。
 * カードの未払いは引いてあるので、「通帳の残高」とは引き落とし前のぶんだけ違う。
 */
const BalanceCard = ({
  balance,
  lastCheck,
  onOpenCheck,
}: {
  balance: BalanceEstimate | null
  lastCheck: string | null
  onOpenCheck: () => void
}) => {
  if (!balance) {
    return (
      <div className="balance">
        <p className="balance__label">家計の残高</p>
        <p className="balance__note">通帳と照合すると、ここに今の残高が出ます。</p>
        <button className="btn btn--secondary btn--block" onClick={onOpenCheck} type="button">
          通帳と照合する
        </button>
      </div>
    )
  }

  // 照合したことが無ければ、設定で残高を入れた日を基準に促す
  const since = daysBetween(lastCheck ?? balance.baseDate, todayKey())
  const due = since >= CHECK_REMIND_DAYS

  return (
    <div className="balance">
      <p className="balance__label">家計の残高（推定）</p>
      <p className="balance__amount">{yen(balance.amount)}</p>
      <p className="balance__note">
        カードの未払いを引いた額。{formatDay(balance.baseDate)}の照合からの記録で出しています
      </p>
      <button
        className={`btn btn--block ${due ? 'btn--primary' : 'btn--ghost'}`}
        onClick={onOpenCheck}
        type="button"
      >
        {due ? `前回から${since}日。通帳と照合する` : '通帳と照合する'}
      </button>
    </div>
  )
}
