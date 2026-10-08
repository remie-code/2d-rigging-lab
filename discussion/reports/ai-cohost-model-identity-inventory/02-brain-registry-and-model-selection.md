# AI Cohost model identity inventory: brain registry and model selection

調査日: 2026-08-08　担当: brain/model/provider registry と選択・切替の現行経路

本稿は [`inventory-contract.md`](inventory-contract.md) の棚卸し契約に従う一次調査である。実装変更や新しい設計裁定は行わない。表記は次のように分ける。

- **[決定]** 議論正本で accepted と記録された内容。
- **[現行]** リポジトリの現在のコード/テストから確認できる事実。
- **[履歴]** wave・Git が記録する過去の実装/実測。
- **[推論]** 上記から導くが、コードの固定値そのものではないこと。
- **[未決]** ユーザー裁定が必要な問い。ここでは決めない。

## 1. Scope and entry points

対象は `apps/soul/agent` の頭脳登録、provider/model の解決、操縦席の選択、永続化、実行時切替、状態表示、観測タグ、既存 extension point である。Runtime Player は魂を import せず、LLM/provider は `apps/soul` 特区に閉じる境界を確認対象とした（[`mvp-boundary-amendment.md`](../../ai-cohost/concept/mvp-boundary-amendment.md)、[`apps/soul/README.md`](../../../apps/soul/README.md)）。

主な入口:

- Registry/契約: [`brains.mjs`](../../../apps/soul/agent/src/mind/brains.mjs)、[`llm-session.mjs`](../../../apps/soul/agent/src/mind/llm-session.mjs)、[`codex-session.mjs`](../../../apps/soul/agent/src/mind/codex-session.mjs)
- 起動・切替: [`scripts/cockpit.mjs`](../../../apps/soul/agent/scripts/cockpit.mjs)、[`cockpit-settings-store.mjs`](../../../apps/soul/agent/src/cockpit/cockpit-settings-store.mjs)
- HTTP/SSE/UI: [`cockpit-server.mjs`](../../../apps/soul/agent/src/cockpit/cockpit-server.mjs)、[`health.mjs`](../../../apps/soul/agent/src/cockpit/view-logic/health.mjs)、[`settings-drawer.mjs`](../../../apps/soul/agent/src/cockpit/ui/settings-drawer.mjs)
- 契約・正本: [`brain-swap.md`](../../ai-cohost/soul/brain-swap.md)、[`brain-swap-inventory.md`](../../ai-cohost/implementation/orchestration/brain-swap-inventory.md)、brain-swap wave 記録（[`domain-a.md`](../../ai-cohost/implementation/waves/brain-swap/domain-a.md)、[`domain-b.md`](../../ai-cohost/implementation/waves/brain-swap/domain-b.md)、[`domain-c.md`](../../ai-cohost/implementation/waves/brain-swap/domain-c.md)、[`brain-swap-followup.md`](../../ai-cohost/implementation/waves/brain-swap/brain-swap-followup.md)）

## 2. Executive findings

1. **[現行]** `BRAINS` は `id/label/create/credentialPath` の flat `Object.freeze` registry。現在の選択値は `claude`、`codex`、`codex-55`、`codex-56-sol` の4つで、`BRAIN_IDS` が registry のキーから生成される。
2. **[現行]** provider は独立フィールドではなく `create` 実装に埋め込まれる。`claude` は Anthropic Agent SDK (`createLlmSession`)、3つの `codex*` は OpenAI Codex SDK (`createCodexSession`) である。`provider` や実 model ID を含む active-brain snapshot は存在しない。
3. **[現行]** model ID は Claude の既定 `claude-opus-4-8`、Terra の既定 `gpt-5.6-terra`、追加2頭の wrapper 固定 `gpt-5.5`/`gpt-5.6-sol`。Terra/追加2頭の reasoning effort は `none`。
4. **[現行]** 選択は `cockpit-settings.local.json` の `brainChoice` → `createBrainHooks` → `currentBrain` → registry factory という流れ。未知/欠損値は Claude にフォールバックする。
5. **[現行]** `POST /api/brain` は4 IDを server が直書き検証し、成功時に永続化・現 session の `dispose()`・`session=null` を行い、次の Fire で新しい頭を遅延生成する。切替は配信前選択が本線で、in-flight 応答の transactional attribution はない。
6. **[現行]** UI は `health.mjs` の `BRAIN_LABELS` を選択肢源にするが、registry と server の許可値は別々に複製される。新しい頭を足すときの compatibility burden は明確な残債である。
7. **[現行]** credential health は `.credentials.json`/`auth.json` の存在だけ。モデル/provider ID は session-init の stderr（Claude の `onInit`）または表示ラベル/brain tag に分散し、永続的な model snapshot はない。
8. **[履歴]** 2026-07-17 の wave は 827→835 tests を全緑として記録し、実 SDK 消費ゼロ。現在の sandbox で `npm.cmd test` を再実行すると Node test worker の `spawn EPERM` により 53/53 files が実行前失敗したため、これは再現不能ではなく環境制約として扱う。

