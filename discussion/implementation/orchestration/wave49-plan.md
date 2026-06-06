# Wave 49 Plan: Codex-Friendly Explicit PSD Leaf Intake Generalization v0

> Wave49で実装すべきdomain、依存順、Orch-Sylph並列投入方針を固定する計画。
> 実装起動時はこの文書、`.agents/skills/implementation-orchestration/SKILL.md`、および [codex-friendly-automation-policy.md](../../design/codex-friendly-automation-policy.md) を最小基準にする。

## 1. 状態

- Status: Planned
- Target wave: Wave49
- Wave name: `codex-friendly-explicit-psd-leaf-intake-generalization-v0`
- Primary objective: Wave48で実装済みになった `psd:root` / group import-plan preview と explicit leaf approval を、固定3 leaf 実証から **任意の eligible leaf refs を明示承認して取り込める** surface へ拡張する。同時に、Codexが人間操作と同等の明示操作を既存 `packages/ai-interface` / operation API / in-process command surface 経由で扱いやすいように、stable refs、approval/result evidence、machine-readable failure taxonomyを整える。

## 2. User Decisions / Automation Boundary

User decisions accepted before this plan:

- Editor / repo は提案エンジンではない。
- Editor / repo は推論、semantic part recognition、auto-classification、auto-deformer placement、repair generation、proposal generationを行わない。
- `Suggest` / `Auto classify` / `Recommended deformers` のようなEditor UIは将来的にも置かない。
- 外部Codex/LLMが解釈・提案・操作列生成を担う。
- repo/tool側の責務は、人間が行う操作と同等の操作をCodexが deterministic に実行できる状態・操作・dry-run・diff・validation・Product Preflight・approval・commit・evidence surfaceを提供すること。
- 当面の外部操作 surface は既存 `packages/ai-interface` / operation API / in-process command host の延長でよい。HTTP / WebSocket / MCP server などのtransport拡張は別プロジェクト判断とする。

Design policy basis:

- [discussion/design/codex-friendly-automation-policy.md](../../design/codex-friendly-automation-policy.md)

## 3. Next Wave Selection

Wave48は、`test_data/sample_model.psd` の `psd:root` preview（`126` candidates）から `headwear`、`eyewear`、`tie / tie` だけを明示approveし、既存Wave47 batch intakeへ流す focused path を final pass として固定した。

次の自然な実用化ステップは、固定3 leaf の proof から、ユーザーまたはCodexが指定する任意の eligible leaf refs を安全に approve / unapprove / execute できるようにすること。これは smart import ではなく、明示操作の一般化である。

理由:

- PSD主入力を実用化するには、sample固定leaf以外も同じ安全境界で扱える必要がある。
- Codexが後続のrigging操作を行うには、import後の `part` / `drawable` / `texture` / `mesh` / operation evidence refs が安定して機械可読である必要がある。
- Wave48のcandidate plan / approval digest / approved-leaf-only execution基盤を再利用できる。
- all-layer one-click import、recursive group auto import、group-as-artmesh import、Photoshop風compositing、deformer auto placementへ進む前に、明示 leaf approval / result evidence / failure taxonomy を固めるのが安全である。
- ユーザー判断なしに進めることは優先価値ではない。今回はユーザーが、Codex-friendly explicit leaf intake generalizationを次priorityとして承認した。

## 4. Repository Facts

- Wave48 final integration rerun / clean review は `pass` であり、latest final implementation-proven baselineである。
- Editorは明示PSD import session、browser parser bridge、layer tree、import-plan preview、eligible leaf approval/unapproval、approved-leaf-only batch intake workflowを持つ。
- Browser candidate serviceは明示 `psd:root` / group refs から leaf candidates を列挙し、candidate plan digest、source identity、statuses/reasons、byte estimates、generated scaffold preview、approval default `notApproved` を返せる。
- Package/operation import-plan approval bridgeはcandidate/approval digest、source identity、approved refs/order、destination parent、not-approved/blocked candidates、generated scaffold preview/resolved IDsをpreflightできる。
- Validator/Product Preflight diagnosticsは import-plan bridge mismatch、blocked/not-approved/unsupported/hidden/empty/byte-cap/collision/partial/stale-source/current-byte-missing/private-local provenance states を扱える。
- Focused e2e `psdImportPlanFocused` は `sample_model.psd`、`psd:root`、`126` candidates、固定3 leaf approval、batch execution、save/load、portable boundary、parser boundary、non-persistenceを検証している。
- `packages/ai-interface` は transport-independent / in-process command surface、Codex proposal operation catalog、proposal validation、dry-run diff、rerun validation、approval lifecycle bridgeを持つ。
- 現時点では、Wave48固定3 leaf以外の任意eligible leaf approval/executionをCodex-facing surfaceから安定して扱うこと、結果refs/taxonomyを後続操作に十分な粒度で露出することは未実装または未実証である。

