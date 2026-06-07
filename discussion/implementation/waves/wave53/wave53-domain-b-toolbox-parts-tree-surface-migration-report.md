# Wave53 Domain B Report: Toolbox / Parts Tree Surface Migration

> Target: `wave53-toolbox-parts-tree-surface-migration`
> Role: Domain B Orch-Sylph coordinator
> Verdict: `pass`
> Date: 2026-06-07

## Verdict

`pass`

Domain B produced bounded, reusable left-side workspace surface factories for Toolbox and Structure / Parts Tree without final App Shell wiring. Domain D may consume these outputs for workspace shell integration, subject to the residual risks below.

No final integration host, shared CSS, e2e, PSD Import workflow, package metadata, scripts, fixtures, lockfiles, generated assets, Inspector, Parameter Bar, Diagnostics Strip, Mesh, Atlas, Parameter Manager, Variant Manager, or automation capability was edited by Domain B.

## Role Separation

- Orch-Sylph loaded the Domain B basis, delegated source implementation, ran/recorded verification, delegated clean review, and wrote this report.
- Source implementation was delegated to Gnome the 32nd.
- Independent review was delegated to Review-Sylph the 33rd and recorded at `discussion/implementation/reviews/wave53/wave53-domain-b-toolbox-parts-tree-surface-migration-review.md`.
- Orch-Sylph did not implement source edits directly.
- No fix loop was required because the independent review verdict was `pass` with no blocking findings.

## Basis Documents Used

- `C:/Users/remie/.codex/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave53-plan.md`
- `discussion/implementation/waves/wave53/wave53-domain-a-workspace-layout-boundary-current-host-inventory-report.md`
- `discussion/implementation/reviews/wave53/wave53-domain-a-workspace-layout-boundary-current-host-inventory-review.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/design/screen-design/overview.md`
- `discussion/design/screen-design/screens/authoring-workspace.md`
- `discussion/design/screen-design/components/toolbox.md`
- `discussion/design/screen-design/components/parts-tree.md`
- `discussion/design/codex-friendly-automation-policy.md`
- `discussion/implementation/waves/wave52/wave52-final-integration-report.md`, only for the PSD Import Task preservation boundary

## Changed Files

Domain B source/test files:

- `apps/editor/src/ui/app-shell/toolbox-surface.ts`
- `apps/editor/src/ui/app-shell/toolbox-surface.test.ts`
- `apps/editor/src/ui/app-shell/parts-tree-surface.ts`
- `apps/editor/src/ui/app-shell/parts-tree-surface.test.ts`

Domain B artifacts:

- `discussion/implementation/waves/wave53/wave53-domain-b-toolbox-parts-tree-surface-migration-report.md`
- `discussion/implementation/reviews/wave53/wave53-domain-b-toolbox-parts-tree-surface-migration-review.md`

Concurrent non-Domain-B files are present in the working tree, including Domain C `workspace-context-surfaces.*` and Domain A/C discussion artifacts. Domain B did not edit or review those as its own source changes.

## Implementation Summary

`createToolboxSurface` was added as a launcher-only surface under `apps/editor/src/ui/app-shell/toolbox-surface.ts`.

- Applies Authoring Workspace shell metadata with group `toolbox`.
- Accepts explicit `actions`, `tasks`, and `views` launcher item arrays.
- Supports compact/expanded label mode, active state, disabled state, disabled reason, badge, status text, accessible names, and `title` tooltip text.
- Uses an explicit `onActivate(itemId)` callback and does not wire itself to global app state, PSD Import, task routing, or any concrete tool workflow.

`createPartsTreeSurface` was added under `apps/editor/src/ui/app-shell/parts-tree-surface.ts`.

- Applies Authoring Workspace shell metadata with group `parts-tree`.
- Renders the `Structure / Parts` surface heading and row-state summary labels from `LayerTreeViewModel`.
- Composes existing `createLayerTreePanel` through explicit `LayerTreePanelOptions`, preserving selection, lock, editor-hidden, part/texture assignment, and direct-manipulation callback contracts.
- Optionally composes existing `createDrawableList` through explicit `DrawableListOptions`, preserving runtime visibility and draw-order movement callbacks.
- Avoids raw evidence/debug details as primary human UI.

The focused tests verify the launcher grouping/state/callback contract and the Parts Tree wrapper's metadata, summaries, existing row reuse, and callback pass-through.

## Verification Results

