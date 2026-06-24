# Runtime Player Wave 12 Plan: Live Controller Variant Switching

> Objective: make Runtime Player's Live Controller switch exported Variants during broadcast, and apply the same active Variant selection to the native Stage Window and OBS Browser Source.

## 1. Status

- Status: Ready to launch.
- Planning gate result: discuss first, then plan.
- Inventory result:
  - Wave102 added Runtime Export drawable `baseVisible` for new exports.
  - New Runtime Exports can support runtime Variant switching with `baseVisible && activeVariantPredicate`.
  - Legacy Runtime Exports without `baseVisible` can still load, but Variant switching must be disabled with re-export guidance.
  - Runtime Player currently has no active Variant selection state, Live Controller page, or Stage / Browser Source Variant switching path.
- Source of truth before implementation:
  - [live-controller-page.md](../../screens/live-controller-page.md)
  - [../../../../implementation/waves/wave102/wave102-final-integration-report.md](../../../../implementation/waves/wave102/wave102-final-integration-report.md)
  - [../../../../implementation/orchestration/wave102-plan.md](../../../../implementation/orchestration/wave102-plan.md)
  - [player-wave9-plan.md](player-wave9-plan.md)
  - [player-wave10-plan.md](player-wave10-plan.md)
  - [player-wave11-plan.md](player-wave11-plan.md)
  - [runtime-player-wave-planning-conventions.md](runtime-player-wave-planning-conventions.md)

## 2. Product Goal

Runtime Player already loads Runtime Exports, receives iFacialMocap input, evaluates live mappings, drives body follow / dynamics, and outputs to OBS Browser Source.

Wave12 should add the first real "live controller" behavior:

1. The user opens a new `Live Controller` page in the existing Control Window.
2. The page lists Variant Groups from the loaded Runtime Export.
3. The user switches expression / outfit / accessory Variants with simple controls.
4. The native Stage Window updates immediately.
5. OBS Browser Source updates to the same Variant selection.
6. `Look Forward` is available on the same page as a prominent live recovery action.
7. `Center Model` and `Stage Motion` On/Off are available as compact recovery/safety actions.

This wave is about live operation, not authoring. Runtime Player must not edit Variant definitions or Drawable membership.

## 3. Accepted Decisions

### 3.1 Scope

Wave12 includes:

- Live Controller page in the existing Control Window.
- Variant Group controls.
- session-local active Variant selection state.
- Stage Window Variant visibility update.
- OBS Browser Source Variant visibility update.
- `Reset to Model Default`.
- `Look Forward`.
- `Center Model`.
- `Stage Motion` On/Off.
- compact status only for model/input/output readiness.

Wave12 excludes:

- hotkeys.
- StreamDeck / MIDI.
- separate controller window.
- Player-side Variant definition editing.
- Drawable membership editing.
- Runtime Export schema changes.
- Editor Variant Manager changes.
- Player last-active Variant persistence.
- Stage Motion quick strength sliders.
- Body Follow quick controls.
- raw diagnostics.

### 3.2 Variant Runtime Semantics

For new Runtime Exports with `baseVisible`:

```text
runtimeVisible = drawable.baseVisible && variantVisibilityPredicate(activeSelection, drawableId)
```

For legacy Runtime Exports without `baseVisible`:

- render as today using `drawable.visible`;
- disable Variant switching controls;
- show a compact message asking the user to re-export from the current Editor.

`visible` remains the initial/default-visible compatibility field. Runtime Player must not reinterpret `visible` as base visibility for switching.

### 3.3 Active Selection Lifetime

v0 active Variant selection is session-only.

- Initial state comes from Runtime Export default active selections.
- `Reset to Model Default` restores Runtime Export defaults.
- Reloading or opening another Runtime Export resets to that export's defaults.
- Browser Source reconnect/resync receives the current session active selection from Runtime Player.
- Do not persist last active Variant selection in Wave12.

Reason:

- This keeps the first live switching wave small and predictable.
- Runtime Export default remains the model-authored default.
- Operational persistence can be added later after the user has used the controller in real broadcasts.

### 3.4 Live Controller Placement

- Add `Live Controller` to the existing Control Window navigation.
- Do not create a separate window.
- Do not put live switching into `Overview`, `Input`, `Mapping`, or `Stage`.
- Stage Window and Browser Source remain model-only outputs.

### 3.5 Controls Included By Recommendation

User explicitly requires:

- `Look Forward`.

Recommended and included:

- `Center Model`.
- `Stage Motion` On/Off.

Reason:

