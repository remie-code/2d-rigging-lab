# S8 Domain A — キルスイッチ中核（実装報告）

担当: Gnome（サブエージェント委任・呼び出し元 Orch-Sylph）
対象: `apps/soul/agent/src/mind/fire-orchestrator.mjs`（本体）・`apps/soul/agent/src/mind/barge-in.mjs`（定数）・`apps/soul/agent/src/mind/fire-orchestrator.test.mjs`（テスト）

## 変更/作成ファイル一覧

- `apps/soul/agent/src/mind/barge-in.mjs`（変更）— `KILL_NOTE` 定数を追加。
- `apps/soul/agent/src/mind/fire-orchestrator.mjs`（変更）— キル状態・`kill()`/`revive()`/`getKilled()`・`severSpeaking` 共有ヘルパ・`fire()` 冒頭ガード・in-flight 破棄検査を追加。
- `apps/soul/agent/src/mind/fire-orchestrator.test.mjs`（変更）— S8 キルスイッチのテストを 9 件追加。

`apps/soul/agent` 配下以外（器・契約・packages・lockfile・package.json）は一切変更していません。

## 追加した関数/オプション/診断 type/定数名

### barge-in.mjs
- `KILL_NOTE = "…（強制停止）"`（`BARGE_IN_NOTE` の隣に配置。同じ全角括弧様式で対称）。

### fire-orchestrator.mjs
- `options.initialKilled`（boolean・既定 false）— 構築時のキル状態初期値。`let killed = options.initialKilled === true;` で厳密 boolean 判定（nullish/非 true はすべて false）。
- 返り値オブジェクトに追加:
  - `kill(atMs?)` — キル。`killed=true` を立て、再生中（`currentPlayback` があり未 interrupted）なら `severSpeaking` 経由で即切断。戻り値 `{ killed: true, severed: boolean, elapsedMs?, charsSpoken?, prefix? }`（severed:false のときは severance 系フィールドなし）。
  - `revive()` — `killed=false` にするだけ（void）。
  - `getKilled()` — 現在のキル状態（テスト・結線層向けに任意追加）。
- 内部共有ヘルパ `severSpeaking(pb, note, diagnosticType, atMs)` — 既存 `interrupt()` の切断ロジック（① player.stop 同期呼び ② 口閉じ ③ 切断点算出 ④ soul 追記 ⑤ 診断 emit ⑥ pb.resolve）を抽出し、`interrupt()`（`note:BARGE_IN_NOTE, diagnosticType:"bargeIn"`）と `kill()` の再生中枝（`note:KILL_NOTE, diagnosticType:"kill"`）が共有する。
- 新規診断 type:
  - `"kill"` — キルによる切断発生（`elapsedMs, charsSpoken, totalChars, prefix`）。
  - `"killStopError"` / `"killMouthCloseRejected"` / `"killMouthCloseError"` — severSpeaking のエラー系診断を `diagnosticType` でパラメータ化した結果、kill 経路ではこの type 名になる（bargeIn 経路の `bargeInStopError` 等と対称）。
  - `"killDiscarded"` — in-flight（ask 撃った後にキルされた）応答を破棄した事実のみを示す診断（`{type:"killDiscarded"}` のみ・本文非搭載）。
- `fire()` 冒頭ガード（`disposed` 判定の直後・`busy` 判定の直前）: `killed` なら `emit(onFire, {accepted:false, reason:"killed"})` → `{fired:false, reason:"killed", state}` を返す。manual/視覚/自発 preferred の全経路がこの唯一の合流点を通るため一箇所で足りる。
- `processAskedReply` 内、`parseExpressionTags` 実行後・未知タグ診断 emit 後・`hasSpeech/hasEvents` 計算前に in-flight キル検査を挿入（usage emit は既存通り温存＝LLM 代金は正直な計器として残す）。

## 追加テスト（9 件・fire-orchestrator.test.mjs 末尾「S8『キルスイッチ』」節）

