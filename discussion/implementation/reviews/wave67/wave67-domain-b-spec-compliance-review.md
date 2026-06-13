# Wave67 Domain B Spec Compliance Review

- Review lane: Spec Compliance
- Domain: `wave67-parent-child-deformer-local-space-semantics`
- Reviewer: Review-Sylph
- Date: 2026-06-13
- Verdict: pass

## Scope

Read directly:

- `discussion/implementation/orchestration/wave67-plan.md`
- `discussion/implementation/waves/wave67/wave67-preplan-parent-child-deformer-inventory.md`
- `discussion/design/canvas-evaluation/canvas-evaluation-pipeline-v0.md`
- `discussion/design/mesh-rendering/mesh-image-rendering-architecture.md`
- `discussion/design/screen-design/components/rig-tool.md`
- `apps/editor/src/workspace/canvas/canvas-evaluation.ts`
- `apps/editor/src/workspace/canvas/canvas-evaluation.test.ts`
- `apps/editor/src/workspace/canvas/canvas-projection.test.ts`
- `packages/runtime-core/src/rig-control-hierarchy-evidence.test.ts`
- `packages/runtime-core/src/rig-control-evaluation.ts`
- `packages/runtime-core/src/rig-control-warp-lattice.ts`

The Gnome summary was used only as a verification checklist, not as the basis for findings.

## Requirement Classification

| Requirement | Classification | Evidence |
| --- | --- | --- |
| Parent-child Deformer semantics are local-space chain semantics: child local deformation, then parent transforms/warps the whole child result. | implemented | Wave67 accepts this as the oracle in `wave67-plan.md:60`-`68` and `wave67-plan.md:197`-`202`. Editor evaluation now reverses the parent-to-child chain before applying it: `canvas-evaluation.ts:663`-`692`. Individual rig controls are then applied in their own local basis: `canvas-evaluation.ts:695`-`713`. |
| Child warp inclusion/normalization no longer fails because a parent moved the child result outside the child's rest domain. | implemented | Child warp sampling still uses the child's stored `domainBounds` at the point where the child runs: `canvas-evaluation.ts:739`-`754`. Because the chain is applied child-to-parent, the parent movement occurs after child sampling. The editor test moves the result to x=202..314 while preserving child offsets and mesh deformation: `canvas-evaluation.test.ts:158`-`219`. |
| Non-uniform child offsets are covered to catch wrong normalization. | implemented | Editor evaluation test uses non-uniform child offsets at `canvas-evaluation.test.ts:160`-`165`. Projection test uses another non-uniform set at `canvas-projection.test.ts:471`-`476`. Runtime evidence test uses non-uniform child offsets at `rig-control-hierarchy-evidence.test.ts:905`-`912`. |
| Parent warp plus child warp with nonzero/non-origin child setup is covered. | implemented | Editor test covers parent warp plus child warp with child offsets: `canvas-evaluation.test.ts:166`-`185`. Projection test covers non-origin child domain `{ x: 5, y: 5, width: 20, height: 20 }`: `canvas-projection.test.ts:484`-`490`. Runtime test covers child domain `{ x: 10, y: 0, width: 2, height: 2 }`: `rig-control-hierarchy-evidence.test.ts:835`-`851`. |
| Evaluated child overlay/control points and evaluated mesh deformation agree under parent movement. | implemented | Evaluated warp overlay points are produced by applying the same local-space chain to generated rest control points: `canvas-evaluation.ts:489`-`511`. Editor test asserts overlay points match evaluated mesh vertices: `canvas-evaluation.test.ts:205`-`219`. Projection test asserts the same agreement at the projection boundary: `canvas-projection.test.ts:520`-`543`. |
| Stored/edit child values remain interpretable as child-local offsets while overlay may be evaluated for display. | implemented | Evaluated overlay `domainBounds` is computed from evaluated control points, but `controlPointOffsets` are copied from the local rig-control offsets: `canvas-evaluation.ts:498`-`511`. Tests assert the displayed overlay carries the original child-local offsets: `canvas-evaluation.test.ts:205`-`215`, `canvas-projection.test.ts:528`-`538`. |
| Runtime-core semantics are aligned with editor semantics where practical. | implemented | Runtime already builds effect chains from direct child upward to parent: `rig-control-evaluation.ts:414`-`438`, then reduces in that order over vertices: `rig-control-evaluation.ts:441`-`466`. Runtime warp sampling remains local to the current rig control domain: `rig-control-warp-lattice.ts:98`-`110`, `rig-control-warp-lattice.ts:196`-`219`. Added runtime evidence test fixes the parent-warp/child-warp oracle: `rig-control-hierarchy-evidence.test.ts:267`-`315`. |
| Renderer remains a consumer of evaluated vertices only. | implemented | The canvas-to-render-scene adapter copies `drawable.evaluatedMesh.vertices` into `RenderDrawable.mesh.vertices`: `canvas-render-scene-adapter.ts:38`-`55`. `RenderDrawable` has mesh/texture/opacity/draw-order/clipping fields, not authoring rig controls: `render-scene.ts:53`-`63`. WebGL2 draws the supplied mesh upload: `webgl2-renderer.ts:206`-`213`. No deformer evaluation was found in renderer code. |
| Do not enlarge the child domain merely to hide the symptom. | implemented | The editor implementation did not change stored child `domainBounds`; it changed chain application order. Test helpers derive rest control points from the supplied domain rather than inflating it: `canvas-evaluation.test.ts:491`-`507`, `canvas-projection.test.ts:839`-`859`. |
| Do not put deformer evaluation logic into WebGL2 renderer. | implemented | Deformer evaluation remains in `canvas-evaluation.ts` and runtime-core. Renderer code consumes `RenderScene` mesh data only: `canvas-render-scene-adapter.ts:38`-`55`, `webgl2-renderer.ts:49`-`89`. |
| Do not redesign Rig Tool UI / Rig Inspector layout. | implemented | No Domain B source changes were found in Rig Tool UI files. The reviewed implementation stayed in canvas evaluation/projection tests and runtime evidence tests. |
| Focused tests should not rely on screenshot/pixel oracle. | implemented | The added tests assert deterministic vertices, bounds, chain ids, runtime snapshots, and overlay control-point coordinates: `canvas-evaluation.test.ts:197`-`219`, `canvas-projection.test.ts:520`-`543`, `rig-control-hierarchy-evidence.test.ts:282`-`315`. |
| Canvas evaluation v0 parent-first text remains authoritative. | not relevant | `canvas-evaluation-pipeline-v0.md:121`-`123` describes the old parent-first model, and `canvas-evaluation-pipeline-v0.md:281`-`285` leaves precise local/parent conversion unresolved. Wave67 plan and preplan explicitly settle this for Domain B in favor of child-local then parent semantics: `wave67-plan.md:60`-`68`, `wave67-preplan-parent-child-deformer-inventory.md:42`-`58`. |
| External runtime API/export facade, Rig UI expansion, physics/dynamics expansion, and other Wave67 out-of-scope items. | not relevant | These are listed out of scope in `wave67-plan.md:488`-`506` and were not needed for Domain B. |

