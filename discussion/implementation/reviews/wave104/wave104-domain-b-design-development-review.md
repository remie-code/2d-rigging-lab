# Wave104 Domain B — Design / Development Review

- Wave: Wave104
- Domain: B (`wave104-read-integration-validate-chores`)
- Review lane: Design / Development
- Reviewer: Review-Sylph (opus)
- Date: 2026-07-03
- Verdict: **pass**（初回 needs_fix → 2026-07-03 install 後の再検証で B-DEV-BLOCK-01 解消を確認し pass に更新。経緯は末尾「再検証（2026-07-03）」セクション参照。）

## Verdict summary

Domain B の**コードそのものの設計・実装品質は高く、L0 裁定・規約に整合している**。ただし
`apps/authoring-host` に追加された workspace 依存（特に Domain B が正当に必要とする
`validator-core`）の **lockfile 同期 / `node_modules` リンク生成（`pnpm install`）が未実行**であり、
その結果 Domain B のフィクスチャ実行テスト 3 本（`validate-package-document.test.ts` /
`validate-package-command.test.ts` / `state-directory-guard.test.ts`）が **モジュール解決エラーで
1 件も実行できない**。これは Gnome の禁止操作（`pnpm install`）で L0/ユーザー統制の環境操作に該当する
ため、Gnome のコード修正では解けず、**L0 での install 実行が blocking の解消条件**である。

判定基準（root `npx tsc --noEmit` exit 0 + Domain B 所有ファイルの型健全性）は満たしている
（tsc exit 0）。しかし §7 / §10 が求める validate 系・state-dir ガードのテスト green が
実機で確認できていないため、コード品質を pass としつつ **wave 統合ゲート上は needs_fix**（install 後の
再検証必須）とする。

## Findings

### BLOCKING

- **B-DEV-BLOCK-01: `pnpm install` 未実行により Domain B の実行テストが 0 件実行**
  - `apps/authoring-host/package.json` に `render-core` / `render-software` / `runtime-core` /
    `validator-core`（すべて `workspace:*`）が追加されているが、`pnpm-lock.yaml` の
    `apps/authoring-host:` セクション（line 27〜）にはこの 4 依存が反映されておらず、
    `apps/authoring-host/node_modules/@private-2d-rigging-lab/` にも
    `validator-core` 等のシンボリックリンクが存在しない（`ai-interface` / `authoring-core` /
    `contracts` / `operation-core` / `package-format` の 5 本のみ）。
  - 帰結: vitest（vite の node_modules 解決）が
    `validate-package-document.ts:3` の `import { ... } from "@private-2d-rigging-lab/validator-core"`
    を解決できず、`state-directory-guard.test.ts` / `validate-package-command.test.ts` /
    `validate-package-document.test.ts` の 3 スイートが suite-load 段階で FAIL する
    （`Cannot find package '@private-2d-rigging-lab/validator-core'`）。テストは 1 件も実行されない。
  - 分類: これは **Domain B のコード欠陥ではなく環境未整備**。追加された 4 依存はすべて内部 workspace
    パッケージであり、新規外部依存でも Cubism/バイナリでもない（dependency-policy の forbidden 非該当）。
    `pnpm install` を実行すれば lockfile が同期され `node_modules` リンクが張られ、テストは解決可能になる見込み。
  - 解消条件（L0 / ユーザー）: `pnpm install` を実行して lockfile を同期し node_modules を張り、
    `npx vitest run apps/authoring-host/src/{state-directory-guard,validate-package-document,validate-package-command}.test.ts`
    が green であることを確認する。Gnome のコード修正では解けない（install は禁止操作）。
  - なお同一の install ギャップは Domain A の render-view 系テスト（`perception/*` /
    `run-render-view-command.test.ts`。render-software/render-core 依存）にも波及する。install は
    Domain A/B 両方をまとめて解消するため、統合フェーズ（Domain D）または L0 で一括実行するのが妥当。

### NON-BLOCKING（設計・品質メモ）

- **B-DEV-N-01（提案 / non-blocking）: `cli-arguments.ts` の import 文位置**
  - `apps/authoring-host/src/cli-arguments.ts` で `interface AuthoringHostCliArguments`（1–7 行）
    の宣言後、9 行目に `import { isStateDirectoryInsidePackageDirectory } from "./state-directory-guard.js";`
    が置かれている。ESM/TS 的には hoist されるため動作は正しく tsc も通るが、他ファイル（executor.ts /
    ai-read-command.ts 等）では import を先頭に集約する慣例。可読性のため先頭ブロックへ移動を推奨。blocking ではない。

