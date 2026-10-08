# Runtime Player Wave5 Domain A Report: Control Shell + Input Profile / Calibration v0

> Target: `runtime-player-wave5-control-input-profile-calibration`
> Verdict: pass
> Scope: Control Window Wave5 shell, Input Profile persistence, profile bridge APIs, Look Forward session neutral, Guided Calibration v0, and focused Domain A tests.

## Files Changed

Control Window shell and pages:

- `apps/runtime-player/src/control/control-window-app.tsx`
- `apps/runtime-player/src/control/control-window-shell.tsx`
- `apps/runtime-player/src/control/control-window-components.tsx`
- `apps/runtime-player/src/control/control-window-formatters.ts`
- `apps/runtime-player/src/control/overview-page.tsx`
- `apps/runtime-player/src/control/input-page.tsx`
- `apps/runtime-player/src/control/mapping-page.tsx`

Main input/profile state and bridge:

- `apps/runtime-player/src/main/input-session-state.ts`
- `apps/runtime-player/src/main/input-bridge-handlers.ts`
- `apps/runtime-player/src/main/input-connect-request-validation.ts`
- `apps/runtime-player/src/main/input-profile-bridge-handlers.ts`
- `apps/runtime-player/src/main/input-profile-bridge-request-validation.ts`
- `apps/runtime-player/src/main/runtime-player-main.ts`

Input Profile store and calibration:

- `apps/runtime-player/src/main/input-profiles/input-profile-document.ts`
- `apps/runtime-player/src/main/input-profiles/input-profile-document-parser.ts`
- `apps/runtime-player/src/main/input-profiles/input-profile-defaults.ts`
- `apps/runtime-player/src/main/input-profiles/input-profile-store.ts`
- `apps/runtime-player/src/main/input-profiles/input-profile-id.ts`
- `apps/runtime-player/src/main/input-profiles/input-profile-calibration-session.ts`

Preload contracts and bridge:

- `apps/runtime-player/src/preload/input-profile-bridge-channels.ts`
- `apps/runtime-player/src/preload/input-profile-bridge-contract.ts`
- `apps/runtime-player/src/preload/runtime-player-bridge.ts`
- `apps/runtime-player/src/preload/runtime-player-bridge-contract.ts`

Focused tests:

- `apps/runtime-player/src/main/input-connect-request-validation.test.ts`
- `apps/runtime-player/src/main/input-look-forward-session-neutral.test.ts`
- `apps/runtime-player/src/main/input-profile-bridge-request-validation.test.ts`
- `apps/runtime-player/src/main/input-profiles/input-profile-calibration-session.test.ts`
- `apps/runtime-player/src/main/input-profiles/input-profile-store.test.ts`
- Existing `apps/runtime-player/src/main/input-session-state.test.ts` remained part of the focused verification set.

Review artifacts:

- `discussion/runtime-player/implementation/reviews/wave5/runtime-player-wave5-domain-a-spec-compliance-review.md`
- `discussion/runtime-player/implementation/reviews/wave5/runtime-player-wave5-domain-a-design-development-review.md`
- `discussion/runtime-player/implementation/reviews/wave5/runtime-player-wave5-domain-a-test-adequacy-review.md`

## Control Page Structure

Domain A replaces the previous vertically stacked Control Window with a Wave5 shell:

- Persistent Header with Runtime Export, input, profile, and live readiness status.
- Header actions for Open Export, Look Forward, and Focus Stage.
- Navigation exposes only real Wave5 pages:
  - `Overview`
  - `Input`
  - `Mapping`
- No `Model`, `Stage`, or dedicated `Diagnostics` page is added.
- Existing input diagnostics remains available as a secondary collapsible debug panel below the selected page.
- Mapping page is a minimal semantic-slot shell for Domain B and does not implement Auto Mapping or persistent Model Mapping Profile save.

## Profile Store Path And Schema

Input Profile persistence is owned by Electron main process.

Storage path:

```text
<electron userData>/
  input-profiles/
    ifacialmocap/
      profiles.json
```

Runtime wiring passes `app.getPath("userData")` to `registerInputProfileBridgeHandlers`.

Document schema:

- `schemaVersion: "runtime-player-input-profiles-v1"`
- `activeProfileId`
- `profiles[]`
- profile metadata:
  - `profileId`
  - `displayName`
  - `source: "ifacialmocap"`
  - `transport: "udp"`
  - `createdAtIso`
  - `updatedAtIso`
- calibration data:
  - head rotation neutral/min/max and learned signs
  - eyes neutral/min/max, blink min/max, and learned signs
  - mouth jaw-open and smile min/max

Store behavior:

- Creates parent directories before writing.
- Persists `activeProfileId` when saving or selecting a profile.
- Parses and validates enough of the document to avoid crashing on corrupt or incompatible files.
- Missing profile file yields an empty document with `missing` storage state.
- Corrupt/unreadable profile data yields `read-failed`, warning messages, and temporary defaults in status.
- Renderer never reads or writes the profile file directly.

## Look Forward Session Neutral

`Look Forward` is implemented as session-local input state:

- Uses `RuntimePlayerInputSessionState` latest normalized `TrackingFrame`.
- Returns unavailable when no tracking frame has been received.
- Captures head rotation, eye rotations, jaw open, mouth smile, and frame timestamp into a session neutral snapshot.
- Does not write to `profiles.json`.
- The persistent profile neutral remains separate from session neutral.

## Guided Calibration v0

Guided calibration is implemented in main-owned session state with deterministic v0 prompts and thresholds.

Prompt groups:

- Look forward.
- Turn face left/right.
- Look up/down.
- Tilt left/right.
- Eyes left/right/up/down.
- Blink.
- Open mouth.
- Smile.

Behavior:

- Start/cancel/record sample/advance prompt/finish actions are exposed through the typed profile bridge.
- The first prompt records forward neutral.
- Directional prompts record range and learned sign `{ axis, direction }` from observed deltas.
- Prompt completion requires deterministic threshold crossing and stable repeated samples.
- Blink, mouth open, and smile prompts update activation ranges.
- Finish creates and saves an Input Profile; it also sets the saved profile active.
- `Use Temporary Defaults` is an in-memory session escape hatch and does not write to the profile store.

## Verification Performed

Gnome implementation evidence and independent Review-Sylph reruns agree:

- Focused Runtime Player Vitest: pass, 6 files / 19 tests.
- Runtime Player unit suite: pass, 20 files / 79 tests.
- Runtime Player typecheck: pass.
- `node scripts/check-source-organization.mjs`: pass.
- `node scripts/check-dependencies.mjs`: pass.
- `git diff --check -- apps/runtime-player/src`: pass, with LF/CRLF working-copy warnings only.

No `pnpm install` was run.

## Review Results

Required Domain A review lanes exist and pass:

- Spec Compliance: pass.
- Design / Development Compliance: pass.
- Test Adequacy: pass.

Applied fixes after review:

- None required. All three review lanes reported no blocking or needs-change findings.

## Source Organization

- New files are split by responsibility.
- No `index.ts` implementation logic was added.
- No broad catch-all `types.ts`, `schemas.ts`, `utils.ts`, or `helpers.ts` file was added.
- `input-profile-calibration-session.ts` is the largest new file and owns one cohesive responsibility: deterministic Guided Calibration v0 session logic. No exception is requested for Domain A.

## Remaining Integration Points For Domain B

- Auto Mapping from Runtime Export parameter metadata.
- Backed mapping slot state and enabled/invert/strength behavior.
- Sanitized runtime parameter frame production from tracking frame + session neutral + input profile.
- Main-to-Stage live parameter channel.
- Stage runtime-core live evaluation and render update.
- Manual real-device verification that tracking input moves the model.

## Remaining Manual Verification

- Launch Electron Runtime Player and verify the Control shell visually.
- Verify Overview/Input/Mapping nav only exposes real Wave5 pages.
- Connect iFacialMocap or loopback input and verify Look Forward availability.
- Exercise a guided calibration session through the UI.
- Save a profile and restart Runtime Player to verify userData reload in the actual Electron runtime.
- Confirm temporary defaults are visibly marked and do not create a profile file.

## User Decision Points

None for Domain A.

