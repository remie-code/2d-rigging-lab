# Wave68 Domain A Spec Compliance Review

- Verdict: `pass`
- Lane: Spec Compliance Review
- Domain: `wave68-v6-shared-contract-dependency-gate-method-surface`
- Reviewer: Review-Sylph
- Date: 2026-06-14

## Scope

Reviewed the Wave68 Domain A shared contract/dependency gate implementation against the Wave68 plan, v6 mesh-generation design docs, Wave67 baseline, dependency policy, source files, tests, lockfile, and current diff. This review did not edit implementation files.

## Findings

### High: Required persistent Domain A dependency/report evidence is missing

Wave68 Domain A acceptance requires dependency decision and due-diligence notes to be recorded in the Domain A report (`discussion/implementation/orchestration/wave68-plan.md:347` through `:354`) and lists the expected Domain A report artifact at `discussion/implementation/orchestration/wave68-plan.md:597`. The dependency policy also requires dependency proposal/license/approval evidence before manifest/lockfile changes (`discussion/development_convention/dependency-policy.md:95` through `:96`, `:331` through `:341`).

Repository evidence does show the package and lockfile additions, focused tests passing, and the dependency guard passing. However, `discussion/implementation/waves/wave68/` is empty in this worktree, and repository search found no persistent Domain A report or user-installed package note. Because the review request explicitly asks to verify the dependency due-diligence basis including the user-installed package note, this cannot pass from repository evidence as currently persisted.

Required change: persist the Domain A report, or otherwise add the required durable dependency decision record, including the user-installed package note, license/provenance rationale, lockfile/transitive dependency summary, and guard/test evidence. No implementation source change is required by this finding if the missing report already exists outside the worktree.

Fix Loop 1 status: resolved. The Domain A report is now present and mapped, records the user-installed package note, dependency decisions, transitive dependency notes, lockfile/install evidence, and dependency guard evidence. See the Fix Loop 1 Re-review section below.

## Requirement Classification

