# Wave29 Domain C Re-review: Validator Mesh Topology Diagnostics

## Verdict

pass

## Findings

No blocking or non-blocking findings found in the fix-iteration re-review.

The prior finding is fixed. `validateRuntimeMeshEvidence` now inspects supplied per-drawable `runtimeSnapshot.drawables[].mesh` evidence and emits deterministic `mesh.runtimeEvidenceMissing` diagnostics for:

- missing runtime snapshot when viewer/runtime mesh evidence is required: `packages/validator-core/src/validators/mesh-semantics.ts:179`;
- missing runtime drawable row when required: `packages/validator-core/src/validators/mesh-semantics.ts:198`;
- missing nested drawable mesh evidence: `packages/validator-core/src/validators/mesh-semantics.ts:261`;
- inconsistent nested drawable mesh evidence: `packages/validator-core/src/validators/mesh-semantics.ts:280`;
- deterministic `mesh.runtimeEvidenceMissing` result construction with reason evidence and snapshot IDs: `packages/validator-core/src/validators/mesh-semantics.ts:550`.

## Design / Development Compliance

- Severity semantics match the validator contract: triangle index out of range is `blocking`, stable ID and UV count mismatches are `error`, degenerate triangles are `warning`, and mesh runtime evidence gaps are `error` (`packages/validator-core/src/validators/mesh-semantics.ts:407`, `packages/validator-core/src/validators/mesh-semantics.ts:434`, `packages/validator-core/src/validators/mesh-semantics.ts:466`, `packages/validator-core/src/validators/mesh-semantics.ts:499`, `packages/validator-core/src/validators/mesh-semantics.ts:527`; contract at `discussion/design/module-contracts/validator-contract.md:84`).
- Editor-only stale selected vertex refs remain `editorState.staleReference` warnings with `runtimeSemantics=unchanged`, and current mesh `vertexStableIds` are valid editor targets (`packages/validator-core/src/validators/part-layer-semantics.ts:57`, `packages/validator-core/src/validators/part-layer-semantics.ts:495`; contract at `discussion/design/module-contracts/validator-contract.md:176`).
- Scope containment is respected. The changes stay in validator-core plus validator contract/review artifacts; no operation handler, runtime evaluator, editor UI, broad preflight redesign, dependency, or manifest change was introduced.
- `packages/validator-core/src/index.ts:17` remains barrel-only.
- Check IDs follow the dot-separated lower camelCase convention and are registered in the catalog (`packages/validator-core/src/check-catalog.ts:427`, `packages/validator-core/src/check-catalog.ts:435`, `packages/validator-core/src/check-catalog.ts:443`, `packages/validator-core/src/check-catalog.ts:451`, `packages/validator-core/src/check-catalog.ts:459`).

## Test Adequacy

Coverage is adequate for Domain C:

- valid mesh edit state with runtime/viewer evidence: `packages/validator-core/src/mesh-topology-diagnostics.test.ts:42`;
- invalid triangle index, repeated-index degenerate triangle, vertexStableIds length mismatch, and UV count mismatch: `packages/validator-core/src/mesh-topology-diagnostics.test.ts:63`;
- zero-area degenerate triangle: `packages/validator-core/src/mesh-topology-diagnostics.test.ts:141`;
- stale selected vertex refs as editor-only warning: `packages/validator-core/src/mesh-topology-diagnostics.test.ts:180`;
- missing runtime snapshot mesh evidence: `packages/validator-core/src/mesh-topology-diagnostics.test.ts:215`;
- missing nested `drawables[].mesh` evidence: `packages/validator-core/src/mesh-topology-diagnostics.test.ts:240`;
- inconsistent nested `drawables[].mesh` evidence: `packages/validator-core/src/mesh-topology-diagnostics.test.ts:277`;
- missing runtime drawable row in supplied viewer snapshot: `packages/validator-core/src/mesh-topology-diagnostics.test.ts:322`;
- adjacent validator compatibility: focused mask and part/texture/layer tests plus full validator-core test run passed.

## Verification Performed

- `pnpm.cmd exec vitest run packages/validator-core/src/mesh-topology-diagnostics.test.ts packages/validator-core/src/mask-composition-diagnostics.test.ts packages/validator-core/src/part-texture-layer-diagnostics.test.ts` passed: 3 files, 28 tests.
- `pnpm.cmd exec vitest run packages/validator-core/src` passed: 18 files, 106 tests.
- `pnpm.cmd typecheck` passed.
- `git diff --check -- packages/validator-core/src discussion/design/module-contracts/validator-contract.md discussion/implementation/waves/wave29 discussion/implementation/reviews/wave29` passed with line-ending warnings only.
- `rg -n "[ \t]+$" ...` over the Domain C tracked and untracked artifacts found no trailing whitespace.
- `git diff -- package.json pnpm-lock.yaml pnpm-workspace.yaml` produced no dependency or manifest diff.

## Remaining Issues / User Decision Points

None for Domain C.
