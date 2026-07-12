# S1 Domain C レビュー（Review-Sylph・3 レーン）

> Status: レビュー完了（2026-07-12, Review-Sylph / 呼び出し元 Orch-Sylph）。
> 対象: [../../waves/s1/domain-c.md](../../waves/s1/domain-c.md)（Gnome 実装記録）。
> 判定基準: [../../orchestration/s1-wave-plan.md](../../orchestration/s1-wave-plan.md) §3 Domain C・§4 /
> [../../orchestration/s1-planning-inventory.md](../../orchestration/s1-planning-inventory.md) §4 /
> SDK 型定義 `apps/soul/agent/node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts`（0.3.207）。
> 規律: 読み取り専任・実 SDK 実行なし（first-light.mjs 未実行）・実器/スピーカー未接続。

## 総合判定: **PASS**（blocking 指摘ゼロ・non-blocking 3 件）

3 レーンすべて PASS。SDK オプション名・メッセージ形は .d.ts と**全項目一致**。テストは自環境で
84/84 緑・exit 0（ハング未再現）。保護パス（pnpm-lock / runtime-player / C4 契約 fixture）は
diff ゼロを独立確認。experiments の数字は domain-c.md §8.3 の生出力と**転記ミスなく相互整合**。

---

## レーン 1: spec — **PASS**

### 1-1. SDK オプションの .d.ts 突合（全 8 項目 一致）

`llm-session.mjs` L181-190 の `options` を `sdk.d.ts` の `Options` 型（L1282-）と突合。

| オプション | 値 | .d.ts 根拠 | 判定 |
|---|---|---|---|
| `settingSources` | `[]` | L1867「Pass `[]` to disable filesystem settings (SDK isolation mode)」 | 正 |
| `systemPrompt` | string | L1977 `string \| string[] \| {preset}` | 正 |
| `model` | `"claude-opus-4-8"` | L1673 `model?: string`（wave §3 指定モデルと一致） | 正 |
| `persistSession` | `false` | L1546 `persistSession?: boolean`（`@default true`） | 正 |
| `maxTurns` | `1` | L1638 `maxTurns?: number` | 正 |
| `tools` | `[]` | L1385「`[]` (empty array) - Disable all built-in tools」 | 正 |
| `includePartialMessages` | `true` | L1591 | 正 |
| `abortController` | `AbortController` | L1287 | 正 |

- `persistSession: false` の併用禁止制約は **`sessionStore` に対してのみ**（L1552）で、本実装は
  `sessionStore` 不使用ゆえ非該当。`tools: []` は .d.ts が明示的に「全ビルトインツール無効」と規定
  しており、domain-c.md §2 の実測（`init.tools=[]`）と `disallowedTools` 非併用の結論は正しい。

### 1-2. メッセージ形の突合（全一致）

- `query(_params: { prompt: string \| AsyncIterable<SDKUserMessage>; options? })`（L2527-2530）。
  `createInputStream()` は `[Symbol.asyncIterator]` を実装し AsyncIterable を満たす。**正**。
- push するユーザーメッセージ `{ type:"user", message:{ role:"user", content:text }, parent_tool_use_id:null }`
  は `SDKUserMessage`（L4439: `type:'user'` / `message: MessageParam` / `parent_tool_use_id`）に一致。**正**。
- `stream_event` 判定: `SDKPartialAssistantMessage`（L4027: `type:'stream_event'` / `event:BetaRawMessageStreamEvent`）。
  `isTextDeltaEvent` の `content_block_delta`→`text_delta` は Anthropic ストリーム仕様どおり。**正**。
- `assistant`: `SDKAssistantMessage`（L2786: `type:'assistant'` / `message:BetaMessage`）。
  `extractAssistantText` は `message.content` を string/array 両対応で連結。**正**。
- `result`: `SDKResultSuccess`（L4167: `ttft_ms?` / `result:string` / `usage:NonNullableUsage`）。
  `message.usage` / `message.ttft_ms` / `message.result` 参照はすべて型に存在。**正**。
- `system/init`: `SDKSystemMessage`（L4284: `subtype:'init'` / `tools:string[]` / `apiKeySource` /
  `model` / `slash_commands` / `skills`）。CLI/first-light の init 参照フィールドはすべて存在。**正**。