## 3. Current data/control flow

### 3.1 Registry と provider/model 解決

| selection id | UI label | provider adapter | 実 model ID / effort | credential health path |
|---|---|---|---|---|
| `claude` | `Claude (Opus 4.8)` | `createLlmSession` (Anthropic Agent SDK) | `claude-opus-4-8` / Claude session 既定 | `~/.claude/.credentials.json` |
| `codex` | `Codex (GPT-5.6 Terra)` | `createCodexSession` (OpenAI Codex SDK) | `gpt-5.6-terra` / `none` | `~/.codex/auth.json` |
| `codex-55` | `Codex (GPT-5.5)` | 同上 | wrapper が `gpt-5.5` / `none` を強制 | 同上 |
| `codex-56-sol` | `Codex (GPT-5.6 Sol)` | 同上 | wrapper が `gpt-5.6-sol` / `none` を強制 | 同上 |

**[現行]** 上表の一次宣言は [`brains.mjs`](../../../apps/soul/agent/src/mind/brains.mjs:27) の `BrainEntry` と [`BRAINS`](../../../apps/soul/agent/src/mind/brains.mjs:47) である。`BRAIN_IDS` は `Object.keys(BRAINS)` から作られる（同ファイル:90）。Claude の既定 model は [`llm-session.mjs`](../../../apps/soul/agent/src/mind/llm-session.mjs:48)、Codex の既定 model/effort は [`codex-session.mjs`](../../../apps/soul/agent/src/mind/codex-session.mjs:71) にある。追加2頭は registry wrapper が options を上書きするため Codex adapter 本体を変更せずに増設されている（[`brains.mjs`](../../../apps/soul/agent/src/mind/brains.mjs:70)）。

**[現行]** provider は `BrainEntry` の `provider` 欄ではなく `create` の行き先で判別する。Codex adapter は `forced_login_method: "chatgpt"`、read-only sandbox、approval never、web search disabled を startThread に渡す（[`codex-session.mjs`](../../../apps/soul/agent/src/mind/codex-session.mjs:368)）。Anthropic/OpenAI の API-key 環境変数拒否は provider 別 sibling guard に分かれる。

### 3.2 起動時の選択と永続化

1. [`cockpit-settings-store.mjs`](../../../apps/soul/agent/src/cockpit/cockpit-settings-store.mjs:181) が file-backed JSON の `brainChoice` を文字列として読む/書く。読み書き失敗や壊れたファイルは空設定として継続する。
2. [`createBrainHooks`](../../../apps/soul/agent/scripts/cockpit.mjs:518) の `resolveInitialBrain()` は値が `BRAIN_IDS` に含まれる場合だけ採用し、それ以外/欠損は `defaultChoice="claude"` にする。`onSetBrain` は選択値を次回起動用に保存する。
3. `main()` は `currentBrain = brainHooks.resolveInitialBrain()` を持つ。初回 Fire まで session は lazy で、現在値に対応する registry entry を `BRAINS[currentBrain] ?? BRAINS.claude` で解決する。

