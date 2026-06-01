# Wave29 Domain G Canvas Mesh Edit E2E Persistence Smoke - Orch-Sylph Final Report

- Date: 2026-06-02
- Target: `wave29-canvas-mesh-edit-e2e-persistence-smoke`
- Verdict: `pass`

## Subagent Separation

- Implementation was delegated to Gnome the 43rd (`019e844a-1fe9-7a80-9185-cbf4d14b7478`) without full-history fork.
- Review was delegated to Review-Sylph the 44th (`019e845e-35d7-7da1-b84d-49e2988cb0f1`) without full-history fork.
- Orch-Sylph waited for both subagents to complete. The first review returned `needs_fix`; Orch-Sylph sent the findings back to Gnome and waited for the fix pass, then waited for Review-Sylph re-review.
- Orch-Sylph did not perform source implementation.

## Domain G Files Changed

- `apps/editor/e2e/canvas-mesh-edit-persistence-smoke.mjs`
- `apps/editor/e2e/test-ids.mjs`
- `apps/editor/src/editor-state/editor-test-ids.ts`
- `apps/editor/src/ui/viewer-runtime/viewer-runtime-summary.ts`
- `discussion/implementation/waves/wave29/wave29-domain-g-canvas-mesh-edit-e2e-persistence-smoke-gnome-report.md`
- `discussion/implementation/reviews/wave29/wave29-domain-g-canvas-mesh-edit-e2e-persistence-smoke-review.md`
- `discussion/implementation/reviews/wave29/wave29-domain-g-canvas-mesh-edit-e2e-persistence-smoke-orch-sylph-final-report.md`

The working tree also contains Wave29 A-F upstream changes that Domain G did not own or revert.

## Review Result

Initial Review-Sylph verdict was `needs_fix`:

- Post-load Preview/Viewer assertions were too generic.
- Post-load canvas selection did not reassert exact selected vertex IDs.

Gnome fix pass:

- Reasserted post-load canvas selection for the expected vertex IDs.
- Strengthened post-load Preview evidence by checking the target polygon includes moved coordinates and excludes stale initial coordinates.
- Added a narrow Viewer mesh evidence row test id and asserted the target mesh row directly.
- Recorded the limitation that current Preview/Viewer surfaces do not truthfully expose selected vertex IDs or moved refs after load; exact IDs are proven through canvas/editor-state/storage evidence.

Final Review-Sylph verdict was `pass` with no open findings.

## Verification

Reported passing verification:

- `node --check apps\editor\e2e\canvas-mesh-edit-persistence-smoke.mjs`
- `node --check apps\editor\e2e\test-ids.mjs`
- `pnpm.cmd typecheck`
- `node apps\editor\e2e\canvas-mesh-edit-persistence-smoke.mjs`
  - desktop smoke passed
  - mobile smoke passed
- `pnpm.cmd test:e2e`
  - existing editor e2e desktop/mobile smoke passed
- `git diff --check -- ...touched paths...`
  - passed with LF-to-CRLF working-copy warnings only

Review-Sylph also inspected manifest/lockfile diffs and reported no dependency or manifest changes.

Skipped / out of scope:

- Source/dependency guard scripts were left for Domain H/final integration.
- Pixel oracle, full renderer claims, file picker, parser, image decode, and asset I/O checks remain out of Domain G scope.

## Remaining Issues

- No Domain G user-decision points.
- No open Review-Sylph findings.
- Full final integration guard coverage remains a Domain H/final integration concern.
