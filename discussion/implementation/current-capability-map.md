# 現在の Capability Map

> 状態: 2026-06-05 / Wave45 Domain H final verification / clean integration review。Wave45 final verification と clean integration review は `pass` 済みで、Wave45 final complete / final pass は Domain H report と clean review に記録済み。
> 目的: 次の実装境界を計画するための、現在のプロダクト capability map。これは wave ごとの changelog ではない。詳細な wave 履歴は、リンク先の final report と map に置く。

## 凡例

| ラベル | 意味 |
|---|---|
| `implementation-proven` | source/tests/fixtures と wave 検証記録で裏付けられている。 |
| `UI/e2e proven` | Editor UI または browser e2e smoke path から実行済み。 |
| `semantic evidence only` | 決定的な project/runtime evidence はあるが、描画結果や pixel-level correctness は主張しない。 |
| `future scope` | 可能性のあるプロダクト方向だが、repo には未実装。 |
| `explicit non-goal` | 方針変更がない限り、現在の Private Prototype 方向には含めない。 |

## プロダクト目的

この repository は現在、project-defined な private 2D model authoring prototype を実装している。deterministic package、editor、runtime、validator、Codex-facing command surface を持ち、semantic authoring evidence、dry-run/approval workflow、browser-local project persistence、Product Preflight reporting を軸にしている。

現在のプロダクトは Cubism clone ではなく、Cubism runtime/editor compatibility layer でもなく、full renderer でも LLM provider integration でもない。AI推論・修復案設計は Codex 側の責務であり、この repo は Codex が利用する deterministic state、operation、validation、diff、approval、evidence surface を提供する。

## 現在の実装面（Wave45 final verification / clean review pass 反映）

