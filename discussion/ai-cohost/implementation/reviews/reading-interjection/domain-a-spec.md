# Domain A(魂: src/mind/)spec 遵守レビュー

> レビュアー: Review-Sylph(spec 遵守レーン・読み取り専任)。呼び出し元: Orch-Sylph。
> 対象: `apps/soul/agent/src/mind/barge-in.mjs` / `fire-scheduler.mjs`(実装ソースを自ら通読して検証。Gnome 自己申告は鵜呑みにせず file:line で裏取り)。
> 参照: `discussion/ai-cohost/implementation/orchestration/reading-interjection-inventory.md`(§2/§4/§5)・`reading-interjection-wave-plan.md`(§1-3)・`discussion/ai-cohost/implementation/waves/reading-interjection/domain-a.md`・`domain-a-fix1.md`。
> 実測: `node --test src/mind/barge-in.test.mjs src/mind/fire-scheduler.test.mjs src/mind/fire-orchestrator.test.mjs`(apps/soul/agent にて自分で実行)→ `tests 152 / pass 152 / fail 0 / cancelled 0`(28+58+66 の Gnome 申告と一致)。`git status --porcelain apps/soul/agent/` で変更が 5 ファイル(barge-in.mjs / barge-in.test.mjs / fire-orchestrator.test.mjs / fire-scheduler.mjs / fire-scheduler.test.mjs)のみであること、`fire-orchestrator.mjs`(SOURCE)が変更対象に出てこない=不変であることを自分で確認済み。

## 総合判定: **PASS**(nit 2 件・blocking なし)

## 裁定ごとの判定表

| # | 論点 | 判定 | ソース根拠 |
|---|---|---|---|
| 1 | barge-in トグル(setEnabled/isEnabled・既定 ON・OFF=猶予もろとも無効) | PASS | `barge-in.mjs:295-305`(setEnabled/isEnabled 実装)・`:216`(`let enabled = options.enabled !== false;` = 既定 true)・`:298-301`(`if (!enabled) clearAll();` で第一段・第二段タイマーと pendingEvent を両方畳む)・`:256`(`if (disposed \|\| !enabled \|\| ...) return;` で OFF 中は全 VAD イベント無視=新規タイマー起動もゼロ)。OFF で onConfirm へ至る経路は構造的にゼロ。 |
| 2 | 切断猶予(BARGE_IN_GRACE_MS=2000・猶予内 speechEnd で続行・満了で切断) | PASS | `barge-in.mjs:38`(`export const BARGE_IN_GRACE_MS = 2000;`)・`:266-270`(第一段通過で即座に `startGrace()`)・`:239-247`(猶予満了時 `onConfirm` = 切断)・`:277-284`(猶予中の speechEnd で `clearGrace()+pendingEvent=null` = 切られず続行)。短い相槌(<2s)は猶予中に speechEnd が届くため無害になる副次効能も成立。 |
| 3 | 第 7 語彙 interjection は確率を掛けない | PASS | `fire-scheduler.mjs:568-580`(`onInterjectionTimer`)の判定は `isBusy() \|\| now - lastFireAtMs < interjectionRefractoryMs` のみ。`rng()`/probability チェックが存在しない(turn-end `:649` や comment `:763` にある `clamp01(rng()) >= probability` 相当が interjection には無い)。 |
| 4 | 連続の意味論(間隙<2s=継続・2s 以上で切れ区切りへ委譲・turnEndSilenceMs 共用・切れたらリセット) | PASS | `fire-scheduler.mjs:583-593`(`onSpeechStartForInterjection`: gapTimer が動いていれば取消=run 継続、なければ未開始時のみ新規開始)・`:596-600`(`armInterjectionGapIfRunning` が `turnEndSilenceMs` を共用)・`:601-606`(`onInterjectionGapTimer` → `endInterjectionRun()` で run 終了・emitFire なし)・`:550-554`(`endInterjectionRun` が `interjectionRunActive=false` + 両タイマー畳み=累積リセット)。turn-end 側の speechEnd 処理(`:668-680`)も同じ `turnEndSilenceMs` でタイマーを張るため境界を共有。 |
| 5 | 口数連動(base 30/60/120s・ジッター 15/30/60s・不応期 15/30/60s・normal は既存定数参照) | PASS | `fire-scheduler.mjs:318-364`(`VERBOSITY_BUNDLES`): chatty `interjectionBaseMs:30_000/Jitter:15_000/Refractory:15_000`・normal は `:345-347` で `INTERJECTION_BASE_MS`(`:168`=60_000)/`INTERJECTION_JITTER_MS`(`:174`=30_000)/`INTERJECTION_REFRACTORY_MS`(`:181`=30_000)への参照・quiet `:330-332` で `120_000/60_000/60_000`。各バンドル 12 キー(9→12 値)を確認。 |
| 6 | 不応期の意味論(発火瞬間の門番のみ・累積を止めない) | PASS | `fire-scheduler.mjs:568-580`: 不応期/busy で弾かれても `armInterjection()` で再武装するのみ(`interjectionRunActive` は不変=run は生き続ける)。run の継続自体は VAD イベント(`onSpeechStartForInterjection`/`armInterjectionGapIfRunning`)駆動で不応期判定と独立しており、不応期は「発火実行の可否」だけを左右する。 |
| 7 | 予算なし | PASS | `fire-scheduler.mjs` 全体を通読。`silenceBudget`(`:476`)・`commentBudget`(`:479`)に相当する `interjectionBudget` 変数は存在せず、`onInterjectionTimer`(`:568-580`)にも予算チェックがない。 |
| 9 | 発火時の累積リセット(自発火で仕切り直し) | PASS | `fire-scheduler.mjs:577-579`(`lastFireAtMs = now; emitFire("interjection"); armInterjection();`)。`armInterjection()` は新たな base+jitter でタイマーを張り直す(run 自体=`interjectionRunActive` は true のまま継続=「次はまた一から測る」の実装)。 |
| L0-① | gate 自身に setEnabled(server は委任のみ) | PASS | `barge-in.mjs:249-310` の返り値オブジェクトに `setEnabled`/`isEnabled` が実装されている(gate 自身が状態を持つ)。server 側の委任は Domain B 領分でここでは確認対象外。 |
| L0-② | createBargeInGate の拡張(別層を作らない) | PASS | `barge-in.mjs:199-311` の同一関数 `createBargeInGate` 内に `graceTimer`/`startGrace` を追加しているだけで、新規モジュールや別レイヤーは作られていない。 |
| L0-③ | kind 文字列 "interjection"(日本語テーブルなし・FireRequest 型に追加) | PASS | `fire-scheduler.mjs:298`(`@typedef {{ kind: "call" \| "turn-end" \| "silence" \| "comment" \| "comment-call" \| "interjection" }} FireRequest`)。`grep "interjection" barge-in.mjs` は無マッチ(barge-in には語彙概念が漏れていない)。日本語テーブルに相当するコードは存在しない。 |
| 分業確認 | scheduler は kind を出すだけで vision マッピングをしない | PASS | `grep "vision" fire-scheduler.mjs` は無マッチ。`emitFire`(`:609-617`)は `{ kind }` のみを `onFireRequest` に渡す。vision:"preferred" へのマッピングは Domain B(cockpit-server.mjs)の領分であることが構造的に担保されている。 |

