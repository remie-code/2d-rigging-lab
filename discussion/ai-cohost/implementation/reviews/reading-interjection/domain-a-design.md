# 「朗読と合いの手」wave — Domain A(魂: src/mind/) design/コード正当性レビュー

> レビュー担当: Review-Sylph(サブエージェント委任・Orch-Sylph より)。読み取り専任(コードは一切変更していない)。
> 検証方法: 実装ソース(`barge-in.mjs`/`fire-scheduler.mjs`)・`git diff HEAD`・`fire-orchestrator.test.mjs` diff・テストファイル本文・VAD セグメンタ契約(`speech-segmenter.mjs`)を自分で読み、`node --test` を自分の手元で実行して数字を裏取りした(Gnome の自己申告 domain-a.md/domain-a-fix1.md はクロスチェックのみに使用)。

## 総合判定: **PASS-with-nits**

blocking 基準 1・2・3・4・6 はいずれもコード上の根拠を伴って PASS。ただし基準 1 に関連する **1 件の疑義**(VAD セグメンタとの数値独立性による潜在的なギャップ・Domain A 単体では確定できずスコープ外の既存前提に依存)と、基準 6 に関連する **2 件の nit** がある。いずれも今回の Gnome 実装のバグではなく、設計裁定・裁量の記述精度に関する指摘。

## blocking 基準ごとの判定表

