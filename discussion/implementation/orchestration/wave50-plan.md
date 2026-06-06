# Wave 50 Plan: Explicit PSD Subtree Hierarchy Scaffold v0

> Wave50で実装すべきdomain、依存順、Orch-Sylph並列投入方針を固定する計画。
> 実装起動時はこの文書、`.agents/skills/implementation-orchestration/SKILL.md`、および [codex-friendly-automation-policy.md](../../design/codex-friendly-automation-policy.md) を最小基準にする。

## 1. 状態

- Status: Planned
- Target wave: Wave50
- Wave name: `explicit-psd-subtree-hierarchy-scaffold-v0`
- Primary objective: Wave49で実装済みになった arbitrary eligible PSD leaf explicit approval / execution と Codex-facing in-process command parity を土台に、明示選択されたPSD root / group / subtree / leaf set から **PSD構造を編集可能な初期project model構造へdeterministicに写す** surface を追加する。PSD group は project part container、PSD leaf layer は texture / drawable / empty bounded mesh scaffold として生成し、source refs、名前、親子関係、sourceOrder、visibility、opacity、bounds、generated refs、result evidenceを保持する。

## 2. Planning Gate Result

Planning Gate result before this plan: `Inventory then discuss` -> `Plan directly`.

Inventory delegated to Sylph found:

- Hidden PSD leaf layers can be parsed/materialized at the parser/materializer layer, but Wave48-Wave49 import-plan currently blocks hidden leaves as `hiddenLayerUnsupported`.
- Current batch execution is leaf-only and flat. PSD group data exists in source profile metadata, but group containers are not created in the project graph.
- Current materialization sets drawable `runtimeVisibility: true` regardless of PSD source visibility.
- Editor UI/e2e surfaces can inspect PSD tree, candidates, project Layer Tree part groups, drawable rows, runtime visibility labels, and save/load behavior.

Shared understanding accepted by the user:

- Analytic / deterministic structural expansion is different from semantic meaning inference.
- Semantic recognition, smart classification, auto rigging, and repo-side proposal generation remain unwanted.
- Explicit root/group/subtree structural expansion is allowed and expected by users reading PSDs into an editor-like workflow.
- PSD group should map to the Editor's part-folder/container role.
- Group itself must not become an ArtMesh/drawable.
- Hidden PSD leaf layers should become initially hidden drawables, because expressions or costume variants may be hidden in the PSD.
- Initial mesh should remain an empty bounded mesh scaffold for Wave50. Initial grid mesh generation is a future decision.
- Photoshop-style flattened compositing / pixel-perfect renderer may be a later wave, but is not part of Wave50.

## 3. User Decisions / Automation Boundary

User decisions accepted before this plan:

- Editor / repo は提案エンジンではない。
- Editor / repo はsemantic part recognition、auto-classification、auto-deformer placement、repair generation、proposal generationを行わない。
- 外部Codex/LLMが解釈・提案・操作列生成を担う。
- repo/tool側の責務は、人間が行う操作と同等の操作をCodexが deterministic に実行できる状態・操作・dry-run・diff・validation・Product Preflight・approval・commit・evidence surfaceを提供すること。
- PSD tree の明示 structural expansion は許可される。これは「PSD構造をそのまま写す」操作であり、semantic recognition ではない。
- `automatic PSD group hierarchy conversion` という禁止語は、賢い意味推定やrig提案としての変換を禁止する意味で扱う。Wave50で許可するのは、明示approvalに基づく deterministic structural copy だけである。

Design policy basis:

- [discussion/design/codex-friendly-automation-policy.md](../../design/codex-friendly-automation-policy.md)

## 4. Next Wave Selection

Wave49は、`test_data/sample_model.psd` の `psd:root` preview（`126` candidates）から `front hair` / `psd:root/group[2]/layer[0]` を任意eligible leafとして明示approveし、Codex-facing in-process command pathとresult refs/taxonomyを final baseline として固定した。

次の自然な実用化ステップは、leafを個別に取り込める状態から、PSDを読み込んだ直後に近い **編集開始地点** を作ること。つまり、PSD folder/groupをpart containerへ、PSD leaf layerをdrawable/artmesh-like editableへ写し、ユーザーやCodexがその後にmesh編集、deformer/rig control、keyform、visibility、part organizationなどの人間同等操作を進められる土台を作る。

