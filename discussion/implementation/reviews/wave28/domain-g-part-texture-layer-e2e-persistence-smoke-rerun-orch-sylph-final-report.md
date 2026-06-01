# Wave28 Domain G Rerun Orch-Sylph Final Report: Part / Texture / Layer E2E Persistence Smoke

## verdict

pass

## target

- Domain rerun: `wave28-part-texture-layer-e2e-persistence-smoke-rerun`
- Parent caller: Undine
- Orchestrator: Orch-Sylph
- Date: 2026-06-01

## orchestration separation and wait evidence

- Orch-Sylph did not implement source or e2e changes.
- Rerun implementation/verification was delegated to Gnome in a separate context without full-history fork.
  - Agent id: `019e8374-78a1-7030-9281-a3e0b2196759`
  - Result: `pass`
  - Report: `discussion/implementation/waves/wave28/domain-g-part-texture-layer-e2e-persistence-smoke-rerun-gnome-report.md`
- Independent review was delegated to Review-Sylph in a separate clean context after Gnome completed.
  - Agent id: `019e837a-24a1-7f31-9915-b2b97bb003c9`
  - Result: `pass`
  - Report: `discussion/implementation/reviews/wave28/domain-g-part-texture-layer-e2e-persistence-smoke-rerun-review.md`
- Orch-Sylph waited for both subagents to reach completed final statuses before issuing this report.
- Review-Sylph received basis documents, target files, prior blocker/remediation reports, current diff scope, and required verification. Review-Sylph was not given full conversation history and was instructed not to rely on Gnome's report as its only source.

## files changed in this rerun

Gnome rerun:

- `discussion/implementation/waves/wave28/domain-g-part-texture-layer-e2e-persistence-smoke-rerun-gnome-report.md`

Review-Sylph rerun review:

- `discussion/implementation/reviews/wave28/domain-g-part-texture-layer-e2e-persistence-smoke-rerun-review.md`

Orch-Sylph final report:

- `discussion/implementation/reviews/wave28/domain-g-part-texture-layer-e2e-persistence-smoke-rerun-orch-sylph-final-report.md`

No source or e2e test code was changed by the rerun itself. Existing upstream Wave28 A-F, Domain G initial e2e, and Domain G R1/R2 remediation changes were preserved.

## verification

Gnome reported passing:

- `node --check apps/editor/e2e/part-texture-layer-persistence-smoke.mjs`
- `node apps/editor/e2e/part-texture-layer-persistence-smoke.mjs`
  - Focused desktop smoke passed.
  - Focused mobile smoke passed.
- `pnpm.cmd test:e2e`
  - Full editor desktop smoke passed.
  - Full editor mobile smoke passed.
  - Integrated Wave28 part/texture/layer smoke was reached and completed.
- `git diff --check -- apps/editor/e2e discussion/implementation/waves/wave28/domain-g-part-texture-layer-e2e-persistence-smoke-rerun-gnome-report.md`
  - Passed with LF/CRLF working-copy warnings only.

Review-Sylph independently reported passing:

- `node --check apps/editor/e2e/part-texture-layer-persistence-smoke.mjs`
- `node apps/editor/e2e/part-texture-layer-persistence-smoke.mjs`
- `pnpm.cmd test:e2e`
- `pnpm.cmd exec vitest run apps/editor/src/ui/layer-tree/layer-tree-panel.test.ts apps/editor/src/editor-preview/texture-preview-resolution.test.ts apps/editor/src/editor-workflow/part-texture-layer-workflow.test.ts`
- `git diff --check -- apps/editor/e2e apps/editor/src/ui/layer-tree apps/editor/src/editor-preview apps/editor/src/editor-workflow/part-texture-layer-workflow.test.ts discussion/implementation/waves/wave28/domain-g-part-texture-layer-e2e-persistence-smoke-rerun-gnome-report.md`
- trailing-whitespace scan for reviewed untracked focused files

Skipped:

- `pnpm.cmd typecheck` was not rerun in the rerun/review because the rerun itself changed no TypeScript or UI source. The upstream R1/R2 remediation reports already recorded typecheck passes for their source changes.

## original blocker clearance

Original blocker 1, mobile layer-tree texture select/control overflow, is cleared.

- Full `pnpm.cmd test:e2e` now passes desktop and mobile.
- Review-Sylph verified the original overflow assertions remain active in `apps/editor/e2e/smoke-checks.mjs` and the focused smoke still fails on horizontal overflow.
- Review-Sylph verified the fix is source-level layout containment in `apps/editor/src/ui/layer-tree/layer-tree-panel.ts`, with focused coverage in `apps/editor/src/ui/layer-tree/layer-tree-panel.test.ts`, not an e2e-only mask.

Original blocker 2, Viewer Drawable Layer Evidence reporting `part none` after reassignment/save/load, is cleared.

- The focused smoke now requires `draw_body: part part_wave_28_face / texture tex_w28`.
- Review-Sylph found no focused-smoke acceptance of `part none` for the reassigned drawable.
- Review-Sylph verified the projection fix hydrates missing drawable part evidence from projected part membership in `apps/editor/src/editor-preview/texture-preview-resolution.ts`.
- Focused source/workflow tests cover the hydrated drawable evidence path.

## review findings and fixes

Review-Sylph verdict: `pass`.

- No blocking findings.
- No non-blocking findings.
- No rerun fixes were required after review.

Review-Sylph verified:

- no assertion weakening
- no e2e-only masking of source problems
- adequate desktop/mobile persistence coverage
- no forbidden file picker, parser, archive, image decode, dependency, full renderer, pixel oracle, Cubism/SDK/Core, or broad source changes
- reviewed `index.ts` files remain barrel-only re-exports

## remaining issues

None for the Domain G rerun gate.

Residual scope note: this gate verifies semantic part/texture/layer persistence and evidence surfaces. It does not claim full rendering, real image decoding, file intake, texture sampling correctness, or pixel-level correctness.

## user-decision points

None.

## report paths

- Gnome rerun report: `discussion/implementation/waves/wave28/domain-g-part-texture-layer-e2e-persistence-smoke-rerun-gnome-report.md`
- Review-Sylph rerun review: `discussion/implementation/reviews/wave28/domain-g-part-texture-layer-e2e-persistence-smoke-rerun-review.md`
- Orch-Sylph final report: `discussion/implementation/reviews/wave28/domain-g-part-texture-layer-e2e-persistence-smoke-rerun-orch-sylph-final-report.md`
