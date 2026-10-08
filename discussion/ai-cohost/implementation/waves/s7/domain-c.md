# S7 Domain C: 操縦席のチャット結線 + UI + docs（Connect chat でコメント合流を人間の目に見せる）

> Status: 実装完了・機械ゲート緑（2026-07-14）。**追修正: design レビュー検出の契約 FAIL 1 件 +
> 未テストのエラー経路 1 本を閉じた（2026-07-14・Orch-Sylph 裁定・§8）——applyChat の dead 時 Disconnect
> 無効化を SSE chatStatus と単一経路（renderChatStatus）に統一・connect throw→500 の防波堤にテスト追加。
> 総数 606→609。** 実疎通（テスト配信でコメントを投げてこーでぃーが拾って
> 返す）は人間ゲートに持ち越し（wave-plan §1・§5）——**機械テストは実 YouTube・実チャット器官・実ネット
> ワーク・実 SDK・実マイクに一切出ていない（全 fake・fake 器官 factory 注入・SDK 実消費ゼロ）**。
> 担当: Gnome（Orch-Sylph 委任）。対象パッケージ: `apps/soul/agent`（独立 npm・workspace glob 外＝
> lockfile 不変）。
> 契約の正: [../../orchestration/s7-wave-plan.md](../../orchestration/s7-wave-plan.md) §3 Domain C・§5 /
> [../../orchestration/s7-planning-inventory.md](../../orchestration/s7-planning-inventory.md) §3 /
> 消費した成果物: [domain-a.md](domain-a.md)（`createLiveChatClient` の口・状態機械）+
> [domain-b.md](domain-b.md)（attach 点 `ingestChatMessage`/`broadcastChatStatus`/
> `broadcastChatDiagnostic`・viewer 行 SSE・selfFire kind）。

## 0. 結線図（この Domain が張った線・全 fake で縦検証済み）

```
操縦席「Live chat」入力欄 + Connect chat ボタン（cockpit.html）
  │  POST /api/chat/connect { source }
  ▼
cockpit-server.mjs（★ チャット器官の生成/Connect/停止は cockpit-server 所有＝ear-pipeline の
  │                    POST 駆動遅延起動と同じ流儀。factory は cockpit.mjs が本番注入）
  │
  ├─ connectChat(source)  (:1191)
  │    ├─ foldChatClient()   ← 既存器官があれば畳んでから作り直す（同一 restart は無い・Domain A §7-2）
  │    ├─ chatClient = chatClientFactory({ source })   ← 本番 createLiveChatClient（cockpit.mjs :542）
  │    │                                                  テストは fake 器官 factory 注入（実ネット不出）
  │    ├─ client.onMessage(msg → ingestChatMessage({ text, displayName }))   ┐
  │    ├─ client.onStatus(state → broadcastChatStatus(state))                ├ 器官の外から hooks 経由で
  │    ├─ client.onDiagnostic(info → broadcastChatDiagnostic(info))          ┘ 取り込み経路へ（逆 import なし）
  │    ├─ onSetChatSource(source)   ← settings へ永続化（次回起動で入力欄に復元・失敗寛容）
  │    └─ await client.start()      ← bootstrap+初回 poll（notLive/network は内部で retrying 予約して即 return）
  │
  ▼ 以後、器官がフックを呼ぶと（Domain B が敷いた attach 点へ）:
  onMessage    → ingestChatMessage → 転写バッファ append(viewer+displayName) + SSE "transcript"(viewer 行)
  │                                  + fireScheduler.handleChatMessage（comment / comment-call）
  onStatus     → broadcastChatStatus → SSE "chatStatus" { status: connecting|live|retrying|dead }
  onDiagnostic → broadcastChatDiagnostic → SSE "chatDiagnostic" { kind, message, atMs, delayMs, attempt }
  ▼
操縦席 UI（cockpit.html）が描く:
  ・viewer 行:        SSE "transcript" speaker:"viewer"+displayName → `viewer(名前): 本文`（別色）
  ・チャット状態表示:  SSE "chatStatus" → chat-status（live=緑/connecting・retrying=黄/dead=赤）
  ・取得死ゴースト行:  SSE "chatDiagnostic"（notLive/ended/extractFailed/network/internalError）
  ・耳未起動ゴースト:  SSE "diagnostic" type:"chatBufferAbsent"（★ 耳を起動した状態で Connect の裁定）
  ・コメント発火:      SSE "selfFire" kind:"comment"|"comment-call" → 自発発火マーカー行（kind 表示）

  POST /api/chat/disconnect → foldChatClient()（stop + フック購読解除・冪等）
  server.close()            → foldChatClient()（稼働中の器官も畳む・タイマ/プロセスを残さない）
```