- They are live safety/recovery operations.
- They already conceptually exist in other pages.
- They are small enough to include without turning Live Controller into Stage/Mapping setup.

Not included:

- `Reset View`, because it is more destructive than `Center Model`.
- Stage Motion tuning sliders, because detailed tuning belongs on `Stage`.
- Body Follow controls, because detailed mapping belongs on `Mapping`.

## 4. Wave Strategy

Use one implementation domain plus final integration.

The Live Controller UI, active Variant state, Stage Window render state, and Browser Source resync contract are tightly coupled. Splitting them across many domains would create review and coordination cost. A single Gnome can keep the contract coherent, then independent reviews can validate boundaries.

### Batch 1

| Domain | Work | Parallel? | Notes |
|---|---|---|---|
| Domain A | Live Controller Variant Switching v0 | No | Adds session Variant state, Control page, Stage / Browser Source application, and quick live actions. |

### Batch 2

| Domain | Work | Parallel? | Notes |
|---|---|---|---|
| Domain B | Final integration, docs alignment, clean review | No, after A | Confirms source boundaries, tests, docs, and residual risks. |

## 5. Domain A: Live Controller Variant Switching v0

Suggested subagent name:

```text
runtime-player-wave12-live-controller-variant-switching
```

### Scope

Implement Player-side runtime Variant switching from the Live Controller page.

### Primary Files / Areas

Likely areas:

- `apps/runtime-player/src/control/control-window-app.tsx`
- `apps/runtime-player/src/control/control-window-shell.tsx`
- new `apps/runtime-player/src/control/live-controller-page.tsx`
- `apps/runtime-player/src/shared/runtime-player-bridge-contract.ts`
- `apps/runtime-player/src/main/runtime-player-main.ts`
- existing main-side stage/input/session handlers.
- `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-runtime-graph-adapter.ts`
- `apps/runtime-player/src/stage/stage-renderer/**`
- `apps/runtime-player/src/stage/browser-source/**`
- `apps/runtime-player/src/preload/**`
- focused tests under `apps/runtime-player/src/**`

Conditional areas:

- `packages/package-format/src/runtime-export.ts` only for type import compatibility. Do not change schema.
- `packages/authoring-core/**` should not be touched.

### Required Behavior

#### Active Variant State

- Build an active Variant selection state from the loaded Runtime Export's `model.variants`.
- Support group modes:
  - `singleSelect`: exactly one active Variant.
  - `multiToggle`: zero or more active Variants.
- Initialize from Runtime Export default active selections.
- Provide `Reset to Model Default`.
- Keep the state session-local.
- Reset when a different Runtime Export is loaded.
- Clear when Runtime Export is unloaded.

#### Runtime Visibility Evaluation

- For drawables with `baseVisible`, compute runtime visibility with:

```text
baseVisible && variantVisibilityPredicate(activeSelection, drawableId)
```

- Non-Variant drawables remain visible according to `baseVisible`.
- Drawables hidden by base visibility remain hidden regardless of Variant selection.
- If `model.variants` is absent, Live Controller should show a no-variants state.
- If `model.variants` exists but any drawable lacks `baseVisible`, disable switching and show a legacy re-export message.

#### Stage Window

- Native Stage Window must reflect active Variant selection immediately.
- Native Stage local-preview suspension from Wave10 must not regress.
- When native Stage live rendering is suspended because Browser Source is connected, the session active Variant state still updates and Browser Source still receives it.

#### Browser Source

- Browser Source must receive enough sanitized state to render the current active Variant selection.
- Browser Source reload/resync must receive:
  - loaded Runtime Export;
  - current live frame;
  - current Stage display state;
  - current active Variant selection.
- Browser Source must not receive raw tracking frames, raw iFacialMocap diagnostics, calibration internals, or private file paths.

#### Live Controller Page

Add a `Live Controller` page to Control Window navigation.

Recommended layout:

```text
LIVE CONTROLLER

Status
  Model: Loaded
  Input: Live / Not connected
  Browser Source: 1 client / No client

Variants
  Expression
    [Default] [Smile] [Angry]

  Outfit
    [Black Coat] [Casual]

  Accessory
    [Cat ears] [Glasses]

  [Reset to Model Default]

Recenter
  [Look Forward]

Motion Safety
  Stage Motion: [On/Off]

View Recovery
  [Center Model]
```

UI requirements:

- Variants are the primary section.
- `Look Forward` must be prominent.
- `Center Model` and `Stage Motion` On/Off are compact.
- No parameter sliders.
- No raw diagnostics.
- No Runtime Export open/reload controls.
- No Browser Source URL/server configuration controls.
- No destructive `Disconnect` control.
- Empty / no variants / legacy export states must be understandable.