1. `kill: idle 中キルは fire() を reason:'killed' で弾く` — idle 中 kill 後の fire() が `{fired:false, reason:"killed"}`・`onFire({accepted:false, reason:"killed"})` 通知・speakImpl 不呼び出しを確認。
2. `kill: 再生中キルは声を止め・口を閉じ・soul へ prefix+KILL_NOTE を1回追記・kill 診断` — 既存 barge-in 再生追跡テスト（`makeBargeSpeak`/`makeBargeChannel`/`makeStopPlayer`/`makeFakeTimers`/`flushMicrotasks`）を写経。`player.stop` 1 回・`sendSet(mouth-open,0)` 1 回・soul に `"こんに" + KILL_NOTE"` が 1 回 append・診断 type `"kill"`（bargeIn ではない）を確認。
3. `kill: ask 待ち中（in-flight）にキルすると speak せず soul 追記せず killDiscarded のみ` — `deferred()` で ask を保留し thinking 中に kill、その後 resolve。speakImpl 不呼び出し・soul 追記なし・`killDiscarded` 診断のキーが `["type"]` のみであること・診断/戻り値 JSON に応答本文（"こっそり"）が含まれないことを assert（秘匿の直接検証）。
4. `revive: 再生中キル後に revive すると次の fire() が普通に動く` — kill(再生中)→中断完走を待つ→ killed のまま fire() が弾かれることを確認→ revive → 次の fire() が thinking→speaking→自然完了まで正常に進み、`interrupted` 汚染がないこと・busy 固着がないことを確認。
5. `revive: idle キル後に revive すると次の fire() が普通に動く` — シンプルな idle 版。
6. `kill: manual fire()・fire({vision:true})・fire({vision:"preferred"}) の全経路がキルで弾かれる` — kill 後に 3 種の fire 呼び出しが全て `reason:"killed"`・`session.ask`/`captureImpl`/`speakImpl` いずれも不呼び出しを確認。
7. `kill: born-killed（initialKilled:true）は生成直後の fire() から reason:'killed'` — `createFireOrchestrator({initialKilled:true, ...})` → `getKilled()===true` と直後の fire() が killed で弾かれることを確認。
8. `kill: 耳系（transcript-buffer）に無影響` — kill 後も `buffer.append()` で you 転写が積めることを確認（kill が buffer/ears を壊さない構造上の確認）。
9. `kill/revive: 冪等・no-op` — 非 killed 時の revive が no-op・speaking でない kill は severance no-op（`player.stop` 呼ばれない）・二度 kill しても安全であることを確認。

全テストに `{ timeout: 5000 }` を付与。

## テスト結果（生の集計行）

### 実装前（ベースライン・自分で実測）
```
1..729
# tests 729
# suites 0
# pass 729
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 2634.8454
```

### 実装後（`apps/soul/agent` を cwd に `node --test` フルスイート）
```
1..738
# tests 738
# suites 0
# pass 738
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 3216.1857
```
738 − 729 = 9（新規追加分と一致）。全緑・無退行。

fire-orchestrator.test.mjs + barge-in.test.mjs のみの単独実行でも新規 9 件（69〜77）を含め 77/77 緑を個別確認済み。

## git diff --stat（apps/soul/agent 配下に限定）

```
apps/soul/agent/src/mind/barge-in.mjs              |   8 +
apps/soul/agent/src/mind/fire-orchestrator.mjs     | 137 +++++++--
apps/soul/agent/src/mind/fire-orchestrator.test.mjs | 311 ++++++++++++++++++++-
3 files changed, 431 insertions(+), 25 deletions(-)
```

リポジトリルートの `git diff --stat`（無指定）には他セッション領分の変更（`apps/authoring-host/src/perception/render-scene-adapter.ts`・`discussion/mesh-generation/**`・`discussion/design/mesh-rendering/**`・`discussion/model-authoring/experiments/**` の PNG 等）が表示されますが、これらはセッション開始時点の `git status` に既に `M` として記録されていたものであり、本タスクでは一切触れていません（`apps/soul/agent` 限定の diff で確認済み）。器（apps/runtime-player）・契約（channel-*-contract）・packages/・pnpm-lock.yaml・apps/soul/agent/package.json・package-lock.json への変更はゼロです。install・commit も行っていません。

