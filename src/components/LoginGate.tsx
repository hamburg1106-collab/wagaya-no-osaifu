import { useState } from 'react'
import { APP_NAME } from '../config'
import { LoginError, login } from '../lib/auth'

/**
 * ログイン画面。
 *
 * 合言葉方式から切り替えた。家計の貯蓄残高と収入を扱うので、
 * リンクを持っている人が全員読めてしまう方式は使えない。
 * 入れるのはFirestoreのルールに書いた夫婦2人のGoogleアカウントだけ。
 */
/**
 * LINEなどのアプリ内ブラウザか。
 * ここではGoogleがログインを受け付けず、ポップアップも開けないので「ログイン中…」のまま止まる。
 */
const ua = navigator.userAgent
const inLine = /\bLine\//i.test(ua)
const inAppBrowser = inLine || /FBAN|FBAV|Instagram/i.test(ua)

/** LINEはこの指定が付いたリンクを外のブラウザ（iPhoneならSafari）で開き直す */
const externalUrl = `${location.origin}${location.pathname}?openExternalBrowser=1`

export const LoginGate = () => {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (inAppBrowser) {
    return (
      <div className="gate">
        <h1 className="gate__title">{APP_NAME}</h1>
        <p className="gate__lead">
          {inLine ? 'LINE' : 'アプリ'}の中の画面では、Googleでログインできません。
          <br />
          SafariやChromeで開き直してください。
        </p>
        {inLine ? (
          <a className="btn btn--primary btn--block" href={externalUrl}>
            Safariで開く
          </a>
        ) : (
          <p className="gate__note">右上（または右下）のメニューから「ブラウザで開く」を選んでください。</p>
        )}
        <p className="gate__note">
          開き直したら、共有ボタンから「ホーム画面に追加」しておくと
          <br />
          次からはアイコンから開けます。
        </p>
      </div>
    )
  }

  const run = async () => {
    setBusy(true)
    setError(null)
    try {
      await login()
    } catch (e) {
      setError(
        e instanceof LoginError
          ? e.message
          : `ログインできませんでした（${e instanceof Error ? e.message : String(e)}）`,
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="gate">
      <h1 className="gate__title">{APP_NAME}</h1>
      <p className="gate__lead">
        レシートを撮ると記録され、
        <br />
        この先いくら要るかが見える家計簿です。
      </p>
      <button className="btn btn--primary btn--block" onClick={() => void run()} disabled={busy}>
        {busy ? 'ログイン中…' : 'Googleでログイン'}
      </button>
      {error && <p className="gate__error">{error}</p>}
      <p className="gate__note">
        入れるのは登録済みの2人だけです。
        <br />
        ログインしても「権限がありません」と出るときは、
        <br />
        そのアカウントがまだ登録されていません。
      </p>
    </div>
  )
}
