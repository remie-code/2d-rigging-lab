# Wave103 Domain A (Headless Authoring Host CLI) — Spec Compliance Review

- Lane: Spec Compliance Review（Review-Sylph, model: opus）レーン 1/3
- Reviewer: Sylph（Review-Sylph）
- Caller: Orch-Sylph（Wave103 Domain A オーケストレーター）
- Date: 2026-07-02
- Source of truth: `discussion/implementation/orchestration/wave103-plan.md` §3.1（Host Semantics）/ §6（Domain A）/ §9（Review Policy）
- Basis: `discussion/model-authoring/premises/operating-policies.md`, `discussion/model-authoring/closed-problems/01-eyeball-x/api-requirements.md`
- 照合先: `packages/ai-interface/src/ai-command-executor.ts`, `ai-approval-policy.ts`, `ai-command-transcript.ts`, `dependency-boundary.test.ts:44-62`
- Scope: 新規 `apps/authoring-host/`（CLI 本体 + テスト 3 本 + test-support 3）, ai-interface への狭い追加（`ai-auto-approval-policy.ts` + テスト + barrel 1 行）, ルート `package.json` scripts 2 行
- Method: Gnome 要約に依存せず、全対象ソース + 全テストを読み、`ai-command-executor.ts` / `ai-approval-policy.ts` の承認契約と突き合わせ、`pnpm run test:authoring-host`（8 tests）と `npx vitest run packages/ai-interface`（88 tests, dependency-boundary 含む）を実行して検証。git diff / status で禁止スコープ変更・lockfile 変更を確認。

## 判定: `pass`

§9 Domain A Spec Compliance の明示確認 5 項目 + §3.1 Forbidden 追加確認、すべて合格。Blocking 条件（依存/lockfile 変更、承認ライフサイクル緩和、パッケージ内 state 書き込み）はいずれも該当なし。Domain B の並行変更（`packages/render-software/`）は本判定に含めていない。

---

## 明示確認項目ごとの結果と証拠

### 1. dry-run → 自動承認 → commit のライフサイクルが `AiCommandExecutor` 契約通り、承認チェック緩和なし — PASS

- **executor を迂回する正規経路が無い**: CLI の正規経路は必ず `AiCommandExecutor.execute()` を通る。`run-authoring-host-command.ts:61-68` で `new AiCommandExecutor({ host, approvalPolicy, transcript })` を構築し `executor.execute(input.command)` を呼ぶ。operation-core を直接叩く経路は `AuthoringHostCommandHost`（`authoring-host-command-host.ts:49-55`）内の `dryRunOperation` / `commitOperation` のみで、これは `AiOperationCommandHost` インターフェース実装（`ai-command-executor.ts:20,103,151` が `this.#host.dryRunOperation` / `.commitOperation` を呼ぶ先）であり、executor 契約に組み込まれた host 実装点。仕様（§3.1 Required「ai-interface の `AiCommandExecutor` を経由」）通りで、operation-core 直叩きの正規経路化（§3.1 Forbidden）には該当しない。
  - 補足: api-requirements.md:26 が示す通り Editor は operation-core を直叩きするが、本ホストは意図的に ai-interface 層（承認ライフサイクル・transcript・capability 制御込み）を通す設計を採用。ユーザー決定（§3.1 Required, wave 計画 §2 Discuss ①）と一致。
- **2 段階が維持されている**: `ai-command-executor.ts` の `#executeDryRun`（89-115）は `dryRunEdit` capability を要求し（90）、`recordDryRun` で承認記録を作る（104-108）。`#executeCommit`（117-159）は `commitWithApproval` capability を要求し（118）、`checkCommitApproval`（131-137）で `approvedDryRunCommandId` の承認を検証、`status !== "approved"` なら `ai.approvalRequired` / `ai.approvalRejected` で reject（138-149）。ワンショット commit は不可能な構造。
- **commit が承認記録を要求する構造が保たれている**: `ai-approval-policy.ts` `checkCommitApproval`（98-159）は、記録が無い / 未承認なら `needs_approval`（104-110）、agentId 不一致・operationId 不一致・digest 不一致で `rejected`。ホストはこの契約を一切改変していない（ai-approval-policy.ts は本ドメインで無変更、git diff 空）。
- **自動承認は既存ライフサイクルを迂回しない**: 新規 `DiagnosticGatedAutoApprovalPolicy`（`ai-auto-approval-policy.ts:69-172`）は `AiApprovalPolicy` を実装し、`recordDryRun` / `approveDryRunCommand` / `checkCommitApproval` をすべて delegate（`InMemoryAiApprovalPolicy`）へ委譲するだけ（82-105）。承認判定ロジックを短絡していない。ホスト（`run-authoring-host-command.ts:131-136`）は自動承認時に既存の `approveDryRunCommand` を呼ぶ（=正規の承認記録生成）。テスト `ai-auto-approval-policy.test.ts:116-139` が「承認前は needs_approval、approveDryRunCommand 後に approved」を明示検証。
- 実行確認: `run-authoring-host-command.test.ts:82-135`（dry-run → auto-approval → commit → reload で param 残存）、`cli-cross-process.test.ts:89-160`（実プロセス跨ぎの成功系）が通る。

