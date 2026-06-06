# Wave50 Domain D Report: Editor Structural Planner / Approval UX

> Target: `explicit-psd-subtree-hierarchy-scaffold-v0`
> Role: Undine root recovery after interrupted Domain D Gnome pass
> Domain: D - Editor structural planner / approval UX
> Verdict candidate: `pass`

## Verdict

verdict candidate: `pass`

Domain D adds an explicit, deterministic PSD structural scaffold preview and commit path to the Editor. The original Domain D worker was interrupted before report/review handoff, so Undine recovered the partial Editor diff, ran focused verification, and recorded this report.

The first clean review returned `needs_changes` for stable group source-ref subtree scope handling. Undine applied a focused fix pass so group `scopeRef` by source group id now includes descendant group containers before routing descendant leaves.

## Implementation Summary

- Added a browser structural scaffold plan service that expands parsed PSD group/leaf metadata into group part container scaffolds and leaf drawable scaffolds.
- Kept the boundary deterministic and explicit:
  - groups become generated part containers, not drawables;
  - leaves become generated drawable/texture/mesh scaffold entries;
  - hidden positive-size leaves remain eligible and carry `initialRuntimeVisibility: false`;
  - semantic recognition, proposal generation, Photoshop compositing, renderer pixel oracle, and initial grid mesh generation remain non-goals.
- Added Editor state/view-model support for structural plan preview, node approval selection, result diagnostics, and intake facts.
- Added UI controls in the explicit PSD import panel for structural preview and commit while preserving the existing leaf-only import-plan path.
- Wired the App Shell, Editor App, workflow controller, session adapter, command builder, and evidence provider to call `importPsdStructuralScaffold`.

## Fix Pass After Clean Review

The initial clean review found that selecting a PSD group by stable source group ref could include descendant leaves without including their immediate child group container, causing those leaves to fall back to the destination parent part.

The fix pass:

- makes group scope resolution include ancestor-chain matches for stable source group ids;
- keeps path-style node ref scopes working through existing node-ref prefix checks;
- adds a nested group test proving parent and child groups are approved as `groupPartContainer` scaffolds;
- proves a hidden nested leaf routes to the generated child group part and keeps `initialRuntimeVisibility: false`.

## Files Changed By Domain D

- `apps/editor/src/app/editor-app.ts`
- `apps/editor/src/editor-session/evidence-provider.ts`
- `apps/editor/src/editor-session/index.ts`
- `apps/editor/src/editor-session/psd-structural-scaffold-command.ts`
- `apps/editor/src/editor-session/session-adapter.ts`
- `apps/editor/src/editor-state/editor-test-ids.ts`
- `apps/editor/src/editor-state/explicit-psd-import-state.ts`
- `apps/editor/src/editor-state/explicit-psd-import-view-model.ts`
- `apps/editor/src/editor-state/explicit-psd-structural-scaffold-state.ts`
- `apps/editor/src/editor-state/index.ts`
- `apps/editor/src/editor-workflow/browser-psd-structural-scaffold-plan-service.test.ts`
- `apps/editor/src/editor-workflow/browser-psd-structural-scaffold-plan-service.ts`
- `apps/editor/src/editor-workflow/explicit-psd-structural-scaffold-workflow.ts`
- `apps/editor/src/editor-workflow/index.ts`
- `apps/editor/src/editor-workflow/workflow-controller.ts`
- `apps/editor/src/ui/app-shell/app-shell.ts`
- `apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.test.ts`
- `apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.ts`

## Verification Performed

| Check | Result |
|---|---|
| `pnpm.cmd typecheck` | pass |
| `pnpm.cmd exec vitest run apps/editor/src/editor-workflow/browser-psd-structural-scaffold-plan-service.test.ts apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.test.ts apps/editor/src/editor-workflow/workflow-controller.test.ts apps/editor/src/editor-session/session-adapter.test.ts apps/editor/src/ui/app-shell/app-shell.test.ts` | sandbox run failed with esbuild `spawn EPERM`; approved rerun after fix pass passed 5 files / 93 tests |
| Static non-goal wording scan over new structural Editor files | pass; no semantic proposal/Photoshop compositing/renderer/Cubism claims beyond explicit non-goal evidence literals |

## Scope / Boundary Check

- Did not add parser execution outside the existing browser PSD workflow boundary.
- Did not add semantic part recognition or Editor-side suggestions.
- Did not add external API/transport beyond the existing in-process command/session surface.
- Did not replace the existing Wave48/Wave49 leaf-only import-plan workflow.

## Residual Risks

- Domain D verifies Editor workflow and UI unit coverage, but full end-to-end sample PSD proof remains for later Wave50 integration domains.
- UI proves explicit approval controls at DOM/test level; visual browser review is not recorded in this domain report.

## User-Decision Points

None required for Domain D.