- **核心（合流・発火判定）は Domain B の純ロジック側で全 fake テスト済み**。Domain C は「実チャット器官の
  **生成・Connect/停止ライフサイクル**を cockpit-server 所有で張り、フックを取り込み経路へ繋ぎ、UI に
  データ経路を描く」薄い additive 層。**逆方向 import を作らない**（チャット器官は魂の他部位を知らない・
  合流は hooks 経由・Domain B の attach 点シグネチャは 1 バイトも変えていない）。

## 1. 実装/変更ファイル一覧（すべて `apps/soul/agent/`・scope 内・file:line）

| ファイル | 種別 | 役割・主な変更点（file:line） |
|---|---|---|
| `src/cockpit/cockpit-server.mjs` | 変更（結線・所有） | チャット器官の**生成/Connect/停止ライフサイクルを所有**。option `chatClientFactory`/`onSetChatSource`/`chatSourceStatus`（:379-381）・状態 `chatClient`/`chatUnsubs`（:417-419）・snapshot に `chat:{source,connected,state}`（:466）・POST `/api/chat/connect`（:877 factory 注入時のみ・空 source は 400・未注入 503）・POST `/api/chat/disconnect`（:904 冪等）・`foldChatClient()`（:1161 stop+購読解除）・`connectChat(source)`（:1191 作り直し+hooks 結線+永続化+start）・close で `foldChatClient()`（:1262）。**attach 点（ingest/status/diagnostic）は Domain B のまま不変**。 |
| `src/cockpit/cockpit-server.test.mjs` | 変更 | S7 Domain C Connect/停止ライフサイクル 9 本追加（65→74・**追修正で connect throw→500 の防波堤 1 本**：`makeThrowingChatClientFactory`（factory-throw / start-reject の 2 モード）で 500 + 器官畳み（stop + フック撤去でリーク無し）+ connected=false を固定）。fake 器官 factory `makeFakeChatClientFactory`（実ネット不出）。 |
| `src/cockpit/cockpit-settings-store.mjs` | 変更 | `getChatSource`/`setChatSource`（:135-141・read-modify-write マージに同居）。JSDoc 契約 + typedef（:21-25・:67-68）。 |
| `src/cockpit/cockpit-settings-store.test.mjs` | 変更 | chat source の roundtrip/クリア/他キー同居/unwritable の 4 本追加。 |
| `scripts/cockpit.mjs` | 変更（本番結線） | 本番 factory 注入 `chatClientFactory: createLiveChatClient`（:542・import :53）・`createChatSourceHooks(settings)`（:325 export・settings ⇄ cockpit-server の薄い橋渡し・Channel URL/visionTarget と同型）・main で配線（:371・:543-544）。 |
| `scripts/cockpit.test.mjs` | 変更 | `createChatSourceHooks` の 3 本追加（橋渡し/status/失敗寛容）。 |
| `src/cockpit/cockpit.html` | 変更（UI） | 「Live chat」セクション（:182 入力欄/Connect/Disconnect/状態）・CSS（`.chat`・`.chat-status.{live,connecting,retrying,dead}`・`.row.speaker-viewer` :115-116）・**`renderChatStatus`（追修正で新設：状態表示 + Disconnect の有効/無効を chat state 値で決める単一経路）**・`applyChat`（記憶 source 復元 + `renderChatStatus` へ委譲）・Connect/Disconnect ハンドラ（POST）・viewer 行を `viewer(名前)` で描く拡張（addTranscriptRow）・SSE `chatStatus`（`renderChatStatus` へ委譲＝二重管理を断つ）/`chatDiagnostic`（取得死ゴースト）/`diagnostic` に chatBufferAbsent ゴースト・selfFire マーカーは kind 非依存で comment/comment-call を描く。 |
| `src/cockpit/cockpit-page.test.mjs` | 変更 | チャット UI 構造 10 本（入力/ボタン/POST・applyChat・viewer 行・chatStatus・chatDiagnostic・chatBufferAbsent・selfFire kind + **追修正で 2 本**：applyChat を dead/live/connecting/retrying/未接続の snapshot で駆動して Disconnect の有効/無効が state 値で決まることを実ロジック切り出しで固定 + applyChat/chatStatus が単一経路 `renderChatStatus` を通り分岐しないことを固定。既存 chatStatus テストは `renderChatStatus` 委譲へ期待値更新）。 |

