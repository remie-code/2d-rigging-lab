# 配信間記憶 Domain B「配線 + 操縦席 + docs」— 実装報告

> 実装者: Gnome（サブエージェント委任・Orch-Sylph 経由）。
> 対象: `apps/soul/agent/` 配下の配線層（cockpit.mjs / cockpit-server.mjs / cockpit-settings-store.mjs / 操縦席 UI）+ `apps/soul/README.md`。
> 根拠文書: [stream-memory.md](../../../soul/stream-memory.md)（裁定 7 件）・[stream-memory-inventory.md](../../orchestration/stream-memory-inventory.md)（L0 設計判断 7 件）・[stream-memory-wave-plan.md](../../orchestration/stream-memory-wave-plan.md)（§3 Domain B・§4 blocking 基準）・[domain-a.md](domain-a.md)（Domain A 実装報告・公開 API）。

## 0. 前置き（環境健全性の自己確認）

着手前に `apps/soul/agent` で `node --test` を実行し、**914/914 緑**（ベースライン）を自分で確認してから着手した（生 tail は §5 参照）。汚染は一切観測しなかった。

## 1. 変更/新設したファイルの絶対パス一覧

### 新設
- `C:\workspace\remie\code\ai-native-live2d-editor\discussion\ai-cohost\implementation\waves\stream-memory\followup.md`
- `C:\workspace\remie\code\ai-native-live2d-editor\discussion\ai-cohost\implementation\waves\stream-memory\domain-b.md`（本報告）

