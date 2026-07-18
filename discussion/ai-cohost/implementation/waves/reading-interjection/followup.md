# 「朗読と合いの手」follow-up 記録: wave 内で対応しない持ち越し事項

> Status: 記録開始（2026-07-18, Gnome / Domain B）。台帳の流儀は
> [../s6/s6-followup.md](../s6/s6-followup.md) を踏襲。
> 出典: Domain A レビュー（spec/design/test 3 レーン）で挙がり、Orch-Sylph が「本 wave では対応しない・
> followup 送り」と判定した 3 件 + Domain B 実装時に確認した記録用 1 件。

## 1. 疑義: VAD minSpeechMs 独立性（非 blocking・pre-existing）

VAD セグメンタの `minSpeechMs` 既定 250ms（`apps/soul/agent/src/ears/speech-segmenter.mjs:36`）と
barge-in の `minSpeechMs` 既定 200ms（`apps/soul/agent/src/mind/barge-in.mjs:204` 付近の
`BARGE_IN_MIN_SPEECH_MS`）は、名前は似ているが**独立した別定数**である。

- 200〜250ms 帯の極短い発声は、barge-in 側の第一段（200ms）は通過して猶予段（第二段）に入るが、
  VAD セグメンタ側は 250ms 未満を `speechCancel` として出す（`speechEnd` ではない）ため、猶予段は
  「取り消されないまま」2 秒後に満了して切断されうる。
- これは「短い相槌（<2 秒）は無害になる」という裁定 2 の副次効能の**穴**になりうる（相槌自体が
  200〜250ms 帯に収まるほど短い場合、VAD 側が speechCancel を出すため barge-in の第一段で弾かれ猶予に
  すら入らない可能性が高いが、VAD の閾値と barge-in の閾値がズレている以上、境界付近の挙動は理論上
  「猶予に入るのに取消弁（speechEnd）が来ない」ケースを排除できない）。
- **今回の wave の新規バグではない**——barge-in.mjs の `BARGE_IN_MIN_SPEECH_MS=200` 自体は Domain A 着手
  前から存在する定数で、VAD 側の `minSpeechMs=250` との不整合は本 wave が持ち込んだものではなく既存の
  定数独立性に起因する。ただし猶予段（第二段）の新設で「取消弁が来ないと 2 秒後に切断される」という
  帰結が新たに顕在化しうるため、記録する。
- **人間ゲートでの確認材料**: §1②（かぶって 2 秒以内に発話をやめれば続行）の実射で「極短い発声
  （0.2〜0.25 秒）で切れないか」を確認する。
- **将来対応候補**（未実施・v0 では手を付けない）: (a) 両 `minSpeechMs` を同値に揃える、(b) 猶予段でも
  `speechCancel` を取消弁として扱う（ただし現行設計裁定は「speechCancel は第一段のみに効く」——防御的に
  第二段では無視する選択をしている。barge-in.mjs のコメント参照）。どちらも本 wave のスコープ外。

## 2. nit: 合いの手の再武装コメントが「base=refractory×2」に依存した書き方(non-blocking)

`apps/soul/agent/src/mind/fire-scheduler.mjs` の `armInterjection`/`onInterjectionTimer` 周辺コメント
（Domain A 実装）は、不応期で弾かれてもフル再武装すれば次周期で確実に不応期条件が晴れる根拠として
「v0 の全モードで `interjectionBaseMs = interjectionRefractoryMs × 2`」という**具体的な数値関係**を
挙げている。実際に成立に必要な十分条件は `interjectionBaseMs ≥ interjectionRefractoryMs`（× 2 という
係数は必須ではない）であり、コメントの書き方は将来の定数変更判断を誤誘導しうる（「× 2 の関係を壊さない
ように」という過剰に狭い制約だと読める）。

- **対応**: 本 wave では未実施（Domain A の実装への手直しはスコープ外・コメントの言い回しの nit）。
- **将来対応候補**: コメントを「base ≥ refractory であれば次周期で不応期条件が必ず晴れる」という
  一般化した表現に書き換える。定数変更時（口数モードの見直し等）にこの一般化条件だけを守ればよいと
  分かるようにする。

## 3. nit: interjection の不応期基点（lastFireAtMs）が全語彙共有(non-blocking)

`lastFireAtMs` は呼びかけ/区切り/沈黙/コメント/comment-call/合いの手の**全語彙共有**の不応期基点
（fire-scheduler.mjs の既存設計・裁定 6 で明記済み「発火する瞬間の最低間隔チェックのみ」）。他の語彙が
高頻度で発火し続ける極端なケース（例: コメントが立て続けに来て comment/comment-call が連発する配信）
では、合いの手の不応期チェック（`now - lastFireAtMs < interjectionRefractoryMs`）が毎回引っかかり、
合いの手が先送られ続ける可能性がある（「ある段階から全く発火しなくなる」の弱い形——run 自体は生きて
再武装し続けるので完全に発火しなくなるわけではないが、他語彙の発火頻度によっては長時間出ない）。

- **これは裁定 6 どおりの仕様**（不応期は全語彙共有の既存設計・busy による先送りと同種の許容
  トレードオフ）であり、本 wave のバグではない。記録のみ（対応不要・non-blocking）。
- 実配信で「合いの手が思ったより出ない」体感が出た場合、原因切り分けの手がかりとしてこの記録を参照
  されたい（interjection 専用の不応期基点を分離する、という設計変更は将来の閉問題候補）。

## 4. Domain B 実装時の裁量・確認事項（記録）

- **`git diff --stat -- apps/runtime-player "packages/" "pnpm-lock.yaml"` は空**（器/packages/root
  lockfile 不接触の自己確認・domain-b.md §参照）。
- **app.mjs（`src/cockpit/ui/app.mjs`）への配線追加はタスク指示に明記されていなかったが、Domain B の
  裁量で実施した**: `settingsFromSnapshot` に `bargeIn` キーを追加し、`ControlBar` へ
  `bargeIn=${settings.bargeIn}` を渡す配線をしないと、control-bar.mjs に追加した `BargeInPill` が
  実際に snapshot の bargeIn 現況を受け取れず機能しないため（selfFire/verbosity/killed と同型の配線）。
  同様に `styles.mjs` へ `.barge-in-pill`/`.barge-in-toggle`/`.barge-in-status` の CSS を追加した
  （`.self-fire-pill` 系の写経・視覚的に pill として機能させるための最小限追加）。詳細は domain-b.md
  §裁量判断を参照。
