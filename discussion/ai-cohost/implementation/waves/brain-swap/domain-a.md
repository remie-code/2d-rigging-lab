# 多頭化(頭脳差し替え) Domain A 実装記録 — 知性契約 + Codex 頭

> 担当: Gnome（サブエージェント委任 / 呼び出し元 Orch-Sylph）。
> 計画: [../../orchestration/brain-swap-wave-plan.md](../../orchestration/brain-swap-wave-plan.md) §3 Domain A。
> 棚卸し: [../../orchestration/brain-swap-inventory.md](../../orchestration/brain-swap-inventory.md)。
> 正本: [../../../soul/brain-swap.md](../../../soul/brain-swap.md)。実測: [../../../experiments/brain-swap-terra.md](../../../experiments/brain-swap-terra.md)。

## 1. 変更/新規ファイル一覧（絶対パス）

**新規**:
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\src\mind\brains.mjs`
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\src\mind\brains.test.mjs`
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\src\mind\codex-session.mjs`
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\src\mind\codex-session.test.mjs`

**変更**:
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\src\mind\env-guard.mjs`
  （OpenAI 版 sibling `assertSubscriptionAuthEnvOpenAI` を追加。既存 `assertSubscriptionAuthEnv`/`DEFAULT_ANTHROPIC_BASE_URL` は 1 バイトも変更していない — 追記は既存関数の後ろに新規エクスポートを足しただけ）
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\src\mind\env-guard.test.mjs`
  （sibling 用テスト 7 本を追加。既存 9 本は無変更）
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\.gitignore`
  （`codex-rollouts.local.json` を 1 行追記。`cockpit-settings.local.json` の節の隣）

**無変更（確認済み）**:
- `apps/soul/agent/src/mind/llm-session.mjs` — `git diff --stat` 無出力。
- `apps/soul/agent/package.json` / `package-lock.json` — `git diff --stat` 無出力（§5 に生出力）。

## 2. node --test 実行結果（自己実行・生の末尾）

**着手前ベースライン（自分で実行・確認済み）**:
```
1..764
# tests 764
# suites 0
# pass 764
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1438.9751
```

**実装後（全体再実行・自分で実行）**:
```
1..797
# tests 797
# suites 0
# pass 797
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1484.4918
```

764 → 797（+33: env-guard sibling 7 + brains health test 6 + codex-session test 20）。全緑。fail/cancelled/skipped/todo は全て 0。

## 3. 各成果物の設計判断

### 3-1. `brains.mjs`
expression-table.mjs と同じ意匠で `Object.freeze` のフラット registry（`claude`/`codex` の 2 項目）。各エントリは `{id, label, create, credentialPath}`。`create` は `createLlmSession` / `createCodexSession` を束ねるだけの薄いラッパで、health test は **実 create を呼ばない**（`brains.test.mjs` は関数値・非空文字列・パス末尾の形だけを検証）。`credentialPath` は `path.join(os.homedir(), ...)` の文字列を持つだけで中身は読まない。

### 3-2. `codex-session.mjs`

- **ask=run か runStreamed か**: `runStreamed` を採用。`run()` が `turn.failed` を reject するかは型定義上不明（inventory §2-4「run() 自体の reject 例外型は型定義に明示なし」）。runStreamed でイベントを直接検査し `turn.failed`/`error` を検出して明示的に throw する設計にした。「空応答を黙って返さない」の要求を確実に満たすため。elapsedMs は runStreamed 呼び出し前後の `performance.now()` 実測。
- **env 継承の理由**: `new Codex({config:{forced_login_method:"chatgpt"}})` のみを渡し、`env`/`apiKey`/`baseUrl` は渡さない。codex-sdk の型定義コメント（`CodexOptions.env`）「When provided, the SDK will not inherit variables from `process.env`」により、**未指定なら SDK は process.env をそのまま継承する**。CLI spawn に必要な最小環境（PATH 等）を壊さない安全側。spike-codex-terra.mjs の `makeCodex()` と同一意匠。
- **systemPrompt の既定値**: `llm-session.mjs` から `DEFAULT_SYSTEM_PROMPT` を import して既定値にした（llm-session.mjs 自体は無変更・import のみ）。二頭のメンタルモデルを対称に保つ狙い（brain-swap.md §9「二頭のメンタルモデルが完全対称」）。
- **turn1 systemPrompt 前置**: string 入力は `${systemPrompt}\n\n${content}`、content ブロック配列は systemPrompt を先頭 `{type:"text"}` ブロックとして前置。turn2 以降はどちらも素の入力のみ。spike-codex-terra.mjs の実証パターンをそのまま踏襲。
- **effort 既定 "none"**: `DEFAULT_EFFORT = "none"`。SDK の `ModelReasoningEffort` 型に `"none"` は無いため `/** @type {any} */` でキャストして渡す（CLI は素通しする実証済み挙動・terra §1）。
- **画像橋渡し**: base64 → `workingDirectory`（スクラッチ dir）配下に `image-<uuid>.<ext>` で書出 → `{type:"local_image", path}` → run → **run の成否に関わらず finally で unlink**。turn.failed でも一時ファイルは消える（テスト「turn.failed でも画像の一時ファイルは finally で削除される」で確認）。
- **モジュールヘッダの昇格予約の実文言**（`codex-session.mjs` 冒頭 JSDoc より抜粋）:
  > 「この base64→一時ファイル→local_image→即削除の橋渡しは Codex アダプタ内部の私事である。第二の『ローカルファイルしか読めない頭』が現れた時点で、この橋渡しは共有ヘルパへ昇格できる（discussion/ai-cohost/soul/brain-swap.md §5 参照・昇格予約はドキュメント 3 箇所義務の 1 つ）。」
- **workingDirectory の二重防御**: `mkdtempSync(path.join(os.tmpdir(), "codex-session-"))` でリポジトリ外のスクラッチ dir を作り `sandboxMode:"read-only"` と併用。dispose で `rmSync(recursive,force)`。テストで実在確認 + dispose 後の消滅確認済み。
- **threadIds**: 配列で公開。`ask()` 内で `thread.id` を毎回チェックし、未記録なら push + 台帳追記。**turn.failed 時も**（rollout ファイルが部分的に作られている可能性があるため）記録は try/finally で成否に関わらず行う。

### 3-3. env-guard sibling（`assertSubscriptionAuthEnvOpenAI`）
Anthropic 版と対称の意匠。ガード対象は完全一致の `OPENAI_API_KEY`/`CODEX_API_KEY`（Anthropic 版の `CLAUDE_CODE_USE_*` プレフィックス相当は Codex SDK に存在しないため無し）。`OPENAI_BASE_URL` は Anthropic 版の「既定値と比較」ロジックとは違い、**非空なら常に warn**（Codex SDK の baseUrl 既定値が型定義/README に明記されていないため、既定値比較を偽装しない単純化）。throw せず warnings に積む点は対称。

### 3-4. rollout 掃除の完全一致ロジックの要点
- ファイル名固定構造 `rollout-<日付T時刻(コロン→ハイフン)>-<thread_id>.jsonl` を正規表現
  `^rollout-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-(.+)\.jsonl$` でパースし、キャプチャ group(1) を
  thread_id として抽出。台帳の id と `===`（文字列完全一致）で比較。**部分文字列一致・`includes`・
  `startsWith`・glob は一切使っていない**。
- `deleteRolloutForThreadId(homeDir, threadId)` は `<homeDir>/.codex/sessions` を再帰 walk し、
  抽出した id が threadId と完全一致した 1 ファイルだけを unlink。ディレクトリが無い/読めない場合は
  catch して false を返すだけ（起動を止めない）。
- 起動時 sweep（`sweepLedger`）: セッション生成時に台帳の全 id を対象に削除を試み、結果に関わらず
  台帳を空にする（クラッシュ復旧・「見つからなければ正直に諦める」の要求）。
- dispose: 自セッションが記録した `threadIds`（通常 1 件）だけを対象に削除+台帳から除去。他セッションが
  積んだ id は触らない。
- ファイルの中身（rollout の JSONL）は一切 open/read していない（`unlinkSync` のみ）。

## 4. 掃除の安全性の自己証明

**性質テスト名（`codex-session.test.mjs`）**:
1. `起動時 sweep は台帳の thread_id と完全一致するファイルだけを消し、台帳に無い他人の rollout は全て無傷`
   — 他人の rollout 12 本（日付をばらけさせて配置）+ 自分の rollout 2 本（台帳記載）→ sweep 後、自分の 2 本だけ消え、他人の 12 本は `existsSync===true` で無傷を確認。台帳は空になる。
2. `dispose は自セッションが作った thread_id の rollout だけを消し、他人の rollout は無傷`
   — 他人の rollout 10 本 + `ask()` で確定した自分の thread_id 1 本 → dispose 後、自分の 1 本だけ消え、他人の 10 本は無傷。
3. `台帳の thread_id に対応する rollout が見つからなくても sweep はエラーにならず台帳から外すだけ`
   — 存在しない id を台帳に仕込んでも `createCodexSession` は throw せず、台帳が空になり、無関係な他人の rollout 2 本は無傷。
4. `~/.codex/sessions 自体が存在しない環境でも起動時 sweep はエラーにならない`
   — sessions ディレクトリを作らずに sweep しても throw しない。
5. `ファイル名の部分一致では消さない（末尾一致のみを id とみなす構造パース）`
   — 台帳 id `"abc"` に対し、ファイル名に `"abc"` を部分文字列として含む decoy（`rollout-...-xxx-abc-yyy.jsonl`）は無傷のまま残り、完全一致するファイル（`rollout-...-abc.jsonl`）だけが消えることを確認。

**部分一致/bulk 削除経路が存在しないことの言明**: `codex-session.mjs` 内で `readdirSync`/`unlinkSync` を呼ぶ箇所は `deleteRolloutForThreadId` 1 関数のみ。削除対象の決定は `extractThreadIdFromRolloutFilename`（正規表現の固定構造パース）の戻り値と呼び出し元が渡す単一の `threadId` 文字列との `===` 比較のみで行われ、`glob`/`minimatch`/ワイルドカード/`includes`/`startsWith`/`endsWith` によるパターンマッチは一切使用していない。ループは「1 threadId につき最大 1 ファイル削除」の単位でのみ回り、複数ファイルを一括で消す経路（例えば「台帳に無い id を全部消す」「日付ディレクトリごと rmSync する」等）は実装していない。

**実行時の実測確認**: 本テストスイート実行後に `node scripts/spike-codex-terra.mjs sessions` を実行し、本物の `~/.codex/sessions` のファイル数が `4494`（brain-swap-terra.md §3-4 記載の「image 後（最終）4494」と完全一致）のままであることを確認した。テスト実行が本物の `~/.codex` に一切触れていないことの直接証拠。

```
{
  "phase": "sessions",
  "dir": "C:\\Users\\remie\\.codex\\sessions",
  "sessions_file_count": 4494
}
```

## 5. git diff --stat（依存不変の確認）

```
$ git diff --stat apps/soul/agent/package.json apps/soul/agent/package-lock.json
(無出力)
```

（`apps/soul/agent` に `package-lock.json` は存在しない独立 npm パッケージ。`package.json` は無変更。）

## 6. 迷った点・Orch への質問

1. **`ledgerPath` の既定パス**: `apps/soul/agent/codex-rollouts.local.json`（`fileURLToPath(import.meta.url)` から 2 階層上）に置いた。`cockpit-settings.local.json` と同格の魂 zone ローカルファイルという設計指示に沿ったつもりだが、Domain B が cockpit.mjs 起動フックから同じパスを参照する必要がある場合、パス導出をどこか 1 箇所の定数（例えば brains.mjs 側）に集約すべきか、codex-session.mjs のデフォルトのままで Domain B が `path.join` で独自に組み立てるべきかは未確定。現状は `createCodexSession()` の `ledgerPath` オプション省略時のみこの既定値が使われる形にしてあるので、Domain B 側が明示的に渡したい場合は `options.ledgerPath` で上書き可能。
2. **`OPENAI_BASE_URL` warn のロジック**: Anthropic 版は「既定値と等しければ無害」の比較ロジックを持つが、Codex SDK の baseUrl 既定値が型定義/README に明記されていなかったため、OpenAI 版は「非空なら常に warn」に単純化した。もし Codex SDK の既定 baseUrl が別途判明していれば、Anthropic 版と同じ比較ロジックに寄せる余地がある（現状は保守的側に倒した）。
3. **`effort` の型キャスト**: `modelReasoningEffort: /** @type {any} */ (effort)` としており、TypeScript 的には緩い。設計指示どおり「ts はキャストで黙らせる」を踏襲したが、より厳密にしたい場合は `ModelReasoningEffort | "none"` のユニオン型を明示的に export しても良いかもしれない（現状 JSDoc typedef はコメントで注記済み）。
4. **`buildInput` の未知ブロック型**: fire-orchestrator が渡すのは `text`/`image` のみと確認済み（`fire-orchestrator.mjs:632-635`）なので、それ以外のブロック型は黙って無視する実装にした。将来 fire-orchestrator が新しいブロック型を渡すようになった場合、Codex 頭では黙って欠落する（throw しない）。Claude 頭は SDK にそのまま渡すため挙動が同じにはならない可能性がある——ここは Domain B/C の設計次第で throw に倒すべきか検討の余地あり。

以上、Domain A の実装は完了しています。Domain B（選択の配線）着手の判断は Orch にお任せします。
