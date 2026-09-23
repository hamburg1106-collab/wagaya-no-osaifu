export const APP_NAME = 'わが家のお財布'

/**
 * 家計のデータを置く場所。`kakeibo/{HOUSEHOLD_ID}/...`。
 *
 * 1世帯しか使わないので固定の文字列でよい。ここは秘密ではなく、
 * 保護はFirestoreのルールに書いた夫婦2人のuidで行う。
 */
export const HOUSEHOLD_ID = 'wagaya'

/** 見通しを何ヶ月先まで出すか */
export const FORECAST_MONTHS = 60

/** Gemini APIキー。コードには書かず、端末ごとに設定画面から入れてもらう */
export const API_KEY_KEY = 'osaifu:geminiKey'

/** 最後に開いていたタブ。次に開いたとき同じ画面に戻す */
export const TAB_KEY = 'osaifu:tab'

/**
 * レシート解析に使うモデル。
 * Flash系には無料枠がある。無料枠では入力がGoogleの製品改善に使われるため、
 * 止めたくなったらAPIキーのプロジェクトで課金を有効にする（コードの変更は不要）。
 *
 * モデル名が変わって404になったら、ここだけ直せばよい。
 * 設定画面は失敗時にAPIからのメッセージをそのまま出すので、原因が分かる。
 */
export const GEMINI_MODEL = 'gemini-3.8-flash'

/**
 * 支出のカテゴリ。Geminiにはこの一覧からしか選ばせない（responseSchemaのenum）。
 * 設定画面から増やせるようにはしない。二人で使うと似たカテゴリが増えて集計が崩れるため。
 */
export const CATEGORIES = [
  '食費',
  '日用品',
  '外食',
  '子ども',
  '医療・薬',
  '衣類',
  '交通',
  '娯楽・趣味',
  '交際費',
  'その他',
] as const

/**
 * 固定費の置き場所。上の10個とは別枠にして、ホームでも1本のバーにまとめる。
 * 毎月ほぼ同額なので、変動費と混ぜるとグラフが固定費で埋まって何も見えなくなる。
 */
export const FIXED_BUCKET = '固定費'

/** ホームのバーの色。カテゴリの並び順と対応させる */
export const BUCKET_COLORS: Record<string, string> = {
  固定費: '#7a8b99',
  食費: '#2f7a5e',
  日用品: '#4a9d7c',
  外食: '#d98b3a',
  子ども: '#e06b8b',
  '医療・薬': '#5b8fd9',
  衣類: '#9b6bd9',
  交通: '#4aa8b8',
  '娯楽・趣味': '#d9a83a',
  交際費: '#c25e5e',
  その他: '#a0a0a0',
}

/** 圏外でgetDocが固まるのを防ぐ待ち時間 */
export const NETWORK_TIMEOUT_MS = 8000
