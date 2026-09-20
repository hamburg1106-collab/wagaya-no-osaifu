import { initializeApp } from 'firebase/app'
import {
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
} from 'firebase/firestore'

// ウェブ用のconfigは公開前提の識別子（秘密鍵ではない）。
// 実際の保護はFirestoreのセキュリティルール（合言葉＝パスの一致）で行う。
//
// プロジェクトは他のアプリと共用し、コレクション名（kakeibo）で分ける。
const firebaseConfig = {
  apiKey: 'AIzaSyDSGP41IVUjfERDN9-4Nnm6_tAJPVeISgg',
  authDomain: 'ouchi-no-kondate.firebaseapp.com',
  projectId: 'ouchi-no-kondate',
  storageBucket: 'ouchi-no-kondate.firebasestorage.app',
  messagingSenderId: '385279752727',
  appId: '1:385279752727:web:59068d4c3d5cbd000b3a52',
}

const app = initializeApp(firebaseConfig)

// persistentLocalCache: 取得済みのデータをIndexedDBに持つ。
//   → 圏外でも過去の記録が読める。書き込みは復帰時にまとめて送られる。
// tabManager: 複数タブ同期（persistentMultipleTabManager）はiOS Safariでロックの取得に
//   失敗することがあり、そうなるとFirestore全体が failed-precondition で動かなくなる。
//   スマホでタブを2枚開く運用は無いので、単一タブ版にして安定を取る。
// ignoreUndefinedProperties: 値がundefinedのキーを黙って捨てる（無いと保存時に例外になる）
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentSingleTabManager({}) }),
  ignoreUndefinedProperties: true,
})
