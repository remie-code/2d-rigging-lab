# Wave67 Domain B Report: Parent-Child Deformer Local-Space Semantics

- Domain: `wave67-parent-child-deformer-local-space-semantics`
- Orchestrator: Orch-Sylph
- Verdict: pass with final-integration typecheck caveat

## Objective

Fix parent-child Deformer evaluation so child deformations keep child-local/rest-space meaning while parent Deformers move or warp the whole child result.

Accepted semantic oracle:

```text
child deformer local deformation
  -> parent deformer transforms / warps the whole child result
  -> final evaluated mesh
```

## Implementation Summary

- Editor evaluation now keeps public hierarchy reporting parent-to-child, but applies the rig-control chain child-to-parent for evaluated points and mesh vertices.
- Child warp sampling and normalization therefore happen against the child rig control's own stored/rest `domainBounds` before parent movement is applied.
- Evaluated child warp overlay/control points use the same local-space evaluation path as evaluated mesh vertices, so overlay and mesh coordinates agree.
- Runtime source already applied direct-child effects before ancestor effects. Domain B added focused runtime evidence coverage instead of rewriting runtime source.
- Renderer code was not changed. Renderer remains a consumer of evaluated vertices.

## Files Changed

Source:

- `apps/editor/src/workspace/canvas/canvas-evaluation.ts`

Tests:

- `apps/editor/src/workspace/canvas/canvas-evaluation.test.ts`
- `apps/editor/src/workspace/canvas/canvas-projection.test.ts`
- `packages/runtime-core/src/rig-control-hierarchy-evidence.test.ts`

Reports:

- `discussion/implementation/reviews/wave67/wave67-domain-b-spec-compliance-review.md`
- `discussion/implementation/reviews/wave67/wave67-domain-b-design-development-review.md`
- `discussion/implementation/reviews/wave67/wave67-domain-b-test-adequacy-review.md`
- `discussion/implementation/waves/wave67/wave67-domain-b-parent-child-deformer-local-space-semantics-report.md`

## Acceptance Evidence

| Requirement | Result | Evidence |
| --- | --- | --- |
| Parent warp moving a child warp outside rest bounds no longer stops child deformation. | pass | `canvas-evaluation.test.ts` asserts child offsets still affect evaluated vertices after parent moves result to x=202..314. |
| Non-uniform child warp offsets evaluate correctly under parent movement. | pass | Editor evaluation, projection, and runtime tests use non-uniform child offset sets and assert exact vertices/bounds. |
| Evaluated child warp overlay and evaluated mesh deformation agree. | pass | Editor evaluation and projection tests assert evaluated control points equal corresponding mesh vertices. |
| Runtime/editor semantics aligned where practical. | pass | Runtime effect chain already applies child-to-parent; new runtime evidence test pins warp-parent/warp-child behavior. |
| Tests are non-pixel. | pass | Tests assert vertices, bounds, chain ids, evaluated control coordinates, runtime diagnostics, and runtime diff metadata. |
| Renderer remains a consumer of evaluated vertices only. | pass | No renderer/WebGL2/render-core changes were made by Domain B. |

## Review Results

- Spec Compliance Review: pass.
  - Report: `discussion/implementation/reviews/wave67/wave67-domain-b-spec-compliance-review.md`
- Design / Development Compliance Review: pass.
  - Report: `discussion/implementation/reviews/wave67/wave67-domain-b-design-development-review.md`
- Test Adequacy Review: pass.
  - Report: `discussion/implementation/reviews/wave67/wave67-domain-b-test-adequacy-review.md`

All started child sessions completed and were closed by Orch-Sylph.

## Verification

Passed:

```text
pnpm.cmd exec vitest run apps/editor/src/workspace/canvas/canvas-evaluation.test.ts apps/editor/src/workspace/canvas/canvas-projection.test.ts packages/runtime-core/src/rig-control-hierarchy-evidence.test.ts
```

Result: 3 test files passed, 34 tests passed.

Note: the sandboxed run failed first with esbuild `spawn EPERM`; the same command passed after approved escalation.

Passed:

```text
node scripts/check-source-organization.mjs
```

Result: Source organization guard passed.

Passed:

```text
git diff --check -- apps/editor/src/workspace/canvas/canvas-evaluation.ts apps/editor/src/workspace/canvas/canvas-evaluation.test.ts apps/editor/src/workspace/canvas/canvas-projection.test.ts packages/runtime-core/src/rig-control-hierarchy-evidence.test.ts
```

Result: exit 0, CRLF warnings only.

Not passed in current mixed Wave67 worktree:

```text
pnpm.cmd typecheck
```

Observed failures are outside Domain B changed files, including:

- `packages/authoring-core/src/mesh-outline-v4-contour-band-generation.ts(1117,23)`
- `packages/render-webgl2/src/*` unresolved `@private-2d-rigging-lab/render-core` imports and related type errors

This is a final-integration / owning-domain verification caveat, not a Domain B local-space semantics failure.

## Deferred / Non-Goals

- No WebGL2 renderer or render-core implementation work.
- No Mesh V4 generation work.
- No Rig Inspector layout or Deformer Tree UI redesign.
- No child domain enlargement.
- No broad package schema redesign.
- No screenshot or pixel oracle.

## Residual Risks

- `rigControlChainIds` remains public top-down hierarchy reporting while geometry evaluation applies child-to-parent. No reviewed production consumer treats this field as evaluation order, but future consumers should not infer geometry application order from it.
- A dedicated parent-moved control-point preview test was not added. Existing preview and local-space paths suggest it shares the evaluated route, but parent rotation/non-uniform parent warp edit conversion remains a later edit-semantics risk.
- Older `canvas-evaluation-pipeline-v0.md` parent-first wording is superseded by Wave67 accepted decisions. Future documentation cleanup would reduce ambiguity.
- Repo-wide typecheck needs rerun after out-of-scope Wave67 Domain A/C worktree issues are resolved.

## Final Verdict

pass
