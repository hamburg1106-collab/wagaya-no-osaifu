/**
 * 新しいService Workerが主導権を取ったら、自動で画面を読み込み直す。
 *
 * これが無いと、新しいSWは裏で入るのに開いているページは古いままで、
 * 更新が反映されるのは「次にアプリを開いたとき」になる。
 * 配布後の修正を届けるのに2回起動を頼むことになるので、ここで吸収する。
 */
const SAFE_WINDOW_MS = 30_000

/**
 * 画面に戻ってから、読み込み直すかを決めるまでの待ち。
 * カメラから戻った直後は、写真を受け取る処理（→ 読み取り中の表示）がまだ走っていない。
 * ここで待たないと、撮った写真ごと読み込み直してしまう。
 */
const RETURN_GRACE_MS = 1_500

/** 確認画面を開いている・読み取り中など、読み込み直すと入力が消えるあいだ true */
let held = false

export const holdUpdate = (hold: boolean): void => {
  held = hold
}

export const reloadOnServiceWorkerUpdate = (): void => {
  if (!('serviceWorker' in navigator)) return
  // 初回インストール（もともと制御者がいない）ときは中身が最新なのでリロード不要
  if (!navigator.serviceWorker.controller) return

  const loadedAt = Date.now()
  let done = false

  const reload = () => {
    if (done) return
    done = true
    window.location.reload()
  }

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // 起動直後なら気づかれないので即リロードする
    if (Date.now() - loadedAt < SAFE_WINDOW_MS) {
      reload()
      return
    }
    // 使用中に画面を奪うと入力中のレシートが消える。次にアプリへ戻った時にする。
    // 戻った時も入力の途中なら見送り、その次に戻った時にまた確かめる
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return
      setTimeout(() => {
        if (document.visibilityState === 'visible' && !held) reload()
      }, RETURN_GRACE_MS)
    })
  })
}
