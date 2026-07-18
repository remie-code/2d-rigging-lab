# 「朗読と合いの手」wave — Domain A(魂: src/mind/)実装報告

> 実装者: Gnome(サブエージェント委任・Orch-Sylph より)。
> 対象: `apps/soul/agent/src/mind/barge-in.mjs` / `fire-scheduler.mjs` とそれぞれの `.test.mjs`(4 ファイルのみ)。
> 根拠文書: [reading-interjection-wave-plan.md](../../../orchestration/reading-interjection-wave-plan.md)・[reading-interjection-inventory.md](../../../orchestration/reading-interjection-inventory.md)。

## 1. 変更ファイル一覧

- `apps/soul/agent/src/mind/barge-in.mjs`(修正)
- `apps/soul/agent/src/mind/barge-in.test.mjs`(修正)
- `apps/soul/agent/src/mind/fire-scheduler.mjs`(修正)
- `apps/soul/agent/src/mind/fire-scheduler.test.mjs`(修正)

上記 4 ファイル以外は一切変更していない(`git diff --stat` の生出力は §7 に記載・4 ファイルのみであることを確認済み)。

## 2. barge-in.mjs: 二段構えの実装要点

### 2.1 定数

- `export const BARGE_IN_GRACE_MS = 2000;` を新設(第二段=猶予段の既定時間)。既存 `BARGE_IN_MIN_SPEECH_MS = 200` は不変。

### 2.2 状態遷移(二段構え)

`createBargeInGate` 内部に、第一段用と第二段用で**別々のタイマー変数**を持たせた:

- `valveTimer`(第一段・既存のノイズ弁。**挙動は完全不変**): `speechStart` で張り、窓内(`minSpeechMs`)に `speechCancel` が来たら取消。`speechCancel` は第一段のみに効く(猶予段中は無視)。
- `graceTimer`(第二段・新設): 第一段通過(`valveTimer` 満了・`speechCancel` が来なかった)で**即座に**起動する。`speechEnd` が猶予段中に届いたら取消(= 見合い成立・`onConfirm` を呼ばない)。`speechEnd` は第二段のみに効く(第一段中は無視 — VAD 契約上 minSpeechMs 未満で終わる発話は `speechCancel` が先に来るはずという既存の前提を維持する防御的な選択)。猶予(`graceMs`)が満了して `speechEnd` が来ていなければ `onConfirm`(切断)。

状態遷移表(簡略):

| 現在の状態 | speechStart | speechCancel | speechEnd | タイマー満了 |
|---|---|---|---|---|
| idle | 第一段開始 | (無視) | (無視) | — |
| 第一段(valveTimer) | 張り替え(新オンセット優先・既存不変) | 第一段取消→idle | (無視) | 第一段通過→即座に第二段開始 |
| 第二段(graceTimer) | 無視(裁量・§8 参照) | (無視) | 第二段取消(見合い成立)→idle | `onConfirm`(切断)→idle |

`onConfirm` のコールバック契約(渡す値・呼ばれる意味=「barge-in 確定=切断」)は不変。変わったのは発火タイミング(200ms → 200+2000ms の合成・発話継続時のみ)と `speechEnd` の役割(無視 → 第二段の取消弁)だけ。

### 2.3 setEnabled/isEnabled(トグル)

- `enabled` は gate 自身が持つ内部状態。既定 `true`(barge-in 裁定 1「既定 ON」)。`options.enabled`(既定 true)で初期値を注入可能——実装は `options.enabled !== false`(fire-scheduler の `options.enabled === true`(既定 false)とは意図的に非対称)。
- `setEnabled(false)` は `clearAll()`(第一段・第二段タイマーと `pendingEvent` を両方畳む)を呼ぶ。これにより OFF 遷移時に `onConfirm` へ至る経路が完全にゼロになる(進行中の弁・猶予いずれの途中でも安全)。
- OFF 中は `handle()` の冒頭 `if (disposed || !enabled || ...) return;` で全 VAD イベントを無視する。
- `isEnabled()` は現在値を返すだけ。