### 1-3. 手動 `next()` 汲み出しの根拠（.d.ts と整合）

`Query extends AsyncGenerator<SDKMessage, void>`（L2230）。`for await…break` は iterator の
`.return()` を呼び generator（＝1 query() が保持する常駐セッション）を終了させる。よって
`await q.next()` で 1 メッセージずつ汲み、`result` で `break`（generator は生かす）、次 ask は同じ
generator の続きを汲む設計は**正当**。dispose は `input.close()` → `q.return(undefined)`（AsyncGenerator
の正規終了）→ `abortController.abort()` の順で、streaming session を確実に畳む。**正**。

### 1-4. env-guard のガード設計（wave §3 を満たす）

- ガード 3 種を実装（`env-guard.mjs` L31-34, L75-84）: `ANTHROPIC_API_KEY` / `ANTHROPIC_AUTH_TOKEN`
  の完全一致 + `CLAUDE_CODE_USE_` プレフィクス一致。wave §3「APIキー混入ガード」を満たす。
- `ANTHROPIC_BASE_URL` は非既定値のみ warn（throw しない・L97-104）。設計判断（domain-c.md §5）は
  この環境がハーネスで既定 BASE_URL を設定している事実（既知環境事実）と整合し、妥当。
- 空文字の扱い: `isSet()`（L44-46）が `length > 0` 判定で空文字を未設定と同義に扱う。誤検知回避として
  妥当（空の API キーでは課金も認証も起きない）。env-guard.test で固定。**正**。

### 1-5. CLI が Domain A/B を再利用（再実装なし）

`cli.mjs` は `connectChannel`（channel-client）/ `createAudioPlayer`+`writeTempWav`（audio-player）/
`speak`（speak.mjs）/ `createLlmSession` を import して配線するのみ（L26-30, L194-200）。TTS・チャネル・
再生・同期のロジックはいずれも Domain A/B の既存モジュールを呼ぶ。**再実装なし・正**。

### 1-6. experiments 数字の相互整合（転記ミス検算 — 一致）

domain-c.md §8.3 生出力 と experiments/s1-first-light.md §3 表を全数照合、**差異ゼロ**:

| 項目 | domain-c §8.3 | experiments §3 |
|---|---|---|
| init 到達 | 1247.7 / 1882.9 | 1247.7 / 1882.9 |
| #1 | 252/20 ttft2992.5 ask4960.7 | 252/20 2992.5 4960.7 |
| #2 | 284/22 1267.6 3194.3 / aq55.7 syn1118.2 wav3.1954 20→15 | 同一 |
| #3 | 318/27 1227.6 3345.2 / aq27.0 syn1241.6 wav4.1589 26→21 | 同一 |
| #4 | 364/21 1897.2 9240.6 / aq17.9 syn974.5 wav3.2727 20→16 | 同一 |
| slash/skills | 44 / 17 | 44 / 17 |

---

## レーン 2: design — **PASS**

### 2-1. dispose 連鎖と SIGINT/EOF 経路の完全性

- `runConversation` の `finally`（cli.mjs L114-132）で rl.close() 後に session→player→channel を
  順に dispose、各々 try/catch で握って `dispose_error` を stderr に落とす。1 つの失敗が後続の dispose を
  止めない。**正**。
- abort 経路（L72-78）: `signal.addEventListener("abort", ()=>rl.close(), {once})`。abort で for-await
  ループが閉じ finally に落ちる。cli.test の abort ケースで「戻る＝ハングしない」を固定。**正**。
- EOF 経路: readline の for-await が自然終了 → finally。cli.test の空行/EOF ケースで発話 0 でも dispose
  完遂を固定。**正**。

### 2-2. ハードニング変更の挙動不変性（検証済み・不変）

- `audio-player.mjs` dispose（L133-156）: 既存の「stdin.end → kill」に **kill 後の pipe destroy + unref**
  を追加。play/dispose の意味（再生指示送出・畳み）は不変で、追加分は event loop クリーンアップのみ。
  `disposed` フラグの意味も不変。**挙動不変 = 正**。
