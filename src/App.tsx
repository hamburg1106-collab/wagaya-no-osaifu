import type { User } from 'firebase/auth'
import { useEffect, useMemo, useRef, useState } from 'react'
import { FixedPrompt } from './components/FixedPrompt'
import { HistoryScreen } from './components/HistoryScreen'
import { HomeScreen } from './components/HomeScreen'
import { LoginGate } from './components/LoginGate'
import { OutlookScreen } from './components/OutlookScreen'
import { ReviewSheet } from './components/ReviewSheet'
import { SettingsScreen } from './components/SettingsScreen'
import { TrendScreen } from './components/TrendScreen'
import { API_KEY_KEY, APP_NAME, TAB_KEY } from './config'
import { watchUser } from './lib/auth'
import { defaultPlan } from './lib/forecast'
import { GeminiError, analyzeReceipt } from './lib/gemini'
import { shrinkImage } from './lib/image'
import { monthsBetween, thisMonth } from './lib/month'
import { readStorage, writeStorage } from './lib/storage'
import {
  deleteEvent,
  deleteFixedCost,
  deleteIncome,
  deleteReceipt,
  postFixedMonth,
  saveEvent,
  saveFixedCost,
  saveIncome,
  savePlan,
  saveReceipt,
  subscribeEvents,
  subscribeFixedCosts,
  subscribeFixedLog,
  subscribeIncome,
  subscribePlan,
  subscribeReceipts,
} from './lib/store'
import type { FixedCost, IncomeSource, LifeEvent, Plan, Receipt } from './types'

type Tab = 'home' | 'history' | 'trend' | 'outlook' | 'settings'

const TABS: { id: Tab; label: string }[] = [
  { id: 'home', label: 'ホーム' },
  { id: 'history', label: '履歴' },
  { id: 'trend', label: '推移' },
  { id: 'outlook', label: '見通し' },
  { id: 'settings', label: '設定' },
]

/** 確認画面に出しているもの。fromCameraならレシート由来 */
type Editing = { receipt: Receipt; fromCamera: boolean; isNew: boolean }

