# 多頭化(頭脳差し替え) Domain A レビュー — レーン: spec（契約適合・スコープ・無退行）

> レビュア: Review-Sylph（サブエージェント委任 / 呼び出し元 Orch-Sylph）。
> 対象: 実装報告 [../../waves/brain-swap/domain-a.md](../../waves/brain-swap/domain-a.md)。
> 基準: [../../orchestration/brain-swap-wave-plan.md](../../orchestration/brain-swap-wave-plan.md) §3 Domain A + §4 blocking 基準。
> 方式: Gnome の報告を鵜呑みにせず、実ファイル Read + grep + git 実行で全項目を独立裏取りした。

## 総合判定: **PASS**

blocking 基準（wave-plan §4）に反する事実は見つからなかった。全 8 検証項目が○。non-blocking の気づきが 2 件（下記）。

---

## 検証項目（結果）

### 1. 知性契約の凍結 — ○
`brains.mjs:15-33` の typedef が現外形 `{ask(content)=>Promise<{replyText, usage, ttftMs:number|null, elapsedMs}>, dispose()=>Promise<void>}` を正しく明文化している。`codex-session.mjs` の戻り値（`ask()` 内 `codex-session.mjs:424-429`）:
```js
return {
  replyText: turn.finalResponse,
  usage: turn.usage,
  ttftMs: null, // 常に null（コメントで理由明記）
  elapsedMs      // performance.now() 差分の number
};
```
`ttftMs` は無条件で `null`、`elapsedMs` は `askStart`/`performance.now()` 差分（number 保証）、`usage` は `turn.usage`（SDK usage オブジェクト）をそのまま透過。厳密準拠を確認。

### 2. registry の形 — ○
`brains.mjs:46-59`。`claude`/`codex` の 2 項目のみ（`brains.test.mjs:12-13` で `Object.keys(BRAINS).sort()===["claude","codex"]` も担保）。各エントリ `{id,label,create,credentialPath}`。`key===id`（`claude.id="claude"`/`codex.id="codex"`）。`create` は `(options)=>createLlmSession(options)` / `(options)=>createCodexSession(options)` の薄いラッパ。label 文言 "Claude (Opus 4.8)" / "Codex (GPT-5.6 Terra)" とも指定どおり一致。`Object.freeze` を registry 本体と各エントリの両方に適用（`brains.test.mjs:16-21` で凍結確認）。

### 3. codex-session 署名 — ○
`codex-session.mjs:340-351`（`createCodexSession(options={})` の分配）: `systemPrompt`（既定 `DEFAULT_SYSTEM_PROMPT` を llm-session.mjs から import）・`model`（既定 `DEFAULT_MODEL="gpt-5.6-terra"`）・`effort`（既定 `DEFAULT_EFFORT="none"`）・`sdkImpl`・`homeDir`（既定 `os.homedir()`）・`env`/`skipEnvGuard`/`onWarning`/`ledgerPath` も揃う。既定値は terra §1（`minimal` 非対応・400 実測）・§4（`none` が最速）と整合。

### 4. blocking 基準 #2 Claude 頭の無退行 — ○（自分で実行し裏取り済み）
```
$ git diff --stat apps/soul/agent/src/mind/llm-session.mjs
（無出力）
```
1 バイトも変更されていない。`env-guard.mjs` の diff も自分で全文確認（後述の生出力）——既存の `assertSubscriptionAuthEnv` 関数本体・`DEFAULT_ANTHROPIC_BASE_URL`・`isSet`/`normalizeBaseUrl` は diff の context 行としてのみ現れ、変更箇所（`+` 行）はヘッダコメント追記とファイル末尾への新規 `export function assertSubscriptionAuthEnvOpenAI` 追加のみ。`env-guard.test.mjs` も diff 確認済み——既存 9 本は無変更（`import` 文に `assertSubscriptionAuthEnvOpenAI` が 1 行追加されたのみ）、新規 7 本が末尾に追加。

### 5. blocking 基準 #4 資格情報の不可侵 — ○
```
grep readFile|readFileSync|open\(|createReadStream  apps/soul/agent/src/mind/brains.mjs   → No matches
grep readFile|readFileSync|open\(|createReadStream  apps/soul/agent/src/mind/codex-session.mjs → 2 hits（import 文 + readLedger 内の 1 箇所）
```
`codex-session.mjs:160` の `readFileSync(ledgerPath, "utf8")` は sidecar 台帳（`codex-rollouts.local.json`・gitignored・thread_id の配列のみ）を読んでいるだけで、`credentialPath`（`.credentials.json`/`auth.json`）は `codex-session.mjs` 内に一切登場しない。`brains.mjs` の `credentialPath` は `path.join(os.homedir(), ...)` の文字列生成のみで read 系呼び出しゼロ。中身の不可侵を確認。

