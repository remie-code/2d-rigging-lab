# Wave78 Final Integration Report: Keyed Warp Scale Handles

- Final status: final complete / pass
- Wave gate status: final complete / pass
- Domain: `wave78-final-integration-clean-review-map-closeout`
- Date: 2026-06-17
- Integrator: Orch-Sylph / Domain C Gnome docs closeout
- Final clean review: `pass` at [../../reviews/wave78/wave78-final-clean-integration-review.md](../../reviews/wave78/wave78-final-clean-integration-review.md)

## Scope

Wave78 integrates two passed implementation domains:

- Domain A adds pure keyed Warp scale geometry and keyform cardinality safety coverage.
- Domain B connects that geometry to Canvas edge/corner handles, preview, hit testing, and `editKeyformKey(updateCurrent)` commit behavior.

Domain C performs final integration reporting and map closeout only. It does not implement source code. The independent final clean integration review now exists and records `pass`.

## Dependency Gate

| Required artifact | Result | Evidence |
|---|---:|---|
| Domain A implementation report | pass | [wave78-domain-a-warp-scale-geometry-keyform-safety-model-report.md](wave78-domain-a-warp-scale-geometry-keyform-safety-model-report.md) |
| Domain A Spec Compliance Review | pass | [../../reviews/wave78/wave78-domain-a-spec-compliance-review.md](../../reviews/wave78/wave78-domain-a-spec-compliance-review.md) |
| Domain A Design / Development Compliance Review | pass | [../../reviews/wave78/wave78-domain-a-design-development-review.md](../../reviews/wave78/wave78-domain-a-design-development-review.md) |
| Domain A Test Adequacy Review | pass | [../../reviews/wave78/wave78-domain-a-test-adequacy-review.md](../../reviews/wave78/wave78-domain-a-test-adequacy-review.md) |
| Domain B implementation report | pass | [wave78-domain-b-canvas-keyed-warp-scale-handles-gesture-integration-report.md](wave78-domain-b-canvas-keyed-warp-scale-handles-gesture-integration-report.md) |
| Domain B Spec Compliance Review | pass | [../../reviews/wave78/wave78-domain-b-spec-compliance-review.md](../../reviews/wave78/wave78-domain-b-spec-compliance-review.md) |
| Domain B Design / Development Compliance Review | pass | [../../reviews/wave78/wave78-domain-b-design-development-review.md](../../reviews/wave78/wave78-domain-b-design-development-review.md) |
| Domain B Test Adequacy Review | pass | [../../reviews/wave78/wave78-domain-b-test-adequacy-review.md](../../reviews/wave78/wave78-domain-b-test-adequacy-review.md) |
| Final clean integration review | pass | [../../reviews/wave78/wave78-final-clean-integration-review.md](../../reviews/wave78/wave78-final-clean-integration-review.md) records no blocking or needs-change findings. |

## Feature Meaning

Wave78 adds keyed Warp lattice scale editing. The feature edits the current parameter keyform's `controlPointOffsets` for the selected Warp Deformer.

It is not rest frame resize. It does not edit `domainBounds`, `restControlPoints`, lattice rows/columns, child bindings, mesh generation, Deformer Tree behavior, Viewer behavior, or Warp metadata. It does not support selected-control-point-only scaling, Alt/Shift modifier semantics, additiveDelta authoring expansion, or implicit off-key keyform creation.

## Scale Math

Scale source points are derived from the current keyed/evaluated lattice shape:

```text
P[i] = restControlPoints[i] + currentOffsets[i]
```

Edge handles fix the opposite edge and scale only one axis:

- left/right edge handles scale X and keep Y unchanged;
- top/bottom edge handles scale Y and keep X unchanged.

Corner handles fix the opposite corner and scale X/Y together.

The committed payload is a full replacement offset array:

```text
nextOffsets[i] = scaledP[i] - restControlPoints[i]
```

This is deliberately not raw offset-vector multiplication. Zero-offset keyforms remain scalable because the helper scales current point positions, then subtracts the rest lattice.

