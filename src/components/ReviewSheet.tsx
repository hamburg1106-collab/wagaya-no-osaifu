import { useState } from 'react'
import { CATEGORIES } from '../config'
import { sumItems } from '../lib/aggregate'
import { useCloseOnBack } from '../lib/closeOnBack'
import { formatDay, todayKey, yen } from '../lib/month'
import type { Category, Entry, Receipt } from '../types'

type Props = {
  /** 解析結果・編集対象。新規手入力のときは undefined */
  initial?: Receipt
  /** レシートを撮ったあとの確認なら true。保存後に「続けて撮る」を出す */
  fromCamera: boolean
  onSave: (receipt: Receipt, thenCamera: boolean) => void
  onDelete?: () => void
  onCancel: () => void
}

const emptyReceipt = (): Receipt => ({
  id: crypto.randomUUID(),
  date: todayKey(),
  store: '',
  total: 0,
  items: [{ category: 'その他', amount: 0 }],
  source: 'manual',
  createdAt: Date.now(),
})

/**
 * 確認・修正画面。
 *
 * レシート解析後の確認、履歴からの修正、レシートなしの手入力の3つを1つで賄う。
 * 専用の手入力画面を別に作らないのは、項目がまったく同じで二重管理になるため。
 */
export const ReviewSheet = ({ initial, fromCamera, onSave, onDelete, onCancel }: Props) => {
  const [start] = useState<Receipt>(() => initial ?? emptyReceipt())
  const [receipt, setReceipt] = useState<Receipt>(start)

  /**
   * 閉じる前に聞くか。撮った直後は手を入れていなくても聞く。
   * 読み取りに数秒待っているので、1タップで捨てると撮り直しになる
   */
  const worthKeeping = fromCamera || JSON.stringify(receipt) !== JSON.stringify(start)
  const confirmDiscard = () => !worthKeeping || confirm('入力した内容を破棄します。よろしいですか？')

  const cancel = () => {
    if (confirmDiscard()) onCancel()
  }

  useCloseOnBack(() => {
    if (!confirmDiscard()) return false
    onCancel()
    return true
  })

  const itemsSum = sumItems(receipt.items)
  const mismatch = receipt.total !== itemsSum
  const isFixed = receipt.source === 'fixed'

  const patch = (p: Partial<Receipt>) => setReceipt((r) => ({ ...r, ...p }))

  const patchItem = (index: number, p: Partial<Entry>) =>
    setReceipt((r) => ({
      ...r,
      items: r.items.map((it, i) => (i === index ? { ...it, ...p } : it)),
    }))

  const addItem = () =>
    setReceipt((r) => ({
      ...r,
      // 余りが出ていればその額を初期値にする。1行しかないレシートを分けるときに楽
      items: [...r.items, { category: 'その他', amount: Math.max(0, r.total - sumItems(r.items)) }],
    }))

  const removeItem = (index: number) =>
    setReceipt((r) => ({ ...r, items: r.items.filter((_, i) => i !== index) }))

  /** 合計のほうを内訳に合わせる。レシートの読み取りミスは合計側に出やすい */
  const fitTotal = () => patch({ total: itemsSum })

  const save = (thenCamera: boolean) => {
    onSave(
      {
        ...receipt,
        store: receipt.store.trim() || '（店名なし）',
        items: receipt.items.filter((it) => it.amount !== 0),
      },
      thenCamera,
    )
  }

  // iPhoneの日付欄には「消去」がある。空のまま保存すると、どの月にも数えられず消えて見える
  const hasDate = /^\d{4}-\d{2}-\d{2}$/.test(receipt.date)
  const canSave = hasDate && receipt.items.some((it) => it.amount !== 0)

  return (
    <div className="sheet">
      <header className="sheet__bar">
        <button className="btn btn--ghost" onClick={cancel} type="button">
          やめる
        </button>
        <span className="sheet__title">{initial ? '内容の確認' : '手で入力'}</span>
        <span className="sheet__spacer" />
      </header>

      <div className="sheet__body">
        <label className="field">
          <span className="field__label">日付</span>
          <input
            className="input"
            autoComplete="off"
            type="date"
            value={receipt.date}
            onChange={(e) => patch({ date: e.target.value })}
          />
          <span className={`field__hint ${hasDate ? '' : 'is-error'}`}>
            {hasDate ? formatDay(receipt.date) : '日付を入れてください'}
          </span>
        </label>

        <label className="field">
          <span className="field__label">店名</span>
          <input
            className="input"
            autoComplete="off"
            value={receipt.store}
            onChange={(e) => patch({ store: e.target.value })}
            placeholder="例）○○スーパー"
          />
        </label>

        <label className="field">
          <span className="field__label">合計</span>
          <input
            className="input input--amount"
            autoComplete="off"
            type="number"
            inputMode="numeric"
            value={receipt.total || ''}
            onChange={(e) => patch({ total: Math.round(Number(e.target.value) || 0) })}
          />
        </label>

        <div className="field">
          <span className="field__label">内訳</span>
          {receipt.items.map((item, i) => (
            // 行は並べ替えないので添字をキーにしてよい
            // eslint-disable-next-line react/no-array-index-key
            <div className="entry" key={i}>
              <select
                className="input entry__cat"
                value={item.category}
                onChange={(e) => patchItem(i, { category: e.target.value as Category })}
                disabled={isFixed}
              >
                {isFixed && <option value={item.category}>{item.category}</option>}
                {!isFixed &&
                  CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
              </select>
              <input
                className="input input--amount entry__amount"
                autoComplete="off"
                type="number"
                inputMode="numeric"
                value={item.amount || ''}
                onChange={(e) => patchItem(i, { amount: Math.round(Number(e.target.value) || 0) })}
              />
              <button
                className="btn btn--icon"
                onClick={() => removeItem(i)}
                type="button"
                disabled={receipt.items.length <= 1}
                aria-label="この行を消す"
              >
                ×
              </button>
            </div>
          ))}
          {!isFixed && (
            <button className="btn btn--ghost btn--block" onClick={addItem} type="button">
              ＋ 行を足す
            </button>
          )}
        </div>

        {mismatch && (
          <div className="warn">
            <p className="warn__text">
              内訳の合計が {yen(itemsSum)} で、レシートの合計 {yen(receipt.total)} と
              {yen(Math.abs(receipt.total - itemsSum))} ずれています。
            </p>
            <p className="warn__note">
              割引やポイント値引きがあると起きます。このままでも保存できます。
            </p>
            <button className="btn btn--ghost" onClick={fitTotal} type="button">
              合計を {yen(itemsSum)} に直す
            </button>
          </div>
        )}
      </div>

      <footer className="sheet__foot">
        {onDelete && (
          <button className="btn btn--danger" onClick={onDelete} type="button">
            削除
          </button>
        )}
        <button
          className="btn btn--primary btn--grow"
          onClick={() => save(false)}
          type="button"
          disabled={!canSave}
        >
          保存
        </button>
        {fromCamera && (
          <button
            className="btn btn--secondary"
            onClick={() => save(true)}
            type="button"
            disabled={!canSave}
          >
            保存して続けて撮る
          </button>
        )}
      </footer>
    </div>
  )
}