- **B-DEV-N-02（記録のみ）: executor 内 `renderViewNotImplementedPayload` の重複定義感**
  - `ai-command-executor.ts` で `#executeRenderView` の permission_denied 分岐と
    `unsupportedReadPayload` の `renderView` ケースの両方が `renderViewNotImplementedPayload` を呼ぶ形は
    DRY で妥当。renderView の executor 統合は L0 裁定 3 に沿い（capability gate のみ・実処理は host）、
    ai-interface に renderer 依存を足していない。これは **Domain A 所有の変更**（共有ファイル）であり
    Domain B 判定対象外だが、read 統合と同じファイルに共存するため整合を確認した。問題なし。

## 観点別判定

### 1. 設計の妥当性

- **executor への read host 統合**: PASS。
  - `AiCommandExecutorOptions.readHost?`（`ai-command-executor.ts:74`）は optional 注入で、
    JSDoc が「未注入時は legacy not_implemented にフォールバック」「PSD import plan 系はここを通さず常に
    not_implemented」と明示。`#executeReadCommand`（:125）は readHost 未注入時に `#unsupportedReadCommand`、
    注入時は `executeAiReadCommand(request, this.#readHost, this.#transcript)` に委譲。
  - **L0 裁定 2 の「再実装しない」を厳守**: executor は `executeAiReadCommand` を import して呼ぶだけで、
    capability チェック・ok/not_implemented/permission_denied 解決・transcript 記録はすべて
    `ai-read-command.ts` 側に一元化。executor 側で重複していない
    （`ai-executor-read-integration.test.ts` の「transcript に一回だけ記録」テストが二重記録の不在を保証）。
  - **read host 未注入時の一貫性**: PASS。未注入時は既存の `unsupportedReadPayload` を用いた
    command-matching な not_implemented を返し、後方互換を保つ
    （`ai-executor-read-integration.test.ts:150` の legacy fallback テストで検証）。
  - **PSD import plan 系 4 コマンドの扱い**: 妥当。`execute()`（:117-121）で PSD 系は
    `#unsupportedReadCommand` に直行し readHost を経由しない。`DispatchableReadCommandRequest`
    型（:31-41）が dispatch 対象 5 コマンドを型で限定し、PSD 系は含めない。設計意図が型で表現されている。

- **`AiReadCommandHost` の optional 化**: PASS。
  - `ai-read-command.ts:31-45` で全 read メソッドを optional に変更し、JSDoc で「メソッド未実装の host は
    そのコマンドが not_implemented に解決される」と明示。`executeAiReadCommand` 内で各コマンドの
    `host.xxx === undefined` チェックを追加（getEditorState :110 / getOperationLog :191。inspect* /
    validatePackage は既に optional だった）。これにより headless authoring-host が validatePackage のみ
    実装し他を未実装のままにできる（`AuthoringHostCommandHost implements AiReadCommandHost` で
    validatePackage のみ提供）。設計として一貫。

- **validatePackage の session→document 橋渡し**: PASS。
  - `validate-package-document.ts` は `package-format`（型のみ）/ `contracts`（型のみ）/
    `validator-core`（公開バリデータ群 + `buildValidationReport` + `createDefaultEvidence`）の
    **公開 API のみに依存**。editor 専用ロジック（canvas-evaluation / draft 系）への依存なし。
  - **disk 書き込みの副作用なし**: `validatePackageDocument` は純関数で、入力の `PackageDocumentDto` を
    受け取りバリデータを回して `ValidationReportDto` を返すだけ。fs import なし。document は
    `run-authoring-host-command.ts` で `loaded.packageDocument`（load 時の document）から取得され、
    validate は dry-run/commit しないためこれが現在の session graph と同一
    （`AuthoringHostCommandHostOptions.packageDocument` の JSDoc で明示）。
    `validate-package-command.test.ts` の before/after snapshot 一致・`saved===false` テストで
    副作用ゼロを実証。
  - **バリデータ選定（document-only 10 本）の根拠**: 妥当かつ正直。
    `validatePackageDocument` の JSDoc（:41-62）が「document から導出可能な診断のみ」と明記し、
    schema conformance / drawable refs / texture refs / mesh / mask / rigControl / part-layer /
    dynamics / drawable provenance / source-asset rights の 10 本を列挙。runtime snapshot / GUI
    operation log を要するバリデータ（runtime-load / viewer-evidence / binary-asset byte /
    PSD intake / product-preflight）を**意図的に除外**し、`createDefaultEvidence()` で
    「runtime snapshot / operation log がこの report を裏付けていない」ことを evidence ブロックに
    明示記録（"passed" と誤認させない）。runtime 証拠を要するバリデータの除外が正直に表現されている。
  - schema parse 失敗時のガード（:74-88。`schemaResult.packageDocument === undefined` の時に構造バリデータを
    走らせない）も、malformed 入力での spurious throw を避ける妥当な設計。

