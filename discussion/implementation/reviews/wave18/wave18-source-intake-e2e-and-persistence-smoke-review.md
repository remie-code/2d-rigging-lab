# Wave 18 Domain F レビュー: Source Intake E2E And Persistence Smoke

## verdict

`pass`

Blocking findings: なし。

Domain F の対象差分は、mounted editor app の source intake submit を workflow commit に接続し、browser-level smoke で source intake -> create drawable -> generate mesh -> preview -> save/load を desktop / mobile で確認する目的を満たしている。

## review context separation evidence

- Role: Review-Sylph for `wave18-source-intake-e2e-and-persistence-smoke`
- Review-Sylph agent id: `019e78ff-c200-74d3-a412-984f9c239a7d` (`Sylph the 32nd`)
- 実装 agent id: `019e78f6-814b-7ca3-951e-4cd47bbada8f` (`Gnome the 31st`)
- 呼び出し元: Orch-Sylph
- 分離証跡: Gnome 実装担当とは別の Review-Sylph context で clean review を実施した。source implementation files / tests / fixtures は編集していない。書き込みはこの review report のみ。
- 実装報告だけでなく、basis docs、前段 Domain A-E completion/review、対象差分、対象ファイル、Orch-Sylph rerun verification、read-only spot checks を根拠にした。