理由:

- Cubism系エディタでPSDを読み込むユーザーは、単一leafだけではなく、PSD treeが編集可能なパーツ/アートメッシュ相当として展開されることを自然に想像する。
- この展開は意味推定ではなく、PSD treeという明示構造のdeterministic copyである。
- Wave49までのleaf-only pathでは、後続のCodex rigging proposalが参照するproject hierarchyが十分に揃っていない。
- Hidden layerは表情差分や衣装差分として同一PSDに含まれる可能性が高く、hiddenだけを理由にblockedにすると実用性が低い。
- full Photoshop compositingやpixel oracleへ進む前に、構造と編集対象を先に揃えるのが安全である。

## 5. Repository Facts

- Wave49 final integration report / final integration review は `pass` であり、latest final implementation-proven baselineである。
- `packages/ai-interface` / operation API / in-process command host は import-plan state、approval、preflight、execute、result refs を扱える。
- PSD parser/profileは `sourceGroups`、`sourceLayers`、parent group IDs、group paths、source order、layer bounds、visibility、opacity、stable source refs を持つ。
- Import-plan previewは現在、root/group scopeをleaf candidatesへflattenする。group情報はcandidate metadataであり、project hierarchy planではない。
- Batch operationは現在、approved leafごとに1つのgenerated part/drawable/texture/meshを単一destination parent直下に作る。PSD group pathはleaf display nameへ折り込まれる。
- Current import-plan pathはhidden leavesを `hiddenLayerUnsupported` でblockedにする。
- Direct materialization pathはhidden layer raw RGBA bytesを取得できるが、drawable visibilityは `true` 固定である。
- Current mesh materializationは empty bounded scaffold / topologyRevision 0 相当であり、初期grid meshは生成しない。
- ModelPartはpart/drawable parent-child構造を持つが、part-level opacity/visibilityは現行schemaにない。Group visibility / opacity はWave50ではevidenceとして保持し、runtime挙動にはleaf visibilityを反映する。

## 6. Design Decisions

- Wave50は新規 structural scaffold path をadditiveに実装し、Wave48/Wave49のleaf-only import-plan behaviorとfocused IDsを壊さない。
- Structural modeは明示approvalに基づく。ユーザーまたはCodexがPSD root / group / subtree / leaf setを明示的に選び、その対象内のsource refsがapproval digestに含まれる。
- PSD groups become project part containers.
- PSD group nodes never become drawable / ArtMesh / texture / mesh.
- PSD leaf layers become project texture / drawable / empty bounded mesh scaffold entries.
- Hidden PSD leaf layers are eligible when positive-size/materializable and explicitly included. They create `runtimeVisibility: false` drawables.
- Visible PSD leaf layers create `runtimeVisibility: true` drawables.
- Leaf opacity should be mapped to drawable/default opacity where existing schema supports it. If exact opacity semantics are ambiguous, preserve source opacity as evidence and avoid Photoshop compositing claims.
- Group visibility and group opacity are preserved as evidence only in Wave50 unless existing project schema already supports an equivalent deterministic field without broad schema expansion.
- Generated IDs must be derived from stable source refs and destination context, not only display names, to avoid duplicate-name collisions.
- Source order must drive deterministic part child order and draw order where applicable.
- Root/full-subtree expansion must have conservative cap/failure policy. The focused proof may use a representative explicit subset if full root expansion would be too broad for the wave.
- Canonical materialized media type remains `application/vnd.ai-native-live2d.raw-rgba; pixelFormat=rgba8`.

## 7. Non-Goals