- **state-dir ガード**: PASS。
  - `state-directory-guard.ts` は純関数 `isStateDirectoryInsidePackageDirectory` で fs アクセスなし
    （`node:path` の resolve/relative/sep のみ）。
  - **二層検査**: CLI 層（`cli-arguments.ts:76` で parse 時に reject → `AuthoringHostCliArgumentError`）と
    direct entry 層（`run-authoring-host-command.ts:57` で load 前に reject →
    `AuthoringHostStateDirectoryError`）。JSDoc が「defense-in-depth」と明示。custom stateStore 注入時は
    exempt（自前でロケーション管理）という例外も妥当。
  - **パス正規化の正しさ**: PASS。等価判定（resolve 後の正規化パス一致）+ `relative()` による包含判定。
    Windows は `toLowerCase()` で大小文字非依存化（`C:\Pkg` と `c:\pkg\state` を nested と認識）。
    異ドライブは `relative()` が絶対パスを返すため `isAbsoluteLike`（sep 始まり or `X:[\\/]` 正規表現）で弾く。
    `..` エスケープ・`..${sep}` 始まりも弾く。**接頭辞共有の false positive を回避**
    （`/repo/pkg` に対し `/repo/pkg-state` を nested としない。テスト :30 で明示検証）。
    シンボリックリンクは filesystem-free 設計のため辿らないが、これは決定論性を優先した妥当な割り切り
    （JSDoc も "deterministic and filesystem-free" と明記）で過剰な false positive を生まない。

### 2. コード品質

- PASS。型安全性: `any` の濫用なし。`validate-package-command.test.ts` のペイロードキャストは
  テストコードのアサーション用で許容範囲。zod parse は既存慣例どおり（`ValidationReportSchema.parse` /
  `ValidatePackageResultSchema.parse` を経由）。
- 命名: `AUTHORING_HOST_VALIDATOR_VERSION` / `isStateDirectoryInsidePackageDirectory` /
  `AuthoringHostStateDirectoryError` は責務が明快。schema-and-id-conventions のマシン ID にスペースなし。
- 既存慣例との一貫性: private フィールド `#`（`#packageDocument` / `#readHost`）、`readonly`、
  optional exactOptionalPropertyType 対応の `...(x === undefined ? {} : { x })` パターンを踏襲。
- 重複・dead code: なし。`renderViewNotImplementedPayload` の再利用は DRY（B-DEV-N-02 参照。Domain A 所有）。

### 3. 規約遵守

- **source-file-organization-policy**: PASS。新規ファイルは責務単位で分割
  （`state-directory-guard.ts` = パスガード純関数、`validate-package-document.ts` = validate オーケストレーション）。
  テストは隣接配置（`.test.ts` が対象ファイルと同ディレクトリ）。`index.ts` 変更は barrel re-export 1 行の追加のみ
  （`export * from "./ai-render-view-command.js"` — これは Domain A の renderView スキーマ用で、
  ai-interface の `dependency-boundary.test.ts` の barrel-only チェックも pass）。catch-all ファイルなし。
- **dependency-policy**: PASS（コード観点）。ただし B-DEV-BLOCK-01 のとおり lockfile 同期が未了。
  - ai-interface の boundary allowlist は**非拡大**: `dependency-boundary.test.ts:33-39` は依然
    `contracts / operation-core / runtime-core / validator-core / zod` の 5 本のみを期待し、この test は
    無変更で pass（render-core / render-software は含まれない）。L0 裁定 3 を厳守。
  - `apps/authoring-host` への `validator-core` 追加は Domain B の allowed scope（validator-core 消費）に
    必要な正当な追加で、内部 workspace 依存（`workspace:*`）。外部依存・バイナリ・Cubism ではないため
    dependency-policy の forbidden 非該当。ただし lockfile 反映は install 待ち（BLOCK-01）。
- **schema-and-id-conventions**: PASS。新規スキーマの ID/命名はスペースなし。validatePackage は
  既存の `ValidatePackageResultSchema` / `ValidationReportSchema` を消費し、独自の外部 DTO を新設しない。
  `AUTHORING_HOST_VALIDATOR_VERSION = "authoring-host-validate-package-v1"` は versioned kebab で妥当。

### 4. render-software の変更がテスト追加のみか

- PASS。`packages/render-software/src/raster/out-of-range-triangle-index.test.ts` は**新規テストのみ**。
  production source（software-renderer.ts 等）への変更なし。既存 test-support の慣例に沿う
  （`createScene` / `createSolidTexture` を `../test-support/scene-fixtures.js` から利用、
  `renderSceneToRgba8` 公開 API を消費）。vacuous pass 回避のサニティチェック（valid triangle が実際に
  描画することを確認してから equality を検証）も入っており品質が高い。4 テストとも green。

## 検証実行結果

