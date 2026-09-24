import { useState } from 'react'
import { buildForecast } from '../lib/forecast'
import { formatMonth, thisMonth, yen } from '../lib/month'
import type { IncomeSource, LifeEvent, Plan, Receipt } from '../types'
import { EventEditor } from './EventEditor'

type Props = {
  receipts: Receipt[]
  income: IncomeSource[]
  events: LifeEvent[]
  plan: Plan
  onSaveEvent: (event: LifeEvent) => void
  onDeleteEvent: (id: string) => void
  onGoSettings: () => void
}

const newEvent = (): LifeEvent => ({
  id: crypto.randomUUID(),
  name: '',
  month: thisMonth(),
  amount: 0,
  kind: 'spend',
  repeat: 'once',
  certain: true,
  note: '',
})

/**
 * この先の見通し。「このままで足りるか」に1画面で答える。
 *
 * 家計が大物（車検・固定資産税・保育料・出産費用・大学費用）を全部背負っているのに、
 * それが月々の記録からは見えないので、ここで先に置いて確かめる。
 */
export const OutlookScreen = ({
  receipts,
  income,
  events,
  plan,
  onSaveEvent,
  onDeleteEvent,
  onGoSettings,
}: Props) => {
  const [includeUncertain, setIncludeUncertain] = useState(true)
  const [editing, setEditing] = useState<LifeEvent | null>(null)

  const f = buildForecast(receipts, income, events, plan, includeUncertain)

  // 前提が欠けたまま数字を出すと嘘になるので、揃うまでは出さない。
  // とくに支出が0のまま見通しを描くと、収入がまるごと余剰になって
  // 「この先ずっと足りています」と極端に甘い答えが出てしまう。
  const missing: string[] = []
  if (f.monthlyIncome === 0) missing.push('収入')
  if (f.monthlySpend === 0) missing.push('月の支出（レシートの記録か、想定額）')
  if (plan.updatedAt === 0) missing.push('貯蓄残高')
  const notReady = missing.length > 0

  // 繰り返しを展開したあとの実際の出入りを並べる。
  // 元の予定だけを出すと「車検 2027年3月」の1行しか見えず、
  // 2年ごとに来ることが一覧からは読み取れない。
  const upcoming = f.points
    .filter((p) => p.month >= thisMonth())
    .flatMap((p) => p.events.map((event) => ({ month: p.month, event })))
    .slice(0, 40)

  return (
    <div className="screen">
      {notReady ? (
        <div className="verdict verdict--unknown">
          <p className="verdict__head">まだ見通しを出せません</p>
          <p className="verdict__note">
            足りないのは{missing.join('・')}です。
            <br />
            設定で入れると、この先いくら残るかが出ます。
          </p>
          <button className="btn btn--primary" onClick={onGoSettings} type="button">
            設定へ
          </button>
        </div>
      ) : (
        <div className={`verdict ${f.shortfallMonth ? 'verdict--bad' : 'verdict--ok'}`}>
          <p className="verdict__head">
            {f.shortfallMonth
              ? `${formatMonth(f.shortfallMonth)}に足りなくなります`
              : 'この先5年は足りています'}
          </p>
          <p className="verdict__note">
            月の余剰 {yen(f.monthlySurplus)}
            {f.monthlySurplus < 0 && '（毎月減っています）'}
          </p>
          {/*
            ここが赤くなることの実際の意味を書いておく。
            家計が足りなくなったら夫婦で折半して追加拠出する取り決めなので、
            「残高が尽きる月」＝「追加拠出が要る月」。数字だけだと繋がらない。
          */}
          {f.shortfallMonth && (
            <p className="verdict__note">
              このとき、二人で折半して追加で入れる必要が出ます。
            </p>
          )}
        </div>
      )}

      <section className="section">
        <h2 className="section__title">見通しの前提</h2>
        <ul className="list">
          <li className="row row--plain">
            <span className="row__store">収入</span>
            <span className="row__amount">{yen(f.monthlyIncome)}</span>
          </li>
          <li className="row row--plain">
            <span className="row__store">
              支出
              <span className="tag">
                {f.spendFromActual ? `実績${f.actualMonths}ヶ月の平均` : '手で置いた想定'}
              </span>
            </span>
            <span className="row__amount">{yen(f.monthlySpend)}</span>
          </li>
        </ul>
        {!f.spendFromActual && (
          <p className="note">
            まだ先月ぶんの記録がありません。レシートが貯まると、ここが実績に切り替わります。
          </p>
        )}
      </section>

      {!notReady && <BalanceChart points={f.points} />}

      <section className="section">
        <div className="section__row">
          <h2 className="section__title">この先の出入り</h2>
          <label className="switch">
            <input
              type="checkbox"
              checked={includeUncertain}
              onChange={(e) => setIncludeUncertain(e.target.checked)}
            />
            <span>未確定も含める</span>
          </label>
        </div>

        {upcoming.length === 0 ? (
          <p className="note">
            まだ何も入っていません。車検・固定資産税・保育料・出産費用・大学費用など、
            大きな出費を置いてみてください。
          </p>
        ) : (
          <ul className="list">
            {upcoming.map(({ month, event: e }) => (
              <li key={`${e.id}-${month}`}>
                <button className="row" onClick={() => setEditing(e)} type="button">
                  <span className="row__date">{month.replace('-', '/')}</span>
                  <span className="row__store">
                    {e.name}
                    {!e.certain && <span className="tag">未確定</span>}
                    {e.repeat === 'yearly' && <span className="tag">毎年</span>}
                    {e.repeat === 'biennial' && <span className="tag">2年ごと</span>}
                  </span>
                  <span className={`row__amount ${e.kind === 'income' ? 'is-income' : ''}`}>
                    {e.kind === 'income' ? '+' : '−'}
                    {yen(e.amount)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <button
          className="btn btn--secondary btn--block"
          onClick={() => setEditing(newEvent())}
          type="button"
        >
          ＋ 予定を足す
        </button>
      </section>

      {editing && (
        <EventEditor
          event={editing}
          isNew={!events.some((e) => e.id === editing.id)}
          onSave={(e) => {
            onSaveEvent(e)
            setEditing(null)
          }}
          onDelete={() => {
            onDeleteEvent(editing.id)
            setEditing(null)
          }}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  )
}

/**
 * 残高の折れ線。60点あるのでSVGで1本引くだけにする。
 * 目盛りは出さず、ゼロ線と「いつ尽きるか」だけが読めればよい。
 */
const BalanceChart = ({ points }: { points: { month: string; balance: number }[] }) => {
  if (points.length < 2) return null

  const W = 320
  const H = 110
  const values = points.map((p) => p.balance)
  const max = Math.max(...values, 0)
  const min = Math.min(...values, 0)
  const span = max - min || 1

  const x = (i: number) => (i / (points.length - 1)) * W
  const y = (v: number) => H - ((v - min) / span) * H
  const line = points.map((p, i) => `${x(i).toFixed(1)},${y(p.balance).toFixed(1)}`).join(' ')
  const zeroY = y(0)

  return (
    <section className="section">
      <h2 className="section__title">残高の見通し</h2>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img">
        <title>この先の貯蓄残高の推移</title>
        {/* ゼロ線。これを割ったら足りない */}
        <line x1="0" y1={zeroY} x2={W} y2={zeroY} className="chart__zero" />
        <polyline points={line} className="chart__line" />
      </svg>
      <div className="chart__axis">
        <span>{points[0].month.replace('-', '/')}</span>
        <span>{points[points.length - 1].month.replace('-', '/')}</span>
      </div>
    </section>
  )
}
