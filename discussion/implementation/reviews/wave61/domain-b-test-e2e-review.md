# Wave61 Domain B Test / E2E Review

verdict: `pass`

## Scope Reviewed

- Domain: `wave61-psd-import-preview-hidden-group-semantics`
- Lane: test adequacy / E2E oracle
- Focus: re-review of the prior D-B-T1 and D-B-T2 findings after Gnome's focused fix.
- Reviewed focused changed files:
  - `apps/editor/src/features/editor-session/model/editor-hidden-part-state.ts`
  - `apps/editor/src/features/editor-session/editor-session-context.tsx`
  - `apps/editor/src/features/psd-import/model/psd-import-hidden-part-bridge.test.ts`
  - `packages/operation-core/src/operations/import-psd-structural-scaffold.test.ts`
  - `discussion/implementation/waves/wave61/domain-b-gnome-report.md`
- No source, implementation, fixture, or test files were edited. Only this review report was updated.
- This re-review reused the existing Review-Sylph context because the caller reported a thread-limit failure when trying to start a new Review-Sylph.

## Basis Documents Used

- `discussion/implementation/orchestration/wave61-plan.md`
- `discussion/implementation/waves/wave61/domain-a-gnome-report.md`
- `discussion/implementation/reviews/wave61/domain-a-test-e2e-review.md`
- `discussion/design/screen-design/screens/psd-import-task.md`
- `discussion/design/screen-design/e2e-oracle.md`
- `discussion/development_convention/ux-backed-package-logic-authority.md`
- `.github/skills/implementation-orchestration/SKILL.md`
- `discussion/implementation/waves/wave61/domain-b-gnome-report.md`
- Prior `discussion/implementation/reviews/wave61/domain-b-test-e2e-review.md`

## Findings Ordered By Severity

### None: no blocking findings remain

No new `needs_fix`, `escalate`, or `blocked` finding remains for this lane.

### Closed: D-B-T1 hidden Part Container bridge coverage

D-B-T1 is closed. The focused test now directly proves the hidden PSD group bridge from planning through commit and session-only hidden state, while preserving child Drawable runtime visibility:

- `apps/editor/src/features/psd-import/model/psd-import-hidden-part-bridge.test.ts:67` defines the focused behavior: locally hidden PSD groups initialize editor-hidden Part IDs without hiding local-visible child Drawables at runtime.
- `apps/editor/src/features/psd-import/model/psd-import-hidden-part-bridge.test.ts:82` asserts the plan produces one `editorHiddenPartIds` entry.
- `apps/editor/src/features/psd-import/model/psd-import-hidden-part-bridge.test.ts:83` asserts review rows distinguish `Hidden Part Container` from a child Drawable `Hidden by parent group`.
- `apps/editor/src/features/psd-import/model/psd-import-hidden-part-bridge.test.ts:98` and `:102` assert commit returns the same hidden Part IDs from the plan.
- `apps/editor/src/features/psd-import/model/psd-import-hidden-part-bridge.test.ts:105` asserts imported hidden Part IDs merge with existing editor-hidden state instead of replacing it.
- `apps/editor/src/features/psd-import/model/psd-import-hidden-part-bridge.test.ts:127` asserts the local-visible child Drawable remains `runtimeVisibility: true` and belongs to the imported hidden Part.
- `apps/editor/src/features/psd-import/model/psd-import-hidden-part-bridge.test.ts:135` asserts the session tree projection marks the imported Part as editor/effective hidden while the child Drawable remains runtime-visible and only becomes effectively hidden through the editor gate.
- `apps/editor/src/features/editor-session/model/editor-hidden-part-state.ts:3` implements the focused union helper used by the bridge.
- `apps/editor/src/features/editor-session/editor-session-context.tsx:160` through `:166` applies `mergeEditorHiddenPartIds()` after `commitPsdImportPlan()`, confirming the tested state bridge is connected to the editor session import path.

This is a meaningful headless oracle for the requirement: hidden PSD group Part Containers initialize editor-only hidden state, and child Drawable runtime visibility is not rewritten merely because the parent group is hidden.

### Closed: D-B-T2 source-order insertion coverage

D-B-T2 is closed. The operation test now directly asserts mixed `children` order and model diff effects tied to the Domain A ordered-children contract:

- `packages/operation-core/src/operations/import-psd-structural-scaffold.test.ts:52` checks the generated root Part shape after structural PSD import.
- `packages/operation-core/src/operations/import-psd-structural-scaffold.test.ts:55` asserts the mixed `children` sequence is `[drawable, part]`, rather than falling back to separate legacy `childPartIds` then `drawableIds` ordering.
- `packages/operation-core/src/operations/import-psd-structural-scaffold.test.ts:67` through `:73` asserts model diffs include `/model/graph/parts/part_root/children`, the generated group Part `/children`, and `/model/drawOrder/entries`.

The broader helper behavior remains under Domain A ownership. For this Domain B lane, the focused operation assertion is sufficient because it proves the import path emits and diffs mixed source-order children at the integration point.

### No oracle violation introduced

The focused fix did not introduce screenshot/pixel oracle requirements, raw parser payload dependencies, or normal-UI debug/evidence text requirements.

- The new hidden bridge coverage is a model/session headless test.
- The updated operation coverage asserts structural state and model diff paths.
- `apps/editor/e2e/psd-import.e2e.spec.ts:26` through `:29` continues to use stable preview readiness and visible-layer-count state hooks, not screenshots or pixel matching.
- A targeted search for screenshot/pixel/debug/raw parser oracle terms under the PSD import feature, focused tests, and PSD import E2E found only benign implementation/test data names such as `pixelWidth`, `pixelHeight`, and `pixelFormat`.

## Verification Performed

Read and compared the updated Gnome report, the prior review report, and the focused changed files listed above.

Ran focused verification:

`pnpm.cmd exec vitest run apps/editor/src/features/psd-import/model/psd-import-hidden-part-bridge.test.ts packages/operation-core/src/operations/import-psd-structural-scaffold.test.ts`

- Sandbox result: failed with Vite/esbuild `spawn EPERM`.
- Escalated rerun result: pass, 2 files / 12 tests.

Reviewed Gnome's reported post-fix verification and found it credible and complete for this lane:

- Focused Vitest: pass, 2 files / 12 tests after escalated rerun.
- `pnpm.cmd --dir apps/editor typecheck`: reported pass.
- root `pnpm.cmd run typecheck`: reported pass.
- `pnpm.cmd run check:source`: reported pass.
- focused `git diff --check`: reported pass with LF/CRLF warnings only.

## Remaining Risks / Constraints

- I did not require screenshot or pixel verification; that remains intentionally out of scope per the E2E oracle.
- I did not rerun app/root typecheck or source check locally in this re-review; I inspected Gnome's recorded commands/results and reran the focused tests that close the prior findings.
- Playwright E2E still does not specifically exercise a hidden group fixture. This is acceptable for this lane because the hidden group semantics are now covered through focused headless plan/commit/session and operation tests, while E2E remains a stable user-path/state oracle.

## User-Decision Points

- None.
