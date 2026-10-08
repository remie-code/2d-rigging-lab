# Wave104 Domain B — Spec Compliance Review

Verdict: pass (再検証で B-BLOCK-1 解消 — 下記「再検証」セクション参照。初回 verdict は needs_fix)

Reviewer: Review-Sylph (Spec Compliance lane, Domain B / Read Integration・Validate・Chores)
Date: 2026-07-03
Basis: `discussion/implementation/orchestration/wave104-plan.md` §7 / §10 (Domain B) / §3.1-2 / §3.7、Undine L0 裁定 2 件。

## 要約

Domain B のコード・テスト設計・スコープ遵守はいずれも健全である。承認ライフサイクルは差分レベルで無変更相当（readHost 配線のみ）であり、transcript の read 系記録・二重記録回避、validatePackage の report スキーマ適合、state-dir ガード、B-1 テスト、forbidden scope 非違反はすべて確認できた。ai-interface / render-software のテストも実測で全 pass。

ただし **Domain B の Required tests のうち authoring-host 側（validatePackage 2 系統・state-dir ガード）が `pnpm install` 未反映により suite ロード段階で失敗し、1 本も実行できていない**（blocking finding B-BLOCK-1）。テストの中身は的確だが「実証されていない」状態であり、Spec Compliance の要求（§10「既存テスト非退行を自分で実行して確認」「validatePackage の report が適合」「state-dir ガード」）を実行証跡で満たせない。これは §3.7「install は L0/ユーザー統制」に該当する環境操作であり、install 実行後の再検証で解消する見込みの blocking。

---

## 確認項目ごとの判定

### 1. 承認ライフサイクル・dry-run 強制の非緩和 — PASS

`git diff HEAD -- packages/ai-interface/src/ai-command-executor.ts` を精査。承認ライフサイクルの中核（`#executeDryRun` L168-194 / `#executeCommit` L196-238 / `TranscriptingAiApprovalPolicy` L399-438 / `hasCapability` gate / `checkCommitApproval`）に一切変更が入っていない。追加は次の 3 点のみ:

- `readHost?` optional 注入（`AiCommandExecutorOptions.readHost`、`#readHost` フィールド、コンストラクタ 1 行 L90）
- read 系 5 コマンドの `#executeReadCommand` ディスパッチ（L125-136。readHost 未設定時は従来の `#unsupportedReadCommand` へ fallback）
- `renderView` の capability gate `#executeRenderView`（L147-166、Domain A 分だが executor 共有ファイル）

dry-run/commit 経路の capability チェック（dryRunEdit / commitWithApproval）、承認ポリシー呼び出し、rejected 生成はすべて無変更。根拠: diff 全体が上記 3 追加に限定され、既存メソッド本文への変更行はゼロ。

### 2. transcript が read 系を記録し続ける（二重記録なし） — PASS（ただし実 host 経路の実証は B-BLOCK-1 に依存）

- executor は read ディスパッチ時に自身の transcript を `executeAiReadCommand(request, this.#readHost, this.#transcript)` へ渡す（`ai-command-executor.ts` L135）。`executeAiReadCommand` は末尾で `recordReadResponse` により 1 回だけ transcript 記録する（`ai-read-command.ts` L213-227）。executor 側では read 経路で追加記録しないため二重記録は構造的に発生しない。
- `packages/ai-interface/src/ai-executor-read-integration.test.ts` の "records read-command responses in the executor's transcript exactly once"（L127-148）が `toHaveLength(1)` で二重記録なしを実証。**このテストは実行済み・pass**（ai-interface 101 passed に含まれる）。
- 実 host（authoring-host）経路での transcript 永続化検証は `validate-package-command.test.ts` L122-142（`command-transcript.json` に `validatePackage` / commandId が含まれること）が担うが、これは B-BLOCK-1 により未実行。

### 3. validatePackage の report が validator-core スキーマに適合 — PASS（設計）／実行未証跡（B-BLOCK-1）