## 境界条件の追加確認(裁定4/blocking 基準3 の核心)

2 秒境界での同時発火排他: `onInterjectionGapTimer`(`fire-scheduler.mjs:601-606`)は `endInterjectionRun()` を呼ぶのみで `emitFire` を一切呼ばない。interjection の `emitFire("interjection")` は `onInterjectionTimer`(run 中の base+jitter タイマー・最短でも chatty の 30s)からのみ発生し、2 秒という短い時間軸には構造的に現れない。一方 turn-end 側の `onTurnEndTimer`(`:643-653`)も 2 秒境界では `armTurnEnd()`(armed へ入るだけ)を呼ぶのみで emit しない。実測でも「★ 2 秒境界の排他」テスト(`fire-scheduler.test.mjs`)が緑であることを自分の `node --test` 実行で確認した。PASS。

## nit(blocking ではない)

1. **不応期再武装の依存関係についての Gnome 申し送りは実際には過度な懸念**: `domain-a.md` §9.2-2 で Gnome は「base=refractory×2 の数値関係が崩れると(refractory を base 以上にすると)次の周期でも不応期に引っかかり続ける可能性がある」と申し送っているが、`onInterjectionTimer` の不応期判定は `now - lastFireAtMs < interjectionRefractoryMs` であり、`lastFireAtMs` は他の発火（呼びかけ等）がない限り固定・`now` は単調増加するため、run が生き続ける限り複数周期後には必ず条件を満たさなくなる(1 周期で晴れない可能性はあるが「全く発火しなくなる」ことにはならない)。実害はないが、README や定数コメントに「数周期で必ず解消する」という正確な性質を書き足すと今後の定数変更時の誤解を防げる(Domain B の docs 更新 or followup 台帳向けの参考情報)。
2. **「猶予段中の新規 speechStart 無視」は Gnome の独自裁量ではなく inventory の L0 裁定に既出**: `domain-a.md` §8-3 は「裁量判断」として記載しているが、`reading-interjection-inventory.md` §4-2 に「猶予段中に新たな speechStart が来た場合は無視する(裁量・成果物に根拠明記」と既に明記されており、`barge-in.mjs:170-172` のコメントもその文言をほぼ踏襲している。実装は spec 通りで問題ないが、報告書の位置づけ表現がやや紛らわしい(実質は既定路線の実装確認であり、Gnome が新たに選んだ選択肢ではない)。

## Orch への質問

なし。裁定 9 件・L0 設計裁定 3 件・分業境界のいずれについても実装ソースと突き合わせて不一致を検出しなかった。`fire-orchestrator.test.mjs` のスコープ拡張(Domain A 領分と Orch-Sylph が判定した件)についても `fire-orchestrator.mjs`(SOURCE)が不変であることを自分で確認しており、spec 遵守レーンとして異論はない。
