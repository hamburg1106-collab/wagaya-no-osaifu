import { CATEGORIES, GEMINI_MODEL } from '../config'
import type { Category, ParsedReceipt } from '../types'
import type { Shrunk } from './image'
import { todayKey } from './month'

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models'

/**
 * responseSchemaを付けると必ずこの形のJSONが返る。
 * 付けないと前置きの文章が混ざってパースに失敗する。typeは大文字。
 */
const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    date: { type: 'STRING', description: 'レシートの日付。YYYY-MM-DD形式' },
    store: { type: 'STRING', description: '店名' },
    total: { type: 'INTEGER', description: 'レシートに印字された支払総額' },
    items: {
      type: 'ARRAY',
      description: 'カテゴリごとに合算した内訳',
      items: {
        type: 'OBJECT',
        properties: {
          category: { type: 'STRING', enum: [...CATEGORIES] },
          amount: { type: 'INTEGER' },
        },
        required: ['category', 'amount'],
      },
    },
  },
  required: ['date', 'store', 'total', 'items'],
}

const PROMPT = `このレシートを読み取って、家計簿に記録する内容をJSONで返してください。

ルール:
- dateはレシートの日付。読み取れなければ空文字にする（勝手に今日にしない）
- totalは実際に支払った金額。割引やポイント利用を引いたあとの支払総額
- itemsは商品を1行ずつではなく、カテゴリごとに合算して返す
  例: スーパーで食品5点と洗剤1点なら「食費」1行と「日用品」1行の計2行
- itemsの金額の合計はtotalと一致させる。端数が合わないときは一番大きいカテゴリで調整する
- 割引行・ポイント値引き・お預り・お釣りは商品ではないので、itemsに入れない
- 判断に迷う商品は「その他」ではなく、一番近いカテゴリに寄せる

カテゴリの目安:
- 食費: スーパーや商店で買った食材、飲料、菓子
- 外食: 飲食店での食事、テイクアウト、カフェ
- 日用品: 洗剤、トイレットペーパー、台所用品、消耗品
- 子ども: おむつ、ベビーフード、おもちゃ、子ども服
- 医療・薬: 病院、処方薬、市販薬
- 衣類: 大人の衣類、靴
- 交通: ガソリン、駐車場、切符、タクシー
- 娯楽・趣味: 本、ゲーム、レジャー施設、趣味の道具
- 交際費: 手土産、贈答品、お祝い`

export class GeminiError extends Error {}

/** レシート画像を解析する。失敗したらGeminiが返したメッセージをそのまま投げる */
export const analyzeReceipt = async (image: Shrunk, apiKey: string): Promise<ParsedReceipt> => {
  const res = await fetch(`${ENDPOINT}/${GEMINI_MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: PROMPT },
            { inline_data: { mime_type: image.mimeType, data: image.base64 } },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
      },
    }),
  })

  if (!res.ok) {
    // APIからのメッセージをそのまま見せる。モデル名の変更やキーの権限不足がここで分かる
    const body: unknown = await res.json().catch(() => null)
    const message = (body as { error?: { message?: string } } | null)?.error?.message
    throw new GeminiError(message ?? `解析に失敗しました（HTTP ${res.status}）`)
  }

  const data: unknown = await res.json()
  return normalize(parseJson(extractText(data)))
}

/**
 * candidates[0].content.parts から本文を取り出す。
 * 思考パート（thought: true）が混ざるので、除いてから連結する。
 */
const extractText = (data: unknown): string => {
  const parts = (
    data as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] }
  )?.candidates?.[0]?.content?.parts
  const text = (parts ?? [])
    .filter((p) => !p.thought && typeof p.text === 'string')
    .map((p) => p.text)
    .join('')
  if (!text) throw new GeminiError('レシートを読み取れませんでした。撮り直してください')
  return text
}

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text)
  } catch {
    throw new GeminiError('解析結果を読み取れませんでした。撮り直してください')
  }
}

const isCategory = (v: unknown): v is Category => CATEGORIES.includes(v as Category)

/** enumやINTEGERを指定していても外れ値が返ることはあるので、保存前にここで均す */
const normalize = (raw: unknown): ParsedReceipt => {
  const r = raw as Partial<ParsedReceipt> | null
  const items = (Array.isArray(r?.items) ? r.items : [])
    .map((it) => ({
      category: isCategory(it?.category) ? it.category : ('その他' as Category),
      amount: Math.round(Number(it?.amount) || 0),
    }))
    .filter((it) => it.amount !== 0)

  const total = Math.round(Number(r?.total) || 0)

  return {
    // 日付が読めなければ今日にしておく（確認画面で直せる）
    date: /^\d{4}-\d{2}-\d{2}$/.test(r?.date ?? '') ? (r?.date as string) : todayKey(),
    store: (r?.store ?? '').trim(),
    total,
    // 内訳が1行も取れなかったときは、合計をそのまま1行にして確認画面に出す
    items: items.length > 0 ? items : [{ category: 'その他', amount: total }],
  }
}