- `ValidatePackageResultSchema = { reportId: ValidationReportIdSchema, report: ValidationReportSchema }`（`ai-validation-command.ts` L14-17）。
- host 実装は `{ reportId: report.reportId, report }` を返す（`authoring-host-command-host.ts` validatePackage）。
- report は `buildValidationReport(...)` の産物（`validate-package-document.ts` L90-101）で `ValidationReportDto` 型。profile は payload の `ValidationProfileSchema` を通して `input.profile` として `buildValidationReport` に渡っている（L95）。packageRevision も payload override が通る（L92）。
- `executeAiReadCommand` は `ValidatePackageResultSchema.parse(...)`（`ai-read-command.ts` L176）で実行時スキーマ検証しており、非適合なら throw する。
- ドキュメント限定バリデータ 10 本を集約し、runtime 証拠がないことを `createDefaultEvidence()` で明示（L100、evidence.operationLogPresent=false / runtimeSnapshotIds=[]）。§7 の「document-only」方針に整合。
- スキーマ適合の設計は正しいが、実 host での pass/欠陥 report 生成は `validate-package-command.test.ts` / `validate-package-document.test.ts` が実証する予定であり B-BLOCK-1 で未実行。

### 4. state-dir ガード — PASS（設計）／実行未証跡（B-BLOCK-1）

- `state-directory-guard.ts` の `isStateDirectoryInsidePackageDirectory` は純関数・filesystem-free・決定論的。resolve→normalize→relative 比較で、同一/子孫を true、兄弟・prefix 共有（`/repo/pkg-state`）・親を false と正しく分類。Windows case-insensitive 対応済み。
- 二層配線を確認: (a) `cli-arguments.ts` L76-81 で parse 時に `AuthoringHostCliArgumentError` を throw、(b) `run-authoring-host-command.ts` L57-70 で direct entry 冒頭に `AuthoringHostStateDirectoryError`（stateStore 未指定時のみ = defense-in-depth）。
- テスト設計は純関数・CLI parse・direct entry・CLI exit code(1) の全層を網羅（`state-directory-guard.test.ts` 全体）。ただし B-BLOCK-1 で未実行。

### 5. 既存テスト非退行 — 部分的 PASS（ai-interface）／未検証（authoring-host、B-BLOCK-1）

- ai-interface: `npx vitest run packages/ai-interface` → **16 files / 101 passed**。承認ライフサイクル系（ai-codex-proposal-approval-lifecycle 6、ai-auto-approval-policy 6、ai-operation-command 11）、dependency-boundary 5、新規 ai-executor-read-integration 6 すべて pass。計画 §7 の「既存 88 テスト非退行」は満たす（Domain A 分の renderView スキーマテストが加わり 88→101 に増加、退行なし）。
- render-software: **8 files / 39 passed**（B-1 の 4 tests 含む）。
- authoring-host: `npx vitest run apps/authoring-host` → **8 files passed / 8 files FAILED（suite load error）**。Domain B の validate/state-dir テストを含む 8 suite が依存解決失敗で 0 実行。→ B-BLOCK-1。

### 6. スコープ遵守 — PASS

`git status --porcelain` および diff で確認:
- `packages/validator-core/src`: **完全無変更**（`git diff HEAD --stat` 空）。消費のみ。
- boundary テスト `packages/ai-interface/src/dependency-boundary.test.ts`: 無変更、かつ pass（5 tests）。boundary 非緩和。
- render-software: `out-of-range-triangle-index.test.ts` の**新規追加のみ**。描画コード（software-renderer.ts 等）無変更。B-1 = テスト追加のみを満たす。
- editor / player: 無変更。
- 新規外部依存: なし（追加は `render-core/render-software/runtime-core/validator-core` の `workspace:*` = ワークスペース内パッケージ宣言。うち Domain B が validate 実装に必要とするのは validator-core のみ。render-* / runtime-core は Domain A 分。「新規外部依存」には該当しない）。
- pnpm-lock.yaml: porcelain 未出現 = **無変更**。

