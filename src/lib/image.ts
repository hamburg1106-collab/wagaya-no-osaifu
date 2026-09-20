/**
 * 撮った写真を縮めてからGeminiに送る。
 *
 * 最近のスマホは4000px・4MB近い写真を吐く。そのまま送ると
 * アップロードに時間がかかるうえ、消費トークンも増えて無料枠を早く使い切る。
 * レシートの文字は1600pxもあれば十分読める。
 */
const MAX_EDGE = 1600
const QUALITY = 0.8

export type Shrunk = {
  /** 接頭辞なしのbase64（Geminiのinline_dataがこの形を要求する） */
  base64: string
  mimeType: string
}

export const shrinkImage = async (file: File): Promise<Shrunk> => {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('画像を処理できませんでした')
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', QUALITY),
  )
  if (!blob) throw new Error('画像を変換できませんでした')

  const buffer = await blob.arrayBuffer()
  return { base64: toBase64(buffer), mimeType: 'image/jpeg' }
}

/**
 * ArrayBuffer → base64。
 * String.fromCharCode(...bytes) は数十万要素で引数が多すぎて落ちるので、
 * 8KBずつ区切って詰める。
 */
const toBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer)
  const CHUNK = 0x2000
  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}
