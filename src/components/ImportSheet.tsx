import { useRef, useState } from 'react'
import { formatMonth, monthOf, thisMonth, yen } from '../lib/month'
import type { ImportResult } from '../lib/zaimImport'
import { ZaimImportError, decodeCsv, summarizeZaim, toReceipts } from '../lib/zaimImport'
import type { Receipt } from '../types'

type Props = {
  /** すでに取り込み済みの記録。入れ直しのときに消す対象になる */
  imported: Receipt[]
  /**
   * このアプリで記録がある月（YYYY-MM）。
   * その月を取り込むと二重になるので、はじめから外しておく。
   */
  ownMonths: Set<string>
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
export const ImportSheet = ({
  imported,
  ownMonths,
  onImport,
  onClearImported,
  onCancel,
}: Props) => {
  const fileInput = useRef<HTMLInputElement>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  /**
   * 選ばせる月（今月と、アプリにも記録がある月）を入れるか。キーが無い月は「まだ選んでいない」。
   * 既定値をstateの初期値にすると読み取り直しのときに引き直せないので、
   * 選んでいないあいだは毎回アプリの記録から導く。
   */
  const [choice, setChoice] = useState<Record<string, boolean>>({})
  const included = (month: string) => choice[month] ?? !ownMonths.has(month)

  const candidates = result
    ? [...result.months, ...(result.currentMonth ? [result.currentMonth] : [])]
    : []
  const askable = candidates.filter(
    (m) => m === result?.currentMonth || ownMonths.has(m.month),
  )
  const months = candidates.filter((m) => included(m.month))
  const withCurrent = result?.currentMonth ? included(result.currentMonth.month) : false
  const hasOwnThisMonth = ownMonths.has(thisMonth())
  const importedMonths = new Set(imported.map((r) => monthOf(r.date)))

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setError(null)
    setChoice({})
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
              {ownMonths.size > 0 ? (
                <>
                  <strong>このアプリでも記録している月は、はじめから外してあります。</strong>
                  足し合わさって二重になるためです。
                  入れるかどうかは、読み取ったあとで月ごとに選べます。
                </>
              ) : (
                <>今月ぶんを入れるかどうかは、読み取ったあとで選べます。</>
              )}
            </p>
          </>
        )}

        {result && (
          <>
            <p className="lead">
              {months.length === 0 ? (
                <>入る月がありません。下で入れる月を選んでください。</>
              ) : (
                <>
                  {months.length}ヶ月ぶん（{formatMonth(months[0].month)}〜
                  {formatMonth(months[months.length - 1].month)}）が入ります。
                </>
              )}
            </p>

            <ul className="list">
              {months.map((m) => (
                <li className="row row--plain" key={m.month}>
                  <span className="row__store">
                    {formatMonth(m.month)}
                    {m === result.currentMonth && <span className="row__note">月の途中まで</span>}
                  </span>
                  <span className="row__amount">{yen(m.total)}</span>
                </li>
              ))}
            </ul>

            {askable.length > 0 && (
              <section className="section">
                <h2 className="section__title">入れるか選ぶ月</h2>
                {askable.map((m) => (
                  <label className="check" key={m.month}>
                    <input
                      type="checkbox"
                      checked={included(m.month)}
                      onChange={(e) => setChoice((c) => ({ ...c, [m.month]: e.target.checked }))}
                    />
                    <span>
                      {formatMonth(m.month)}ぶん（{yen(m.total)}）も取り込む
                      {ownMonths.has(m.month) && <span className="row__note">アプリにも記録あり</span>}
                    </span>
                  </label>
                ))}
                <p className="note">
                  アプリにも記録がある月は、両方入れると同じ支出を二重に数えることになるので、外しておくのが無難です。
                  {askable.some((m) => importedMonths.has(m.month)) && (
                    <>外しても、前に取り込んだぶんは消えずに残ります。</>
                  )}
                </p>
                {result.currentMonth && !hasOwnThisMonth && (
                  <p className="note">
                    今月ぶんは、このアプリにまだ記録がありません。入れておくと今月が空になりません。
                    これから今月ぶんをこのアプリで記録するなら、そのぶんは二重になります。
                  </p>
                )}
              </section>
            )}

            <section className="section">
              <h2 className="section__title">読み取った内容</h2>
              <p className="note">
                支出 {(result.rows + (withCurrent ? result.currentRows : 0)).toLocaleString('ja-JP')}
                行を集計しました。
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
              onClick={() => onImport(toReceipts(months))}
              type="button"
              disabled={months.length === 0}
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