const App = () => {
  // undefined = 判定中。null = 未ログイン
  const [user, setUser] = useState<User | null | undefined>(undefined)
  const [apiKey, setApiKey] = useState(() => readStorage(API_KEY_KEY) ?? '')
  const [tab, setTab] = useState<Tab>(() => (readStorage(TAB_KEY) as Tab | null) ?? 'home')
  const [month, setMonth] = useState(thisMonth)

  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [fixedCosts, setFixedCosts] = useState<FixedCost[]>([])
  const [postedMonths, setPostedMonths] = useState<Set<string> | null>(null)
  const [income, setIncome] = useState<IncomeSource[]>([])
  const [events, setEvents] = useState<LifeEvent[]>([])
  const [plan, setPlan] = useState<Plan | null>(null)

  const [editing, setEditing] = useState<Editing | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  /** 固定費の入力を「あとで」にした月。次の起動では覚えていないので、また聞かれる */
  const [fixedDeferred, setFixedDeferred] = useState<string | null>(null)

  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => watchUser(setUser), [])

  useEffect(() => writeStorage(TAB_KEY, tab), [tab])

  useEffect(() => {
    if (!user) return

    const onStoreError = (e: Error) => {
      // ルールにuidが登録されていないと permission-denied になる。何が起きたか分かる文にする
      const denied = e.message.includes('permission') || e.message.includes('insufficient')
      setError(
        denied
          ? 'このアカウントはまだ登録されていません。Firestoreのルールにuidを足してください'
          : `データを読めませんでした（${e.message}）`,
      )
    }

    const stop = [
      subscribeReceipts(setReceipts, onStoreError),
      subscribeFixedCosts(setFixedCosts, onStoreError),
      subscribeFixedLog(setPostedMonths, onStoreError),
      subscribeIncome(setIncome, onStoreError),
      subscribeEvents(setEvents, onStoreError),
      subscribePlan(setPlan, onStoreError),
    ]
    return () => stop.forEach((fn) => fn())
  }, [user])

  /**
   * まだ計上していない月のうち、一番古いもの。
   * テンプレを作った月より前には遡らない（過去の家計簿を勝手に作らないため）。
   */
  const pendingMonth = useMemo(() => {
    if (!postedMonths) return null
    const active = fixedCosts.filter((f) => f.active)
    if (active.length === 0) return null
    const start = active.reduce((min, f) => (f.startMonth < min ? f.startMonth : min), thisMonth())
    return monthsBetween(start, thisMonth()).find((m) => !postedMonths.has(m)) ?? null
  }, [fixedCosts, postedMonths])

  const pendingTargets = useMemo(() => {
    if (!pendingMonth) return { same: [], variable: [] }
    const active = fixedCosts.filter((f) => f.active && f.startMonth <= pendingMonth)
    return {
      same: active.filter((f) => f.type === 'same'),
      variable: active.filter((f) => f.type === 'variable'),
    }
  }, [fixedCosts, pendingMonth])

  /**
   * 毎月同額のものしか無い月は、聞かずにそのまま計上する。
   * 二重起動で何度も走らないよう、処理中の月を覚えておく。
   */
  const posting = useRef<string | null>(null)
  useEffect(() => {
    if (!user || !pendingMonth) return
    if (pendingTargets.variable.length > 0) return
    if (pendingTargets.same.length === 0) return
    if (posting.current === pendingMonth) return

    posting.current = pendingMonth
    void postFixedMonth(
      pendingMonth,
      pendingTargets.same.map((f) => ({ name: f.name, amount: f.amount })),
    ).catch(() => {
      // 圏外だと失敗する。次に開いたときに改めて計上されるので、ここでは黙る
      posting.current = null
    })
  }, [user, pendingMonth, pendingTargets])

  const pickPhoto = () => {
    if (!apiKey) {
      setError('先に設定画面でGemini APIキーを入れてください')
      setTab('settings')
      return
    }
    fileInput.current?.click()
  }

  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // 同じ写真をもう一度選べるように値を戻す
    e.target.value = ''
    if (!file) return

    setError(null)
    setBusy('レシートを読み取っています…')
    try {
      const parsed = await analyzeReceipt(await shrinkImage(file), apiKey)
      setEditing({
        receipt: {
          id: crypto.randomUUID(),
          ...parsed,
          source: 'receipt',
          createdAt: Date.now(),
        },
        fromCamera: true,
        isNew: true,
      })
    } catch (err) {
      setError(
        err instanceof GeminiError
          ? err.message
          : `読み取れませんでした（${err instanceof Error ? err.message : String(err)}）`,
      )
    } finally {
      setBusy(null)
    }
  }

  const guard = (task: Promise<unknown>, what: string) =>
    void task.catch((e: unknown) =>
      setError(`${what}できませんでした（${e instanceof Error ? e.message : String(e)}）`),
    )

  const onSave = async (receipt: Receipt, thenCamera: boolean) => {
    setEditing(null)
    try {
      await saveReceipt(receipt)
    } catch (err) {
      setError(`保存できませんでした（${err instanceof Error ? err.message : String(err)}）`)
      return
    }
    if (thenCamera) pickPhoto()
  }

  const onDelete = async (id: string) => {
    if (!confirm('この記録を削除します。よろしいですか？')) return
    setEditing(null)
    guard(deleteReceipt(id), '削除')
  }

  if (user === undefined) {
    return (
      <div className="overlay overlay--plain">
        <span className="spinner" />
      </div>
    )
  }
  if (user === null) return <LoginGate />

  const currentPlan = plan ?? defaultPlan()

  return (
    <div className="app">
      <header className="appbar">
        <h1 className="appbar__title">{APP_NAME}</h1>
      </header>

      <main className="main">
        {tab === 'home' && (
          <HomeScreen
            receipts={receipts}
            month={month}
            onMonthChange={setMonth}
            onOpen={(r) => setEditing({ receipt: r, fromCamera: false, isNew: false })}
          />
        )}
        {tab === 'history' && (
          <HistoryScreen
            receipts={receipts}
            onOpen={(r) => setEditing({ receipt: r, fromCamera: false, isNew: false })}
          />
        )}
        {tab === 'trend' && <TrendScreen receipts={receipts} />}
        {tab === 'outlook' && (
          <OutlookScreen
            receipts={receipts}
            income={income}
            events={events}
            plan={currentPlan}
            onSaveEvent={(e) => guard(saveEvent(e), '保存')}
            onDeleteEvent={(id) => guard(deleteEvent(id), '削除')}
            onGoSettings={() => setTab('settings')}
          />
        )}
        {tab === 'settings' && (
          <SettingsScreen
            email={user.email ?? ''}
            uid={user.uid}
            apiKey={apiKey}
            onApiKeyChange={setApiKey}
            fixedCosts={fixedCosts}
            onSaveFixed={(c) => guard(saveFixedCost(c), '保存')}
            onDeleteFixed={(id) => guard(deleteFixedCost(id), '削除')}
            income={income}
            onSaveIncome={(i) => guard(saveIncome(i), '保存')}
            onDeleteIncome={(id) => guard(deleteIncome(id), '削除')}
            plan={currentPlan}
            onSavePlan={(p) => guard(savePlan(p), '保存')}
          />
        )}
      </main>

      <div className="fabwrap">
        <button className="fab" onClick={pickPhoto} type="button" aria-label="レシートを撮る">
          <CameraIcon />
        </button>
        <button
          className="fab fab--sub"
          onClick={() =>
            setEditing({
              receipt: {
                id: crypto.randomUUID(),
                date: '',
                store: '',
                total: 0,
                items: [],
                source: 'manual',
                createdAt: Date.now(),
              },
              fromCamera: false,
              isNew: true,
            })
          }
          type="button"
          aria-label="手で入力する"
        >
          ✎
        </button>
      </div>

      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tabs__item ${tab === t.id ? 'is-active' : ''}`}
            onClick={() => setTab(t.id)}
            type="button"
          >
            {t.label}
          </button>
        ))}
      </nav>

      <input
        ref={fileInput}
        className="hidden"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => void onPhoto(e)}
      />

      {busy && (
        <div className="overlay">
          <div className="overlay__box">
            <span className="spinner" />
            <p>{busy}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="toast" role="alert">
          <span>{error}</span>
          <button className="btn btn--icon" onClick={() => setError(null)} type="button">
            ×
          </button>
        </div>
      )}

      {editing && (
        <ReviewSheet
          key={editing.receipt.id}
          // 手入力の新規は空のまま開く。確認画面をそのまま流用している
          initial={editing.receipt.date ? editing.receipt : undefined}
          fromCamera={editing.fromCamera}
          onSave={(r, thenCamera) => void onSave(r, thenCamera)}
          onDelete={editing.isNew ? undefined : () => void onDelete(editing.receipt.id)}
          onCancel={() => setEditing(null)}
        />
      )}

      {pendingMonth && pendingTargets.variable.length > 0 && pendingMonth !== fixedDeferred && (
        <FixedPrompt
          key={pendingMonth}
          month={pendingMonth}
          same={pendingTargets.same}
          variable={pendingTargets.variable}
          onSubmit={(postings) => guard(postFixedMonth(pendingMonth, postings), '固定費を記録')}
          onLater={() => setFixedDeferred(pendingMonth)}
        />
      )}
    </div>
  )
}

const CameraIcon = () => (
  <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 8a2 2 0 0 1 2-2h2.5l1.2-1.8A1 1 0 0 1 9.5 4h5a1 1 0 0 1 .8.2L16.5 6H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
    <circle cx="12" cy="12.5" r="3.5" />
  </svg>
)

export default App
