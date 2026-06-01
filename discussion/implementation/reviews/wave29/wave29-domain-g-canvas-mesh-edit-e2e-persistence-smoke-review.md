# Wave29 Domain G Canvas Mesh Edit E2E Persistence Smoke - Review

Date: 2026-06-02

Reviewer: Review-Sylph

Verdict: `pass`

## Scope Reviewed

- Target: `wave29-canvas-mesh-edit-e2e-persistence-smoke`
- Reviewed Gnome-reported files:
  - `apps/editor/e2e/canvas-mesh-edit-persistence-smoke.mjs`
  - `apps/editor/e2e/test-ids.mjs`
  - `discussion/implementation/waves/wave29/wave29-domain-g-canvas-mesh-edit-e2e-persistence-smoke-gnome-report.md`
- Treated existing Wave29 A-F worktree changes as upstream state and did not revert or edit implementation files.

## Findings

No open findings after the fix pass.

Previous findings are closed:

- Medium finding closed. The smoke now reads the target Viewer mesh row through `viewerRuntime.meshEvidence.<drawableId>` and pins topology/hash plus explicit selected/moved field labels (`apps/editor/e2e/canvas-mesh-edit-persistence-smoke.mjs:552`, `apps/editor/e2e/canvas-mesh-edit-persistence-smoke.mjs:559`; `apps/editor/src/ui/viewer-runtime/viewer-runtime-summary.ts:237`). Preview evidence now verifies the target drawable polygon contains moved coordinates and rejects stale initial coordinates (`apps/editor/e2e/canvas-mesh-edit-persistence-smoke.mjs:518`, `apps/editor/e2e/canvas-mesh-edit-persistence-smoke.mjs:537`). Gnome also documented that current Preview / Viewer surfaces do not expose selected vertex IDs or moved refs after load, so vertex identity is proven through canvas/editor-state/storage evidence rather than a false runtime moved-ref oracle (`discussion/implementation/waves/wave29/wave29-domain-g-canvas-mesh-edit-e2e-persistence-smoke-gnome-report.md:44`, `discussion/implementation/waves/wave29/wave29-domain-g-canvas-mesh-edit-e2e-persistence-smoke-gnome-report.md:48`).
- Low finding closed. Post-load state now reasserts exact selected canvas vertex IDs after checking moved coordinates (`apps/editor/e2e/canvas-mesh-edit-persistence-smoke.mjs:496`, `apps/editor/e2e/canvas-mesh-edit-persistence-smoke.mjs:504`).

## Design / Development Compliance

- Scope containment is acceptable. Domain G remains e2e-focused with narrow selector/test-id support; no broad editor, runtime, operation, validator, asset I/O, parser, image decode, external dependency, manifest, or `index.ts` implementation changes were introduced by this fix pass.
- The e2e-side selector additions are narrow mirrors of existing production IDs (`apps/editor/e2e/test-ids.mjs:25`, `apps/editor/e2e/test-ids.mjs:140`; `apps/editor/src/editor-state/editor-test-ids.ts:25`, `apps/editor/src/editor-state/editor-test-ids.ts:130`). The Viewer row test id is a narrow observability hook on an already-present mesh evidence row (`apps/editor/e2e/test-ids.mjs:158`; `apps/editor/src/editor-state/editor-test-ids.ts:151`; `apps/editor/src/ui/viewer-runtime/viewer-runtime-summary.ts:237`).
- No dependency or manifest diffs were found for `package.json`, `apps/editor/package.json`, or `pnpm-lock.yaml`.
- The new IDs contain no spaces and do not introduce schema or external DTO ownership changes.

## Test Adequacy

- Desktop and mobile viewport smoke exists in the script (`apps/editor/e2e/canvas-mesh-edit-persistence-smoke.mjs:20`) and was reproduced by Review-Sylph after the fix pass.
- Save/load storage, exact selected target IDs, and moved canvas coordinate evidence are present (`apps/editor/e2e/canvas-mesh-edit-persistence-smoke.mjs:98`, `apps/editor/e2e/canvas-mesh-edit-persistence-smoke.mjs:384`, `apps/editor/e2e/canvas-mesh-edit-persistence-smoke.mjs:496`, `apps/editor/e2e/canvas-mesh-edit-persistence-smoke.mjs:504`).
- Preview and Viewer post-load checks now inspect target-specific evidence rather than only generic summary text (`apps/editor/e2e/canvas-mesh-edit-persistence-smoke.mjs:507`, `apps/editor/e2e/canvas-mesh-edit-persistence-smoke.mjs:518`, `apps/editor/e2e/canvas-mesh-edit-persistence-smoke.mjs:552`).
- Adjacent regression coverage was rerun through `pnpm.cmd test:e2e`; the existing runner covers desktop/mobile, source intake, row nudge, layer controls, asset I/O boundary, dynamics, viewer runtime, rig-control, composition, and part/texture/layer smoke paths (`apps/editor/e2e/smoke-checks.mjs:48`, `apps/editor/e2e/smoke-checks.mjs:78`, `apps/editor/e2e/smoke-checks.mjs:91`, `apps/editor/e2e/smoke-checks.mjs:139`, `apps/editor/e2e/smoke-checks.mjs:147`, `apps/editor/e2e/smoke-checks.mjs:155`, `apps/editor/e2e/smoke-checks.mjs:163`, `apps/editor/e2e/smoke-checks.mjs:171`, `apps/editor/e2e/smoke-checks.mjs:179`).
- Assertions were strengthened rather than weakened; no remaining unacceptable test adequacy gap was found for Domain G.

## Commands Run

- `node --check apps/editor/e2e/test-ids.mjs`
  - Passed.
- `node --check apps/editor/e2e/canvas-mesh-edit-persistence-smoke.mjs`
  - Passed.
- `pnpm.cmd typecheck`
  - Passed root and editor typecheck.
- `node apps/editor/e2e/canvas-mesh-edit-persistence-smoke.mjs`
  - Passed.
  - Desktop smoke passed; screenshot `png` base64Length `104828`.
  - Mobile smoke passed; screenshot `png` base64Length `40880`.
- `pnpm.cmd test:e2e`
  - Passed.
  - Desktop and mobile existing editor smoke passed.
- `git diff --check -- apps/editor/e2e/canvas-mesh-edit-persistence-smoke.mjs apps/editor/e2e/test-ids.mjs apps/editor/src/editor-state/editor-test-ids.ts apps/editor/src/ui/viewer-runtime/viewer-runtime-summary.ts discussion/implementation/waves/wave29/wave29-domain-g-canvas-mesh-edit-e2e-persistence-smoke-gnome-report.md discussion/implementation/reviews/wave29/wave29-domain-g-canvas-mesh-edit-e2e-persistence-smoke-review.md`
  - Passed with LF-to-CRLF working-copy warning only.
- `git diff --name-only -- package.json pnpm-lock.yaml apps/editor/package.json`
  - No output; no manifest/lockfile diff in those paths.

## Skipped Commands

- Source/dependency guard scripts were not run.
  - This review performed direct manifest/lockfile diff inspection instead; full guard verification remains Domain H/final integration scope per the Wave29 plan.

## Required Fixes

None.

## User Decision Points

None.
