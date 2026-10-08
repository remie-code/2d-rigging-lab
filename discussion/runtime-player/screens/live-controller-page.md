# Live Controller Page

> Status: Implemented v0 in Runtime Player Wave12; Domain A verdict passed in parent orchestration.
> Last updated: 2026-06-25.

## 1. Purpose

`Live Controller` は、Runtime Playerの既存Control Window内にある実体ページである。

このページはEditorのVariant Managerではない。配信中にユーザーが即時に押す可能性が高い操作を、`Overview` / `Input` / `Mapping` / `Stage` から分離して集めるための操作盤である。

Primary purpose:

- 配信中に表情・衣装・小物などのVariant差分を切り替える。
- 正面向き補正など、ライブ中に頻繁に使う復旧操作へすぐアクセスする。
- Stage Motionや表示位置の事故復旧など、配信画面の状態を壊さずに素早く直す。

Non-goal:

- Variant定義を作成・編集する。
- Drawable membershipを編集する。
- Runtime Exportを作成する。
- iFacialMocap calibrationやMapping profileを作り込む。
- raw diagnosticsを読む。

## 2. Position In Control Window

Current Control Window navigation is:

```text
+----------------------+
| Overview             |
| Live Controller      |
| Input                |
| Mapping              |
| Stage                |
+----------------------+
```

Decision:

- Live Controller belongs inside the existing Control Window.
- Do not create a separate Controller window for v0.
- Overview may show compact current-state summary, but the main live controls live on the Live Controller page.
- Stage Window remains model-only.
- Browser Source remains model-only output and receives sanitized state only.

Reason:

- The user already uses the Control Window during setup and monitoring.
- Creating another window would split attention during broadcast.
- `Overview` is for readiness and next action, not for high-frequency live switching.
- `Input`, `Mapping`, and `Stage` already have stable responsibilities and should not become a mixed live controller.

## 3. Responsibility Split

| Page | Responsibility |
|---|---|
| Overview | Readiness summary and next action. |
| Live Controller | High-frequency live operation during broadcast. |
| Input | iFacialMocap connection, Input Profile, calibration, diagnostics. |
| Mapping | Tracking input to model parameter mapping and Body Follow tuning. |
| Stage | Stage display setup, Browser Source Output, Stage Motion detailed settings, local preview/fallback controls. |

Live Controller reuses existing actions where possible. It does not own the detailed setup surfaces.

## 4. Implemented v0 Operations

| Operation | Current owner / source | Live Controller role |
|---|---|---|
| Variant / 差分切替 | Runtime Export `model.variants` plus drawable `baseVisible` | Primary section |
| Reset to Model Default | Runtime Export default active Variant selection | Restores model-authored defaults |
| Look Forward / Recenter | Header / Overview / Input; existing session neutral path | Prominent action |
| Stage Motion enable | Stage page setting | Compact On/Off |
| Center Model | Stage page view recovery | Compact recovery action |
| Browser Source status | Stage page / Browser Source Output | Compact status only |

Not included in v0:

- `Reset View`, because it is more destructive than `Center Model`.
- Stage Motion tuning sliders, because detailed tuning belongs on `Stage`.
- Body Follow controls, because detailed mapping belongs on `Mapping`.
- Runtime Export open/reload controls.
- Browser Source URL/server configuration controls.
- destructive `Disconnect` controls.
- raw diagnostics.

## 5. Implemented v0 Layout Shape

```text
+--------------------------------------------------------------------------------+
| LIVE CONTROLLER                                                                |
+--------------------------------------------------------------------------------+
| Status                                                                         |
|   Model: Loaded     Input: Live 59 fps     Browser Source: 1 client            |
|--------------------------------------------------------------------------------|
| Variants                                                                       |
|   Expression                                                                    |
|     [Default] [Smile] [Angry] [Surprised]                                      |
|                                                                                |
|   Outfit                                                                        |
|     [Black Coat] [Casual]                                                      |
|                                                                                |
|   Accessory                                                                     |
|     [Cat ears] [Glasses]                                                       |
|                                                                                |
|   [Reset to Model Default]                                                     |
|--------------------------------------------------------------------------------|
| Recenter                                                                        |
|   [Look Forward]                                                               |
|--------------------------------------------------------------------------------|
| Motion Safety                                                                   |
|   Stage Motion: [On/Off]                                                       |
|--------------------------------------------------------------------------------|
| View Recovery                                                                   |
|   [Center Model]                                                               |
+--------------------------------------------------------------------------------+
```

The product shape is:

- Variants first.
- Recenter second.
- Motion safety and recovery below.
- Detailed setup lives in the owner pages.

