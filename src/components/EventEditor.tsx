import { useState } from 'react'
import type { LifeEvent } from '../types'

type Props = {
  event: LifeEvent
  isNew: boolean
  onSave: (event: LifeEvent) => void
  onDelete: () => void
  onCancel: () => void
}

/** よくある大物。毎回ゼロから打たなくていいように並べておく */
const PRESETS = ['車検', '固定資産税', '火災保険', '任意保険', '実家からの贈与', '出産費用', '旅行']

const REPEATS: { value: LifeEvent['repeat']; label: string }[] = [
  { value: 'once', label: '1回だけ' },
  { value: 'yearly', label: '毎年' },
  { value: 'biennial', label: '2年ごと' },
]

export const EventEditor = ({ event, isNew, onSave, onDelete, onCancel }: Props) => {
  const [draft, setDraft] = useState(event)
  const patch = (p: Partial<LifeEvent>) => setDraft((d) => ({ ...d, ...p }))

  return (
    <div className="sheet">
      <header className="sheet__bar">
        <button className="btn btn--ghost" onClick={onCancel} type="button">
          やめる
        </button>
        <span className="sheet__title">この先の予定</span>
        <span className="sheet__spacer" />
      </header>

      <div className="sheet__body">
        <label className="field">
          <span className="field__label">何に</span>
          <input
            className="input"
            autoComplete="off"
            value={draft.name}
            onChange={(e) => patch({ name: e.target.value })}
            placeholder="例）車検"
          />
        </label>

        {isNew && (
          <div className="chips">
            {PRESETS.map((p) => (
              <button
                key={p}
                className="chip"
                onClick={() => patch({ name: p })}
                type="button"
              >
                {p}
              </button>
            ))}
          </div>
        )}

        <label className="field">
          <span className="field__label">いつ</span>
          <input
            className="input"
            autoComplete="off"
            type="month"
            value={draft.month}
            onChange={(e) => patch({ month: e.target.value })}
          />
        </label>

        <div className="field">
          <span className="field__label">繰り返し</span>
          <div className="choices">
            {REPEATS.map((r) => (
              <button
                key={r.value}
                className={`btn ${(draft.repeat ?? 'once') === r.value ? 'btn--primary' : 'btn--ghost'}`}
                onClick={() => patch({ repeat: r.value })}
                type="button"
              >
                {r.label}
              </button>
            ))}
          </div>
          <span className="field__hint">
            車検は2年ごと、固定資産税や保険は毎年。入れておくと5年先まで自動で並びます
          </span>
        </div>

        <div className="field">
          <span className="field__label">出ていく／入ってくる</span>
          <div className="choices">
            <button
              className={`btn ${draft.kind === 'spend' ? 'btn--primary' : 'btn--ghost'}`}
              onClick={() => patch({ kind: 'spend' })}
              type="button"
            >
              出ていく
            </button>
            <button
              className={`btn ${draft.kind === 'income' ? 'btn--primary' : 'btn--ghost'}`}
              onClick={() => patch({ kind: 'income' })}
              type="button"
            >
              入ってくる
            </button>
          </div>
          {draft.kind === 'income' && (
            <span className="field__hint">
              ボーナスはここ。月の余剰には混ぜないので、見通しが甘くなりません
            </span>
          )}
        </div>

        <label className="field">
          <span className="field__label">いくら（家計が出すぶん）</span>
          <input
            className="input input--amount"
            autoComplete="off"
            type="number"
            inputMode="numeric"
            value={draft.amount || ''}
            onChange={(e) => patch({ amount: Math.round(Number(e.target.value) || 0) })}
          />
          <span className="field__hint">折半なら、家計から出る額だけを入れる</span>
        </label>

        <label className="field field--row">
          <input
            type="checkbox"
            checked={draft.certain}
            onChange={(e) => patch({ certain: e.target.checked })}
          />
          <span>確定している</span>
          <span className="field__hint">
            外すと「未確定」になり、見通しから抜いた場合も見られる
          </span>
        </label>

        <label className="field">
          <span className="field__label">メモ</span>
          <input
            className="input"
            autoComplete="off"
            value={draft.note}
            onChange={(e) => patch({ note: e.target.value })}
            placeholder="任意"
          />
        </label>
      </div>

      <footer className="sheet__foot">
        {!isNew && (
          <button className="btn btn--danger" onClick={onDelete} type="button">
            削除
          </button>
        )}
        <button
          className="btn btn--primary btn--grow"
          onClick={() => onSave({ ...draft, name: draft.name.trim() })}
          type="button"
          disabled={!draft.name.trim() || draft.amount <= 0}
        >
          保存
        </button>
      </footer>
    </div>
  )
}
