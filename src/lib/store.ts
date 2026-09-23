import { FIXED_BUCKET, HOUSEHOLD_ID } from '../config'
import type { FixedCost, IncomeSource, LifeEvent, Plan, Receipt } from '../types'

/**
 * Firestore SDKは重い（gzipで約150KB）ので、静的importせず動的importで後から読む。
 * こうすると初期表示に必要なチャンクからFirestoreが外れる。
 * 読み込み結果はキャッシュするので、SDKが読まれるのは1回だけ。
 */
type FirestoreBundle = {
  db: import('firebase/firestore').Firestore
  fs: typeof import('firebase/firestore')
}

let bundlePromise: Promise<FirestoreBundle> | null = null

const getFs = (): Promise<FirestoreBundle> => {
  bundlePromise ??= (async () => {
    const [{ db }, fs] = await Promise.all([import('./db'), import('firebase/firestore')])
    return { db, fs }
  })()
  // 失敗したPromiseを掴み続けると、以降すべての操作が永久に失敗する。
  // （アプリを更新した直後、古いチャンクが消えていると起きる）
  return bundlePromise.catch((e: unknown) => {
    bundlePromise = null
    throw e
  })
}

// すべて kakeibo/{HOUSEHOLD_ID}/... の下に置く。
// 誰が読めるかはパスではなくルール（夫婦2人のuid）で決まる。
const col = ({ db, fs }: FirestoreBundle, name: string) =>
  fs.collection(db, 'kakeibo', HOUSEHOLD_ID, name)

/** 見通しの前提。1件しかないのでドキュメントを固定する */
const planRef = ({ db, fs }: FirestoreBundle) =>
  fs.doc(db, 'kakeibo', HOUSEHOLD_ID, 'meta', 'plan')

/**
 * 購読の共通処理。
 * SDKの読み込みが終わる前に画面を閉じられても大丈夫なように、
 * 解除フラグを見てからonSnapshotを張る。
 */
const subscribe = (
  start: (bundle: FirestoreBundle) => () => void,
  onError: (error: Error) => void,
): (() => void) => {
  let unsubscribe: (() => void) | null = null
  let cancelled = false

  void getFs()
    .then((bundle) => {
      if (cancelled) return
      unsubscribe = start(bundle)
    })
    .catch((e: unknown) => onError(e instanceof Error ? e : new Error(String(e))))

  return () => {
    cancelled = true
    unsubscribe?.()
  }
}

/** コレクションをまるごと購読する共通形 */
const subscribeAll = <T>(
  name: string,
  sort: (list: T[]) => T[],
  onChange: (list: T[]) => void,
  onError: (error: Error) => void,
) =>
  subscribe(
    (bundle) =>
      bundle.fs.onSnapshot(
        col(bundle, name),
        (snapshot) => onChange(sort(snapshot.docs.map((d) => ({ ...d.data(), id: d.id }) as T))),
        onError,
      ),
    onError,
  )

const byName = <T extends { name: string }>(list: T[]): T[] =>
  list.slice().sort((a, b) => a.name.localeCompare(b.name, 'ja'))

/* ---------- レシート ---------- */

/** 新しい順（同じ日なら登録が新しい順）に並べる */
export const sortReceipts = (list: Receipt[]): Receipt[] =>
  list
    .slice()
    .sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : b.date < a.date ? -1 : 1))

export const subscribeReceipts = (
  onChange: (list: Receipt[]) => void,
  onError: (error: Error) => void,
) => subscribeAll<Receipt>('receipts', sortReceipts, onChange, onError)

export const saveReceipt = async (receipt: Receipt): Promise<void> => {
  const bundle = await getFs()
  const { id, ...rest } = receipt
  await bundle.fs.setDoc(bundle.fs.doc(col(bundle, 'receipts'), id), rest)
}

export const deleteReceipt = async (id: string): Promise<void> => {
  const bundle = await getFs()
  await bundle.fs.deleteDoc(bundle.fs.doc(col(bundle, 'receipts'), id))
}

/* ---------- 固定費 ---------- */

export const subscribeFixedCosts = (
  onChange: (list: FixedCost[]) => void,
  onError: (error: Error) => void,
) => subscribeAll<FixedCost>('fixed', byName, onChange, onError)

export const saveFixedCost = async (cost: FixedCost): Promise<void> => {
  const bundle = await getFs()
  const { id, ...rest } = cost
  await bundle.fs.setDoc(bundle.fs.doc(col(bundle, 'fixed'), id), rest)
}

