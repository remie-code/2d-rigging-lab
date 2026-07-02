# Wave103 Domain A — Design / Development Compliance Review

- Wave: Wave103 (`headless-authoring-host-foundation`)
- Domain: A — Headless Authoring Host CLI (`wave103-headless-authoring-host-cli`)
- Lane: Design / Development Compliance Review (lane 2/3)
- Reviewer: Review-Sylph (opus)
- Date: 2026-07-02
- Source of truth: `discussion/implementation/orchestration/wave103-plan.md` §6 (Domain A) / §9 (Review Policy)
- Basis conventions read: source-file-organization-policy.md, dependency-policy.md, operation-policy.md, schema-and-id-conventions.md, design/codex-friendly-automation-policy.md
- Read-only review. No source modified.

## 判定 (Verdict)

**pass**

Domain A の新規アプリ `apps/authoring-host/`（15 ソース + 3 テスト + 2 resolver mjs + config 3）と ai-interface への狭い追加（`ai-auto-approval-policy.ts` + test + barrel 1 行）は、source organization / dependency / schema-and-id / 責務境界 / operation-policy / codex-friendly-automation の各規約を満たす。禁止スコープへの Domain A 由来変更は無い（lockfile diff = 0、tracked 変更は `package.json` scripts 2 行と ai-interface `index.ts` barrel 1 行のみ）。blocking / major finding は無し。zod の hoisted 解決配線は「pnpm install なし・依存追加なし」制約下の意図的な手段であり、脆さは残るが本アプリ内に閉じた dev/test tooling であって dependency-policy に違反せず、blocking ではない（minor + maintainability note として記録）。

---

## 検証項目ごとの結果と証拠

### 1. Source organization policy 遵守 — pass

- **`index.ts` の不在（barrel 問題を回避）**: `apps/authoring-host/` に `index.ts` は存在しない。app の公開エントリは `package.json:6-8` の `bin: { "authoring-host": "./src/cli.ts" }` であり `exports` バレルを持たない。よって DEC-FILE-001 / R-FILE-001 の barrel-only 要求に抵触する index.ts はそもそも存在しない。`git ls-files --others` による新規ファイル一覧で `index.ts` はゼロ件（`types.ts` / `schemas.ts` / `utils.ts` / `helpers.ts` も同様にゼロ件）。
- **ai-interface `index.ts` は barrel のまま**: `packages/ai-interface/src/index.ts` への変更は `export * from "./ai-auto-approval-policy.js";` の 1 行追加のみ（`git diff HEAD` で確認）。dependency-boundary.test.ts:8-18 の「barrel-only」テストが引き続き通る（Orch 再現で ai-interface 88/88 pass）。R-FILE-001 準拠。
- **責務ごとのファイル分割**（各ファイル単一責務、god file なし）:
  - CLI 面: `cli.ts`（argv/stdin 入口 + JSON 応答 + 終了コード）、`cli-arguments.ts`（argv パース）、`authoring-host-response.ts`（応答 DTO + outcome→exit code / status→outcome マップ）
  - オーケストレーション: `run-authoring-host-command.ts`（load→executor→auto-approve→save の 1 コマンドサイクル）
  - host 実装: `authoring-host-command-host.ts`（`AiOperationCommandHost` 実装、operation-core 経由 dryRun/commit）
  - IO / state: `package-directory-io.ts`（Node fs パッケージ load/save）、`host-state-store.ts`（承認状態 + transcript の state-dir 永続化）
  - test-support: `authoring-host-fixtures.ts` / `command-builders.ts` / `package-normalization.ts`（責務名で分離）
  - 最長ファイルは `authoring-host-fixtures.ts:314` 行で閾値内。catch-all なし。
- **ai-interface 側の新規責務ファイル**: `ai-auto-approval-policy.ts`（自動承認ダイヤル）は既存 `ai-approval-policy.ts` と別責務で独立ファイル化。R-FILE-002 準拠。
- **ガード実行**: `node scripts/check-source-organization.mjs` → `Source organization guard passed.` (EXIT 0)。ガードは `apps/**` を既定スキャン対象に含む（policy §Scope）。