## 6. Variant UX And Runtime Semantics

Editor owns Variant definitions:

- Variant Groups.
- Variants inside each group.
- Drawable membership.
- default active selection.

Runtime Player owns live selection:

- The user chooses active Variant selection during broadcast.
- Selection affects both native Stage Window and OBS Browser Source output.
- Stage Window and Browser Source use the same session active Variant selection.
- Player does not edit Variant definitions or Drawable membership.

Group modes:

| Group mode | Player UI |
|---|---|
| `singleSelect` | segmented buttons / button grid; exactly one active Variant |
| `multiToggle` | toggle buttons; zero or more active Variants may be on |

Runtime visibility:

```text
runtimeVisible = drawable.baseVisible && variantVisibilityPredicate(activeSelection, drawableId)
```

- Non-Variant drawables follow `baseVisible`.
- Drawables with `baseVisible=false` remain hidden even if an active Variant includes them.
- `visible` remains the default-evaluated compatibility field and is not reinterpreted as base visibility for switching.

Legacy Runtime Exports:

- Legacy exports without complete drawable `baseVisible` still load.
- Variant switching controls are disabled for those exports.
- The UI gives re-export guidance.

Reset behavior:

- `Reset to Model Default` restores the Runtime Export default active selection.
- It does not edit the Runtime Export.

Persistence decision:

- Wave12 v0 active Variant selection is session-only.
- Initial state comes from Runtime Export default active selections.
- Opening another Runtime Export, reloading, or restarting Runtime Player resets to that export's defaults.
- Unloading or clearing the Runtime Export clears the active selection until another export is loaded.
- Browser Source reconnect/reload/resync receives the current session active selection.
- Player last-active Variant persistence is deferred and not implemented in Wave12.

## 7. Runtime Export Capability

Wave102 settled the Runtime Export foundation needed by Wave12:

- New Runtime Exports include drawable `baseVisible`.
- Runtime Export materialization keeps `model.variants` and default active selections.
- `visible` is computed from `baseVisible` and the default active Variant predicate.
- Legacy exports without `baseVisible` remain parseable.

Runtime Player Wave12 did not change Runtime Export schema or materialization. Runtime Player source/test changes are under `apps/runtime-player/src/**`.

## 8. State Boundaries

Live Controller sends only sanitized live control state to Stage / Browser Source.

Allowed live state:

- Active Variant selection.
- Stage Motion enabled state through the existing Stage setting.
- Stage view recovery commands through the existing Stage path.
- Look Forward command result through the existing input profile/session neutral path.

Browser Source reload/resync receives:

- loaded Runtime Export payload.
- current live frame.
- current Stage display state.
- current active Variant selection.

Do not send:

- raw tracking frames.
- raw iFacialMocap diagnostics.
- calibration internals.
- private file paths.
- Browser Source token/server diagnostics beyond what the Browser Source client needs.

## 9. Implementation Areas

Runtime Player Wave12 implementation is confined to Runtime Player source/tests under `apps/runtime-player/src/**`.

Key areas:

- `apps/runtime-player/src/control/live-controller-page.tsx`
- `apps/runtime-player/src/control/control-window-app.tsx`
- `apps/runtime-player/src/control/control-window-shell.tsx`
- `apps/runtime-player/src/shared/runtime-export-variant-selection.ts`
- `apps/runtime-player/src/main/variant-controller/**`
- `apps/runtime-player/src/preload/runtime-variant-bridge-*`
- `apps/runtime-player/src/stage/runtime-evaluation/**`
- `apps/runtime-player/src/stage/stage-renderer/**`
- `apps/runtime-player/src/stage/browser-source/**`

Wave12 preserves:

- Browser Source as the primary broadcast path.
- Wave10 native local preview live-render suspension.
- Existing ownership for Look Forward, Center Model, and Stage Motion On/Off.

## 10. Remaining Future Decisions

1. Whether Player should persist last active Variant selection in a future wave.
2. Whether Live Controller should add hotkeys.
3. Whether Live Controller should add Stage Motion quick strength sliders.
4. Whether Body Follow should have compact Live Controller controls or remain entirely in Mapping.
5. Whether Connect/Reconnect should appear only in input error/stale states.

## 11. Deferred Future Scope

- Hotkey assignment for Variants.
- MIDI/StreamDeck integration.
- Temporary reaction/pose buttons.
- Separate compact always-on-top controller window.
- Player-side Variant definition editing.
- Drawable membership editing.
- Last-active Variant persistence.
- Dedicated Model / Diagnostics pages.
- Advanced live profiles for different scenes.
