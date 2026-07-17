# 多頭化(頭脳差し替え) Domain C 実装記録 — 操縦席 UI + 観測 + docs

> 担当: Gnome（サブエージェント委任 / 呼び出し元 Orch-Sylph）。
> 計画: [../../orchestration/brain-swap-wave-plan.md](../../orchestration/brain-swap-wave-plan.md) §3 Domain C・§4 blocking 基準。
> 棚卸し: [../../orchestration/brain-swap-inventory.md](../../orchestration/brain-swap-inventory.md)（§2-2 観測層・§2-3 写経元）。
> 正本: [../../../soul/brain-swap.md](../../../soul/brain-swap.md)（§5 昇格予約・§2 観測 UX 裁定）。
> 前提: Domain A・Domain B 完了・レビュー PASS 済み（[domain-a.md](domain-a.md) / [domain-b.md](domain-b.md)）。
> followup 台帳: [brain-swap-followup.md](brain-swap-followup.md)（全 9 項目・全 non-blocking）。

## 1. 変更/新規ファイル一覧（絶対パス）

**新規**:
- `C:\workspace\remie\code\ai-native-live2d-editor\discussion\ai-cohost\implementation\waves\brain-swap\brain-swap-followup.md`
- `C:\workspace\remie\code\ai-native-live2d-editor\discussion\ai-cohost\implementation\waves\brain-swap\domain-c.md`（本ファイル）

**変更（Domain C の 17 ファイル・すべて soul zone 内 + discussion/）**:
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\src\mind\fire-orchestrator.mjs`
  （processAskedReply 自然完了パスの onSoulTranscript emit に `latencyMs`(asked.elapsedMs 実測)を
  additive で載せる 1 箇所のみ変更。KILL/NG 検問所ロジック自体は無変更）
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\src\mind\fire-orchestrator.test.mjs`
  （新規テスト 3 本追加）
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\src\cockpit\cockpit-server.mjs`
  （broadcastSoulTranscript の latencyMs 実値化 + brain 札 / onUsage の brain 札 / エンドポイント数
  コメント 18→19 訂正）
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\src\cockpit\cockpit-server.test.mjs`
  （新規テスト 3 本追加）
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\src\cockpit\view-logic\transcript.mjs`
  （latencyLabel に brain 札 additive 第 2 引数）
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\src\cockpit\view-logic\transcript.test.mjs`
  （新規テスト 1 本追加）
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\src\cockpit\view-logic\usage.mjs`
  （usageNoteText に brain 札 additive）
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\src\cockpit\view-logic\usage.test.mjs`
  （新規テスト 1 本追加）
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\src\cockpit\view-logic\health.mjs`
  （BRAIN_LABELS / brainLabel / brainCredentialHealthLabel 追加）
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\src\cockpit\view-logic\health.test.mjs`
  （新規テスト 3 本追加）
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\src\cockpit\view-logic\settings.mjs`
  （brainPostErrorText 追加・REQUEST_ERROR_PREFIX に brain 追加）
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\src\cockpit\view-logic\settings.test.mjs`
  （既存テストへ brain 分岐のアサーション追記のみ・新規 test() ブロックは追加していない）
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\src\cockpit\ui\rows.mjs`
  （feedWithTranscript が latencyLabel へ d.brain を additive に渡す）
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\src\cockpit\ui\app.mjs`
  （settingsFromSnapshot に brain フィールド追加）
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\src\cockpit\ui\settings-drawer.mjs`
  （「頭脳」区画を新設: BRAIN_OPTIONS・brainSelected state・brain 同期 effect・onBrainSet ハンドラ・
  drawer-section JSX）
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\src\cockpit\cockpit-ui.test.mjs`
  （settingsFromSnapshot テストに brain フィールド追加＝既存 deepEqual 更新・新規テスト 2 本追加）
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\README.md`
  （「多頭化: 頭脳の差し替え」節を S8 節の直後に新設・provider 追加手引き＝昇格予約 3 箇所目を含む）

**無変更（確認済み・Domain A/B のファイルには一切触れていない）**:
- `src/mind/brains.mjs` / `brains.test.mjs` / `codex-session.mjs` / `codex-session.test.mjs`（Domain A）
- `src/mind/env-guard.mjs` / `env-guard.test.mjs`（Domain A）
- `apps/soul/agent/.gitignore`（Domain A）
- `scripts/cockpit.mjs` / `scripts/cockpit.test.mjs`（Domain B）
- `src/cockpit/cockpit-settings-store.mjs` / `.test.mjs`（Domain B）
- `src/mind/llm-session.mjs`（Claude 頭・全 wave 通じて無変更）
- `apps/soul/agent/package.json` / `package-lock.json`（§5 に生出力）

## 2. node --test 実行結果（自己実行・生の末尾）

**着手前ベースライン（自分で実行・確認済み。`apps/soul/agent` で `node --test`）**:
```
1..814
# tests 814
# suites 0
# pass 814
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1546.5573
```

**実装後（全体再実行・自分で実行・最終確認）**:
```
1..827
# tests 827
# suites 0
# pass 827
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1714.8398
```

814 → 827（**+13**）。全緑。fail/cancelled/skipped/todo は全て 0。

**触った 7 ファイルの個別再実行（無退行の裏取り・Domain B の TAP 連番取り違え事故を踏まえ、必ず
`node --test <単一ファイル>` を個別コマンドで実行した生出力のみを記載する）**:

```
$ node --test src/mind/fire-orchestrator.test.mjs
1..66
# tests 66 / # pass 66 / # fail 0

