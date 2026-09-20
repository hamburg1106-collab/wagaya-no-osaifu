import { BUCKET_COLORS, CATEGORIES, FIXED_BUCKET } from '../config'
import { receiptsOfMonth, sumByBucket, sumTotal } from '../lib/aggregate'
import { formatMonth, shiftMonth, thisMonth, yen } from '../lib/month'
import type { Bucket, Receipt } from '../types'

type Props = {
  receipts: Receipt[]
}

const MONTHS = 6

/** 直近6ヶ月の合計と、カテゴリ別の内訳。データが溜まってから効いてくる画面 */
export const TrendScreen = ({ receipts }: Props) => {
  const months = Array.from({ length: MONTHS }, (_, i) => shiftMonth(thisMonth(), i - MONTHS + 1))
  const rows = months.map((m) => {
    const ofMonth = receiptsOfMonth(receipts, m)
    return { month: m, total: sumTotal(ofMonth), buckets: sumByBucket(ofMonth) }
  })
  const max = Math.max(1, ...rows.map((r) => r.total))

  /** 積み上げ棒の並び。固定費を左に固定する */
  const order: Bucket[] = [FIXED_BUCKET, ...CATEGORIES]

  if (rows.every((r) => r.total === 0)) {
    return (
      <div className="screen">
        <p className="empty">
          まだ推移を出せるほど記録がありません。
          <br />
          何ヶ月か貯まると、ここで変化が見えるようになります。
        </p>
      </div>
    )
  }

  return (
    <div className="screen">
      <h2 className="section__title">月ごとの合計</h2>
      <ul className="bars">
        {rows.map((r) => (
          <li className="bar bar--stack" key={r.month}>
            <span className="bar__name">{formatMonth(r.month).replace(/^\d+年/, '')}</span>
            <span className="bar__track">
              {order.map((b) => {
                const amount = r.buckets.find((x) => x.bucket === b)?.amount ?? 0
                if (amount === 0) return null
                return (
                  <span
                    key={b}
                    className="bar__seg"
                    style={{
                      width: `${(amount / max) * 100}%`,
                      background: BUCKET_COLORS[b] ?? '#a0a0a0',
                    }}
                    title={`${b} ${yen(amount)}`}
                  />
                )
              })}
            </span>
            <span className="bar__amount">{r.total === 0 ? '—' : yen(r.total)}</span>
          </li>
        ))}
      </ul>

      <h2 className="section__title">カテゴリ別</h2>
      <div className="tablewrap">
        <table className="table">
          <thead>
            <tr>
              <th>　</th>
              {rows.map((r) => (
                <th key={r.month}>{Number(r.month.slice(5))}月</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {order.map((b) => {
              const cells = rows.map((r) => r.buckets.find((x) => x.bucket === b)?.amount ?? 0)
              if (cells.every((c) => c === 0)) return null
              return (
                <tr key={b}>
                  <th scope="row">
                    <span className="swatch" style={{ background: BUCKET_COLORS[b] }} />
                    {b}
                  </th>
                  {cells.map((c, i) => (
                    // 列は月で固定なので添字キーでよい
                    // eslint-disable-next-line react/no-array-index-key
                    <td key={i}>{c === 0 ? '—' : c.toLocaleString('ja-JP')}</td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
