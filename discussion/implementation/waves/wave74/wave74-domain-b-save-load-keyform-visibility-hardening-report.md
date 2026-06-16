# Wave74 Domain B Report: Save/Load Keyform Visibility Hardening

- Verdict: `pass`
- Domain: `wave74-save-load-keyform-visibility-hardening`
- Date: 2026-06-15
- Implementer: Gnome

## Files Changed

Domain B changed:

- `apps/editor/e2e/portable-project-save-load.e2e.spec.ts`
- `apps/editor/src/features/editor-session/model/rig-tool-state.ts`
- `apps/editor/src/features/editor-session/model/rig-tool-state.test.ts`
- `apps/editor/src/workspace/panels/deformer-tree-view.tsx`
- `apps/editor/src/workspace/panels/parameter-binding-section.tsx`
- `apps/editor/src/workspace/panels/parameter-binding-section.test.ts`
- `discussion/implementation/waves/wave74/wave74-domain-b-save-load-keyform-visibility-hardening-report.md`

Note: the current worktree also contains parallel Wave74 Domain A changes in some of the same source/test areas and package/runtime files. Domain B preserved those changes and did not revert them.

## Implementation Summary

- Added deterministic Deformer Tree keyform discovery:
  - deformer rows now carry keyform set/key counts;
  - rows with keyforms render a visible `Keyed N` badge with `KeyRound` icon;
  - row attributes expose deterministic `data-keyform-set-count`, `data-keyform-key-count`, and parent rig-control relation for stable e2e assertions.
- Added a small `Add` action to existing Parameter Binding cards so each binding property can create a current-value keyform from the normal UI, not only the first selected binding through the Parameter Bar.
- Hardened the portable save/load e2e:
  - creates Rotation angle, Rotation translation, and Warp control-point-offset keyforms through UI;
  - saves and reloads the portable bundle;
  - first asserts selection/current parameter value are intentionally reset;
  - then uses the Deformer Tree badge to discover keyforms without restored selection;
  - reselects targets and asserts UI values plus Canvas evaluated state.

## Basis Coverage Self-Report

- Wave74 Domain B AC 7.3: implemented with focused Playwright e2e after-load assertions for Warp `controlPointOffsets`, Rotation `angleDegrees`, and Rotation `translation`.
- Wave74 Domain B AC 7.4: implemented through visible Deformer Tree `Keyed N` badges and deterministic keyform counts; no selection/current slider pose is restored.
- Wave73/Wave72 save/load baseline: preserved; existing portable bundle path is reused.
- UX-backed package logic authority: package logic was not changed because no package save/load data loss was found.
- Source organization policy: changes stayed in existing responsibility files; guard passed.
- Dependency policy: no dependency changes; guard passed.
- Operation policy: UI keyform creation still routes through existing `editKeyformKey` / Operation Core paths.
- Schema and ID conventions: no package schema or machine-readable ID format changes.
- Parameter Keyform design: existing Parameter Binding section now includes Add, matching the design's Add/Update/Delete responsibility.
- Rig Tool design: Deformer Tree now exposes keyform count/discovery in the rig authoring context.
- Canvas Preview design: e2e uses existing Canvas evaluated data attributes only; no raw payload UI was added.
- Project Storage Task design: save/load remains the existing portable project flow; no archive/filesystem/browser slot scope was added.

## User-Facing UX Trace

- After loading a project, the user sees Deformer Tree rows with compact `Keyed N` badges before selecting a deformer.
- Selecting a keyed Rotation Deformer at the default active parameter value shows:
  - Rotation angle value `18`;
  - Translation X `7`;
  - Translation Y `-3`;
  - Canvas evaluated angle and translation attributes matching those values.
- Selecting the keyed Warp Deformer shows:
  - Uniform offset X `5`;
  - Uniform offset Y `9`;
  - Canvas control-point-offset count `25` and first offset `{ x: 5, y: 9 }`.
- Parameter Binding cards now allow adding a current-value keyform for each binding property, including Rotation translation.

## Operation / Runtime / Package Contract Trace

