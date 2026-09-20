import { useState } from 'react'
import { APP_NAME } from '../config'
import { verifyCode } from '../lib/store'

type Props = {
  onDone: (code: string) => void
}

/**
 * 初回の合言葉入力。
 *
 * 二人同時に乗り換えるので、ここで詰まると即離脱する。
 * 共有リンク（?code=...）で開けば自動で入るようにしてあり、
 * この画面が出るのは手で開いたときだけ。
 */
export const CodeGate = ({ onDone }: Props) => {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const code = value.trim()
    if (!code || busy) return

    setBusy(true)
    setError(null)
    const result = await verifyCode(code)
    setBusy(false)

    if (result.status === 'ok') {
      onDone(code)
      return
    }
    if (result.status === 'ng') {
      setError('合言葉が違うようです。もう一度確認してください')
      return
    }
    setError(`つながりませんでした（${result.detail}）。電波を確認してもう一度お試しください`)
  }

  return (
    <div className="gate">
      <h1 className="gate__title">{APP_NAME}</h1>
      <p className="gate__lead">
        レシートを撮ると記録される家計簿です。
        <br />
        まず合言葉を入れてください。
      </p>
      <form onSubmit={submit} className="gate__form">
        <input
          className="input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="合言葉"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <button className="btn btn--primary" type="submit" disabled={busy || !value.trim()}>
          {busy ? '確認中…' : 'はじめる'}
        </button>
      </form>
      {error && <p className="gate__error">{error}</p>}
      <p className="gate__note">
        合言葉が分からないときは、共有されたリンクから開くと自動で入ります。
      </p>
    </div>
  )
}