$ node --test src/cockpit/cockpit-server.test.mjs
1..95
# tests 95 / # pass 95 / # fail 0

$ node --test src/cockpit/view-logic/transcript.test.mjs
1..5
# tests 5 / # pass 5 / # fail 0

$ node --test src/cockpit/view-logic/usage.test.mjs
1..4
# tests 4 / # pass 4 / # fail 0

$ node --test src/cockpit/view-logic/health.test.mjs
1..8
# tests 8 / # pass 8 / # fail 0

$ node --test src/cockpit/view-logic/settings.test.mjs
1..11
# tests 11 / # pass 11 / # fail 0

$ node --test src/cockpit/cockpit-ui.test.mjs
1..38
# tests 38 / # pass 38 / # fail 0
```

新規追加テスト本数の内訳（fire-orchestrator +3 / cockpit-server +3 / transcript +1 / usage +1 /
health +3 / settings +0（既存テストへのアサーション追記のみ）/ cockpit-ui +2）= 合計 +13。全体の
814→827 の差分と一致する（個別ファイルの合計件数を baseline と比較したのではなく、各ファイルへ
実際に追加した test() ブロック数を数えた上で全体差分と突き合わせた）。

**着手前に自分で実行した baseline も上記の 814/814 のとおり（本節冒頭）**。

## 3. 設計判断

### 3-1. latencyMs 実値化の配線方法（wave 計画 §3 Domain C・inventory §2-2「足りない配線」の解消）

`fire-orchestrator.mjs` の `processAskedReply` は 3 箇所で `onSoulTranscript` を emit しうる
（① killed-inflight は emit しない・② NG ブロック時・③ 自然完了時・④ barge-in 中断時は
`severSpeaking` 内の別経路）。**latencyMs を additive に載せたのは ③ 自然完了時の 1 箇所のみ**:

```js
const appended = buffer.append({ startMs: 0, endMs: 0, text: speechText, speaker: "soul" });
if (appended && appended.appended && appended.entry) {
  const latencyMs = asked && typeof asked.elapsedMs === "number" ? asked.elapsedMs : null;
  emit(onSoulTranscript, { ...appended.entry, latencyMs });
}
```

- `asked.elapsedMs` は知性契約（`src/mind/brains.mjs` の `MindSessionAskResult` typedef）が持つ
  ask 開始〜応答確定の実測 ms（Domain A で Claude/Codex 両頭が実装済み・inventory §2-1 で
  「fire-orchestrator は現状 elapsedMs を消費していない」と確認された未消費フィールドを、今回
  初めて soul 行まで運ぶ）。
- `appended.entry` は `transcriptBuffer.append()` が返す **`Object.freeze` 済みの正本オブジェクト**
  （`transcript-buffer.mjs:161`）。直接プロパティを足すと freeze で失敗するため、**スプレッドで
  新規オブジェクトを作り、そこへ `latencyMs` を additive に足して emit する**（正本は 1 バイトも
  変更しない・`buffer.all()` で見た entry には `latencyMs` プロパティ自体が存在しないことをテストで
  確認済み＝fire-orchestrator.test.mjs 新規テスト 1 本目）。
- **NG ブロック時（②）・barge-in 中断時（④）には触れていない**: この 2 経路の soul 追記は「発話が
  没になった/中断された」という性質のもので、LLM 応答レイテンシという情報の意味が薄いことに加え、
  **blocking #7「KILL/NG 弁の頭非依存」を一切揺るがさないための保守的な線引き**——検問所
  （`killed` 判定・`containsNgWord` 判定）そのものの行は 1 行も変更していないだけでなく、検問所の
  **すぐ内側にある emit 呼び出し自体にも触れていない**（自然完了パスだけを触ることで「検問所節
  全体に触れていない」という言明を単純化・検証しやすくした）。これにより NG ブロック時の
  `souls[0]` には `latencyMs` プロパティ自体が存在しない（`hasOwnProperty` で確認するテストを追加）。
- `broadcastSoulTranscript`（cockpit-server.mjs）は `entry.latencyMs` が number ならそれを使い、
  そうでなければ従来どおり `null`（後方互換・既存の `hooks.onSoulTranscript({...})` 呼び出し形
  （latencyMs フィールド無し）を渡す既存テストは無変更のまま緑）。

### 3-2. brain 札の載せ方（brain-swap.md §2「観測層に発話ごとの頭名+応答レイテンシ」）

**fire-orchestrator.mjs には一切触れていない**（推奨実装どおり）。`cockpit-server.mjs` 側で
Domain B が注入済みの `brainStatusImpl()`（= `cockpit.mjs` の `brainStatus()`・`{brain,
credentialHealth}` を返す）を読み、2 箇所で additive にフィールドを足す:

1. `broadcastSoulTranscript(entry)`: `brain: brainStatusImpl()?.brain ?? null` を transcript
   イベントへ追加（soul 行のみ・you/viewer 行の transcript イベントには brain フィールド自体が
   乗らない＝耳の onTranscript / ingestChatMessage の broadcast 呼び出しは無変更）。
2. `onUsage` フック: `{ ...info, brain: brainStatusImpl()?.brain ?? null }` を usage イベントへ
   追加。

この設計により **fire-orchestrator（発火オーケストレータ）は最後まで頭非依存のまま**（orchestrator
は「どの頭が応答したか」を一切知らない・知る必要もない——頭の識別は cockpit-server が観測時点で
「今の頭」を読むだけ）。inventory §2-1 の「orchestrator は replyText/usage のみ消費」という契約の
凍結方針とも整合する。

**既知の近似（in-flight 切替）**: 配信中に頭を切り替えた直後の in-flight 応答は「切替前の頭が
生成した」応答だが、この実装は broadcast 時点の `brainStatusImpl()?.brain`（＝今の頭）を読むため、
稀に札がズレうる。配信前選択が本線（切替は運用外）という v0 裁定の下で許容し、
`brain-swap-followup.md` §C-1 に記録した。

### 3-3. view-logic の表示（既存ワイヤ形状・表示文字列の後方互換）

- `latencyLabel(latencyMs, brain)`: 第 2 引数 `brain` を additive に追加。`brain` が truthy なら
  `"(1.5s · claude)"`、falsy（未指定/null/空文字）なら従来どおり `"(1.5s)"`。`latencyMs` が
  null/undefined なら brain の有無に関わらず `null`（発話していない soul 行では札も出さない）。
- `usageNoteText(d)`: `d.brain` が truthy なら vision 表記の直後に `"[claude]"` を追加
  （`"usage(vision)[codex]: input=... output=..."`）。`d.brain` が falsy なら従来どおりの文字列
  （usage.test.mjs の既存 fixture は無変更のまま緑）。
- `rows.mjs` の `feedWithTranscript`: `latencyLabel(d && d.latencyMs, d && d.brain)` と d.brain を
  additive に渡すだけ（既存の呼び出し `latencyLabel(d && d.latencyMs)` 相当の形は完全後方互換）。
- これら意匠（区切り文字 `·`・brain 札の位置）は cockpit-redesign.md の承認済み UI 仕様に明記が
  無いため Domain C の裁量で決めた。人間ゲートで見た目を確認する余地がある旨を followup に記録した
  （純関数・fixture 固定のため見直しは view-logic 側 1 箇所の変更で閉じる）。

### 3-4. 設定層「頭脳」区画（settings-drawer.mjs）

「声の出力先」行（:388-405 相当）を写経した第 4 の drawer-section として追加した:

- **select の選択肢**: `BRAIN_OPTIONS = Object.keys(BRAIN_LABELS).map(...)`。`BRAIN_LABELS`
  （`view-logic/health.mjs` 新設）は `{claude: "Claude (Opus 4.8)", codex: "Codex (GPT-5.6 Terra)"}`
  ——`src/mind/brains.mjs` の `BRAINS[*].label` と**値は一致**させつつ、**import はしない**
  （cockpit-server.mjs が「頭 id 2 値を直書きする」責務境界規律と同型・settings-drawer.mjs は
  `src/mind/brains.mjs` を知らない）。
- **onBrainSet ハンドラ**: `onAudioSet` の写経（POST /api/brain → `brainPostErrorText` で失敗文言 →
  成功なら `applySnapshot`）。
- **select の初期値/現況同期**: マイク/視界/出力先と違い頭脳には一覧取得 API が無い（固定 2 択）ため、
  `useEffect` で `settings.brain.brain` の変化に `brainSelected` を同期する設計にした（chat source の
  ような「編集中は復元しない」ガードは設けていない・選択→即 Set という短いフローでは実害は小さいと
  判断・followup §C-3 に記録）。
- **資格情報の健康表示**: `brainCredentialHealthLabel(settings.brain)`（health.mjs 新設）が
  `credentialHealth` boolean を「ログイン確認済み / 未検出（codex login してや）/ unknown」の 3 分岐に
  文言化する。**settings-drawer.mjs はここでも boolean を文言化するだけ**——`credentialHealth` の
  由来（`existsSync(credentialPath)`・cockpit.mjs の `brainStatus()`）にも、パス・中身にも一切触れない
  （blocking #4）。
- **app.mjs**: `settingsFromSnapshot` に `brain: (s && s.brain) ?? null` を additive で追加（既存の
  `channel`/`visionTarget`/`audioDevice` と同型の null 許容パターン）。これにより `SettingsDrawer` の
  `settings` prop に `brain` が自然に流れる（App 本体の JSX は無変更・props は丸ごと settings を渡す
  既存の配線のまま）。

### 3-5. テストの構造的制約（正直な申し送り）

委任文は「settings-drawer の頭脳区画の描画/操作テスト（既存 drawer テストの写経・select 変更→
onBrainSet 呼ばれる・status 表示）」を求めていたが、**このリポジトリには `SettingsDrawer` 本体
（hooks を使う関数コンポーネント）を実際にレンダリングしてイベントを発火する DOM シミュレーション
基盤（jsdom 等）が無い**。`cockpit-ui.test.mjs` 冒頭のコメント（「ControlBar / SettingsDrawer 本体は
hooks を使うため collectText の『関数コンポーネント展開』流儀では走査できない」・domain-b レビュー
§6 申し送り 8）が示すとおり、既存の `onAudioSet`/`onChatConnect`/`onVisionSet` 等も**同型の理由で
一切直接テストされていない**。この構造的制約に従い、頭脳区画についても:

- 葉部品 `SettingsSelect` の vnode 走査テストで、`BRAIN_LABELS` 由来の options（settings-drawer.mjs
  の `BRAIN_OPTIONS` と同型のデータ）が正しく描画されることを固定した。
- view-logic（`brainLabel` / `brainCredentialHealthLabel` / `brainPostErrorText`）の fixture
  テストで表示導出ロジックを個別に固定した。
- `onBrainSet` ハンドラ自体（POST 呼び出し → エラー分岐 → snapshot 適用の一連の処理）は構造的に
  ユニットテストできない——これは本 Domain C が新規に持ち込んだ制約ではなく、この製品全体の既存の
  テスト方針の限界である。followup §C-2 に記録し、Orch への質問として下記 §7 にも明記する。

### 3-6. エンドポイント数の実測根拠（§6 小タスク）

`cockpit-server.mjs` の `pathname === "/..."` 分岐を grep で数えた結果、以下 **19 個**を確認した:

```
1. GET  /
2. GET  /api/devices
3. GET  /api/state
4. GET  /api/events
5. POST /api/ears/start
6. POST /api/ears/stop
7. POST /api/fire
8. GET  /api/windows
9. POST /api/vision-target
10. POST /api/vision-fire
11. GET  /api/audio-devices
12. POST /api/audio-device
13. POST /api/self-fire
14. POST /api/verbosity
15. POST /api/kill
16. POST /api/brain
17. POST /api/channel
18. POST /api/chat/connect
19. POST /api/chat/disconnect
```

Domain B レビュー指摘（「変更前 18・現在 19」で 1 ズレ）と一致。コメント（`:279`・`:1059`）を
「18」→「19」に訂正した（**コメントのみの訂正・機能変更なし**・SSE 数 13 は不変）。

## 4. 無退行の自己証明（blocking #2・blocking #6・blocking #7）

- **KILL/NG 検問所ロジックは 1 行も変更していない**: `processAskedReply` の `killed` 判定（旧
  :348-351）・`containsNgWord` 判定（旧 :357-364）は `git diff` 上、行番号ズレを除き判定条件そのものに
  差分が無い（latencyMs 配線は自然完了パス :452 以降のみに追加）。fire-orchestrator.test.mjs の
  既存 NG/KILL テスト（`ngBlocked: ...` 系・`kill()`/`interrupt()` 系）はすべて無変更のまま緑。
  新規テストでも「NG ブロック時の entry には latencyMs フィールド自体が乗らない」ことを
  `hasOwnProperty` で直接確認した（§3-1）。
- **ワイヤ additive のみ**: 新フィールド（`latencyMs` 実値・`brain`）はいずれも既存 SSE イベント
  （`transcript`・`usage`）への additive 追加。新しい SSE 種別は増やしていない（13 のまま）。
  新しい HTTP エンドポイントも増やしていない（POST /api/brain は Domain B が既に追加済み・本
  Domain C はエンドポイント数コメントの実測訂正のみ）。
- **既存テスト全緑**: baseline 814/814 → 実装後 827/827。fail/cancelled/skipped/todo は全て 0。
  既存の `usageNoteText`・`latencyLabel`・`feedWithTranscript`・`broadcastSoulTranscript`（既存呼び
  出し形）のテストはすべて無変更のまま緑（新規引数/フィールドはすべて optional・後方互換）。
- **Domain A/B のファイルは 1 バイトも触っていない**: `git status --short apps/soul/` で
  Domain A（`src/mind/brains.mjs` 等・`env-guard.mjs`・`.gitignore`）と Domain B
  （`scripts/cockpit.mjs`・`cockpit-settings-store.mjs` 等）のファイルは私の diff に一切現れない
  （§1 の「無変更（確認済み）」節に列挙）。
- **`src/mind/llm-session.mjs`（Claude 頭）は wave 全体を通じて無変更**（`git status` に現れない）。

## 5. git 生出力（依存不変・zone 内確認）

**`git diff --stat apps/soul/agent/package.json apps/soul/agent/package-lock.json`**:
```
（無出力＝package.json・package-lock.json とも無変更。install ゼロ・lockfile 不変）
```

**`git status --short apps/soul/`**:
```
 M apps/soul/README.md                                          ← Domain C（私）
 M apps/soul/agent/.gitignore                                   ← Domain A・私は無変更
 M apps/soul/agent/scripts/cockpit.mjs                          ← Domain B・私は無変更
 M apps/soul/agent/scripts/cockpit.test.mjs                     ← Domain B・私は無変更
 M apps/soul/agent/src/cockpit/cockpit-server.mjs               ← Domain C（私）
 M apps/soul/agent/src/cockpit/cockpit-server.test.mjs          ← Domain C（私）
 M apps/soul/agent/src/cockpit/cockpit-settings-store.mjs       ← Domain B・私は無変更
 M apps/soul/agent/src/cockpit/cockpit-settings-store.test.mjs  ← Domain B・私は無変更
 M apps/soul/agent/src/cockpit/cockpit-ui.test.mjs              ← Domain C（私）
 M apps/soul/agent/src/cockpit/ui/app.mjs                       ← Domain C（私）
 M apps/soul/agent/src/cockpit/ui/rows.mjs                      ← Domain C（私）
 M apps/soul/agent/src/cockpit/ui/settings-drawer.mjs           ← Domain C（私）
 M apps/soul/agent/src/cockpit/view-logic/health.mjs            ← Domain C（私）
 M apps/soul/agent/src/cockpit/view-logic/health.test.mjs       ← Domain C（私）
 M apps/soul/agent/src/cockpit/view-logic/settings.mjs          ← Domain C（私）
 M apps/soul/agent/src/cockpit/view-logic/settings.test.mjs     ← Domain C（私）
 M apps/soul/agent/src/cockpit/view-logic/transcript.mjs        ← Domain C（私）
 M apps/soul/agent/src/cockpit/view-logic/transcript.test.mjs   ← Domain C（私）
 M apps/soul/agent/src/cockpit/view-logic/usage.mjs             ← Domain C（私）
 M apps/soul/agent/src/cockpit/view-logic/usage.test.mjs        ← Domain C（私）
 M apps/soul/agent/src/mind/env-guard.mjs                       ← Domain A・私は無変更
 M apps/soul/agent/src/mind/env-guard.test.mjs                  ← Domain A・私は無変更
 M apps/soul/agent/src/mind/fire-orchestrator.mjs               ← Domain C（私）
 M apps/soul/agent/src/mind/fire-orchestrator.test.mjs          ← Domain C（私）