### 2.4 isPending の二段扱い

`isPending()` は `valveTimer != null || graceTimer != null` — 第一段・第二段いずれかが進行中なら true(§8 の裁量参照)。`dispose()` は既存どおり全タイマーを畳む(`clearAll()` を呼ぶ点は setEnabled(false) と共通)。

## 3. fire-scheduler.mjs: interjection(合いの手)実装要点

### 3.1 run 追跡の状態機械

新設した状態:

- `interjectionRunActive`(boolean): 連続発話 run が進行中か。
- `interjectionTimer`: run 中の合いの手タイマー(base+jitter で武装)。
- `interjectionGapTimer`: run 終了検出用の間隙タイマー(`turnEndSilenceMs` を共用)。

イベント処理(`handleVadEvent` に追記。**既存の call/turn-end/silence/comment/comment-call の分岐は 1 行も変更していない**):

- `speechStart` → `onSpeechStartForInterjection()`: `interjectionGapTimer` が動いていれば取消するだけ(run 継続・**合いの手タイマーは張り替えない**=そのまま走り続ける)。動いていなければ、`interjectionRunActive` が false の場合のみ run を新規開始(`interjectionRunActive = true` + `armInterjection()`)。
- `speechEnd` → `armInterjectionGapIfRunning()`: run 進行中(`interjectionRunActive` 真)の場合のみ間隙タイマー(`turnEndSilenceMs`)を起動。満了(`onInterjectionGapTimer`)すると `endInterjectionRun()`(`interjectionRunActive=false` + 両タイマー畳み = 累積リセット)を呼ぶ。**ここでは `emitFire` しない**(2 秒境界の排他の担保・§3.4)。

### 3.2 合いの手タイマーの武装/再武装(裁量・根拠)

`armInterjection()` は run 開始時・発火直後・不応期/busy で弾かれた時のいずれからも呼ばれる共通関数で、**silence の `armSilence()` と同型**(base + `floor(rng()*jitter)` で武装するだけ)。

**選んだ再武装形**: 不応期/busy で弾かれた場合も **フル再武装(base+jitter)** する(短い固定間隔での再試行ではなく、silence の写経と同じ「次の一巡をまるごと張り直す」方式)。

**根拠**: v0 の全モードで `interjectionBaseMs = interjectionRefractoryMs × 2` の関係になっている(chatty 30s/15s・normal 60s/30s・quiet 120s/60s)。そのため、不応期で弾かれてフル再武装しても、**次の満了時点では必ず `base ≥ refractory` 分の時間が経過しており、不応期条件は次の一巡で確実に晴れる**(`fire-scheduler.test.mjs` の「不応期に弾かれても…」テストで実測固定)。busy はタイミング予測が不可能なので busy が続く限り複数周期を空振りしうるが、これは「busy 中は喋れない」の自然な帰結であり、「run が生きている限り毎周期必ず再判定される」という性質(=「ある段階から全く発火しなくなる」状態を作らない・blocking 基準 6)は保たれる。短い固定間隔での再試行(例: 1000ms ごとの再チェック)という選択肢も検討したが、既存コードの流儀(`armSilence` と同型の再武装関数)に忠実であることを優先し、上記の base>refractory の数値関係がそれを正当化できると判断してフル再武装を採用した。

### 3.3 発火時の処理(`onInterjectionTimer`)

```
満了 → disposed/!enabled/!interjectionRunActive なら何もしない
     → isBusy() || (now - lastFireAtMs < interjectionRefractoryMs) なら emit せず armInterjection() で再武装
     → 通れば lastFireAtMs=now; emitFire("interjection"); armInterjection()(累積リセット=新たな一巡)
```

### 3.4 2 秒境界の排他(blocking 基準 3)の担保方法