| Requirement | Classification | Evidence |
|---|---|---|
| Add `auto-outline-v6a-local`, `auto-outline-v6b-constrainautor`, `auto-outline-v6c-poly2tri` method IDs | implemented | `packages/authoring-core/src/mesh-generation-contract.ts:7` through `:11`, `:78` through `:88` |
| Add `outline-v6a-local-rgba`, `outline-v6b-constrainautor-rgba`, `outline-v6c-poly2tri-rgba` source IDs | implemented | `packages/authoring-core/src/mesh-generation-contract.ts:13` through `:17`, `:93` through `:103` |
| Headless generation path accepts all v6 candidates | implemented | `createGeneratedMeshForDrawable` dispatches v6 methods at `packages/authoring-core/src/mesh-generation.ts:116` through `:124`; tests cover all candidates at `packages/authoring-core/src/mesh-generation.test.ts:1135` through `:1195` |
| Operation allowlist accepts all v6 candidates | implemented | operation schema imports shared enum at `packages/operation-core/src/payloads/model-edit.ts:19`, uses it at `:151` through `:155`; operation tests cover all candidates at `packages/operation-core/src/operations/generate-mesh.test.ts:396` through `:445` |
| Preview apply allowlist accepts v6 candidate methods | implemented | `GENERATED_MESH_PREVIEW_COMMIT_METHOD_IDS` includes v6 methods at `packages/authoring-core/src/mesh-generation-contract.ts:107` through `:116`; operation precondition uses it at `packages/operation-core/src/operations/generate-mesh.ts:212` through `:220`; test at `packages/operation-core/src/operations/generate-mesh.test.ts:448` through `:469` |
| Current default remains `auto-outline-v2.6-soft-apron` | implemented | command default at `apps/editor/src/features/editor-session/model/editor-session-commands.ts:274` through `:280`; Mesh Tool preview/apply pass V2.6 at `apps/editor/src/features/editor-session/editor-session-context.tsx:646` through `:655` and `:681` through `:690`; default test starts at `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts:609` |
| Shared v6 quality/fallback metadata shape exists | implemented | `MeshGenerationV6Metrics` at `packages/authoring-core/src/mesh-quality-metrics.ts:140` through `:166`; backend diagnostics at `:168` through `:188`; metrics are attached at `packages/authoring-core/src/mesh-generation.ts:970` through `:1008` |
| Metadata distinguishes dependency availability from backend implementation deferral | implemented | candidate records have `dependencyGateStatus` and `backendImplementationStatus` at `packages/authoring-core/src/mesh-generation-contract.ts:42` through `:76`; fallback provenance records dependency available/not-required and backend deferred at `packages/authoring-core/src/mesh-generation.ts:1027` through `:1036` |
| Fallback/blocker metadata does not claim v6 backend output | implemented | v6 fallback returns `v6-backend-not-implemented`, `blocked`, or `fallback-output` at `packages/authoring-core/src/mesh-generation.ts:951` through `:981` and `:1012` through `:1025`; tests assert non-success fallback metadata at `packages/authoring-core/src/mesh-generation.test.ts:1135` through `:1255` |
| Shared fixtures cover rectangle, curved blob, thin tapered, hole-like, empty alpha fallback | implemented | fixture IDs and shapes at `packages/authoring-core/src/mesh-generation-v6-fixtures.ts:3` through `:90`; fixture helper at `:104` through `:106`; test at `packages/authoring-core/src/mesh-generation.test.ts:1080` through `:1133` |
| Deterministic contract tests avoid exact triangle-layout overfitting | implemented for Domain A | Tests assert IDs, fixture bytes, metadata, counts, and fallback state rather than exact v6 triangle layouts at `packages/authoring-core/src/mesh-generation.test.ts:1080` through `:1255` |
| Coordinate dependency-policy checks before C/D rely on dependencies | implemented after Fix Loop 1 | Source and lockfile include the five expected dependencies (`packages/authoring-core/package.json:13` through `:17`; `pnpm-lock.yaml:121` through `:146`), `node scripts/check-dependencies.mjs` passed, and the Domain A report now records user-installed package state, dependency decisions, and guard evidence at `discussion/implementation/waves/wave68/wave68-domain-a-v6-shared-contract-dependency-gate-method-surface-report.md:34` through `:44` and `:93` through `:126`. |
| Dependency due-diligence basis is adequate for Domain A | implemented after Fix Loop 1 | `auto-outline-v6-library-candidate-inventory.md:35` through `:45` documents candidate license/risk basis and `:60` through `:67` lists due diligence checks. The Domain A report now records direct dependency licenses/scopes/decisions at `discussion/implementation/waves/wave68/wave68-domain-a-v6-shared-contract-dependency-gate-method-surface-report.md:93` through `:104`, transitive notes at `:106` through `:112`, and install/lockfile evidence at `:114` through `:126`. |
| Typecheck and focused tests pass | implemented | `pnpm.cmd typecheck` passed. Focused Vitest rerun passed 2 files / 53 tests. |
| V6A local backend implementation | deferred by plan | Domain A only establishes contract; Domain B owns implementation per `discussion/implementation/orchestration/wave68-plan.md:363` through `:399` |
| V6B constrainautor backend implementation | deferred by plan | Domain C owns implementation per `discussion/implementation/orchestration/wave68-plan.md:400` through `:433` |
| V6C poly2tri backend implementation | deferred by plan | Domain D owns implementation per `discussion/implementation/orchestration/wave68-plan.md:434` through `:466` |
| Editor temporary backend selector | deferred by plan | Domain E owns UI selector per `discussion/implementation/orchestration/wave68-plan.md:468` through `:505` |
| Do not switch default to v6 | implemented | No v6 default found; current default evidence listed above |
| Do not treat backend selector as final UX | not relevant to Domain A | No Editor selector implementation in Domain A scope |
| Do not introduce dependencies without policy compliance | implemented after Fix Loop 1 | The Domain A report records no forbidden Cubism/proprietary/binary/model-pack dependency, guard pass, and the scoped rationale for using the report as the Wave68 dependency decision record at `discussion/implementation/waves/wave68/wave68-domain-a-v6-shared-contract-dependency-gate-method-surface-report.md:122` through `:126`. Machine-readable registry synchronization remains a documented follow-up question for Domains C/D, not a remaining Spec Compliance blocker for this Domain A report issue. |
| Do not reuse old V1-V5/grid/envelope/apron/contour-band/recursive-ring implementations as v6 algorithm basis | implemented for Domain A | No v6 backend algorithm is implemented. The v6 branch uses `createAlphaAwareGridMesh` only as explicit fallback and records actual source/fallback metadata at `packages/authoring-core/src/mesh-generation.ts:939` through `:981`. Old outline implementations remain outside the v6 branch. |
| No forbidden Domain A scope changes | implemented | Edits are package manifests/lockfile plus authoring-core/operation-core contract/test files. Editor default references remain V2.6. |

## Verification Performed

Read basis documents:

- `discussion/implementation/orchestration/wave68-plan.md`
- `discussion/implementation/waves/wave68-preplan-mesh-generation-replacement-inventory.md`
- `discussion/design/mesh-generation/auto-outline-v6-alpha-constrained-delaunay.md`
- `discussion/design/mesh-generation/auto-outline-v6-library-candidate-inventory.md`
- `discussion/design/mesh-generation/auto-outline-v6b-constrainautor.md`
- `discussion/design/mesh-generation/auto-outline-v6c-poly2tri.md`
- `discussion/design/mesh-generation/_map.md`
- `discussion/implementation/orchestration/wave67-plan.md`
- `discussion/implementation/waves/wave67/wave67-final-integration-report.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/development_convention/source-file-organization-policy.md`

Read implementation files and focused diff:

- `packages/authoring-core/package.json`
- `pnpm-lock.yaml`
- `packages/authoring-core/src/mesh-generation-contract.ts`
- `packages/authoring-core/src/mesh-generation-v6-fixtures.ts`
- `packages/authoring-core/src/index.ts`
- `packages/authoring-core/src/mesh-generation.ts`
- `packages/authoring-core/src/mesh-quality-metrics.ts`
- `packages/authoring-core/src/mesh-generation.test.ts`
- `packages/operation-core/src/payloads/model-edit.ts`
- `packages/operation-core/src/operations/generate-mesh.ts`
- `packages/operation-core/src/operations/generate-mesh.test.ts`

Commands/checks:

- `git status --short -uall`
- `git diff -- ...` for the Domain A source files and lockfile
- `rg` checks for v6 IDs, default method references, dependency names, old algorithm references, and missing report/user-installed note evidence
- `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation.test.ts packages/operation-core/src/operations/generate-mesh.test.ts`
  - First sandbox run failed at Vitest config load with Windows `spawn EPERM`.
  - Escalated rerun passed: 2 test files, 53 tests.
- `pnpm.cmd typecheck` passed.
- `node scripts/check-dependencies.mjs` passed.
- `git diff --check -- ...` reported only LF-to-CRLF working-copy warnings for scoped files.

## Residual Risks

- The v6 branch currently returns fallback meshes only. That is acceptable for Domain A but must not be misread as backend quality evidence for Domains B/C/D.
- Browser/Vite import behavior for the newly added geometry libraries is not proven by Domain A source because the libraries are not imported yet. That is acceptable only if Domains C/D verify import behavior before backend use, as required by the v6b/v6c specs.
- Machine-readable dependency registry synchronization remains a documented follow-up question for Undine before Domains C/D import the packages if strict registry evidence is required. The missing Domain A report/dependency note blocker is resolved for this Spec lane.

## Unresolved Questions / Decision Points

- No product/user decision is needed for Domain A source behavior.
- The Wave68 implementation map records an open orchestration question: whether `generated/dependencies/dependency-registry.json` must be synchronized before Domains C/D start, or whether the Domain A report is sufficient as the Wave68 dependency decision record until backend import work begins. This is not a remaining blocker for the Spec Compliance issue re-reviewed here.

## Fix Loop 1 Re-review

Scope: re-reviewed only the initial Spec Compliance blocker about missing persistent Domain A report / dependency decision due-diligence notes / user-installed package note, plus spec impact of the new Wave68 report and maps.

New artifacts read:

- `discussion/implementation/waves/wave68/wave68-domain-a-v6-shared-contract-dependency-gate-method-surface-report.md`
- `discussion/implementation/waves/wave68/_map.md`
- `discussion/implementation/reviews/wave68/_map.md`

Read-only checks performed:

- Confirmed the Domain A report and maps exist and are untracked additions in the current worktree.
- Extracted line-numbered evidence from the new Domain A report and maps.
- Confirmed the five reported installed package directories exist under `node_modules/.pnpm`:
  - `@kninnug+constrainautor@4.1.0`
  - `d3-contour@4.0.2`
  - `delaunator@5.1.0`
  - `poly2tri@1.5.0`
  - `simplify-js@1.2.4`

Resolution evidence:

- User-installed package note is recorded at `discussion/implementation/waves/wave68/wave68-domain-a-v6-shared-contract-dependency-gate-method-surface-report.md:34` through `:44`.
- Dependency decision and due-diligence section is recorded at `discussion/implementation/waves/wave68/wave68-domain-a-v6-shared-contract-dependency-gate-method-surface-report.md:93` through `:126`.
- Direct dependency license/scope/decision table is recorded at `discussion/implementation/waves/wave68/wave68-domain-a-v6-shared-contract-dependency-gate-method-surface-report.md:96` through `:104`.
- Transitive dependency notes are recorded at `discussion/implementation/waves/wave68/wave68-domain-a-v6-shared-contract-dependency-gate-method-surface-report.md:106` through `:112`.
- Lockfile/install/guard evidence is recorded at `discussion/implementation/waves/wave68/wave68-domain-a-v6-shared-contract-dependency-gate-method-surface-report.md:114` through `:120`.
- Dependency policy interpretation and registry follow-up boundary are recorded at `discussion/implementation/waves/wave68/wave68-domain-a-v6-shared-contract-dependency-gate-method-surface-report.md:122` through `:126`.
- Wave68 implementation map now points to the Domain A report at `discussion/implementation/waves/wave68/_map.md:10` through `:14` and records the registry synchronization question at `:22` through `:30`.

Conclusion: the specific Spec Compliance blocker is resolved under the Wave68 plan. The report now provides the durable dependency decision, due-diligence notes, and user-installed package note that were absent in the initial review. Registry synchronization remains visible as a follow-up question before backend import work if Undine requires it, but it does not keep this Spec Compliance lane at `needs_changes`.

## Final Verdict

`pass`

The implementation code and tests satisfy the Domain A shared contract surface, default preservation, metadata, fixture, allowlist, and firebreak checks I performed. Fix Loop 1 resolves the only Spec Compliance blocker by adding the persistent Domain A report, dependency decision/due-diligence notes, and user-installed package note.