- `ws-double.mjs`: `server.unref()`（listen 後 L194）+ `closeAllConnections?.()`（close 時 L234）。
  接続処理・返信ロジックは不変。送出ヘルパ（sendServerEvent/sendRawText/dropConnections・onSpeech "drop"）は
  **テスト支援の追加のみ**で本番コード（channel-client）に影響なし。**正**。
- `ws-client.mjs`: `socket.unref()`（L83）+ close 時 `removeAllListeners()`+`destroy()`（L174-179）。
  ハンドシェイク・フレームコデック・dispatch は不変。**正**。
- note 回収が検証する `consumeUnknownEventCount` / closedError reject は **channel-client.mjs に既存**
  （L60,69,83,96,139-141 / L99-103）。テストは既存の寛容規則を独立 assert で固めたもので、
  channel-client 本体不変の主張は成立。**正**。

### 2-3. README 改定と裁定 1 の整合

`apps/soul/README.md` L16-28: `apps/soul` **直下**の package.json 禁止を維持しつつ、サブディレクトリ
独立パッケージ（`apps/soul/agent/`）を裁定 1 として容認。workspace glob（`apps/*`）が 1 階層のみ＝
サブディレクトリは対象外＝lockfile 不変、install はユーザー作業、と正確に記述。**裁定 1 と整合 = 正**。

### 2-4. _map.md 登録の妥当性

`discussion/ai-cohost/_map.md` L23 に `experiments/` を Directory Map へ登録（Created 2026-07-12,
S1 Domain C・初回リンク・要点付き）。measurements 流儀の常設計器の初回として妥当。**正**。

### 2-5. first-light.mjs の 4 ask 上限（構造的に守る）

`first-light.mjs`: `session.ask(TOOLS_CHECK_PROMPT)` 固定 1 回（L68）+ `SAMPLE_PROMPTS`（固定 3 要素）
への for ループ（L97-99）。ask はループで増えず、プロンプト配列長で構造的に 4 に固定。動的増殖なし。
**4 ask 上限を構造的に遵守 = 正**（※本レビューでは未実行）。

---

## レーン 3: test — **PASS**

### 3-1. 自環境での実行（生出力）

```
cd apps/soul/agent && node --test        （timeout 120s）
# tests 84
# suites 0
# pass 84
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 491.582
EXIT=0
```

- **84/84 pass・exit 0**（期待 84 と一致）。緑出力後、Bash は数百 ms で戻り**ハング未再現**
  （既知環境事実どおり。blocking 判定はしない=記録のみ）。
- 実 SDK テストはスイートに含まれず（llm-session.test は fake queryImpl のみ・実 SDK 起動なし）を確認。
  first-light.mjs は node --test の対象外（scripts 配下・test() 未使用）。**サブスク消費ゼロを担保**。

### 3-2. 新規テストの網羅

- **env-guard.test（9）**: 未設定 pass / API_KEY / AUTH_TOKEN / CLAUDE_CODE_USE_*（2 変数）/ 複数列挙 /
  空文字 / BASE_URL 既定（末尾スラッシュ差含む）/ BASE_URL 非既定 warn / 非オブジェクト TypeError。
  3 種 + プレフィクス + 空文字 + BASE_URL 両分岐をカバー。**十分**。
- **llm-session.test（8）**: ask 応答/usage/ttft/elapsed / 複数 ask residency / options 一致
  （settingSources:[] / tools:[] / persistSession:false / maxTurns:1 / includePartialMessages /
  model / systemPrompt / abortController）/ onInit 観測 / env ガード throw / onWarning / result 前終了 throw /
  dispose 後 ask throw + 二重 dispose 無害。fake queryImpl で実 SDK 不使用。**十分**。
- **cli.test（3）**: 2 行 ask→speak→intent.speech 2 本送出+計測 JSON+全 dispose（ws-double + 実 speak +
  echo-player 実往復）/ 空行スキップ+EOF 正常終了 / signal abort 経路。配線・abort・EOF をカバー。**十分**。

### 3-3. note 回収 2 ケースの質

- **note 1**（channel-client.test L116-142）: 未知 kind / 非 JSON / 相関先なし replyTo の 3 種を黙殺し
  `consumeUnknownEventCount()===3`、consume のリセット（2 回目 0）、黙殺後も正規送出が accepted で
  返ることまで固定。**質高い**。