## Findings

No blocking Domain B spec-compliance findings.

The implementation matches the accepted Wave67 local-space oracle. The key change is that Editor evaluation keeps the stored/display chain as parent-to-child, but applies a reversed chain for point/vertex evaluation. That means a child warp samples and normalizes against its own local/rest domain before any parent warp moves the child result. Runtime-core already applies direct-child effects before ancestor effects, and the new runtime evidence test pins that behavior for warp-parent/warp-child graphs.

## Verification

Reproduced:

- `pnpm.cmd exec vitest run apps/editor/src/workspace/canvas/canvas-evaluation.test.ts apps/editor/src/workspace/canvas/canvas-projection.test.ts packages/runtime-core/src/rig-control-hierarchy-evidence.test.ts`
  - Passed after rerunning outside the sandbox because the first sandboxed run failed to spawn esbuild with `EPERM`.
  - Result: 3 files passed, 34 tests passed.
- `node scripts/check-source-organization.mjs`
  - Passed.
- `git diff --check -- apps/editor/src/workspace/canvas/canvas-evaluation.ts apps/editor/src/workspace/canvas/canvas-evaluation.test.ts apps/editor/src/workspace/canvas/canvas-projection.test.ts packages/runtime-core/src/rig-control-hierarchy-evidence.test.ts packages/runtime-core/src/rig-control-evaluation.ts packages/runtime-core/src/rig-control-warp-lattice.ts`
  - Passed with CRLF warnings only.

Not reproduced in the current full worktree:

- `pnpm.cmd typecheck`
  - Failed in files outside the Domain B changed/relevant set, including `packages/authoring-core/src/mesh-outline-v4-contour-band-generation.ts:1117` and `packages/render-webgl2/src/*` imports of `@private-2d-rigging-lab/render-core`.
  - This does not change the Domain B spec-compliance verdict, but it means the Gnome-reported repo-wide typecheck pass is not currently plausible against this workspace state and should be handled by integration or the owning non-B domain.

## Residual Risks

- Control-point preview under a moved parent appears to use the same evaluated offset and local-space chain path (`canvas-evaluation.ts:365`-`372`, `canvas-evaluation.ts:663`-`692`), but the newly added parent-child test coverage focuses on committed keyform offsets, not an explicit moved-parent preview interaction. This is a test-adequacy follow-up, not a spec-compliance blocker.
- The Wave67 local-space decision supersedes older `canvas-evaluation-pipeline-v0.md` parent-first wording. Future documentation cleanup may be useful to prevent readers from treating the older v0 section as the current oracle.
