# Wave61 Domain C Test / E2E Review

- verdict: pass

## Scope Reviewed

- Domain: `wave61-mesh-tool-initial-generation-v0`.
- Lane: test adequacy / E2E oracle re-review, fix loop 1.
- Mode: targeted independent clean re-review after Domain D detected this lane as a final gate blocker.
- Reviewed the Gnome report, current Domain C UX and package/data reviews, Wave61 plan, Domain D final integration review, E2E oracle, target implementation files, target tests, focused diffs, and fresh focused test results.
- This re-review modified only this report file.

Primary files inspected:

- `discussion/implementation/waves/wave61/domain-c-gnome-report.md`
- `discussion/implementation/orchestration/wave61-plan.md`
- `discussion/implementation/reviews/wave61/domain-c-ux-source-structure-review.md`
- `discussion/implementation/reviews/wave61/domain-c-package-data-contract-review.md`
- `discussion/implementation/reviews/wave61/wave61-final-clean-integration-review.md`
- `discussion/design/screen-design/e2e-oracle.md`
- `.github/skills/implementation-orchestration/SKILL.md`
- `packages/operation-core/src/operations/generate-mesh.ts`
- `packages/operation-core/src/operations/generate-mesh.test.ts`
- `packages/authoring-core/src/mesh-generation.test.ts`
- `apps/editor/src/workspace/canvas/canvas-projection.ts`
- `apps/editor/src/workspace/canvas/canvas-projection.test.ts`
- `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx`
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/features/editor-session/model/mesh-tool-state.ts`
- `apps/editor/e2e/psd-import.e2e.spec.ts`

## Current Verdict

Pass. The prior `needs_fix` blockers are closed in the current implementation and tests, and this artifact is now usable as Domain C test/E2E pass evidence for the Wave61 final gate.

Domain D's final integration review correctly identified that a persisted Domain C test/E2E `needs_fix` verdict would block Wave61. In the current workspace, this file records `pass`, and this clean re-review independently verified the source and test evidence rather than relying on the Gnome report alone.

## Prior Finding Closure

### Closed: High - `previewMesh` invalid topology negative tests

Fix verified.

- `generateMesh` now validates `previewMesh.triangles` against `vertices.length` and rejects out-of-range triangle references (`packages/operation-core/src/operations/generate-mesh.ts:260`, `:264`, `:271`).
- It also rejects repeated-index degenerate triangles (`packages/operation-core/src/operations/generate-mesh.ts:278`, `:281`).
- Negative tests cover `[[0, 1, 999]]` and `[[0, 1, 1]]`, assert rejected diagnostics, and assert the session mesh plus `authoringRevision` remain unchanged (`packages/operation-core/src/operations/generate-mesh.test.ts:144`, `:156`, `:161`, `:165`, `:177`, `:182`).

### Closed: Medium - draft discard on target change / tool close

Fix verified for the requested test adequacy level.

- Source still clears drafts when leaving the Mesh tool (`apps/editor/src/features/editor-session/editor-session-context.tsx:133`) and when selection no longer matches the draft Drawable (`apps/editor/src/features/editor-session/editor-session-context.tsx:139`).
- The focused E2E creates a draft, selects a Part Container, verifies the picker path and empty overlay state, then selects a child Drawable and previews again (`apps/editor/e2e/psd-import.e2e.spec.ts:201`, `:212`, `:213`, `:215`, `:219`, `:223`).
- The same E2E creates another draft, switches to the Select tool, asserts the Mesh inspector is hidden and the overlay status is empty, then reopens Mesh and verifies a fresh draft path before Apply (`apps/editor/e2e/psd-import.e2e.spec.ts:226`, `:228`, `:230`, `:233`).
- Cancel after a committed mesh remains covered (`apps/editor/e2e/psd-import.e2e.spec.ts:240`, `:243`, `:244`, `:245`).

### Closed: Medium - container-selected Drawable picker path

Fix verified.

- The Mesh inspector renders a Drawable picker for Part selection (`apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:76`, `:82`).
- Picker candidates are collected through `getPartOrderedChildren`, including nested Part Containers (`apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:319`, `:321`, `:330`; `apps/editor/src/features/editor-session/model/mesh-tool-state.ts:126`).
- The focused E2E selects a Part Container, uses the Drawable picker, selects a child Drawable, previews, and later applies the mesh (`apps/editor/e2e/psd-import.e2e.spec.ts:208`, `:213`, `:217`, `:219`, `:222`, `:236`).

## New Findings

None.

## E2E Oracle Compliance

- Compliant. The new/updated E2E path uses role selectors, visible locators, text, and `data-mesh-*` state attributes as the oracle (`apps/editor/e2e/psd-import.e2e.spec.ts:196`, `:200`, `:203`, `:204`, `:215`, `:224`, `:228`, `:238`).
- No screenshot assertion, visual regression assertion, canvas pixel oracle, or image snapshot oracle was added. Search for screenshot/pixel assertion APIs found no test oracle usage; matches were production renderer code or `pixelFormat` metadata, not assertions.
- Playwright screenshots remain disabled (`apps/editor/playwright.config.ts:11`).
- This matches the accepted oracle guidance not to add screenshot assertions or pixel oracles (`discussion/design/screen-design/e2e-oracle.md:67`).

## Verification Performed

- `pnpm.cmd exec vitest run packages/operation-core/src/operations/generate-mesh.test.ts packages/authoring-core/src/mesh-generation.test.ts apps/editor/src/workspace/canvas/canvas-projection.test.ts`
  - Sandbox: failed at Vite/esbuild startup with `spawn EPERM`.
  - Escalated rerun: pass, 3 files / 19 tests.
- `pnpm.cmd --dir apps/editor run test:e2e:psd-import e2e/psd-import.e2e.spec.ts -g "generates an initial mesh"`
  - Sandbox: failed with `spawn EPERM`.
  - Escalated rerun: pass, 1 test.
- `rg -n "toHaveScreenshot|screenshot|pixel oracle|visual regression|page\.screenshot|toMatchSnapshot|image snapshot" apps/editor/e2e apps/editor/playwright.config.ts discussion/design/screen-design/e2e-oracle.md`
  - Result: no screenshot/pixel/image snapshot assertions in E2E tests; only Playwright screenshot config `off` and design-doc prohibition text matched.
- `git diff --check -- discussion/implementation`
  - Result: pass after this report update.
- `rg -n "[ \t]+$" discussion/implementation/reviews/wave61/domain-c-test-e2e-review.md`
  - Result: no trailing-whitespace hits for this artifact. This file is currently untracked in the workspace, so the required `git diff --check -- discussion/implementation` command does not include it yet.

## Residual Risks

- The target-change E2E asserts UI/projection state attributes, not a serialized before/after project mesh snapshot for the abandoned draft. The operation-level negative tests and tool-close E2E cover non-commit behavior more directly; this is acceptable for this lane but remains a precision gap if future regressions become subtle.
- Geometry-level zero-area triangles with three distinct collinear vertices are still outside the implemented negative test scope. The prior explicit requirement was repeated-index degeneracy plus out-of-range indices.
- Workspace still contains unrelated Domain A/B/C dirty changes. This review did not revert or adjudicate changes outside the requested Domain C test/E2E scope.

## User-Decision Points

None.