- **note 2**（L144-162）: onSpeech "drop"（返信せず socket.destroy）で sendSpeech が
  `closed unexpectedly` で reject。pending reject 経路を固定。**質高い**。

### 3-4. カバー漏れ

新規テストの範囲で重大なカバー漏れなし（下記 non-blocking のみ）。

---

## 指摘一覧

すべて **non-blocking**（S1 の受理を妨げない・将来メモ）。

1. **[non-blocking] result エラー subtype 未分岐**（llm-session.mjs L254-264）: `message.type==="result"`
   で subtype を問わず break する。`SDKResultError`（error_max_turns 等・L4145）には `result` フィールドが
   無く、assistant テキストも空なら replyText が空文字で返り、CLI は `empty_reply` を出す。S1 では実害
   なし（空応答として扱われる）。将来、エラー result を明示ログ化すると診断性が上がる。

2. **[non-blocking] 本番経路の env-guard 二重呼び + BASE_URL warn 二重出力**（cli.mjs L163 と
   llm-session.mjs L168）: main() が直接呼び、createLlmSession も呼ぶため、BASE_URL 非既定時に
   `[cli] WARN` が 2 行出る。二重の防波堤という意図（domain-c.md）どおりで throw は fail-fast だが、
   warn は表示重複。cosmetic。

3. **[non-blocking] preflight-tts.mjs 未実行**: 本レビューでは AivisSpeech 実機依存を要するため
   preflight-tts.mjs を実行しなかった（レビュー結論に load-bearing でないため）。TTS→WAV→timeline の
   実機合成確認は人間ゲート（human-gate-procedure.md §3-a）の領分に委ねる。

## 実行した検証の生出力（サマリ）

- `node --test`（timeout 120s）: **84 pass / 0 fail / exit 0 / 491.582ms**。緑後ハング未再現。
- 保護パス独立確認（git）:
  - `git diff --stat pnpm-lock.yaml apps/runtime-player/` → **空（不変）**
  - `git diff --stat apps/runtime-player/src/main/control-channel/contract/` → **空（C4 契約 fixture 不変）**
  - `git status --porcelain apps/soul/agent/package.json pnpm-lock.yaml` → `?? apps/soul/agent/package.json`
    のみ（サブパッケージ内・pnpm-lock は未変更）。
- SDK 版数: `@anthropic-ai/claude-agent-sdk` **0.3.207**（package.json 実物確認）。
- **実 SDK（first-light.mjs / preflight-e2e.mjs）は未実行**（サブスク枠・実再生を消費しない規律）。

## Orch-Sylph への質問

なし。domain-c.md §10 に Undine 裁定 4 件（人間ゲート実施主体・maxTurns×residency 確定・ハング未再現
受理・レイテンシ外れ値の扱い）が記録済みで、機械ゲートの受理条件は満たされている。人間ゲート
（実器フル疎通 + 実再生）は choke point として Undine→ユーザー依頼に残る（本レビューの範囲外）。

## non-blocking の扱い（Orch-Sylph 記録 2026-07-12）

- **指摘 1（result エラー subtype 未分岐）・指摘 2（env-guard warn 二重出力）**: [../../waves/s1/s1-followup.md](../../waves/s1/s1-followup.md) §9・§10 に持ち越しとして記録。
- **指摘 3（レビューでの preflight-tts 未実行）**: 対応不要。preflight-tts は Gnome（Domain B/C）と Orch-Sylph 自身の再実行で実機 PASS を裏取り済みであり、実機依存確認は人間ゲート手順 §3-a にも含まれる。

> **Domain C 閉鎖（Orch-Sylph 2026-07-12）**: 実装（Gnome）・レビュー 3 レーン PASS（blocking ゼロ）・.d.ts 全項目一致・experiments 数字整合をすべて裏取り済み。Orch 自身の再実行: node --test 84/84（ハング再現なし）/ soul-zone 緑 1274 / deps 緑 / source 新規赤ゼロ / runtime-player 925/925 / packages 1492/1492 / 保護パス diff 空。S1 wave の機械ゲートはこれで全て閉じた。残るは人間ゲート（Undine→ユーザー依頼）。