- 合いの手の間隙タイマー(`turnEndSilenceMs` 共用)満了時のハンドラ `onInterjectionGapTimer` は `endInterjectionRun()` を呼ぶだけで **`emitFire` を一切呼ばない**。
- 合いの手の `emitFire("interjection")` は `onInterjectionTimer`(run 中の base+jitter タイマー・最短でも chatty の 30s)からのみ起こりうる。この経路は 2 秒という短い時間軸には現れない。
- 一方、区切り応答(turn-end)の `onTurnEndTimer` は同じ 2 秒境界(`turnEndSilenceMs`)で `armTurnEnd()`(armed へ入るだけ・emit しない)を呼ぶ。
- 結果として、2 秒境界というタイミングでは「turn-end が armed に入る」ことと「interjection の run が終了する」ことの両方が起こりうるが、**どちらも `emitFire` を呼ばない**——2 語彙が同時に発火することは構造的に起こりえない。テスト「★ 2 秒境界の排他」で、2 秒後に reqs が空であること、その後の転写到着で turn-end のみが発火すること、旧 run の合いの手タイマーが畳まれ発火しないことを固定した。

### 3.5 VERBOSITY_BUNDLES 9→12 値・新規 export 定数

- `INTERJECTION_BASE_MS = 60_000` / `INTERJECTION_JITTER_MS = 30_000` / `INTERJECTION_REFRACTORY_MS = 30_000` を新設 export。
- `VERBOSITY_BUNDLES` の quiet/normal/chatty それぞれに `interjectionBaseMs`/`interjectionJitterMs`/`interjectionRefractoryMs` を追加(quiet: 120000/60000/60000・normal: 上記 export 定数への参照・chatty: 30000/15000/15000)。normal は既存の流儀どおり export 定数への参照(値の単一の源)。

### 3.6 FireRequest 型拡張・setVerbosity/setEnabled/dispose での仕切り直し

- `@typedef FireRequest` の `kind` union に `"interjection"` を追加。`emitFire` の型注釈も同様に更新。
- `createFireScheduler` の options に `interjectionBaseMs`/`interjectionJitterMs`/`interjectionRefractoryMs` を追加(`numberOr(options.x, initialBundle.x)` の既存流儀どおり)。
- `setEnabled(false)`・`setVerbosity(mode)`・`dispose()` はいずれも `endInterjectionRun()` を呼び、run・合いの手タイマー・間隙タイマーを畳んで仕切り直す。`setEnabled(true)` では run を再開しない(speechStart 待ち=「朗読が始まっていないなら run は未開始のまま」という仕様どおり)。

## 4. 既存 barge-in テストの二段化更新(各テストの変更理由)

| テスト名(旧→新) | 変更理由 |
|---|---|
| 「speechStart 後 minSpeechMs 経過で確定」→「第一段通過後、第二段も発話継続で満了すると確定(二段の合成)」 | 旧は 200ms で `onConfirm` を期待していたが、新設計では第一段通過は即座に第二段へ移行するだけなので、200ms 到達時点で「まだ確定しない」ことを追加確認し、さらに 2000ms(既定 graceMs)経過して初めて確定することを固定した。 |
| 「窓内に speechCancel が来たら確定しない」 | **変更なし**(第一段のみの話で新設計とも矛盾しないため、そのまま維持)。 |
| 「speechEnd は機械弁に無関係」→ 3 テストに分割 | 旧テストは speechStart 直後(第一段中)に speechEnd を送り 200ms で `onConfirm` を期待していたが、新設計では speechEnd は第二段(猶予中)のみに効く「取消弁」になったため、旧テストの主張(speechEnd は無関係)を保つ形と、新しい取消挙動を固定する形の両方が必要になった。3 分割: ①「猶予中の speechEnd は確定を取り消す(新意味論)」、②「第一段中の speechEnd は無視する(第一段の挙動不変)」、③「短い相槌(<graceMs)は無害」。 |
| 「連続 speechStart は待機を張り替える」 | 第一段の張り替え挙動自体は不変だが、確定に至るタイミングが 200ms→200+2000ms に伸びたため、advance 幅と assert のタイミングを二段構成に追随させた。 |
| 「dispose 後は待機タイマを畳み以後のイベントも無視」 | **変更なし**(第一段のみのシナリオで新設計と矛盾しないため、そのまま維持)。 |
| 「既定 minSpeechMs(未指定)は BARGE_IN_MIN_SPEECH_MS」→「既定 minSpeechMs/graceMs(未指定)は BARGE_IN_MIN_SPEECH_MS/BARGE_IN_GRACE_MS」 | 第二段の既定値(`BARGE_IN_GRACE_MS`)も未指定時に正しく使われることを追加で固定するため、既定値確認を二段に拡張した。 |