**[現行]** settings store の JSDoc は旧2値（claude/codex）と記述が残るが、値の妥当性検証は呼び出し側に委ねる設計であり、実装は4値を保存できる。これは stale documentation であって保存形式の制約ではない。

### 3.3 UI → HTTP → brain swap

1. UI の `BRAIN_OPTIONS` は `health.mjs` の `BRAIN_LABELS` のキーから組み立てられ、select の Set が `{brain}` を `POST /api/brain` に送る（[`settings-drawer.mjs`](../../../apps/soul/agent/src/cockpit/ui/settings-drawer.mjs:73)、同:350）。
2. server は `claude/codex/codex-55/codex-56-sol` の4値を直書きで受理し、未注入なら503、未知値なら400（[`cockpit-server.mjs`](../../../apps/soul/agent/src/cockpit/cockpit-server.mjs:1051)）。server は registry を import せず「brain の中身を知らない」境界を維持する。
3. `onSetBrain` は (a) settings 永続化、(b) `currentBrain` 更新、(c) 現 session があれば best-effort `dispose()`、(d) `session=null` を順に行う（[`cockpit.mjs`](../../../apps/soul/agent/scripts/cockpit.mjs:780)）。KILL は orchestrator 側 state のため切替を跨いで生存する。
4. 次の `sessionProxy.ask()` は `ensureFireResources()` を通り、新しい registry factory を呼ぶ。Claude だけは cockpit 起動側で Anthropic guard を明示し、Codex は adapter 内 OpenAI guard を実行する（[`cockpit.mjs`](../../../apps/soul/agent/scripts/cockpit.mjs:692)）。

**[決定]** brain-swap v0 は「配信前に頭を選ぶ」を主線とし、live swap は第一級 UX ではない。**[現行]** API は runtime swap を実装しているが、in-flight の中断/完了の厳密な取引境界はなく、adapter の dispose semantics に委ねる。

### 3.4 Active brain state と観測

- **[現行]** state snapshot の `brain` は `{ brain: currentBrain, credentialHealth: boolean }` だけ（[`cockpit-server.mjs`](../../../apps/soul/agent/src/cockpit/cockpit-server.mjs:569)）。provider、実 model ID、session/thread ID は含まれない。
- **[現行]** credential health は `existsSync(def.credentialPath)` の boolean のみで、資格情報ファイルの内容/パスはログや SSE に出さない（[`cockpit.mjs`](../../../apps/soul/agent/scripts/cockpit.mjs:806)）。
- **[現行]** session-init の stderr JSON は `model/apiKeySource/tools` を出すが、Codex factory は `onInit` を使わず余剰 option を無視するため、実行中の Codex model ID は state に残らない（[`cockpit.mjs`](../../../apps/soul/agent/scripts/cockpit.mjs:710)）。
- **[現行]** soul transcript/usage SSE は broadcast 時点の `brain` id としてタグ付けされる（[`cockpit-server.mjs`](../../../apps/soul/agent/src/cockpit/cockpit-server.mjs:1295)、同:1328）。
- **[履歴/既知の近似]** swap 直後に旧頭が返した in-flight 応答は、broadcast 時点の新しい `currentBrain` でタグ付けされ得る。これは followup 台帳で non-blocking の既知近似として記録されている（[`brain-swap-followup.md`](../../ai-cohost/implementation/waves/brain-swap/brain-swap-followup.md:53)）。

## 4. Exact fixed values and owners

