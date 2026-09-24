import { THEME_KEY } from '../config'
import { readStorage, writeStorage } from './storage'

/** auto=端末の設定に従う */
export type Theme = 'auto' | 'light' | 'dark'

const isTheme = (v: string | null): v is Theme => v === 'auto' || v === 'light' || v === 'dark'

export const readTheme = (): Theme => {
  const v = readStorage(THEME_KEY)
  return isTheme(v) ? v : 'auto'
}

/**
 * <html> に data-theme を付ける。CSSはこの属性を見て配色を切り替える。
 * auto のときは属性を外して、端末の設定（prefers-color-scheme）に任せる。
 */
export const applyTheme = (theme: Theme): void => {
  const root = document.documentElement
  if (theme === 'auto') {
    delete root.dataset.theme
  } else {
    root.dataset.theme = theme
  }
  // アドレスバーの色も合わせる。ここを直さないと上端だけ前の色が残る
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#2a231d' : '#d96f4c')
}

export const saveTheme = (theme: Theme): void => {
  writeStorage(THEME_KEY, theme)
  applyTheme(theme)
}