## 5. 追加/更新したテスト一覧

### barge-in.test.mjs(28 テスト・元 16 → +12)

- 定数テストに `BARGE_IN_GRACE_MS` の存在確認を追加。
- 「猶予中の speechEnd は確定を取り消す」「第一段中の speechEnd は無視する」「短い相槌(<graceMs)は無害」「猶予超過(speechEnd 未着)で切断する」「猶予段中に speechCancel が来ても無関係」「猶予段中の新たな speechStart は無視する(裁量固定)」を新規追加。
- 「既定 enabled=true・setEnabled/isEnabled で切替できる」「options.enabled=false で初期 OFF」「OFF トグル: setEnabled(false) 後は割り込みゼロ」「OFF トグル: 猶予段進行中に OFF で畳まれる」「OFF トグル: 第一段進行中に OFF で畳まれる」「OFF→ON 復帰: 新規 speechStart は通常どおり機能する」を新規追加。

### fire-scheduler.test.mjs(58 テスト・元 48 → +10)

- 「v0 定数(base/jitter/refractory)が export される・VERBOSITY_BUNDLES は 12 値」— 新規 3 定数と 12 値束の存在・normal の参照一致を固定。
- 「間隙 < turnEndSilenceMs の speechStart は run を継続する」— 連続の意味論(裁定 4)を固定。
- 「間隙が turnEndSilenceMs(2s) に達したら run が終了する」— run 終了で累積リセットされることを固定。
- 「run 中に base+jitter 満了で発火・lastFireAtMs 更新・再武装され再発火しうる」— 累積→発火→リセット→再累積の一巡を固定(裁定 9)。
- 「不応期に弾かれても累積は殺されず再武装し、不応期明けに再判定で発火する」— 裁定 6・blocking 基準 6 を固定。
- 「busy に弾かれても累積は殺されず再武装し、busy が明けたら発火する」— busy 再試行を固定。
- 「setVerbosity は run を仕切り直し(畳む)、以後の run は新モードの値で武装する」— 口数連動(裁定 5)を固定。
- 「★ 2 秒境界の排他」— blocking 基準 3 の核心を固定(§3.4 参照)。
- 「setEnabled(false) で run は畳まれ…ON 復帰では run は未開始のまま」— 仕切り直しの契約を固定。
- 「LLM 非依存の担保に抵触しない(import ゼロのまま・回帰確認)」— 依存ゼロの維持を再確認。

## 6. node --test の生サマリ

### 実装前(ベースライン・git stash で 4 ファイルを一時退避して確認)

`apps/soul/agent` で `node --test src/mind/fire-orchestrator.test.mjs`(§8 の申し送りに関連するファイルの実装前状態確認):

```
# tests 66
# suites 0
# pass 66
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

(barge-in.test.mjs / fire-scheduler.test.mjs 自体の実装前の生数字は個別に控えていないが、wave 計画記載のベースライン合計は 842。)

### 実装後・対象 2 テストファイルのみ

`node --test src/mind/barge-in.test.mjs src/mind/fire-scheduler.test.mjs`:

```
# tests 86
# suites 0
# pass 86
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