### 2. 依存ポリシー遵守 — pass（zod 配線に minor + maintainability note）

- **新規外部依存ゼロ / lockfile 無変更**:
  - `git diff --name-only HEAD -- pnpm-lock.yaml` は空（無変更）。R-DEP-001 の lockfile drift なし。
  - tracked 変更は `package.json`（scripts 2 行）と `packages/ai-interface/src/index.ts`（barrel 1 行）のみ。ルート `package.json` の diff は `test:authoring-host` / `typecheck:authoring-host` の 2 scripts 追加のみで、`dependencies` セクション無変更。§6 allowed write scope「ルート package.json — scripts 追加のみ（依存追加は禁止）」に整合。
  - `apps/authoring-host/package.json:14-25` の `dependencies` は workspace パッケージ 5 本 + `zod: ^4.4.3`、`devDependencies` は `@types/node` / `typescript`。zod は**既にリポジトリに存在する承認済み依存**（ai-interface 等が使用）であり、新規外部依存ではない。lockfile へ新エントリを足していない（install していない）。
  - `ai-auto-approval-policy.ts` の import は `@private-2d-rigging-lab/contracts` / `@private-2d-rigging-lab/operation-core` / `./ai-approval-policy.js` / `zod` のみ。dependency-boundary.test.ts:20-40 が許す ai-interface 依存集合（contracts, operation-core, runtime-core, validator-core, zod）に収まる。fs / package-format / DOM / transport の import なし（境界テスト 42-73 の禁止パターンに非該当。Orch 再現で 88/88 pass）。
- **node 標準ライブラリのみ追加使用**: authoring-host の fs 系は `node:fs` / `node:fs/promises` / `node:path` / `node:os` / `node:crypto` / `node:child_process` / `node:module` / `node:url`（すべて Node 標準）。外部ランタイム依存の新規追加なし。
- **依存ガード実行と分類**: `node scripts/check-dependencies.mjs` → EXIT 1、finding 1 件のみ:
  - `pnpm-lock.yaml: lockfile mentions forbidden dependency class (Cubism cmo3 parser/runtime dependency)`
  - **分類**: Domain A 由来ではない既存の偽陽性。lockfile は無変更（diff 空）で、マッチ元は `pnpm-lock.yaml:2452` の integrity ハッシュ `sha512-95Pu1QXQvruGEhv62X`**`CMO3`**`Mm90GscOCClvrIUwCM0PY...` に含まれる大小無視の部分文字列 `CMO3`（`grep -in cmo3` で 1 行のみ確認）。clean HEAD に既存の false-positive で、Domain B レビュー INFO-1 と同一事象。**Domain A 由来の新規 dependency finding はゼロ**。
- **zod hoisted 解決配線の評価（確認項目 2 の核心）**: 本アプリは `pnpm install` されていない（lockfile を変えないため）ので、自前の `node_modules/zod` を持たない。bare `zod` 解決を 3 経路で ai-interface の hoisted zod へ寄せている:
  - ランタイム CLI: `workspace-source-resolver.mjs:38-40,56-65` が `zod` → `packages/ai-interface/node_modules/zod/index.js`
  - typecheck: `tsconfig.json:23` が `paths["zod"]` → `../../node_modules/.pnpm/zod@4.4.3/node_modules/zod`
  - test: `vitest.config.ts:24,28` が alias `^zod$` → `packages/ai-interface/node_modules/zod/index.js`
  - **評価**: これは「install なし・依存追加なし」制約（§6 forbidden: 新規外部依存 / lockfile 変更）の下で TypeScript ソースを build ステップなしに実行するための意図的な手段であり、dependency-policy には違反しない（新規依存も lockfile 変更も無い）。ただし脆さは残る: (a) tsconfig の `zod@4.4.3` はバージョンピンされた `.pnpm` パスで、zod 昇格時に手動更新が要る、(b) ai-interface が常に zod を hoisted で持つ前提に暗黙依存、(c) 同一 zod 解決が 3 ファイルに分散し不整合リスク。いずれも**本アプリ内に閉じた dev/test tooling** で、editor/player/packages の本番配線には波及しない。将来 `pnpm install` により workspace を正規リンクすれば解消するが、それは本 wave のスコープ外制約。→ **blocking ではなく minor（maintainability）**。DEV-A-1 に記録。