- Semantic layer/group meaning inference such as `eye`, `hair`, `mouth`, expression, clothing, or role recognition.
- Editor/repo-side proposal generation, repair generation, candidate ranking, natural-language repair, LLM provider integration, prompt loop, auto-fix, automatic commit.
- `Suggest rig`, `Auto classify`, `Recommended deformers`, `Auto repair`, `Generate proposal`, or similar smart Editor UI.
- Automatic deformer / parameter / keyform / warp lattice / physics generation.
- Initial grid mesh generation, triangulation, automatic mesh fitting, retopology, UV unwrap, atlas packing, or texture sampling correctness.
- Group-as-artmesh import.
- Photoshop-style flattened compositing, blend/effects/mask/color-management correctness, group pass-through rendering, or pixel-perfect renderer.
- Full renderer, standalone viewer app, render target, texture sampling correctness, pixel oracle.
- HTTP / WebSocket / MCP server / external transport implementation.
- Native drag-drop, directory picker, File System Access API, ZIP/archive/native filesystem/cloud transport.
- Cubism SDK/Core integration、Cubism import/export/load compatibility、`.moc3`、`.model3.json`、Cubism Physics compatibility。
- Public demo asset、sample PSD由来visual bytesのpublic screenshots/exports/bundles。
- Broad refactor of part/texture/drawable systems only to make structural import convenient.

## 8. Basis Documents

Undineが保持する最小basis:

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `C:/Users/remie/.codex/skills/planning-gate/SKILL.md`
- `discussion/design/codex-friendly-automation-policy.md`
- `discussion/implementation/orchestration/wave50-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/orchestration/wave49-plan.md`
- `discussion/implementation/waves/wave49/wave49-final-integration-report.md`
- `discussion/implementation/reviews/wave49/wave49-final-integration-review.md`

Domain basis as needed:

- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/diagnostic-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/tests/fixtures/fixture-manifest.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- Wave44-Wave49 PSD parser/materialization/import/intake/import-plan reports and reviews
- Wave28/Wave33 part/layer tree reports and reviews
- Wave40-Wave41 ai-interface / proposal / preflight reports and reviews where Codex-facing API domains need them
- Domain-specific target source and tests

UndineはEditor source、parser source、operation source、validator source全文を自分で読み込まない。詳細source、diff、test evidenceはOrch-Sylphがdomain必要分だけ読み、Gnome / Review-Sylphへ狭く渡す。

## 9. Dependency / Parallel Design

Wave50は最初に structural expansion boundary、hidden-layer behavior、cap/failure policy、sample proof targetsを固定する。その後、package/operation contracts、operation execution、Editor/AI/validator surface、focused e2e、docs/final integrationへ進む。

| Batch | Domain | Parallelism | Dependency | Purpose |
|---|---|---|---|---|
| 1 | A. Boundary / hidden-layer / target inventory | Solo first | Wave49 final pass + accepted user decisions | structural expansion境界、hidden leaf eligibility、group visibility/opacity evidence-only rule、sample focused targets、cap/failure policyを固定する |
| 2 | B. Package / operation hierarchy scaffold contracts | Solo | A | additive hierarchy scaffold evidence、payload/result DTO、stable group/leaf refs、source-order/visibility/opacity/bounds evidenceを定義する |
| 3 | C. Operation-core structural execution | Solo | B | group partsをtopologicalに作成し、leaf materializationをgenerated group part配下へrouteし、hidden leafをruntime-hidden drawableにする |
| 4 | D. Editor structural planner / approval UX | Parallel with E/F after B/C contracts stabilize | B + C | PSD treeからstructural preview/approvalを作り、simple explicit UIで実行結果をLayer Treeに表示する |
| 4 | E. Codex-facing in-process structural command surface | Parallel with D/F | B + C | existing ai-interface/in-process hostへstructural refs、group part refs、leaf refs、initialRuntimeVisibility、stale rejectionを露出する |
| 4 | F. Validator / Product Preflight structural diagnostics | Parallel with D/E | B + C | hierarchy parentage/order、hidden runtime visibility、stale digest、collision、source group/layer mapping、not-evaluated statesをdiagnosticsへ接続する |
| 5 | G. Focused e2e / regression / guard preservation | Solo after D/E/F | D + E + F | `psdStructuralInitialStateFocused`を追加し、existing PSD focused IDsを保持する |
| 6 | H. Documentation / traceability refresh | Solo after G | G | capability map、backlog、maps、fixture/traceabilityをWave50実装範囲へ同期する |
| 7 | I. Integration review and final report | Solo after H | H | final verification、clean integration review、final report、map/backlog更新を行う |

Safety constraints:

- A owns semantics and must not be split across multiple Gnomes.
- B owns contracts/evidence and must not implement Editor UI or parser behavior.
- C owns operation-core execution and must not edit ai-interface/Editor UI except through public contracts.
- D owns Editor workflow/UI and must not add smart suggestion UI.
- E owns Codex-facing command/projector surface and must not add external transport or proposal generation.
- F owns validator/Product Preflight diagnostics and must not add parser execution.
- G owns e2e/regression and focused registry only.
- H owns docs/maps/traceability only.
- I owns final review/report and must return needs_fix if source changes are required.

## 10. Domain Assignments

### A. `wave50-boundary-hidden-target-inventory`

Purpose:

- Lock Wave50 boundary as explicit deterministic structural import, not semantic recognition.
- Confirm hidden positive-size leaves are eligible and map to runtime-hidden drawables.
- Confirm whether group visibility/opacity remain evidence-only in Wave50.
- Select focused sample targets that prove group container creation, nested visible leaf, root visible leaf, hidden leaf, duplicate-name disambiguation, sourceOrder, save/load, and Codex-facing stale rejection.
- Define conservative cap/failure policy for root/group/subtree expansion.

Allowed write scope:

- `discussion/implementation/waves/wave50/**`
- `discussion/implementation/reviews/wave50/**`
- narrow policy/backlog/capability note only if required

Forbidden:

- Source implementation
- semantic recognition / auto-rigging claims
- full root import proof if cap/performance cannot be made deterministic
- Photoshop compositing or renderer claims

### B. `wave50-package-operation-hierarchy-scaffold-contracts`

Purpose:

- Add additive hierarchy scaffold schemas/evidence without breaking `generatedPartScaffold` and existing leaf-only evidence.
- Represent source groups, source layers, source refs, generated part container refs, generated texture/drawable/mesh refs, parentage, source order, source visibility, source opacity, bounds, and issues.
- Ensure source PSD bytes and raw parser objects remain session-only and not persisted as package capability.

Allowed write scope:

- `packages/contracts/src/**` if shared DTOs are required
- `packages/package-format/src/**`
- `packages/operation-core/src/**` contracts/payloads/evidence only
- focused package/operation contract tests
- `discussion/implementation/waves/wave50/**`
- `discussion/implementation/reviews/wave50/**`

Forbidden:

- direct parser dependency import in `packages/**`
- Editor UI
- external transport
- public schema-breaking rename unless escalated

### C. `wave50-operation-core-structural-execution`

Purpose:

- Implement deterministic structural execution from approved hierarchy scaffold.
- Create project part containers for PSD groups before leaf materialization.
- Route leaf texture/drawable/mesh scaffold under generated source-derived parent parts.
- Set drawable initial runtime visibility from source layer visibility.
- Preserve old Wave48/Wave49 leaf-only execution behavior and focused tests.

Allowed write scope:

- `packages/operation-core/src/**`
- `packages/package-format/src/**` only if B contract adjustments are required
- focused operation tests
- `discussion/implementation/waves/wave50/**`
- `discussion/implementation/reviews/wave50/**`

Forbidden:

- initial grid mesh generation
- semantic part names/roles
- deformer/keyform/physics generation
- parser import expansion
- Editor UI

### D. `wave50-editor-structural-planner-approval-ux`

Purpose:

- Build structural preview/approval from PSD source groups/layers and current import-plan session.
- Keep UI explicit and simple: choose scope, inspect planned groups/leaves, approve/execute, inspect result refs/issues.
- Show generated part containers and drawable rows in Layer Tree after execution and save/load.
- Ensure hidden PSD leaves appear as runtime-hidden drawables rather than blocked rows.

Allowed write scope:

- `apps/editor/src/**`
- focused Editor workflow/UI tests
- `discussion/implementation/waves/wave50/**`
- `discussion/implementation/reviews/wave50/**`

Forbidden:

- `Suggest`, `Auto`, `Recommended`, semantic classification, or auto-rigging UI
- native drag-drop
- archive/filesystem/File System Access API
- full renderer / Photoshop compositing preview
- package contract changes not coordinated with B/C

### E. `wave50-codex-facing-structural-command-surface`

Purpose:

- Extend existing in-process `packages/ai-interface` / Editor command host so Codex can perform the same explicit structural import operations as a human.
- Return structural preview/result refs including generated group part refs, leaf drawable/texture/mesh refs, source refs, sourceOrder, initialRuntimeVisibility, and issues.
- Preserve stale preview/approval rejection and transcript/evidence behavior.