?? apps/soul/agent/src/mind/brains.mjs                          ← Domain A・私は無変更
?? apps/soul/agent/src/mind/brains.test.mjs                     ← Domain A・私は無変更
?? apps/soul/agent/src/mind/codex-session.mjs                   ← Domain A・私は無変更
?? apps/soul/agent/src/mind/codex-session.test.mjs              ← Domain A・私は無変更
```

私（Domain C）の変更は 17 ファイル（README 1 + soul zone 16）すべて soul zone 内 + README に
収まっている。器（`apps/runtime-player`）・契約（`channel-*-contract`）・`packages/`・root
`pnpm-lock.yaml`・`.tmp/`・`apps/authoring-host`・`discussion/mesh-generation` には一切触れていない
（root の `git status` に残るそれら周辺の差分は、セッション開始前の gitStatus スナップショットに
既に記載されていた他作業分であり、私の変更ではない——着手前後で diff が増えていないことを確認済み）。

## 6. followup 台帳

`C:\workspace\remie\code\ai-native-live2d-editor\discussion\ai-cohost\implementation\waves\brain-swap\brain-swap-followup.md`
を新規作成した。**9 項目**（すべて non-blocking）:
- A（Domain A 由来）: 5 項目（forced_login_method テスト欠如・OPENAI_BASE_URL warn 非対称・
  buildInput 未知ブロック黙殺・turn2 content 配列未テスト・turn.failed 時の台帳記録直接テスト無し）。
- B（Domain B 由来）: 3 項目（brainInitialChoice 削除の記録・main() クロージャ本体の単体テスト不在・
  session let 型注釈未締結）。
- C（本 Domain・観測層 + UI 設計）: 5 項目（in-flight 切替時の brain 札近似・settings-drawer 本体の
  構造的テスト不能・brain select の同期方式・usage/latency 意匠の人間ゲート未確認・エンドポイント数
  コメント訂正済みの記録）。

## 7. 迷った点・Orch への質問

1. **settings-drawer.mjs「頭脳」区画の直接インタラクションテストが構造的に作れない**（§3-5・
   followup §C-2）: 委任文は「select 変更→onBrainSet 呼ばれる」テストを求めていたが、このリポジトリの
   既存規律（hooks 使用コンポーネントは vnode 走査で検証できない・domain-b レビュー §6 申し送り 8）に
   より、`onAudioSet` 等の既存パターンを含め構造的に不可能だった。葉部品の vnode 走査 + view-logic
   fixture で代替した。Orch が「jsdom 等を新規導入してでもインタラクションテストを書くべき」と判断
   するなら、それは頭脳区画に限らず既存の全設定行（Channel/chat/mic/audio/vision）にも及ぶ横断的な
   テスト基盤の追加投資になるため、本 Domain C 単体の判断では見送った。差し戻し可。
2. **brain select の初期値/現況同期を useEffect（chat source 型のガード無し）にした**（§3-4・
   followup §C-3）: 選択途中で SSE state が到着すると選択がリセットされうる。実運用は「選ぶ→即 Set」
   の短いフローなので実害は小さいと判断したが、人間ゲートで違和感があれば chat source 型の
   「編集中は復元しない」ガードへ寄せる余地がある。
3. **usage/latency の brain 札の表記（区切り文字 `·`・位置）は意匠として裁量で決めた**（§3-3・
   followup §C-4）: cockpit-redesign.md に明記が無いため。人間ゲートで見た目を確認し、必要なら
   view-logic 側 1 箇所（`usage.mjs`/`transcript.mjs`）の変更で閉じる。
4. **NG ブロック時・barge-in 中断時の soul 行には latencyMs/brain を乗せていない**（§3-1）: これは
   blocking #7 を保守的に守るための意図的な線引きであり、質問ではなく確認事項として明記する——
   もし将来「NG ブロック時にも応答レイテンシを観測したい」というニーズが立つなら、検問所ロジック
   自体（判定条件）には触れずに `souls[0]` への entry 拡張だけを NG ブロック分岐にも足せる（今回は
   スコープを最小に絞り、自然完了パスのみに限定した）。

以上、Domain C の実装は完了・全 827 緑。KILL/NG 検問所ロジック無変更・観測層 additive のみ・
資格情報は boolean の文言化のみ（中身不読）・Domain A/B ファイル不変・install/commit ゼロを
厳守しています。
