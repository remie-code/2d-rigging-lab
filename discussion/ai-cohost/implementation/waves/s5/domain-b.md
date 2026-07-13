# S5 Domain B: 視覚発火の結線（mind + session・第二発火種別）

> Status: 実装完了・機械ゲート緑（2026-07-13）。人間ゲート（実ゲーム窓での視認・操縦席結線）は
> 未実施＝後続 Domain C と人間ゲートに持ち越し。**実 SDK・実 API 呼び出しは一切していない（全 fake）**。
> 担当: Gnome（Orch-Sylph 委任）。対象パッケージ: `apps/soul/agent`（独立 npm・workspace glob 外＝lockfile 不変）。
> 契約の正: [../../orchestration/s5-wave-plan.md](../../orchestration/s5-wave-plan.md) §2・§3 Domain B /
> [../../orchestration/s5-planning-inventory.md](../../orchestration/s5-planning-inventory.md) §2-1〜2-4, §5 /
> 消費した Domain A 成果物: [domain-a.md](domain-a.md)（`captureWindow`/`listWindows` の契約）。

## 0. パイプライン（この Domain が敷いた線）

```
通常 Fire（従来どおり・完全不変）:
  fire() → busy/耳未起動チェック → formatFireInjection(直近窓) → session.ask(injectedText:string)
         → processAskedReply（パーサ→speak→soul記録→演出）→ idle

視覚発火（S5 新設・第二発火種別）:
  fire({ vision: true })
    → busy/耳未起動チェック（通常 Fire と共有・共通コード）
    → getVisionTarget() でタイトル解決
        └─ null/空/throw → fireVisionError(kind:"no-target") 診断・{fired:false, reason:"vision-no-target"}（ゴースト・ask を呼ばない）
    → thinking 遷移
    → captureImpl(title)（既定 captureWindow・Domain A の器官）
        └─ {error:{kind}} → fireVisionError(kind) 診断・{fired:false, reason:"vision-capture-failed", kind}
                              （session.ask を呼ばない＝盲目のまま撃たない・成功を捏造しない）
        └─ 成功 → onVisionCaptured({title,width,height,jpegBase64,elapsedMs}) 通知
                 → formatFireInjection(直近窓) + VISION_INSTRUCTION_TEXT を合成
                 → contentBlocks = [ {type:'image', source:{type:'base64', data, media_type:'image/jpeg'}},
                                      {type:'text', text: 会話窓+視覚指示} ]  ※画像が先頭
                 → session.ask(contentBlocks)
                 → processAskedReply（★通常 Fire と完全共通のパーサ→speak→soul記録→演出）
    → idle

processAskedReply（通常・視覚共通・S5 で抽出したヘルパー）:
  asked.usage != null → onUsage({usage, vision}) 通知
  → parseExpressionTags(replyText) → speechText/events/diagnostics
  → 空応答/未知タグのみ → fireEmptyReply
  → speechText空・events あり → expression-only（envelope のみ）
  → speechText あり → speak(speechText) → buffer.append(speaker:"soul", text:speechText) → onSoulTranscript
     → applyExpressions(events) → envelope 送出
  （**画像 base64 は buffer.append に一切渡さない**＝会話ログの正本は speechText のみ）
```

`captureWindow` は Domain A の純部品をそのまま import して使う（Domain A のコード・契約は一切変更していない）。

## 1. 実装/改修したファイル一覧（すべて `apps/soul/agent/`）

