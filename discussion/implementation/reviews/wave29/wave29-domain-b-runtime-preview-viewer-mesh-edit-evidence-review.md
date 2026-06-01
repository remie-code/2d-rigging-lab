# Wave29 Domain B Runtime / Preview / Viewer Mesh Edit Evidence Review

Date: 2026-06-02
Reviewer: Review-Sylph
Target: `wave29-runtime-preview-viewer-mesh-edit-evidence`
Verdict: `pass`

## Scope Reviewed

Reviewed the requested Domain B files:

- `packages/runtime-core/src/mesh-evidence.ts`
- `packages/runtime-core/src/mesh-evidence.test.ts`
- `packages/runtime-core/src/normalized-runtime-graph.ts`
- `packages/runtime-core/src/snapshot.ts`
- `packages/runtime-core/src/runtime-evidence.ts`
- `packages/runtime-core/src/viewer-evaluation.ts`
- `packages/runtime-core/src/index.ts`
- `apps/editor/src/editor-preview/preview-dto.ts`
- `apps/editor/src/editor-preview/preview-projection.ts`
- `apps/editor/src/editor-preview/preview-mesh-evidence.test.ts`
- Supporting implementation report: `discussion/implementation/waves/wave29/domain-b-runtime-preview-viewer-mesh-edit-evidence-gnome-report.md`

The workspace also contains parallel Wave29 changes outside Domain B. They were not reviewed as this domain's implementation except where needed for compatibility and boundary checks.

## Basis Documents Used

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave29-plan.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/design/module-contracts/package-file-format-contract.md`
- `discussion/design/mvp-authoring-runtime/03-runtime-evaluation-semantics.md`
- `discussion/implementation/waves/wave17/wave17-final-report.md`
- `discussion/implementation/waves/wave28/wave28-final-report.md`
- `discussion/tests/traceability/test-traceability-matrix.md`

## Findings

No blocking, high, medium, or low-severity findings.

## Design / Development Compliance

Pass.

- Domain B stays within semantic runtime / preview / viewer evidence. The implementation records vertices, moved vertex refs, bounds/hash, topology summary, and preview state; it does not add a renderer, pixel oracle, topology editor, UV editor, parser, archive path, Cubism dependency, or SDK/Core integration.
- `packages/runtime-core/src/mesh-evidence.ts:20` owns the mesh evidence DTO/schema helpers as a focused runtime evidence file. `packages/runtime-core/src/index.ts:7` is a barrel-only export.
- Runtime snapshots add optional mesh evidence at `packages/runtime-core/src/snapshot.ts:79` and attach it after keyform / rig-control evaluation at `packages/runtime-core/src/snapshot.ts:382`, preserving the runtime pipeline.
- `buildRuntimeEvidence` exposes `meshEditEvidence` at `packages/runtime-core/src/runtime-evidence.ts:61` and creates it from baseline/candidate snapshots at `packages/runtime-core/src/runtime-evidence.ts:104`.
- Viewer evidence includes mesh edit evidence at `packages/runtime-core/src/viewer-evaluation.ts:137` and builds it with the same epsilon policy at `packages/runtime-core/src/viewer-evaluation.ts:329`.
- Preview projection keeps editor-only state outside runtime-core. Selected, locked, editor-hidden, runtime-visible/runtime-hidden, moved, and texture-backed vertex state is projected in `apps/editor/src/editor-preview/preview-projection.ts:124` and `apps/editor/src/editor-preview/preview-projection.ts:146`.
- Dependency policy is satisfied for this scope: no package manifest, workspace, or lockfile changes were present. Imports are limited to existing internal packages plus existing `zod` / `vitest` usage.
- Schema / ID posture is consistent with local runtime-core patterns and uses machine-readable values without spaces, such as `runtime-mesh-edit-evidence-v1` and deterministic mesh vertex refs from `packages/runtime-core/src/mesh-evidence.ts:175`.

## Test Adequacy

Pass.

- Runtime mesh evidence is covered at `packages/runtime-core/src/mesh-evidence.test.ts:16`: deterministic vertices, stable refs, topology counts, bounds, vertex hash, and moved vertex refs.
- Viewer-facing moved vertex evidence is covered at `packages/runtime-core/src/mesh-evidence.test.ts:94`.
- Preview projection coverage at `apps/editor/src/editor-preview/preview-mesh-evidence.test.ts:21` verifies selected, moved, locked, editor-hidden, runtime-hidden, and texture-backed vertex states.
- Compatibility tests passed for existing mask evidence, part/layer evidence, texture projection, runtime diff paths, rig-control evidence, dynamics evaluation, viewer runtime behavior, and existing preview projection.
- The implementation intentionally keeps moved vertex lists tied to full-detail snapshots. This matches the runtime semantics split where summary snapshots may carry counts/bounds/hash/topology while full snapshots carry full vertex arrays. Future fixture/e2e domains should request full detail when moved vertex refs are the acceptance oracle.

## Verification Performed

Passed:

- `pnpm.cmd exec vitest run packages/runtime-core/src/mesh-evidence.test.ts apps/editor/src/editor-preview/preview-mesh-evidence.test.ts`
  - 2 files passed, 3 tests passed.
- `pnpm.cmd exec vitest run packages/runtime-core/src/runtime-evidence.test.ts packages/runtime-core/src/viewer-evaluation.test.ts packages/runtime-core/src/layer-tree-evidence.test.ts apps/editor/src/editor-preview/preview-projection.test.ts apps/editor/src/editor-preview/texture-preview-resolution.test.ts packages/runtime-core/src/snapshot-comparison.test.ts packages/runtime-core/src/texture-projection.test.ts packages/runtime-core/src/rig-control-hierarchy-evidence.test.ts packages/runtime-core/src/rig-control-keyform-evidence.test.ts packages/runtime-core/src/dynamics-evaluation.test.ts`
  - 10 files passed, 39 tests passed.
- `pnpm.cmd typecheck`
- `git diff --check -- packages/runtime-core/src/mesh-evidence.ts packages/runtime-core/src/mesh-evidence.test.ts packages/runtime-core/src/normalized-runtime-graph.ts packages/runtime-core/src/snapshot.ts packages/runtime-core/src/runtime-evidence.ts packages/runtime-core/src/viewer-evaluation.ts packages/runtime-core/src/index.ts apps/editor/src/editor-preview/preview-dto.ts apps/editor/src/editor-preview/preview-projection.ts apps/editor/src/editor-preview/preview-mesh-evidence.test.ts`
  - No whitespace errors. Git emitted LF-to-CRLF working-copy warnings only.
- Forbidden/non-goal term scan over the reviewed Domain B files found no implementation path for Cubism SDK/Core, WebGL/canvas renderer, pixel oracle, topology editor, parser, archive, file picker, image decode, wasm, or Live2D integration. Hits were only existing `runtimeCore` identifiers.

## Remaining Issues

None for Domain B.

No full e2e run was performed by this reviewer. That is acceptable for this runtime/editor-preview evidence domain; Wave29 later workflow/e2e domains should cover browser persistence and UI integration.

## User-Decision Points

None.

## Blockers

None.

## Provisional Assumptions

- Domain B only needs to provide semantic evidence surfaces. It is not responsible for wiring the final canvas workflow UI or browser persistence smoke.
- Preview selected-vertex evidence can be supplied through the current preview projection input selection list; future integration may map dedicated mesh selection state into that input.
- Summary/targeted snapshots may omit full vertex arrays and therefore cannot be the sole oracle for moved vertex refs.