### 2. 自動承認は「ブロッキング診断なし」に限定、無条件承認でない、ダイヤル構造 — PASS

- **ブロッキング判定基準**: `collectBlockingDiagnostics`（`ai-auto-approval-policy.ts:60-67`）は precondition と result 両方の diagnostics を集め、`isBlockingDiagnostic`（57-58）で `severity === "error" || "blocking"` のみ抽出。妥当な基準（warning / info は非ブロッキング）。
- **無条件承認でない**: `evaluateAutoApproval`（112-147）は 3 段でゲート — ① `status === "rejected"` → `autoApprove: false`（115-121）② `blockingDiagnostics.length > 0` → false（123-129）③ human-gated operation class → false（131-140）。すべてクリアしたときのみ `autoApprove: true, reason: "no-blocking-diagnostic"`（142-146）。
- **ホスト側でも二重に尊重**: `run-authoring-host-command.ts:125-127` は `decision.autoApprove` が false なら `approveDryRunCommand` を呼ばない。承認記録が作られないので、後続 commit は `needs_approval` で拒否される。
- **ダイヤル構造**: `humanApprovalOperationTypes`（`ai-auto-approval-policy.ts:54, 71, 131-140`）で特定 operation class を人間承認へ差し戻せる。CLI 引数 `--human-approval-op`（`cli-arguments.ts:57-59`, repeatable）→ `run-authoring-host-command.ts:50-52` で policy へ配線。仕様（§3.1 Required「将来特定の操作クラスを人間承認に戻せるダイヤル」）通り。テスト `ai-auto-approval-policy.test.ts:97-114` が gated / ungated の分岐を検証。
- **拒否系テスト**: `run-authoring-host-command.test.ts:137-193`（存在しない drawable への generateMesh → dry-run が `operation.generateMesh.missingDrawable` を診断、`autoApproved: false, reason: "operation-result-rejected"`、commit が `needs_approval`、ディスク上 meshes は 0 件）。ブロッキング診断があると自動承認されないことを実証。

### 3. 承認状態 / transcript がパッケージ外に永続化され、別プロセス跨ぎで機能 — PASS

- **パッケージ外**: `host-state-store.ts` は `--state-dir`（`cli-arguments.ts:49-51` 必須）配下に `approval-state.json` / `command-transcript.json` を書く（`host-state-store.ts:25-26, 55-57, 73-77`）。ファイルヘッダコメント（17-24）に「パッケージ外必須」を明記。パッケージディレクトリへの state 書き込み経路は無い。
- **別プロセス跨ぎ（実プロセス）**: `cli-cross-process.test.ts` は `node:child_process` の `spawn`（1）で `process.execPath` を起動し、dry-run と commit を**別々の OS プロセス**として実行（41-86）。dry-run 承認は state-dir 経由でのみ後続プロセスに伝わる。成功系（89-160）で commit が `packageRevision: 1` で saved、param がディスクに残ることを検証。
- **ネガティブ系**: 同テスト 162-204 は「先行 dry-run 承認が永続化されていない fresh プロセスでの commit」が exitCode 2 / `needs_approval` / saved:false で拒否されることを検証。state 永続化が実際に承認伝播の唯一経路であることを裏付ける。
- **in-process の state 外部化テスト**: `run-authoring-host-command.test.ts:195-227` は state-dir に 2 ファイルのみ、パッケージ内に approval-state / transcript を含むパスが無いことを検証。
- 永続化の往復整合: `host-state-store.ts:81-114`（hydrate: recordDryRun → 承認済みなら approveDryRunCommand を再生）/ `116-130`（serialize）。`ai-auto-approval-policy.ts:203-225` `hydrateInMemoryAiApprovalPolicy` も同一パターン。承認済み記録が別プロセスで復元される。

### 4. 閉問題 01 の 5 operation スモークと `createEndsCenter` 単独実証 — PASS