#### Quick Actions

`Look Forward`:

- Reuse existing input neutral / session recenter behavior.
- Button may be disabled if input is not available.
- Failure should be visible but not noisy.

`Center Model`:

- Reuse existing Stage view centering behavior.
- It should affect Stage Window and Browser Source display state consistently.

`Stage Motion` On/Off:

- Reuse existing Stage Motion settings.
- Toggle changes the same setting that Stage page uses.
- Auto-save behavior remains whatever Stage Motion currently owns.
- Do not add Stage Motion tuning sliders.

### Tests

At minimum, add focused tests for:

- Runtime Export with Variant Groups initializes active selection from defaults.
- `singleSelect` changes exactly one active Variant.
- `multiToggle` supports multiple active Variants.
- `Reset to Model Default` restores defaults.
- Runtime visibility uses `baseVisible && activeVariantPredicate`.
- Non-Variant drawables follow `baseVisible`.
- `baseVisible=false` stays hidden even when a Variant includes the drawable.
- legacy Runtime Export without `baseVisible` loads but disables Variant switching.
- no-Variant Runtime Export shows no-variants state.
- Stage Window render/evaluation receives active selection.
- Browser Source resync receives active selection.
- Browser Source does not receive raw tracking/debug/calibration data.
- Live Controller page appears in navigation.
- `Look Forward` calls the existing recenter path.
- `Center Model` calls the existing Stage view recovery path.
- `Stage Motion` On/Off updates existing Stage Motion setting.
- no `pnpm install`.

Recommended focused commands:

- `pnpm.cmd exec vitest run apps/runtime-player/src/stage/runtime-evaluation`
- `pnpm.cmd exec vitest run apps/runtime-player/src/control`
- `pnpm.cmd exec vitest run apps/runtime-player/src/main`
- `pnpm.cmd typecheck`

Escalate if:

- Runtime Export `model.variants` lacks enough information to evaluate active selection despite Wave102.
- Browser Source transport requires sending raw tracking/debug data.
- Supporting Variant switching would require package-format schema changes.
- Existing Stage renderer cannot support visibility updates without a broad renderer rewrite.

## 6. Domain B: Final Integration / Docs Alignment / Clean Review

Suggested subagent name:

```text
runtime-player-wave12-final-integration-live-controller
```

### Scope

Run after Domain A completes and reviews pass or fixes are resolved.

### Required Behavior

- Verify Live Controller page exists in the existing Control Window.
- Verify Variant controls are disabled for legacy exports without `baseVisible`.
- Verify new Runtime Exports with `baseVisible` can switch Variants.
- Verify Stage Window and Browser Source have the same visible result.
- Verify Browser Source reload/resync preserves current session active Variant selection.
- Verify `Look Forward`, `Center Model`, and `Stage Motion` On/Off use existing behaviors.
- Verify Wave10 native local preview suspension remains effective.
- Verify no Runtime Export schema/materialization changes were made in Player Wave12.
- Verify docs/maps match implementation facts.
- Write Wave12 reports and reviews under:
  - `discussion/runtime-player/implementation/waves/wave12/`
  - `discussion/runtime-player/implementation/reviews/wave12/`

Docs to update as implementation facts require:

- [live-controller-page.md](../../screens/live-controller-page.md)
- [control-window-screen-structure.md](../../screens/control-window-screen-structure.md)
- [runtime-player-backlog.md](../../backlog/runtime-player-backlog.md)
- runtime-player maps.

The final integration scope must include:

```text
実装事実に合わせて関連ドキュメントを更新する。
```

## 7. Acceptance Criteria

- Control Window has a `Live Controller` page.
- Live Controller lists Runtime Export Variant Groups when present.
- `singleSelect` and `multiToggle` groups behave according to their modes.
- `Reset to Model Default` restores exported defaults.
- New Runtime Exports with `baseVisible` support runtime Variant switching.
- Legacy Runtime Exports without `baseVisible` still load but Variant switching is disabled with re-export guidance.
- Stage Window updates immediately when a Variant selection changes.
- OBS Browser Source updates to the same active Variant selection.
- Browser Source reload/resync receives current session active Variant selection.
- Browser Source receives no raw tracking/debug/calibration data for Variant switching.
- `Look Forward` is present and works through the existing recenter path.
- `Center Model` is present and works through the existing Stage recovery path.
- `Stage Motion` On/Off is present and updates existing Stage Motion settings.
- Active Variant selection is session-only and is not persisted.
- Hotkeys are not implemented.
- Runtime Export schema/materialization is not changed.
- Focused tests and typecheck pass, or failures are classified with concrete evidence.
- No `pnpm install` is run by agents.