| 値 | 現在の所有箇所 | 互換上の注意 |
|---|---|---|
| registry IDs/labels/factory/credentialPath | `src/mind/brains.mjs` | registry の実行側 source of truth。UI/server は import しない境界が残る |
| Claude model `claude-opus-4-8` | `src/mind/llm-session.mjs` | `claude` wrapper は options をそのまま透過 |
| Terra model `gpt-5.6-terra`, effort `none` | `src/mind/codex-session.mjs` | adapter default。`codex` entry は model override なし |
| GPT-5.5/Sol model IDs, effort `none` | `src/mind/brains.mjs` wrapper | Sol の `none` は Terra 実測等からの推定と docs に明記 |
| accepted POST IDs | `src/cockpit/cockpit-server.mjs` | registry を自動追随しない。追加時に手編集が必要 |
| select labels/choices | `src/cockpit/view-logic/health.mjs` → `settings-drawer.mjs` | registry label の複製。追加時に health と UI tests を同期 |
| persisted key `brainChoice` | `src/cockpit/cockpit-settings-store.mjs` | per-install local JSON。未知値は hooks が Claude に戻す |
| current selection | `scripts/cockpit.mjs` `currentBrain` | process-local。snapshot は id + health のみ |
| auth mode | `codex-session.mjs` `forced_login_method:"chatgpt"` | OAuth/subscription path。API key は渡さない |

**[現行]** `apps/soul/agent/package.json` は独立 npm package（workspace/lockfile 外）で、依存は `@anthropic-ai/claude-agent-sdk: 0.3.207`、`@openai/codex-sdk: ^0.144.5`、`onnxruntime-node: 1.27.0`。この package 境界は provider 依存を soul 特区内に閉じる。

## 5. Existing extension points

1. **新しい provider/model**: `BrainEntry` 1行（`id`, `label`, `create`, `credentialPath`）と `MindSession` 互換 adapter（`ask(content) -> {replyText, usage, ttftMs|null, elapsedMs}`, `dispose()`）を追加できる。
2. **provider-specific auth**: `env-guard.mjs` に sibling guard を置き、registry factory または adapter 起動時に呼ぶ既存形がある。
3. **Codex model variants**: `createCodexSession` の `model`/`effort` options と SDK fake injection (`sdkImpl`) により、adapter 本体を変更せず wrapper と fake test を追加できる。
4. **UI/server compatibility**: registry を import しない責務境界を維持する限り、`health.mjs` label、`cockpit-server.mjs` POST validation、UI fixture、server test の同時更新が必要。
5. **観測改善の seam**: `MindSessionAskResult` に生成時点 brain/provider/model を追加すれば、`fire-orchestrator` → `broadcastSoulTranscript`/usage へ正確な attribution を運べる。ただしこれは現契約の変更であり本稿では実施しない。
6. **memory**: `generateDigest({brainDef})` は現在選択中 registry factory を使う使い捨て session へ差し替え可能だが、保存される digest は本文だけで brain/model metadata を持たない（[`memory.mjs`](../../../apps/soul/agent/src/mind/memory.mjs:122)、同:161）。

## 6. Persistence and compatibility implications

- **[現行]** `cockpit-settings.local.json` は file-backed merge store。`brainChoice` は他設定と共存し、書込失敗は startup failure にしない。旧値/未知値は Claude fallback なので、4値追加前の設定ファイルも起動できる。
- **[現行]** transcript の観測タグは wire 上 `brain` id のみ。label は UI の現在 `BRAIN_LABELS` から解決されるため、後から label を変えると過去の id 表示の見え方が変わり得る。
- **[現行]** memory digest ファイルは自然言語本文のみで、生成時 brain/model/provider の snapshot を保存しない。過去記憶の頭を再現/監査するデータ契約はない。
- **[推論]** provider と model が同じ selection id に圧縮されているため、同一 provider 内の別 model、同じ model の別 auth 経路、label の表示名変更を区別するには registry の id を増やすか別 metadata schema が必要になる。
- **[現行]** `ttftMs` は Claude が観測可能、Codex は token delta がなく `null`。fire-orchestrator の主消費は `replyText`/`usage` で、usage shape は両 SDK の `{input_tokens, output_tokens, ...}` に依存するため、provider adapter が契約へ正規化する責務を持つ。
- **[現行]** Codex の画像は base64→一時ファイル→`local_image`→finally 削除という adapter 私事。二つ目の file-only provider が来た時だけ共有 helper へ昇格する予約がある（[`brain-swap.md`](../../ai-cohost/soul/brain-swap.md)）。

## 7. Tests and verification surfaces

**[現行テスト面]**