| Capability 領域 | 現在の surface | Evidence level | 境界 |
|---|---|---|---|
| Authoring / Editor | project save/load/reset、operation lifecycle UI、generated drawable 作成、layer visibility/order control、明示的な part/layer operation、mesh vertex select/drag/nudge、bounded topology/UV control、rig/dynamics/composition workflow、tutorial mini model flow、Product Preflight panel、AI dry-run/approval transcript foundation、明示的な PSD Import panel / browser parser session layer tree workflow を備えた browser app。 | `implementation-proven`; 複数の path は `UI/e2e proven`。Wave45 explicit PSD import workflow は focused `psdImportFocused` e2e で `UI/e2e proven`。 | PSD import は user-selected file input に限定。native layer-tree drag/drop、PSD drag-drop、multi-select bulk edit、group transform、reassignment 付き recursive delete、full timeline editor、public demo capture workflow、full renderer はない。 |
| Rigging / Mesh / Deformation / Dynamics | project-defined `rotation2d` rig control、rig-control keyform、`controlPointOffsets` を持つ `warpLattice2d`、semantic bilinear warp evaluation、Minimum Open Dynamics v1 `scalarDampedFollowV1`、mesh vertex movement、bounded add/remove vertex/triangle、direct UV point movement。 | `implementation-proven`; deformation/runtime output は `semantic evidence only`。 | Cubism deformer/physics compatibility、direct vertex physics、cloth/collision/IK、automatic triangulation、retopology、UV unwrap、atlas packing、texture sampling correctness、pixel oracle はない。 |
| Validator / Product Preflight | Product Preflight v0 は required categories、statuses、evidence refs、diagnostic refs、blocking reasons、recommended actions、unsupported claims、not-evaluated claims を定義する。validator-core は既存の targeted diagnostics を truthful な product categories に集約し、Product Preflight report pairs を deterministic に比較し、category/status transitions、blocking reason changes、evidence/diagnostic ref changes、recommended action changes、unsupported/not-evaluated claim changes、rerun affordance を返せる。Editor workflow は current-session evidence、tutorial readiness evidence、current/previous/proposal-preview report comparison を report surface に接続できる。Wave44 で PSD parser/layer-tree/feature-support/materialization evidence diagnostics と Product Preflight `sourceMaterialization` ref aggregation が追加され、Wave45 で browser PSD import evidence の parse failure、unsupported/notEvaluated features、missing bytes、selected materialization availability diagnostics が接続された。 | `implementation-proven`; Editor run/read/save/load/rerun path と Product Preflight diff smoke は `UI/e2e proven`。Wave44/Wave45 PSD evidence diagnostics は focused validator tests、fixture regression、focused PSD import e2e で `implementation-proven`。 | Product Preflight v0 は session-generated な read-only report。趣味/個人利用ではCodex-facing read/diff/rerun affordanceとEditor session reportで足りるため、persisted package artifact、exported report、CI/release gate、demo gate、外部ツール向けPreflight artifactは具体的な必要が出るまでスコープ外。PSD diagnostics は package/validator parser execution、renderer oracle、Photoshop full compositing proof、archive/filesystem validator、Cubism compatibility proof、AI repair system ではない。 |
| Package / Persistence / Transport | browser-local project save/load/reset、operation log/package materialization、current-session byte evidence、same-origin IndexedDB byte restore、base64 byte round-trip を持つ project-defined portable JSON bundle v0、`projectDefinedJsonBundleV0` のみ supported と主張できる transport capability boundary。Wave45 は parser-free PSD import evidence summary を operation/package/session evidence へ接続し、save/load 後は explicit PSD import session evidence cleared / reparse required boundary を表示する。 | `implementation-proven`; portable bundle と byte restore flow は `UI/e2e proven`。Wave45 PSD operation evidence bridge は focused package/operation tests と focused e2e で `implementation-proven`。 | ZIP/archive writer/importer、native filesystem、File System Access API、directory picker、drag-drop implementation、cloud/cross-profile persistence、quota/private-browsing guarantee、OS-level storage guarantee はない。PSD raw parser object、raw PSD bytes、raw/visual materialized bytes は package/session persistence capability として主張しない。 |
| Asset I/O | browser file-input の actual byte intake は filename、byteLength、SHA-256 digest、mediaType、rights/provenance、availability を記録する。parser-free PSD adapter/profile metadata と split PNG source metadata は structured semantic evidence として保持される。Wave44 で `@webtoon/psd@0.4.0` を scripts-only dev/test dependency として登録し、explicit local path Node smoke で `test_data/sample_model.psd` の document metadata、layer/group tree、selected layer raw RGBA materialization digest evidence を得た。Wave45 で dependency scope は Editor/browser explicit PSD import adapter のみに狭く拡張され、ユーザー明示選択 PSD を browser session で parse し、parser-free document/layer tree/materialization summary evidence を Editor UX、operation evidence、validator/Product Preflight、focused e2e に接続した。 | byte intake、parser-free metadata、Wave44 explicit-path PSD parser smoke、selected-layer materialization evidence JSON、Wave45 Editor/browser explicit PSD import workflow、`psdImportFocused` focused e2e、parser import boundary guard、fixture/traceability registration は `implementation-proven`; explicit PSD import UI は `UI/e2e proven`。 | PSD parser import は approved Editor/browser adapter と既存 Wave44 scripts に限定され、packages/runtime/validator へ direct parser import しない。PNG workflow expansion、drag-drop、archive/filesystem/File System Access API、general PSD materialization、Photoshop full compositing、blend/effects/mask/color-management correctness、renderer/pixel oracle、texture sampling correctness、public demo asset redistribution、Cubism compatibility はない。 |
| AI / Codex-facing API | `packages/ai-interface` は deterministic read/inspect/validate/dry-run/commit/operation-log command surface、approval policy、transcript append、in-process Editor host routing、Product Preflight observation/read/diff/rerun affordance command helpers、Codex proposal operation catalog、proposal validation、approval lifecycle bridge を公開する。`packages/operation-core` / `packages/validator-core` は Codex proposal diff preview、preview/post-commit rerun validation evidence、Product Preflight report diff を提供する。Editor は pasted proposal review、validation、diff preview、rerun validation、Product Preflight comparison、manual approval、approved commit path を表示できる。 | deterministic command host、proposal validation/diff/rerun/approval/transcript behavior と Product Preflight read/diff bridge は `implementation-proven`; Editor proposal review and Product Preflight comparison paths are `UI/e2e proven`。 | inference、proposal generation、repair design、natural-language judgment、repair candidate generation/ranking は Codex の責務。この repo は LLM/provider、prompt loop、auto-fix、automatic commit、external proposal transport、repair reasoning を提供しない。 |
| Viewer / Preview | Editor embedded runtime-projected SVG preview、parameter slider、Viewer/Runtime inspection、runtime snapshot/diff、diagnostics、semantic composition/mask/opacity evidence、mesh/runtime evidence、Product Preflight evidence input。 | `semantic evidence only`; 一部の Editor flow は `UI/e2e proven`。 | standalone viewer app、full render target、texture sampling correctness、rendered acceptance oracle、pixel-level comparison、Cubism runtime、`.moc3`、`.model3.json` support はない。 |