### 変更
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\src\cockpit\cockpit-settings-store.mjs`（`getMemoryEnabled`/`setMemoryEnabled` 追加）
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\src\cockpit\cockpit-settings-store.test.mjs`（4 テスト追加）
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\scripts\cockpit.mjs`（配線本体）
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\scripts\cockpit.test.mjs`（20 テスト追加）
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\src\cockpit\cockpit-server.mjs`（POST 2 本 + snapshot + getTranscript）
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\src\cockpit\cockpit-server.test.mjs`（13 テスト追加）
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\src\cockpit\cockpit-static-assets.test.mjs`（エンドポイント数コメントのみ・16→22 の棚卸し是正）
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\src\cockpit\cockpit-ui.test.mjs`（`settingsFromSnapshot` の memory フィールド）
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\src\cockpit\ui\app.mjs`（`settingsFromSnapshot` に `memory` 追加）
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\src\cockpit\ui\settings-drawer.mjs`（「記憶」区画新設）
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\src\cockpit\view-logic\settings.mjs`（memory 系 4 関数 + REQUEST_ERROR_PREFIX 2 項目）
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\src\cockpit\view-logic\settings.test.mjs`（6 テスト追加）
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\README.md`（「配信間記憶」節を追記）

Domain A が新設した `apps/soul/agent/src/mind/memory.mjs` / `memory.test.mjs` / `.gitignore` は本ドメインでは無変更（そのまま import して配線した）。

## 2. blocking 基準（§4）への対応箇所

### #1 視聴者秘匿（配線で無効化されていないか）
配線側は視聴者秘匿ロジックそのものには触れていない（Domain A の `formatTranscriptForDigest`/`DIGEST_GENERATION_INSTRUCTION` を無改変で使うのみ）。cockpit.mjs の `recordMemory`（`createMemoryRecorder`・cockpit.mjs:395-435 付近）は `generateDigest({ brainDef, entries })` へ生の転写エントリをそのまま渡すだけで、displayName を加工/追加するコードは一切無い（配線層で秘匿を破る余地が無い設計）。

### #2 常駐不汚染
`recordMemory`（`createMemoryRecorder` の戻り値・cockpit.mjs:818-833 で main() スコープにインスタンス化）は `getBrainDef: () => BRAINS[currentBrain] ?? BRAINS.claude` を渡すのみで、常駐 `session`（cockpit.mjs main() の `let session`）には一切触れない。`generateDigest` 自身が使い捨てセッションを create/dispose する契約（Domain A）をそのまま利用しているだけで、配線側が常駐へ橋渡しする経路は存在しない。

### #3 shutdown が固まらない
- cockpit.mjs:1001-1032（`shutdown`）: `finalMemoryEntries`（転写スナップショット）を `server.close()`（:1010）より**前**に確保（:1008）。
- 最終生成（:1015）は `raceMemoryRecordWithTimeout(recordMemory(finalMemoryEntries), SHUTDOWN_MEMORY_TIMEOUT_MS)`（cockpit.mjs:477-482 の実装・timeoutMs=15000）で必ず有限時間内に返る。
- best-effort + timeout の後、既存の `session`/`player`/`lazyChannel` dispose（:1017 以降）・`finally { process.exit(0) }`（不変）は必ず実行される。
- 機械テスト: `scripts/cockpit.test.mjs` の「shutdown 型ハーネス」2 本（`hangingRecordMemory` が永遠に解決しない・reject する、いずれのケースでも後続 dispose が必ず走ることを事象順序で固定）。

### #4 OFF の完全性（注入・生成・タイマー全停止）
- **注入停止**: cockpit.mjs:715 `composeSystemPrompt(FIRE_SYSTEM_PROMPT, memoryEnabled ? memoryText : "")`。OFF なら空文字列を渡し、`composeSystemPrompt`（Domain A・memory.mjs）が素の仮面を返す（二重防御）。
- **生成停止**: `createMemoryRecorder` の戻り値（cockpit.mjs:424 `if (!deps.isEnabled()) return;`）が OFF なら `generateDigest`/`saveDigest` を一切呼ばない。手動記録・チェックポイント・shutdown いずれの呼び出し元も同じ `recordMemory` を経由するため三経路とも止まる。
- **チェックポイント停止**: cockpit.mjs:840 `if (!memoryEnabled) return;`（タイマー callback 冒頭）。
- **切替時のホットスワップ**: `onSetMemoryEnabled`（cockpit.mjs:858-877）が OFF なら `memoryText = ""` にし、現 session を dispose→null（brain 切替と同型）。

### #5 ワイヤ additive・器/契約/依存不変・実消費ゼロ
- POST +2（`/api/memory`・`/api/memory-record`・cockpit-server.mjs:1132, 1150）。
- snapshot キー +1（`memory`・cockpit-server.mjs:572）。
- SSE 種別は増えていない（`broadcast("state", ...)` の再送のみ・新規イベント名なし。§6 で実証）。
- `git diff --stat` で `apps/runtime-player`・`channel-*-contract`・`packages/`・依存/lockfile が無出力であることを確認済み（§5）。
- テストは全 fake 注入（実 LLM/実TTS/実ネット/実マイク消費ゼロ）。テスト後に実体 `apps/soul/agent/memories/` が生成されていないことを確認済み（§5）。

### #6 メモリファイルの安全
配線層はファイルパス組み立てに一切関与しない（`DEFAULT_MEMORIES_DIR`・`startedAtMs` は Domain A の `saveDigest`/`loadRecentDigests` にそのまま渡すのみ）。`getTranscript`（cockpit-server.mjs:1606）は転写バッファの読み取り専用ミラーで書き込み系ではない。

## 3. 決め打った具体値の根拠

| 定数 | 値 | 根拠 |
|---|---|---|
| `MEMORY_INJECT_MAX_CHARS`（`loadRecentDigests` の `maxChars`・cockpit.mjs:61-67・使用箇所 :649, :866） | 4500 | `DIGEST_GENERATION_INSTRUCTION` の分量目安（≤1500 字/件・memory.mjs）× `DEFAULT_DIGEST_COUNT`（3 件）= 4500。仮面 + 記憶 + 当日の Fire 注入窓（`FIRE_MAX_CHARS`=4000）を合算しても常識的なプロンプト長に収まる値として採用。 |
| `SHUTDOWN_MEMORY_TIMEOUT_MS`（cockpit.mjs:85） | 15000（15 秒） | inventory §1 の実測「短命 ask ≈5s（初期化 1.9s + ask 3.2s・s1-first-light）」の 3 倍のマージン。digest 生成は通常 Fire よりも遥かに大きい入力（配信全体の転写）を渡すため ask 自体がより長くかかりうる一方、Ctrl+C からの体感待ちを無限に伸ばせないため有限の保守的マージンを採る。 |
| `MEMORY_CHECKPOINT_INTERVAL_MS`（cockpit.mjs:68） | 20 * 60 * 1000（20 分） | inventory §2-4 の裁定どおり「15〜30 分の中庸」をそのまま採用（L0 設計判断で既に確定済み・Domain B での新規決定ではない）。 |

その他の裁量判断（`lastRecordAtMs` はプロセス内正本・前回起動を跨がない等）は `followup.md` §3 に記録。

## 4. `node --test` の生 tail

### 着手前（ベースライン確認・自分で実行）
```
1..914
# tests 914
# suites 0
# pass 914
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 6119.7175
```

### 実装完了後（apps/soul/agent 全体・自分で実行）
```
1..957
# tests 957
# suites 0
# pass 957
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 6493.7284
```

内訳（新規テスト数・914→957 の +43 の内訳）:
- `cockpit-settings-store.test.mjs`: 36 → 40（+4・memoryEnabled の 4 種）
- `scripts/cockpit.test.mjs`: 49 → 69（+20・createMemoryHooks 5・shouldSkipMemoryCheckpoint 2・createMemoryRecorder 6・raceMemoryRecordWithTimeout 4・定数固定 1・shutdown 型ハーネス 2）
- `src/cockpit/cockpit-server.test.mjs`: 105 → 118（+13・POST /api/memory 6・POST /api/memory-record 4・snapshot.memory 2・getTranscript 1）
- `src/cockpit/view-logic/settings.test.mjs`: 11 → 17（+6）
- `src/cockpit/cockpit-ui.test.mjs`: 39 → 39（既存テストの assertion 拡張のみ・新規テスト数 0）

テスト実行後、実体 `apps/soul/agent/memories/` ディレクトリが生成されていないことを確認済み（`ls memories` → `No such file or directory`）。`~/.codex` にも触れていない。

## 5. `git diff --stat` の生出力（器/契約/packages が無出力であることの実証）

```
--- runtime-player ---
(no output)
--- channel contracts ---
(no output)
--- packages/ ---
(no output)
--- llm-session.mjs ---
(no output)
--- barge-in.mjs ---
(no output)
ALL EMPTY = GOOD
```

依存/lockfile（`package.json`・`package-lock.json`・root `pnpm-lock.yaml`・`apps/soul/agent/package.json`）も diff 無し（実行して確認済み）。

Domain B が実際に触れたファイルの `git diff --stat`（本体差分。CRLF 警告は無視してよい・改行コード検出のみで内容差分ではない）:
```
apps/soul/README.md                                |  34 +++
apps/soul/agent/scripts/cockpit.mjs                | 264 ++++++++++++++++-
apps/soul/agent/scripts/cockpit.test.mjs           | 329 ++++++++++++++++++++-
apps/soul/agent/src/cockpit/cockpit-server.mjs     |  68 ++++-
apps/soul/agent/src/cockpit/cockpit-server.test.mjs | 226 ++++++++++++++
apps/soul/agent/src/cockpit/cockpit-settings-store.mjs   |  14 +
apps/soul/agent/src/cockpit/cockpit-settings-store.test.mjs |  74 +++++
apps/soul/agent/src/cockpit/cockpit-static-assets.test.mjs  |   5 +-
apps/soul/agent/src/cockpit/cockpit-ui.test.mjs    |   6 +-
apps/soul/agent/src/cockpit/ui/app.mjs             |   5 +-
apps/soul/agent/src/cockpit/ui/settings-drawer.mjs |  78 ++++-
apps/soul/agent/src/cockpit/view-logic/settings.mjs      |  76 ++++-
apps/soul/agent/src/cockpit/view-logic/settings.test.mjs |  74 ++++-
```

`git status --short` で他に変化のあるファイル（`.tmp/*`・`apps/authoring-host/*`・`discussion/mesh-generation/*`・`discussion/model-authoring/*` 等）は本タスク開始前の git status と完全一致しており、本セッションでは一切触れていない（別セッション領分・不接触の原則を遵守）。`discussion/ai-cohost/implementation/waves/stream-memory/domain-a.md` と `discussion/ai-cohost/implementation/reviews/stream-memory/*` は前任（Domain A・レビュー）由来で既に存在していたもの。

## 6. ワイヤ additive の実証

- **POST が 2 本だけ増えた**: `grep -c 'method === "(GET|POST)" && pathname ==='` が 20→22（cockpit-server.mjs）。追加は `/api/memory`（:1132）・`/api/memory-record`（:1150）のみ。既存 20 本の判定条件・応答形は無改変。
- **snapshot キーが memory 1 個だけ増えた**: `snapshot()`（cockpit-server.mjs:523〜）に `memory: typeof memoryStatusImpl === "function" ? (memoryStatusImpl() ?? null) : null`（:572）を追加した以外、既存キーの形・順序は無改変。
- **SSE 種別が増えていない**: `broadcast("...")` の呼び出しを grep すると 13 種（chatDiagnostic/chatStatus/diagnostic/discard/expression/fire/selfFire/soul/state/transcript/usage/vad/visionCaptured）のまま。`POST /api/memory`・`POST /api/memory-record` はどちらも既存の `broadcastState()`（= `broadcast("state", snapshot())`）を呼ぶのみで新規イベント名を発行しない。`apps/soul/agent/src/cockpit/ui/app.mjs` の `SSE_EVENT_NAMES` リストも無改変（13 のまま）。
- **エンドポイント数コメントを 22 に更新**: `cockpit-server.mjs:279`・`cockpit-server.mjs` の静的配信直前コメント（旧 :1112 相当）を「既存 20 エンドポイント」→「既存 22 エンドポイント」に更新。加えて `cockpit-static-assets.test.mjs` の「ワイヤ契約 16 エンドポイント」というコメントが過去数波（brain/kill/verbosity/chat 追加時）の棚卸し漏れで放置されていた（実際は 20 だった）ことに気づき、22 へ是正した（§7 裁量判断 3 参照）。

## 7. 裁量判断

1. **転写取得の継ぎ目の実装形**: cockpit-server.mjs の返り値オブジェクトに `getTranscript: () => (pipeline ? pipeline.transcriptBuffer.all() : [])`（:1606）を additive に追加し、cockpit.mjs 側は `let server;`（前方参照・main() 冒頭で宣言、`createCockpitServer(...)` の代入自体は下方のまま）で forward reference する形にした。これは既存の `sessionProxy`/`playerProxy` が `session`/`player`（`let` で前方宣言・実代入は `ensureFireResources` 内）を forward reference するのと同型のパターンで、cockpit-server の HTTP/SSE ワイヤ契約には一切影響しない内部 JS API 追加である。
2. **`recordMemory`/チェックポイント/shutdown のテスト可能化**: main() の閉じたスコープに素朴な `async () => {...}` を書くのではなく、`createMemoryRecorder(deps)`（cockpit.mjs:395〜・依存注入ファクトリ）・`shouldSkipMemoryCheckpoint(currentSeq, lastRecordedSeq)`（純判定・:423）・`raceMemoryRecordWithTimeout(promise, timeoutMs, setTimeoutImpl)`（:477〜・fire-scheduler.mjs/barge-in.mjs のタイマ注入規律を踏襲）の 3 つを exported な小関数として切り出した。main() はこれらをそのまま呼ぶだけなので、テストで固定した不変条件が実際の呼び出し経路にもそのまま効く（brain 切替×in-flight テストと同じ「実装そのものを最小ハーネスで駆動する」流儀）。
3. **`lastRecordAtMs` はプロセス内正本**: 前回起動の記録時刻をディスクから読み直して引き継ぐ実装にはしなかった（Domain A の `loadRecentDigests` はダイジェスト本文のみを返し、ファイルの実際の記録時刻を持ち出す口が無いため）。起動直後は「まだ記録なし」表示になる。詳細と再検討の余地は `followup.md` §3-3 に記録。
4. **`memoryToggleView`/`memoryPostErrorText`/`memoryRecordPostErrorText`/`memoryStatusLabel` の置き場所**: 指示どおり `view-logic/settings.mjs`（記憶区画が settings-drawer に置かれるため）に集約した。`memoryToggleView` は control.mjs の `bargeInToggleView` の完全写経、エラー文言 2 つは settings.mjs 既存の `settingPostErrorText` ヘルパを再利用（brainPostErrorText と同型）、fetch-catch 文言は既存の `REQUEST_ERROR_PREFIX` テーブルへ `memory`/`memoryRecord` を追記して `requestErrorText` をそのまま再利用した（bargeInRequestErrorText のような専用関数を新設せず、settings.mjs 側の既存汎用機構に合わせた）。
5. **`memoryStatusLabel` のローカル時刻変換**: 新規のフォーマッタは作らず、既存の `view-logic/format-time.mjs` の `formatClock`（エポック ms → ローカル HH:MM:SS）をそのまま import して再利用した（Domain A 申し送り 3 のとおり表示変換のみ Domain B の責務）。
6. **静的配信テストのコメント是正**（`cockpit-static-assets.test.mjs`）: 「ワイヤ契約 16 エンドポイント」という表記が実際の現在値（22・私の変更前は 20）と既に食い違っていた（過去数波での追随漏れ）。「同種のカウント記述があれば揃える」との指示に基づき 22 へ修正した。

## 8. 質問（判断に迷った点）

1. **`memoryCount`（snapshot.memory.count）を `recordMemory` 成功時に更新するか**: 委任文は「必要なら memoryCount も更新」としていたが、Domain A の `count` 定義（`loadRecentDigests` が起動時/ON 切替時に実際に読み込んだ件数）を尊重し、**`recordMemory` の成功では memoryCount を更新しない**設計にした（同一セッションの進行中ファイルを「搭載件数」に含めるのは Domain A の定義とズレると判断したため）。この判断が UI の意図と食い違う場合は `memoryStatus()`（cockpit.mjs:887）の実装のみで調整可能。
2. **`lastRecordAtMs` を前回起動から引き継ぐべきか**: 上記 §7-3 のとおりプロセス内正本のみにした。もし「起動直後から前回配信の最終記録時刻を表示したい」という要件があれば、Domain A 側に「ダイジェストファイルのメタ情報（mtime 等）を返す口」を追加する必要がある（v0 では見送り）。
3. **静的配信テストのコメント修正（16→22）**: 本ドメインの直接の担当範囲を超える過去の棚卸し漏れだったため、修正してよいか一瞬迷ったが、「同種のカウント記述があれば揃える」との明示指示と、コメントのみの低リスク修正であることから実施した。過剰であれば revert 対象として指摘してほしい。

以上、実装完了。ターンを終えずに完走した。