- **workspace materialize**: `apps/authoring-host/node_modules/.vite/results.json` のみが untracked で存在（vitest キャッシュ）。gitignore 済みで tracked ではない（`git ls-files --others --exclude-standard` に非出現）。コミット対象への混入なし。

### 3. schema-and-id 規約 — pass

- **machine-readable id は camelCase / prefix 規約通り（R-SCHEMA-002: スペースなし）**:
  - operation type: `createParameter` / `generateMesh` / `createWarpDeformer` / `editKeyformKey` / `setMaskRelation`（camelCase、operation-core 既存値の消費、command-builders.ts / smoke test で使用）。
  - id prefix: `op_*`（`op_smoke_generate_mesh`, `op_roundtrip_param` 等）、`param_*`（`param_eye_open`, `param_cross`）、`cmd_*`（`cmd_param_dry`, `cmd_cross_commit`）、`rig_*`（`rig_eye_warp`）、`bin_*`（`bin_${textureId}`）、`agent_*`（`agent_headless`）。すべて contract-owned prefix + safe token 形式（DEC-SCHEMA-002）でスペースなし。
  - fixture の texture path `assets/textures/${textureId}.raw-rgba`（authoring-host-fixtures.ts:219）は kebab / dot-suffix パス、スペースなし。
- **新規 schemaVersion 文字列が既存慣習（kebab-case + -vN）に沿う**:
  - `authoring-host-command-response-v1`（authoring-host-response.ts:19, cli.ts:76）
  - `authoring-host-approval-state-v1`（host-state-store.ts:38, 120）
  - `ai-approval-state-v1`（ai-auto-approval-policy.ts:160,184,190 — 既存 `ai-approval-*` 系列と一貫）
  - いずれも `<kebab-name>-vN` 形式で、既存の `operation-request-v1` / `ai-command-request-v1` / `ai-native-live2d-workspace-v1` / `operation-result-v1` と同慣習。逸脱なし。
- **DTO/Schema ペア（R-SCHEMA-003）**: host が新設する zod スキーマは `ai-auto-approval-policy.ts` の `AiApprovalRecordSchema`/`AiApprovalRecordDto`、`AiApprovalStateDocumentSchema`/`AiApprovalStateDocument`。`*Schema` / `*Document`（`*Dto`）命名で一貫。host-state-store.ts の `ApprovalStateRecordSchema`/`ApprovalStateRecord`・`ApprovalStateDocumentSchema`/`ApprovalStateDocument` は app 内部の state ファイル境界であり外部 boundary DTO ではない（内部ドメイン型は `Dto` 省略可、DEC-SCHEMA-001）。応答型 `AuthoringHostCommandResponse` は CLI stdout の JSON 形状だが app-local な機械出力であり、contracts 所有の外部 boundary DTO ではないため R-SCHEMA-001 の contracts 所有義務対象外（Domain A の allowed scope に contracts なし。妥当）。
- **注記（info）**: host-state-store.ts の承認状態シリアライズ/ハイドレートは、ai-interface が公開する `AiApprovalStateDocumentSchema` / `hydrateInMemoryAiApprovalPolicy`（ai-auto-approval-policy.ts:183-225）とは別に、app-local schemaVersion `authoring-host-approval-state-v1` で再実装している。両者は同じ record 形状のロジックを重複させている。schema drift の blocking（R-SCHEMA / DEC-SCHEMA-001 の外部 boundary 重複）には当たらない（どちらも app/ai-interface のローカル state であって cross-module 外部 DTO ではない）。DEV-A-2（info）として記録。

### 4. 責務境界 — pass

