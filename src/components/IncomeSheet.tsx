import { useState } from 'react'
import { INCOME_KINDS, SOLAR } from '../config'
import { useCloseOnBack } from '../lib/closeOnBack'
import { formatDay } from '../lib/month'
import type { IncomeRecord } from '../types'

type Props = {
  record: IncomeRecord
  isNew: boolean
  onSave: (record: IncomeRecord) => void
  onDelete: () => void
  onCancel: () => void
  /** 鉛筆マークから開いた新規のときだけ。支出の入力に切り替える */
  onSwitchToSpend?: () => void
}

/**
 * 収入の記録。売電のように、毎月入るが額が変わるもの。
 *
 * 夫婦の拠出は設定の「家計に入るお金」で見通しに入っているので、ここには入れない（二重になる）。
 * 売電は実績の平均が見通しに足される。「その他」は不定期なので見通しには入れない。
 */
export const IncomeSheet = ({
  record,
  isNew,
  onSave,
  onDelete,
  onCancel,
  onSwitchToSpend,
}: Props) => {
  const [draft, setDraft] = useState(record)
  const patch = (p: Partial<IncomeRecord>) => setDraft((d) => ({ ...d, ...p }))

  const changed = JSON.stringify(draft) !== JSON.stringify(record)
  const confirmDiscard = () => !changed || confirm('入力した内容を破棄します。よろしいですか？')

  useCloseOnBack(() => {
    if (!confirmDiscard()) return false
    onCancel()
    return true
  })

  const hasDate = /^\d{4}-\d{2}-\d{2}$/.test(draft.date)
  const canSave = hasDate && draft.amount > 0

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
        <span className="sheet__title">{isNew ? '手で入力' : '収入の確認'}</span>
        <span className="sheet__spacer" />
      </header>

      <div className="sheet__body">
        {onSwitchToSpend && (
          <div className="choices choices--kind">
            <button className="btn btn--ghost" onClick={onSwitchToSpend} type="button">
              支出
            </button>
            <button className="btn btn--primary" type="button" aria-pressed="true">
              収入
            </button>
          </div>
        )}

        <label className="field">
          <span className="field__label">日付</span>
          <input
            className="input"
            autoComplete="off"
            type="date"
            value={draft.date}
            onChange={(e) => patch({ date: e.target.value })}
          />
          <span className={`field__hint ${hasDate ? '' : 'is-error'}`}>
            {hasDate ? formatDay(draft.date) : '日付を入れてください'}
          </span>
        </label>

        <div className="field">
          <span className="field__label">種類</span>
          <div className="choices">
            {INCOME_KINDS.map((k) => (
              <button
                key={k}
                className={`btn ${draft.kind === k ? 'btn--primary' : 'btn--ghost'}`}
                onClick={() => patch({ kind: k })}
                type="button"
              >
                {k}
              </button>
            ))}
          </div>
          <span className="field__hint">
            {draft.kind === SOLAR
              ? '毎月の平均が見通しに足されます'
              : '見通しには入りません。決まった時期に入るものは「見通し」の予定に置いてください'}
          </span>
        </div>

        <label className="field">
          <span className="field__label">金額</span>
          <input
            className="input input--amount"
            autoComplete="off"
            type="number"
            inputMode="numeric"
            value={draft.amount || ''}
            onChange={(e) => patch({ amount: Math.round(Number(e.target.value) || 0) })}
          />
        </label>

        <label className="field">
          <span className="field__label">メモ</span>
          <input
            className="input"
            autoComplete="off"
            value={draft.note}
            onChange={(e) => patch({ note: e.target.value })}
            placeholder="任意（例: 8〜9月分）"
          />
        </label>

        <p className="note">
          夫婦それぞれの拠出（毎月の11万円）は、ここではなく設定の「家計に入るお金」で見通しに入っています。
        </p>
      </div>

      <footer className="sheet__foot">
        {!isNew && (
          <button
            className="btn btn--danger"
            onClick={() => {
              if (confirm(`この${draft.kind}の記録を削除します。よろしいですか？`)) onDelete()
            }}
            type="button"
          >
            削除
          </button>
        )}
        <button
          className="btn btn--primary btn--grow"
          onClick={() => onSave({ ...draft, note: draft.note.trim() })}
          type="button"
          disabled={!canSave}
        >
          保存
        </button>
      </footer>
    </div>
  )
}
