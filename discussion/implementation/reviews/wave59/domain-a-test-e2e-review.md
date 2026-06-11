# Wave59 Domain A Test / E2E Review

verdict: `pass`

## Scope

- Target wave: Wave59 `canvas-renderer-psd-drawable-display-v0`
- Review lane: Review-Sylph 3 - test adequacy / E2E oracle compliance
- Gnome report considered as evidence: `discussion/implementation/waves/wave59/domain-a-gnome-report.md`
- Primary files inspected:
  - `apps/editor/e2e/psd-import.e2e.spec.ts`
  - `apps/editor/src/workspace/canvas/canvas-projection.ts`
  - `apps/editor/src/workspace/canvas/canvas-projection.test.ts`
  - `apps/editor/src/workspace/canvas/canvas-renderer.ts`
  - `apps/editor/src/workspace/panels/canvas-preview-panel.tsx`
  - `packages/operation-core/src/operations/import-psd-layer-materialization.ts`
  - `packages/operation-core/src/operations/import-psd-layer-materialization.test.ts`
  - PSD import planner / commit / browser parser adapter files touched by the tests

## Basis

- `discussion/implementation/orchestration/wave59-plan.md`
- `discussion/design/screen-design/e2e-oracle.md`
- `discussion/design/screen-design/react-editor-foundation-oracle.md`
- `discussion/design/screen-design/components/canvas-preview.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/operation-policy.md`
- `.github/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/implementation-orchestration/SKILL.md`

## Findings

No blocking or needs-fix findings.

## Test Adequacy

Pass. The tests cover the Wave59 vertical path at the right oracle layer.

- Playwright covers import -> review -> commit -> Parts Tree / Inspector -> Canvas surface -> toolbar -> Canvas click selection in `apps/editor/e2e/psd-import.e2e.spec.ts:11` through `apps/editor/e2e/psd-import.e2e.spec.ts:80`.
- Canvas display presence and renderable state are asserted by non-visible controlled hooks at `apps/editor/e2e/psd-import.e2e.spec.ts:41` through `apps/editor/e2e/psd-import.e2e.spec.ts:47`.
- Toolbar reachability is exercised through user-facing roles for Fit Canvas, Fit Artwork, Zoom in, 1:1, and Isolate Selected at `apps/editor/e2e/psd-import.e2e.spec.ts:49` through `apps/editor/e2e/psd-import.e2e.spec.ts:59`.
- Canvas click selection is deterministic without pixel oracle: the test reads controlled hit coordinates and verifies the Inspector selection changes to `Drawable` at `apps/editor/e2e/psd-import.e2e.spec.ts:61` through `apps/editor/e2e/psd-import.e2e.spec.ts:80`.
- Focused unit coverage exists for projection, opacity, runtime bytes, visibility, draw order, hit test, mask relation projection, part subtree selection, fit math, zoom math, and hidden-only isolate behavior in `apps/editor/src/workspace/canvas/canvas-projection.test.ts:44` through `apps/editor/src/workspace/canvas/canvas-projection.test.ts:134`.
- Projection logic is outside React: projection is built in `apps/editor/src/workspace/canvas/canvas-projection.ts:73` through `apps/editor/src/workspace/canvas/canvas-projection.ts:171`; hit test is at `apps/editor/src/workspace/canvas/canvas-projection.ts:174`; fit/zoom math is at `apps/editor/src/workspace/canvas/canvas-projection.ts:192` through `apps/editor/src/workspace/canvas/canvas-projection.ts:295`; renderability/isolate checks are at `apps/editor/src/workspace/canvas/canvas-projection.ts:298` through `apps/editor/src/workspace/canvas/canvas-projection.ts:318`.
- PSD opacity is covered at the operation boundary: implementation maps `sourceLayer.opacityInSource` to `defaultOpacity` in `packages/operation-core/src/operations/import-psd-layer-materialization.ts:270` through `packages/operation-core/src/operations/import-psd-layer-materialization.ts:280`, and the test asserts `defaultOpacity: 0.42` at `packages/operation-core/src/operations/import-psd-layer-materialization.test.ts:72` through `packages/operation-core/src/operations/import-psd-layer-materialization.test.ts:81`.

Not a blocker: `canvas-renderer.ts` is not directly unit-tested with a mocked `CanvasRenderingContext2D`. The high-risk deterministic surfaces for this wave are covered in projection/unit tests, while Playwright verifies the browser-visible path without becoming a visual oracle.

