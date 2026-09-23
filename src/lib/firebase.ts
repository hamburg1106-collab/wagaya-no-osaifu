import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'

// ウェブ用のconfigは公開前提の識別子（秘密鍵ではない）。
// 実際の保護はFirestoreのセキュリティルールで行う。
//
// 当初は合言葉方式（パスを知っている人だけ読める）だったが、家計の貯蓄残高と収入を
// 扱うようになったのでGoogleログインに変えた。合言葉はリンクで渡すため
// LINEやメールの履歴に残り、片方の端末だけ無効にできず、変えるにはルールの書き換えが要る。
// 夫婦2人ぶんのuidをルールに書いて、その2人だけが読み書きできるようにしている。
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

// Firestoreはここで触らない。ログインの判定より前に重いSDKを読ませないため、
// 初期化は db.ts に分けて store.ts から動的importで読む。
export const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
