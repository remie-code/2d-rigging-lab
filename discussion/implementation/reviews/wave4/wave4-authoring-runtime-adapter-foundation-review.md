# Wave 4 Domain A Review: authoring runtime adapter foundation

> Domain: `wave4-authoring-runtime-adapter-foundation`  
> Review role: Review-Sylph / clean context review  
> Review date: 2026-05-29  
> Verdict: `pass`

## Scope Reviewed

- `packages/authoring-core/package.json`
- `packages/authoring-core/src/**`
- `packages/runtime-core/src/**` の public target shape / import boundary
- `discussion/implementation/waves/wave4/wave4-authoring-runtime-adapter-foundation-completion.md`

Production source は編集していない。書き込みはこの review report のみ。

## Basis Used

- `discussion/implementation/orchestration/wave4-plan.md`
- `discussion/implementation/waves/wave3/wave3-final-report.md`
- `discussion/design/module-contracts/module-boundaries.md`
- `discussion/design/module-contracts/runtime-core-contract.md`
- `discussion/design/module-contracts/package-file-format-contract.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/implementation/waves/wave4/wave4-authoring-runtime-adapter-foundation-completion.md`

## Findings

### Blocking

なし。

### Major

なし。

### Minor

なし。

## Compliance Review

- Adapter conversion: `toRuntimeGraph(session)` は `AuthoringSession` の `packageIdentity.packageId` / `packageRevision` と `graph` を使い、`toRuntimeGraphFromAuthoringGraph` 経由で `NormalizedRuntimeGraph` を生成している。主要 collection は responsibility 別 helper に分離されている。参照: `packages/authoring-core/src/to-runtime-graph.ts:21`, `packages/authoring-core/src/to-runtime-graph.ts:31`, `packages/authoring-core/src/to-runtime-graph.ts:39`
- Runtime graph contents: parameters / dynamicsGroups / drawables / rigControls / keyformBindings / masks / drawOrder が runtime-core の public shape に合う形で渡される。参照: `packages/authoring-core/src/runtime-graph-parameters.ts:5`, `packages/authoring-core/src/runtime-graph-drawables.ts:8`, `packages/authoring-core/src/runtime-graph-drawables.ts:37`, `packages/authoring-core/src/runtime-graph-dynamics.ts:9`, `packages/authoring-core/src/runtime-graph-rig-controls.ts:8`, `packages/authoring-core/src/runtime-graph-keyforms.ts:6`
- Dependency boundary: `authoring-core -> runtime-core` は adapter 関連ファイルと adapter test に限定されている。`authoring-core` から `operation-core` / `validator-core` への import は検索・test ともに検出なし。`runtime-core` から `authoring-core` への import も検出なし。
- Narrow dependency justification: `packages/authoring-core/package.json:12` に `@private-2d-rigging-lab/runtime-core` の workspace dependency が追加されている。これは Wave4 plan の Domain A 方針と一致する。
- `index.ts`: `packages/authoring-core/src/index.ts:1` から `:13` は re-export のみで、実装ロジックはない。
- Source organization: adapter logic は `to-runtime-graph.ts` と `runtime-graph-*` helper に分割され、catch-all file は追加されていない。`pnpm.cmd check:source` も pass。
- Editor-only state: `selection` / `locked` / `editorHidden` / `activeTool` / `viewport` / DOM 系の runtime graph 混入は検索上見つからない。`canvasSize` は authoring graph の model geometry metadata として残っているが、adapter は `NormalizedRuntimeGraph` へ渡していない。

## Test Adequacy Review