### 6. blocking 基準 #5 昇格予約ドキュメント — ○
`codex-session.mjs:32-34`（モジュールヘッダ JSDoc 内）:
> 「この base64→一時ファイル→local_image→即削除の橋渡しは Codex アダプタ内部の私事である。第二の『ローカルファイルしか読めない頭』が現れた時点で、この橋渡しは共有ヘルパへ昇格できる（discussion/ai-cohost/soul/brain-swap.md §5 参照・昇格予約はドキュメント 3 箇所義務の 1 つ）。」

要求文言「一時ファイル橋渡しは provider 追加時に共有ヘルパへ昇格可能（brain-swap.md §5 参照）」と意味的に完全一致（より詳細）。位置もファイル冒頭のモジュールヘッダ内。3 箇所義務のうち実装側 1 箇所を充足。

### 7. blocking 基準 #6 additive/依存不変 — ○（自分で実行し裏取り済み）
```
$ git diff --stat apps/soul/agent/package.json
（無出力）
$ git diff --stat apps/soul/agent/package-lock.json
（無出力・exit 0）
```
`git status` 全体を確認——soul zone 外の変更・untracked は brain-swap wave と無関係な既存作業（`apps/authoring-host/...`・mesh-generation 系・`.tmp/` 配下・discussion/design 系。いずれもセッション開始時点の git status スナップショットに既出）のみで、`apps/runtime-player`・`channel-*-contract`・`packages/` への変更は無し。Domain A 関連の変更ファイルは `apps/soul/agent/.gitignore`・`src/mind/env-guard.mjs`・`src/mind/env-guard.test.mjs`（M）と `src/mind/brains.mjs`・`brains.test.mjs`・`codex-session.mjs`・`codex-session.test.mjs`・`discussion/ai-cohost/implementation/waves/brain-swap/`（??）のみで、報告と一致。

### 8. env-guard sibling の契約 — ○
`assertSubscriptionAuthEnvOpenAI`（`env-guard.mjs:129-164`）: `OPENAI_API_KEY`/`CODEX_API_KEY` を throw（`env-guard.test.mjs` の新規 7 本で個別・両方同時列挙・空文字非設定扱いを確認）。空文字は既存 `isSet()`（Anthropic 版と共有）により未設定扱い。非オブジェクトは `TypeError`（`env==null || typeof env!=="object"` ガード、Anthropic 版と同型）。throw/warn/TypeError の契約構造は Anthropic 版と対称。

---

## 独立実行した生出力

### node --test（apps/soul/agent、自分で実行）
```
1..797
# tests 797
# suites 0
# pass 797
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1487.4169
```
Gnome 報告の 797/797（fail/cancelled/skipped/todo 全 0）と一致。

### git diff --stat（自分で実行）
```
$ git diff --stat apps/soul/agent/src/mind/llm-session.mjs
（無出力）

$ git diff --stat apps/soul/agent/package.json
（無出力）

$ git diff --stat apps/soul/agent/package-lock.json
（無出力）

$ git diff --stat -- apps/soul/agent/.gitignore
 apps/soul/agent/.gitignore | 5 +++++
 1 file changed, 5 insertions(+)
```

---

## non-blocking の気づき

1. **報告書 §5 の事実誤認（軽微）**: `domain-a.md` §5 は「`apps/soul/agent` に `package-lock.json` は存在しない独立 npm パッケージ」と記載しているが、実際には `apps/soul/agent/package-lock.json` は存在し `git ls-files` にも載る git 管理下ファイルである（`ls -la` で 62278 bytes を確認）。ただし `git diff --stat` は無出力（変更なし）なので依存不変という結論自体には影響しない。報告書の記述だけが不正確。次回更新時に一言訂正を勧める。
2. **OPENAI_BASE_URL warn ロジックの非対称性**: Anthropic 版 `assertSubscriptionAuthEnv` は「既定値と異なる場合のみ warn」だが、OpenAI 版は「非空なら常に warn」（Codex SDK の既定 baseUrl が型定義/README に明記されていないための単純化・保守側）。Gnome 自身が実装報告 §6 質問 2 で明記済みで、契約の throw/warn 構造自体は対称なので blocking 判定には影響しない。Domain 間で気にする話ではなく設計裁定として Orch 側で追認するかどうかの話。

## 質問（Orch 宛て）

特に無し。Gnome の実装報告 §6 の質問（`ledgerPath` 既定パスの Domain B 側集約要否、`OPENAI_BASE_URL` warn ロジック、`effort` 型キャスト、`buildInput` 未知ブロック型の扱い）はいずれも Domain B/C の設計判断であり spec レーンの blocking 判定には影響しないため、Orch から Domain B 着手時に検討する形で問題ない。
