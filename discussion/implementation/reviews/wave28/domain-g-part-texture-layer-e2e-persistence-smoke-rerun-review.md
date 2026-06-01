# Wave28 Domain G Rerun Review: Part / Texture / Layer E2E Persistence Smoke

## verdict

pass

## basis used

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave28-plan.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/implementation/waves/wave28/domain-g-part-texture-layer-e2e-persistence-smoke-gnome-report.md`
- `discussion/implementation/reviews/wave28/domain-g-part-texture-layer-e2e-persistence-smoke-review.md`
- `discussion/implementation/reviews/wave28/domain-g-orch-sylph-final-report.md`
- `discussion/implementation/waves/wave28/domain-g-remediation-mobile-layer-tree-overflow-gnome-report.md`
- `discussion/implementation/reviews/wave28/domain-g-remediation-mobile-layer-tree-overflow-review.md`
- `discussion/implementation/waves/wave28/domain-g-remediation-viewer-drawable-part-evidence-gnome-report.md`
- `discussion/implementation/reviews/wave28/domain-g-remediation-viewer-drawable-part-evidence-orch-report.md`
- `discussion/implementation/waves/wave28/domain-g-part-texture-layer-e2e-persistence-smoke-rerun-gnome-report.md`
- Current repository state, target files, reviewed diffs, and fresh verification listed below.

## findings

No blocking or non-blocking findings.

## blocker clearance review

Original blocker 1, mobile layer-tree texture select/control overflow, is cleared.

- The overflow oracle was not hidden or relaxed. The original full-smoke post-source-intake read/assert path remains active in `apps/editor/e2e/smoke-checks.mjs:83` and `apps/editor/e2e/smoke-checks.mjs:89`.
- The integrated Wave28 smoke adds overflow checks after the part/texture/layer workflow and after reset at `apps/editor/e2e/smoke-checks.mjs:183` and `apps/editor/e2e/smoke-checks.mjs:186`.
- The focused smoke still throws on horizontal overflow at `apps/editor/e2e/part-texture-layer-persistence-smoke.mjs:763`.
- The source fix addresses layout directly: responsive grid/control constraints and wrapping are in `apps/editor/src/ui/layer-tree/layer-tree-panel.ts:74`, `apps/editor/src/ui/layer-tree/layer-tree-panel.ts:76`, `apps/editor/src/ui/layer-tree/layer-tree-panel.ts:80`, `apps/editor/src/ui/layer-tree/layer-tree-panel.ts:81`, `apps/editor/src/ui/layer-tree/layer-tree-panel.ts:128`, and `apps/editor/src/ui/layer-tree/layer-tree-panel.ts:133`.
- Focused source coverage for the long selector case is in `apps/editor/src/ui/layer-tree/layer-tree-panel.test.ts:93`.

Original blocker 2, Viewer Drawable Layer Evidence reporting `part none` after reassignment/save/load, is cleared.

- The focused smoke now requires the assigned part in Viewer evidence at `apps/editor/e2e/part-texture-layer-persistence-smoke.mjs:380` and `apps/editor/e2e/part-texture-layer-persistence-smoke.mjs:384`.
- I found no focused-smoke acceptance of `part none` for the reassigned drawable.
- The projection fix hydrates missing drawable part evidence from projected part membership at `apps/editor/src/editor-preview/texture-preview-resolution.ts:40`, `apps/editor/src/editor-preview/texture-preview-resolution.ts:52`, `apps/editor/src/editor-preview/texture-preview-resolution.ts:60`, and `apps/editor/src/editor-preview/texture-preview-resolution.ts:76`.
- Focused source tests assert hydrated drawable part evidence at `apps/editor/src/editor-preview/texture-preview-resolution.test.ts:78` and `apps/editor/src/editor-preview/texture-preview-resolution.test.ts:113`, and workflow-level Viewer evidence at `apps/editor/src/editor-workflow/part-texture-layer-workflow.test.ts:46` and `apps/editor/src/editor-workflow/part-texture-layer-workflow.test.ts:103`.

## verification run

Passed:

- `node --check apps/editor/e2e/part-texture-layer-persistence-smoke.mjs`
- `node apps/editor/e2e/part-texture-layer-persistence-smoke.mjs`
  - Desktop focused smoke passed.
  - Mobile focused smoke passed.
  - Final focused smoke result passed.
  - Screenshot evidence: desktop `png base64Length=105828`; mobile `png base64Length=53888`.
- `pnpm.cmd test:e2e`
  - Desktop full smoke passed.
  - Mobile full smoke passed.
  - Final full e2e result passed.
  - Screenshot evidence: desktop preview `84316`, desktop drawable `148868`, mobile preview `52412`, mobile drawable `39656`.
- `pnpm.cmd exec vitest run apps/editor/src/ui/layer-tree/layer-tree-panel.test.ts apps/editor/src/editor-preview/texture-preview-resolution.test.ts apps/editor/src/editor-workflow/part-texture-layer-workflow.test.ts`
  - 3 files passed.
  - 8 tests passed.
- `git diff --check -- apps/editor/e2e apps/editor/src/ui/layer-tree apps/editor/src/editor-preview apps/editor/src/editor-workflow/part-texture-layer-workflow.test.ts discussion/implementation/waves/wave28/domain-g-part-texture-layer-e2e-persistence-smoke-rerun-gnome-report.md`
  - Passed with LF-to-CRLF working-copy warnings only.
- `rg -n "[ \t]+$" apps/editor/e2e/part-texture-layer-persistence-smoke.mjs apps/editor/src/ui/layer-tree/layer-tree-panel.ts apps/editor/src/ui/layer-tree/layer-tree-panel.test.ts apps/editor/src/editor-preview/preview-layer-state.ts apps/editor/src/editor-workflow/part-texture-layer-workflow.test.ts`
  - No matches. This covered reviewed untracked files that `git diff --check` does not include.

Skipped:

- `pnpm.cmd typecheck` was not rerun in this review because the rerun agent changed only its report and no TypeScript/UI source. The upstream R1/R2 remediation reports already recorded typecheck passes; this review reran source-focused tests and the full e2e gate.

Note: non-escalated shell/node invocations in this environment fail with `windows sandbox: spawn setup refresh`; verification commands were run with approved escalation.

## assertion / truthfulness review

The rerun gate is truthful. The focused smoke checks actual UI workflow behavior, saved package contents, Preview semantic data attributes, Viewer semantic text, and save/load persistence. It does not rely on a relaxed text oracle or a pixel oracle.

Persistence assertions remain strict in `apps/editor/e2e/part-texture-layer-persistence-smoke.mjs:409`: saved graph membership, drawable `partId`, texture assignment, preview asset reference kind, editor state, operation targets, and generated runtime/validation artifacts must match the expected state.

The Viewer source renderer still has a generic fallback for genuinely missing part evidence in `apps/editor/src/ui/viewer-runtime/viewer-runtime-summary.ts:194`, but the reassigned Domain G path no longer reaches that fallback. The current smoke and focused unit/workflow tests require assigned part evidence.

## coverage review

Coverage is adequate for the Domain G persistence gate:

- Desktop and mobile focused smoke cover create part, drawable reassignment, existing texture assignment, selection, lock, editor hide, Preview evidence, Viewer evidence, save/load, and post-load reinspection.
- Full `pnpm.cmd test:e2e` integrates the Wave28 smoke after adjacent editor workflows and confirms the mobile overflow blocker no longer stops the suite.
- Focused source tests cover both original source-owned fixes: responsive layer-tree layout and Viewer drawable part evidence hydration.

This remains semantic e2e evidence, not full renderer, texture sampling, or pixel-level correctness evidence. That matches Wave28 non-goals.

## source organization / non-goal containment review

- No dependency manifest or lockfile diff was present for the reviewed scope.
- Changed `index.ts` files inspected in the current diff are barrel-only re-exports, including `apps/editor/src/editor-session/index.ts`, `apps/editor/src/editor-state/index.ts`, `apps/editor/src/editor-workflow/index.ts`, `packages/authoring-core/src/index.ts`, `packages/operation-core/src/index.ts`, `packages/runtime-core/src/index.ts`, and `packages/validator-core/src/index.ts`.
- `apps/editor/src/ui/layer-tree/index.ts` remains a barrel-only file.
- No reviewed change adds file picker, parser, archive, external dependency, full renderer, pixel oracle, Cubism/SDK/Core dependency, or image-decode implementation.
- Forbidden-scope scan found pre-existing image decode helper text in `apps/editor/e2e/smoke-checks.mjs`, outside the reviewed Domain G diff. The focused Domain G seed explicitly records metadata-only texture setup with no PSD bytes, file picker, parser, or image decode.

## remaining issues

None for this rerun gate.

Residual scope note: Wave28 Domain G verifies semantic part/texture/layer persistence and evidence surfaces. It does not prove full rendering, real image decoding, file intake, or pixel-correct texture sampling.

## user-decision points

None.

## report path

`discussion/implementation/reviews/wave28/domain-g-part-texture-layer-e2e-persistence-smoke-rerun-review.md`
