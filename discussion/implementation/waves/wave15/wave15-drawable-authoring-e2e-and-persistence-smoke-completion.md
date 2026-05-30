# Wave 15 Domain E Completion: Drawable Authoring E2E And Persistence Smoke

> Wave: `editor-drawable-mesh-authoring-vertical-slice`
> Domain: `wave15-drawable-authoring-e2e-and-persistence-smoke`
> Verdict: `pass`
> Date: 2026-05-30

## Files Changed

- `scripts/editor-e2e-smoke.mjs`
- `apps/editor/e2e/test-ids.mjs`
- `apps/editor/e2e/smoke-checks.mjs`
- `apps/editor/src/ui/drawable-authoring/drawable-authoring-form.ts`
- `apps/editor/src/ui/drawable-authoring/drawable-list.ts`
- `apps/editor/src/styles/editor.css`
- `discussion/implementation/waves/wave15/wave15-drawable-authoring-e2e-and-persistence-smoke-completion.md`
- `discussion/implementation/reviews/wave15/wave15-drawable-authoring-e2e-and-persistence-smoke-review.md`

## Implementation Summary

- Extended the existing editor CDP e2e smoke harness instead of creating a parallel harness.
- Preserved the Wave 14 preview slider smoke and existing AI approval smoke.
- Added deterministic generated drawable smoke data:
  - display name: `Wave 15 Smoke Drawable`
  - drawable id: `draw_wave_15_smoke_drawable`
  - mesh id: `mesh_wave_15_smoke_drawable`
  - bounds: `84, 24 / 28 x 36`
- Added browser assertions for:
  - drawable authoring panel/form/list visibility and reachability on desktop and mobile;
  - accessible names for the authoring region, create form, form controls, submit button, and drawable list;
  - create drawable form submission through native browser DOM controls;
  - created drawable list row with deterministic id, mesh id, bounds, and `9 vertices / 8 triangles`;
  - runtime preview summary changing to `2 visible / 2 total`;
  - preview SVG containing the created drawable geometry;
  - save storage containing the created drawable id, mesh id, display name, generated artifacts, operation log, and AI transcript;
  - load restoring the created drawable row, mesh summary, bounds, preview summary, and preview geometry;
  - reset removing the created drawable and restoring the sample drawable state.
- Added screenshot metadata logging for the drawable authoring state in both desktop and mobile e2e runs.
- Added narrow aria labels to the generated drawable form and drawable list.
- Adjusted the drawable list table layout so long ids do not create desktop/mobile horizontal overflow.

## Tests Run

| Command | Result | Notes |
|---|---|---|
| `pnpm.cmd test:e2e` | initial sandbox fail | Sandbox could not load Vite dependency `fdir` from pnpm `node_modules`. |
| `pnpm.cmd test:e2e` | pass after escalation | Desktop and mobile smoke passed. Final screenshot metadata: desktop preview `png base64Length=68052`, desktop drawable `84104`, mobile preview `39212`, mobile drawable `49556`. |
| `pnpm.cmd typecheck` | pass | Root and editor typecheck passed after source aria/CSS changes. |
| `pnpm.cmd run check:source` | pass | Source organization guard passed. |
| `pnpm.cmd exec vitest run apps/editor/src/ui/drawable-authoring/drawable-authoring-panel.test.ts apps/editor/src/ui/app-shell/app-shell.test.ts` | initial sandbox fail, pass after escalation | Sandbox could not load Vitest; escalated focused UI rerun passed 2 files / 10 tests. |
| `git diff --check -- scripts/editor-e2e-smoke.mjs apps/editor/e2e apps/editor/src/ui/drawable-authoring apps/editor/src/styles/editor.css` | pass | LF/CRLF working-copy warnings only. |

## Review Findings And Fixes Applied

- Independent Review-Sylph returned `pass`.
- Review noted no blocking findings.
- Review residual: a11y remains smoke-level and does not inspect the full accessibility tree.
- Review suggestion: load assertions could additionally re-check created drawable bounds and preview points.
  - Fix applied: `assertCreatedDrawableVisibleAfterLoad` now checks `84, 24 / 28 x 36` and preview points after load.
  - Verification: final `pnpm.cmd test:e2e` rerun passed after the strengthened assertion.

## Remaining Issues

- Accessibility coverage is browser smoke-level only; it checks labels/attributes and visible names, not a full accessibility tree snapshot.
- The e2e harness remains a single smoke script. This matches the existing project pattern and Domain E scope, but future broader workflows may need scenario-specific e2e modules.

## User-Decision Points

- None.

## Provisional Assumptions

- Running browser/Vite and Vitest outside the sandbox after dependency access failures is acceptable verification evidence under the project escalation policy.
- The existing `createParameter` AI approval smoke should keep its deterministic operation IDs, so the drawable smoke runs after the AI smoke.
- `auto-grid-v1` medium density producing `9 vertices / 8 triangles` is the stable Wave 15 generated mesh oracle.