- No package format, package adapter, runtime, or operation schema change was made by Domain B.
- New keyforms are created through the existing `createEditKeyformPayload` and `editKeyformKey` flow.
- Save/load continues through the existing portable project bundle path.
- Canvas proof uses existing evaluated state surfaces:
  - `data-deformer-overlay-evaluated-angle`;
  - `data-deformer-overlay-translation-x/y`;
  - `data-deformer-overlay-control-point-offset-count`;
  - `data-deformer-overlay-first-control-point-offset-x/y`.
- No real save/load data loss was discovered.

## Save / Load Keyform Evidence Trace

The focused Playwright portable save/load path now proves:

- Before save:
  - a Drawable opacity keyform is authored and updated to `0.40`;
  - a Rotation angle keyform is added and updated to `18`;
  - a Rotation translation keyform is added and updated to `{ x: 7, y: -3 }`;
  - a Warp control-point-offset keyform is added and updated to uniform `{ x: 5, y: 9 }`;
  - Deformer Tree badges show Warp `1` key and Rotation `2` keys.
- After load, before reselection:
  - Project inspector is shown;
  - no Parts Tree or Deformer Tree selected row is present;
  - active parameter resolves to `param_face_angle_x`;
  - current parameter numeric value resets to default `0`;
  - Parameter Bar reports `No target`;
  - Deformer Tree still exposes `Keyed 1` and `Keyed 2` badges.
- After reselection:
  - Rotation binding inputs and Canvas evaluated angle/translation match saved keyforms;
  - Warp binding inputs and Canvas evaluated offsets match saved keyform;
  - Drawable opacity binding and Canvas selected opacity remain restored.
- Additional after-load proof:
  - drawable row reorder persists by relative order;
  - Rotation Deformer remains parented under the loaded Warp Deformer;
  - Drawable runtime visibility persists as hidden and can be shown, increasing renderable count by one;
  - hidden Part Container restoration remains covered by the existing root hide/show assertion.

## Must-Not Compliance Evidence

- Did not persist selection, current parameter values, active tool, canvas view, undo history, drafts, feedback, or manual collapsed tree state.
- Negative e2e assertion proves selection is reset to Project/no selected row and current parameter numeric value returns to default `0` after load.
- Did not add browser-local save slots, archive/filesystem behavior, a new save format, Texture Atlas, Variant, Viewer/Runtime View, Cubism compatibility, LLM/provider integration, mesh generation changes, or dependencies.
- Did not change package format or package save/load implementation.
- Did not implement Domain A foundation fixes as Domain B work; parallel Domain A worktree changes were preserved.

## Validation Commands And Results

- `pnpm.cmd exec vitest run apps/editor/src/features/editor-session/model/rig-tool-state.test.ts apps/editor/src/workspace/panels/parameter-binding-section.test.ts`
  - sandbox startup failed with esbuild `spawn EPERM`;
  - escalated rerun passed: 2 files / 9 tests.
- `pnpm.cmd typecheck`
  - passed.
- `pnpm.cmd --dir apps/editor run test:e2e:psd-import -- e2e/portable-project-save-load.e2e.spec.ts`
  - sandbox startup failed with `spawn EPERM`;
  - first escalated run reached the browser and failed on a strict locator ambiguity;
  - after narrowing duplicate label locators, escalated rerun passed: 1 Playwright test.
- `node scripts/check-source-organization.mjs`
  - passed.
- `node scripts/check-dependencies.mjs`
  - passed.
- `git diff --check -- apps/editor packages/authoring-core packages/operation-core discussion/implementation/waves/wave74`
  - passed.

## Residual Risks

- The portable save/load e2e remains broad and can fail from unrelated PSD import, Canvas, tree, or project-storage regressions.
- Browser proof uses exact keyforms at the default parameter value. Interpolated Rotation translation and Warp offset behavior is covered by lower-level existing package/runtime/editor tests and by Domain A/final integration where applicable.
- Deformer Tree badge count is intentionally compact; richer keyform browsing remains future Parameter Manager/timeline scope.

## User Decision Points

- None for Domain B.