| Command / check | Result |
|---|---|
| `pnpm.cmd exec vitest run apps/editor/src/ui/app-shell/toolbox-surface.test.ts apps/editor/src/ui/app-shell/parts-tree-surface.test.ts` | Sandbox attempt failed with Vitest/esbuild `spawn EPERM`; approved outside-sandbox rerun passed `2` files / `2` tests. |
| `pnpm.cmd typecheck` | `pass` |
| `node scripts/check-source-organization.mjs` | `pass` |
| `git diff --check -- apps/editor/src/ui/app-shell apps/editor/src/ui/layer-tree apps/editor/src/ui/drawable-authoring` | `pass` for tracked diff |
| `git -c core.autocrlf=false diff --check --no-index` against the four new Domain B source/test files | `pass`; no whitespace errors |
| Review-Sylph independent source organization check | `pass` |

Not run in Domain B:

- App Shell/browser/responsive smoke, because final wiring is Domain D/E scope.
- e2e tests, because Domain B did not edit e2e or integrate the surfaces into the live shell.
- PSD focused e2e, because PSD Import Task preservation is not changed by these unintegrated left-surface factories.

## Review Result

Independent Review-Sylph verdict: `pass`.

Review artifact:

- `discussion/implementation/reviews/wave53/wave53-domain-b-toolbox-parts-tree-surface-migration-review.md`

Blocking findings: none.

Non-blocking review observations:

- Tooltip presentation currently relies on `title` plus ARIA text; final hover/focus tooltip behavior and real icon styling remain later integration or polish concerns.
- Parts Tree surface wraps existing Layer Tree and Drawable List rows, but the separate manual drawable creation form remains in the legacy Drawable Authoring panel. Domain D or a later wave must preserve that entry if the old panel is removed.
- Existing wrapped row UI still exposes some technical identifiers and texture labels from pre-existing components. Domain B did not add raw operation/evidence/debug primary UI.

## Source Organization

`pass`

- New source files are narrowly named and cohesive.
- No `index.ts` implementation logic was added.
- No broad catch-all `types.ts`, `schemas.ts`, `utils.ts`, or `helpers.ts` was added.
- Matching focused test files mirror the source responsibilities.
- `node scripts/check-source-organization.mjs` passed.

## Boundary Compliance

`pass`

- No final `createEditorAppShell` wiring was performed.
- `apps/editor/src/ui/app-shell/app-shell.ts` was not edited.
- `apps/editor/src/app/editor-app.ts` was not edited.
- `apps/editor/src/styles/editor.css` was not edited.
- `apps/editor/e2e/**` was not edited.
- PSD Import workflow/source/content was not edited.
- No dependency, package, lockfile, script, fixture, or generated asset change was made.
- No Inspector / Parameter Bar / Diagnostics Strip implementation was added.
- No Mesh / Atlas / Parameter Manager / Variant Manager capability was added.
- No semantic recognition, proposal generation, auto-classify, auto-rig, auto-fix, automatic commit, external transport, renderer/pixel oracle, Cubism, public demo asset, or persisted source PSD/raw parser object work was introduced.

## Residual Risks

- Domain D still owns live App Shell integration, append order, shared CSS, responsive behavior, and PSD Import task entry preservation.
- Browser-level visual behavior, compact/expanded styling, tooltip polish, and real icon assets are not proven by Domain B unit tests.
- The new surfaces use hard-coded heading IDs and assume a single Toolbox and a single Parts Tree instance in the final workspace skeleton.
- Existing e2e text oracles may still need careful preservation when Domain D moves old panels into the new layout.
- If Domain D removes or hides the legacy Drawable Authoring panel, it must preserve the current manual drawable creation route or explicitly defer that route without breaking existing workflows.

## User Decision Points

No immediate user decision is required for Domain B.

Future decisions remain outside this domain: final visual tooltip component behavior, whether to add a real icon package such as `lucide`, final Toolbox expanded-label policy, and the final home for manual drawable creation if the legacy Drawable Authoring panel is removed.

## Domain D Handoff

Domain D may consume Domain B output.

Recommended D constraints:

- Import and wire `createToolboxSurface` and `createPartsTreeSurface` only during final workspace shell integration.
- Keep PSD Import reachable through the existing Task Shell path and do not make PSD Import a default always-visible panel.
- Preserve existing Layer Tree and Drawable List callback contracts when moving them into the left-side layout.
- Own any required shared CSS/responsive layout and browser smoke verification in D/E, not by retroactively expanding Domain B.