**器コード（`apps/runtime-player/**`・`packages/**`）・契約 JSON・`pnpm-lock.yaml`・
`apps/soul/agent/package.json` は完全不変**（§4 の `git diff --stat` で確認・新規依存ゼロ＝素の fetch/
Node 組み込みのみ）。Domain A の `src/chat/**`・Domain B が変更した `src/{ears,mind}/**`・cockpit-server の
attach 点は**読んで消費しただけ**（Connect ライフサイクルの追記のみ・Domain B のシグネチャ不変）。
`.tmp/facex-*`（別セッション領分）は一切触っていない・読んでいない。

## 2. チャット器官ライフサイクルの契約（cockpit-server 所有・POST 駆動）

### `POST /api/chat/connect { source }`
- `chatClientFactory` 未注入 → **503**（"chat not available"）。空 source → **400**（停止は disconnect の
  領分・空はクリアではない）。
- 既存器官があれば **`foldChatClient()` で先に畳んでから**新 source で `chatClientFactory({ source })` を
  生成（**同一インスタンス restart は無い**——ended で dead に落ちた器官は作り直す・Domain A §7-2）。
- `onMessage→ingestChatMessage` / `onStatus→broadcastChatStatus` / `onDiagnostic→broadcastChatDiagnostic`
  を結線（購読解除 fn を `chatUnsubs` に貯め、畳み時に全撤去）。`onSetChatSource(source)` で永続化
  （失敗寛容）。`await client.start()`（bootstrap+初回 poll・notLive/network は内部で retrying 予約して
  即 return するので**HTTP ハンドラが無限に待たされない**）。生成/start の想定外 throw は畳んで 500。
- 成功は 200 + `snapshot()`（`chat.connected=true`・`chat.state` は器官の getState）。

### `POST /api/chat/disconnect`
- `foldChatClient()`（フック購読解除 + `client.stop()`＝器官は dead へ・タイマ全撤去・冪等——器官が
  無くても 200）。以後コメントは合流しない（購読解除済み）。魂の他機能は無影響（器官は独立）。

### `close()`
- `foldChatClient()` を最初に呼び、稼働中のチャット器官も stop+破棄（リークするタイマ/プロセスを残さない・
  node:test が自然終了する型）。

### 再 Connect / notLive の見え方（Domain A の状態機械がそのまま UI に出る）
- **notLive（未開始）は retrying で待ち続ける**（上限なしポーリング・cap 30s）→ 配信開始で自動 live。
  UI は chat-status=retrying（黄）+ notLive ゴースト行で「待ち」が見える。
- **ended（終了）は dead（終端）**→ UI は chat-status=dead（赤）+ Disconnect 無効化。別配信は Connect
  再操作（新 source で作り直す）。
- **Disconnect の有効/無効は chat state 値で一貫決定する（追修正・2026-07-14）**: UI 側は状態表示 +
  Disconnect の有効/無効を単一経路 `renderChatStatus(state)` で決める（**connected の真偽ではなく state の
  値**——connecting/live/retrying=有効・dead/未接続=無効）。SSE `chatStatus`（器官の状態遷移）と state
  snapshot 経由（`GET /api/state`→`applyChat`、他操作の `broadcastState()` 再送）の**両経路が同じ判定を
  通す**ので、ended→dead 後に snapshot 再送が走っても Disconnect が誤って再有効化されない（design レビュー
  検出の契約 FAIL——旧 applyChat が `connected` 真偽で無条件に再有効化していた食い違い——を閉じた）。

## 3. UI の SSE データ経路（cockpit.html が描くもの）

| UI 要素 | 消費する SSE / state | 描画 |
|---|---|---|
| viewer 行 | "transcript" `speaker:"viewer"`+`displayName` | `viewer(名前): 本文`（displayName 欠落は素の `viewer`）・`.row.speaker-viewer` 別色 |
| チャット状態 | "chatStatus" `{status}` + state.chat.state | `chat-status` に connecting/live/retrying/dead（CSS 色分け）+ Disconnect の有効/無効。**両 SSE/snapshot 経路とも単一経路 `renderChatStatus(state)` を通す**（state 値で決定＝dead は無効・snapshot 再送で誤再有効化しない・§2 追修正） |
| 記憶 source 復元 | state.chat.source（settings 由来） | 入力欄の既定（Connect 前/切断後も残る・入力中は上書きしない） |
| 取得死ゴースト行 | "chatDiagnostic" `{kind,message,...}` | notLive/ended/extractFailed/network/internalError をゴースト行（観測補助の connected/stopped/ignoredRenderers/listenerError は非表示＝過剰表示を避ける） |
| 耳未起動ゴースト行 | "diagnostic" `type:"chatBufferAbsent"` | `(chat: ears not running — comment did not merge)`（★ 運用ミスが見える） |
| コメント発火マーカー | "selfFire" `kind:"comment"|"comment-call"` | 自発発火マーカー行に kind 表示（`addSelfFireMarkerRow` は kind 非依存＝S6 の call/turn-end/silence と同型に載る） |

