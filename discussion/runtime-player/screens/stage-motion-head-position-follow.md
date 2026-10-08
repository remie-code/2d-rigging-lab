# Stage Motion / Head Position Follow

> Runtime Player Stage上のモデル表示位置・表示スケールを、iFacialMocapのhead positionから一時的にoffsetするためのUX/設計メモ。

## 1. Status

- Status: Implemented through Runtime Player Wave11 source/tests/review; manual OBS and real-device tuning checks pending.
- Date: 2026-06-23
- Related implemented baseline:
  - Wave7 Stage page and Window State auto-save.
  - Wave8 native Stage local preview/fallback controls.
  - Wave9 Browser Source Output.
  - Wave10 Browser Source performance foundation.
  - Wave11 explicit near/far Input Profile calibration, main-owned Stage Motion transform, and Stage page controls.

This document records the current Stage Motion UX and implementation facts. Wave11 reports and reviews remain the detailed implementation evidence:

- [../implementation/waves/wave11/runtime-player-wave11-domain-a-input-profile-near-far-calibration-report.md](../implementation/waves/wave11/runtime-player-wave11-domain-a-input-profile-near-far-calibration-report.md)
- [../implementation/waves/wave11/runtime-player-wave11-domain-b-stage-motion-core-persistence-transport-report.md](../implementation/waves/wave11/runtime-player-wave11-domain-b-stage-motion-core-persistence-transport-report.md)
- [../implementation/waves/wave11/runtime-player-wave11-domain-c-stage-motion-ui-report.md](../implementation/waves/wave11/runtime-player-wave11-domain-c-stage-motion-ui-report.md)

## 2. Product Goal

The user should be able to make the model feel physically present in the broadcast frame by letting head position slightly affect the Stage-level display transform.

This is not model rigging and not parameter mapping. It is a live display offset layered on top of the manually arranged Stage view.

Desired result:

- When the tracked head moves left/right, the rendered model shifts left/right on the Stage.
- When the tracked head moves closer/farther, the rendered model scales slightly larger/smaller.
- Manual Stage pan/zoom remains the base composition.
- Head-position motion is a temporary live offset above that base composition.
- OBS Browser Source and native Stage preview should see the same final composition.

## 3. Responsibility Boundary

Stage Motion belongs to the `Stage` page, not the `Mapping` page.

Reason:

- Mapping converts tracking input into model parameters such as Face Angle, Eye Open, Mouth Open, or Body Angle.
- Stage Motion changes how the already-rendered model is placed in the broadcast frame.
- The user thinks of this as "where the character stands and how much the camera distance follows me," not as model deformation.

Stage Motion must not:

- create or edit Runtime Export parameters.
- write model keyforms.
- alter Body Follow / Model Mapping output.
- send raw tracking/debug data to Browser Source.

Wave11 implementation facts:

- Stage Motion controls are on the `Stage` page only.
- Mapping page remains for model parameter mapping and does not own Stage Motion.
- Browser Source receives only the sanitized composed Stage display transform.
- Raw tracking frames, raw head position values, calibration internals, and debug diagnostics are not sent to Browser Source.

## 4. Input And Output

Input:

- normalized / calibrated head position from the existing input pipeline.
- head position X for horizontal follow.
- explicitly calibrated near/far head-position depth for scale follow.

Wave11 adds separate readiness for:

- `head-position-left-right`
- `head-position-near-far`

Existing Input Profiles without near/far data still load. They show near/far as missing until the user runs missing-only or near/far section calibration.

Output:

- transient Stage transform offset:
  - horizontal pan offset.
  - scale multiplier offset.

Saved base Stage view remains separate:

```text
basePanX / basePanY / baseScale
  = manual Stage view transform saved in Window State

liveOffsetX / liveScaleMultiplier
  = temporary value computed from head position

renderPanX
  = basePanX + liveOffsetX

renderScale
  = baseScale * liveScaleMultiplier
```

Do not save `liveOffsetX` or `liveScaleMultiplier`. Save only the configuration that computes them.

## 5. Settings

### 5.1 Global

```text
Stage Motion
  Enabled [x]
```

When disabled, Stage render uses only the saved Stage view transform.

### 5.2 Horizontal Follow

Purpose: shift the rendered model left/right from head position X.

Settings:

- `Strength`
  - How many pixels of Stage movement are produced by the normalized head position input.
  - Example display unit: `80 px`.
- `Limit`
  - Maximum absolute horizontal offset.
  - Example display unit: `120 px`.
- `Invert`
  - Reverses left/right response.

### 5.3 Depth Scale

Purpose: scale the rendered model from head position Z / distance-like input.

Settings:

- `Strength`
  - How much scale response is produced by the normalized depth input.
  - Example display unit: `6%`.
- `Limit`
  - Maximum scale delta.
  - Example display unit: `10%`.
- `Invert`
  - Reverses near/far response.

### 5.4 Stabilization

`Dead zone`

- Small input changes inside this range are ignored.
- Prevents the model from constantly trembling from tracking noise.
- Example: if absolute input is below `0.03`, treat it as zero.

`Reaction`

- Controls how quickly the live offset catches up to the target input.
- Lower values feel floatier/slower.
- Higher values feel snappier.
- This is conceptually similar to Body Follow reaction/lag, but applies to Stage-level display motion.