## 8. Verification Matrix

| Area | Verification |
|---|---|
| Active Variant state | Unit tests for default initialization, singleSelect, multiToggle, reset, Runtime Export reload. |
| Visibility semantics | Tests for `baseVisible && predicate`, base-hidden drawables, non-Variant drawables, no-variant exports. |
| Legacy compatibility | Test that old exports load but switching is disabled. |
| Stage Window | Focused test or manual/evidence that native Stage receives active selection. |
| Browser Source | Tests/evidence for resync payload and no raw tracking/debug leakage. |
| Control UI | UI tests for navigation, Variant controls, empty/legacy states, quick actions. |
| Quick actions | Tests or bridge evidence for Look Forward, Center Model, Stage Motion On/Off. |
| Regression | Runtime Player typecheck and focused Vitest. |
| Manual check | Load a new Runtime Export with Variants, switch in Live Controller, confirm Stage Window and OBS Browser Source update. |

## 9. Manual Check Notes

The final report should ask the user to check:

- Open a new Runtime Export that includes Variants and `baseVisible`.
- Open `Live Controller`.
- Switch an expression Variant.
- Switch an outfit Variant.
- Toggle an accessory Variant if the export has a multi-toggle group.
- Confirm Stage Window updates.
- Confirm OBS Browser Source updates.
- Click `Reset to Model Default`.
- Click `Look Forward` while input is live.
- Click `Center Model`.
- Toggle `Stage Motion` Off/On and confirm behavior matches Stage page.
- Reload Browser Source and confirm current Variant selection remains in the session.
- Restart Runtime Player and confirm Variant selection resets to model default.

## 10. Out of Scope

- Editor Variant Manager.
- Runtime Export schema/materialization changes.
- Texture Atlas changes.
- Workspace Save / Portable JSON changes.
- hotkeys.
- StreamDeck / MIDI.
- separate controller window.
- Player-side Variant definition editing.
- Drawable membership editing.
- Player last-active Variant persistence.
- Stage Motion tuning sliders.
- Body Follow quick controls.
- raw diagnostics UI.
- OBS automation.
- Spout2.
- new dependencies.

## 11. Subagent Contract

- Do not run `pnpm install`; the user handles installs.
- Keep implementation scoped to Runtime Player.
- Use Wave102 Runtime Export `baseVisible` contract; do not redesign the format.
- Do not change package-format schema or authoring-core materialization unless explicitly escalated.
- Do not implement Editor Variant changes.
- Do not implement hotkeys.
- Do not persist active Variant selection.
- Do not expose raw tracking/debug/calibration data to Browser Source.
- Preserve Browser Source as the primary broadcast path.
- Preserve Wave10 native local preview suspension.
- Do not revert unrelated or concurrent changes.
- Add focused tests where behavior is deterministic.
- If a shared file must be touched, keep the change minimal and record it in the domain report.

## 12. Review Policy

Each implementation domain needs the usual review lanes:

- spec compliance.
- design/development compliance.
- test adequacy.

Reviewers must specifically check:

- new Runtime Exports use `baseVisible` for switching.
- legacy exports without `baseVisible` do not pretend to support switching.
- `visible` is not used as base visibility for runtime switching.
- Stage Window and Browser Source stay in sync.
- Browser Source receives sanitized state only.
- quick actions reuse existing ownership instead of creating duplicate logic.
- no Editor/Runtime Export schema changes slipped in.
- no persistence of active Variant selection.

## 13. Orchestration Policy

This wave follows the Implementation Orchestration skill.

Root / Undine:

- Owns wave plan, user questions, dependency graph, and final decision.
- Must not implement Runtime Player Wave12 source changes.
- Must wait for every started subagent.
- Must treat wait timeouts as polling.
- Must not close running children.

Orch-Sylph:

- Owns one domain loop.
- Must start with bounded current-state confirmation.
- Must delegate implementation and review.
- Must wait for Gnome and all Review-Sylphs.
- Must close completed children.
- Must report domain verdict and evidence.

Required assignment sentence:

```text
Orch-Sylph自身は実装担当ではない。source implementation は必ず別コンテキストの Gnome に委譲し、レビューは必ず別コンテキストの Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。
```

No parent may pass the wave gate while a child is incomplete, running, or unresolved.