## 4. 器不変・依存ゼロ・チェック無退行の確認（このセッション実行）

```
git diff --stat -- apps/runtime-player packages                 → 出力なし（器コード不変）
git diff --stat -- pnpm-lock.yaml apps/soul/agent/package.json  → 出力なし（lockfile・依存不変＝新規依存ゼロ）
git diff --stat -- *channel-*-contract*                         → 出力なし（契約 JSON 不変）
git status --porcelain -- apps/soul/agent                       → Domain C の 8 ファイル（+ Domain A/B の未コミット分は不変）
```

- **構造チェック 3 種**（`node scripts/check-*.mjs`・repo ルートで実行）:
  - `check-dependencies.mjs`: **passed**（EXIT=0・Dependency guard passed）。
  - `check-soul-zone-boundary.mjs`: **passed**（EXIT=0・1347 files・器↔魂 越境 import なし。cockpit-server
    はチャット器官を import しない＝factory 全注入。cockpit.mjs のみ `createLiveChatClient` を import＝
    魂ゾーン内の前方向）。
  - `check-source-organization.mjs`: EXIT=1 だが**唯一の違反は `apps/runtime-player/src/main/physiology/
    index.ts`**（器コード・barrel-only 違反・ブランチ既存ベースライン＝本 Domain で不変・`.ts` のみ検査）。
    **私のスコープ（soul/agent・全 `.mjs`）には違反ゼロ**（`grep apps/soul/agent` で確認）。無退行
    （Domain A §5・Domain B §6 と同じベースライン）。
- **SDK 実消費ゼロ**（この Domain は LLM/SDK に触れない）。**機械テストは実 YouTube・実チャット器官・実
  ネットワーク・実マイクに一切出ていない**（fake 器官 factory + fake pipeline + fake orchestrator）。

## 5. 機械ゲート生数字

`cd apps/soul/agent && node --test`（全テスト・新規込み総数・タイムアウト 300s 付きで実行）:

```
# tests 609
# suites 0
# pass  609
# fail  0
# cancelled 0
# skipped 0
# todo 0
```

- **実行前ベースライン（Domain B 後）583 → Domain C 実装後 606（+23）→ 追修正後 609（+3）**（ハング無し・
  duration ≈ 1.5s）。追修正 +3 の内訳（`node --test <file>` 個別実測）:
  cockpit-server.test.mjs 73→74（+1・connect throw→500 の防波堤：factory-throw / start-reject の 2 モードで
  500 + 器官畳み（stop + フック撤去でリーク無し）+ connected=false）/
  cockpit-page.test.mjs +2（applyChat を dead/live/connecting/retrying/未接続の snapshot で駆動して Disconnect
  の有効/無効が state 値で決まることを実ロジック切り出しで固定 + applyChat/chatStatus が単一経路
  `renderChatStatus` を通ることを固定）。
- Domain C 実装 +23 の内訳（初回）: cockpit-settings-store.test.mjs +4（chat source roundtrip/クリア/他キー
  同居/unwritable）/ scripts/cockpit.test.mjs +3（createChatSourceHooks 橋渡し/status/失敗寛容）/
  cockpit-server.test.mjs 65→73（+8・Connect 縦串/呼びかけ縦串/Disconnect 畳み/再 Connect 作り直し/close
  畳み/503/400/snapshot.chat.source）/ cockpit-page.test.mjs +8（UI 構造/applyChat/viewer 行/chatStatus/
  chatDiagnostic/chatBufferAbsent/selfFire kind）。既存 583 本は**期待値変更ゼロで全通過**（無退行・
  S1〜S6。追修正でも 583 本は不変・変更したのは S7 の chatStatus テスト 1 本の期待値のみ＝`renderChatStatus`
  委譲への更新）。

## 6. 人間ゲート手順書 + s7-followup 台帳の場所

- **人間ゲート手順書**: [`human-gate-procedure.md`](human-gate-procedure.md)
  （`discussion/ai-cohost/implementation/waves/s7/human-gate-procedure.md`）。テスト配信の立て方（限定
  公開可）・**★ マイク（耳）を起動した状態で Connect**（§2 最重要事項・chatBufferAbsent の裁定を明記）・
  配信 URL 設定→Connect→コメントを投げる→こーでぃーが拾って返す・呼びかけ確実応答（comment-call）・
  相乗り 2 件（S6 持ち越し④沈黙発火の頻度 + S6 追撃 E 再ゲートの自発発火が画面に触れる）・ToS グレー
  開示（§0）。