(barge-in.test.mjs 単体: tests 28 / pass 28 / fail 0。fire-scheduler.test.mjs 単体: tests 58 / pass 58 / fail 0。)

### 実装後・apps/soul/agent 全体(初回・追撃修正前)

`node --test`(package.json の `"test": "node --test"`):

```
# tests 863
# suites 0
# pass 846
# fail 0
# cancelled 17
# skipped 0
# todo 0
# duration_ms 1948.4765
```

**cancelled 17 の内訳(重要・§8/§9.1 参照)**: 全て `src/mind/fire-orchestrator.test.mjs` 由来。同ファイルを単体実行すると `tests 66 / pass 49 / fail 0 / cancelled 17`(実装前は同ファイルで `pass 66 / cancelled 0` だったことを上記で確認済み)。

**この cancelled 17 は §10 の追撃修正(fire-orchestrator.test.mjs の二段化)で解消済み。最終の全緑数字は §10 を参照。**

## 7. git diff --stat の生出力

```
$ git diff --stat -- apps/soul/agent/src/mind/barge-in.mjs apps/soul/agent/src/mind/barge-in.test.mjs apps/soul/agent/src/mind/fire-scheduler.mjs apps/soul/agent/src/mind/fire-scheduler.test.mjs
 apps/soul/agent/src/mind/barge-in.mjs            | 150 ++++++++++---
 apps/soul/agent/src/mind/barge-in.test.mjs       | 271 +++++++++++++++++++++--
 apps/soul/agent/src/mind/fire-scheduler.mjs      | 187 ++++++++++++++--
 apps/soul/agent/src/mind/fire-scheduler.test.mjs | 246 ++++++++++++++++++++
 4 files changed, 795 insertions(+), 59 deletions(-)
```

`git status --porcelain apps/soul/agent/` で確認したところ、`apps/soul/agent` 配下で変更されているのはこの 4 ファイルのみ(他は既存の未追跡変更であり本タスクでは不接触)。

## 8. 裁量判断とその根拠(まとめ)

1. **合いの手タイマーの再武装形**: フル再武装(base+jitter)を採用。根拠は §3.2(base = refractory×2 の関係により次の一巡で不応期条件が必ず晴れる)。
2. **isPending の二段扱い**: 第一段・第二段いずれかが進行中なら true とした(「barge-in 確定に向けて何か進行中」という利用者視点の直感に合わせた・タスク指示で明示的に裁量とされていた点)。
3. **猶予段中の新たな speechStart の扱い**: 無視することにした(§2.2 表・barge-in.mjs 内コメントに根拠を明記)。猶予段は既に「話し始めた」ことが確定した状態であり、次の一巡は speechEnd による見合い成立後の新オンセットからのみ始まる、という設計にした。VAD セグメンタの通常契約(1 発話につき speechStart は 1 回)を前提にした防御的選択であり、もし実際の VAD が猶予中に複数回 speechStart を出す挙動を持つなら、人間ゲートでの体感を踏まえて見直す余地がある。
4. **第一段中の speechEnd の扱い**: 無視することにした(第一段の挙動は完全不変という制約を守るため)。VAD 契約上 minSpeechMs 未満で終わる発話は speechCancel が先に来るはずという既存の前提を踏襲した防御的選択。

## 9. レビューへの申し送り・不確実点・質問

### 9.1 重要な申し送り(要対応・機械ゲートに影響)

**`src/mind/fire-orchestrator.test.mjs`(本タスクのスコープ外ファイル)で 17 個のテストが `cancelledByParent` になっている。** 具体的には:

