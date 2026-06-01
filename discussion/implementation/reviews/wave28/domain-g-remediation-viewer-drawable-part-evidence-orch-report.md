# Wave28 Domain G Remediation R2 Orch-Sylph Report: Viewer Drawable Part Evidence

## verdict

pass

## target

- `wave28-domain-g-remediation-viewer-drawable-part-evidence`
- Date: 2026-06-01

## orchestration separation

- Orch-Sylph did not implement source changes.
- Source implementation was delegated to Gnome in a separate context without full-history fork.
- Independent review was delegated to Review-Sylph in a separate clean context after Gnome completed.
- Orch-Sylph waited for both subagents to reach final statuses before reporting.

## subagent results

### Gnome implementation

- Agent: `019e835f-4dff-7c51-a37e-8c4bb9d4b731`
- Result: `done`
- Report: `discussion/implementation/waves/wave28/domain-g-remediation-viewer-drawable-part-evidence-gnome-report.md`
- Summary:
  - Fixed the Preview/Viewer projection path so missing drawable `partId` evidence is hydrated from the same projection's `parts[].drawableIds` membership.
  - Kept existing drawable `partId` values authoritative and did not overwrite them.
  - Updated the Domain G focused smoke to expect the assigned part instead of accepting `part none`.

### Review-Sylph review

- Agent: `019e836b-7aaf-7fa0-b74f-2c4ba1f8ef67`
- Result: `pass`
- Report file: none created; review result was returned inline to Orch-Sylph.
- Summary:
  - Verified Viewer Drawable Layer Evidence now follows the hydrated `previewProjection.drawables` path.
  - Verified the e2e smoke no longer accepts `part none` after reassignment.
  - Found no blocking or non-blocking findings.

## files changed

- `apps/editor/src/editor-preview/texture-preview-resolution.ts`
- `apps/editor/src/editor-preview/texture-preview-resolution.test.ts`
- `apps/editor/src/editor-workflow/part-texture-layer-workflow.test.ts`
- `apps/editor/e2e/part-texture-layer-persistence-smoke.mjs`
- `discussion/implementation/waves/wave28/domain-g-remediation-viewer-drawable-part-evidence-gnome-report.md`
- `discussion/implementation/reviews/wave28/domain-g-remediation-viewer-drawable-part-evidence-orch-report.md`

## verification

Gnome reported passing:

- `pnpm.cmd exec vitest run apps/editor/src/editor-preview/texture-preview-resolution.test.ts`
- `pnpm.cmd exec vitest run apps/editor/src/editor-preview/preview-projection.test.ts apps/editor/src/editor-preview/texture-preview-resolution.test.ts apps/editor/src/editor-workflow/viewer-runtime-workflow.test.ts apps/editor/src/editor-workflow/part-texture-layer-workflow.test.ts`
- `pnpm.cmd typecheck`
- `node --check apps/editor/e2e/part-texture-layer-persistence-smoke.mjs`
- `git diff --check -- apps/editor/src/editor-preview apps/editor/src/editor-workflow apps/editor/e2e discussion/implementation/waves/wave28`

Review-Sylph independently reported passing:

- `pnpm.cmd exec vitest run apps/editor/src/editor-preview/preview-projection.test.ts apps/editor/src/editor-preview/texture-preview-resolution.test.ts apps/editor/src/editor-workflow/viewer-runtime-workflow.test.ts apps/editor/src/editor-workflow/part-texture-layer-workflow.test.ts`
- `pnpm.cmd typecheck`
- `node --check apps/editor/e2e/part-texture-layer-persistence-smoke.mjs`
- `node apps/editor/e2e/part-texture-layer-persistence-smoke.mjs`
- `git diff --check -- apps/editor/src/editor-preview apps/editor/src/editor-workflow apps/editor/e2e discussion/implementation/waves/wave28`

Review-Sylph noted that the focused Domain G smoke passed on both desktop and mobile in the current workspace, superseding Gnome's earlier pre-Viewer reachability failure note.

## review findings and fixes applied

- No Review-Sylph findings required follow-up fixes.
- The original false evidence path is covered by focused unit/workflow tests and strict e2e text that expects `draw_body: part part_wave_28_face / texture tex_w28`.

## remaining issues

- None for the targeted Viewer Drawable Layer Evidence remediation.
- Full `pnpm.cmd test:e2e` was not rerun by Review-Sylph; previous full-suite mobile overflow concerns remain outside this targeted remediation unless separately routed.

## user-decision points

None.
