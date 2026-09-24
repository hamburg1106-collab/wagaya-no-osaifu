import { useState } from 'react'
import { API_KEY_KEY } from '../config'
import { logout } from '../lib/auth'
import { thisMonth, todayKey, yen } from '../lib/month'
import { writeStorage } from '../lib/storage'
import type { Theme } from '../lib/theme'
import { readTheme, saveTheme } from '../lib/theme'
import type { FixedCost, IncomeSource, Plan } from '../types'

type Props = {
  email: string
  uid: string
  apiKey: string
  onApiKeyChange: (key: string) => void
  fixedCosts: FixedCost[]
  onSaveFixed: (cost: FixedCost) => void
  onDeleteFixed: (id: string) => void
  income: IncomeSource[]
  onSaveIncome: (income: IncomeSource) => void
  onDeleteIncome: (id: string) => void
  plan: Plan
  onSavePlan: (plan: Plan) => void
  /** Zaimから取り込み済みの月数 */
  importedCount: number
  onOpenImport: () => void
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

const newIncome = (): IncomeSource => ({
  id: crypto.randomUUID(),
  name: '',
  amount: 0,
  active: true,
})

/**
 * 家計に入ってくるものの候補。
 * 児童手当は家計に入れず別口座なので、ここには出さない（入れると二重に数えてしまう）。
 */
const INCOME_PRESETS = ['敏の拠出', '妻の拠出']

const THEMES: { value: Theme; label: string }[] = [
  { value: 'auto', label: '自動' },
  { value: 'light', label: '明るい' },
  { value: 'dark', label: '暗い' },
]

export const SettingsScreen = ({
  email,
  uid,
  apiKey,
  onApiKeyChange,
  fixedCosts,
  onSaveFixed,
  onDeleteFixed,
  income,
  onSaveIncome,
  onDeleteIncome,
  plan,
  onSavePlan,
  importedCount,
  onOpenImport,
}: Props) => {
  const [keyDraft, setKeyDraft] = useState(apiKey)
  const [editingFixed, setEditingFixed] = useState<FixedCost | null>(null)
  const [editingIncome, setEditingIncome] = useState<IncomeSource | null>(null)
  const [balanceDraft, setBalanceDraft] = useState(String(plan.balance || ''))
  const [assumedDraft, setAssumedDraft] = useState(String(plan.assumedSpend || ''))
  const [copied, setCopied] = useState(false)
  const [theme, setTheme] = useState<Theme>(readTheme)

  /** 相手にIDを送ってもらうため。共有シートが使えない環境ではクリップボードに落とす */
  const copyUid = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ text: uid })
        return
      }
      await navigator.clipboard.writeText(uid)
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

  const saveBalance = () =>
    onSavePlan({
      ...plan,
      balance: Math.round(Number(balanceDraft) || 0),
      assumedSpend: Math.round(Number(assumedDraft) || 0),
      balanceAsOf: todayKey(),
      updatedAt: Date.now(),
    })

  const balanceDirty =
    Math.round(Number(balanceDraft) || 0) !== plan.balance ||
    Math.round(Number(assumedDraft) || 0) !== plan.assumedSpend

  const incomeTotal = income.filter((i) => i.active).reduce((a, i) => a + i.amount, 0)

  return (
    <div className="screen">
      <section className="section">
        <h2 className="section__title">家計の貯蓄残高</h2>
        <p className="note">
          見通しの起点になります。通帳を見て、ざっくりで構いません。
          <br />
          月に一度くらい直せば十分です。
        </p>
        <label className="field">
          <span className="field__label">いまの残高</span>
          <input
            className="input input--amount"
            autoComplete="off"
            type="number"
            inputMode="numeric"
            value={balanceDraft}
            onChange={(e) => setBalanceDraft(e.target.value)}
          />
          {plan.updatedAt > 0 && (
            <span className="field__hint">{plan.balanceAsOf} 時点として記録されています</span>
          )}
        </label>
        <label className="field">
          <span className="field__label">月の支出の想定</span>
          <input
            className="input input--amount"
            autoComplete="off"
            type="number"
            inputMode="numeric"
            value={assumedDraft}
            onChange={(e) => setAssumedDraft(e.target.value)}
          />
          <span className="field__hint">
            記録が貯まるまでの仮置き。先月ぶんの記録ができると自動で実績に切り替わります
          </span>
        </label>
        <button
          className="btn btn--primary btn--block"
          onClick={saveBalance}
          type="button"
          disabled={!balanceDirty}
        >
          保存
        </button>
      </section>

      <section className="section">
        <h2 className="section__title">家計に入るお金</h2>
        <p className="note">
          <strong>給料の額ではなく、家計に入れている額</strong>を入れてください。
          <br />
          毎月きまって入るものだけ。年1回のものは「見通し」の予定に入れます。
        </p>
        <ul className="list">
          {income.map((i) => (
            <li key={i.id}>
              <button className="row" onClick={() => setEditingIncome(i)} type="button">
                <span className="row__store">
                  {i.name}
                  {!i.active && <span className="tag">停止中</span>}
                </span>
                <span className="row__amount">{yen(i.amount)}</span>
              </button>
            </li>
          ))}
        </ul>
        {income.length > 0 && (
          <p className="note note--ok">合計 {yen(incomeTotal)} ／月</p>
        )}
        <button
          className="btn btn--secondary btn--block"
          onClick={() => setEditingIncome(newIncome())}
          type="button"
        >
          ＋ 入ってくるお金を足す
        </button>
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
              <button className="row" onClick={() => setEditingFixed(f)} type="button">
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
          onClick={() => setEditingFixed(newFixed())}
          type="button"
        >
          ＋ 固定費を足す
        </button>
      </section>

      <section className="section">
        <h2 className="section__title">明るさ</h2>
        <div className="choices">
          {THEMES.map((t) => (
            <button
              key={t.value}
              className={`btn ${theme === t.value ? 'btn--primary' : 'btn--ghost'}`}
              onClick={() => {
                saveTheme(t.value)
                setTheme(t.value)
              }}
              type="button"
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="note">「自動」は端末の設定に合わせます。端末ごとの設定です</p>
      </section>

      <section className="section">
        <h2 className="section__title">Zaimから取り込む</h2>
        <p className="note">
          今までZaimに貯めた記録から、月ごとの合計だけを取り込みます。
          <br />
          入れておくと、見通しの支出が最初から実績になります。
        </p>
        <button className="btn btn--secondary btn--block" onClick={onOpenImport} type="button">
          CSVを取り込む
        </button>
        {importedCount > 0 && (
          <p className="note note--ok">{importedCount}ヶ月ぶんが取り込み済みです</p>
        )}
      </section>

      <section className="section">
        <h2 className="section__title">この端末のGemini APIキー</h2>
        <p className="note">
          レシートの読み取りに使います。端末ごとに必要なので、
          <br />
          二人ぶん同じキーを貼って構いません。ここに入れたキーはこの端末の中だけに残ります。
        </p>
        {/*
          type="password" にしない。パスワード欄がページに1つでもあると、
          Chromeがこのページをログイン画面だと判断して、金額を打つたびに
          「パスワードを保存しますか？」を出してくる。
          家の端末でしか開かないので、平文で置くほうが実害が小さい。
        */}
        <input
          className="input"
          type="text"
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
        <h2 className="section__title">ログイン</h2>
        <p className="note">{email} で入っています</p>

        {/*
          初回セットアップでこのuidをFirestoreのルールに貼る必要がある。
          Firebaseコンソールでも見られるが、スマホから開くのは面倒なので
          ここに出して送れるようにしておく。uidは秘密情報ではない。
        */}
        <p className="note">
          セットアップ用のID（uid）
          <br />
          <code className="uid">{uid}</code>
        </p>
        <button className="btn btn--secondary btn--block" onClick={() => void copyUid()} type="button">
          {copied ? 'コピーしました' : 'IDをコピー'}
        </button>

        <button className="btn btn--ghost btn--block" onClick={() => void logout()} type="button">
          ログアウト
        </button>
      </section>

      {editingFixed && (
        <FixedEditor
          cost={editingFixed}
          isNew={!fixedCosts.some((f) => f.id === editingFixed.id)}
          onSave={(c) => {
            onSaveFixed(c)
            setEditingFixed(null)
          }}
          onDelete={() => {
            onDeleteFixed(editingFixed.id)
            setEditingFixed(null)
          }}
          onCancel={() => setEditingFixed(null)}
        />
      )}

      {editingIncome && (
        <IncomeEditor
          income={editingIncome}
          isNew={!income.some((i) => i.id === editingIncome.id)}
          onSave={(i) => {
            onSaveIncome(i)
            setEditingIncome(null)
          }}
          onDelete={() => {
            onDeleteIncome(editingIncome.id)
            setEditingIncome(null)
          }}
          onCancel={() => setEditingIncome(null)}
        />
      )}
    </div>
  )
}

type IncomeEditorProps = {
  income: IncomeSource
  isNew: boolean
  onSave: (income: IncomeSource) => void
  onDelete: () => void
  onCancel: () => void
}

const IncomeEditor = ({ income, isNew, onSave, onDelete, onCancel }: IncomeEditorProps) => {
  const [draft, setDraft] = useState(income)
  const patch = (p: Partial<IncomeSource>) => setDraft((d) => ({ ...d, ...p }))

  return (
    <div className="sheet">
      <header className="sheet__bar">
        <button className="btn btn--ghost" onClick={onCancel} type="button">
          やめる
        </button>
        <span className="sheet__title">家計に入るお金</span>
        <span className="sheet__spacer" />
      </header>

      <div className="sheet__body">
        <label className="field">
          <span className="field__label">名前</span>
          <input
            className="input"
            autoComplete="off"
            value={draft.name}
            onChange={(e) => patch({ name: e.target.value })}
            placeholder="例）敏の拠出"
          />
        </label>

        {isNew && (
          <div className="chips">
            {INCOME_PRESETS.map((p) => (
              <button key={p} className="chip" onClick={() => patch({ name: p })} type="button">
                {p}
              </button>
            ))}
          </div>
        )}

        <label className="field">
          <span className="field__label">毎月の額</span>
          <input
            className="input input--amount"
            autoComplete="off"
            type="number"
            inputMode="numeric"
            value={draft.amount || ''}
            onChange={(e) => patch({ amount: Math.round(Number(e.target.value) || 0) })}
          />
        </label>

        <label className="field field--row">
          <input
            type="checkbox"
            checked={draft.active}
            onChange={(e) => patch({ active: e.target.checked })}
          />
          <span>見通しに含める</span>
          <span className="field__hint">育休などで止まるときは、ここを外す</span>
        </label>
      </div>

      <footer className="sheet__foot">
        {!isNew && (
          <button
            className="btn btn--danger"
            onClick={() => {
              if (confirm(`「${income.name}」を削除します。よろしいですか？`)) onDelete()
            }}
            type="button"
          >
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
            autoComplete="off"
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
              autoComplete="off"
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
          <button
            className="btn btn--danger"
            onClick={() => {
              if (confirm(`「${cost.name}」を削除します。よろしいですか？`)) onDelete()
            }}
            type="button"
          >
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