- [`brains.test.mjs`](../../../apps/soul/agent/src/mind/brains.test.mjs): registry 4 IDs、freeze、label/credentialPath shape、GPT-5.5/Sol model+effort fake wiring。
- [`cockpit-settings-store.test.mjs`](../../../apps/soul/agent/src/cockpit/cockpit-settings-store.test.mjs): brainChoice roundtrip、instance persistence、他設定との共存、corrupt/non-string、unwritable path。
- [`scripts/cockpit.test.mjs`](../../../apps/soul/agent/scripts/cockpit.test.mjs): registry-driven initial choice、未知値 fallback、保存失敗寛容、swap の dispose→null→次回生成。
- [`cockpit-server.test.mjs`](../../../apps/soul/agent/src/cockpit/cockpit-server.test.mjs): `/api/brain` の503/正常4値/400、snapshot brain、transcript/usage brain tag。
- [`health.test.mjs`](../../../apps/soul/agent/src/cockpit/view-logic/health.test.mjs) と [`cockpit-ui.test.mjs`](../../../apps/soul/agent/src/cockpit/cockpit-ui.test.mjs): 4 label、credential label、select fixture。
- [`codex-session.test.mjs`](../../../apps/soul/agent/src/mind/codex-session.test.mjs): fake SDK、thread/rollout cleanup、image bridge。`forced_login_method` の直接 assertion、turn.failed 台帳の直接 assertion、turn2 image 配列は followup 未完項目。

**[履歴]** Domain A/B/C の記録は 797→814→827、追加2頭追撃は 827→835 と報告している（[`domain-a.md`](../../ai-cohost/implementation/waves/brain-swap/domain-a.md:56)、[`domain-b.md`](../../ai-cohost/implementation/waves/brain-swap/domain-b.md:57)、[`domain-c.md`](../../ai-cohost/implementation/waves/brain-swap/domain-c.md:81)、[`brain-swap-followup.md`](../../ai-cohost/implementation/waves/brain-swap/brain-swap-followup.md:156)）。実 LLM/ネット消費ゼロ、install/commit/lockfile 変更なしという記録である。

**[当調査の検証]** `npm.cmd test`（`apps/soul/agent`）を試行したが、sandbox の Node `ChildProcess.spawn` が `EPERM` となり 53 test files が全て実行前失敗（pass 0/fail 53）。したがって上記 835/835 は wave の履歴 evidence、今回の実行結果は環境制約として分離する。

## 8. Risks and ambiguous semantics

1. **二重/三重の値複製**: `brains.mjs`、`health.mjs`、`cockpit-server.mjs` が IDs/labels を別々に持つ。追加時の片側更新漏れが selection 400、UI unknown、registry fallback の不一致を生む。
2. **active identity の欠落**: snapshot/SSE は brain id のみで provider/model ID を示さない。Codex は `onInit` model も出さないため、運用時に「現在何が動いているか」を機械的には復元できない。
3. **in-flight attribution**: swap 中に生成した旧頭の応答へ新頭の brain tag が付く既知近似。配信前選択が本線であることに依存する。
4. **表示名の意味**: `Claude (Opus 4.8)` 等は registry label であり、魂自身の名前/人格名ではない。現在の FIRE prompt の自己名 `コーディ`、契約で望まれている GPT 系の自己名 `チャッピー` は、brain id/model identity とは別の prompt/persona concern である（固定名全検索と memory 深掘りは本調査の対象外）。
5. **effort の確度差**: GPT-5.5 の `none` は wave が公式確認済み、GPT-5.6 Sol は Terra 実測からの推定で初回400を安全な失敗形とする記録。registry はこの推定を固定値として出荷している。
6. **Codex durable rollout**: SDK は thread/rollout を disk に残すため、dispose/startup sweep は自分の sidecar ledger の exact thread IDs だけを掃除する。provider 追加時にこの安全境界を壊さない必要がある。

## 9. Facts closable from repo

