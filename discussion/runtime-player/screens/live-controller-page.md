# Live Controller Page

> Status: Draft / accepted UX direction before implementation planning.
> Last updated: 2026-06-24.

## 1. Purpose

`Live Controller` は、Runtime PlayerのControl Window内に追加する将来ページである。

このページはEditorのVariant Managerではない。配信中にユーザーが即時に押す可能性が高い操作を、`Overview` / `Input` / `Mapping` / `Stage` から分離して集めるための操作盤である。

Primary purpose:

- 配信中に表情・衣装・小物などの差分を切り替える。
- 正面向き補正など、ライブ中に頻繁に使う復旧操作へすぐアクセスする。
- Stage Motionや表示位置の事故復旧など、配信画面の状態を壊さずに素早く直す。

Non-goal:

- 差分定義を作成・編集する。
- Drawable membershipを編集する。
- Runtime Exportを作成する。
- iFacialMocap calibrationやMapping profileを作り込む。
- raw diagnosticsを読む。

## 2. Position In Control Window

Current Control Window navigation is:

```text
----------------------+
| Overview             |
| Input                |
| Mapping              |
| Stage                |
+----------------------+
```

Live Controller should be added as a new page in the same Control Window:

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
- Overview may show a compact current-state summary and link to Live Controller, but the main controls live on the Live Controller page.
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

Live Controller should reuse existing actions where possible. It should not own the detailed setup surfaces.

## 4. Candidate Operations

### 4.1 High Priority

| Operation | Current owner | Live Controller role | Reason |
|---|---|---|---|
| Variant / 差分切替 | Runtime Export format has `model.variants`; Player UI/API not yet confirmed | Primary section | Expressions, outfits, and accessories are likely to be switched during broadcast. |
| Look Forward / Recenter | Header / Overview / Input; `inputProfile.lookForward()` path | Prominent action | Users often need to reset current neutral direction while live. |
| Stage Motion enable | Stage page | Quick On/Off | Useful when motion is too distracting or needs a temporary stop. |
| Center Model | Stage page | Quick recovery | Restores composition when the model drifts out of the desired frame while preserving zoom. |

### 4.2 Medium Priority

| Operation | Current owner | Live Controller role | Reason |
|---|---|---|---|
| Reset View | Stage page | Secondary recovery action | Stronger than Center Model; useful but should not be the primary panic button. |
| Browser Source mini status | Stage page / Browser Source Output | Compact status only | Client count, latest frame age, and renderer error are useful during broadcast. |
| Reconnect input | Overview / Input / Mapping readiness | Conditional action | Useful only when input is idle/stale/error; port/IP editing stays in Input. |
| Stage Motion strength/limit quick tune | Stage page | Optional collapsed advanced | Sometimes adjusted while watching OBS, but full controls should remain on Stage. |
| Body Follow quick controls | Mapping page | Optional compact controls | Useful if body movement feels wrong, but full mapping controls must remain on Mapping. |

### 4.3 Low Priority / Do Not Put In Primary Controller

| Operation | Why not primary |
|---|---|
| Open Runtime Export | Setup action and risky during live. |
| Receive port / IP editing | Input setup, not live operation. |
| Full / section calibration | Profile setup. Live Controller may link to Input, not host it. |
| Mapping slot details | This would turn Live Controller into Mapping page. |
| Raw diagnostics / copy diagnostics | Debug surface. |
| Browser Source URL/token/server details | Stage page responsibility. |
| Copy Browser Source URL | Setup/troubleshooting; may remain in Stage page. |
| Disconnect | Accident-prone. If needed, put behind error/recovery state or confirmation. |
| Arrange Stage / click-through / always-on-top | Local preview/fallback setup, not primary Browser Source live control. |

