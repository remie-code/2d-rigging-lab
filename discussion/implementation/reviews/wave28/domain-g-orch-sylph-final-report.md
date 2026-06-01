# Wave28 Domain G Orch-Sylph Final Report: Part / Texture / Layer E2E Persistence Smoke

## Verdict

escalate

## Target

- Domain: `wave28-part-texture-layer-e2e-persistence-smoke`
- Caller: Undine
- Orchestrator: Orch-Sylph
- Date: 2026-06-01

## Subagent Separation And Wait Evidence

- Orch-Sylph did not implement source changes.
- Source implementation was delegated to Gnome in a separate context without full-history fork.
  - Agent id: `019e8338-cc14-72a2-b8bd-883ee8976198`
  - Result: `escalate`
  - Report: `discussion/implementation/waves/wave28/domain-g-part-texture-layer-e2e-persistence-smoke-gnome-report.md`
- Independent review was delegated to Review-Sylph in a separate context without full-history fork after Gnome completed.
  - Agent id: `019e8352-6ac9-7483-85ab-3ad98dad22f8`
  - Result: `escalate`
  - Report: `discussion/implementation/reviews/wave28/domain-g-part-texture-layer-e2e-persistence-smoke-review.md`
- Orch-Sylph waited for both subagents to reach final completion before issuing this report.
- Review-Sylph received basis documents, changed files, verification summary, and review lanes. Review-Sylph was not given full conversation history.

## Files Changed

Domain G implementation:

- `apps/editor/e2e/part-texture-layer-persistence-smoke.mjs`
- `apps/editor/e2e/smoke-checks.mjs`
- `apps/editor/e2e/test-ids.mjs`
- `discussion/implementation/waves/wave28/domain-g-part-texture-layer-e2e-persistence-smoke-gnome-report.md`

Domain G review / orchestration:

- `discussion/implementation/reviews/wave28/domain-g-part-texture-layer-e2e-persistence-smoke-review.md`
- `discussion/implementation/reviews/wave28/domain-g-orch-sylph-final-report.md`

## Implementation Summary

- Added a focused browser smoke for part create -> drawable part reassignment -> existing texture atlas assignment -> layer select/lock/editor-hide -> Preview/Viewer inspection -> save/load -> reinspection.
- The focused smoke runs desktop and mobile viewports.
- The focused smoke checks saved package graph, drawable membership, texture atlas entry, preview asset reference, operation target IDs, generated runtime/validation artifacts, and `model/editor-state.json` selection/lock/editor-hidden state.
- The new smoke was integrated into the full editor e2e sequence after Wave27 composition smoke.
- Domain G made no TypeScript UI/source changes outside e2e.

## Verification

Gnome reported:

- `node --check apps/editor/e2e/part-texture-layer-persistence-smoke.mjs`
  - Passed.
- `node apps/editor/e2e/part-texture-layer-persistence-smoke.mjs`
  - Passed desktop and mobile.
- `pnpm.cmd test:e2e`
  - Failed. Desktop full smoke passed, then mobile failed at `mobile post-source-intake` horizontal overflow before later adjacent mobile smokes could run.
- `git diff --check -- apps/editor/e2e discussion/implementation/waves/wave28/domain-g-part-texture-layer-e2e-persistence-smoke-gnome-report.md`
  - Passed with LF/CRLF warnings only.

Review-Sylph reran:

- `node --check apps/editor/e2e/part-texture-layer-persistence-smoke.mjs`
  - Passed.
- `node apps/editor/e2e/part-texture-layer-persistence-smoke.mjs`
  - Passed desktop and mobile.
- `git diff --check -- apps/editor/e2e discussion/implementation/waves/wave28/domain-g-part-texture-layer-e2e-persistence-smoke-gnome-report.md`
  - Passed with LF/CRLF warnings only.
- `pnpm.cmd test:e2e`
  - Failed at the same mobile horizontal overflow gate.
- Review artifact `git diff --check`
  - Passed.

Skipped:

- `pnpm.cmd typecheck` was not run by Gnome because Domain G changed only e2e JavaScript and reports/reviews.
- Full mobile adjacency after source intake was not reached because the integrated full e2e run stops at the mobile overflow failure.

## Review Findings And Fixes

Review-Sylph verdict: `escalate`.

Blocking finding 1:

- Full mobile e2e fails at `mobile post-source-intake` with horizontal overflow from the layer-tree texture `<select>` long atlas label.
- Review-Sylph judged the fix outside Domain G scope because it requires UI layout/source behavior changes, not narrow test-id/aria tweaks.

Blocking finding 2:

- The focused smoke codifies non-truthful Viewer Drawable Layer Evidence by expecting `draw_body: part none / texture tex_w28` while the saved package assertions correctly expect `draw_body` to belong to `part_wave_28_face`.
- Review-Sylph judged that Viewer/Runtime evidence after load is not truthful enough for Domain G pass and requires a source-owned fix outside the e2e-only domain.

Fixes applied:

- None. Both blocking findings require source-owned fixes outside the current Domain G write scope or an explicit scope change from Undine.

## Remaining Issues

- Mobile full e2e is blocked by layer-tree texture select horizontal overflow.
- Viewer Drawable Layer Evidence reports `part none` after drawable reassignment even though saved package and part hierarchy evidence show the drawable under the created part.
- The focused Domain G smoke passes, but its current Viewer drawable part assertion is not accepted as pass evidence because it encodes the inconsistent `part none` text.

## User-Decision Points

No direct end-user decision is required from this Orch-Sylph report.

Routing decisions for Undine:

- Route a source-owned fix for the mobile layer-tree texture select overflow, or explicitly widen Domain G scope to allow narrow layout source changes.
- Route a source-owned fix for Viewer Drawable Layer Evidence so reassigned drawables report their actual part membership after load.
- After those fixes, rerun Domain G focused smoke, full editor e2e, and Review-Sylph review before passing Wave28 Domain G.

## Report Paths

- Gnome report: `discussion/implementation/waves/wave28/domain-g-part-texture-layer-e2e-persistence-smoke-gnome-report.md`
- Review-Sylph report: `discussion/implementation/reviews/wave28/domain-g-part-texture-layer-e2e-persistence-smoke-review.md`
- Orch-Sylph final report: `discussion/implementation/reviews/wave28/domain-g-orch-sylph-final-report.md`