## 5. Design Decisions

- Wave49は「任意の eligible leaf refs を明示 approve して実行できる」範囲に限定する。
- Candidate discoveryはWave48のroot/group import-plan previewを使う。Wave49はgroup/rootそのものを自動importしない。
- 実行対象は、ユーザーまたはCodexが明示した approved leaf refs のみである。
- Codex-facing supportは、repo/editorが提案するのではなく、外部Codexが指定した明示操作をdry-run / validate / execute / inspectできるようにする。
- Editor UIはsimple approve / unapprove / execute / result viewに留める。
- If all eligible leaves are approved one-by-one or by an explicit externally supplied approval list, that is still explicit approval. It must not be marketed or implemented as one-click all-layer import.
- Result evidence must expose stable generated refs for later operations: source candidate refs, approved layer refs, generated texture refs, drawable refs, mesh refs, part refs, operation IDs, and failure/blocked issues where applicable.
- Failure taxonomy must be machine-readable and stable enough for Codex to recover: stale plan, stale approval, candidate not found, candidate blocked, not approved, collision, destination parent missing, source identity mismatch, byte unavailable, byte cap exceeded, partial failure, unsupported candidate, hidden candidate, current-session source missing, private/local provenance failure.
- Source PSD bytes and raw parser objects remain session-only and are not persisted as package/session capability.
- Canonical materialized media type remains `application/vnd.ai-native-live2d.raw-rgba; pixelFormat=rgba8`.

## 6. Non-Goals

- Editor/repo-side proposal generation, repair generation, candidate ranking, semantic classification, natural-language repair, LLM provider integration, prompt loop, auto-fix, automatic commit.
- `Suggest rig`, `Auto classify`, `Recommended deformers`, `Auto repair`, `Generate proposal`, or similar smart Editor UI.
- Level 3 automation: repo/editor autonomous proposal, inference, semantic recognition, or inferred edit execution.
- HTTP / WebSocket / MCP server / external transport implementation.
- PSD all-layer one-click import.
- Recursive group auto import.
- Group-as-artmesh import.
- Automatic part hierarchy inference from PSD group hierarchy.
- Deformer / parameter / keyform / warp lattice / physics auto generation.
- Drag-drop, directory picker, File System Access API, ZIP/archive/native filesystem/cloud transport.
- PNG image set workflow expansion.
- Photoshop風full compositing、layer effects完全再現、blend mode完全再現、mask/clipping/color-management correctness。
- full renderer、standalone viewer app、render target、texture sampling correctness、pixel oracle。
- Cubism SDK/Core integration、Cubism import/export/load compatibility、`.moc3`、`.model3.json`、Cubism Physics compatibility。
- Public demo asset、sample PSD由来visual bytesのpublic screenshots/exports/bundles。
- Broad refactor of part/texture/drawable systems only to make generalized leaf intake convenient.

## 7. Basis Documents

