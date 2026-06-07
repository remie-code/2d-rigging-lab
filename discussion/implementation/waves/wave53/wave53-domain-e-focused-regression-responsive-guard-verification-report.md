# Wave53 Domain E Report: Focused Regression / Responsive and Guard Verification

> Target: `wave53-focused-regression-responsive-guard-verification`
> Role: Domain E Orch-Sylph coordinator
> Verdict: `pass`
> Date: 2026-06-07

## Verdict

`pass`

Wave53 Authoring Workspace v0 integration did not regress the required focused PSD task paths, existing editor desktop/mobile smoke workflows, responsive horizontal-overflow checks, or required guard paths.

No source, test, script, dependency, lockfile, fixture, generated asset, traceability, or manifest fix was required by Domain E. Because no implementation fix was needed, no Gnome fix loop was launched. If a later source or test fix is required, it must be delegated to Gnome and independently reviewed before this gate is reused.

Domain F may start after the independent Domain E Review-Sylph review passes.

## Basis Documents Used

- `C:/Users/remie/.codex/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave53-plan.md`
- Wave53 Domain A-D reports and reviews
- `discussion/implementation/waves/wave52/wave52-final-integration-report.md`
- `discussion/implementation/reviews/wave52/wave52-final-integration-review.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/tests/fixtures/fixture-manifest.md`
- `discussion/design/screen-design/overview.md`
- `discussion/design/screen-design/screens/authoring-workspace.md`
- `discussion/design/codex-friendly-automation-policy.md`
- `discussion/development_convention/source-file-organization-policy.md`

## Verification Summary

| Command / check | Result |
|---|---|
| `node scripts/check-production-testid-boundary.mjs` | `pass` |
| `node scripts/check-production-testid-boundary-fixtures.mjs` | sandbox failed with child-process `spawnSync ... node.exe EPERM`; approved rerun passed `5` fixture cases |
| `node scripts/check-psd-parser-import-boundary.mjs` | `pass`; `5` direct import/resolve sites limited to approved adapter and Wave44 scripts |
| `node scripts/check-focused-e2e-registry.mjs` | `pass`; `24` entries, `14` aggregate-discoverable, `10` standalone direct |
| `node scripts/check-wave42-quality-gate-boundary.mjs` | `pass`; `5` categories, `24` focused e2e entries, `9` explicit non-goals |
| `pnpm.cmd run check:source` | `pass`; source organization guard passed |
| `pnpm.cmd run check:deps` | `pass`; dependency guard passed |
| `pnpm.cmd typecheck` | `pass` |
| `pnpm.cmd exec vitest run apps/editor/src/ui/app-shell/app-shell.test.ts apps/editor/src/ui/app-shell/toolbox-surface.test.ts apps/editor/src/ui/app-shell/parts-tree-surface.test.ts apps/editor/src/ui/app-shell/workspace-context-surfaces.test.ts` | sandbox failed with Vitest/esbuild `spawn EPERM`; approved rerun passed `4` files / `37` tests |
| `pnpm.cmd test:e2e` | sandbox failed with Vite/esbuild `spawn EPERM`; approved rerun passed desktop and mobile editor smoke |
| `node scripts/run-focused-e2e.mjs --id psdStructuralInitialStateFocused` | approved run passed; preserved source-order structural refs, group part containers, runtime-hidden drawable, and Codex projection |
| `node scripts/run-focused-e2e.mjs --id psdImportPlanCodexFocused` | approved run passed; `candidates=126`, approved `front hair`, `materializedBytes=1537600`, stale context rejected |
| `node scripts/run-focused-e2e.mjs --id psdImportPlanFocused` | approved run passed; `candidates=126`, approved `headwear,eyewear,tie/tie`, `materializedBytes=810360`, portable bundle evidence |
| `node scripts/run-focused-e2e.mjs --id psdMultiLayerBatchFocused` | approved run passed; layers `headwear,eyewear,tie/tie`, `materializedBytes=810360` |
| `node scripts/run-focused-e2e.mjs --id psdImportFocused` | approved run passed; `materializedBytes=460800`, `drawable=draw_headwear`, `texture=tex_headwear` |

