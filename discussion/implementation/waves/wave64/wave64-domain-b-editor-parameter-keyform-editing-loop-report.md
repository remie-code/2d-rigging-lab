# Wave64 Domain B Report: Editor Parameter Keyform Editing Loop

## Status

pass

## Review Loop 1 Fix Summary

- Test Adequacy Review の `needs_fix` に対応し、rig-control target coverage を追加した。
- `parameter-keyform-state.test.ts` で Rotation `angleDegrees` / Rotation `opacityMultiplier` / Warp `controlPointOffsets` / Warp `opacityMultiplier` の binding descriptors、lock/exact/interpolated projection、`createEditKeyformPayload`、evaluated preview maps を直接検証した。
- `editor-session-commands.test.ts` で `commitEditKeyformKey` による Rotation rig-control `angleDegrees` add/update/delete 経路を追加した。
- `parameter-binding-section.test.ts` を追加し、headless server render で Rotation/Warp binding rows と lock/unlock に伴う action disabled/enabled 状態を検証した。

## Basis Coverage Self-Report

- Required basis docs were reviewed before implementation, including Wave64 plan, Domain A handoff, preplan UX inventory, parameter keyform/component designs, Parameter Manager screen design, rig tool/canvas preview designs, orchestration skill docs, and source organization policy.
- Parameter Bar now exposes active parameter selection, current value slider/numeric input, key markers, Add / Update / Delete, Ends, Ends + Center, Reset, and a Manage route/link entry.
- Parameter-aware Inspector now renders active parameter/current value/keyform existence per supported target property. Keyform positions enable property editing and update/delete; non-keyform positions show interpolated/static values, lock editing, and expose Add Keyform Here.
- Target editing uses Domain A `editKeyformKey` for the v0 loop and covers:
  - `drawable.opacity`
  - `rigControl.angleDegrees`
  - `rigControl.controlPointOffsets`
  - `rigControl.opacityMultiplier`
- Canvas preview consumes the current parameter value map and evaluates supported keyform bindings for drawable opacity, rotation angle, warp control point offsets, and rig opacity multiplier chains.
- Domain A rejection diagnostics are mapped to concise editor feedback. `createEndsCenter` is disabled when min/default/max positions are not distinct, and operation rejection feedback is still surfaced if returned.

## Intentionally Deferred Basis Items

- Full Parameter Manager behavior remains Domain D scope. Domain B added/uses only the shared active-parameter state contract and Manage route/link expectation.
- Direct canvas manipulation is not claimed. The v0 editing loop is Inspector/Parameter Bar driven.
- Warp lattice editing is a v0 Inspector control for full `controlPointOffsets` values using uniform X/Y offsets across the lattice; per-point drag/edit UI is deferred.
- Mesh V3 algorithm work, Camera Capture/external facade, visibility/clipping/draw order keyforms, and package operation redesign were not implemented.
- New loop does not use legacy `addKeyform` / `addKeyformGrid2d`.

## User Workflow Trace

1. User selects a Drawable or supported Rig Control.
2. Parameter Bar resolves initialized parameters, selects an active parameter, and lets the user scrub or type a current value.
3. Inspector shows each supported binding with active parameter, current value, key marker summary, and whether a keyform exists at the current position.
4. User can create endpoint keyforms, create endpoints plus center when valid, add a keyform at the current position, update an existing keyform, or delete it.
5. Between keys, Inspector shows the evaluated value and locks direct property editing while keeping Add Keyform Here available.
6. Scrubbing the active parameter updates the canvas preview using evaluated keyform state.
7. Manage opens the shared Parameter Manager route via the editor UI store without Domain B implementing the manager itself.

## Must-not Compliance Evidence

- No package operation semantics were redesigned. The editor consumes Domain A `editKeyformKey` and only normalizes editor-created warp-deformer payloads with default `opacityMultiplier: 1` to satisfy the Domain A DTO.
- No Mesh V3 algorithm, camera/external facade, visibility/clipping/draw order keyforms, or unrelated package work was added by Domain B.
- Parameter Manager implementation was not expanded by Domain B. A concurrent Domain D screen received only an exact-optional type compatibility fix so repository typecheck could pass.
- Canvas direct manipulation was not overclaimed; the report and UI scope remain Inspector/Parameter Bar based.
- Source organization guard passed; no non-barrel `index.ts` or catch-all source file was introduced.

## Residual Risk Classification

- Medium: Warp control point editing is functional through full-array `controlPointOffsets`, but the v0 UI edits uniform offsets rather than individual lattice points.
- Low: End-to-end Playwright coverage proves the loop for Drawable opacity. Rig rotation/opacity/warp paths now have focused model/component/command coverage, but not separate Playwright paths in this wave.
- Low: Parameter value state is editor-local UI state, not persisted package state. This is intentional but Domain D should preserve the shared context contract.
- Low: The worktree contains Domain A/C/D parallel package and app changes outside this Domain B scope; Domain B did not revert them.

