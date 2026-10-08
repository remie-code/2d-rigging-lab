# 「朗読と合いの手」wave — Domain B(配線+操縦席+docs)design/コード正当性レビュー

> レビュー担当: Review-Sylph(サブエージェント委任・Orch-Sylph より)。読み取り専任。
> レーン: design/コード正当性(blocking 基準 2・5 + 配線の健全性 + 裁量追加の妥当性)。
> 対象: Domain B 実装(`apps/soul/agent/src/cockpit/cockpit-server.mjs` ほか。file:1 参照)。
> 検証方法: `git diff` 精読(全 diff hunk を実際に読んだ)・関連ソースの直接 Read/Grep・
> `node --test`(apps/soul/agent)実行による自己申告数値の裏取り・エンドポイント/SSE 種別の実カウント。
> 根拠文書: [reading-interjection-wave-plan.md](../../orchestration/reading-interjection-wave-plan.md)・
> [reading-interjection-inventory.md](../../orchestration/reading-interjection-inventory.md)・
> [domain-b.md](../../waves/reading-interjection/domain-b.md)(Gnome 自己申告・検証対象)。

## 総合判定: **PASS**

blocking 基準 2・5 とも file:line 根拠付きで充足を確認。裁量追加 3 件はいずれも許容範囲(1 件は
followup 送りが妥当な既存事実)。`node --test`(apps/soul/agent)を実際に実行し、自己申告どおり
**886/886 pass**(duration ~7.2s)を独立に確認した。

## 1. 基準ごとの判定表

| # | 基準 | 判定 | コード根拠 |
|---|---|---|---|
| 2 | トグルの完全性(born-disabled) | PASS | `cockpit-server.mjs:1287-1290`(gate 構築時 `enabled: bargeInInitialEnabled` 注入・構築後 setEnabled 後追いコードは存在しない)・`cockpit-server.mjs:445`(`const bargeInInitialEnabled = options.bargeInInitialEnabled !== false;`)・`scripts/cockpit.mjs:707-710`(`bargeInHooks.resolveInitialEnabled()` を `bargeInInitialEnabled` へ直接渡す配線)・`src/mind/barge-in.mjs:216`(`let enabled = options.enabled !== false;` で構築時 enabled を正しく反映・Domain A 既存実装)。テスト: `cockpit-server.test.mjs`(born-disabled 2 種・VAD speechStart 送信+フル猶予待ちで interrupt 呼び出し 0/1 を対比)を実行し pass 確認。 |
| 5 | ワイヤ契約 additive | PASS | POST: `cockpit-server.mjs` 内 `pathname ===` 分岐を実カウントし 20 件(既存 19+`/api/barge-in`:950 の 1 件)を確認・既存 19 件は 1 つも削除/改名なし。snapshot: `cockpit-server.mjs:544`(`bargeIn: bargeInGate ? {...} : null`)が `selfFire`(:542)の直後に追加されているのみで他キー無変更。SSE: `broadcast("...")` の呼び出しを実カウントし `chatDiagnostic/chatStatus/diagnostic/discard/expression/fire/selfFire/soul/state/transcript/usage/vad/visionCaptured` の 13 種で新規イベント名なし(interjection は既存 `selfFire` に kind 文字列として素通し)。コメント追随: `cockpit-server.mjs:279,1112`(「既存 19→20 エンドポイント」)は実カウントと一致。 |
| onFireRequest 無改修 | PASS | `git diff -- cockpit-server.mjs` に `req && req.kind === "silence" ? ... : ...` の行(現行 `cockpit-server.mjs:1343-1345`)は一切出現せず(コメント追記のみ・:1305-1315 に新設コメント3行)。実ファイルで該当行を確認し diff に含まれないことと突き合わせ、無変更を確定。 |
| 既存機構(KILL/NG/転写到着ゲート/llm-session.mjs)不変 | PASS | `git diff --stat` を `llm-session.mjs`/`kill*`/`ng-*` に絞って実行し出力ゼロ(無接触)。`src/mind/*` 5 ファイルは Domain A の成果物であり Domain B の diff には一切含まれない(domain-b.md §1 の申告どおり・cockpit-server.mjs の diff 内でも `createBargeInGate`/`createFireScheduler` は import のみで定義側は不変)。 |

## 2. 裁量追加 3 件の評価

### 2.1 `fireSchedulerFactory` テスト注入オプション(cockpit-server.mjs) — **許容(裁量として妥当)**