- Minimal package/session conversion: `runtime-graph-adapter.test.ts` は `minimal-valid-package` を `parsePackageDocument` し、`createAuthoringSessionFromPackageDocument` から `toRuntimeGraph` を実行している。参照: `packages/authoring-core/src/runtime-graph-adapter.test.ts:35`, `packages/authoring-core/src/runtime-graph-adapter.test.ts:239`
- Identity / revision / parameters / drawables / draw order: package ID、revision、parameter、drawable、draw order の assertion がある。参照: `packages/authoring-core/src/runtime-graph-adapter.test.ts:40`, `packages/authoring-core/src/runtime-graph-adapter.test.ts:46`, `packages/authoring-core/src/runtime-graph-adapter.test.ts:53`, `packages/authoring-core/src/runtime-graph-adapter.test.ts:63`
- Runtime-core API compatibility: adapter が作った graph を `createInitialRuntimeState` と `evaluateRuntimeFrame` に渡し、snapshot の drawList / parameters を検証している。参照: `packages/authoring-core/src/runtime-graph-adapter.test.ts:65`, `packages/authoring-core/src/runtime-graph-adapter.test.ts:70`, `packages/authoring-core/src/runtime-graph-adapter.test.ts:85`
- Additional DTO-backed collections: dynamics / keyforms / rig controls / masks は graph 直指定の test で変換を検証している。参照: `packages/authoring-core/src/runtime-graph-adapter.test.ts:116`, `packages/authoring-core/src/runtime-graph-adapter.test.ts:146`, `packages/authoring-core/src/runtime-graph-adapter.test.ts:162`, `packages/authoring-core/src/runtime-graph-adapter.test.ts:177`
- Boundary guard: `dependency-boundary.test.ts` は `operation-core` / `validator-core` を禁止し、`runtime-core` import を adapter 関連ファイルと adapter test のみに allowlist している。参照: `packages/authoring-core/src/dependency-boundary.test.ts:11`, `packages/authoring-core/src/dependency-boundary.test.ts:19`, `packages/authoring-core/src/dependency-boundary.test.ts:20`, `packages/authoring-core/src/dependency-boundary.test.ts:37`

## Verification Performed

