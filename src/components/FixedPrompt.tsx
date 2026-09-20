import { useState } from 'react'
import { formatMonth, yen } from '../lib/month'
import type { FixedPosting } from '../lib/store'
import type { FixedCost } from '../types'

type Props = {
  month: string
  /** 毎月同額のもの。確認だけして黙って入る */
  same: FixedCost[]
  /** 毎月変わるもの。金額を聞く */
  variable: FixedCost[]
  onSubmit: (postings: FixedPosting[]) => void
}

/**
 * 電気・水道のように「毎月必ずかかるが額は変わる」費用の金額を聞く。
 *
 * 概算を自動計上すると月合計がずっと嘘になるので、ここだけは手で入れてもらう。
 * 水道は2ヶ月に1回の請求のことがあるため、項目ごとに「今月はなし」で飛ばせる。
 */
export const FixedPrompt = ({ month, same, variable, onSubmit }: Props) => {
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [skipped, setSkipped] = useState<Record<string, boolean>>({})

  const toggleSkip = (id: string) => setSkipped((s) => ({ ...s, [id]: !s[id] }))

  const submit = () => {
    const postings: FixedPosting[] = [
      ...same.map((f) => ({ name: f.name, amount: f.amount })),
      ...variable
        .filter((f) => !skipped[f.id])
        .map((f) => ({ name: f.name, amount: Math.round(Number(amounts[f.id]) || 0) }))
        .filter((p) => p.amount > 0),
    ]
    onSubmit(postings)
  }

  // 未入力のまま進むと月合計が狂うので、飛ばす指定をしていない項目は金額必須にする
  const ready = variable.every((f) => skipped[f.id] || Number(amounts[f.id]) > 0)

  return (
    <div className="sheet">
      <header className="sheet__bar">
        <span className="sheet__spacer" />
        <span className="sheet__title">{formatMonth(month)}の固定費</span>
        <span className="sheet__spacer" />
      </header>

      <div className="sheet__body">
        <p className="lead">
          毎月かかるぶんを記録します。
          <br />
          金額が変わるものだけ入れてください。
        </p>

        {variable.map((f) => (
          <div className="field" key={f.id}>
            <span className="field__label">{f.name}</span>
            <div className="entry">
              <input
                className="input input--amount entry__amount"
                type="number"
                inputMode="numeric"
                placeholder="金額"
                value={amounts[f.id] ?? ''}
                onChange={(e) => setAmounts((a) => ({ ...a, [f.id]: e.target.value }))}
                disabled={skipped[f.id]}
              />
              <button
                className={`btn ${skipped[f.id] ? 'btn--secondary' : 'btn--ghost'}`}
                onClick={() => toggleSkip(f.id)}
                type="button"
              >
                {skipped[f.id] ? '飛ばす' : '今月はなし'}
              </button>
            </div>
          </div>
        ))}

        {same.length > 0 && (
          <section className="section">
            <h2 className="section__title">自動で入るぶん</h2>
            <ul className="list">
              {same.map((f) => (
                <li className="row row--plain" key={f.id}>
                  <span className="row__store">{f.name}</span>
                  <span className="row__amount">{yen(f.amount)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <footer className="sheet__foot">
        <button className="btn btn--primary btn--grow" onClick={submit} type="button" disabled={!ready}>
          記録する
        </button>
      </footer>
    </div>
  )
}
