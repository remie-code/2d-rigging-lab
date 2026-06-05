# 現在の Capability Map

> 状態: 2026-06-05 / Wave43 final documentation pass。Clean integration review は `pass` として記録済み。Product capability boundary は Wave41 から変更なし。
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

## Wave43 時点の現在の実装面

| Capability 領域 | 現在の surface | Evidence level | 境界 |
|---|---|---|---|
| Authoring / Editor | project save/load/reset、operation lifecycle UI、generated drawable 作成、layer visibility/order control、明示的な part/layer operation、mesh vertex select/drag/nudge、bounded topology/UV control、rig/dynamics/composition workflow、tutorial mini model flow、Product Preflight panel、AI dry-run/approval transcript foundation を備えた browser app。 | `implementation-proven`; 複数の path は `UI/e2e proven`。 | native layer-tree drag/drop、multi-select bulk edit、group transform、reassignment 付き recursive delete、full timeline editor、public demo capture workflow、full renderer はない。 |
| Rigging / Mesh / Deformation / Dynamics | project-defined `rotation2d` rig control、rig-control keyform、`controlPointOffsets` を持つ `warpLattice2d`、semantic bilinear warp evaluation、Minimum Open Dynamics v1 `scalarDampedFollowV1`、mesh vertex movement、bounded add/remove vertex/triangle、direct UV point movement。 | `implementation-proven`; deformation/runtime output は `semantic evidence only`。 | Cubism deformer/physics compatibility、direct vertex physics、cloth/collision/IK、automatic triangulation、retopology、UV unwrap、atlas packing、texture sampling correctness、pixel oracle はない。 |
| Validator / Product Preflight | Product Preflight v0 は required categories、statuses、evidence refs、diagnostic refs、blocking reasons、recommended actions、unsupported claims、not-evaluated claims を定義する。validator-core は既存の targeted diagnostics を truthful な product categories に集約し、Product Preflight report pairs を deterministic に比較し、category/status transitions、blocking reason changes、evidence/diagnostic ref changes、recommended action changes、unsupported/not-evaluated claim changes、rerun affordance を返せる。Editor workflow は current-session evidence、tutorial readiness evidence、current/previous/proposal-preview report comparison を report surface に接続できる。 | `implementation-proven`; Editor run/read/save/load/rerun path と Product Preflight diff smoke は `UI/e2e proven`。 | Product Preflight v0 は session-generated な read-only report。趣味/個人利用ではCodex-facing read/diff/rerun affordanceとEditor session reportで足りるため、persisted package artifact、exported report、CI/release gate、demo gate、外部ツール向けPreflight artifactは具体的な必要が出るまでスコープ外。repair system、parser、archive/filesystem validator、renderer oracle、Cubism compatibility proof でもない。 |
| Package / Persistence / Transport | browser-local project save/load/reset、operation log/package materialization、current-session byte evidence、same-origin IndexedDB byte restore、base64 byte round-trip を持つ project-defined portable JSON bundle v0、`projectDefinedJsonBundleV0` のみ supported と主張できる transport capability boundary。 | `implementation-proven`; portable bundle と byte restore flow は `UI/e2e proven`。 | ZIP/archive writer/importer、native filesystem、File System Access API、directory picker、drag-drop implementation、cloud/cross-profile persistence、quota/private-browsing guarantee、OS-level storage guarantee はない。 |
| Asset I/O | browser file-input の actual byte intake は filename、byteLength、SHA-256 digest、mediaType、rights/provenance、availability を記録する。parser-free PSD adapter/profile metadata と split PNG source metadata は structured semantic evidence として保持される。local sample PSD byte fixture は length/hash のみで特徴づけられる。 | bytes と metadata は `implementation-proven`; PSD/PNG semantics は parse されない。 | PSD layer parse、PSD/PNG decode、raster extraction、texture materialization、compositing、media header sniffing、public asset redistribution proof、parser security boundary はない。 |
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

## Capability 境界と非対応

### Implementation-Proven

- Product Preflight v0 contract、validator aggregation、Product Preflight report diff contract/builder、package/runtime bridge helper、AI read/diff/rerun affordance command helpers、Editor panel/comparison workflow、rights-clean fixtures、desktop/mobile save-load rerun e2e、desktop/mobile Product Preflight diff e2e。
- Codex-facing proposal contract、operation catalog、proposal validation、dry-run diff preview、rerun validation / Product Preflight bridge、approval-gated commit lifecycle、transcript/evidence recording、Editor proposal review workflow、rights-clean fixtures、desktop/mobile proposal review e2e。
- browser-local project persistence、same-origin IndexedDB byte restore、project-defined portable JSON bundle round-trip。
- digest/length/mediaType/rights/provenance evidence を伴う browser selected-byte intake。
- parser-free PSD adapter/profile metadata と split PNG source metadata workflow。
- generated drawable、part/layer operation、mesh vertex movement、bounded topology/UV edit、`rotation2d`、keyform、`warpLattice2d`、dynamics、mask/opacity、Viewer/Runtime inspection、tutorial mini model の semantic editor workflow。
- read/inspect/validate/dry-run/approval/commit/log/transcript の deterministic AI command host。

### Semantic Evidence Only

- mesh、rig、deformation、dynamics、composition、Product Preflight categories に関する Runtime と Viewer の evidence は、project-defined semantic evidence である。
- Preview/Viewer evidence は state、hash、bounds、diagnostics、diffs を示せるが、rendered pixels、texture sampling correctness、Cubism compatibility は証明しない。

### 将来範囲

- Product Preflight の durability/export と final acceptance/demo gates は、具体的な必要が出た場合の将来範囲。現在の趣味/個人利用では当面スコープ外。
- ZIP/archive/filesystem import/export、drag-drop、File System Access API、directory picker、cloud/cross-profile persistence。
- dependency、security、rights の判断後に行う real PSD/PNG parser/decode/raster/materialization pipeline。
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
| 2026-06-04 capability/backlog inventory | [reports/current-capability-backlog-inventory-2026-06-04.md](reports/current-capability-backlog-inventory-2026-06-04.md) |
| 残作業と decision gates | [remaining-work-backlog.md](remaining-work-backlog.md) |

## ユーザー判断点

- Wave43 後に優先する次のプロダクト境界: archive/filesystem、real parser/decode、renderer/pixel oracle、advanced topology/UV、layer tree UX、public/demo assets、Cubism policy reconsideration のどれにするか。
- public rights-clean real assets を許可するか、また private/local fixtures を distributable demo material からどう分離するか。
- Viewer を editor-internal semantic inspection のままにするか、standalone/full-renderer work に進めるか。