| # | 基準 | 判定 | コード根拠 |
|---|---|---|---|
| 1 | 猶予の意味論 | **PASS**(+疑義1件) | `barge-in.mjs:271-276`(speechCancel は `valveTimer != null` の時のみ効く=第一段限定)・`:277-283`(speechEnd は `graceTimer != null` の時のみ効く=第二段限定)。第一段中の speechEnd(:277 の分岐条件が false になるため無視)・第二段中の speechCancel(:271 の条件が false になるため無視)は共にコードの `if` ガードで構造的に排他。テスト `barge-in.test.mjs:208`(猶予中 speechEnd→取消)・`:224`(第一段中 speechEnd→無視)・`:242`(短い相槌<graceMs→無害)・`:279`(猶予超過→切断)・`:300`(猶予段中 speechCancel→無関係)で境界を固定。速断: **切断ゼロは onConfirm 呼び出し経路が graceTimer 満了コールバック(`:239-246`)の 1 箇所のみであり、speechEnd 到着で `clearGrace()`(:280-283)されれば当該コールバックは物理的に発火しない**——ここに漏れはない。 |
| 2 | トグルの完全性 | **PASS** | `barge-in.mjs:256`(`handle` 冒頭 `if (disposed || !enabled || ...) return;`)で OFF 中は全 VAD イベントを無視。`:295-302`(`setEnabled(false)` → `clearAll()` で第一段・第二段タイマーと `pendingEvent` を畳む)。`fire-scheduler.mjs:776-788`(`setEnabled(false)` → `endInterjectionRun()` 追加で run も畳む)。テスト `barge-in.test.mjs:404`(OFF 後は割り込みゼロ)・`:421`(猶予段進行中に OFF で畳まれる)・`:441`(第一段進行中に OFF で畳まれる)・`:460`(OFF→ON 復帰で新規発話は正常動作)で固定。gate 自身が `setEnabled`/`isEnabled` を持つ形は L0 設計裁定1どおり。 |
| 3 | 語彙の排他 | **PASS** | `fire-scheduler.mjs:601-606`(`onInterjectionGapTimer` は `endInterjectionRun()` を呼ぶのみで `emitFire` を一切呼ばない)。`emitFire("interjection")` の呼び出し箇所は `onInterjectionTimer`(:578)の 1 箇所のみで、これは run 中の `armInterjection()` が張る base+jitter タイマー(最短 chatty 30_000ms)からしか起動されない——2 秒という短い時間軸には構造的に現れない。`onTurnEndTimer`(:643-653)は同じ 2 秒境界(`turnEndSilenceMs`)で `armTurnEnd()`(armed へ入るだけ)を呼ぶのみで emit しない。テスト `fire-scheduler.test.mjs`「★ 2 秒境界の排他」で、2s 経過時点で `reqs.length===0`、その後の転写到着で `turn-end` のみが 1 件発火することを固定。**既存 5 語彙+manual の無改変**は `git diff HEAD -- fire-scheduler.mjs` で確認済み: `handleTranscript`/`handleChatMessage`/`onTurnEndTimer`/`armTurnEnd`/`disarmTurnEnd`/`onTurnEndArmTimeout` の関数本体は 1 行も変更されておらず、`handleVadEvent` の speechStart/speechEnd 分岐には既存行(`clearTurnEnd()`/`armSilence()`/`turnEndTimer=...`)がそのまま残ったまま `onSpeechStartForInterjection()`/`armInterjectionGapIfRunning()` の呼び出しが追記されているだけ(diff の `-` 行は既存コメント修正のみで、ロジック行の削除はゼロ)。 |
| 4 | KILL/NG/転写到着ゲート不変 | **PASS** | `git diff --stat HEAD -- fire-orchestrator.mjs ng-words.mjs` は空(無変更)。`fire-orchestrator.test.mjs` の diff は 10 行のみ(import 1 行 + `:1406` テストの `advance` を二段化 + コメント)——テストロジック自体(assert 対象・KILL/revive/ngBlocked/onSoulTranscript 系のテスト本体)は無改変で、`gateTimers.advance(200)` の後に `gateTimers.advance(BARGE_IN_GRACE_MS)` を追加しただけ。armed(転写到着ゲート)機構(`turnEndArmed`/`armTurnEnd`/`disarmTurnEnd`/`onTurnEndArmTimeout`・`handleTranscript` の call 優先・busy 再チェック `fire-scheduler.mjs:728-734`)はコード上無変更。自分の手元で `node --test`(apps/soul/agent 全体)を実行し **tests 863 / pass 863 / fail 0 / cancelled 0** を確認(Gnome の自己申告 §10.2 と一致)。個別実行 `node --test src/mind/barge-in.test.mjs src/mind/fire-scheduler.test.mjs src/mind/fire-orchestrator.test.mjs` も **152/152 pass**(28+58+66)。 |
| 6 | 不応期の意味論 | **PASS**(+nit 2件) | `onInterjectionTimer`(`fire-scheduler.mjs:568-580`): 不応期/busy で弾かれても `interjectionRunActive`/累積状態は一切変更せず `armInterjection()` で再武装するのみ(門番のみ・累積を止めない)。busy 弾き時も run は生きたまま再武装される(テスト「busy に弾かれても…」で固定・自分でも `node --test` で緑を確認)。 |

## 疑義(基準1関連・1件)

**「第一段中の speechEnd を無視する」設計判断の前提が、VAD セグメンタとの数値独立性により崩れうる。**