The aggregate editor e2e smoke covers both desktop and mobile viewports. It exercises shell load, Preview update/reset, Product Preflight, AI approval/transcript, source intake, manual drawable creation, mesh vertex editing, layer visibility/draw-order controls, save/load/reset, split PNG/source intake, asset/byte intake, dynamics, Viewer Runtime, rig control, warp lattice, composition, part/texture/layer manipulation, layer-tree direct manipulation, tutorial mini model, and horizontal overflow checks across the workflow.

The targeted App Shell Vitest suite covers the v0 skeleton structure directly: Toolbox, Structure / Parts, central Canvas / Preview, Inspector, Parameter Bar, Diagnostics Strip, PSD Import task launcher, default absence of the PSD task panel, active Task Shell rendering, and manual Drawable Authoring reachability.

## Duplicate Drawable-List Test Hook Risk

Domain D intentionally mounts `createDrawableList` in both the new Parts Tree surface and the legacy Drawable Authoring support panel. This creates duplicate `data-testid` hooks for:

- `drawable.list`
- `drawable.row.*`
- `drawable.visibility.*`
- `drawable.moveUp.*`
- `drawable.moveDown.*`

Domain E inspected the relevant e2e uses in `apps/editor/e2e/**`, `apps/editor/src/ui/app-shell/parts-tree-surface.ts`, `apps/editor/src/ui/app-shell/authoring-workspace-v0-shell.ts`, and `apps/editor/src/ui/drawable-authoring/drawable-list.ts`.

Result: not a blocking regression in the current scope.

Reasons:

- Production behavior still does not query `data-testid`; the production boundary guard and fixture guard passed.
- The duplicate controls in the Parts Tree and legacy support panel are wired to the same runtime-visibility and draw-order callbacks.
- Existing first-match e2e selectors that click visibility/move controls still drive equivalent behavior.
- The manual drawable creation route uses unique form/submit hooks under `drawableAuthoring.panel`, remains reachable, and was exercised by aggregate desktop/mobile smoke.
- Aggregate desktop/mobile e2e passed the drawable creation, layer controls, save/load, reset, and direct manipulation paths after the duplication.

Residual risk remains for future tests or helpers that intend specifically to target the legacy Drawable Authoring list rather than the new Parts Tree list. If that becomes necessary, add a scoped stable wrapper/hook instead of removing or weakening existing focused IDs.

## Boundary Compliance

`pass`

- No product feature implementation was added by Domain E.
- No focused PSD ID was removed or weakened.
- No broad e2e expansion was added.
- No source application implementation was edited.
- No package, lockfile, dependency, generated asset, or unrelated file was edited.
- PSD Import remains a Task Shell task opened from the workspace and is not default always-visible primary content.
- No Mesh / Atlas / Parameter Manager / Variant Manager capability was added.
- No repo-side semantic recognition, proposal generation, auto-classification, auto-rigging, auto-fix, automatic commit, external transport, renderer/pixel oracle, Cubism compatibility, public demo asset, persisted source PSD bytes, or raw parser object capability was introduced.

## Changed Files

Domain E changed only this report artifact:

- `discussion/implementation/waves/wave53/wave53-domain-e-focused-regression-responsive-guard-verification-report.md`

The independent review artifact is expected at:

- `discussion/implementation/reviews/wave53/wave53-domain-e-focused-regression-responsive-guard-verification-review.md`

## Residual Risks

- Duplicate drawable-list hooks are safe for current passing tests, but future selectors that need to distinguish Parts Tree from legacy Drawable Authoring should be scoped deliberately.
- Legacy support panels still expose older evidence/debug/Codex-heavy UI below the primary v0 skeleton. That is preservation debt for future Diagnostics / Evidence and Codex / Automation separation waves, not a Domain E blocker.
- The production `data-testid` guard is static text/regex based and cannot prove every possible dynamic selector construction.
- Browser verification used Chrome from the known local path and the existing e2e server path; it proves the current local environment, not every browser/CI combination.

## User Decision Points

None.

No user or Undine decision is required before Domain F starts, assuming the independent Domain E review passes.