## Wave42 Repository Quality Gate Surface

Wave42 は product capability ではなく、既存境界を維持するための repository quality-gate / guard / registry / documentation traceability work である。

- `node scripts/check-wave42-quality-gate-boundary.mjs` は Wave42 guard categories、focused e2e boundary discovery、report shape、explicit non-goal classification policy を検査する。
- `node scripts/check-source-organization.mjs` と `node scripts/check-source-organization-fixtures.mjs` は barrel-only `index.ts`、exact catch-all filenames、large catch-all-like filenames の guard と fixture regression を担う。
- `node scripts/check-focused-e2e-registry.mjs` と `node scripts/run-focused-e2e.mjs --list|--check|--id <registryId>` は focused e2e entry の registry consistency、listing、single-entry selection を担う。list/check/dry-run は browser e2e coverage ではない。
- `node scripts/check-dependencies.mjs` と `node scripts/check-dependencies-guard-self-test.mjs` は forbidden dependency / lockfile / asset path / positive non-goal claim containment と false-positive containment self-test を担う。
- Wave42 guard entry points は [test-traceability-matrix.md](../tests/traceability/test-traceability-matrix.md) に documentation/traceability として登録済みであり、JSON mirror、Acceptance Runner coverage、Product Preflight artifact、release/demo gate、parser/archive/filesystem/renderer/Cubism support を追加しない。

## Wave43 Documentation / Traceability / Guard Surface

Wave43 は product capability ではなく、validator/evidence contract consistency work である。

- `validator-contract.md` は Wave31-W42 の byte availability、persistent byte storage、portable bundle、transport capability、topology/UV、warp lattice、Product Preflight、Codex proposal evidence/report surfaces を実装済み範囲とunsupported境界に分けて記録する。
- `diagnostic-policy.md`、`schema-and-id-conventions.md`、`test-traceability-matrix.md` は現行 check ID、semantic evidence only、Product Preflight report/diff/read/rerun vocabulary、Codex proposal-local/result-local vocabulary を同期する。
- `node scripts/check-wave43-validator-contract-coverage.mjs` は validator catalog、Domain A matrix、docs/traceability/fixture、Product Preflight source mapping、focused e2e boundary wording の代表 token drift を検査する。これは token-based representative checker であり、semantic parser、full catalog mirror、browser e2e coverage ではない。
- Domain E は active fixture manifest の validator diagnostic label を `portableBundle.digestMismatch` に合わせた。package-format/editor workflow の `portableBundle.digest.mismatch` issue-code vocabulary は別系統として未変更であり、Wave43 は source/schema behavior change を行わない。
- Wave43 は Product Preflight persisted/exported artifact、release/demo gate、parser/image decode、archive/filesystem implementation、renderer/pixel oracle、Cubism compatibility、repo-side repair generation/ranking、LLM/provider、natural-language repair、auto-fix、external transport、external dependency、package manifest/lockfile change を追加しない。

## Wave44 PSD Evidence Pilot Surface

Wave44 は Domain H final verification bookkeeping 済みで、Review-Sylph clean integration review は [recorded `pass`](reviews/wave44/wave44-domain-h-clean-integration-review.md) である。Domains A-F の実装・レビュー証跡と Domain G/H の文書統合に基づき、現在 claim できる範囲は次に限定する。

- `@webtoon/psd@0.4.0` は `dev:test:fixture-smoke:scripts-only:not-editor-runtime-demo` scope の dependency として登録済み。production package source、Editor、runtime には parser import を入れていない。
- `pnpm smoke:wave44:psd-parser` は `test_data/sample_model.psd` を explicit path で読み、document metadata、layer/group tree、layer bounds、visibility、opacity、selected layer raw RGBA digest evidence を出す。
- `test_data/derived/wave44/psd-layer-materialization/headwear.raw-rgba.materialization-evidence.json` は private/local fixture の compact materialization evidence であり、raw RGBA bytes、visual bytes、public demo asset は保存しない。
- Validator/Product Preflight は PSD parser/layer-tree/unsupported/not-evaluated/materialization evidence を diagnostic/ref として扱える。これは parser execution、rendering、Photoshop compositing、texture sampling、pixel correctness の proof ではない。
- `wave44-psd-materialization-regression` / `TC-WAVE44-PSD-MATERIALIZATION-REGRESSION-001` は markdown fixture/traceability registration 済み。JSON mirrors は domain scope と既存方針により未編集。
- Wave44 自体は Editor browser PSD import UX を含まなかった。Wave45 で追加された範囲は後続の Wave45 surface に分けて記録する。

