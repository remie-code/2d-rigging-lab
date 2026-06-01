# Wave29 Domain G Canvas Mesh Edit E2E Persistence Smoke - Gnome Report

Date: 2026-06-02

## Verdict

done

## Scope

- Target: `wave29-canvas-mesh-edit-e2e-persistence-smoke`
- Added focused browser smoke coverage for metadata-only source intake, generated drawable mesh creation, SVG canvas vertex selection, multi-vertex nudge, Preview / Viewer semantic inspection, save/load, and post-load reinspection.
- Kept source changes inside `apps/editor/e2e/**` except for a narrow Viewer mesh-evidence row `data-testid` wiring. No runtime, operation, validator, dependency, manifest, parser, image decode, asset I/O, or `index.ts` changes were made by this domain.
- Existing Wave29 A-F worktree changes were treated as upstream state and were not reverted.

## Files Changed

- `apps/editor/e2e/canvas-mesh-edit-persistence-smoke.mjs`
- `apps/editor/e2e/test-ids.mjs`
- `apps/editor/src/editor-state/editor-test-ids.ts`
- `apps/editor/src/ui/viewer-runtime/viewer-runtime-summary.ts`
- `discussion/implementation/waves/wave29/wave29-domain-g-canvas-mesh-edit-e2e-persistence-smoke-gnome-report.md`

## Implementation Summary

- Added a standalone runnable focused smoke:
  - runs both desktop `1280x900` and mobile `390x844` viewports;
  - uses the existing metadata-only Source Intake helper, with no file picker, parser, real image bytes, or image decode work;
  - creates `Wave 29 Canvas Mesh`, generating `draw_wave_29_canvas_mesh` / `mesh_wave_29_canvas_mesh`;
  - selects `vtx_wave_29_canvas_mesh_0_0` and `vtx_wave_29_canvas_mesh_0_1` through SVG mesh canvas targets;
  - commits a multi-vertex `+X` canvas nudge through the existing `moveMeshVertex` operation lifecycle;
  - saves to browser project storage, reloads, loads, and reinspects the moved vertex coordinates and `activeTool: "meshEdit"` editor-state selection.
- Added e2e-side mirror test IDs for the already-existing mesh canvas UI selectors.
- Added semantic layout/accessibility checks for mesh canvas reachability, status role/name, SVG surface label, vertex button labeling, enabled/disabled nudge state, and horizontal overflow on desktop/mobile.
- Preview / Viewer assertions are semantic:
  - Preview checks visible mesh evidence, topology summary presence, and post-load target drawable polygon coordinates for the moved vertices.
  - Viewer checks the target mesh evidence row by `data-testid`, topology count shape, selected/moved field labels, vertex hash evidence, and observable validation diagnostics.
  - Moved vertex preservation is asserted through saved package mesh coordinates and post-load canvas coordinates, not by pixel output or runtime moved-ref claims.

## Review Fix Pass - 2026-06-02

Addressed Review-Sylph `needs_fix` findings:

- Medium finding: strengthened post-load Preview / Viewer assertions.
  - Added a narrow Viewer mesh evidence row test id, `viewerRuntime.meshEvidence.<drawableId>`, so the smoke reads the target drawable row instead of matching generic Viewer text.
  - Preview post-load assertion now checks the target drawable polygon contains moved points `85,24` and `99,24`, rejects stale initial points `84,24` and `98,24`, and verifies the target preview drawable is runtime-visible and texture-backed.
  - Viewer post-load assertion now checks the target row for `draw_wave_29_canvas_mesh: mesh mesh_wave_29_canvas_mesh`, `9 vertices /`, selected/moved field labels, and `hash vhash_`.
  - Current Preview / Viewer projection does not truthfully expose selected vertex IDs or moved vertex refs for this committed graph after load; the smoke therefore pins the actual target-row selected/moved field values and proves target vertex IDs through canvas/editor-state/storage evidence without adding a false runtime moved-ref oracle.
- Low finding: reasserted loaded canvas selection for exact vertex IDs.
  - `assertCanvasMeshStateAfterLoad` now calls `assertCanvasSelectedVertices` for `vtx_wave_29_canvas_mesh_0_0` and `vtx_wave_29_canvas_mesh_0_1` after load, in addition to checking selected count/status and moved coordinates.

## Verification

Passed:

- `node --check apps\editor\e2e\test-ids.mjs`
  - passed
- `node --check apps\editor\e2e\canvas-mesh-edit-persistence-smoke.mjs`
  - passed
- `node apps\editor\e2e\canvas-mesh-edit-persistence-smoke.mjs`
  - passed
  - desktop smoke passed; screenshot `png` base64Length `104828`
  - mobile smoke passed; screenshot `png` base64Length `40880`
- `pnpm.cmd test:e2e`
  - passed
  - existing editor e2e desktop/mobile smoke passed, covering existing row nudge, source intake, asset I/O boundary, dynamics, viewer runtime, rig-control, composition, and part/texture/layer smoke paths through `scripts/editor-e2e-smoke.mjs`.

Review fix pass passed:

- `node --check apps\editor\e2e\canvas-mesh-edit-persistence-smoke.mjs`
  - passed
- `node --check apps\editor\e2e\test-ids.mjs`
  - passed
- `pnpm.cmd typecheck`
  - root typecheck passed
  - editor typecheck passed
- `node apps\editor\e2e\canvas-mesh-edit-persistence-smoke.mjs`
  - passed
  - desktop smoke passed; screenshot `png` base64Length `104828`
  - mobile smoke passed; screenshot `png` base64Length `40880`
- `pnpm.cmd test:e2e`
  - passed
  - existing editor e2e desktop/mobile smoke passed.

## Skipped Verification

- Initial pass skipped `pnpm.cmd typecheck` because it changed only e2e JavaScript and discussion report files. Review fix pass added a narrow UI test-id tweak, so `pnpm.cmd typecheck` was run and passed.
- Pixel oracle, renderer correctness, real image decode, file picker, parser, archive I/O, topology editor, and UV editor checks were intentionally not added or run.

## Residual Risks

- The focused smoke is standalone and is not wired into `pnpm.cmd test:e2e` because `scripts/editor-e2e-smoke.mjs` is outside the Domain G allowed write scope. It must be run directly with `node apps\editor\e2e\canvas-mesh-edit-persistence-smoke.mjs`.
- Current Preview / Viewer mesh evidence exposes mesh topology/hash and selected/moved labels, but the moved-ref count can remain `0 moved vertices` when the runtime baseline and candidate snapshots are both taken from the current graph. The smoke therefore proves moved vertices through storage and canvas coordinate reinspection rather than claiming a full runtime moved-ref oracle.
- Viewer diagnostics include existing sample/package diagnostics such as missing texture on the default `draw_body`; the smoke asserts diagnostics observability instead of requiring a clean validation report.

## Escalation / Blocked Items

- No product or design escalation was required.
- Shell commands had to be run with sandbox escalation because the default Windows sandbox shell failed at startup with `windows sandbox: spawn setup refresh`. This did not change implementation scope.

## User Decision Points

None.
