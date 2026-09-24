import { useRef, useState } from 'react'
import { formatMonth, yen } from '../lib/month'
import type { ImportResult } from '../lib/zaimImport'
import { ZaimImportError, decodeCsv, summarizeZaim, toReceipts } from '../lib/zaimImport'
import type { Receipt } from '../types'

type Props = {
  /** すでに取り込み済みの記録。入れ直しのときに消す対象になる */
  imported: Receipt[]
  onImport: (receipts: Receipt[]) => void
  onClearImported: (ids: string[]) => void
  onCancel: () => void
}

/**
 * ZaimのCSVを取り込む。
 *
 * いきなり書き込まず、何が入るかを見せてから確定させる。
 * カテゴリの対応表は当てずっぽうな部分があるので、
 * 中身を見ないまま入れると気づかないうちに集計がずれる。
 */
export const ImportSheet = ({ imported, onImport, onClearImported, onCancel }: Props) => {
  const fileInput = useRef<HTMLInputElement>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setError(null)
    setBusy(true)
    try {
      const text = decodeCsv(await file.arrayBuffer())
      setResult(summarizeZaim(text))
    } catch (err) {
      setResult(null)
      setError(
        err instanceof ZaimImportError
          ? err.message
          : `読み取れませんでした（${err instanceof Error ? err.message : String(err)}）`,
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="sheet">
      <header className="sheet__bar">
        <button className="btn btn--ghost" onClick={onCancel} type="button">
          やめる
        </button>
        <span className="sheet__title">Zaimから取り込む</span>
        <span className="sheet__spacer" />
      </header>

      <div className="sheet__body">
        {!result && (
          <>
            <p className="lead">
              月ごとの合計だけを取り込みます。
              <br />
              明細は取り込みません（Zaimに残るので二重に持たないため）。
            </p>
            <ol className="steps">
              <li>パソコンのブラウザでZaimにログインする</li>
              <li>設定 → ファイル入出力 →「Zaimの記録データをダウンロード」</li>
              <li>できたCSVをこの端末に送って、下から選ぶ</li>
            </ol>
            <p className="note">
              銀行・カード連携ぶんの出力はZaimのプレミアム機能です。
              <br />
              手入力ぶんだけでも、月の支出の目安としては十分使えます。
            </p>
            <p className="note">
              <strong>今月ぶんは取り込みません。</strong>
              このアプリでも今月を記録しているので、足し合わさって二重になるためです。
            </p>
          </>
        )}

        {result && (
          <>
            <p className="lead">
              {result.months.length}ヶ月ぶん（{formatMonth(result.months[0].month)}〜
              {formatMonth(result.months[result.months.length - 1].month)}）が入ります。
            </p>

            <ul className="list">
              {result.months.map((m) => (
                <li className="row row--plain" key={m.month}>
                  <span className="row__store">{formatMonth(m.month)}</span>
                  <span className="row__amount">{yen(m.total)}</span>
                </li>
              ))}
            </ul>

            <section className="section">
              <h2 className="section__title">読み取った内容</h2>
              <p className="note">
                支出 {result.rows.toLocaleString('ja-JP')}行を集計しました。
                <br />
                振替や収入など {result.skipped.toLocaleString('ja-JP')}行は、支出ではないので除いています。
              </p>
              {/*
                件数で書くと軽く見える。住宅ローンのように数件でも単価の大きいものが
                落ちていると金額では一気に効くので、割合を前に出して見逃せなくする。
              */}
              {result.unknown.length > 0 && (
                <div className="warn">
                  <p className="warn__text">
                    対応表に無いカテゴリが、支出の
                    <strong>{Math.round(result.unknownShare * 100)}%</strong>
                    を占めています。まとめて「その他」に入りました。
                  </p>
                  <p className="warn__note">{result.unknown.join('・')}</p>
                  {result.unknownShare >= 0.1 && (
                    <p className="warn__note">
                      これだけの割合が「その他」になると内訳が読めません。
                      このまま取り込まず、カテゴリ名を伝えて対応表に足してもらってください。
                    </p>
                  )}
                </div>
              )}
              {result.incomeMonthlyAverage > 0 && (
                <p className="note note--ok">
                  収入は月平均 {yen(result.incomeMonthlyAverage)} でした。
                  <br />
                  自動では入れないので、設定の「収入」に手で入れてください。
                </p>
              )}
            </section>
          </>
        )}

        {error && <p className="gate__error">{error}</p>}

        {imported.length > 0 && !result && (
          <section className="section">
            <h2 className="section__title">取り込み済み</h2>
            <p className="note">
              {imported.length}ヶ月ぶんが入っています。
              同じ月を取り込み直すと上書きされますが、
              範囲を狭めて入れ直すときは先に消してください。
            </p>
            <button
              className="btn btn--danger btn--block"
              onClick={() => {
                if (confirm(`取り込んだ${imported.length}ヶ月ぶんを消します。よろしいですか？`)) {
                  onClearImported(imported.map((r) => r.id))
                }
              }}
              type="button"
            >
              取り込んだぶんを消す
            </button>
          </section>
        )}
      </div>

      <footer className="sheet__foot">
        <input
          ref={fileInput}
          className="hidden"
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => void onFile(e)}
        />
        {result ? (
          <>
            <button className="btn btn--ghost" onClick={() => setResult(null)} type="button">
              選び直す
            </button>
            <button
              className="btn btn--primary btn--grow"
              onClick={() => onImport(toReceipts(result.months))}
              type="button"
            >
              取り込む
            </button>
          </>
        ) : (
          <button
            className="btn btn--primary btn--grow"
            onClick={() => fileInput.current?.click()}
            type="button"
            disabled={busy}
          >
            {busy ? '読み取り中…' : 'CSVを選ぶ'}
          </button>
        )}
      </footer>
    </div>
  )
}
