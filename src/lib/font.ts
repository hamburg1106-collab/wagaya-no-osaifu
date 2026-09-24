/**
 * 丸ゴシックが端末に無いときだけ、Webフォントを読み込む。
 *
 * 日本語のWebフォントは文字ごとに細かく分割されるので、
 * @font-face の定義を並べたCSSだけで数百KBある。
 * iPhoneには「ヒラギノ丸ゴ」が標準で入っていて不要なので、
 * 無条件に読むと妻のiPhone側がまるごと無駄打ちになる。
 */

const HREF =
  'https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@400;500;700&display=swap'

/** 指定した書体が端末にあるか。既定の書体と文字幅が変わるかで判定する */
const hasLocalFont = (name: string): boolean => {
  const ctx = document.createElement('canvas').getContext('2d')
  if (!ctx) return false

  // 日本語を含めないと、和文フォントの有無を見分けられない
  const sample = 'あいうえおアイウエオ漢字ABC'
  const size = 72

  // monospace と serif の両方と比べる。
  // 片方だけだと、たまたま同じ幅になったときに誤判定する
  return (['monospace', 'serif'] as const).every((fallback) => {
    ctx.font = `${size}px ${fallback}`
    const base = ctx.measureText(sample).width
    ctx.font = `${size}px "${name}", ${fallback}`
    return ctx.measureText(sample).width !== base
  })
}

export const loadRoundedFontIfMissing = (): void => {
  try {
    if (hasLocalFont('Hiragino Maru Gothic ProN')) return

    const pre = document.createElement('link')
    pre.rel = 'preconnect'
    pre.href = 'https://fonts.gstatic.com'
    pre.crossOrigin = 'anonymous'
    document.head.appendChild(pre)

    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = HREF
    document.head.appendChild(link)
  } catch {
    // 読めなくても角ゴシックで動く。柔らかさが少し減るだけ
  }
}