| ファイル | 種別 | 変更点 |
|---|---|---|
| `src/mind/llm-session.mjs` | 改修 | `ask(content)` を `string \| ContentBlockParam[]` 受理に拡張。ガードを「非空文字列 or 非空配列」に拡張。push 形状は `content: <string \| 配列>` のまま透過（配列を分解しない）。usage 等の戻り値形状は無変更。 |
| `src/mind/llm-session.test.mjs` | 改修 | S5 ask 拡張テスト 3 本追加（文字列 push 無退行 / content 配列 push / 空文字列・空配列・非文字列非配列の TypeError）。既存 7 本は無変更。 |
| `src/mind/fire-orchestrator.mjs` | 改修 | 第二発火種別 `fire({vision:true})` を追加。`processAskedReply`（パーサ→speak→soul記録→演出の共通処理）と `fireVision`（対象解決→capture→注入）を新設。`captureImpl`/`getVisionTarget`/`onVisionCaptured`/`onUsage` オプション追加。`FIRE_SYSTEM_PROMPT` に画面が渡ることがある旨を最小追記。通常 `fire()`（引数なし）の分岐仕様・診断発行順序・戻り値の形は元のインライン実装と完全同一（コードをヘルパーへ移しただけ）。 |
| `src/mind/fire-orchestrator.test.mjs` | 改修 | 視覚発火の縦検証 14 本追加（成功 / 失敗 4 kind ×1 / no-target 3 パターン / busy 無視 / 耳未起動 / dispose 後拒否 / FIRE_SYSTEM_PROMPT 画面追記 / 通常 Fire の usage 計器 2 本）。既存 21 本は無変更＝無退行。 |
| `scripts/cockpit.mjs` | 改修 | `sessionProxy` 生成ロジックを `createSessionProxy({getUrl, ensureFireResources, getSession})` として抽出・export（テスト可能化のための最小構造変更）。`ask(input)` は string/content 配列を分岐せず素通しする。Channel URL 未設定チェック・`ensureFireResources` 呼び出し順は完全不変。視覚発火のエンドポイント/UI/main 結線（onVisionCaptured・onUsage を SSE へ流す等）は**触っていない**（Domain C の領分）。 |
| `scripts/cockpit.test.mjs` | 改修 | `createSessionProxy` のテスト 3 本追加（URL 未設定で ensureFireResources を呼ばず throw / 文字列透過 / content 配列透過）。既存 10 本は無変更。 |

**器コード（`apps/runtime-player/**`・`packages/**`）・契約 JSON・`pnpm-lock.yaml`・`apps/soul/agent/package.json` は完全不変**（`git diff --stat` 出力ゼロで確認・§8）。`.tmp/facex-*` 配下（別セッション領分）・`src/eyes/**`（Domain A の成果物）は一切触っていない。

## 2. `llm-session.ask` 拡張の契約

```
ask(content: string | Array<ContentBlockParam>) => Promise<{ replyText, usage, ttftMs, elapsedMs }>
```

- **受理**: 非空文字列（従来）または非空配列（S5 新規）。それ以外（空文字列・空配列・null・undefined・数値等）は同期的に `TypeError` を throw する async 関数（呼び出し側は `await` 経由で reject を受ける・テストで `assert.rejects` 固定）。
- **push 形状**: `input.push({ type:"user", message:{ role:"user", content }, parent_tool_use_id:null })` の `content` に受理した値をそのまま渡す（文字列なら文字列、配列なら配列＝分解・変換をしない）。SDK の `MessageParam.content: string | ContentBlockParam[]` 型にそのまま合致する。
- **usage の戻り値形状は無変更**（既に `ask` の戻り値 `{replyText, usage, ttftMs, elapsedMs}` に載っている・S1 実装のまま）。usage を結線層へ通知するのは呼び出し側（fire-orchestrator）の責務（§3）。

## 3. fire-orchestrator 視覚発火の分岐仕様

### 3-1. busy / 耳未起動判定は通常 Fire と共有

`fire(fireOptions)` の先頭で `disposed` → `state !== "idle"`（busy）→ `getBuffer() == null`（ears-not-running）の 3 判定を行い、**この 3 判定は通常 Fire・視覚発火で完全に同一のコードパス**を通る（`fireOptions.vision === true` の分岐はこの後）。busy 中の視覚発火は通常 Fire 同様 `{fired:false, reason:"busy", state}` で無視され、**キャプチャすら呼ばれない**（テストで固定・§5 のテスト一覧参照）。

### 3-2. 対象未設定（no-target）

`getVisionTarget` が未注入、または呼び出し結果が非文字列/空文字列、または呼び出しが throw した場合、すべて「対象未設定」として扱い、**`session.ask` を呼ばずに中止**する:

```
onFire({ accepted: false, reason: "vision-no-target", vision: true })
onDiagnostic({ type: "fireVisionError", kind: "no-target", message: "vision target window is not set" })
→ { fired: false, reason: "vision-no-target" }
```

state は `idle` のまま（thinking へ遷移する前に判定するため・「ゴースト行」として自然に見える）。

### 3-3. キャプチャ失敗（各 kind）

対象が解決できたら `thinking` へ遷移し `captureImpl(title)` を呼ぶ。`{error:{kind, message}}` が返れば **`session.ask` を呼ばずに中止**する（Domain A の `captureWindow` が返す 4 kind = `notFound`/`minimized`/`failed`/`timeout` をそのまま透過）:

```
onDiagnostic({ type: "fireVisionError", kind, message })
→ { fired: false, reason: "vision-capture-failed", kind }
```

speak を呼ばない・soul 追記しない・4 kind すべてで同一の中止経路（テストで各 kind を個別に固定・§5）。

### 3-4. キャプチャ成功 → 注入 → 従来経路

キャプチャが成功したら:
1. `onVisionCaptured({title, width, height, jpegBase64, elapsedMs})` を通知（「見た」事実・§4-1）。
2. `formatFireInjection(buffer.all(), {...})`（S3 Domain A の純関数をそのまま再利用）で会話窓を整形。
3. `instructionText = injectedText.length > 0 ? \`${injectedText}\n${VISION_INSTRUCTION_TEXT}\` : VISION_INSTRUCTION_TEXT`（空窓でも中止しない＝視覚発火は画像だけでも成立する設計。§7 質問1）。
4. `contentBlocks = [image(先行), text]` を組み立て `session.ask(contentBlocks)`。
5. 戻りを `processAskedReply(buffer, asked, true, {injectedChars, includedCount, vision:true})` へ渡す（**通常 Fire と完全共通の処理**＝パーサ→speechText/events分岐→speak→soul記録→envelope送出）。

視覚発火の成功時戻り値は通常 Fire と同型に `vision:true` を足したもの: `{fired:true, replyText:speechText, expressions, injectedChars, includedCount, vision:true}`。通常 Fire の戻り値には `vision` フィールドを一切含めない（無退行）。

### 3-5. 失敗時に発火を正直に中止することの担保

- no-target・4 種のキャプチャ失敗のいずれも **`session.ask` を呼ばない**（テストで `askCalled === false` を明示的に固定・§5）。
- 成功を捏造しない: Domain A の `captureWindow` 自体が「白紙成功マーカー」を形式ガードで弾く設計（domain-a.md §2 注記）であり、この Domain はその戻り値をそのまま信頼して中止/続行を判断する（独自の中身検証はしない＝Domain A の責務を侵さない）。
- 発話しない: 上記いずれの中止経路も `speak`/`buffer.append` を経由しない（会話ログに「見たふり」の痕跡が残らない）。

## 4. ワイヤ契約（Domain C が読む・フックのペイロード形）

### 4-1. `onVisionCaptured(info)` — キャプチャ成功の通知（「見た」事実）

```
{ title: string; width: number; height: number; jpegBase64: string; elapsedMs: number }
```

- キャプチャ成功のたびに 1 回発火（失敗時は発火しない＝キャプチャ失敗は `onDiagnostic` の `fireVisionError` 経由）。
- `jpegBase64` はサムネ表示用（Domain C の操縦席「見た」マーカー行のサムネ・SSE 通知に載せてよい）。**転写バッファ（会話ログの正本）には一切積まれない**＝ディスク非保存の流儀を会話ログにも適用した設計（§6）。

### 4-2. `onUsage(info)` — ask ごとの usage 通知（通常 Fire・視覚発火の両方）

```
{ usage: any; vision: boolean }
```