| Command | Outcome |
|---|---|
| `Get-Content -Encoding UTF8 discussion/implementation/orchestration/wave4-plan.md` | pass。basis を確認。 |
| `Get-Content -Encoding UTF8 discussion/implementation/waves/wave3/wave3-final-report.md` | pass。Wave3 gate / remaining issues を確認。 |
| `Get-Content -Encoding UTF8 discussion/design/module-contracts/module-boundaries.md` | pass。module dependency / forbidden state を確認。 |
| `Get-Content -Encoding UTF8 discussion/design/module-contracts/runtime-core-contract.md` | pass。`NormalizedRuntimeGraph` と runtime API shape を確認。 |
| `Get-Content -Encoding UTF8 discussion/design/module-contracts/package-file-format-contract.md` | pass。package DTO / draw order / editor-state boundary を確認。 |
| `Get-Content -Encoding UTF8 discussion/development_convention/source-file-organization-policy.md` | pass。source organization rules を確認。 |
| `Get-Content -Encoding UTF8 discussion/implementation/waves/wave4/wave4-authoring-runtime-adapter-foundation-completion.md` | pass。実装者 report を確認。 |
| `rg --files packages/authoring-core/src` | pass。対象 source inventory を確認。 |
| `rg --files packages/runtime-core/src` | pass。runtime-core public target files を確認。 |
| `Get-Content -Encoding UTF8 packages/authoring-core/package.json` | pass。runtime-core dependency を確認。 |
| `git status --short -uall packages/authoring-core discussion/implementation/waves/wave4/wave4-authoring-runtime-adapter-foundation-completion.md discussion/implementation/reviews/wave4` | pass。対象差分と review report 未作成状態を確認。 |
| `Get-Content -Encoding UTF8 packages/authoring-core/src/to-runtime-graph.ts` | pass。adapter entry を確認。 |
| `Get-Content -Encoding UTF8 packages/authoring-core/src/runtime-graph-parameters.ts` | pass。parameter mapping を確認。 |
| `Get-Content -Encoding UTF8 packages/authoring-core/src/runtime-graph-drawables.ts` | pass。drawable / draw order mapping を確認。 |
| `Get-Content -Encoding UTF8 packages/authoring-core/src/runtime-graph-dynamics.ts` | pass。dynamics mapping を確認。 |
| `Get-Content -Encoding UTF8 packages/authoring-core/src/runtime-graph-rig-controls.ts` | pass。rig control mapping を確認。 |
| `Get-Content -Encoding UTF8 packages/authoring-core/src/runtime-graph-keyforms.ts` | pass。keyform mapping を確認。 |
| `Get-Content -Encoding UTF8 packages/authoring-core/src/runtime-graph-adapter.test.ts` | pass。adapter tests を確認。 |
| `Get-Content -Encoding UTF8 packages/authoring-core/src/dependency-boundary.test.ts` | pass。boundary guard を確認。 |
| `Get-Content -Encoding UTF8 packages/authoring-core/src/index.ts` | pass。barrel-only を確認。 |
| `Get-Content -Encoding UTF8 packages/authoring-core/src/authoring-graph.ts` | pass。AuthoringGraph owned data を確認。 |
| `Get-Content -Encoding UTF8 packages/authoring-core/src/authoring-session.ts` | pass。AuthoringSession identity / revision を確認。 |
| `Get-Content -Encoding UTF8 packages/authoring-core/src/from-package-document.ts` | pass。package DTO -> session flow を確認。 |
| `Get-Content -Encoding UTF8 packages/runtime-core/src/normalized-runtime-graph.ts` | pass。target graph type を確認。 |
| `Get-Content -Encoding UTF8 packages/runtime-core/src/runtime-core.ts` | pass。initial/evaluation API target を確認。 |
| `Get-Content -Encoding UTF8 packages/runtime-core/src/initial-state.ts` | pass。initial state API target を確認。 |
| `Get-Content -Encoding UTF8 packages/runtime-core/src/snapshot.ts` | pass。snapshot draw order / editor-state absence を確認。 |
| `Get-Content -Encoding UTF8 packages/runtime-core/src/index.ts` | pass。runtime barrel を確認。 |
| `Get-Content -Encoding UTF8 packages/runtime-core/src/dependency-boundary.test.ts` | pass。runtime-core forbidden import guard を確認。 |
| `rg -n "@private-2d-rigging-lab/(operation-core|validator-core)" packages/authoring-core/src` | exit 1。match なし。 |
| `rg -n "@private-2d-rigging-lab/runtime-core" packages/authoring-core/src` | pass。adapter 関連ファイルと adapter test のみ match。 |
| `rg -n "@private-2d-rigging-lab/authoring-core" packages/runtime-core/src` | exit 1。match なし。 |
| `rg -n "DOM|document|window|viewport|selection|selected|locked|editorHidden|canvas|activeTool|editor-state" packages/authoring-core/src packages/runtime-core/src` | pass。`canvasSize` / `coordinateSystem` など geometry 関連のみ match。editor-only state 混入なし。 |
| `rg -n "selection|selected|locked|editorHidden|activeTool|viewport|window|document|HTMLElement|Element|DOM|zoom|pan" packages/authoring-core/src packages/runtime-core/src` | pass。`from-package-document` の `document` 語のみ match。editor-only state 混入なし。 |
| `rg -n "editor-state|EditorState|lockedIds|editorHiddenIds|activeTool|canvas" packages/authoring-core/src` | pass。`canvasSize` のみ match。 |
| `rg -n 'from\s+["'']@private-2d-rigging-lab/(package-format|authoring-core|operation-core|validator-core)["'']' packages/runtime-core/src` | exit 1。match なし。 |
| `rg -n 'from\s+["'']@private-2d-rigging-lab/(operation-core|validator-core)["'']' packages/authoring-core/src` | exit 1。match なし。 |
| `pnpm.cmd exec vitest run packages/authoring-core/src` | 初回は sandbox EPERM で fail。許可付き再実行は pass。3 files / 6 tests pass。 |
| `pnpm.cmd typecheck` | 初回は sandbox EPERM で fail。許可付き再実行は pass。 |
| `pnpm.cmd check:source` | pass。`Source organization guard passed.` |
| `pnpm.cmd check:deps` | pass。`Dependency guard passed.` |
| `git diff --check -- packages/authoring-core discussion/implementation/waves/wave4/wave4-authoring-runtime-adapter-foundation-completion.md` | exit 0。CRLF warning のみ。 |
| `rg -n "import\(" packages/authoring-core/src packages/runtime-core/src` | exit 1。dynamic import match なし。 |
| `rg -n "@private-2d-rigging-lab" packages/authoring-core/src packages/runtime-core/src` | pass。package import inventory を確認。 |
| `rg -n "runtime-core" packages/authoring-core/package.json` | pass。dependency line を確認。 |
| `rg -n "toRuntimeGraph|toRuntimeGraphFromAuthoringGraph|parameters:|dynamicsGroups:|drawables:|rigControls:|keyformBindings:|masks:|drawOrder:|disabledFutureLayers" packages/authoring-core/src/to-runtime-graph.ts` | pass。adapter construction lines を確認。 |
| `rg -n "createInitialRuntimeState|evaluateRuntimeFrame|packageRevision|drawOrder|parameters|get\(|dynamicsGroups|get\(|keyformBindings|rigControls|get\(|masks|drawList|snapshot.parameters" packages/authoring-core/src/runtime-graph-adapter.test.ts` | pass。test assertions を確認。 |
| `rg -n "forbiddenImportPattern|runtimeImportPattern|allowedRuntimeImportFiles|expect\(forbiddenOffenders\)|expect\(runtimeOffenders\)" packages/authoring-core/src/dependency-boundary.test.ts` | pass。boundary guard assertions を確認。 |
| `Get-Content -Encoding UTF8 fixtures/contracts/minimal-valid-package/model/draw-order.json` | pass。minimal fixture draw order を確認。 |
| `rg -n "baseDrawOrder|stableOrder|drawOrder" packages/package-format/src discussion/design/module-contracts/package-file-format-contract.md discussion/design/module-contracts/runtime-core-contract.md packages/runtime-core/src packages/authoring-core/src/runtime-graph-drawables.ts` | pass。draw order 用語の usage を確認。 |
| `Get-Content -Encoding UTF8 packages/runtime-core/src/runtime-core.test.ts` | pass。runtime-core draw order fallback behavior を確認。 |
| `Test-Path discussion/implementation/reviews/wave4` | pass。write target directory exists。 |
| `git diff --check -- discussion/implementation/reviews/wave4/wave4-authoring-runtime-adapter-foundation-review.md` | pass。report の whitespace issue なし。 |
| `Get-Content -Encoding UTF8 discussion/implementation/reviews/wave4/wave4-authoring-runtime-adapter-foundation-review.md` | pass。report 内容を確認。 |
| <code>Get-Content -Encoding UTF8 discussion/implementation/reviews/wave4/wave4-authoring-runtime-adapter-foundation-review.md &#124; Select-Object -First 20</code> | pass。report 冒頭を spot check。 |