- ①既存パターンとの同型性: `cockpit-server.mjs:1326-1328` で `typeof options.fireSchedulerFactory === "function" ? options.fireSchedulerFactory : createFireScheduler` という形。既存の `fireOrchestratorFactory`/`pipelineFactory`(同ファイル内の options JSDoc・既存の未指定時デフォルトフォールバックパターン)と完全に同型であることをコードで確認した。
- ②本番挙動不変: `scripts/cockpit.mjs` の diff(`createCockpitServer({...})` 呼び出し箇所、:707-712 付近)に `fireSchedulerFactory` は一切登場しない。未指定 → 常に `createFireScheduler` にフォールバックするため本番挙動は不変と確認できる。
- ③HTTP ワイヤ契約への無影響: `fireSchedulerFactory` は `options` オブジェクトの内部実装詳細であり、POST/GET エンドポイント・snapshot キー・SSE イベント名のいずれにも現れない(基準5の対象外であることを実カウントで確認済み)。
- ④是非の評価: 本番コードへ「テストのためだけの seam」を足す行為ではあるが、(a) 既存に 2 件の precedent があり規律として確立している、(b) 本番パスは変更されない、(c) options 経由の DI は一般的なテスト容易性パターンである、という理由で許容範囲と判断する。
- 代替案(seam なし): fire-scheduler.mjs 自体が持つ `nowImpl`/`rng`/`setTimeoutImpl` の注入口(inventory §3 記載)を cockpit-server の options 経由でそのまま貫通させ、本物の `createFireScheduler` を fake clock で駆動して interjection の実発火→onFireRequest 呼び出しを end-to-end で検証する手もあった。ただしこの場合 3 本の注入ラインを server レベルまで通す必要があり、コード面積は `fireSchedulerFactory` 1 個より増える。また Domain A(fire-scheduler 内部ロジック)と Domain B(cockpit-server の分岐ロジック)の関心を分離する設計としては、今回採用された「factory 丸ごと差し替えて onFireRequest コールバックのみを直接検証」の方が筋が良いと判断した。
- 既存語彙(call/turn-end/comment/comment-call)は本物の fireScheduler へ実イベント(VAD/転写/チャット)を注入することで onFireRequest を自然発火させてテストしている(`cockpit-server.test.mjs:1268,1411,1630` 付近で確認)のに対し、interjection はタイマー駆動のみで即時発火経路がなく同じ手法が使えない、という非対称性がある。この構造的差異が `fireSchedulerFactory` 追加の必要性を裏付けている。
- **結論**: blocking ではない。Gnome の質問(domain-b.md §7-6: 許容されない場合の代替方針)には「今回の形で許容」と回答してよい。

### 2.2 `app.mjs`/`styles.mjs` 追加 — **許容(必須の最小配線)**

- `app.mjs` diff(2 箇所・4 行): `settingsFromSnapshot` に `bargeIn: (s && s.bargeIn) ?? null` を追加、`<${ControlBar}>` 呼び出しに `bargeIn=${settings.bargeIn}` を追加。`selfFire`/`verbosity`/`killed` と全く同型の配線であることを diff で確認した。
- 必然性: この配線がなければ `BargeInPill` は snapshot の `bargeIn` を永久に受け取れず「not available」のまま描画され機能しない、という Gnome の主張はコードで裏付けられる(`ControlBar` は props 経由でしか `bargeIn` を受け取れない・`app.mjs` が唯一の橋渡し点)。
- `styles.mjs` diff: `.barge-in-pill`/`.barge-in-toggle`/`.barge-in-status` の 3 クラスのみ追加、`.self-fire-pill` 系の写経で `.pill-label` 等の共通クラスは再利用。過剰な変更は見当たらない。
- **結論**: タスク指示(B-4)に明記が無い追加だが、指示された `control-bar.mjs`/`control.mjs` の変更を実際に機能させるために構造的に必須な配線であり、範囲は最小。blocking ではない。

### 2.3 born-disabled テストの実タイマー待ち(~2.4秒) — **現状許容・followup 送りが妥当**

