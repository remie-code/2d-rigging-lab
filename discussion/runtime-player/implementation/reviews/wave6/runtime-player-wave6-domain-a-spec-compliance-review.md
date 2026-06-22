# Runtime Player Wave6 Domain A Spec Compliance Review

> Target: `runtime-player-wave6-input-profile-position-calibration`  
> Reviewer lane: Spec Compliance Review  
> Verdict: `pass`

## Scope Reviewed

Reviewed the Domain A implementation source and focused tests directly, including tracked and untracked files listed by the parent call:

- `apps/runtime-player/src/preload/input-profile-bridge-contract.ts`
- `apps/runtime-player/src/control/control-window-app.tsx`
- `apps/runtime-player/src/control/input-page.tsx`
- `apps/runtime-player/src/main/input-session-state.ts`
- `apps/runtime-player/src/main/input-look-forward-session-neutral.test.ts`
- `apps/runtime-player/src/main/input-profile-bridge-handlers.ts`
- `apps/runtime-player/src/main/input-profile-bridge-request-validation.ts`
- `apps/runtime-player/src/main/input-profile-bridge-request-validation.test.ts`
- `apps/runtime-player/src/main/input-profiles/input-profile-document.ts`
- `apps/runtime-player/src/main/input-profiles/input-profile-document-parser.ts`
- `apps/runtime-player/src/main/input-profiles/input-profile-document-parser.test.ts`
- `apps/runtime-player/src/main/input-profiles/input-profile-calibration-sections.ts`
- `apps/runtime-player/src/main/input-profiles/input-profile-calibration-sections.test.ts`
- `apps/runtime-player/src/main/input-profiles/input-profile-calibration-start.ts`
- `apps/runtime-player/src/main/input-profiles/input-profile-calibration-start.test.ts`
- `apps/runtime-player/src/main/input-profiles/input-profile-calibration-session.ts`
- `apps/runtime-player/src/main/input-profiles/input-profile-calibration-session.test.ts`

Also spot-checked existing live readiness / live parameter code paths to confirm missing `headPositionRaw` does not block Wave5 face / eyes / mouth live mapping. Extra modified runtime-player map/backlog files were inspected only as context and are not part of this Domain A source/test verdict.

## Basis Documents Used

- `discussion/runtime-player/implementation/orchestration/player-wave6-plan.md`
- `discussion/runtime-player/screens/control-window-screen-structure.md`
- `discussion/runtime-player/screens/tracking-setup-live-mapping.md`
- `discussion/runtime-player/implementation/waves/wave5/runtime-player-wave5-domain-a-control-input-profile-calibration-report.md`
- `discussion/runtime-player/implementation/waves/wave6/runtime-player-wave6-domain-a-input-profile-position-calibration-report.md`
- `discussion/_conventions.md`
- `discussion/_map.md`

## Findings

No blocking or needs-change findings.

Evidence:

- Backward-compatible schema is present: `headPositionRaw` is optional in `InputProfileCalibration`, with neutral/min/max and `bodyLeft` / `bodyRight` learned signs (`apps/runtime-player/src/main/input-profiles/input-profile-document.ts:29`).
- Parser accepts old profiles without `headPositionRaw` and only parses the new section when present (`apps/runtime-player/src/main/input-profiles/input-profile-document-parser.ts:145`). Parser tests cover old profile load, valid head position load, and malformed head position rejection (`apps/runtime-player/src/main/input-profiles/input-profile-document-parser.test.ts:7`).
- Section readiness reports `Head rotation`, `Eyes / mouth`, and `Head position left/right`; old/default profiles are `ready, ready, missing` (`apps/runtime-player/src/main/input-profiles/input-profile-calibration-sections.ts:38`, `apps/runtime-player/src/main/input-profiles/input-profile-calibration-sections.test.ts:11`).
- Missing-only and section recalibration start policy is constrained to saved editable profiles when updating existing head position; old saved profiles get only `look-forward`, `head-position-left`, and `head-position-right` prompts (`apps/runtime-player/src/main/input-profiles/input-profile-calibration-start.ts:93`, `apps/runtime-player/src/main/input-profiles/input-profile-calibration-start.test.ts:15`).
- The calibration session captures neutral/left/right head position samples, learns lateral x-axis signs, stores observed min/max, and updates only `calibration.headPositionRaw` for section updates (`apps/runtime-player/src/main/input-profiles/input-profile-calibration-session.ts:393`, `apps/runtime-player/src/main/input-profiles/input-profile-calibration-session.ts:421`, `apps/runtime-player/src/main/input-profiles/input-profile-calibration-session.test.ts:106`).
- `Look Forward` session neutral now carries `headPositionRaw` when available and remains session-local (`apps/runtime-player/src/main/input-session-state.ts:342`, `apps/runtime-player/src/main/input-look-forward-session-neutral.test.ts:26`).
- Control Input UX exposes section statuses, `Run Missing Only`, `Full Calibration`, and head-position `Calibrate` / `Recalibrate` actions within the Input Profile / Input Calibration surface (`apps/runtime-player/src/control/input-page.tsx:214`, `apps/runtime-player/src/control/input-page.tsx:242`, `apps/runtime-player/src/control/input-page.tsx:333`).
- Existing live readiness only requires an active profile, not all calibration sections, and existing live parameter generation does not consume `headPositionRaw`; old profiles therefore remain usable for face / eyes / mouth mapping (`apps/runtime-player/src/control/control-window-formatters.ts:245`, `apps/runtime-player/src/main/live-mapping/runtime-parameter-frame.ts:72`).
- Forbidden Wave6 Domain A scope was not implemented in reviewed files. Keyword search found no Body Auto Mapping/runtime body value generation, Stage scale/translation, Broadcast/OBS, persistent Model Mapping Profile, Body Angle Y, TCP/VMC/OSC, or advanced curve editor additions. The only body-related names were `bodyLeft` / `bodyRight` learned-sign fields for input profile calibration.

## Verification Performed

Read-only commands run by this review lane:

- `Get-Content` on the basis documents and reviewed source/test files.
- `git status --short -uall`
- `rg -n "headPositionRaw|head-position|missing-only|section calibration|createUpdatedProfile|createProfile|captureLookForward|calibrationSections|RuntimePlayerInputCalibrationMode" ...`
- `rg -n "Body Angle|body angle|Body Follow|body follow|body\\.angle|Stage Motion|OBS|Broadcast|Model Mapping Profile|model-mapping-profiles|Body Angle Y|body\\.angle\\.y|VMC|OSC|TCP|scale|translation|near_camera|far_camera|near camera|far camera|stage position|reset-stage-position|bodyLeft|bodyRight" ...`
- `git diff --check -- <Domain A source/test files>`: no whitespace errors; Git reported LF-to-CRLF working-copy warnings only.
- `git diff -- discussion/runtime-player/_map.md discussion/runtime-player/backlog/runtime-player-backlog.md discussion/runtime-player/implementation/_map.md discussion/runtime-player/implementation/orchestration/_map.md` for context on out-of-scope modified docs.

I did not run `pnpm install`. I did not rerun the Vitest/typecheck/build suite in this lane; the focused tests were inspected directly, and the Gnome report's executed verification remains separate implementation evidence.

## Remaining Issues

- No blocking spec-compliance issue remains for Domain A.
- Residual verification gap: this lane did not manually exercise the Electron Control Window or real iFacialMocap head-position calibration. The implementation report already records those as remaining manual checks.
- The `0.05` raw x-axis lateral threshold is source/test-backed but still needs real-device tuning evidence later; this is not blocking for Domain A spec compliance.

## User-Decision Points

None from this lane.

## Domain B Start Gate

From this Spec Compliance lane's perspective, Domain B can start. Domain B should consume optional `calibration.headPositionRaw` defensively and preserve the established behavior that missing head position does not block existing head / eyes / mouth live mapping.