補助コマンドのうち、PowerShell quoting または wildcard の問題で失敗したもの:

| Command | Outcome |
|---|---|
| `rg -n "from\s+[\"']@private-2d-rigging-lab/(package-format|authoring-core|operation-core|validator-core)[\"']" packages/runtime-core/src` | PowerShell parser error。結果は使用せず、single-quoted pattern で再実行。 |
| `rg -n "from\s+[\"']@private-2d-rigging-lab/(operation-core|validator-core)[\"']" packages/authoring-core/src` | PowerShell parser error。結果は使用せず、single-quoted pattern で再実行。 |
| `rg -n "from\s+[\"']@private-2d-rigging-lab" packages/authoring-core/src packages/runtime-core/src` | PowerShell parser error。結果は使用せず、単純な package-name search で再確認。 |
| `rg -n "createRuntimeParameterMap|createRuntimeDrawableMap|createRuntimeDrawOrder|createRuntimeDynamicsGroupMap|createRuntimeRigControlMap|createRuntimeKeyformBindings" packages/authoring-core/src/runtime-graph-*.ts` | Windows path wildcard が rg の file operand として失敗。結果は使用せず、各 file に分けて再実行。 |

## Remaining Risks

- `pnpm-lock.yaml` は Domain A の forbidden write scope なので同期されていない。`check:deps` は pass しているが、Wave4 integration scope で `pnpm install` による lockfile 同期確認が必要。
- `DrawOrderEntryDto.stableOrder` を `NormalizedDrawOrderEntry.drawOrder` として渡す暫定解釈が、実装者 completion report にも assumption として残っている。現在の minimal fixture と runtime-core fixture は同じ解釈で pass するが、`baseDrawOrder` と `stableOrder` が異なる fixture で runtime-visible order の期待値を固定する余地がある。
- Boundary guard は static `from "@private-2d-rigging-lab/..."` import を対象にしている。現時点で dynamic import は検索上ないため blocking ではないが、将来 dynamic import を使う場合は guard 拡張が必要。

## User-Decision Points

なし。

## Verdict Rationale

Domain A の必須条件である `AuthoringSession` / `AuthoringGraph` から `NormalizedRuntimeGraph` への adapter、狭い `authoring-core -> runtime-core` dependency、`runtime-core` 側の逆依存禁止、`operation-core` / `validator-core` import 禁止、barrel-only `index.ts`、source responsibility split、editor-only state 排除は確認できた。

Required tests も targeted run で pass し、adapter graph が runtime-core initial/evaluation API に渡ることを実テストで確認できたため、verdict は `pass` とする。