## Changed Files List

- `apps/editor/e2e/psd-import.e2e.spec.ts`
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/features/editor-session/model/editor-session-commands.ts`
- `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts`
- `apps/editor/src/features/editor-session/model/parameter-keyform-state.ts`
- `apps/editor/src/features/editor-session/model/parameter-keyform-state.test.ts`
- `apps/editor/src/features/editor-session/model/rig-tool-state.ts`
- `apps/editor/src/workspace/authoring-workspace.tsx`
- `apps/editor/src/workspace/canvas/canvas-projection.ts`
- `apps/editor/src/workspace/canvas/canvas-renderer.ts`
- `apps/editor/src/workspace/panels/canvas-preview-panel.tsx`
- `apps/editor/src/workspace/panels/inspector-panel.tsx`
- `apps/editor/src/workspace/panels/parameter-bar.tsx`
- `apps/editor/src/workspace/panels/parameter-binding-section.test.ts`
- `apps/editor/src/workspace/panels/parameter-binding-section.tsx`
- `apps/editor/src/workspace/panels/rig-tool-inspector.tsx`
- `apps/editor/src/workspace/panels/rig-tool-inspector.test.ts`
- `apps/editor/src/workspace/parameter-manager/parameter-manager-screen.tsx` (coordination-only exact optional type compatibility in concurrent Domain D file)
- `discussion/implementation/waves/wave64/wave64-domain-b-editor-parameter-keyform-editing-loop-report.md`

Note: `apps/editor/.dev-server.out.log` was already modified in the shared worktree and is not a Domain B source change.

## Verification Commands / Results

- `pnpm.cmd --dir apps/editor typecheck`
  - Pass.
- `pnpm.cmd typecheck`
  - Pass.
- `node scripts/check-source-organization.mjs`
  - Pass: `Source organization guard passed.`
- `pnpm.cmd exec vitest run apps/editor/src/features/editor-session/model/parameter-keyform-state.test.ts apps/editor/src/features/editor-session/model/editor-session-commands.test.ts apps/editor/src/workspace/panels/parameter-binding-section.test.ts apps/editor/src/workspace/panels/rig-tool-inspector.test.ts`
  - Pass after sandbox escalation: 4 test files, 20 tests.
  - Note: Vitest requires sandbox escalation in this environment because Vite/esbuild child process spawning has failed with `Error: spawn EPERM`.
- `pnpm.cmd --dir apps/editor exec playwright test -c playwright.config.ts e2e/psd-import.e2e.spec.ts -g "authors drawable opacity keyforms"`
  - Pass after sandbox escalation: 1 test, representative Drawable opacity add/update/delete/scrub path.
  - Sandbox attempt failed first with `Error: spawn EPERM` and pnpm reported `Command "playwright" not found` after the spawn denial.

## Shared Contract with Domain D

- Active parameter ownership is in `EditorSessionProvider`:
  - `activeParameterId: ParameterId | null`
  - `parameterValues: ParameterValueMap`
  - `parameterBar: ParameterBarProjection`
  - `setActiveParameterId(parameterId)`
  - `setActiveParameterValue(value)`
  - `resetActiveParameterValue()`
- `parameterValues` is session-local editor UI state keyed by `ParameterId`; values are clamped to initialized parameter ranges and are not persisted as package data.
- Manage route/link expectation:
  - `openParameterManager()` calls `useEditorUiStore().setActiveEntry("parameters")`.
  - Parameter Bar Manage button uses `data-testid="parameter-manager-link"`.
  - Workspace route expectation is `activeEntry === "parameters"` showing the Parameter Manager surface.
- Domain D can consume these test/API surfaces:
  - `data-testid="parameter-bar"`
  - `data-testid="parameter-key-marker-summary"`
  - `data-testid="parameter-bar-target-summary"`
  - `data-testid="parameter-binding-section"`
  - `data-testid="parameter-binding-opacity"`
  - `data-testid="parameter-binding-angleDegrees"`
  - `data-testid="parameter-binding-controlPointOffsets"`
  - `data-testid="parameter-binding-opacityMultiplier"`
  - `data-testid="parameter-operation-feedback"`
  - Accessible labels: `Active parameter`, `Parameter value`, `Parameter numeric value`, and property labels such as `Drawable opacity value`.
- Domain B expects all keyform authoring from this loop to continue using `editKeyformKey`; Domain D should not route this v0 editor loop through legacy keyform operations.