- **ai-interface が純ロジック層のまま（fs / package-format 非依存）**: `ai-auto-approval-policy.ts` は `contracts`（DiagnosticDto）/ `operation-core`（OperationResultDto）/ `./ai-approval-policy.js` / `zod` のみ import。fs・package-format・DOM・transport の import ゼロ。dependency-boundary.test.ts の 5 テスト（barrel / 承認依存集合 / forbidden package / fs+transport / DOM）が全て緩和されず引き続き pass（Orch 再現 88/88）。承認ポリシー（自動承認ダイヤル）が ai-interface に置かれるのは妥当: 承認は AI コマンドのライフサイクル責務であり、`AiApprovalPolicy` を implements して既存 `InMemoryAiApprovalPolicy` に delegate する（ai-auto-approval-policy.ts:69-105）。純ロジックのみで fs 依存を持ち込んでいない。
- **fs・package-format・operation-core の配線がすべて host 側にある**:
  - fs: `package-directory-io.ts` / `host-state-store.ts`（node:fs のみ）
  - package-format: `package-directory-io.ts:18-22`（型 import）+ authoring-core の open/save path 経由
  - operation-core 配線: `authoring-host-command-host.ts`（`createOperationCore` 経由 dryRun/commit）
  - すべて `apps/authoring-host/` 内。ai-interface には一切漏れていない。§3.1 の「fs / package-format との接続はホスト側の責務」に整合。
- **executor 契約の尊重**: host は `AiOperationCommandHost` を implements し（authoring-host-command-host.ts:27）、`AiCommandExecutor` に host + auto-approval policy + transcript を渡して `execute()` を呼ぶ（run-authoring-host-command.ts:61-68）。承認記録は `executor.approvalPolicy`（transcript ラップ済み policy、ai-command-executor.ts:60-61）を通して行い（run-authoring-host-command.ts:131-136）、承認が persist かつ transcript に載る。executor を迂回する経路なし。

### 5. Write scope 遵守 — pass

- `git status --porcelain`:
  - `M package.json`（scripts 2 行、allowed）
  - `M packages/ai-interface/src/index.ts`（barrel 1 行、allowed）
  - `?? apps/authoring-host/`（完全新規、allowed）
  - `?? packages/ai-interface/src/ai-auto-approval-policy.ts` / `.test.ts`（自動承認ポリシー + test、allowed）
  - `?? discussion/implementation/reviews/wave103/`（review files、allowed）
  - `?? packages/render-software/`（**Domain B の並行作業物**。§5 注記どおり Domain A の判定対象外。存在は違反ではない）
- **Forbidden scope への Domain A 由来変更ゼロ**: `apps/editor`・`apps/runtime-player`・`packages/render-*`（render-software を除く）・`packages/runtime-core`・`packages/validator-core`・`pnpm-lock.yaml` のいずれにも Domain A 由来変更なし。lockfile diff 空。
- **Conditional scope 未使用**: `packages/package-format/src/**` / `packages/authoring-core/src/**` / `packages/operation-core/src/**` への変更ゼロ（git status に非出現）。host は既存 authoring-core / package-format / operation-core の**公開 API を消費のみ**で、read 側ヘルパー追加や型追加すら行っていない（§6 conditional の justification が不要な、より安全側の着地）。
- **パッケージディレクトリ外への state 書き込み**: state（`approval-state.json` / `command-transcript.json`）は `--state-dir` 配下にのみ書かれる（host-state-store.ts:55-78）。テスト `run-authoring-host-command.test.ts:195-227` / `cli-cross-process.test.ts:157-159` がパッケージディレクトリ内に transcript / approval-state が現れないことをアサート。§6 forbidden「パッケージディレクトリ内への非 package-format ファイル書き込み」に非該当。

### 6. operation-policy 遵守 — pass