- 「結線: createBargeInGate 確定 → orchestrator.interrupt(VAD 縦検証・全 fake)」(1406 行目)と「結線: 窓内 speechCancel は interrupt を呼ばず自然完了する」の 2 テストが、`gateTimers.advance(200)` の後すぐに `onConfirm`(= `orch.interrupt()`)が呼ばれることを前提にしている。二段構え導入後は、`minSpeechMs: 200` を明示指定していても `graceMs` は未指定のため既定 `BARGE_IN_GRACE_MS=2000` の第二段に入り、200ms だけでは `onConfirm` に到達しない。そのため `await` している Promise が解決されずタイムアウトし、同ファイル内の後続テスト(kill/revive/ngBlocked/onSoulTranscript 系、計 17 個)が連鎖的に `cancelledByParent` になる。
- **実装前にこの事実を検証済み**: `git stash` で本タスクの 4 ファイルを一時退避し、`node --test src/mind/fire-orchestrator.test.mjs` を実行したところ `pass 66 / cancelled 0`(全緑)だった。stash を戻すと `pass 49 / cancelled 17` になる。これは二段構え導入の直接的かつ設計裁定どおりの帰結であり、私の実装のバグではないと判断している。
- **このファイルはタスク指示で明示的にスコープ外(4 ファイルのみ)とされているため、私は修正していない。** 修正案(参考・未実施): 該当 2 テストの `gateTimers.advance(200)` の後に `gateTimers.advance(BARGE_IN_GRACE_MS)`(または明示的な `graceMs` 相当の advance)を追加すれば、新しい二段タイミングに対応できるはず。Domain B の結線更新と合わせて、このファイルの該当テストも新しい二段タイミングに揃える対応が必要と考える。
- **wave 計画の機械ゲート「node --test 全緑(ベースライン 842)」は、この申し送り事項が解消されるまで満たせない。** Orch-Sylph・Domain B 側での対応方針(このファイルの更新をどちらのドメインが担うか)の判断を仰ぎたい。

> **【解決済み・§10 参照】** Orch-Sylph の判定でスコープを 5 ファイル目 `fire-orchestrator.test.mjs`(src/mind/ 配下=Domain A の責務)まで拡張し、追撃修正を実施した。全体 `node --test` は cancelled 0 / fail 0 / **pass 863** で全緑に到達。

### 9.2 不確実点・質問

1. **猶予段中の新たな speechStart の扱い(§8-3)**: 無視する設計にしたが、実際の VAD セグメンタが猶予中に複数回 speechStart を出す挙動を取りうるかは実配信ログでの裏取りをしていない。人間ゲートの実射で不自然な挙動(例: 相槌の後にすぐ本発話を始めた場合の取りこぼし)が見つかれば、pendingEvent を最新の speechStart に張り替える設計への変更を検討されたい。
2. **合いの手タイマーの再武装形(§3.2/§8-1)**: フル再武装を選んだが、これは「不応期で 1 回だけ弾かれれば次の周期で必ず晴れる」という数値関係(base=refractory×2)に依存した設計判断であり、口数モードの定数を将来変更する際にこの関係が崩れると(例: refractory を base と同じかそれ以上にすると)、次の周期でも不応期に引っかかり続ける可能性がある。定数変更時はこの関係を維持するか、再武装ロジック自体を見直す必要がある旨、README や口数モード定数のコメントへの追記を検討されたい(Domain B の docs 更新時の参考情報として)。
3. **FireRequest の "interjection" kind が vision:"preferred" として扱われること(wave 計画 §3 Domain B の担当)は、Domain A 側では検証していない**(scheduler は kind を出すだけで、vision マッピングは cockpit-server.mjs の既存 else 分岐が自動的に拾う設計と理解している・inventory §3 に記載の裏取り済み事実に基づく)。Domain B 側でのテスト固定を期待する。

## 10. 追撃修正(fire-orchestrator.test.mjs・スコープ拡張後)

