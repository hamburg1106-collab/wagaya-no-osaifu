import {
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
} from 'firebase/firestore'
import { app } from './firebase'

// このファイルは store.ts からの動的importでしか読まれない。
// firebase.ts に混ぜるとログイン画面にもFirestore SDK（gzipで約170KB）が付いてきて、
// 起動が目に見えて遅くなる。
//
// persistentLocalCache: 取得済みのデータをIndexedDBに持つ。
//   → 圏外でも過去の記録と見通しが読める。書き込みは復帰時にまとめて送られる。
// tabManager: 複数タブ同期（persistentMultipleTabManager）はiOS Safariでロックの取得に
//   失敗することがあり、そうなるとFirestore全体が failed-precondition で動かなくなる。
//   スマホでタブを2枚開く運用は無いので、単一タブ版にして安定を取る。
// ignoreUndefinedProperties: 値がundefinedのキーを黙って捨てる（無いと保存時に例外になる）
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentSingleTabManager({}) }),
  ignoreUndefinedProperties: true,
})