## E2E Oracle Compliance

Pass.

- No Playwright screenshot, visual regression, exact canvas pixel, Photoshop parity, toolbar spacing/color, or tooltip full-text assertion was found.
- `apps/editor/playwright.config.ts:10` through `apps/editor/playwright.config.ts:18` uses the managed Playwright `webServer`, disables screenshots, and does not reuse an existing server.
- The E2E uses roles/labels for user actions and controlled `data-*` hooks for non-visual renderer state. The hooks live on the canvas element at `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:416` through `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:423`; they are not visible UI text.
- `rg` checks for `toHaveScreenshot`, screenshot/pixel/visual oracle terms, `getImageData`, toolbar color/spacing assertions, and tooltip text requirements found no forbidden E2E oracle use. Matches for `pixel` were implementation terms such as `devicePixelRatio`, not test assertions.

## UI Pollution Check

Pass.

- The normal Canvas UI adds a compact toolbar and a canvas surface, not a debug/evidence panel.
- Test-facing state is exposed through non-visible `data-*` attributes on the canvas in `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:416` through `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:423`.
- The visible empty state `No renderable artwork` at `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:448` is an ordinary product empty state and is not used as E2E-only text.
- `rg` found evidence/diagnostic terms in planner/parser/model evidence code and tests, not in normal Canvas UI.

## Verification

Gnome-reported verification command set is sufficient for this wave: app typecheck/build, root typecheck, focused unit tests, full unit suite, root check, PSD parser smoke, focused Playwright E2E, and `git diff --check` are the required spread for the Wave59 plan.

Additional Review-Sylph checks performed:

- `pnpm.cmd exec vitest run apps/editor/src/workspace/canvas/canvas-projection.test.ts`
  - sandbox result: failed with `esbuild` `spawn EPERM`
  - escalated rerun: pass, 1 file / 3 tests
- `pnpm.cmd exec vitest run packages/operation-core/src/operations/import-psd-layer-materialization.test.ts`
  - sandbox result: failed with `esbuild` `spawn EPERM`
  - escalated rerun: pass, 1 file / 6 tests
- `git diff --check -- apps packages scripts package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json discussion`
  - pass with CRLF normalization warnings only
- Source/read checks:
  - `git status --short -uall`
  - `git diff` / line-numbered reads for the target E2E, projection test, projection, renderer, Canvas panel, opacity operation, planner, commit path, parser adapter, and package scripts
  - `rg` checks for forbidden E2E oracle terms and test-only/debug UI terms

I did not rerun the full app build, full root check, PSD parser smoke, or Playwright E2E. They are recorded as passed in the Gnome report, and the additional focused reruns confirm the central deterministic coverage after the same sandbox failure mode.

## Dev Server / Process Evidence

Pass based on available read-only evidence.

- `Get-Process -Name node -ErrorAction SilentlyContinue` returned no node process after the focused test reruns.
- `netstat -ano | Select-String ':4173|:5173|:9323|:3000|:3001|:3400|LISTENING'` showed no listener on the expected Playwright/Vite ports `4173`, `5173`, `9323`, `3000`, or `3001`.
- A system/non-target listener on `:3400` was present, but there was no node process and no evidence tying it to the editor dev server.
- `Get-CimInstance Win32_Process` command-line inspection was denied by OS policy, so command-line attribution could not be used.

## Residual Risks / Decision Points

- No user decision is required for this review lane.
- Automated tests intentionally do not prove visual quality, exact composition, pixel fidelity, or Photoshop parity. The accepted oracle assigns those to human visual review.
- PSD clipping extraction remains a recorded parser/product boundary item. This lane only confirms that renderer/projection-side mask relation support is covered and that E2E does not claim parser clipping parity.
- The E2E relies on controlled non-visible hit-coordinate hooks to avoid pixel assertions. This is compliant with the current E2E Oracle; a stricter future rule against such hooks would require an oracle update, not a Wave59 Domain A test fix.

## Verdict Rationale

Domain A has focused unit coverage for deterministic renderer math/state, operation coverage for opacity preservation, and a Playwright vertical path that exercises import, Canvas availability, toolbar controls, and Canvas-to-selection without using a screenshot or pixel oracle. No test-only visible UI, debug surface, or long-running dev server evidence was found.