> 経緯: §9.1 の申し送りを受け、Orch-Sylph が「`fire-orchestrator.test.mjs` は src/mind/ 配下=Domain A の責務」と判定し、スコープを 5 ファイル目まで拡張して追撃修正を委任した。`fire-orchestrator.mjs`(SOURCE)は不変(本番結線は cockpit-server.mjs=Domain B にあり、gate を構築するのはテスト側だけ)。今回触ったのは `fire-orchestrator.test.mjs` の 1 ファイルのみ。

### 10.1 変更点

`apps/soul/agent/src/mind/fire-orchestrator.test.mjs`:

1. **import 追加**: `barge-in.mjs` から `BARGE_IN_GRACE_MS` を import(既存の `createBargeInGate, BARGE_IN_NOTE, KILL_NOTE, MOUTH_CLOSE_TTL_MS` の行に追加)。
2. **:1406「結線: createBargeInGate 確定 → orchestrator.interrupt」の advance を二段化**: `gate.handle({type:"speechStart", tMs:1200})` の後、`gateTimers.advance(200)`(第一段=ノイズ弁通過)に続けて `gateTimers.advance(BARGE_IN_GRACE_MS)`(第二段=猶予満了・speechEnd 未着で発話継続)を追加した。これで `onConfirm`→`orch.interrupt(1300)` が発火し `await p` が解決する。`interrupt(1300)` の中断時刻は advance 量と独立なので `result.replyText === "こん"`(elapsed 300 → 2 母音)の assert は不変のまま通った。二段化の意図(200ms 弁通過→2000ms 猶予満了で切断)が advance に現れるようコメントも追随させた。
3. **:1448「窓内 speechCancel は interrupt を呼ばず自然完了」は無改変**: 委任指示どおり実測で確認したところ、二段構えでも第一段中(150ms 時点)の `speechCancel` で弁が取り消され猶予段に入らないため、そのまま通った(`interruptCount === 0` / `pl.calls.stop === 0`)。不要な改変はしていない。
4. **その他 15 テストの cascade cancel は :1406 修正で自然回復**: :1406 のタイムアウトが原因で `cancelledByParent` になっていた kill/revive/ngBlocked/onSoulTranscript 系 15 テストは、:1406 が解決したことで連鎖が解け、全て緑に戻った。

### 10.2 追撃修正後の node --test 生サマリ(自分で実行)

`node --test src/mind/fire-orchestrator.test.mjs`(単体):

```
# tests 66
# suites 0
# pass 66
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 177.7964
```

`node --test`(apps/soul/agent 全体):

```
# tests 863
# suites 0
# pass 863
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1779.9092
```

**全緑到達**: cancelled 17 → **0**・fail 0・pass 846 → **863**。

### 10.3 追撃修正後の git diff --stat 生出力(5 ファイル)

```
$ git diff --stat -- apps/soul/agent/src/mind/barge-in.mjs apps/soul/agent/src/mind/barge-in.test.mjs apps/soul/agent/src/mind/fire-scheduler.mjs apps/soul/agent/src/mind/fire-scheduler.test.mjs apps/soul/agent/src/mind/fire-orchestrator.test.mjs
 apps/soul/agent/src/mind/barge-in.mjs              | 150 ++++++++++--
 apps/soul/agent/src/mind/barge-in.test.mjs         | 271 ++++++++++++++++++++-
 .../soul/agent/src/mind/fire-orchestrator.test.mjs |  10 +-
 apps/soul/agent/src/mind/fire-scheduler.mjs        | 187 ++++++++++++--
 apps/soul/agent/src/mind/fire-scheduler.test.mjs   | 246 +++++++++++++++++++
 5 files changed, 802 insertions(+), 62 deletions(-)
```

`git status --porcelain apps/soul/agent/` で確認したところ、`apps/soul/agent` 配下の変更はこの 5 ファイルのみ(`fire-orchestrator.mjs` SOURCE は不変・barge-in.mjs / fire-scheduler.mjs / それぞれの .test.mjs は追撃修正では追加変更なし)。