- **全 mutation が operation-core の operation 経由（DEC-OP-001）**: host が graph を直接書き換えるコードパスは無い。`authoring-host-command-host.ts:49-55` の `dryRunOperation` / `commitOperation` は `this.#operationCore.dryRunOperation(...)` / `.commitOperation(...)` に委譲するのみ。session の直接 mutation なし。fixture setup（authoring-host-fixtures.ts:176-205）の `createSetupCommitter` も `core.commitOperation(session, request)` 経由で、直接 JSON 書き換えをしていない（test fixture は Operation Core 経由のみという Actor Permission Table「Test runner: only through Operation Core」に整合）。
- **dry-run / commit 分離（DEC-OP-002）**: dry-run は commit しない（run-authoring-host-command.ts:150-153 で `command !== "commitOperation"` なら save しない、`saved:false`）。commit は success 時のみ save（同 155-157）。テスト `run-authoring-host-command.test.ts:41-80` が dry-run で on-disk パッケージが不変であること（revision 非前進）を、82-135 が commit で revision=1 かつ param 永続を実証。
- **AI は承認なしに commit しない（DEC-OP-003）**: 自動承認は「ブロッキング診断なし」の機械ゲートで、承認は `recordDryRun → approveDryRunCommand → checkCommitApproval` のライフサイクルを迂回しない（ai-auto-approval-policy.ts:12-24 のドキュメント + delegate 委譲）。承認記録が persist されない状態での commit は `needs_approval` で拒否（cli-cross-process.test.ts:162-204）。ライフサイクル改変・承認チェック緩和なし。
- **operation log（DEC-OP-004）**: commit 時に operation log を JSONL でパッケージへ保存（run-authoring-host-command.ts:159-167、`serializeOperationLogEntriesToJsonl`）。`operations/log.jsonl` は artifact ref 規約（Table 2）のパスに整合。

### 7. codex-friendly-automation-policy 遵守 — pass

- **CLI 入出力が機械操作に適する（§4 Repository API Boundary）**:
  - 入力: JSON コマンド（`--command-file <path>` またはファイル省略時 stdin、cli.ts:37-39）。1 コマンド = 1 プロセスのワンショット（§3.1 / codex policy §4）。
  - 出力: JSON 応答を stdout に整形出力（cli.ts:53、`JSON.stringify(response, null, 2)`）。応答は決定論的な機械可読フィールド（outcome / commandId / aiCommandStatus / diagnostics / autoApproval / saved / packageRevision）を持つ。
  - **終了コードで成功 / 拒否 / エラーを区別**（§6 required implementation + codex policy §4「machine-readable failures」）: `mapOutcomeToExitCode`（authoring-host-response.ts:35-44）が success→0 / rejected→2 / error→1。cli-cross-process.test.ts:122,200 が exit 0 と exit 2 を実プロセスで区別実証。
- **repo が proposal 生成・意味推論をしない（§1 / Level 3 禁止）**: host は与えられた operation コマンドを検証・dry-run・commit するだけで、repair candidate 生成・alternatives ランキング・自然言語解釈・意味的パート推論を一切行わない。自動承認は「診断なし → 承認」の決定論ゲート（Level 1: deterministic command operation）であり、隠れた suggestion ロジックではない。承認ダイヤル（`humanApprovalOperationTypes`）は特定 operation クラスを人間承認へ戻せる構造を保つ（ai-auto-approval-policy.ts:43-55,131-140、§3.1「ダイヤル構造を保つ」に整合）。外部 transport（HTTP/WS/MCP）を実装していない（§14 out of scope / codex policy §6 の future trigger 未踏）。

### 8. spec 追認（本レーンの範囲で確認できた範囲、正式判定は Spec Compliance レーン）

- `createEndsCenter` 単独新規作成の実証: `closed-problem-01-smoke.test.ts:132-181` が keyform set 0 件の状態から `editKeyformKey(createEndsCenter)` を CLI host 経由で commit し、min/default/max 3 キーの keyform set が新規生成されることをアサート。§6 の最優先未確認事項に対する実証が実装されている（詳細判定は Spec / Test Adequacy レーンに委ねる）。

---

## Findings