- `barge-in.mjs:168-170` のコメントは無視の根拠を「VAD 契約上 minSpeechMs 未満で終わる発話は speechCancel が先に来るはず」としている。しかし `speech-segmenter.mjs:124-143`(`finalize`)を読むと、この「minSpeechMs」は **VAD セグメンタ自身の `minSpeechMs`**(既定 250ms・`speech-segmenter.mjs:36`)であり、barge-in 側の `minSpeechMs`(既定 `BARGE_IN_MIN_SPEECH_MS=200ms`)とは**別の独立した定数**である。
- 本番結線(`cockpit-server.mjs:1240`)は `createBargeInGate` に `minSpeechMs`/`graceMs` を明示指定せず既定値(200ms/2000ms)に委ねている。VAD 側の `minSpeechMs` も `ear-pipeline.mjs:117-120` の `segmenterOptions` 組み立てを見る限り明示上書きの形跡が本ファイル内には無い(既定 250ms に委ねる経路がありうる。ただし実際の起動時 `pipelineOptions` は cockpit-server 外の呼び出し元が決めるため Domain A 単体では実値を確定できない)。
- もし VAD 側 `minSpeechMs`(250ms)> barge-in 側 `minSpeechMs`(200ms)のまま結線されているとすると: 200ms で barge-in は第一段通過→猶予段へ入るが、VAD はまだ発話を確定させていない(250ms 未満)。その後 200〜250ms の間に発話が終わった場合、VAD は `durationRaw < minSpeechMs` により **speechCancel を発火する(speechEnd ではない)**。barge-in の猶予段は speechCancel を無視する設計(`:271-276` は `valveTimer != null` の場合のみ効く=第一段限定)なので、猶予満了時に speechEnd 未着のまま `onConfirm`(切断)が呼ばれてしまう——VAD 視点では「スパイクとして棄却された発話」なのに barge-in が切断する、という「短い相槌は無害」の設計意図(裁定2)から外れるケースになりうる。
- **これは今回の二段構え導入で新規に生まれたリスクではない**(旧実装も第一段=200ms で即 confirm していたため、同じ数値関係の下で同種の誤爆はすでに起こりえた)。今回のスコープ(`barge-in.mjs`/`fire-scheduler.mjs`)の変更が悪化させたものではなく、VAD 層とbarge-in層の定数が独立に決められているという既存の設計前提に起因する。
- Domain A のテスト(`barge-in.test.mjs`)は `createSpeechSegmenter` を経由しない fake イベント注入なので、この相互作用はテストのスコープ外であり検出できない。

**Orch への質問**: 本番結線(cockpit-server.mjs もしくはその呼び出し元)で VAD セグメンタの `minSpeechMs` は実際どの値で起動されているか。もし既定 250ms のままなら、200〜250ms 帯の短い発話で「無害化されるはずの相槌」が誤って切断されうる境界ケースが残る。人間ゲートの朗読実射(§1②)で「短い相槌で切れないか」を確認する際、この境界(0.2〜0.25秒程度の極短い発声)も意識してもらえるとよい。blocking とまでは判断しないが(実配信の相槌はおそらくこれより長いことが多い)、followup 台帳に記録する価値はあると考える。

## nit(基準6関連・2件)

1. **再武装形の数値関係依存(domain-a.md §3.2/§9.2 で Gnome 自身も指摘済み)**: `fire-scheduler.mjs:555-561` のコメントは「v0 の全モードで `base = refractory × 2`」という関係に依拠して「弾かれてフル再武装しても次の一巡で不応期条件が必ず晴れる」と主張している。実際に必要な十分条件は **`base ≥ refractory`** だけで足りる(弾かれた瞬間の `now - lastFireAtMs` は `[0, refractory)` の範囲にあるので、次の武装後の満了時点での経過は `base + jitter ≥ base ≥ refractory` となり保証される)。事実、`fire-scheduler.test.mjs` の「不応期に弾かれても…」テスト自体が `interjectionBaseMs:3000, interjectionRefractoryMs:2000`(比 1.5倍・×2 ではない)というカスタム値で正しく動作しており、テストコード自身が「×2 でなくとも `base≥refractory` で十分」であることを暗に実証している。コメントの記述(×2 という特定比率への依存を強調)は現行 v0 定数の実際の値を反映してはいるが、機構として本当に必要な条件よりも狭く書かれており、将来の定数変更判断を誤誘導しうる。**修正提案**: コメントを「`base ≥ refractory` であれば 1 回の空振りで確実に回復する」という一般形に直すと、定数変更時の安全マージンの判断がしやすくなる。blocking ではない(現行定数は余裕を持って条件を満たしており、機械テストも緑)。
2. **他語彙による `lastFireAtMs` 共有の相互作用**: `fire-scheduler.test.mjs`「setVerbosity は run を仕切り直し…」のテストコメント(`chatty` 切替直後に `silence` が interjection の base 満了より先に発火し `lastFireAtMs` を書き換えてしまうため、テストは soul 転写で基点を明示的に揃えている)は、不応期チェックの基点が **全語彙共有**であることを示す実例。これは裁定どおりの仕様(不応期は「発火する瞬間の最低間隔チェックのみ」で全体の直近発火からの経過を見る)であり実装は正しいが、「連続して他の語彙(呼びかけ・コメント等)が発火し続ける」極端なケースでは interjection の不応期条件が繰り返し満たされず、`base+jitter` の累積速度を他語彙の発火頻度が上回り続ける限り理論上は先送りされ続ける(「全く発火しなくなる」の弱い形)。ただし run 自体は生き続け毎周期再判定されるため blocking 基準6(「ある段階から全く発火しなくなる」を作らない=run 生存中は常に機会がある)の文言には抵触しない——これは「busy が続く限り複数周期を空振りしうる」という Gnome 自身の記述(§3.2)と同種の許容されたトレードオフと判断する。nit として記録するのみ。

