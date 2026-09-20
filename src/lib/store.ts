import { FIXED_BUCKET, NETWORK_TIMEOUT_MS } from '../config'
import type { FixedCost, Receipt } from '../types'

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
    const [{ db }, fs] = await Promise.all([import('./firebase'), import('firebase/firestore')])
    return { db, fs }
  })()
  // 失敗したPromiseを掴み続けると、以降すべての操作が永久に失敗する。
  // （アプリを更新した直後、古いチャンクが消えていると起きる）
  return bundlePromise.catch((e: unknown) => {
    bundlePromise = null
    throw e
  })
}

/** kakeibo/{合言葉}/receipts に記録を置く。合言葉を知らない人はパスを当てられない */
const receiptsRef = ({ db, fs }: FirestoreBundle, code: string) =>
  fs.collection(db, 'kakeibo', code, 'receipts')

/** 固定費テンプレ（マスタ） */
const fixedRef = ({ db, fs }: FirestoreBundle, code: string) =>
  fs.collection(db, 'kakeibo', code, 'fixed')

/** 計上済みフラグ。ドキュメントIDが YYYY-MM なので、二人が同時に開いても重複しない */
const fixedLogRef = ({ db, fs }: FirestoreBundle, code: string) =>
  fs.collection(db, 'kakeibo', code, 'fixedLog')

const metaRef = ({ db, fs }: FirestoreBundle, code: string) =>
  fs.doc(db, 'kakeibo', code, 'meta', 'info')

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

/** 応答が返らないまま固まるのを防ぐ。圏外のgetDocFromServerは長く待つことがある */
const withTimeout = <T>(task: Promise<T>, ms: number): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(Object.assign(new Error('timeout'), { code: 'timeout' }))
    }, ms)
    task.then(resolve, reject).finally(() => clearTimeout(timer))
  })

export type VerifyResult =
  | { status: 'ok' }
  | { status: 'ng' }
  /** 合言葉の正否を判定できなかった。detailは原因表示用 */
  | { status: 'unknown'; detail: string }

/**
 * 合言葉が正しいか確認する。
 * ルールでcodeが一致しない読み取りはpermission-deniedになるので、
 * 「サーバから読めたかどうか」がそのまま合言葉の検証になる。
 *
 * 通常のgetDocはオフラインだとキャッシュを返して成功してしまい、
 * 間違った合言葉でも通る。必ずサーバに問い合わせること。
 *
 * permission-deniedのときだけ「間違い」とする。通信不良やタイムアウトを
 * 「間違い」と決めつけると、正しい合言葉でも入れなくなる。
 */
export const verifyCode = async (code: string): Promise<VerifyResult> => {
  try {
    const bundle = await withTimeout(getFs(), NETWORK_TIMEOUT_MS)
    await withTimeout(bundle.fs.getDocFromServer(metaRef(bundle, code)), NETWORK_TIMEOUT_MS)
    return { status: 'ok' }
  } catch (e: unknown) {
    const codeName = (e as { code?: string } | null)?.code
    if (codeName === 'permission-denied') return { status: 'ng' }
    const detail = codeName ?? (e instanceof Error ? e.message : String(e))
    return { status: 'unknown', detail }
  }
}

/** 新しい順（同じ日なら登録が新しい順）に並べる */
export const sortReceipts = (list: Receipt[]): Receipt[] =>
  list.slice().sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : b.date < a.date ? -1 : 1))

export const subscribeReceipts = (
  code: string,
  onChange: (list: Receipt[], fromCache: boolean) => void,
  onError: (error: Error) => void,
) =>
  subscribe(
    (bundle) =>
      bundle.fs.onSnapshot(
        receiptsRef(bundle, code),
        (snapshot) =>
          onChange(
            sortReceipts(snapshot.docs.map((d) => ({ ...d.data(), id: d.id }) as Receipt)),
            snapshot.metadata.fromCache,
          ),
        onError,
      ),
    onError,
  )

export const subscribeFixedCosts = (
  code: string,
  onChange: (list: FixedCost[]) => void,
  onError: (error: Error) => void,
) =>
  subscribe(
    (bundle) =>
      bundle.fs.onSnapshot(
        fixedRef(bundle, code),
        (snapshot) =>
          onChange(
            snapshot.docs
              .map((d) => ({ ...d.data(), id: d.id }) as FixedCost)
              .sort((a, b) => a.name.localeCompare(b.name, 'ja')),
          ),
        onError,
      ),
    onError,
  )

/** 計上済みの月のID一覧 */
export const subscribeFixedLog = (
  code: string,
  onChange: (months: Set<string>) => void,
  onError: (error: Error) => void,
) =>
  subscribe(
    (bundle) =>
      bundle.fs.onSnapshot(
        fixedLogRef(bundle, code),
        (snapshot) => onChange(new Set(snapshot.docs.map((d) => d.id))),
        onError,
      ),
    onError,
  )

export const saveReceipt = async (code: string, receipt: Receipt): Promise<void> => {
  const bundle = await getFs()
  const { id, ...rest } = receipt
  await bundle.fs.setDoc(bundle.fs.doc(receiptsRef(bundle, code), id), rest)
}

export const deleteReceipt = async (code: string, id: string): Promise<void> => {
  const bundle = await getFs()
  await bundle.fs.deleteDoc(bundle.fs.doc(receiptsRef(bundle, code), id))
}

export const saveFixedCost = async (code: string, cost: FixedCost): Promise<void> => {
  const bundle = await getFs()
  const { id, ...rest } = cost
  await bundle.fs.setDoc(bundle.fs.doc(fixedRef(bundle, code), id), rest)
}

export const deleteFixedCost = async (code: string, id: string): Promise<void> => {
  const bundle = await getFs()
  await bundle.fs.deleteDoc(bundle.fs.doc(fixedRef(bundle, code), id))
}

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
export const postFixedMonth = async (
  code: string,
  month: string,
  postings: FixedPosting[],
): Promise<void> => {
  const bundle = await getFs()
  const { fs, db } = bundle
  const logDoc = fs.doc(fixedLogRef(bundle, code), month)

  await fs.runTransaction(db, async (tx) => {
    const existing = await tx.get(logDoc)
    if (existing.exists()) return

    // 月末の日付で計上する。1日にすると履歴の先頭に固まって変動費が見えなくなる
    const [y, m] = month.split('-').map(Number)
    const lastDay = new Date(y, m, 0).getDate()
    const date = `${month}-${String(lastDay).padStart(2, '0')}`

    for (const p of postings) {
      if (p.amount <= 0) continue
      const ref = fs.doc(receiptsRef(bundle, code), crypto.randomUUID())
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