## Wave45 Editor Explicit PSD Import Surface

Wave45 は Domains A-G、Domain H final verification / integration bookkeeping、Domain H clean integration review が `pass` 済みである。Domain H final report は [recorded `pass`](waves/wave45/wave45-domain-h-integration-review-and-final-report.md) で、Review-Sylph clean integration review も [recorded `pass`](reviews/wave45/wave45-domain-h-clean-integration-review.md) である。Wave45 final complete / final pass はこの範囲に限定して主張できる。

- `@webtoon/psd@0.4.0` dependency scope は Editor/browser explicit PSD import adapter にだけ拡張された。許可された direct parser import は Editor browser adapter と既存 Wave44 scripts に限り、packages/runtime/validator/general Editor source/public asset workflows には広げない。
- Browser parser bridge は user-selected `File` / `ArrayBuffer` を browser session 内で parse し、parser-free source profile、document metadata、layer/group tree、visibility/opacity/bounds、unsupported/notEvaluated summary、parse failure evidence、selected-layer materialization digest/byteLength summary を返す。
- Package/operation evidence bridge は browser-origin parser-free PSD evidence を source/package/session operation evidence に載せる。raw parser object、raw PSD bytes、raw/visual materialized bytes、`binaryAssetRef` は evidence summary に保存しない。
- Editor explicit PSD Import workflow は file input から PSD を選択し、parse status、document metadata、layer tree、selected layer evidence、session persistence boundary を表示する。save/load 後は session evidence cleared / reparse required として扱う。
- Validator/Product Preflight は parse failure、missing bytes、unsupported/notEvaluated feature、selected materialization availability を truthful な diagnostics / refs / claims として扱う。
- `psdImportFocused` focused e2e は private/local `test_data/sample_model.psd` upload、browser parse、layer tree display、selected layer materialization summary、save/load boundary、no raw/visual bytes persisted claim を検証する。
- `node scripts/check-psd-parser-import-boundary.mjs` は parser direct import sites を approved adapter と Wave44 scripts に限定し、`packages/**` direct parser import を拒否する。
- `wave45-psd-import-focused-e2e-regression` / `TC-WAVE45-PSD-IMPORT-FOCUSED-E2E-001` は markdown fixture/traceability registration 済み。JSON mirrors は既存 warning-gated markdown registration 方針により未編集。
- Unsupported/future scope remains explicit: drag-drop、archive/filesystem/File System Access API、general PSD materialization、full Photoshop compositing、renderer/pixel oracle、texture sampling correctness、Cubism、public demo assets from sample PSD、repo-side AI repair/LLM/provider/natural-language repair/auto-fix。

## Capability 境界と非対応

### Implementation-Proven

- Product Preflight v0 contract、validator aggregation、Product Preflight report diff contract/builder、package/runtime bridge helper、AI read/diff/rerun affordance command helpers、Editor panel/comparison workflow、rights-clean fixtures、desktop/mobile save-load rerun e2e、desktop/mobile Product Preflight diff e2e。
- Codex-facing proposal contract、operation catalog、proposal validation、dry-run diff preview、rerun validation / Product Preflight bridge、approval-gated commit lifecycle、transcript/evidence recording、Editor proposal review workflow、rights-clean fixtures、desktop/mobile proposal review e2e。
- browser-local project persistence、same-origin IndexedDB byte restore、project-defined portable JSON bundle round-trip。
- digest/length/mediaType/rights/provenance evidence を伴う browser selected-byte intake。
- parser-free PSD adapter/profile metadata と split PNG source metadata workflow。
- Wave44 scripts-only `@webtoon/psd@0.4.0` explicit-path Node parser smoke、selected `headwear` layer raw RGBA materialization digest evidence JSON、PSD evidence validator/Product Preflight diagnostics、private/local fixture regression。
- Wave45 Editor/browser explicit PSD import adapter scope、browser parser bridge/session evidence、package/operation PSD import evidence bridge、Editor explicit PSD Import layer tree UX、validator/Product Preflight PSD import diagnostics、focused `psdImportFocused` e2e、parser import boundary guard、warning-gated fixture/traceability registration。
- generated drawable、part/layer operation、mesh vertex movement、bounded topology/UV edit、`rotation2d`、keyform、`warpLattice2d`、dynamics、mask/opacity、Viewer/Runtime inspection、tutorial mini model の semantic editor workflow。
- read/inspect/validate/dry-run/approval/commit/log/transcript の deterministic AI command host。

