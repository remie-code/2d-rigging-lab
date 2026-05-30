# Wave 14 Domain B Completion: Preview-Ready Sample Package

> Wave: `editor-embedded-preview-foundation`
> Domain: `wave14-preview-ready-sample-package`
> Verdict: `pass`

## Scope

Domain B updated the browser editor initial sample package so it can act as the preview workflow oracle for later embedded preview UI work.

No UI, app shell, CSS, workflow state, runtime/package contracts, Domain A projection source, or e2e harness files were edited.

## Files Changed

Production:

- `apps/editor/src/editor-session/browser-sample-package.ts`

Tests:

- `apps/editor/src/editor-session/browser-sample-package.test.ts`

Reports:

- `discussion/implementation/waves/wave14/wave14-preview-ready-sample-package-completion.md`
- `discussion/implementation/reviews/wave14/wave14-preview-ready-sample-package-review.md`

## Implementation Summary

- Added slider-ready authored input parameter `param_preview_body_yaw` with `min=-1`, `max=1`, `default=0`, current-value-compatible default semantics, and `recommendedUiStep=0.01`.
- Added compact `linear-1d-v1` keyform set `keyset_preview_body_yaw_vertices` targeting `mesh_body.vertices`.
- Changed the sample triangle from a tiny corner shape to a centered generated fixture so the preview geometry remains visible in the 128 x 128 canvas.
- Kept the sample as private-prototype-native generated text fixture metadata with no Cubism format, Cubism SDK/Core, or external binary asset dependency.

## Tests And Verification

Passed:

- `pnpm.cmd exec vitest run apps/editor/src/editor-session/browser-sample-package.test.ts`
  - 1 test file / 3 tests passed.
- `pnpm.cmd typecheck`
  - root typecheck and editor typecheck passed.
- `pnpm.cmd run check:source`
  - source organization guard passed.
- `git diff --check -- apps/editor/src/editor-session/browser-sample-package.ts apps/editor/src/editor-session/browser-sample-package.test.ts`
  - no whitespace errors.

Initial sandbox attempt:

- `pnpm.cmd exec vitest run apps/editor/src/editor-session/browser-sample-package.test.ts`
  - failed with `EPERM` opening Vitest from `node_modules`.
  - escalated rerun of the same focused command passed.

## Runtime Evidence

Focused tests prove:

- The sample package parses through `PackageDocumentSchema`.
- The sample parameter has slider-usable min/max/default/step metadata.
- Runtime evaluation through `createAuthoringSessionFromPackageDocument`, `toRuntimeGraph`, `createInitialRuntimeState`, and `evaluateRuntimeFrame` changes `draw_body` bounds and vertex hash when `param_preview_body_yaw` moves from `0` to `1`.
- `compareRuntimeSnapshots` reports the drawable geometry change.
- Domain A `projectEditorPreview` can see the sample runtime diff and projected drawable bounds without modifying Domain A source.

## Review Findings And Fixes Applied

Independent Review-Sylph verdict: `pass`.

Findings:

- None.

Fixes applied:

- None after review.

Implementation self-fix before review:

- Adjusted the projection-focused test to assert global keyform sample summary by runtime target, because Domain A intentionally counts per-drawable keyform samples only when the sample target string directly matches drawable id / mesh id conventions used by the projection.

## Review Lane Results

Product Workflow: pass.

- Initial browser sample now contains a slider-ready parameter and keyform oracle for later UI controls.

Runtime Truthfulness: pass.

- The visible change is observed through runtime evaluation and runtime snapshot comparison, not through test-only fake state.

Development Compliance: pass.

- Source writes stayed in the Domain B source/test scope.
- No public `index.ts` or catch-all source file was touched.
- Source organization guard passed.

Test Adequacy: pass.

- Focused tests cover parse/validation, runtime-visible geometry change, runtime diff, and Domain A preview projection visibility.

## Remaining Issues

- Actual browser slider wiring, visual panel rendering, and browser-level smoke are intentionally left to later Wave 14 domains D/E.

## User-Decision Points

- None.

## Provisional Assumptions

- `default` parameter value in the package is the source value that later preview controls will treat as the initial/current slider value until Domain C adds preview-only parameter state.
- The generated fixture `filePath` remains package metadata and is not an external runtime asset requirement.
