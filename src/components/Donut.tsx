import type { BucketTotal } from '../lib/aggregate'
import { yen } from '../lib/month'

type Props = {
  buckets: BucketTotal[]
  total: number
}

/**
 * 半径と線の太さ。viewBoxは160×160で、実際の大きさはCSSで決める。
 * 線を太くすると輪が太くなり、穴が小さくなる。
 */
const R = 60
const WIDTH = 28
const CIRCUMFERENCE = 2 * Math.PI * R

/**
 * カテゴリの内訳を円グラフ（ドーナツ）で見せる。
 *
 * ライブラリは入れずにSVGを直に描く。やることは円弧を並べるだけで、
 * グラフの部品を足すとその時点で初期表示が重くなる。
 *
 * 円弧は stroke-dasharray で作る。円を1本描いて「実線をこの長さ、あとは空白」に
 * すれば弧になり、dashoffset をずらすと開始位置が動く。path の計算より短く書ける。
 *
 * 割合が主役なので金額は下の一覧に出す。円の中は合計にしない（すぐ上に出ているため）。
 */
export const Donut = ({ buckets, total }: Props) => {
  if (total <= 0) return null

  // 多い順に並べる。円は大きい弧から始まるほうが読みやすい。
  // 棒グラフはカテゴリの定義順（月をまたいで比べるため）なので、ここでだけ並べ替える
  const sorted = [...buckets].sort((a, b) => b.amount - a.amount)

  // 12時から時計回りに並べる。SVGの0度は3時なので全体を回しておく。
  // 開始位置は手前の弧の長さの合計。多くて12本なので毎回足し直してよい
  const arcs = sorted.map((b, i) => {
    const before = sorted.slice(0, i).reduce((a, x) => a + x.amount, 0)
    return {
      ...b,
      length: (b.amount / total) * CIRCUMFERENCE,
      offset: -(before / total) * CIRCUMFERENCE,
    }
  })

  const top = sorted[0]
  const topShare = Math.round((top.amount / total) * 100)

  return (
    <div className="donut">
      <svg
        className="donut__svg"
        viewBox="0 0 160 160"
        role="img"
        aria-label={sorted
          .map((b) => `${b.bucket} ${Math.round((b.amount / total) * 100)}%`)
          .join('、')}
      >
        <g transform="rotate(-90 80 80)">
          {/* 記録が1つしかない月でも輪に見えるよう、下地を敷いておく */}
          <circle cx="80" cy="80" r={R} fill="none" stroke="var(--line)" strokeWidth={WIDTH} />
          {arcs.map((a) => (
            <circle
              key={a.bucket}
              cx="80"
              cy="80"
              r={R}
              fill="none"
              stroke={a.color}
              strokeWidth={WIDTH}
              strokeDasharray={`${a.length} ${CIRCUMFERENCE - a.length}`}
              strokeDashoffset={a.offset}
            />
          ))}
        </g>
        {/* いちばん使ったものを穴に出す。円を見て名前を探す手間を省く */}
        <text className="donut__top" x="80" y="76" textAnchor="middle">
          {top.bucket}
        </text>
        <text className="donut__share" x="80" y="96" textAnchor="middle">
          {topShare}%
        </text>
      </svg>

      <ul className="legend">
        {sorted.map((b) => (
          <li className="legend__row" key={b.bucket}>
            <span className="legend__dot" style={{ background: b.color }} />
            <span className="legend__name">{b.bucket}</span>
            <span className="legend__amount">{yen(b.amount)}</span>
            <span className="legend__share">{Math.round((b.amount / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