## basis documents used

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave18-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/waves/wave17/wave17-final-report.md`
- `discussion/implementation/waves/wave18/wave18-split-png-import-operation-foundation-completion.md`
- `discussion/implementation/reviews/wave18/wave18-split-png-import-operation-foundation-review.md`
- `discussion/implementation/waves/wave18/wave18-asset-rights-provenance-validator-evidence-completion.md`
- `discussion/implementation/reviews/wave18/wave18-asset-rights-provenance-validator-evidence-review.md`
- `discussion/implementation/waves/wave18/wave18-editor-source-intake-draft-ui-state-completion.md`
- `discussion/implementation/reviews/wave18/wave18-editor-source-intake-draft-ui-state-review.md`
- `discussion/implementation/waves/wave18/wave18-editor-source-import-workflow-integration-completion.md`
- `discussion/implementation/reviews/wave18/wave18-editor-source-import-workflow-integration-review.md`
- `discussion/implementation/waves/wave18/wave18-imported-source-package-evidence-preview-consistency-completion.md`
- `discussion/implementation/reviews/wave18/wave18-imported-source-package-evidence-preview-consistency-review.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/implementation/waves/wave18/wave18-source-intake-e2e-and-persistence-smoke-completion.md`

## changed files reviewed

- `apps/editor/src/app/editor-app.ts`
- `apps/editor/e2e/source-intake-smoke.mjs`
- `apps/editor/e2e/smoke-checks.mjs`
- `apps/editor/e2e/mesh-vertex-smoke.mjs`
- `apps/editor/e2e/test-ids.mjs`
- `discussion/implementation/waves/wave18/wave18-source-intake-e2e-and-persistence-smoke-completion.md`

Reviewed with:

- `git status --short -uall apps/editor/src/app/editor-app.ts apps/editor/e2e discussion/implementation/waves/wave18/wave18-source-intake-e2e-and-persistence-smoke-completion.md`
- `git diff -- apps/editor/src/app/editor-app.ts apps/editor/e2e/smoke-checks.mjs apps/editor/e2e/mesh-vertex-smoke.mjs apps/editor/e2e/test-ids.mjs`
- direct reads of the new `apps/editor/e2e/source-intake-smoke.mjs` and completion report
- focused `rg` checks for app callback wiring, storage oracle fields, non-goal terms, test ids, and operation-count adjustments

## verification reviewed

Orch-Sylph supplied rerun results:

- `pnpm.cmd test:e2e`: pass。desktop/mobile smoke passed。
  - desktop preview screenshot `png base64Length=68004`
  - desktop drawable screenshot `png base64Length=85292`
  - mobile preview screenshot `png base64Length=39172`
  - mobile drawable screenshot `png base64Length=47264`
- `pnpm.cmd typecheck`: pass。Root + editor typecheck passed。
- `pnpm.cmd run check:source`: pass。Source organization guard passed。
- `git diff --check -- apps/editor/e2e apps/editor/tests fixtures/e2e apps/editor/src/app/editor-app.ts apps/editor/src/ui/source-assets apps/editor/src/ui/app-shell/app-shell.ts apps/editor/src/editor-state/editor-test-ids.ts apps/editor/src/styles discussion/implementation/waves/wave18/wave18-source-intake-e2e-and-persistence-smoke-completion.md`: pass。LF/CRLF warnings only。
- `rg -n "[ \t]+$" apps/editor/e2e/source-intake-smoke.mjs discussion/implementation/waves/wave18/wave18-source-intake-e2e-and-persistence-smoke-completion.md`: no matches。

Reviewer spot checks:

- `git diff --check -- <Domain F scope>` を再実行し、LF/CRLF warnings only で whitespace error なし。
- 新規 report / e2e helper の trailing whitespace check は `rg` exit 1 で no matches。
- `rg` で changed files 内の PNG decode / texture atlas / bitmap rendering / file picker / fetch 系を確認し、該当は metadata-only note と UI label のみだった。

Focused e2e / typecheck はこの Review-Sylph context では再実行していない。Orch-Sylph の rerun結果と対象差分の静的確認、diff check / whitespace check で判定した。

## findings

### Blocking

なし。

### Non-blocking

なし。

## lane assessment

### 1. Product Workflow / Persistence Review

`pass`.

- Domain D review で残っていた mounted app callback gap は解消されている。`onConfirmSourceIntakeDraft` が `workflow.commitSourceIntakeDraft(draft)` を呼び、commit 後の workflow draft を app-local draft へ戻して render している (`apps/editor/src/app/editor-app.ts:53`, `apps/editor/src/app/editor-app.ts:54`)。
- App shell に渡す state/view model は app-local `sourceIntakeDraft` を workflow state に重ねて projection しており、Domain C の draft UI semantics と Domain D の workflow state を破壊していない (`apps/editor/src/app/editor-app.ts:15`, `apps/editor/src/app/editor-app.ts:17`, `apps/editor/src/app/editor-app.ts:28`)。
- E2E helper は GUI form から manifest path、source asset/layer metadata、rights/provenance metadata を入力し、`importSplitPngSourceAsset committed`、operation log type、imported source row、drawable authoring default source selection を確認している (`apps/editor/e2e/source-intake-smoke.mjs:24`, `apps/editor/e2e/source-intake-smoke.mjs:39`, `apps/editor/e2e/source-intake-smoke.mjs:43`, `apps/editor/e2e/source-intake-smoke.mjs:55`, `apps/editor/e2e/source-intake-smoke.mjs:58`)。
- Storage oracle は `assets/sources/source-manifest.json`、`assets/provenance.json`、`assets/rights.json`、`model/drawables.json`、operation log JSONL を読み、source asset/layer、rights cleared/license、provenance creator/license/history、drawable `sourceAssetId`、import operation entry を確認している (`apps/editor/e2e/source-intake-smoke.mjs:79`, `apps/editor/e2e/source-intake-smoke.mjs:80`, `apps/editor/e2e/source-intake-smoke.mjs:81`, `apps/editor/e2e/source-intake-smoke.mjs:82`, `apps/editor/e2e/source-intake-smoke.mjs:83`, `apps/editor/e2e/source-intake-smoke.mjs:113`, `apps/editor/e2e/source-intake-smoke.mjs:116`, `apps/editor/e2e/source-intake-smoke.mjs:117`, `apps/editor/e2e/source-intake-smoke.mjs:121`, `apps/editor/e2e/source-intake-smoke.mjs:122`)。
- Load後は imported source row と `1 mapped drawable` を確認し、reset後は source intake summary/list が sample default へ戻ることを確認している (`apps/editor/e2e/source-intake-smoke.mjs:171`, `apps/editor/e2e/source-intake-smoke.mjs:179`, `apps/editor/e2e/source-intake-smoke.mjs:182`)。

### 2. Test Adequacy Review

`pass`.

- Main smoke sequence は source intake を AI approval 後、drawable authoring 前に入れ、existing generated drawable / mesh vertex / layer controls / save-load smoke を同じ desktop/mobile run で継続している (`apps/editor/e2e/smoke-checks.mjs:69`, `apps/editor/e2e/smoke-checks.mjs:75`, `apps/editor/e2e/smoke-checks.mjs:83`, `apps/editor/e2e/smoke-checks.mjs:89`, `apps/editor/e2e/smoke-checks.mjs:99`, `apps/editor/e2e/smoke-checks.mjs:107`)。
- Operation log count は source import 追加分を明示的に調整している。createDrawable smoke は expected count/type text を受け取り、mesh vertex smoke は initial count を受け取るようになった (`apps/editor/e2e/smoke-checks.mjs:76`, `apps/editor/e2e/smoke-checks.mjs:103`, `apps/editor/e2e/mesh-vertex-smoke.mjs:16`, `apps/editor/e2e/mesh-vertex-smoke.mjs:97`)。
- Save/load path は operation log line count 11、operation type text に `importSplitPngSourceAsset` を含めている (`apps/editor/e2e/smoke-checks.mjs:96`, `apps/editor/e2e/smoke-checks.mjs:103`, `apps/editor/e2e/smoke-checks.mjs:112`)。
- Source intake test ids は e2e helper 側に追加され、UI側 `editor-test-ids.ts` と一致している (`apps/editor/e2e/test-ids.mjs:14`, `apps/editor/e2e/test-ids.mjs:24`, `apps/editor/e2e/test-ids.mjs:68`, `apps/editor/e2e/test-ids.mjs:71`)。
- Storage oracle は required source/provenance/rights/drawable fields を確認しており、package全体の unrelated nested evidence には踏み込んでいない。`sourceDiagnostics` の exact check は current split-png fallback evidence として許容範囲と判断した。

### 3. UI / Accessibility Smoke Review

`pass`.

- Source Intake panel/form/submit の可視性と幅を viewport 内で確認している (`apps/editor/e2e/source-intake-smoke.mjs:187`, `apps/editor/e2e/source-intake-smoke.mjs:210`, `apps/editor/e2e/source-intake-smoke.mjs:226`)。
- Basic accessible names は heading、form `aria-label`、layer rows / imported source region labels、submit/add layer text、主要 input labels を確認している (`apps/editor/e2e/source-intake-smoke.mjs:242`, `apps/editor/e2e/source-intake-smoke.mjs:293`, `apps/editor/e2e/source-intake-smoke.mjs:297`)。
- Source intake / drawable / mesh / layer / loaded / reset の各段階で horizontal overflow を確認している (`apps/editor/e2e/smoke-checks.mjs:74`, `apps/editor/e2e/smoke-checks.mjs:80`, `apps/editor/e2e/smoke-checks.mjs:87`, `apps/editor/e2e/smoke-checks.mjs:94`, `apps/editor/e2e/smoke-checks.mjs:116`, `apps/editor/e2e/smoke-checks.mjs:119`)。
- Added scroll helper は target element を `scrollIntoView({ block: "center", inline: "nearest" })` するだけで、layout assertion 自体を無効化していない (`apps/editor/e2e/smoke-checks.mjs:868`)。

### 4. Non-goal Guard Review

`pass`.

- Changed files に PNG decode、texture atlas generation、actual texture rendering、file picker、network/file fetch の実装はない。`rg` hit は metadata-only note と label text のみ。
- `source-intake-smoke.mjs` の fixture note も `Metadata-only E2E source intake; PNG decode is not exercised.` と明示している (`apps/editor/e2e/source-intake-smoke.mjs:15`)。
- Domain F 対象差分は `apps/editor/e2e/**`、narrow `apps/editor/src/app/editor-app.ts` wiring、completion report に収まる。`packages/**`、`apps/editor/src/editor-session/**`、`apps/editor/src/editor-workflow/**` は Domain F 対象として編集されていない。
- `index.ts` は Domain F で編集されていない。新規 e2e helper は source intake smoke に責務分離され、catch-all production source file は増えていない。

## remaining risks / open verification items

- Accessibility coverage は smoke-level label/reachability/overflow check であり、完全な accessibility tree audit ではない。
- Persistence verification は browser localStorage save/load であり、OS filesystem / package archive import/export は future scope。
- Split PNG intake は metadata-only。Real PNG bytes、file picker、PNG decode、texture atlas generation、actual bitmap rendering は future scope。
- Load後 UI は imported source row の mapped drawable count まで確認している。specific drawable id relation は save前の storage oracle で確認済みだが、UI上の mapped drawable id 表示が追加された場合は load oracle を強化できる。

## user-decision points

なし。Domain F completion を妨げる user decision point はない。