- **5 operation が CLI 経由**: `closed-problem-01-smoke.test.ts:64-210` が `applyOperationThroughHost`（32-58, dry-run → commit を `runAuthoringHostCommand` で実行）を通して順に実行 — ① `generateMesh`（77-89）② `createWarpDeformer`（92-108）③ `createParameter`（111-126）④ `editKeyformKey (createEndsCenter)`（137-160）⑤ `setMaskRelation`（184-195）。各段で `outcome: "success"` / `saved: true` を検証し、最終的に masks.json への反映（197-209）まで確認。
- **createEndsCenter 単独新規作成の明示アサーション**（api-requirements.md:33 の最優先未確認事項）:
  - **keyform set 未存在の前提を明示**: `closed-problem-01-smoke.test.ts:132-135` が `keyformsBefore.keyformSets` の length 0 をアサート。
  - **単独実行で新規 keyform set が生成される**: 137-160 で `createEndsCenter` を実行し `outcome: "success"` / `aiCommandStatus: "ok"` / `saved: true`。
  - **3 キーの厳密検証**: 162-181 で生成された keyform set が 1 件、target が `{kind:"drawable", id, property:"opacity"}`、keys が `[{value:-1,statePatch:0},{value:0,statePatch:0.5},{value:1,statePatch:1}]`（= parameter の min/default/max 位置に min/default/max パッチ）と厳密一致。
  - 結論: 「keyform set 未存在からの createEndsCenter 単独実行が動作する」ことが CLI 経由で実証されており、§6 Escalate 条件「createEndsCenter の単独新規作成が実際には動作しない」には**該当しない**（動作する）。
- 実行確認: `pnpm run test:authoring-host` で当テストが 487ms で pass。

### 5. ai-interface の dependency-boundary テストが緩和されていない — PASS

- **テストファイル自体無変更**: `git diff HEAD -- packages/ai-interface/src/dependency-boundary.test.ts` が空。緩和なし。
- **新規 production source が自動ガードされている**: `dependency-boundary.test.ts:76-90` の `listProductionSourceFiles` は src 配下の非 `.test.ts` を再帰列挙するため、新規 `ai-auto-approval-policy.ts` も対象に含まれる。以下 3 テストが同ファイルに対して有効:
  - 禁止パッケージ import（`:42-51`, package-format / authoring-core 等）
  - 禁止 fs / transport import（`:53-62`, node:fs 等）
  - DOM グローバル参照（`:64-73`）
- **`ai-auto-approval-policy.ts` の import 実確認**: ソース `:1-6` の import は `@private-2d-rigging-lab/contracts`（型のみ）, `@private-2d-rigging-lab/operation-core`（型のみ）, `zod`, 相対 `./ai-approval-policy.js` のみ。package-format / node:fs の import は無い。
- 実行確認: `npx vitest run packages/ai-interface` で dependency-boundary の 5 テスト含む 88 tests 全 pass。

---

## §3.1 Forbidden 追加確認

| Forbidden 項目 | 判定 | 証拠 |
|---|---|---|
| operation-core 直叩きを正規経路化 | 非該当 | 正規経路は `AiCommandExecutor.execute()`（`run-authoring-host-command.ts:61-68`）。operation-core 呼び出しは `AiOperationCommandHost` 実装内部のみ（`authoring-host-command-host.ts:49-55`）。 |
| 承認チェック無効化・commit ワンショット化 | 非該当 | ライフサイクルは executor 契約通り（確認項目 1）。ai-command-executor.ts / ai-approval-policy.ts は無変更（git diff 空）。 |
| パッケージ内への transcript/承認状態/一時ファイル書き込み | 非該当 | state は `--state-dir` 配下のみ（確認項目 3）。パッケージ書き込みは `package-directory-io.ts:279-287` の package-relative path のみで、authoring-core の save plan（`createAuthoringWorkspaceSavePlan`）と operation-log に限定。 |
| ワンショット CLI（1 コマンド=1 プロセス、ディスク=唯一の真実） | 遵守 | `cli.ts:30-59` は 1 コマンドを読み実行し JSON を stdout に出して終了。常駐なし。`cli-cross-process.test.ts` が 1 コマンド=1 プロセスを実証。 |
| 新規外部依存 / lockfile 変更 | 非該当 | `pnpm-lock.yaml` の git diff 空。ルート `package.json` は scripts 2 行追加のみ（依存フィールド無変更）。 |
| 禁止 write スコープ（editor / player / render-* / runtime-core / validator-core） | 非該当 | git status の変更は `apps/authoring-host/`, `packages/ai-interface/src/ai-auto-approval-policy.*`, `packages/ai-interface/src/index.ts`（barrel 1 行）, ルート `package.json`, `packages/render-software/`（Domain B）, reviews のみ。Domain A の書き込みは §6 Allowed write scope 内。 |

---

## 追加確認（§6 required tests / Escalate 条件 / 周辺）

