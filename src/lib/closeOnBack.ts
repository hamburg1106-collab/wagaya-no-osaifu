import { useEffect, useRef } from 'react'

/**
 * 全画面のシートを開いているあいだ、端末の「戻る」でシートだけを閉じる。
 *
 * これが無いと、Androidの戻る操作でアプリそのものが閉じて入力が消える。
 * 開くときに履歴を1段積み、戻る操作でそれが外れたら onBack を呼ぶ。
 * onBack が false を返したら（破棄の確認で「キャンセル」など）積み直して留まる。
 */
export const useCloseOnBack = (onBack: () => boolean): void => {
  const latest = useRef(onBack)
  useEffect(() => {
    latest.current = onBack
  })

  useEffect(() => {
    const marker = crypto.randomUUID()
    history.pushState({ sheet: marker }, '')

    const onPop = () => {
      if (!latest.current()) history.pushState({ sheet: marker }, '')
    }
    window.addEventListener('popstate', onPop)

    return () => {
      window.removeEventListener('popstate', onPop)
      // ボタンで閉じたときは、積んだ1段が残る。残すと次の「戻る」が空振りするので外す。
      // 次のシートがすぐ開いた場合は積み直されているので、そのときは触らない
      setTimeout(() => {
        if ((history.state as { sheet?: string } | null)?.sheet === marker) history.back()
      }, 0)
    }
  }, [])
}