- **s7-followup 台帳**: [`s7-followup.md`](s7-followup.md)
  （`discussion/ai-cohost/implementation/waves/s7/s7-followup.md`）。公式 API キー差し替えの梯子 + quota
  単価実測（§1）・ToS グレー記録（§2）・表記揺れ集合の実運用拡張（§3）・実疎通の HTTP 詳細欄（§4）・
  comment 予算 30 + 頻度の将来 Cockpit 可変（§5）・スパム/荒らしは S8 + 多コメント間引き（§6）・
  **バッファ所有権の巻き上げ = escalate（§7・Orch/Undine 裁定待ち）**・軽微 2 件（§8）。
- **README**: [`../../../../../apps/soul/README.md`](../../../../../apps/soul/README.md) に S7 セクション追記
  （チャット合流の使い方・★ 耳を起動した状態で Connect・実疎通は人間ゲート）。

## 7. §質問（Orch-Sylph / Undine・人間ゲートへの申し送り・迷った裁定点）

1. **【要 escalate・Domain B §9-1 の再掲】バッファ所有権と「耳なしチャット」**: viewer コメントの合流先
   （転写バッファ）は耳パイプライン所有ゆえ、**耳未起動ではコメントを合流できず発火もしない**（v0 は
   `chatBufferAbsent` 診断のみ）。人間ゲート手順書 §2 で「マイクを起動した状態で Connect」を★最重要
   事項として明記し、UI にゴースト行を出す形で v0 は成立させた。**耳を切ったままチャットだけ動かす運用を
   許すなら**バッファ所有権の巻き上げ（cockpit-server 常設所有）が要る＝S1〜S6 の耳ライフサイクル・器
   不変を脅かしうる構造変更ゆえ **v0 では実装せず escalate**。要否と設計は Orch/Undine の裁定待ち
   （s7-followup §7）。

2. **chatClientFactory は cockpit.mjs 全注入（fireOrchestratorFactory 型）にした**: wave-plan §3 の
   「cockpit.mjs が本番 factory を注入」に従い、cockpit-server は**チャット器官を import しない**（factory
   未注入なら POST /api/chat/connect は 503）。ear-pipeline の `pipelineFactory`（既定 = 実 import）とは
   違い、**fireOrchestratorFactory と同型の全注入**を選んだ理由: ① cockpit-server を器官の中身（innertube
   取得）から独立に保つ（責務境界）② 実疎通で fetch ヘッダ（cookie/CONSENT・followup §4）が要る日に、
   本番配線を cockpit.mjs 側に集約できる。ライフサイクルの所有（生成/Connect/停止）は cockpit-server＝
   ear-pipeline の POST 駆動遅延起動の流儀どおり。この裁定でよいか（Domain A §7-2 の「操縦席側で作り直す」
   要否への回答も兼ねる——Connect 再操作で新器官を作る形にした）。

3. **start() を await する裁定**: POST /api/chat/connect は `client.start()`（bootstrap+初回 poll）を await
   して snapshot を返す（ear-pipeline の start 同型・決定論テストしやすい）。notLive/network は器官内で
   retrying を予約して即 return するので HTTP は無限に待たされないが、**実ネットワークが真にハングした
   場合は requestTimeoutMs（既定 15s）まで HTTP がブロックしうる**（bounded・稀）。人間ゲートで Connect の
   体感が重ければ「fire-and-forget（即 202・状態は SSE で追う）」への変更を検討（v0 は await のまま）。

4. **paid（スーパーチャット）は kind 区別なしで合流**（Domain B §9-5 の回収）: 取り込み経路は kind を
   区別せず text/displayName だけで viewer 合流する（v0）。有料を演出で区別したいなら ingestChatMessage に
   kind を渡す余地がある（s7-followup §6）。UI の viewer 行も現状 paid/text 同一描画。裁定でよいか。

5. **実疎通の未検証項目（人間ゲート初確認）**: cookie/CONSENT・地域リダイレクト・チャンネル `/live` からの
   videoId 解決は**機械テストでは合成 fixture でしか固定していない**（実 HTML のスキーマ一致は実ネットで
   しか確認できない・Domain A §7-4/§7-5）。人間ゲート §3 で 4 点抽出が通るか初確認し、詰まれば
   s7-followup §4 の欄へ HTTP 詳細を記録して followup で器官内に足す（依存ゼロのまま fetch ヘッダ調整）。