## blocking レビュー基準への対応（実装側の根拠）

1. **キルの完全性**: `fire()` の唯一の冒頭ガードが manual・視覚・自発 preferred すべての合流点を塞ぐ（テスト 6 で直接確認）。in-flight（ask 撃った後）の応答も `processAskedReply` の検問所で speakImpl 到達前に破棄（テスト 3）。
2. **即効性**: `severSpeaking` は `pb.interrupted=true` → タイマ解除 → `player.stop()`（try 内・同期呼び）までを await を挟まず実行してから初めて `await channel.sendSet(...)` に入る構造（既存 interrupt と同一の外形をそのまま継承）。
3. **耳の不干渉**: `kill`/`revive`/`severSpeaking` は `player`/`channel`/`pb.buffer.append`/`state` 以外に触れず、ears モジュールを import しない構造は不変。テスト 8 で buffer 生存を直接確認。
5. **没の秘匿**: `killDiscarded` 診断は `{type}` のみで本文なし。テスト 3 で診断オブジェクトのキーが `["type"]` のみであること、および診断・戻り値の JSON 文字列化に応答本文が含まれないことを直接 assert。
6. **復帰の健全性**: テスト 4/5 で revive 後に `interrupted` 汚染・busy 固着がなく、2 回目の fire が正常に thinking→speaking→idle まで進むことを確認。

## 裁量判断

1. **KILL_NOTE の置き場所**: `barge-in.mjs` の `BARGE_IN_NOTE` の隣に配置（推奨案を採用）。理由: 対称性・単一責務（notes/定数は barge-in.mjs に集約）。
2. **severSpeaking のエラー診断 type 命名**: `${diagnosticType}StopError` / `${diagnosticType}MouthCloseRejected` / `${diagnosticType}MouthCloseError` とパラメータ化。bargeIn 経路は既存の type 名（`bargeInStopError` 等）と 1 ビットも変わらないことを既存テスト（interrupt 系）が全緑のまま通ることで確認済み。kill 経路はこれに対称な `killStopError` 等になる（明示テストなし・設計上自然な対称命名として裁量で決定）。
3. **kill() の戻り値形**: `{ killed: true, severed: boolean, elapsedMs?, charsSpoken?, prefix? }`。severed:false のときは severance 系フィールドを持たない（idle/thinking 中の kill は「キルは成立したが切るものがなかった」ことを `severed:false` で区別できるようにした）。
4. **再生中 kill の fire() 側最終結果**: `severSpeaking` は既存 interrupt と同じ `pb.resolve({interrupted:true, ...})` 経路を通るため、`processAskedReply` は `completion.interrupted` 分岐に入り、fire() 全体の戻り値は `{fired:true, interrupted:true, replyText:<声に出た接頭辞>, ...}` になります（barge-in 中断と同一の意味論を共有＝DRY を優先した設計指示どおり）。「kill なのに fired:true」という見た目になりますが、これは「発話は始まり、途中で強制切断された」という事実を素直に表しており、bargeIn の意味論と完全に同じです。Domain B（サーバ側 kill API）がこの戻り値をユーザー向けにどう見せるかは呼び出し側の裁量です。
5. **getKilled() の追加**: 指示で「任意」とされていたため追加（テスト・結線層の可読性のため）。

## 質問

特に判断に迷う不足情報はありませんでした。念のため 1 点だけ確認事項として記載します。上記裁量判断 4 の通り、再生中に `kill()` した場合の `fire()` の最終戻り値は `interrupted:true` を伴う `fired:true` になります（barge-in と同一の経路を再利用したため）。Domain B（サーバの kill API・POST エンドポイント想定）側で「キルされた」という事実をレスポンスとして返す際、この `fired:true/interrupted:true` をそのまま使うか、`kill()` 自身の戻り値（`{killed:true, severed:true, ...}`）を使うかは設計判断が必要になる可能性があります。`kill()` 自身の戻り値に切断点情報（`elapsedMs/charsSpoken/prefix`)を含めてあるので、Domain B は `kill()` の戻り値だけで完結でき、fire() の Promise を待つ必要はない設計にしてあります。