| # | Severity | 項目 | 内容 |
|---|---|---|---|
| DEV-A-1 | minor | zod hoisted 解決配線の脆さ | `apps/authoring-host` は install されず、bare `zod` を 3 経路（`workspace-source-resolver.mjs:38-40`, `tsconfig.json:23` の `zod@4.4.3` ピン, `vitest.config.ts:24,28`）で ai-interface の hoisted zod に寄せている。dependency-policy 違反ではない（新規依存 / lockfile 変更なし）が、バージョンピン・ai-interface への暗黙依存・3 箇所分散により zod 昇格時の保守負荷と不整合リスクがある。dev/test tooling として本アプリ内に閉じており blocking ではない。正規化（`pnpm install` による workspace リンク）は本 wave の「install 禁止」制約外。 |
| DEV-A-2 | info | 承認状態シリアライズの重複 | `host-state-store.ts:28-130` が承認 record の serialize/hydrate を app-local schemaVersion `authoring-host-approval-state-v1` で再実装。ai-interface は同等の `AiApprovalStateDocumentSchema` / `hydrateInMemoryAiApprovalPolicy`（`ai-auto-approval-policy.ts:183-225`, schemaVersion `ai-approval-state-v1`）を公開しており、ロジックが重複している。両者とも app/ai-interface ローカルの state であって cross-module 外部 boundary DTO ではないため schema-drift blocking には当たらないが、将来 ai-interface 側ヘルパーへ寄せると重複を消せる。 |
| DEV-A-3 | info | transcript ハイドレートの型アサーション | `host-state-store.ts:137` は永続化 transcript を zod 検証せず `as AiCommandTranscriptDocument` でキャスト（承認 doc は `ApprovalStateDocumentSchema.parse` で検証しているのと非対称）。state-dir はホスト自身が書く信頼境界内であり実害は低いが、破損 state-dir 投入時の失敗が不明瞭になりうる。 |

参考（Domain A 由来ではない既存事象、記録のみ）:

- INFO-1: `check-dependencies.mjs` が clean HEAD の pnpm-lock.yaml で先行 fail する（integrity ハッシュ内 `CMO3` 部分文字列の大小無視誤検知、`pnpm-lock.yaml:2452`）。Domain B レビュー INFO-1 と同一事象。lockfile は Domain A 無変更（diff 空）であり Domain A の pass 判定を妨げない。ガード側 false-positive 抑制は本 wave スコープ外。

---

## 質問 (Questions to caller / Orch-Sylph)

なし。§6 / §9 の Design/Development 共通項に照らして解釈上の曖昧点は生じなかった。

補足（判断が必要になった場合の情報）:

- 依存ガードの先行 fail（INFO-1）は「Domain A 由来の新規 finding が無いこと」を判定基準とする委任指示に従い、pass を妨げないものとして扱った。
- DEV-A-1（zod 配線）は「install 禁止・依存追加禁止」という本 wave の明示制約下での意図的トレードオフであり、正規化には別 wave での `pnpm install` 判断が要る。Undine が将来 install を許すなら DEV-A-1 / DEV-A-2 双方を掃除できる。本レビューは現制約下で blocking にはしない。

---

## 参照ファイル

- `apps/authoring-host/package.json`, `tsconfig.json`, `vitest.config.ts`
- `apps/authoring-host/workspace-source-resolver.mjs`, `register-workspace-source-resolver.mjs`
- `apps/authoring-host/src/cli.ts`, `cli-arguments.ts`, `run-authoring-host-command.ts`, `authoring-host-command-host.ts`, `authoring-host-response.ts`, `host-state-store.ts`, `package-directory-io.ts`
- `apps/authoring-host/src/test-support/{authoring-host-fixtures,command-builders,package-normalization}.ts`
- `apps/authoring-host/src/{run-authoring-host-command,cli-cross-process,closed-problem-01-smoke}.test.ts`
- `packages/ai-interface/src/ai-auto-approval-policy.ts`, `ai-auto-approval-policy.test.ts`, `index.ts`（barrel 1 行追加）
- `packages/ai-interface/src/dependency-boundary.test.ts`（無変更・境界維持の確認先）
- `packages/ai-interface/src/ai-command-executor.ts`（approvalPolicy getter / transcript ラップの確認先）
- `package.json`（scripts 2 行追加）