- `cockpit-server.mjs` 内で `setTimeoutImpl`/`nowImpl` を grep したところ、使用箇所は `createInMemorySettingsStore`(:183 付近)とサーバ全体の uptime 計算(:425 付近)のみで、`createBargeInGate`(:1287)にも `fireSchedulerFactory` 経由の `createFireScheduler` 呼び出し(:1328)にもタイマー注入は一切渡されていないことを確認した。Gnome の申告(§7-4「タイマー注入できる経路が cockpit-server.mjs に無い」)は正確。
- これは Domain A 側の既存設計(`createBargeInGate` 自体は `setTimeoutImpl`/`clearTimeoutImpl` の注入口を持つが、cockpit-server がそれを server レベルまで貫通させていない)に起因し、Domain B のスコープ外の既存事実である。
- 全体テスト時間が Domain A 完了時点の約 1.8 秒から約 6.4 秒(今回の独立実行では約 7.2 秒)に伸びている点は許容範囲(blocking 基準に抵触しない・機械ゲートは「全緑」であり実行時間の上限は定めていない)。
- **結論**: blocking ではない。followup.md への記録(将来 `barge-in` 用タイマー注入経路を server レベルに追加する改善候補)は妥当な処理。今回は現状許容で良い。

## 3. 追加のコード健全性

- **依存不変**: `package.json`/`pnpm-lock.yaml` 系ファイルへの `git diff --stat` はゼロ出力(実行して確認)。Domain B が変更した 7 source ファイルの diff 内に新規 `import` 行の追加は無い(grep で確認・唯一の import 追加は test ファイル `cockpit-server.test.mjs` の `import { BARGE_IN_MIN_SPEECH_MS, BARGE_IN_GRACE_MS } from "../mind/barge-in.mjs"` のみで、これは Domain A が export 済みの定数を読むだけの既存モジュールへの参照)。
- **タイマー/リソースリーク**: `bargeInGate.dispose()`(`cockpit-server.mjs:1561` 付近)・`fireScheduler.dispose()`(:1569 付近)は既存の server close 処理内にあり、今回の diff にこの箇所の変更は含まれない(dispose 呼び出し口は Domain B 以前から存在)。`enabled` オプション追加は dispose 経路に影響しないことを確認した。
- **型注釈**: server options の JSDoc に `bargeInInitialEnabled`(:357-363)・`onSetBargeInEnabled`(:364-368)・戻り値型 `bargeInStatus: () => { enabled: boolean } | null;`(:411 付近)が追随していることを確認した。`fireSchedulerFactory` の JSDoc(:352-356)も追加されている。

## 4. nit(non-blocking)

- 特筆すべき nit なし。Domain B の実装は写経の忠実性が高く、既存パターンからの逸脱がほぼ無い。

## 5. Orch への質問

- 特になし。Gnome が domain-b.md §7-6 で挙げていた「`fireSchedulerFactory` が許容されない場合の代替方針」への回答としては、本レビューの判定(2.1 節)を「許容」として Gnome へそのまま伝えてよい。

## 6. 参照した file:line 一覧(主要なもの)

- `apps/soul/agent/src/cockpit/cockpit-server.mjs:445`(bargeInInitialEnabled 算出)
- `apps/soul/agent/src/cockpit/cockpit-server.mjs:542-544`(snapshot selfFire/bargeIn)
- `apps/soul/agent/src/cockpit/cockpit-server.mjs:950-969`(POST /api/barge-in)
- `apps/soul/agent/src/cockpit/cockpit-server.mjs:1287-1299`(bargeInGate 構築・born-disabled)
- `apps/soul/agent/src/cockpit/cockpit-server.mjs:1326-1345`(fireSchedulerFactory・onFireRequest 分岐無改修)
- `apps/soul/agent/src/cockpit/cockpit-server.mjs:1542`(bargeInStatus)
- `apps/soul/agent/src/mind/barge-in.mjs:216`(`enabled = options.enabled !== false`・Domain A 既存)
- `apps/soul/agent/scripts/cockpit.mjs:314-345`(createBargeInHooks)・:707-712(server options 渡し)
- `apps/soul/agent/src/cockpit/cockpit-settings-store.mjs:150-158`(getBargeInEnabled/setBargeInEnabled)
- `apps/soul/agent/src/cockpit/ui/control-bar.mjs:106-127`(BargeInPill)・:235-259(onToggleBargeIn)
- `apps/soul/agent/src/cockpit/view-logic/control.mjs:200-240`(bargeInToggleView 系)
- `apps/soul/agent/src/cockpit/ui/app.mjs:81-83,257`(settingsFromSnapshot/ControlBar 配線)
- `apps/soul/agent/src/cockpit/ui/styles.mjs:260-272`(barge-in-pill CSS)

## 7. 機械ゲート裏取り

`cd apps/soul/agent && node --test` を独立実行し、自己申告と一致する結果を確認した:

```
# tests 886
# pass 886
# fail 0
# duration_ms 7180.3268
```