Suggested UI:

```text
Stage Motion
  Enabled [x]

Horizontal Follow
  Strength     [----|-----]  80 px
  Limit        [---|------]  120 px
  Invert       [ ]

Depth Scale
  Strength     [----|-----]  6 %
  Limit        [---|------]  10 %
  Invert       [ ]

Stabilization
  Dead zone    [--|-------]  0.03
  Reaction     [----|-----]  8
```

## 6. Auto Save

Stage Motion configuration auto-saves.

Storage follows Window State / local display setting style.

Reason:

- Stage Motion is a display/composition preference.
- It belongs to the user's local streaming setup and camera/stage environment.
- It is not a model-authored parameter mapping.

Saved values:

- enabled.
- horizontal strength.
- horizontal limit.
- horizontal invert.
- scale strength.
- scale limit.
- scale invert.
- dead zone.
- reaction.

Not saved:

- current live offset.
- current smoothed offset.
- current raw head position.
- session neutral / Look Forward state.

Wave11 implementation:

- Stage Motion settings are stored under Window State `stageMotion.settings`.
- Older Window State files load defaults.
- Settings updates are persisted through the existing Stage/Window State auto-save path.
- Runtime smoothed offset state stays in memory only.
- Revisit per Runtime Export only if users need different Stage Motion tuning per model.

## 7. Runtime / Browser Source Behavior

The computed Stage Motion offset applies to:

- native Stage Window local preview when it is rendering.
- OBS Browser Source output.

Wave10 behavior remains:

- Browser Source client connected: native local preview live rendering may be suspended.
- Browser Source rendering stays active.

Stage Motion is computed in main and remains active for Browser Source even when native preview rendering is suspended.

The Browser Source client receives only sanitized Stage display state / transform data needed for rendering. It does not receive raw tracking frame diagnostics.

## 8. Initial Algorithm Shape

For each live frame:

```text
rawHorizontal = calibratedHeadPositionX
rawDepth = calibratedHeadPositionZ

horizontalInput = applyDeadZone(rawHorizontal, deadZone)
depthInput = applyDeadZone(rawDepth, deadZone)

targetOffsetX = clamp(
  horizontalInput * horizontalStrength * horizontalSign,
  -horizontalLimit,
  horizontalLimit
)

targetScaleDelta = clamp(
  depthInput * scaleStrength * scaleSign,
  -scaleLimit,
  scaleLimit
)

smoothedOffsetX = approach(smoothedOffsetX, targetOffsetX, reaction, dt)
smoothedScaleDelta = approach(smoothedScaleDelta, targetScaleDelta, reaction, dt)

renderPanX = basePanX + smoothedOffsetX
renderScale = baseScale * (1 + smoothedScaleDelta)
```

Exact numeric mapping can be adjusted during implementation/manual tuning.

Important:

- Scale should be bounded to avoid sudden huge/small model display.
- Horizontal movement should be bounded to avoid moving the model out of the OBS composition.
- Smoothing should be time-based rather than frame-count based if possible.

## 9. Manual UX Expectations

The user should be able to:

1. Open Runtime Player.
2. Load / restore a Runtime Export.
3. Connect iFacialMocap.
4. Open `Stage`.
5. Enable `Stage Motion`.
6. Move head left/right and see model position respond.
7. Move closer/farther and see model scale respond.
8. Adjust strength/limit/dead zone/reaction while watching the Stage or OBS Browser Source.
9. Restart Runtime Player and see the same Stage Motion settings restored.

## 10. Wave11 Implemented Acceptance Facts

- Stage page has Stage Motion settings.
- Settings auto-save and restore.
- Manual Stage pan/zoom remains the base transform.
- Head position horizontal follow adds only a live horizontal offset.
- Head position depth follow adds only a live scale offset.
- Offset is bounded by limits.
- Dead zone suppresses small tracking jitter.
- Reaction smooths motion.
- OBS Browser Source sees the same Stage Motion result as native preview.
- Native local preview suspension from Wave10 does not disable Browser Source Stage Motion.
- No raw tracking/debug data is exposed to Browser Source.

Source/test/review evidence exists in the Wave11 Domain A/B/C reports and reviews. Remaining confidence checks are manual because they require real iFacialMocap movement, OBS Browser Source, and visual tuning.

## 11. Out Of Scope

- Body parameter mapping changes.
- Runtime Export changes.
- model keyform/rig edits.
- per-parameter sliders.
- Spout2.
- OBS automation.
- saving current live offset.
- advanced curves.
- separate profile management UI.

## 12. Manual Verification Still Pending

- Recalibrate or missing-only calibrate near/far in Input Profile.
- Enable Stage Motion on the Stage page.
- Move head left/right and confirm horizontal Stage offset direction and bounds.
- Move closer/farther and confirm Stage scale direction and bounds.
- Adjust strength, limit, invert, dead zone, and reaction while watching OBS Browser Source.
- Confirm manual Stage pan/zoom remains the base composition.
- Restart Runtime Player and confirm Stage Motion settings restore.
- Confirm OBS Browser Source matches native local preview when preview is active.
- Confirm OBS Browser Source continues to receive Stage Motion while Wave10 native local preview live rendering is suspended.
- Confirm perceived CPU/GPU behavior remains acceptable after Wave10 suspension.