- 現在の registry は4 IDで、Claude 1頭 + Codex 3頭。provider field はなく factory adapter が provider を決める。
- selection UI は `health.mjs` の4 label、server validation は4 hardcoded ID、起動側 validation は `BRAIN_IDS` registry-driven。
- 永続キーは `brainChoice`、未記憶/未知値の default は Claude。
- runtime swap は `dispose→null→次回 Fire`。KILL は head-independent。
- state snapshot は `brain` id と credential existence boolean のみ。provider/model ID は wire contract にない。
- transcript/usage tag は broadcast 時 current brain。in-flight mismatch は台帳記録済み。
- `apps/soul/agent` は独立 npm package、Anthropic/Codex SDK 依存は soul zone 内。Runtime Player 側に soul import/provider registry は確認されない。
- memory digest は selected brain factory で生成できるが、保存本文に brain/model metadata はない。

## 10. Premises requiring user decision

本調査では次を決めない（契約指定の未決事項）。

1. identity の粒度を provider/series 単位にするか、個別 model ID 単位にするか。
2. `id`/`label`/魂の表示名を registry 固定にするか、ユーザー編集可能にするか。
3. brain swap を即時（in-flight cancellation/attribution を含む）とするか、次回 Fire 適用に限定するか。
4. transcript/SSE と memory の履歴で、当時の model/provider/name を snapshot 保存するか、現在 registry label を解決するか。
5. model identity を prompt の自己認識・persona・TTS voice にまで波及させるか。固定自己名・呼びかけ語彙とは別の裁定である。

## 11. Evidence index and limitations

### Evidence index

- Registry/adapter contract: [`brains.mjs`](../../../apps/soul/agent/src/mind/brains.mjs)、[`llm-session.mjs`](../../../apps/soul/agent/src/mind/llm-session.mjs)、[`codex-session.mjs`](../../../apps/soul/agent/src/mind/codex-session.mjs)
- Selection/swap/state: [`cockpit.mjs`](../../../apps/soul/agent/scripts/cockpit.mjs)、[`cockpit-settings-store.mjs`](../../../apps/soul/agent/src/cockpit/cockpit-settings-store.mjs)、[`cockpit-server.mjs`](../../../apps/soul/agent/src/cockpit/cockpit-server.mjs)
- UI compatibility: [`health.mjs`](../../../apps/soul/agent/src/cockpit/view-logic/health.mjs)、[`settings-drawer.mjs`](../../../apps/soul/agent/src/cockpit/ui/settings-drawer.mjs)
- Contract/decisions: [`brain-swap.md`](../../ai-cohost/soul/brain-swap.md)、[`brain-swap-inventory.md`](../../ai-cohost/implementation/orchestration/brain-swap-inventory.md)
- Wave evidence: [`domain-a.md`](../../ai-cohost/implementation/waves/brain-swap/domain-a.md)、[`domain-b.md`](../../ai-cohost/implementation/waves/brain-swap/domain-b.md)、[`domain-c.md`](../../ai-cohost/implementation/waves/brain-swap/domain-c.md)、[`brain-swap-followup.md`](../../ai-cohost/implementation/waves/brain-swap/brain-swap-followup.md)
- Tests: [`brains.test.mjs`](../../../apps/soul/agent/src/mind/brains.test.mjs)、[`cockpit-server.test.mjs`](../../../apps/soul/agent/src/cockpit/cockpit-server.test.mjs)、[`scripts/cockpit.test.mjs`](../../../apps/soul/agent/scripts/cockpit.test.mjs)

### Limitations

- 固定名の全検索、過去 memory の内容深掘り、実機 Claude/Codex、OBS/Electron/Runtime Player 実射は別担当/別 gate とし、本稿では実行していない。
- Git は brain-swap 実装・4頭追加の履歴を確認したが、履歴の 835/835 は再実行結果ではなく wave 記録である。今回の test 試行は sandbox `spawn EPERM` のため pass/fail をコード品質の判定に使わない。
- 公式 model ID の URL は wave followup に保存された一次参照を採用した。Sol の effort `none` は公式列挙ではなく Terra 実測からの推定であることを維持する。