Undineが保持する最小basis:

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/design/codex-friendly-automation-policy.md`
- `discussion/implementation/orchestration/wave49-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/waves/wave48/wave48-final-integration-report.md`
- `discussion/implementation/reviews/wave48/wave48-final-integration-review.md`

Domain basis as needed:

- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/diagnostic-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/tests/fixtures/fixture-manifest.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- Wave44-Wave48 PSD parser/materialization/import/intake/import-plan reports and reviews
- Wave8-Wave10 and Wave40-Wave41 ai-interface / proposal / preflight reports and reviews where Codex-facing API domains need them
- Domain-specific target source and tests

UndineはEditor source、parser source、operation source、validator source全文を自分で読み込まない。詳細source、diff、test evidenceはOrch-Sylphがdomain必要分だけ読み、Gnome / Review-Sylphへ狭く渡す。

## 8. Dependency / Parallel Design

Wave49は最初にCodex-friendly explicit operation boundaryとgeneralized leaf approval/result taxonomyを固定する。その後、package/operation result evidenceとCodex-facing in-process surfaceを進め、Editor UXとvalidator alignmentを統合し、focused e2eとdocs/final integrationへ進む。

| Batch | Domain | Parallelism | Dependency | Purpose |
|---|---|---|---|---|
| 1 | A. Boundary / target inventory / operation parity | Solo first | Wave48 final pass | 任意eligible leaf approval、Codex-friendly human-equivalent operation boundary、sample target expansion、result ref/taxonomyを固定する |
| 2 | B. Package / operation generalized approval-result bridge | Solo or parallel with read-only C prep | A | approved leaf refsの一般化、result evidence、partial/failure taxonomy、stable generated refsをoperation/package surfaceに固定する |
| 3 | C. Codex-facing in-process command / proposal intake surface | After B | B | existing `packages/ai-interface` / in-process hostからimport plan inspect、approval list指定、dry-run/execute/result inspectを扱えるようにする |
| 3 | D. Editor explicit leaf approval UX generalization | Parallel with E after B/C contracts | B + C | UIをsimple approve/unapprove/execute/result viewに保ちつつ、固定3 leaf以外の任意eligible leaf approval pathを実用化する |
| 3 | E. Validator / Product Preflight generalized diagnostics | Parallel with D | B | generalized approvals、partial/failure/result refs、Codex-readable issue taxonomyをdiagnosticsへ接続する |
| 4 | F. Focused e2e / Codex-facing regression | Solo after D/E | C + D + E | sample PSDで任意eligible leaf approval、blocked/partial/collision/stale cases、Codex-facing in-process path、existing focused ids preservationを検証する |
| 5 | G. Documentation / traceability refresh | Solo after F | F | capability map、backlog、maps、fixture/traceabilityをWave49実装範囲へ同期する |
| 6 | H. Integration review and final report | Solo after G | G | final verification、clean integration review、final report、map/backlog更新を行う |

Safety constraints:

- A is a semantics owner and must not be split across multiple Gnomes.
- B owns package/operation result evidence and must not edit Editor UI or ai-interface command host except through public contracts.
- C owns Codex-facing schemas/commands/host integration and must not implement repo-side proposal generation or external transport.
- D owns Editor UX/workflow and must not add smart suggestion UI.
- E owns validator/Product Preflight diagnostics and must not add parser execution.
- F owns focused e2e/regression/guard updates and must not add product behavior beyond narrow test hooks.
- G owns docs/maps/traceability only.
- H owns final review/report and must return needs_fix if source changes are required.

## 9. Domain Assignments

### A. `wave49-boundary-target-inventory-operation-parity`

Purpose:

- Fix the boundary for arbitrary eligible leaf approval without all-layer one-click import.
- Decide sample targets beyond Wave48 fixed3 leaves for focused e2e, including at least one non-Wave48 eligible leaf and one blocked/not-approved/unsupported/hidden or stale-state case if available.
- Specify stable result refs and machine-readable failure taxonomy required by Codex.
- Confirm that Editor/repo automation remains within [codex-friendly-automation-policy.md](../../design/codex-friendly-automation-policy.md).

Allowed write scope:

- `discussion/implementation/waves/wave49/**`
- `discussion/implementation/reviews/wave49/**`
- narrow backlog/capability note only if needed

Forbidden:

- Source implementation
- smart automation/proposal claims
- all-layer one-click import / recursive group auto import / group-as-artmesh import claims
- dependency registry / package manifest / lockfile changes

### B. `wave49-package-operation-generalized-approval-result-bridge`

Purpose:

- Generalize import-plan approval/result evidence from fixed representative leaves to arbitrary approved eligible leaf refs.
- Return stable generated refs and per-approved-leaf success/failure records suitable for later Codex operations.
- Make stale plan/approval, missing candidate, blocked candidate, collision, destination parent, source identity, and partial failure issues machine-readable.

Allowed write scope:

- `packages/package-format/src/**`
- `packages/operation-core/src/**`
- focused package/operation tests
- `discussion/implementation/waves/wave49/**`
- `discussion/implementation/reviews/wave49/**`

Forbidden:

- direct parser dependency import in `packages/**`
- Editor UI
- `packages/ai-interface` command host implementation except exported contract use after coordination
- validator-core diagnostics
- proposal generation / auto-fix / auto-commit
- public schema-breaking rename unless escalated

### C. `wave49-codex-facing-import-plan-command-surface`

Purpose:

- Extend existing `packages/ai-interface` / in-process command host surface so Codex can perform human-equivalent explicit PSD import-plan operations.
- Provide deterministic commands or proposal-operation catalog entries for reading current import plan state, supplying explicit approved leaf refs, dry-running/preflighting where supported, executing approved intake, and reading result refs.
- Keep the repo as intake/validation/execution surface only; Codex owns proposal generation.

Allowed write scope:

- `packages/contracts/src/**` if shared DTOs are required
- `packages/ai-interface/src/**`
- `apps/editor/src/**` only for in-process host routing / workflow command bridge
- focused ai-interface/editor host tests
- `discussion/implementation/waves/wave49/**`
- `discussion/implementation/reviews/wave49/**`

Forbidden:

- HTTP / WebSocket / MCP server or any external transport
- LLM/provider/prompt integration
- repo-side proposal generation, semantic classification, candidate ranking, auto-fix, automatic commit
- smart Editor UI
- package manifest / lockfile changes unless escalated
- parser scope expansion

### D. `wave49-editor-explicit-leaf-approval-generalization-ux`

Purpose:

- Keep the Editor PSD Import panel simple while making arbitrary eligible leaf approval practical.
- Ensure fixed Wave48 leaves are no longer special-cased in UI logic.
- Show result refs and per-leaf success/failure summaries in a way that humans can inspect and Codex-facing host can mirror.

Allowed write scope:

- `apps/editor/src/**`
- `apps/editor/e2e/**` only for narrow test-id hooks if needed
- focused Editor workflow/UI tests
- `discussion/implementation/waves/wave49/**`
- `discussion/implementation/reviews/wave49/**`

Forbidden:

- `Suggest`, `Auto`, `Recommended`, or semantic classification UI
- native drag-drop
- directory picker / File System Access API / archive
- all-layer one-click import / recursive group auto import
- full renderer / Photoshop compositing preview
- package contract changes not coordinated with B/C
- public demo asset wording

### E. `wave49-validator-product-preflight-generalized-import-diagnostics`

Purpose:

- Extend validator/Product Preflight import-plan diagnostics for generalized approvals and result refs.
- Ensure Codex-readable failure taxonomy is represented truthfully in diagnostics and not-evaluated states.
- Preserve parser-free validator boundary.

Allowed write scope:

- `packages/validator-core/src/**`
- focused validator/Product Preflight tests
- `discussion/implementation/waves/wave49/**`
- `discussion/implementation/reviews/wave49/**`

Forbidden:

- parser implementation
- direct parser dependency import in validator-core
- Editor UI
- Product Preflight persisted/exported artifact
- proposal generation or auto repair semantics
- full renderer / pixel oracle proof

### F. `wave49-focused-e2e-codex-facing-regression`

Purpose:

- Add focused regression for arbitrary eligible leaf approval beyond the fixed Wave48 three-leaf path.
- Verify Codex-facing in-process command / proposal-intake path can perform the same explicit operations as a human without repo-side suggestion logic.
- Preserve `psdImportPlanFocused`, `psdMultiLayerBatchFocused`, and `psdImportFocused`.
- Verify failure/taxonomy paths such as stale approval or blocked candidate where feasible.

Allowed write scope:

- `apps/editor/e2e/**`
- `scripts/**` focused e2e registry/guard updates if required
- `discussion/tests/fixtures/fixture-manifest.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/implementation/waves/wave49/**`
- `discussion/implementation/reviews/wave49/**`

Forbidden:

- Product implementation beyond regression hooks
- public demo asset claims
- broad aggregate e2e runtime expansion without focused registry control
- smart automation or proposal generation implementation

### G. `wave49-docs-traceability-boundary-refresh`

Purpose:

- Update capability map, backlog, implementation maps, fixture manifest, and traceability matrix to reflect Wave49 exactly.
- Make clear that Wave49 generalizes explicit eligible leaf approval and Codex-friendly operation surfaces, not automatic rigging or smart import.

Allowed write scope:

- `discussion/_map.md` if top-level current status needs updating
- `discussion/design/_map.md` if policy references need final wording
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`
- `discussion/tests/fixtures/fixture-manifest.md` if narrow registration is needed
- `discussion/tests/traceability/test-traceability-matrix.md` if narrow registration is needed
- `discussion/implementation/waves/wave49/**`
- `discussion/implementation/reviews/wave49/**`

Forbidden:

- Source implementation
- unsupported capability claims
- broad docs rewrite unrelated to Wave49

### H. `wave49-integration-review-and-final-report`

Purpose:

- Integrate Domains A-G, run final verification, produce clean integration review and final report, and update maps/backlog.

Allowed write scope:

- `discussion/implementation/waves/wave49/**`
- `discussion/implementation/reviews/wave49/**`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`
- `discussion/_map.md` if final baseline status needs top-level sync
- narrow final bookkeeping in traceability/fixture docs if required

Forbidden:

- Orch-Sylph自身によるsource code edits。source fixが必要な場合はGnomeに明示委譲し、Review-Sylphで再レビューする。
- Broad documentation rewrite unless Wave49 evidence registration requires it and scope is narrow.

## 10. Subagent / Orch-Sylph Execution Policy

Wave49起動時の実行単位はdomainごとのOrch-Sylphである。

1. UndineはDomain AのOrch-Sylphを単独投入する。
2. Domain Aが`pass`したら、UndineはDomain Bを投入する。CはBのresult/evidence contractを前提にする。
3. Domain Bが`pass`したら、UndineはDomain Cを投入する。
4. Domain Cが`pass`したら、UndineはDomain D / Eを並列投入できる。
5. Domain D / Eが`pass`したら、UndineはDomain Fを投入する。
6. Domain Fが`pass`したら、UndineはDomain Gを投入する。
7. Domain Gが`pass`したら、UndineはDomain Hを投入する。
8. 各Orch-Sylphは自分でsource実装せず、domain内でGnome実装とReview-Sylphレビューを別コンテキストに分離する。
9. Review-Sylphはclean contextで、implementation notesではなくbasis docs、target files、diff、testsを根拠にレビューする。
10. Subagentからユーザーへ直接質問してはならない。質問はOrch-Sylphが集約し、Undineが重複排除してユーザーへ確認する。
11. Undineはcompletion reportが`pass`でないdomainをwave gate通過扱いにしない。
12. 長時間処理でも、UndineとOrch-Sylphは待機を理由にsubagentを打ち切らない。

Each assignment must include:

```text
Orch-Sylph自身は実装担当ではない。source implementation は必ず別コンテキストの Gnome に委譲し、レビューは必ず別コンテキストの Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。
```

## 11. Review Lanes

Every domain review must check:

- Automation Policy: repo/editor did not add proposal generation, semantic inference, smart classification, recommendation UI, auto-fix, or automatic commit.
- Human-equivalent Codex Operation: Codex-facing API performs explicit operations equivalent to human UI, not hidden higher-level inference.
- Approval Boundary: materialization execution is limited to explicitly approved eligible leaf refs.
- Candidate/Result Ref Stability: candidate refs, approved refs, generated refs, operation IDs, evidence IDs, and diagnostic IDs are stable enough for follow-up operations.
- Failure Taxonomy: stale plan, stale approval, blocked candidate, missing candidate, collision, source identity mismatch, destination parent failure, byte unavailability, and partial failure are machine-readable.
- Persistence Truthfulness: raw parser object, source PSD bytes, session import-plan bridge capability, and public demo asset claims are not persisted as unsupported capabilities.
- Parser Boundary: `@webtoon/psd` direct import stays limited to approved adapter / Wave44 scripts.
- Source Organization: source edits respect barrel-only `index.ts`, catch-all file, and large source guardrails.
- Test Adequacy: arbitrary eligible leaf path, Codex-facing path, failure/taxonomy path, focused e2e, and existing PSD focused ids are covered.
- Non-Goals: all-layer one-click import, recursive group auto import, group-as-artmesh import, drag-drop/filesystem/archive, full compositing, renderer/pixel oracle, Cubism, public demo asset, repo-side LLM/autofix remain out of scope.
- Orchestration Compliance: Orch-Sylph did not implement directly; Gnome implementation and Review-Sylph review are separated.

## 12. Verification Plan

Domain minimum verification:

- Domain A: boundary report/review, sample target inventory, automation-policy consistency check, `git diff --check`.
- Domain B: package/operation tests for generalized approvals, stable result refs, partial/failure taxonomy, backward compatibility with Wave48 fixed3 path.
- Domain C: ai-interface / in-process host tests for import plan read/approval/execute/result inspect; operation catalog unsupported-boundary tests for no proposal generation / no external transport.
- Domain D: Editor workflow/UI tests for arbitrary eligible leaf approval and simple UI wording.
- Domain E: validator/Product Preflight tests for generalized result/failure taxonomy and truthful not-evaluated states.
- Domain F: focused e2e/regression for non-Wave48 leaf approval, Codex-facing in-process operation path, failure/stale/blocked path where feasible, parser boundary guard, focused registry checks.
- Domain G: docs/map/traceability consistency checks and `git diff --check`.
- Domain H: final full verification and clean integration review.

Final verification:

- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm test:e2e`
- Wave49 focused e2e/regression command
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
- forbidden-scope scan for smart automation, suggestion UI, proposal generation, auto classify, auto-fix, automatic commit, all-layer one-click import, recursive group auto import, group-as-artmesh import, drag-drop/filesystem/archive, full compositing, renderer/pixel oracle, Cubism, public demo asset, persisted source PSD bytes/raw parser objects

## 13. Early Escape / User Decision Points

Orch-Sylph must escalate if:

- Implementation requires repo/editor-side proposal generation or semantic interpretation.
- Implementation requires `Suggest`, `Auto classify`, `Recommended deformers`, auto-rigging, or repair UI.
- Implementation requires HTTP / WebSocket / MCP server or other external transport.
- Candidate approval generalization requires all-layer one-click import or recursive group auto import semantics.
- Group-as-artmesh or Photoshop-style compositing is needed to make the feature useful.
- Deformer, parameter, keyform, warp lattice, or physics auto generation becomes necessary.
- Browser memory/performance requires workerization or size cap changes beyond a conservative default.
- Existing texture/part/drawable mapping cannot expose stable refs without public schema-breaking changes.
- Existing ai-interface/proposal API cannot represent human-equivalent explicit operations without changing the product automation policy.
- Direct parser import is needed in packages/runtime/validator.
- Save/load/portable bundle semantics require a product decision.
- Public demo asset化やsample PSD由来visual bytesの公開判断が必要になる。
- Cubism compatibility claimが必要になる。
- Parallel domains need to edit the same files.

No additional user question is required before starting Wave49 under this plan. The user has approved the Wave49 direction and automation policy. If the desired direction changes to renderer/compositing, archive/filesystem, public demo assets, or Cubism compatibility, replace this plan before launch.

## 14. Pass Criteria

Wave49 passes when:

- Arbitrary eligible PSD leaf refs from an import plan can be explicitly approved and executed without fixed3 special-casing.
- Codex can perform the same explicit import-plan operations through existing in-process / ai-interface surfaces without repo-side proposal generation.
- Result evidence exposes stable generated `part` / `drawable` / `texture` / `mesh` refs and operation/evidence IDs for follow-up operations.
- Failure/blocked/partial/stale/collision/source identity issues are machine-readable.
- Editor UI remains simple and does not add suggestion, recommendation, semantic classification, or automatic rigging controls.
- Validator/Product Preflight reflects generalized import-plan result states truthfully.
- Focused e2e proves a non-Wave48 arbitrary eligible leaf path, preserves existing PSD focused paths, and covers at least one stale/blocked/failure taxonomy path where feasible.
- Source PSD bytes, raw parser objects, and session import-plan bridge capability are not persisted as package/session capability.
- No all-layer one-click import, no recursive group auto import, no group-as-artmesh import, no drag-drop/filesystem/archive, no full compositing/renderer/pixel oracle, no Cubism, no public demo asset, no repo-side LLM/autofix/proposal generation.
- `index.ts` files remain barrel-only and source organization guardrails pass.
- Domain completion reports, Review-Sylph reviews, final integration report, clean review, and map/backlog updates are recorded under `discussion/implementation/`.
