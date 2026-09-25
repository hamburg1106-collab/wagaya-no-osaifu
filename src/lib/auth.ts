import type { User } from 'firebase/auth'
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { auth } from './firebase'

const provider = new GoogleAuthProvider()

export const watchUser = (onChange: (user: User | null) => void): (() => void) =>
  onAuthStateChanged(auth, onChange)

/** 画面に出す文に言い換えたログインの失敗 */
export class LoginError extends Error {}

/**
 * Googleでログインする。ポップアップ方式だけを使う。
 *
 * 以前はポップアップが失敗したらリダイレクト方式（ページごとGoogleへ移動）に切り替えていた。
 * しかしiPhoneのSafariは、ログイン画面のドメイン（firebaseapp.com）とこのアプリ（github.io）で
 * 保存領域を分けるため、戻ってきたときに「missing initial state」で止まる。
 * 実際に妻のiPhoneで起きた（2026-09-25）。
 */
export const login = async (): Promise<void> => {
  try {
    await signInWithPopup(auth, provider)
  } catch (e) {
    const code = (e as { code?: string }).code ?? ''
    // 自分で閉じた・押し直した。失敗ではないので黙って戻す
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return
    if (code === 'auth/popup-blocked') {
      throw new LoginError(
        'ログイン用の画面が開けませんでした。もう一度押してください。' +
          '続くときは、設定アプリ → Safari →「ポップアップブロック」を一時的にオフにしてください',
      )
    }
    throw e
  }
}

export const logout = (): Promise<void> => signOut(auth)
