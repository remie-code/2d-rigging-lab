# Wave94 Domain B Gnome Implementation Report

## Verdict

done

## Files Changed

- `apps/editor/src/workspace/canvas/canvas-evaluation.ts`
- `apps/editor/src/workspace/canvas/canvas-evaluation.test.ts`
- `packages/contracts/src/warp-lattice2d.ts`
- `discussion/implementation/waves/wave94/wave94-domain-b-editor-canvas-nested-warp-rest-bind-parity-gnome-report.md`

## Implementation Notes

- Canvas vertex rig evaluation now carries `currentVertices` and `referenceVertices`.
- Canvas Warp membership and bilinear lattice sampling use the reference/rest vertex.
- Canvas Warp displacement is added to the current vertex.
- Rotation evaluation still applies only to the current point and does not mutate the reference stream.
- `createLocalSpaceEvaluationChain(chain)` remains the child-first local evaluation order.
- Mesh drafts remain the base stream for both initial current and reference vertices in the Canvas preview path.
- Runtime helper reuse was deferred because Domain A did not export a Canvas-facing pure helper, and importing runtime-core internals from Editor would add an invalid coupling risk for this bounded wave.

## Runtime / Canvas Parity Evidence

Added Canvas tests matching the Domain A runtime numeric oracle:

- `keeps a rest-inside vertex bound to the parent warp after child warp moves current outside`
  - rest/reference `{ x: 5, y: 5 }`
  - child offset `{ x: 20, y: 0 }`
  - parent displacement `{ x: 1, y: 2 }`
  - expected `{ x: 26, y: 7 }`
- `keeps a rest-outside vertex outside the parent warp even when child warp moves current inside`
  - rest/reference `{ x: 15, y: 5 }`
  - child offset `{ x: -10, y: 0 }`
  - expected child-only `{ x: 5, y: 5 }`
- `samples nonuniform parent warp displacement from rest coordinates instead of current coordinates`
  - rest/reference `{ x: 2, y: 5 }`
  - child offset `{ x: 6, y: 0 }`
  - parent x displacement samples `2` from rest x=2
  - expected `{ x: 10, y: 5 }`

## Tests Run

- `pnpm.cmd exec vitest run apps/editor/src/workspace/canvas/canvas-evaluation.test.ts`
  - sandbox run failed at Vitest config startup with `spawn EPERM`.
  - escalated rerun passed: 1 file / 16 tests.
- `pnpm.cmd exec vitest run packages/runtime-core/src/rig-control-nested-warp-rest-bind-semantics.test.ts apps/editor/src/workspace/canvas/canvas-evaluation.test.ts`
  - passed: 2 files / 20 tests.
- `pnpm.cmd typecheck`
  - passed.
- `git diff --check -- apps/editor/src/workspace/canvas packages/contracts/src/warp-lattice2d.ts discussion/implementation/waves/wave94 discussion/implementation/reviews/wave94`
  - passed; Git emitted LF-to-CRLF working-copy warnings only.

## Basis Coverage Self-Report

- Wave94 Domain B Canvas parity: covered.
- Runtime evaluation semantics nested warp membership: covered in Canvas preview with paired numeric tests.
- Runtime core contract rest/bind membership: covered by matching Canvas expected values and combined runtime/canvas test run.
- Fixtures and contract tests `nested-warp-rest-binding`: covered by Canvas parity tests.
- Contract wording: updated `WARP_LATTICE_2D_OUTSIDE_DOMAIN_POLICY` comment so outside pass-through is rest-domain based, not current-coordinate nested behavior.
- Source organization policy: no new broad source file or index implementation.
- Dependency policy: no dependency or lockfile change.
- Operation policy: no package mutation path change.

## Deferred Basis Items

- `rigControl.warpBindingOutsideDomain` validator routing was deferred. A correct validator implementation needs a reviewed static binding-quality rule over parent warp descendants, drawable mesh rest vertices, missing mesh/drawable refs, and profile status. That is larger than the Canvas semantic parity fix and is not required to unblock Runtime/Canvas parity.
- No Runtime helper was exported in this wave. Canvas mirrors the small bilinear displacement logic with focused parity tests.

## Residual Risks

- Canvas has no diagnostic output channel for reference/current vertex stream mismatch; it uses a safe pass-through fallback if a mismatch is ever supplied internally.
- Overlay point evaluation now uses each overlay point as its stable reference point, which keeps evaluated control points aligned with the same rest/bind semantics but is still not a separate UX/hit-test redesign.