補足: `apps/authoring-host/package.json` / `tsconfig.json` は Domain A の render-* / runtime-core と Domain B の validator-core を合わせて 4 パッケージ追加している（Undine 裁定2 の共有ファイル並行編集に該当。Domain A 分の品質は判定対象外）。

---

## Findings

### Blocking

- **B-BLOCK-1: Domain B の Required tests（validatePackage 2 系統・state-dir ガード）が実行不能・未実証。**
  - 事象: `npx vitest run apps/authoring-host/src/{state-directory-guard,validate-package-document,validate-package-command}.test.ts` が全 suite ロード失敗。エラー: `Cannot find package '@private-2d-rigging-lab/validator-core' imported from .../validate-package-document.ts`。
  - 原因: `apps/authoring-host/package.json` に `validator-core`（および Domain A 分の render-*/runtime-core）を `workspace:*` で追加済みだが `pnpm install` が未実行のため、`apps/authoring-host/node_modules/@private-2d-rigging-lab/` に該当リンクが張られておらず（現状は ai-interface/authoring-core/contracts/operation-core/package-format の 5 つのみ）、vitest（Vite 実行時解決）が node_modules を解決できない。
  - 影響: §10 Domain B の明示確認項目のうち「validatePackage の report 適合（実 host）」「state-dir ガード reject」「承認ライフサイクル/transcript の実 host 非退行」を**実行証跡で確認できない**。テストの中身は的確（下記参照）だが未実証。
  - 位置づけ: package.json の記述自体は正しい `workspace:*` 形式であり、`pnpm install` を実行すれば node_modules リンク生成・lockfile 更新で解消する見込み。これは §3.7「install 等の環境操作は L0/ユーザー統制」に該当し、Gnome は install できないため escalate すべきだった事項。Undine 裁定1（typecheck exit 2 を blocking にしない）は typecheck の話であり、vitest 実行時解決失敗＝テスト 0 実行は別問題のため裁定1では免責されない。
  - 是正: L0/ユーザーによる `pnpm install` 実行 → `npx vitest run apps/authoring-host` 再実行で Domain B テスト（validate 2 系統・state-dir 全層）が pass することを再検証。install 後に lockfile が変わる点は下記「質問」で L0 判断を仰ぐ。

### Non-blocking

- なし（テスト設計・コード品質に品質上の指摘なし）。B-1 は 4 ケース網羅かつ vacuous-pass 回避の sanity assert 込みで実測 pass。integration テストは capability/not_implemented/ok/fallback/二重記録の全意味論を実挙動で検証しオウム返しでない。

---

## テスト内容の妥当性（実行できたもの・設計確認したもの）

- 実行 pass: `ai-executor-read-integration.test.ts`（6）= validatePackage ok / host 未実装 not_implemented / getOperationLog not_implemented / capability 不足 permission_denied / transcript exactly once / readHost 未設定 legacy fallback。`out-of-range-triangle-index.test.ts`（4）。
- 設計確認（未実行だが妥当）: `validate-package-command.test.ts`（healthy report・副作用なし saved=false・permission_denied・transcript 永続化）、`validate-package-document.test.ts`、`state-directory-guard.test.ts`（純関数6 + CLI parse3 + direct entry1 + exit code1）。

---

## 質問（Orch-Sylph 宛て）

1. **install 実行と lockfile 変更の扱い**: Domain B テスト実証には `apps/authoring-host` の依存追加を反映する `pnpm install` が必須。これは §3.7 で L0/ユーザー統制。install に伴う `pnpm-lock.yaml` 更新は §7 forbidden の「lockfile 変更」に文言上抵触するが、ワークスペース内パッケージ依存追加に伴う不可避な更新であり「新規外部依存の持ち込み」ではない。この lockfile 更新を許容し install を実行してよいか、L0 裁定を仰ぎたい。install 後に本レーンの blocking を解消するため authoring-host テスト再実行の再委任を要する。
2. Gnome 申告「authoring-host 26 passed」との差異: 現行作業ツリー + 未 install 環境では authoring-host の Domain B テストは 0 実行（suite load fail）。Gnome が別環境（install 済み）で測定した可能性がある。再検証は install 後の同一環境で行う必要がある。