- **required tests のカバレッジ**（§6）:
  - load → save 往復（正規化フィールド一覧報告）: `run-authoring-host-command.test.ts:41-80`。正規化フィールドは `package-normalization.ts:5-13` にコメントで明示 — manifest.json / workspace.json の `createdAt`/`updatedAt`、operations/log.jsonl 各エントリの `timestamp`。§6 の「一覧を報告に明記」要件を test-support 側で文書化。
  - createParameter の dry-run → 承認 → commit → save → reload: `:82-135`。
  - 不正 payload dry-run → 診断 → 未承認 → commit needs_approval: `:137-193`。
  - 別プロセス跨ぎ承認: `cli-cross-process.test.ts:89-160`。
  - 閉問題 01 スモーク + createEndsCenter 単独: `closed-problem-01-smoke.test.ts`（確認項目 4）。
  - 決定論: `run-authoring-host-command.test.ts:229-270`（同一フィクスチャ+コマンド列 2 回で正規化後 files 一致）。
  - transcript / 承認状態がパッケージ外: `:195-227`。
  - transcript 記録: executor が `appendAiCommandResponseToTranscript`（`ai-command-executor.ts:171-176, 203-208`）と承認記録の transcript 化（`TranscriptingAiApprovalPolicy`, 286-315）を担い、host-state-store が永続化。
- **Escalate 条件**（§6）はいずれも発火不要:
  - package-format / authoring-core の挙動変更なし（read 側ヘルパーも新規追加なし。既存 `openAuthoringWorkspaceFromTextFileSet` / `createAuthoringWorkspaceSavePlan` / `hydrateAuthoringWorkspaceSessionBinaryAssets` / `getAuthoringSessionBinaryFileEntries` を消費するのみ、`package-directory-io.ts:1-16`）。両パッケージの git diff は空（条件付き write scope 未使用）。
  - 自動承認は ai-interface ライフサイクルと両立（確認項目 1）。
  - createEndsCenter 単独作成は動作（確認項目 4）。
  - バイナリアセット（`.raw-rgba` テクスチャ）の load/save が round-trip: `run-authoring-host-command.test.ts:41-80` が byte length 保存を検証。
- **CLI 終了コード**（§6 required implementation「成功/拒否/エラーを区別」）: `authoring-host-response.ts:35-44` で success=0 / rejected=2 / error=1。`cli-cross-process.test.ts` が exit 0 / exit 2 を実プロセスで検証。
- **fixtures**: test-support のフィクスチャは合成生成（`authoring-host-fixtures.ts` 参照、`ref/` 不使用）。§3.4 rights-clean 準拠。
- **決定論的クロック**: `run-authoring-host-command.ts:37,42` の `DEFAULT_HOST_TIMESTAMP` で now を固定でき、テストは `fixedNow`（2026-07-02T12:34:56）を注入。再現可能出力に寄与。

## テスト実行結果（独立再現）

- `pnpm run test:authoring-host`: 3 files / 8 tests 全 pass（cross-process 2 tests は実 spawn プロセス）。
- `npx vitest run packages/ai-interface`: 14 files / 88 tests 全 pass（dependency-boundary 5 tests, ai-auto-approval-policy 6 tests 含む）。
- `git diff HEAD -- pnpm-lock.yaml`: 空（lockfile 無変更）。
- `git diff HEAD -- packages/ai-interface/src/dependency-boundary.test.ts`: 空（境界テスト無変更）。

## Findings

| # | Severity | 内容 |
|---|---|---|
| F1 | info | `cli.ts:86-93` の `readStdinToString` はモジュールスコープに定義されエントリポイント（`:104-118`）でのみ使用。テストは `runAuthoringHostCli` に `readStdin` を注入するため未カバーだが、stdin 経路自体はコマンド入力 2 系統（--command-file / stdin）の一方であり、機能的欠落ではない。仕様準拠には無影響。修正不要。 |
| F2 | info | 自動承認判定 `evaluateAutoApproval` は `operationResult.status === "rejected"` を第一ゲートとする（`ai-auto-approval-policy.ts:115`）。executor は dry-run が rejected でも operationResult を返す（`ai-command-executor.ts:110-114`）ため、rejected とブロッキング診断で二重に承認阻止される（`run-authoring-host-command.test.ts:162-171` で reason:"operation-result-rejected" を確認）。冗長だが安全側。修正不要。 |
| F3 | info | ホスト側 `maybeAutoApproveDryRun`（`run-authoring-host-command.ts:120-123`）は `evaluateAutoApproval` を再評価する（executor 内では自動承認しないため）。承認の意思決定点がホストに集約され、ダイヤル（`--human-approval-op`）が効く正しい設計。記録のみ。 |

Blocking / major / needs_changes 相当の finding はなし。

## 質問（呼び出し元へ）

なし。§9 Domain A Spec Compliance の明示 5 項目・§3.1 Forbidden 追加確認はすべて証拠付きで確認でき、判断に迷う点はありませんでした。