### Semantic Evidence Only

- mesh、rig、deformation、dynamics、composition、Product Preflight categories に関する Runtime と Viewer の evidence は、project-defined semantic evidence である。
- Preview/Viewer evidence は state、hash、bounds、diagnostics、diffs を示せるが、rendered pixels、texture sampling correctness、Cubism compatibility は証明しない。

### 将来範囲

- Product Preflight の durability/export と final acceptance/demo gates は、具体的な必要が出た場合の将来範囲。現在の趣味/個人利用では当面スコープ外。
- ZIP/archive/filesystem import/export、drag-drop、File System Access API、directory picker、cloud/cross-profile persistence。
- Wave44/Wave45 で実装された real PSD parser evidence と explicit Editor/browser PSD import UX を、drag-drop、archive/filesystem/File System Access API、general PSD materialization、PNG workflow、Photoshop full compositing、renderer/pixel oracle、texture sampling correctness へ広げる作業。
- advanced topology/UV tool、layer tree UX expansion、advanced dynamics、standalone viewer、renderer/pixel oracle、public/demo asset workflow。

### 方針変更がない限り明示的な Non-Goals

- Cubism SDK/Core integration。
- `.moc3` と `.model3.json` を含む Cubism import/export/load compatibility。
- Cubism Physics compatibility。
- repo-side LLM/provider/prompt integration、natural-language repair、repair candidate generation/ranking、auto-fix。
- Product Preflight persisted/exported artifact、CI/release gate、demo gate、外部ツール向けPreflight artifact。ただし具体的な必要が出た場合は将来再検討する。
- Product Preflight、Viewer evidence、PSD metadata、byte intake、portable JSON bundle が parser/decode/archive/filesystem/renderer/pixel/Cubism support を証明するという主張。

## Evidence 入口