## Editability Gate

Scale handles are available only for committed Warp overlays at an exact editable keyform value. Domain B reuses the existing keyform editability gate, so off-key states may remain visible/readable but cannot expose or drag scale handles.

Wave78 does not create a keyform implicitly when the active parameter value is off-key. It also does not commit when `canEditValue === false`.

## Preview / Commit / Cancel

The Canvas interaction path is:

- pointerdown hit priority is corner scale handle, edge scale handle, control point, then marquee;
- pointermove computes full scaled `controlPointOffsets` and previews through the existing Canvas preview/evaluation path without mutating session state;
- pointerup commits exactly once through the existing Warp `editKeyformKey(updateCurrent)` gesture path;
- pointercancel clears preview and discards the drag without commit.

No new package operation type was added.

## No Rest / Domain Mutation Evidence

Domain A keeps scale math in a pure helper that reads `restControlPoints`, current offsets, and lattice dimensions, then returns full `nextOffsets`.

Domain B projects `restControlPoints` for preview/scale math but commits only `controlPointOffsets` through the existing keyform gesture. The implementation and reviews record no source path that updates `domainBounds`, `restControlPoints`, lattice rows/columns, rest frame geometry, mesh generation, Deformer Tree, or Viewer state.

The explicit post-commit rest/domain invariant assertion is still a residual test gap; source review and operation-path evidence cover the current no-mutation claim.

## Validation Results

Fresh Domain C validation recorded by Orch-Sylph:

| Check | Result |
|---|---|
| `pnpm.cmd typecheck` | pass |
| Focused Vitest command | initial sandbox failure with esbuild `spawn EPERM`; approved escalated rerun passed, 9 files / 96 tests |
| `node scripts/check-source-organization.mjs` | pass |
| `node scripts/check-dependencies.mjs` | pass |
| `git diff --check` | pass, with Git LF/CRLF working-copy warnings only |

Focused Vitest command:

```text
pnpm.cmd exec vitest run apps/editor/src/workspace/canvas/warp-deformer-scale.test.ts apps/editor/src/workspace/canvas/warp-deformer-control-point-editing.test.ts apps/editor/src/workspace/canvas/canvas-projection.test.ts apps/editor/src/workspace/canvas/canvas-evaluation.test.ts apps/editor/src/workspace/canvas/canvas-renderer.test.ts apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts packages/authoring-core/src/keyform-mutations.test.ts packages/operation-core/src/operations/edit-keyform-key.test.ts packages/runtime-core/src/rig-control-keyform-evidence.test.ts
```

Domain A and B reports additionally record focused implementation/review runs for helper geometry, package/operation/runtime cardinality, Canvas projection/evaluation, renderer, Warp control point interaction, and Rotation Deformer regression coverage. Orch-Sylph current-state confirmation also records no manifest or lockfile diff.

## Must-Not Compliance

- Domain C edited only discussion reports/maps.
- No production source, tests, package manifests, lockfiles, dependencies, or orchestration plan files were changed by Domain C.
- Wave78 does not claim rest frame resize, `domainBounds` edits, `restControlPoints` edits, lattice dimension edits, selected-control-point-only scale, off-key key creation, new operation types, Cubism compatibility, renderer architecture changes, or Viewer work.
- Final clean integration review passed with no blocking or needs-change findings.

## Residual Risks

- No Playwright/browser pixel smoke was run for Warp scale handles.
- Parent-transformed Warp coordinate precision inherits existing Warp point-drag limitations; Wave78 does not add inverse parent-deformer local-space solving.
- Explicit post-commit `domainBounds` / `restControlPoints` invariant testing may be absent; current evidence is source review plus the `controlPointOffsets`-only gesture path.

## User Decision Points

None for this closeout pass.

## Final Recommendation

Wave78 is final complete / pass. The independent final clean integration review passed with no blocking or needs-change findings; carry the residual risks above as non-blocking.
