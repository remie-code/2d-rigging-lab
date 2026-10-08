# 「朗読と合いの手」follow-up 記録: wave 内で対応しない持ち越し事項

> Status: 記録開始（2026-07-18, Gnome / Domain B）。台帳の流儀は
> [../s6/s6-followup.md](../s6/s6-followup.md) を踏襲。
> 出典: Domain A レビュー（spec/design/test 3 レーン）で挙がり、Orch-Sylph が「本 wave では対応しない・
> followup 送り」と判定した 3 件 + Domain B 実装時に確認した記録用 1 件。

## 1. [解決済み] VAD minSpeechMs 独立性の疑義 → L0 裁定改訂で speechCancel を両段の取消弁化

> 解決日: 2026-07-18（Gnome・微修正タスク）。L0 裁定改訂によりコード反映済み。以下は元の疑義記録
> （経緯保存のため残す）+ 解決内容。

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

**解決内容（L0 裁定改訂）**: speechCancel は VAD にとって「あれは発話ではなかった」という取消宣言であり、
第一段・猶予段のどちらにいてもその意味は変わらない——当初裁定「speechCancel は第一段のみに効く」は
狭すぎた、との改訂裁定に基づき、`createBargeInGate` の `handle()` を「猶予段（第二段）中の speechCancel
も見合い成立と同じ扱い（onConfirm を呼ばない = 切らない）で猶予を取り消す」よう拡張した
（`apps/soul/agent/src/mind/barge-in.mjs` の speechCancel 分岐・モジュールヘッダの二段構え説明も改訂）。
第一段の既存挙動・speechEnd の挙動・setEnabled/dispose は不変。200〜250ms 帯の極短発声で猶予段中に
speechCancel が来ても onConfirm は呼ばれなくなった（`barge-in.test.mjs` に固定テストを追加・
「極短発声(200〜250ms帯)が第一段通過直後に speechCancel で終わっても猶予取消」）。
両 `minSpeechMs` を同値に揃える対応（旧記録の (a) 案）は不要となったため見送り。

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