- `session.ask` の戻り値 `usage` が `null`/`undefined` でないときのみ発火（fake session が usage を返さないテストでは発火しないことをテストで固定）。
- `usage` は SDK の `result.usage`（`input_tokens`/`output_tokens`/cache 系等）をそのまま透過（形状の加工はしない）。
- `vision` で通常 Fire（`false`）と視覚発火（`true`）を区別できる（wave 計画 §2 裁定 2「累積の重さを早期検知」の用途に、視覚発火由来かどうかの識別が要ると判断した独自追加・§7 質問2）。

### 4-3. `onDiagnostic` — S5 で増える type

| type | ペイロード | 意味 |
|---|---|---|
| `fireVisionError` | `{ type, kind, message }` | 視覚発火の中止理由。`kind` は `"no-target"` \| `"notFound"` \| `"minimized"` \| `"failed"` \| `"timeout"`（後者 4 つは Domain A `captureWindow` の kind をそのまま透過）。 |

（`fireError`/`fireEmptyReply`/`expression*` 系は S3/S4 と共通・変更なし。）

### 4-4. `fire()` の戻り値型（視覚発火分・追加）

| 状況 | 戻り値 |
|---|---|
| busy | `{ fired:false, reason:"busy", state }`（通常 Fire と共通） |
| 耳未起動 | `{ fired:false, reason:"ears-not-running" }`（通常 Fire と共通） |
| 対象未設定 | `{ fired:false, reason:"vision-no-target" }` |
| キャプチャ失敗 | `{ fired:false, reason:"vision-capture-failed", kind }` |
| 成功・発話あり | `{ fired:true, replyText, expressions, injectedChars, includedCount, vision:true }` |
| 成功・演出のみ | `{ fired:false, reason:"expression-only", expressed:true, expressions, injectedChars, includedCount, vision:true }` |
| 成功・空応答 | `{ fired:false, reason:"empty-reply" }`（通常 Fire と共通） |
| ask/capture 例外 | `{ fired:false, reason:"error", message }`（通常 Fire と共通の `fireError` 経路） |

## 5. content 配列の順序と会話ログ非画像の担保

- **画像先行**: `contentBlocks[0]` が常に `{type:'image', ...}`、`contentBlocks[1]` が `{type:'text', ...}`（inventory §2-2 の公式推奨順）。テストで配列長・各要素の `type`/`source`/`text` を明示的に固定（`fire-orchestrator.test.mjs` の成功系テスト）。
- **会話ログに画像を積まない**: `processAskedReply` の `buffer.append` は常に `{startMs:0, endMs:0, text:speechText, speaker:"soul"}` のみ（通常 Fire と完全同一の呼び出し）。視覚発火専用の分岐や画像フィールドの追加は一切していない。テストで `JSON.stringify(buffer.all())` に base64 文字列が含まれないことを明示的に固定。
- 画像はメモリ内の `contentBlocks` と `onVisionCaptured` 通知のみに存在し、ディスクへは一切書かない（Domain A が既にキャプチャ自体をディスク非書き込みで実装済み・この Domain でも新たにファイル書き込みを追加していない）。

## 6. FIRE_SYSTEM_PROMPT 追記の最小性

既存の S4 タグ教示（6 語）の末尾に 1 文だけ追記した:

```
画面（画像）が渡されることがあります。その場合は画面を見て、自然に反応してください。
```

視覚指示の本体（「今の画面を見て、直近の会話と合わせて自然に反応してください」）は `VISION_INSTRUCTION_TEXT` として content の text ブロック側（ask ごとの動的注入）に置いており、system prompt には持たせていない。人格の作り込みはしていない（persona の領分・引き続き貧しく・S4 domain-a.md の方針を踏襲）。

## 7. §質問（Orch / Domain C への申し送り・迷った裁定点）