| Evidence | Link |
|---|---|
| Implementation map | [_map.md](_map.md) |
| Orchestration map | [orchestration/_map.md](orchestration/_map.md) |
| Wave39 final report | [waves/wave39/wave39-final-report.md](waves/wave39/wave39-final-report.md) |
| Wave39 clean integration review | [reviews/wave39/wave39-clean-integration-review.md](reviews/wave39/wave39-clean-integration-review.md) |
| Wave40 final report | [waves/wave40/wave40-final-report.md](waves/wave40/wave40-final-report.md) |
| Wave40 clean integration review | [reviews/wave40/wave40-clean-integration-review.md](reviews/wave40/wave40-clean-integration-review.md) |
| Wave41 final report | [waves/wave41/wave41-final-report.md](waves/wave41/wave41-final-report.md) |
| Wave41 clean integration review | [reviews/wave41/wave41-clean-integration-review.md](reviews/wave41/wave41-clean-integration-review.md) |
| Wave42 final report | [waves/wave42/wave42-final-report.md](waves/wave42/wave42-final-report.md) |
| Wave42 clean integration review | [reviews/wave42/wave42-clean-integration-review.md](reviews/wave42/wave42-clean-integration-review.md) |
| Wave43 final report | [waves/wave43/wave43-final-report.md](waves/wave43/wave43-final-report.md) |
| Wave43 clean integration review | [reviews/wave43/wave43-clean-integration-review.md](reviews/wave43/wave43-clean-integration-review.md) |
| Wave44 plan | [orchestration/wave44-plan.md](orchestration/wave44-plan.md) |
| Wave44 Domain A-F reports | [A](waves/wave44/wave44-domain-a-psd-dependency-security-fixture-boundary-report.md), [B](waves/wave44/wave44-domain-b-psd-parser-dependency-node-smoke-report.md), [C](waves/wave44/wave44-domain-c-psd-layer-tree-contract-profile-boundary-report.md), [D](waves/wave44/wave44-domain-d-psd-raster-layer-materialization-pilot-report.md), [E](waves/wave44/wave44-domain-e-psd-validator-provenance-security-diagnostics-report.md), [F](waves/wave44/wave44-domain-f-psd-fixture-evidence-node-regression-report.md) |
| Wave44 Domain A-F reviews | [A](reviews/wave44/wave44-domain-a-psd-dependency-security-fixture-boundary-review.md), [B](reviews/wave44/wave44-domain-b-psd-parser-dependency-node-smoke-review.md), [C](reviews/wave44/wave44-domain-c-psd-layer-tree-contract-profile-boundary-review.md), [D](reviews/wave44/wave44-domain-d-psd-raster-layer-materialization-pilot-review.md), [E](reviews/wave44/wave44-domain-e-psd-validator-provenance-security-diagnostics-review.md), [F](reviews/wave44/wave44-domain-f-psd-fixture-evidence-node-regression-review.md) |
| Wave44 Domain G report | [waves/wave44/wave44-domain-g-docs-traceability-boundary-refresh-report.md](waves/wave44/wave44-domain-g-docs-traceability-boundary-refresh-report.md) |
| Wave44 Domain G review | [reviews/wave44/wave44-domain-g-docs-traceability-boundary-refresh-review.md](reviews/wave44/wave44-domain-g-docs-traceability-boundary-refresh-review.md) |
| Wave44 Domain H final verification report | [waves/wave44/wave44-domain-h-integration-review-and-final-report.md](waves/wave44/wave44-domain-h-integration-review-and-final-report.md) |
| Wave44 clean integration review | [reviews/wave44/wave44-domain-h-clean-integration-review.md](reviews/wave44/wave44-domain-h-clean-integration-review.md) |
| Wave45 plan | [orchestration/wave45-plan.md](orchestration/wave45-plan.md) |
| Wave45 Domain A-G reports | [A](waves/wave45/wave45-domain-a-browser-parser-dependency-scope-trust-boundary-report.md), [B](waves/wave45/wave45-domain-b-browser-psd-parser-bridge-session-evidence-report.md), [C](waves/wave45/wave45-domain-c-package-operation-psd-import-evidence-bridge-report.md), [D](waves/wave45/wave45-domain-d-editor-explicit-psd-import-layer-tree-ux-report.md), [E](waves/wave45/wave45-domain-e-validator-product-preflight-psd-import-diagnostics-report.md), [F](waves/wave45/wave45-domain-f-psd-import-focused-e2e-regression-report.md), [G](waves/wave45/wave45-domain-g-docs-traceability-boundary-refresh-report.md) |
| Wave45 Domain A-E/G/H reviews | [A](reviews/wave45/wave45-domain-a-browser-parser-dependency-scope-trust-boundary-review.md), [B](reviews/wave45/wave45-domain-b-browser-psd-parser-bridge-session-evidence-review.md), [C](reviews/wave45/wave45-domain-c-package-operation-psd-import-evidence-bridge-review.md), [D](reviews/wave45/wave45-domain-d-editor-explicit-psd-import-layer-tree-ux-review.md), [E](reviews/wave45/wave45-domain-e-validator-product-preflight-psd-import-diagnostics-review.md), [G](reviews/wave45/wave45-domain-g-docs-traceability-boundary-refresh-review.md), [H clean](reviews/wave45/wave45-domain-h-clean-integration-review.md) |
| Wave45 Domain G report | [waves/wave45/wave45-domain-g-docs-traceability-boundary-refresh-report.md](waves/wave45/wave45-domain-g-docs-traceability-boundary-refresh-report.md) |
| Wave45 Domain H final verification report | [waves/wave45/wave45-domain-h-integration-review-and-final-report.md](waves/wave45/wave45-domain-h-integration-review-and-final-report.md) |
| Wave45 Domain H clean integration review | [reviews/wave45/wave45-domain-h-clean-integration-review.md](reviews/wave45/wave45-domain-h-clean-integration-review.md) |
| 2026-06-04 capability/backlog inventory | [reports/current-capability-backlog-inventory-2026-06-04.md](reports/current-capability-backlog-inventory-2026-06-04.md) |
| 残作業と decision gates | [remaining-work-backlog.md](remaining-work-backlog.md) |

## ユーザー判断点

- Wave45 final verification / clean integration review は `pass` 済み。次の優先順位判断は drag-drop、archive/filesystem/File System Access API、general PSD materialization、renderer/pixel oracle、advanced topology/UV、public/demo assets、Cubism policy reconsideration などであり、別 wave として扱う。
- public rights-clean real assets を許可するか、また private/local fixtures を distributable demo material からどう分離するか。
- Viewer を editor-internal semantic inspection のままにするか、standalone/full-renderer work に進めるか。