## レポートパス

`discussion/implementation/reviews/wave104/wave104-domain-b-spec-compliance-review.md`

---

## 再検証（Re-verification）

Reviewer: Review-Sylph (Spec Compliance lane, Domain B / 狭い再検証)
Date: 2026-07-03
Scope: **B-BLOCK-1 の解消確認のみ**（全面再レビューではない）。呼び出し元 Orch-Sylph の狭い再委任。
前提: 初回質問1・質問2 は L0（Undine）が統制下で `pnpm install` を実行して解消済み。lockfile 更新は workspace importer 登録のみ（Wave103 と同じ承認済み分類）。本再検証では環境操作（install 等）は一切行っていない。

### 再実行結果（install 済み現環境で Review-Sylph 自身が実測）

- **`npx vitest run --root apps/authoring-host` → 9 files / 37 tests 全 pass。**
  - 初回に suite ロード失敗（0 実行）だった Domain B の Required tests が全て load・実行・pass に転じたことを確認:
    - `src/validate-package-document.test.ts` — **3 passed**（validatePackage の report 生成: 健全パッケージ report / 欠陥フィクスチャ検出を含む document-only バリデータ層）。
    - `src/validate-package-command.test.ts` — **4 passed**（実 host 経路: healthy report / 副作用なし saved=false / permission_denied / transcript 永続化 `command-transcript.json` に validatePackage・commandId 記録。初回に B-BLOCK-1 依存として保留した「transcript 永続化」「report スキーマ適合（実 host の実行時 `ValidatePackageResultSchema.parse` 通過）」の実行証跡を取得）。
    - `src/state-directory-guard.test.ts` — **11 passed**（純関数分類・CLI parse reject・direct entry reject・CLI exit code(1) の state-dir ガード全層。初回に保留した「state-dir reject」の実行証跡を取得）。
  - 併せて既存の CLI validate 到達・承認ライフサイクル系（`cli-cross-process.test.ts` 2、`run-authoring-host-command.test.ts` 5 等）も同一環境で pass し、実 host 非退行を実行証跡で確認。
- **`npx vitest run packages/ai-interface` → 16 files / 101 passed**（非退行の再確認。初回 verdict 本文の実測と同数、退行なし。委任プロンプト記載の「94 passed」より多いが、これは初回レポート実測 101 と一致しており、read-integration 追加後の正規値。退行は検出されず）。

### lockfile diff 分類確認

`git diff pnpm-lock.yaml`: **12 行追加のみ、外部依存の新規解決追加ゼロ。** 追加は全て `apps/authoring-host` importer への workspace link 登録:

- `@private-2d-rigging-lab/render-core` → `version: link:../../packages/render-core`
- `@private-2d-rigging-lab/render-software` → `version: link:../../packages/render-software`
- `@private-2d-rigging-lab/runtime-core` → `version: link:../../packages/runtime-core`
- `@private-2d-rigging-lab/validator-core` → `version: link:../../packages/validator-core`

いずれも `specifier: workspace:*` / `version: link:...` のワークスペース内リンク解決であり、外部レジストリからの新規パッケージ解決（`packages:` セクションへの追加・新規 npm 依存）は一切含まれない。初回質問1 で懸念した「lockfile 変更」は「新規外部依存の持ち込み」に該当せず、承認済み分類どおり。

### 判定

**B-BLOCK-1 は解消。** 初回に「実証されていない」とした Domain B の Required tests（validatePackage 2 系統・state-dir ガード全層・実 host の transcript 永続化 / report スキーマ適合 / state-dir reject）が、install 済み環境で全て load・実行・pass することを Review-Sylph 自身が実測で確認した。コード欠陥は初回・再検証とも未検出。Non-blocking 指摘なし。よって本レーンの verdict を **needs_fix → pass** に更新する。