export const deleteFixedCost = async (id: string): Promise<void> => {
  const bundle = await getFs()
  await bundle.fs.deleteDoc(bundle.fs.doc(col(bundle, 'fixed'), id))
}

/** 計上済みの月のID一覧 */
export const subscribeFixedLog = (
  onChange: (months: Set<string>) => void,
  onError: (error: Error) => void,
) =>
  subscribe(
    (bundle) =>
      bundle.fs.onSnapshot(
        col(bundle, 'fixedLog'),
        (snapshot) => onChange(new Set(snapshot.docs.map((d) => d.id))),
        onError,
      ),
    onError,
  )

/* ---------- 収入 ---------- */

export const subscribeIncome = (
  onChange: (list: IncomeSource[]) => void,
  onError: (error: Error) => void,
) => subscribeAll<IncomeSource>('income', byName, onChange, onError)

export const saveIncome = async (income: IncomeSource): Promise<void> => {
  const bundle = await getFs()
  const { id, ...rest } = income
  await bundle.fs.setDoc(bundle.fs.doc(col(bundle, 'income'), id), rest)
}

export const deleteIncome = async (id: string): Promise<void> => {
  const bundle = await getFs()
  await bundle.fs.deleteDoc(bundle.fs.doc(col(bundle, 'income'), id))
}

/* ---------- ライフイベント ---------- */

export const subscribeEvents = (
  onChange: (list: LifeEvent[]) => void,
  onError: (error: Error) => void,
) =>
  subscribeAll<LifeEvent>(
    'events',
    (list) => list.slice().sort((a, b) => a.month.localeCompare(b.month)),
    onChange,
    onError,
  )

export const saveEvent = async (event: LifeEvent): Promise<void> => {
  const bundle = await getFs()
  const { id, ...rest } = event
  await bundle.fs.setDoc(bundle.fs.doc(col(bundle, 'events'), id), rest)
}

export const deleteEvent = async (id: string): Promise<void> => {
  const bundle = await getFs()
  await bundle.fs.deleteDoc(bundle.fs.doc(col(bundle, 'events'), id))
}

/* ---------- 見通しの前提 ---------- */

export const subscribePlan = (
  onChange: (plan: Plan | null) => void,
  onError: (error: Error) => void,
) =>
  subscribe(
    (bundle) =>
      bundle.fs.onSnapshot(
        planRef(bundle),
        (snapshot) => onChange(snapshot.exists() ? (snapshot.data() as Plan) : null),
        onError,
      ),
    onError,
  )

export const savePlan = async (plan: Plan): Promise<void> => {
  const bundle = await getFs()
  await bundle.fs.setDoc(planRef(bundle), plan)
}

/* ---------- 固定費の自動計上 ---------- */

/** 固定費として計上する1件分 */
export type FixedPosting = { name: string; amount: number }

/**
 * 指定した月の固定費をまとめて計上する。
 *
 * 夫婦の端末が同時にアプリを開くと二重計上になりうるので、
 * トランザクションで「計上済みフラグが無いこと」を確認してから書く。
 * 先に書いたほうが勝ち、もう一方は何もしない。
 *
 * 圏外だとトランザクションは失敗する。そのときは何も起きないだけで、
 * 次に電波のある状態で開いたときに改めて計上される。
 */
export const postFixedMonth = async (month: string, postings: FixedPosting[]): Promise<void> => {
  const bundle = await getFs()
  const { fs, db } = bundle
  const logDoc = fs.doc(col(bundle, 'fixedLog'), month)

  await fs.runTransaction(db, async (tx) => {
    const existing = await tx.get(logDoc)
    if (existing.exists()) return

    // 月末の日付で計上する。1日にすると履歴の先頭に固まって変動費が見えなくなる
    const [y, m] = month.split('-').map(Number)
    const lastDay = new Date(y, m, 0).getDate()
    const date = `${month}-${String(lastDay).padStart(2, '0')}`

    for (const p of postings) {
      if (p.amount <= 0) continue
      const ref = fs.doc(col(bundle, 'receipts'), crypto.randomUUID())
      tx.set(ref, {
        date,
        store: p.name,
        total: p.amount,
        items: [{ category: FIXED_BUCKET, amount: p.amount }],
        source: 'fixed',
        createdAt: Date.now(),
      })
    }
    tx.set(logDoc, { postedAt: Date.now() })
  })
}