1. **視覚発火は空窓でも続行する設計**: wave 計画 §3 は「キャプチャ成功なら注入: 会話窓を formatFireInjection で整形し…」という順序を示しており、通常 Fire のような「空窓なら ask を無駄撃ちしない」判定を**視覚発火には適用していない**（`includedCount === 0` でも中止せず、`VISION_INSTRUCTION_TEXT` 単独で ask する）。「見て」と言われたら会話が無くても画面だけで反応してよい、という解釈だが、契約に明記された裁定ではないため確認してほしい。もし空窓時も中止すべきなら `fireVision` 内に 1 判定を足すだけで対応できる。
2. **onUsage に `vision` フラグを独自追加**: wave 計画 §3 の文言は「usage(...)を onUsage フックで通知」とのみあり、通常/視覚の区別を明示していない。累積コストの早期検知（裁定2の目的）には由来の区別が要ると判断し `{usage, vision}` 形にした。Domain C の計器実装がこの形を期待できない場合は、`usage` 単体に戻す/別フック（`onVisionUsage`）に分ける等の選択肢がある。
3. **getVisionTarget の注入形は cockpit main の設計待ち**: この Domain は `getVisionTarget: () => (string|null) | Promise<string|null>` という関数型の口を開けただけで、cockpit-settings から実際に読み出す実装（対象ウインドウ設定の永続化・POST /api/vision-target 等）は Domain C の領分として一切触っていない。同様に `captureImpl` は既定 `captureWindow` をそのまま使う想定で、cockpit main 側で差し替える必要はないはず（テスト時のみ fake 注入）。
4. **onVisionCaptured のサムネを SSE にどう載せるか**: この Domain はフックを emit する準備までで、cockpit-server の SSE broadcast への配線・cockpit-page のサムネ表示は Domain C の領分として未接続（S4 domain-a.md §9-5 の「onExpression 未接続」と同型の申し送り）。
5. **視覚発火の onFire ペイロードに `vision:true` を追加**: 通常 Fire の `onFire({accepted, reason, injectedChars, includedCount, atMs})` 形に対し、視覚発火は `{accepted, reason, vision:true, atMs}`（no-target 時は `atMs` なし）と、成功受理時は `{accepted:true, vision:true, atMs}`（`injectedChars`/`includedCount` を持たない＝対象解決時点ではまだ窓を切っていないため）。通常 Fire の onFire 形状に完全一致させることは（injectedChars がキャプチャ後にしか分からないため）構造的にできなかった。Domain C の操縦席実装でこの形状差を吸収してほしい。
6. **キャプチャの引数不正 throw**: Domain A の `captureWindow(title)` は `title` が非文字列/空文字列なら同期 `TypeError` を throw する契約（domain-a.md §2）。この Domain の `fireVision` は `title` を必ず `typeof title === "string" && title.length > 0` を確認してから `captureImpl` を呼ぶため、実運用でこの throw 経路を踏むことはない想定だが、`captureImpl` 自体が予期しない throw をした場合は `fireVision` の try/catch が `fireError` 診断（`{type:"fireError", message}`）へ落とす（`fireVisionError` ではなく既存の `fireError` 経路）。この使い分け（構造化エラーは `fireVisionError`・想定外の例外は `fireError`）が適切か確認してほしい。

## 8. 機械ゲート生数字

`cd apps/soul/agent && node --test`（全テスト・新規込み総数・タイムアウト 300s 付きで実行）:

```
# tests 392
# pass 392
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

（S5 Domain A 完了時点のベースライン 372 → +20。内訳: `llm-session.test.mjs` +3 / `cockpit.test.mjs` +3 /
`fire-orchestrator.test.mjs` +14。既存テストは 1 本も変更していない＝無退行。通常 `fire()` の既存 21 本は
コード内部がヘルパーへ移った後もそのまま緑。）

`git diff --stat -- apps/runtime-player packages` / `git diff --stat -- pnpm-lock.yaml
apps/soul/agent/package.json` はいずれも出力なし（差分ゼロ）。`git status --porcelain` で変更ファイルは
`apps/soul/agent/scripts/cockpit.mjs` / `cockpit.test.mjs` / `src/mind/fire-orchestrator.mjs` /
`fire-orchestrator.test.mjs` / `src/mind/llm-session.mjs` / `llm-session.test.mjs` の 6 ファイルのみで
あることを確認した（`.tmp/facex-*`・`src/eyes/**`・`discussion/**` の他 wave 成果物は一切触っていない）。
実 SDK・実 PowerShell・実マイク・実 TTS はいずれも呼んでいない（capture/session/channel すべて fake）。
