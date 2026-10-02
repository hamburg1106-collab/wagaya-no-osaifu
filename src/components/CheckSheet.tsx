import { useState } from 'react'
import { CHECK_TOLERANCE } from '../config'
import type { BalanceEstimate } from '../lib/balance'
import { useCloseOnBack } from '../lib/closeOnBack'
import { formatDay, todayKey, yen } from '../lib/month'
import type { BalanceCheck } from '../types'

type Props = {
  /** アプリの記録から出した、今あるはずの残高。初回（起点が無い）は null */
  estimate: BalanceEstimate | null
  history: BalanceCheck[]
  onConfirm: (check: BalanceCheck) => void
  onCancel: () => void
}

const HISTORY_COUNT = 6

/**
 * 月1回の残高の照合。
 *
 * 通帳とカードの明細を1件ずつ突き合わせる代わりに、
 * 「通帳残高 − カードの未払い」と、アプリの記録から出した残高を比べる。
 * 記録漏れも覚えのない請求も、どちらもずれとして現れる。
 * 分かるのは「ずれがあるか」までで、どの1件かは明細を見て探す。
 */
export const CheckSheet = ({ estimate, history, onConfirm, onCancel }: Props) => {
  const [bank, setBank] = useState('')
  const [card, setCard] = useState('')

  const touched = bank !== '' || card !== ''
  const confirmDiscard = () => !touched || confirm('入力した内容を破棄します。よろしいですか？')

  useCloseOnBack(() => {
    if (!confirmDiscard()) return false
    onCancel()
    return true
  })

  const bankN = Math.round(Number(bank) || 0)
  const cardN = Math.round(Number(card) || 0)
  const actual = bankN - cardN
  const gap = estimate ? actual - estimate.amount : null
  // 通帳残高は0円もありうるが、空欄のまま確定させない
  const ready = bank !== '' && card !== ''

  const confirmCheck = () =>
    onConfirm({
      id: crypto.randomUUID(),
      date: todayKey(),
      bank: bankN,
      cardUnpaid: cardN,
      expected: estimate ? estimate.amount : null,
      createdAt: Date.now(),
    })

  return (
    <div className="sheet">
      <header className="sheet__bar">
        <button
          className="btn btn--ghost"
          onClick={() => {
            if (confirmDiscard()) onCancel()
          }}
          type="button"
        >
          やめる
        </button>
        <span className="sheet__title">通帳と照合</span>
        <span className="sheet__spacer" />
      </header>

      <div className="sheet__body">
        <p className="lead">
          月に1回、15日の拠出が入ったあとに。
          <br />
          明細を1件ずつ見る代わりに、残高だけを比べます。
        </p>

        <label className="field">
          <span className="field__label">通帳の残高（家計口座）</span>
          <input
            className="input input--amount"
            autoComplete="off"
            type="number"
            inputMode="numeric"
            value={bank}
            onChange={(e) => setBank(e.target.value)}
          />
        </label>

        <label className="field">
          <span className="field__label">カードの未払い額</span>
          <input
            className="input input--amount"
            autoComplete="off"
            type="number"
            inputMode="numeric"
            value={card}
            onChange={(e) => setCard(e.target.value)}
          />
          <span className="field__hint">
            カードアプリの「お支払い予定額」と、次回以降の請求になる利用額の合計。
            まだ引き落とされていないぶん全部です。無ければ0
          </span>
        </label>

        {ready && (
          <section className="section">
            <h2 className="section__title">結果</h2>
            <ul className="list">
              <li className="row row--plain">
                <span className="row__store">通帳 − カードの未払い</span>
                <span className="row__amount">{yen(actual)}</span>
              </li>
              {estimate && (
                <li className="row row--plain">
                  <span className="row__store">アプリの記録から出した額</span>
                  <span className="row__amount">{yen(estimate.amount)}</span>
                </li>
              )}
            </ul>
            {gap === null ? (
              <p className="note">
                初めての照合です。この額を起点にして、次回からずれを出します。
              </p>
            ) : (
              <Verdict gap={gap} />
            )}
          </section>
        )}

        {estimate && (
          <details className="details">
            <summary>アプリの記録から出した額の内訳</summary>
            <ul className="list">
              <li className="row row--plain">
                <span className="row__store">{formatDay(estimate.baseDate)}に照合した残高</span>
                <span className="row__amount">{yen(estimate.base)}</span>
              </li>
              <li className="row row--plain">
                <span className="row__store">＋ その後の拠出（15日）</span>
                <span className="row__amount">{yen(estimate.contributions)}</span>
              </li>
              <li className="row row--plain">
                <span className="row__store">＋ その後に記録した収入</span>
                <span className="row__amount">{yen(estimate.income)}</span>
              </li>
              <li className="row row--plain">
                <span className="row__store">− その後に記録した支出</span>
                <span className="row__amount">{yen(estimate.spend)}</span>
              </li>
            </ul>
          </details>
        )}

        {history.length > 0 && (
          <section className="section">
            <h2 className="section__title">これまでの照合</h2>
            <ul className="list">
              {history.slice(0, HISTORY_COUNT).map((c) => {
                const g = c.expected === null ? null : c.bank - c.cardUnpaid - c.expected
                return (
                  <li className="row row--plain" key={c.id}>
                    <span className="row__date">{formatDay(c.date)}</span>
                    <span className="row__store">{yen(c.bank - c.cardUnpaid)}</span>
                    <span className="row__amount">
                      {g === null ? '起点' : `ずれ ${g > 0 ? '+' : ''}${yen(g)}`}
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>
        )}
      </div>

      <footer className="sheet__foot">
        <button
          className="btn btn--primary btn--grow"
          onClick={confirmCheck}
          type="button"
          disabled={!ready}
        >
          この残高で確定
        </button>
      </footer>
    </div>
  )
}

/** ずれの意味を、次にやることと一緒に出す */
const Verdict = ({ gap }: { gap: number }) => {
  if (Math.abs(gap) <= CHECK_TOLERANCE) {
    return (
      <p className="note note--ok">
        ずれは {yen(Math.abs(gap))} で、記録漏れは無さそうです。確定して終わりです。
      </p>
    )
  }
  if (gap < 0) {
    return (
      <div className="warn">
        <p className="warn__text">
          通帳のほうが <strong>{yen(-gap)}</strong> 少なくなっています。
        </p>
        <p className="warn__note">
          アプリへの記録漏れか、覚えのない請求がありそうです。
          前回の照合以降のカード明細と通帳を見て、アプリに無いものを探してください。
          見つけたら記録して、もう一度照合してください。
        </p>
      </div>
    )
  }
  return (
    <div className="warn">
      <p className="warn__text">
        通帳のほうが <strong>{yen(gap)}</strong> 多くなっています。
      </p>
      <p className="warn__note">
        同じ支出を二重に記録したか、入金（返金・臨時の収入）の記録漏れがありそうです。
        履歴で同じ金額が並んでいないか見てください。
      </p>
    </div>
  )
}