## 5. Recommended v0 Layout

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
|   [Look Forward]          Last neutral: 12:34:56                               |
|--------------------------------------------------------------------------------|
| Motion Safety                                                                   |
|   Stage Motion: [On]                                                           |
|   Body Follow:   Active                                                        |
|--------------------------------------------------------------------------------|
| View Recovery                                                                   |
|   [Center Model] [Reset View]                                                  |
|--------------------------------------------------------------------------------|
| Output                                                                          |
|   Browser Source: connected / latest frame 16 ms ago                           |
|   [Open Stage Settings]                                                        |
+--------------------------------------------------------------------------------+
```

The exact density can change during implementation, but the product shape should stay:

- Variants first.
- Recenter second.
- Motion safety and recovery below.
- Detailed setup lives in the owner pages.

## 6. Variant UX Semantics

Editor owns Variant definitions:

- Variant Groups.
- Variants inside each group.
- Drawable membership.
- default active selection.

Runtime Player owns live selection:

- The user chooses active Variant selection during broadcast.
- Selection affects Stage Window and Browser Source output.
- Player does not edit Variant definitions or Drawable membership.

Group modes:

| Group mode | Player UI |
|---|---|
| `singleSelect` | segmented buttons / button grid; exactly one active variant |
| `multiToggle` | toggle buttons; multiple active variants may be on |

Reset behavior:

- `Reset to Model Default` restores the Runtime Export's default active selection.
- It does not edit the Runtime Export.

Persistence decision:

- Preferred direction: Player should persist last active Variant selection for the loaded Runtime Export, because Runtime Player is an operational app.
- Runtime Export default remains the model-authored default.
- Player last active selection remains local operational state.
- Needs implementation planning after Runtime Export capability is confirmed.

## 7. Important Runtime Export Question

Before implementation planning, confirm whether Runtime Export already preserves enough Variant information for runtime switching.

Known concern from read-only inventory:

- Runtime Export format appears to have `model.variants`.
- However, current export/render path may bake default active Variant selection into `drawable.visible`.
- If only default-visible drawables survive as renderable state, Player cannot reliably switch to non-default variants.

Required investigation:

- Does Runtime Export contain Variant Groups and Variants?
- Does it preserve Drawable membership per Variant?
- Does it preserve a base visibility independent from Variant selection?
- Does it preserve default active selection separately from runtime drawable visibility?
- Can Stage and Browser Source receive an active Variant selection and evaluate visibility at runtime?
- If not, what format/materialization/adapter changes are required?

This question is intentionally not settled in this document. It is the next required technical inventory before planning Live Controller implementation.

## 8. State Boundaries

Live Controller should send only sanitized live control state to Stage / Browser Source.

Allowed live state:

- Active Variant selection.
- Stage Motion enabled/quick settings.
- Stage view recovery commands.
- Look Forward command result through existing input profile/session neutral path.

Do not send:

- raw tracking frames.
- raw iFacialMocap diagnostics.
- calibration internals.
- private file paths.
- Browser Source token/server diagnostics beyond what the Browser Source client needs.

## 9. Likely Implementation Areas

Likely Control UI files:

- `apps/runtime-player/src/control/control-window-app.tsx`
- `apps/runtime-player/src/control/control-window-shell.tsx`
- new `apps/runtime-player/src/control/live-controller-page.tsx`

Likely bridge/main files:

- `apps/runtime-player/src/shared/runtime-player-bridge-contract.ts`
- `apps/runtime-player/src/main/runtime-player-main.ts`
- existing input profile bridge / handlers for Look Forward.

Likely runtime/stage files:

- `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-runtime-graph-adapter.ts`
- `apps/runtime-player/src/stage/stage-renderer/**`
- `apps/runtime-player/src/stage/browser-source/**`

Likely format/materialization files if Runtime Export lacks required data:

- `packages/package-format/src/runtime-export.ts`
- `packages/authoring-core/src/runtime-export-materialization.ts`
- runtime graph adapter/types as needed.

## 10. Open Questions

1. Does Runtime Export already support runtime Variant switching, or does it bake default visibility?
2. Should Player last active Variant selection be restored automatically on startup?
3. Should Live Controller include only Stage Motion On/Off, or also quick strength sliders?
4. Should Body Follow have any Live Controller quick controls, or remain entirely in Mapping?
5. Should Connect/Reconnect appear only in error/stale states?
6. Should hotkeys be part of v0 or a later wave?

## 11. Deferred Future Scope

- Hotkey assignment for Variants.
- MIDI/StreamDeck integration.
- Temporary reaction/pose buttons.
- Separate compact always-on-top controller window.
- Dedicated Model / Diagnostics pages.
- Advanced live profiles for different scenes.
