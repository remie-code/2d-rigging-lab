# Wave33 Domain G Review: Wave30 Runtime Part Evidence Fixture Fix

## Verdict

pass

## Scope Reviewed

- `packages/validator-core/src/wave30-tutorial-mini-model-contract-fixtures.test.ts`
- `packages/runtime-core/src/wave30-tutorial-mini-model-contract-fixtures.test.ts`
- Relevant validator implementation in `packages/validator-core/src/validators/part-runtime-evidence.ts`
- Relevant runtime graph/evidence propagation in:
  - `packages/authoring-core/src/to-runtime-graph.ts`
  - `packages/authoring-core/src/runtime-graph-drawables.ts`
  - `packages/runtime-core/src/snapshot.ts`
  - `packages/runtime-core/src/viewer-evaluation.ts`

## Findings

No blocking findings.

The fix is correct for the reported final `pnpm.cmd test:unit` blocker. The Wave30 contract fixtures already backfilled runtime `parts` because the base authoring-to-runtime graph path does not materialize part-tree evidence. The change extends that fixture-local backfill to drawable membership evidence by copying each authoring drawable's `partId` into the normalized runtime graph drawables before runtime/viewer snapshots are evaluated.

Evidence:

- `packages/validator-core/src/wave30-tutorial-mini-model-contract-fixtures.test.ts:37` now evaluates the validator fixture viewer snapshot from `withRuntimePartEvidence(...)`, passing both `recipeResult.session.graph.parts` and `recipeResult.session.graph.drawables`.
- `packages/validator-core/src/wave30-tutorial-mini-model-contract-fixtures.test.ts:260` keeps the helper local to the contract fixture and only adds drawable `partId` evidence to the graph copy.
- `packages/runtime-core/src/wave30-tutorial-mini-model-contract-fixtures.test.ts:94` and `packages/runtime-core/src/wave30-tutorial-mini-model-contract-fixtures.test.ts:111` apply the same helper to both pre-mesh-edit and final tutorial runtime graphs.
- `packages/authoring-core/src/runtime-graph-drawables.ts:13` still builds normalized drawables without `partId`; therefore the fixture backfill is addressing missing fixture evidence, not weakening validator expectations.
- `packages/runtime-core/src/snapshot.ts:299` and `packages/runtime-core/src/viewer-evaluation.ts:324` propagate `drawable.partId` when it is present in the normalized runtime graph, so this backfill reaches both `runtimeSnapshot.drawables` and `viewerEvidence.drawableLayerEvidence`.

Wave33 `part.runtimeEvidenceMismatch` diagnostics are preserved. The validator implementation was not changed by this narrow fix, and it still emits deterministic failures for runtime snapshot identity staleness, part field mismatch, missing/extra part evidence, and drawable part membership mismatch:

- `packages/validator-core/src/validators/part-runtime-evidence.ts:109` and `packages/validator-core/src/validators/part-runtime-evidence.ts:120` emit stale runtime snapshot identity diagnostics.
- `packages/validator-core/src/validators/part-runtime-evidence.ts:185`, `packages/validator-core/src/validators/part-runtime-evidence.ts:208`, and `packages/validator-core/src/validators/part-runtime-evidence.ts:267` cover missing, extra, and field-mismatched part evidence.
- `packages/validator-core/src/validators/part-runtime-evidence.ts:295` still reports `reason=drawable-part-mismatch` when drawable membership evidence is missing or stale.
- `packages/validator-core/src/part-texture-layer-diagnostics.test.ts:491` and `packages/validator-core/src/part-texture-layer-diagnostics.test.ts:566` keep focused coverage for stale runtime/viewer part hierarchy evidence and stale runtime snapshot identity.

Scope is minimal. The reviewed diff only touches two fixture test files, adds no dependencies, changes no manifest or lockfile, and does not add implementation logic to `index.ts` or any catch-all module. The duplicated helper is acceptable in this narrow test-fixture context because both files independently construct Wave30 contract runtime graphs.

## Verification Run

- `pnpm.cmd exec vitest run packages/validator-core/src/wave30-tutorial-mini-model-contract-fixtures.test.ts packages/runtime-core/src/wave30-tutorial-mini-model-contract-fixtures.test.ts`
  - Result: pass, 2 files / 2 tests.
- `pnpm.cmd typecheck`
  - Result: pass.
- `pnpm.cmd test:unit`
  - Result: pass, 170 files / 868 tests.

## Residual Risks

- This review did not attempt a production-source fix for `toRuntimeGraph` drawable `partId` omission because the delegated scope was the final Wave30 fixture blocker and explicitly limited to the two fixture tests. If future work expects all authoring-to-runtime conversions to carry drawable part membership by default, that should be handled as a separate runtime adapter change with its own review.
- The working tree contains many unrelated Wave33 changes outside this Domain G narrow review. They were treated as out of scope except where needed to confirm `part.runtimeEvidenceMismatch` behavior.

## User-Decision Points

None.
