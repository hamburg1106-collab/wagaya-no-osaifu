import { useState } from 'react'
import { API_KEY_KEY } from '../config'
import { thisMonth, yen } from '../lib/month'
import { writeStorage } from '../lib/storage'
import type { FixedCost } from '../types'

type Props = {
  code: string
  apiKey: string
  onApiKeyChange: (key: string) => void
  fixedCosts: FixedCost[]
  onSaveFixed: (cost: FixedCost) => void
  onDeleteFixed: (id: string) => void
}

const newFixed = (): FixedCost => ({
  id: crypto.randomUUID(),
  name: '',
  type: 'same',
  amount: 0,
  // 作った月から計上する。過去には遡らない
  startMonth: thisMonth(),
  active: true,
})

export const SettingsScreen = ({
  code,
  apiKey,
  onApiKeyChange,
  fixedCosts,
  onSaveFixed,
  onDeleteFixed,
}: Props) => {
  const [keyDraft, setKeyDraft] = useState(apiKey)
  const [editing, setEditing] = useState<FixedCost | null>(null)
  const [copied, setCopied] = useState(false)

  const shareUrl = `${location.origin}${location.pathname}?code=${encodeURIComponent(code)}`

  const share = async () => {
    // iPhoneならLINEやメールにそのまま渡せる。使えない環境ではクリップボードに落とす
    try {
      if (navigator.share) {
        await navigator.share({ title: 'わが家のお財布', url: shareUrl })
        return
      }
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* 共有をキャンセルしただけなので何もしない */
    }
  }

  const saveKey = () => {
    const trimmed = keyDraft.trim()
    writeStorage(API_KEY_KEY, trimmed)
    onApiKeyChange(trimmed)
  }

  return (
    <div className="screen">
      <section className="section">
        <h2 className="section__title">この端末のGemini APIキー</h2>
        <p className="note">
          レシートの読み取りに使います。端末ごとに必要なので、
          <br />
          二人ぶん同じキーを貼って構いません。ここに入れたキーはこの端末の中だけに残ります。
        </p>
        <input
          className="input"
          type="password"
          value={keyDraft}
          onChange={(e) => setKeyDraft(e.target.value)}
          placeholder="AIza…"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <button
          className="btn btn--primary btn--block"
          onClick={saveKey}
          type="button"
          disabled={keyDraft.trim() === apiKey}
        >
          保存
        </button>
        {apiKey && <p className="note note--ok">キーは設定済みです</p>}
      </section>

      <section className="section">
        <h2 className="section__title">固定費</h2>
        <p className="note">
          毎月かかるぶんを登録しておくと、アプリを開いたときに自動で記録されます。
          <br />
          電気や水道のように額が変わるものは「毎月変わる」にしてください。
        </p>
        <ul className="list">
          {fixedCosts.map((f) => (
            <li key={f.id}>
              <button className="row" onClick={() => setEditing(f)} type="button">
                <span className="row__store">
                  {f.name}
                  {!f.active && <span className="tag">停止中</span>}
                </span>
                <span className="row__amount">
                  {f.type === 'same' ? yen(f.amount) : '毎月変わる'}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <button
          className="btn btn--secondary btn--block"
          onClick={() => setEditing(newFixed())}
          type="button"
        >
          ＋ 固定費を足す
        </button>
      </section>

      <section className="section">
        <h2 className="section__title">相手の端末に入れてもらう</h2>
        <p className="note">
          このリンクを送って開いてもらうと、合言葉を打たずに同じ家計簿が見られます。
        </p>
        <button className="btn btn--secondary btn--block" onClick={share} type="button">
          {copied ? 'コピーしました' : 'リンクを送る'}
        </button>
        <p className="note">
          開いたあと、ホーム画面に追加してもらってください。
          <br />
          iPhoneはSafariの共有ボタン →「ホーム画面に追加」。
          <br />
          Androidは右上のメニュー →「アプリをインストール」。
        </p>
      </section>

      {editing && (
        <FixedEditor
          cost={editing}
          onSave={(c) => {
            onSaveFixed(c)
            setEditing(null)
          }}
          onDelete={() => {
            onDeleteFixed(editing.id)
            setEditing(null)
          }}
          onCancel={() => setEditing(null)}
          isNew={!fixedCosts.some((f) => f.id === editing.id)}
        />
      )}
    </div>
  )
}

type EditorProps = {
  cost: FixedCost
  isNew: boolean
  onSave: (cost: FixedCost) => void
  onDelete: () => void
  onCancel: () => void
}

const FixedEditor = ({ cost, isNew, onSave, onDelete, onCancel }: EditorProps) => {
  const [draft, setDraft] = useState(cost)
  const patch = (p: Partial<FixedCost>) => setDraft((d) => ({ ...d, ...p }))

  return (
    <div className="sheet">
      <header className="sheet__bar">
        <button className="btn btn--ghost" onClick={onCancel} type="button">
          やめる
        </button>
        <span className="sheet__title">固定費</span>
        <span className="sheet__spacer" />
      </header>

      <div className="sheet__body">
        <label className="field">
          <span className="field__label">名前</span>
          <input
            className="input"
            value={draft.name}
            onChange={(e) => patch({ name: e.target.value })}
            placeholder="例）土地ローン"
          />
        </label>

        <div className="field">
          <span className="field__label">金額</span>
          <div className="choices">
            <button
              className={`btn ${draft.type === 'same' ? 'btn--primary' : 'btn--ghost'}`}
              onClick={() => patch({ type: 'same' })}
              type="button"
            >
              毎月同じ
            </button>
            <button
              className={`btn ${draft.type === 'variable' ? 'btn--primary' : 'btn--ghost'}`}
              onClick={() => patch({ type: 'variable' })}
              type="button"
            >
              毎月変わる
            </button>
          </div>
        </div>

        {draft.type === 'same' ? (
          <label className="field">
            <span className="field__label">毎月の金額</span>
            <input
              className="input input--amount"
              type="number"
              inputMode="numeric"
              value={draft.amount || ''}
              onChange={(e) => patch({ amount: Math.round(Number(e.target.value) || 0) })}
            />
          </label>
        ) : (
          <p className="note">
            アプリを開いたときに「今月はいくら？」と聞かれます。
            <br />
            2ヶ月に1回の請求なら、無い月は「今月はなし」で飛ばせます。
          </p>
        )}

        <label className="field field--row">
          <input
            type="checkbox"
            checked={draft.active}
            onChange={(e) => patch({ active: e.target.checked })}
          />
          <span>毎月計上する</span>
          <span className="field__hint">
            おむつが取れたときなど、終わったらここを外す（過去の記録は残ります）
          </span>
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
          disabled={!draft.name.trim() || (draft.type === 'same' && draft.amount <= 0)}
        >
          保存
        </button>
      </footer>
    </div>
  )
}