## 追加のコード健全性チェック結果

- **import 文ゼロ**: `grep -n "^import" barge-in.mjs fire-scheduler.mjs` は該当なし(exit 1)。両モジュールとも依存ゼロを維持。テスト内にも回帰確認テスト(`interjection: LLM 非依存の担保に抵触しない`)が固定されている。
- **タイマーリーク**: `barge-in.mjs` の `dispose()`/`setEnabled(false)` はいずれも `clearAll()`(`clearValve()`+`clearGrace()`+`pendingEvent=null`)を呼ぶ。`fire-scheduler.mjs` の `dispose()`/`setEnabled(false)`/`setVerbosity()` はいずれも `endInterjectionRun()`(`clearInterjectionTimer()`+`clearInterjectionGapTimer()`)を呼ぶ。テストで「dispose 後は…タイマーは残さない」が固定済み。イベントループへの残留は確認できない。
- **型注釈**: `@typedef FireRequest` の `kind` union に `"interjection"` を追加済み(`fire-scheduler.mjs:298`)、`emitFire` の型注釈(`:609-610`)も同様に更新済みで整合。
- **注入経由の決定論化**: `armInterjection`/`onInterjectionTimer`/`armInterjectionGapIfRunning` は全て `nowImpl()`/`rng()`(`clamp01` 経由)/`setTimeoutImpl`/`clearTimeoutImpl` のみを使用し、`Date.now`/`Math.random`/実 `setTimeout` への直接フォールスルーは無い(既定値としての `options.nowImpl ?? Date.now` 等はコンストラクタレベルの意図的な設計であり、テストでは全て注入済みで決定論を担保)。barge-in 側も同様(`setTimeoutImpl`/`clearTimeoutImpl` のみ使用・時計非依存)。

## 検証手順のまとめ(裏取りの根拠)

- `git diff HEAD -- apps/soul/agent/src/mind/{barge-in.mjs,fire-scheduler.mjs,fire-orchestrator.test.mjs}` を自分で全文読み、既存経路の非改変を確認。
- `git diff --stat HEAD -- fire-orchestrator.mjs ng-words.mjs` が空であることを確認(KILL/NG 検問所の器コード不変)。
- `node --test`(apps/soul/agent 全体)を自分の手元で実行し、tests 863 / pass 863 / fail 0 / cancelled 0 を確認。
- `node --test src/mind/barge-in.test.mjs src/mind/fire-scheduler.test.mjs src/mind/fire-orchestrator.test.mjs` を実行し 152/152 pass を確認。
- `speech-segmenter.mjs`(VAD セグメンタ本体)を読み、`finalize()` の speechEnd/speechCancel 排他契約を確認した上で barge-in の裁量判断の妥当性を検証(疑義1件を発見)。

## Orch への質問(まとめ)

1. VAD セグメンタの本番結線 `minSpeechMs` の実値(既定 250ms のままか、上書きされているか)を確認できるか。200〜250ms 帯の短い発声で barge-in が誤って切断しうる境界ケースの実害有無を判断する材料になる。
2. nit1(再武装形コメントの一般化)・nit2(他語彙との `lastFireAtMs` 共有の記録)は followup 台帳送りでよいか、それとも Domain A の追加修正として今扱うべきか。