- `npx tsc --noEmit`（root）: **exit 0**（L0 裁定 1 の Domain B 判定基準を満たす）。
- `npx vitest run packages/ai-interface`: **105 passed / 17 files**（既存 88 → 105。承認ライフサイクル
  `ai-codex-proposal-approval-lifecycle` / `ai-operation-command` 含め非退行。新規
  `ai-executor-read-integration.test.ts` 6 件 green）。
- `packages/render-software/.../out-of-range-triangle-index.test.ts`: **4 passed**。
- `apps/authoring-host` の Domain B 3 スイート
  （`state-directory-guard` / `validate-package-document` / `validate-package-command`）:
  **suite-load FAIL（0 実行）** — `Cannot find package '@private-2d-rigging-lab/validator-core'`。
  原因は B-DEV-BLOCK-01（install 未実行）。コード欠陥ではない。

## 質問（L0 / 呼び出し元へ）

1. **install 実行の統制**: B-DEV-BLOCK-01 の解消には `pnpm install`（L0/ユーザー統制の環境操作）が必要。
   Domain A の render-view 依存（render-core / render-software / runtime-core）も同じ install で解消するため、
   Domain B 単独ではなく**統合フェーズ（Domain D）または L0 で一括 install → 全 focused テスト再実行**を
   想定してよいか。その場合、Domain B のコード判定は「install 後に validate 系 3 スイートが green」を
   確認できた時点で pass に確定できる（現時点のコード読了・設計レビューでは欠陥を検出していない）。
2. install 後、`node scripts/check-dependencies.mjs` / `node scripts/check-source-organization.mjs` /
   `git diff --check` の実行と lockfile 差分（内部 workspace link のみであること）の確認は Domain D の管轄と理解しているが相違ないか。

## 再検証（2026-07-03 / Review-Sylph 狭い再検証）

- スコープ: **B-DEV-BLOCK-01 の解消確認のみ**（全面再レビューではない）。L0（Undine）統制下で `pnpm install` 実行済みの現環境で再実行。non-blocking findings（B-DEV-N-01 / B-DEV-N-02）は non-blocking のまま維持。
- 前提: install による lockfile 更新は workspace importer 登録のみ・新規外部依存ゼロ（Wave103 と同じ承認済み分類）。この分類を Review-Sylph が自分の目で再確認した（下記 lockfile / package.json 分類）。

### 再実行コマンドと実測結果

- `npx vitest run --root apps/authoring-host`: **9 files / 37 tests 全 pass**（Duration 9.65s）。初回 suite-load FAIL（0 実行）だった Domain B の 3 スイートが全て実行・green:
  - `src/validate-package-document.test.ts` — **3 tests pass**
  - `src/state-directory-guard.test.ts` — **11 tests pass**
  - `src/validate-package-command.test.ts` — **4 tests pass**
  - 併せて `run-render-view-command` / `perception/*` 等の既存スイートも全 pass（非退行）。初回レポートが blocking の原因とした `Cannot find package '@private-2d-rigging-lab/validator-core'` は再現せず、モジュール解決が成立している。
- `npx tsc --noEmit`（root）: **exit 0**（L0 裁定 1 の Domain B 判定基準を install 後も維持）。

### dependency-policy 観点の残確認（自分の目で分類）

- `git diff pnpm-lock.yaml`: **単一 hunk（`importers:` セクション、line 41 付近）で 12 行の追加のみ・削除ゼロ**（`git diff --stat` = `1 file changed, 12 insertions(+)`）。追加内容は `apps/authoring-host` importer への 4 エントリ（`render-core` / `render-software` / `runtime-core` / `validator-core`）で、各 `version` はいずれも `link:../../packages/*`（workspace ローカルパッケージへのリンク解決）。`packages:` / `snapshots:` セクション（外部依存の実体定義）への変更は皆無。**新規外部依存ゼロ・workspace importer / link 解決のみ**であることを確認。dependency-policy の forbidden 非該当。
- `git diff apps/authoring-host/package.json`: 追加は `render-core` / `render-software` / `runtime-core` / `validator-core` の 4 本で、**すべて `workspace:*` の内部依存のみ**。外部依存・バイナリ・Cubism ではない。Domain B が正当に必要とする `validator-core` を含む allowed scope 内の追加。

### 再検証判定

- **B-DEV-BLOCK-01: 解消（resolved）**。install 済み環境で Domain B の validate 系・state-dir ガードのテストが実機 green となり、初回 needs_fix の唯一の blocking 根拠が消滅。コード観点（設計・品質・規約）は初回レビューで blocking なしと確定済み。
- したがって冒頭 `Verdict:` を **needs_fix → pass** に更新。non-blocking の B-DEV-N-01（`cli-arguments.ts` の import 位置）/ B-DEV-N-02（記録のみ）は non-blocking のまま残置。