Allowed write scope:

- `packages/contracts/src/**` if shared DTOs are required
- `packages/ai-interface/src/**`
- `apps/editor/src/ai-command-host/**`
- focused ai-interface/editor host tests
- `discussion/implementation/waves/wave50/**`
- `discussion/implementation/reviews/wave50/**`

Forbidden:

- HTTP / WebSocket / MCP server or other external transport
- LLM/provider/prompt integration
- repo-side proposal generation, semantic classification, candidate ranking, auto-fix, automatic commit
- smart Editor UI
- parser scope expansion

### F. `wave50-validator-product-preflight-structural-diagnostics`

Purpose:

- Add validator/Product Preflight diagnostics for structural scaffold evidence and result states.
- Cover source group/layer mapping, parentage/order mismatch, hidden runtime visibility mismatch, stale scaffold/approval, duplicate generated IDs, blocked zero-size/unmaterializable leaves, missing current source bytes, and private/local provenance.
- Keep parser-free validator boundary.

Allowed write scope:

- `packages/validator-core/src/**`
- focused validator/Product Preflight tests
- `discussion/implementation/waves/wave50/**`
- `discussion/implementation/reviews/wave50/**`

Forbidden:

- parser implementation
- direct parser dependency import in validator-core
- Product Preflight persisted/exported artifact
- full renderer / pixel oracle proof
- repo-side repair generation

### G. `wave50-focused-e2e-structural-initial-state-regression`

Purpose:

- Add focused e2e `psdStructuralInitialStateFocused`.
- Prove structural preview, group part creation, visible leaf runtime-visible row, hidden leaf runtime-hidden row, sourceOrder-derived order, save/load persistence, Codex-facing structural refs, and stale rejection.
- Preserve `psdImportPlanCodexFocused`, `psdImportPlanFocused`, `psdMultiLayerBatchFocused`, and `psdImportFocused`.

Suggested sample refs:

- visible nested: `front hair` / `psd:root/group[2]/layer[0]`
- visible nested: `tie / tie` / `psd:root/group[6]/layer[0]`
- visible root: `eyewear` / `psd:root/layer[3]`
- hidden root: hidden `headwear` / `psd:root/layer[1]`

Allowed write scope:

- `apps/editor/e2e/**`
- `scripts/focused-e2e-registry.mjs`
- `scripts/wave42-focused-e2e-boundary.mjs` if registry boundary needs update
- `discussion/tests/fixtures/fixture-manifest.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/implementation/waves/wave50/**`
- `discussion/implementation/reviews/wave50/**`

Forbidden:

- Product implementation beyond regression hooks
- public demo asset claims
- broad aggregate e2e runtime expansion without focused registry control

### H. `wave50-docs-traceability-boundary-refresh`

Purpose:

- Update capability map, backlog, implementation maps, fixture manifest, and traceability matrix to reflect Wave50 exactly after implementation.
- Make clear that Wave50 adds explicit deterministic PSD structural initial state, not semantic recognition, auto-rigging, Photoshop compositing, or Cubism compatibility.

Allowed write scope:

- `discussion/_map.md` if top-level current status needs updating
- `discussion/design/_map.md` if policy references need final wording
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`
- `discussion/tests/fixtures/fixture-manifest.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/implementation/waves/wave50/**`
- `discussion/implementation/reviews/wave50/**`

Forbidden:

- Source implementation
- unsupported capability claims
- broad docs rewrite unrelated to Wave50

### I. `wave50-integration-review-and-final-report`

Purpose:

- Integrate Domains A-H, run final verification, produce clean integration review and final report, and update maps/backlog.

Allowed write scope:

- `discussion/implementation/waves/wave50/**`
- `discussion/implementation/reviews/wave50/**`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`
- `discussion/_map.md` if final baseline status needs top-level sync
- narrow final bookkeeping in traceability/fixture docs if required

Forbidden:

- Orch-Sylph自身によるsource code edits。source fixが必要な場合はGnomeに明示委譲し、Review-Sylphで再レビューする。
- Broad documentation rewrite unless Wave50 evidence registration requires it and scope is narrow.

## 11. Subagent / Orch-Sylph Execution Policy

Wave50起動時の実行単位はdomainごとのOrch-Sylphである。

1. UndineはDomain AのOrch-Sylphを単独投入する。
2. Domain Aが`pass`したら、UndineはDomain Bを投入する。
3. Domain Bが`pass`したら、UndineはDomain Cを投入する。
4. Domain Cが`pass`したら、UndineはDomain D / E / Fを並列投入できる。
5. Domain D / E / Fが`pass`したら、UndineはDomain Gを投入する。
6. Domain Gが`pass`したら、UndineはDomain Hを投入する。
7. Domain Hが`pass`したら、UndineはDomain Iを投入する。
8. 各Orch-Sylphは自分でsource実装せず、domain内でGnome実装とReview-Sylphレビューを別コンテキストに分離する。
9. Review-Sylphはclean contextで、implementation notesではなくbasis docs、target files、diff、testsを根拠にレビューする。
10. Subagentからユーザーへ直接質問してはならない。質問はOrch-Sylphが集約し、Undineが重複排除してユーザーへ確認する。
11. Undineはcompletion reportが`pass`でないdomainをwave gate通過扱いにしない。
12. 長時間処理でも、UndineとOrch-Sylphは待機を理由にsubagentを打ち切らない。

Each assignment must include:

```text
Orch-Sylph自身は実装担当ではない。source implementation は必ず別コンテキストの Gnome に委譲し、レビューは必ず別コンテキストの Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。
```

## 12. Review Lanes

Every domain review must check:

- Automation Policy: explicit structural expansion is deterministic copy, not semantic inference, recommendation, or auto-rigging.
- Approval Boundary: execution is limited to explicitly approved root/group/subtree/leaf scope and source refs.
- Hierarchy Correctness: PSD groups become project part containers; groups never become drawables/textures/meshes.
- Leaf Materialization: PSD leaf layers become texture/drawable/empty bounded mesh scaffold entries under correct generated parent parts.
- Hidden Semantics: hidden PSD leaves become runtime-hidden drawables when included; hidden is no longer blocking by itself.
- Ref Stability: source group/layer refs, generated part/drawable/texture/mesh refs, operation IDs, evidence IDs, and diagnostic IDs are stable and source-ref based.
- Order Preservation: sourceOrder drives deterministic part child order and drawOrder where applicable.
- Persistence Truthfulness: raw parser objects, source PSD bytes, session import-plan bridge capability, and public demo assets are not persisted as unsupported capabilities.
- Parser Boundary: `@webtoon/psd` direct import stays limited to approved adapter / Wave44 scripts.
- Test Adequacy: structural initial state path, hidden leaf path, Codex-facing path, stale/collision/blocked paths, focused e2e, and existing PSD focused IDs are covered.
- Non-Goals: semantic classification, auto-deformer/keyform/physics, Photoshop compositing, renderer/pixel oracle, external transport, Cubism, and public demo assets remain out of scope.
- Orchestration Compliance: Orch-Sylph did not implement directly; Gnome implementation and Review-Sylph review are separated.

## 13. Verification Plan

Domain minimum verification:

- Domain A: boundary report/review, hidden layer probe evidence, sample target inventory, policy consistency check, `git diff --check`.
- Domain B: package/operation contract tests for hierarchy scaffold evidence and backwards compatibility with Wave48/Wave49 leaf-only evidence.
- Domain C: operation-core tests for group part creation, routed leaf materialization, hidden runtime visibility, sourceOrder, duplicate generated ID handling, and old focused paths.
- Domain D: Editor workflow/UI tests for structural preview/approval/result projection and Layer Tree visible/hidden rows.
- Domain E: ai-interface / in-process host tests for structural preview/approval/execute/result refs and stale rejection.
- Domain F: validator/Product Preflight tests for structural diagnostics and truthful not-evaluated states.
- Domain G: focused e2e/regression for `psdStructuralInitialStateFocused`, existing PSD focused id preservation, parser boundary guard, focused registry checks.
- Domain H: docs/map/traceability consistency checks and `git diff --check`.
- Domain I: final full verification and clean integration review.

Final verification:

- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm test:e2e`
- `node scripts/run-focused-e2e.mjs --id psdStructuralInitialStateFocused`
- `node scripts/run-focused-e2e.mjs --id psdImportPlanCodexFocused`
- `node scripts/run-focused-e2e.mjs --id psdImportPlanFocused`
- `node scripts/run-focused-e2e.mjs --id psdMultiLayerBatchFocused`
- `node scripts/run-focused-e2e.mjs --id psdImportFocused`
- `node scripts/check-psd-parser-import-boundary.mjs`
- `node scripts/check-focused-e2e-registry.mjs`
- `node scripts/check-wave42-quality-gate-boundary.mjs`
- `pnpm run check:source`
- `pnpm run check:deps`
- relevant Wave42/Wave43/Wave44 guard scripts if still expected by plan and available
- `git diff --check -- apps packages scripts fixtures test_data generated discussion discussion/implementation discussion/development_convention discussion/tests`
- forbidden-scope scan for semantic recognition, suggestion UI, proposal generation, auto classify, auto-fix, automatic commit, initial grid mesh claims, deformer/keyform/physics generation, Photoshop compositing, renderer/pixel oracle, external transport, Cubism, public demo asset, persisted source PSD bytes/raw parser objects

## 14. Early Escape / User Decision Points

Orch-Sylph must escalate if:

- Implementation requires semantic role inference from names or pixels.
- Implementation requires `Suggest`, `Auto classify`, `Recommended deformers`, auto-rigging, or repair UI.
- Implementation requires initial grid mesh generation or automatic triangulation to satisfy the UX.
- Implementation requires group-as-artmesh behavior.
- Group visibility/opacity must affect runtime behavior and cannot be represented without a broader schema/product decision.
- Hidden PSD leaves cannot be materialized reliably enough to create runtime-hidden drawables.
- Root/full-subtree expansion requires caps, workerization, memory policy, or async architecture beyond a conservative default.
- Structural refs cannot be stable without breaking Wave48/Wave49 focused IDs.
- Photoshop-style flattening/compositing, renderer/pixel oracle, or texture sampling correctness becomes necessary.
- HTTP / WebSocket / MCP server or external transport is required.
- Direct parser import is needed in packages/runtime/validator.
- Save/load/portable bundle semantics require persisting source PSD bytes or raw parser objects.
- Public demo asset化やsample PSD由来visual bytesの公開判断が必要になる。
- Cubism compatibility claimが必要になる。
- Parallel domains need to edit the same files.

No additional user question is required before starting Wave50 under this plan. The user has approved deterministic structural expansion, hidden PSD leaf -> hidden drawable behavior, and empty mesh scaffold for Wave50. If the desired direction changes to Photoshop compositing, renderer/pixel oracle, archive/filesystem, public demo assets, initial grid mesh generation, or Cubism compatibility, replace this plan before launch.

## 15. Pass Criteria

Wave50 passes when:

- Explicit PSD structural approval can produce project part containers for PSD groups and texture/drawable/empty mesh scaffold entries for approved PSD leaf layers.
- Group nodes are not imported as drawables/ArtMeshes.
- Hidden positive-size PSD leaf layers can be included and become initially runtime-hidden drawables.
- Visible PSD leaf layers become initially runtime-visible drawables.
- Source refs, generated refs, parentage, sourceOrder, visibility, opacity, bounds, operation IDs, evidence IDs, and issue IDs are machine-readable and stable.
- Existing Wave48/Wave49 leaf-only import-plan behavior and focused IDs remain passing.
- Editor Layer Tree shows generated group parts and drawable rows after execution and save/load.
- Codex-facing in-process command surface exposes structural preview/result refs and stale rejection without repo-side proposal generation.
- Validator/Product Preflight reflects structural result states truthfully.
- Focused e2e proves `psdStructuralInitialStateFocused` and preserves `psdImportPlanCodexFocused`, `psdImportPlanFocused`, `psdMultiLayerBatchFocused`, and `psdImportFocused`.
- Source PSD bytes, raw parser objects, and session import-plan bridge capability are not persisted as package/session capability.
- No semantic recognition, no smart suggestion UI, no auto-rig/deformer/keyform/physics, no initial grid mesh generation, no Photoshop full compositing, no renderer/pixel oracle, no external transport, no Cubism compatibility, and no public demo asset claims are introduced.
- `index.ts` files remain barrel-only and source organization guardrails pass.
- Domain completion reports, Review-Sylph reviews, final integration report, clean review, and map/backlog updates are recorded under `discussion/implementation/`.
