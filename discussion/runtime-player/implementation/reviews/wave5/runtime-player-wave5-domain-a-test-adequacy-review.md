# Runtime Player Wave5 Domain A Test Adequacy Review

## Verdict

pass

No blocking or needs-change test adequacy findings were found for Domain A
`runtime-player-wave5-control-input-profile-calibration`.

The focused tests cover the main pure logic and request validation risk areas:
Input Profile store/document fallback, `activeProfileId` persistence, Look Forward
session neutral behavior, guided calibration range/sign learning, bridge request
validation, and retained Wave4 input/session behavior. The Runtime Player unit
suite, package typecheck, source organization guard, dependency guard, and
scoped diff whitespace check were rerun.

## Scope Reviewed

Reviewed changed Runtime Player Domain A surface under:

- `apps/runtime-player/src/control/**`
- `apps/runtime-player/src/main/**`
- `apps/runtime-player/src/preload/**`

Primary focused tests reviewed:

- `apps/runtime-player/src/main/input-connect-request-validation.test.ts`
- `apps/runtime-player/src/main/input-look-forward-session-neutral.test.ts`
- `apps/runtime-player/src/main/input-profile-bridge-request-validation.test.ts`
- `apps/runtime-player/src/main/input-profiles/input-profile-calibration-session.test.ts`
- `apps/runtime-player/src/main/input-profiles/input-profile-store.test.ts`
- `apps/runtime-player/src/main/input-session-state.test.ts`

Implementation areas inspected for test fit:

- Profile path, read/write, parse/fallback: `apps/runtime-player/src/main/input-profiles/input-profile-store.ts:41`, `apps/runtime-player/src/main/input-profiles/input-profile-store.ts:62`, `apps/runtime-player/src/main/input-profiles/input-profile-store.ts:87`, `apps/runtime-player/src/main/input-profiles/input-profile-store.ts:116`, `apps/runtime-player/src/main/input-profiles/input-profile-store.ts:153`, `apps/runtime-player/src/main/input-profiles/input-profile-store.ts:170`
- Profile document parser: `apps/runtime-player/src/main/input-profiles/input-profile-document-parser.ts:24`
- Runtime `userData` wiring: `apps/runtime-player/src/main/runtime-player-main.ts:20`
- Look Forward/session neutral: `apps/runtime-player/src/main/input-session-state.ts:99`, `apps/runtime-player/src/main/input-session-state.ts:214`, `apps/runtime-player/src/main/input-session-state.ts:342`
- Guided calibration session: `apps/runtime-player/src/main/input-profiles/input-profile-calibration-session.ts:75`, `apps/runtime-player/src/main/input-profiles/input-profile-calibration-session.ts:153`, `apps/runtime-player/src/main/input-profiles/input-profile-calibration-session.ts:251`, `apps/runtime-player/src/main/input-profiles/input-profile-calibration-session.ts:287`, `apps/runtime-player/src/main/input-profiles/input-profile-calibration-session.ts:394`, `apps/runtime-player/src/main/input-profiles/input-profile-calibration-session.ts:616`
- Input profile IPC handler actions: `apps/runtime-player/src/main/input-profile-bridge-handlers.ts:88`, `apps/runtime-player/src/main/input-profile-bridge-handlers.ts:97`, `apps/runtime-player/src/main/input-profile-bridge-handlers.ts:110`, `apps/runtime-player/src/main/input-profile-bridge-handlers.ts:123`, `apps/runtime-player/src/main/input-profile-bridge-handlers.ts:129`, `apps/runtime-player/src/main/input-profile-bridge-handlers.ts:148`, `apps/runtime-player/src/main/input-profile-bridge-handlers.ts:166`, `apps/runtime-player/src/main/input-profile-bridge-handlers.ts:207`
- Preload API exposure: `apps/runtime-player/src/preload/runtime-player-bridge.ts:78`, `apps/runtime-player/src/preload/runtime-player-bridge.ts:80`, `apps/runtime-player/src/preload/runtime-player-bridge.ts:87`, `apps/runtime-player/src/preload/runtime-player-bridge.ts:97`
- Control UI action reachability: `apps/runtime-player/src/control/input-page.tsx:201`, `apps/runtime-player/src/control/input-page.tsx:214`, `apps/runtime-player/src/control/input-page.tsx:251`, `apps/runtime-player/src/control/input-page.tsx:264`, `apps/runtime-player/src/control/input-page.tsx:271`, `apps/runtime-player/src/control/overview-page.tsx:165`, `apps/runtime-player/src/control/overview-page.tsx:178`

## Basis Documents Used

- `discussion/runtime-player/implementation/orchestration/player-wave5-plan.md`
- `discussion/runtime-player/architecture/runtime-player-development-policy.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/runtime-player/implementation/waves/wave4/runtime-player-wave4-final-integration-report.md`
- `discussion/_conventions.md`
- `discussion/_map.md`

## Findings

### Blocking

None.

### Needs Changes

None.

### Non-Blocking Observations

1. The automated tests focus on pure main-process logic and request validation.
   They do not exercise the full Electron `ipcMain`/`contextBridge` handler
   path for temporary defaults, cancel calibration, or finish/save. The
   underlying pure session/store behavior is covered, and Control/Preload
   source exposes the expected actions, so this is a remaining integration gap
   rather than a blocking Domain A unit-test gap.

2. The Look Forward test proves unavailable-without-frame and non-persistence,
   and captures a received frame, but it does not use two distinct received
   frames to prove "latest" by regression test alone. Source inspection shows
   `recordReceivedFrame` overwrites `latestTrackingFrame` and
   `captureLookForward` reads that current field, so this is acceptable for
   Domain A but worth tightening if this path becomes more complex.

## Coverage Assessment

Profile document/store:

- Store path under `<userData>/input-profiles/ifacialmocap/profiles.json` is
  asserted in `apps/runtime-player/src/main/input-profiles/input-profile-store.test.ts:11`.
- Saved profile and `activeProfileId` persistence are asserted in
  `apps/runtime-player/src/main/input-profiles/input-profile-store.test.ts:34`.
- Corrupt JSON fallback is asserted in
  `apps/runtime-player/src/main/input-profiles/input-profile-store.test.ts:63`.
- Invalid profile skip/fallback behavior is asserted in
  `apps/runtime-player/src/main/input-profiles/input-profile-store.test.ts:79`.

Bridge request validation:

- Input connect defaulting/trimming/rejection tests are in
  `apps/runtime-player/src/main/input-connect-request-validation.test.ts:6`,
  `apps/runtime-player/src/main/input-connect-request-validation.test.ts:14`,
  and `apps/runtime-player/src/main/input-connect-request-validation.test.ts:28`.
- Profile bridge request normalization/rejection tests are in
  `apps/runtime-player/src/main/input-profile-bridge-request-validation.test.ts:10`,
  `apps/runtime-player/src/main/input-profile-bridge-request-validation.test.ts:21`,
  and `apps/runtime-player/src/main/input-profile-bridge-request-validation.test.ts:30`.

Look Forward/session neutral:

- Unavailable-without-frame is asserted in
  `apps/runtime-player/src/main/input-look-forward-session-neutral.test.ts:14`.
- Session neutral capture and no persistent profile write are asserted in
  `apps/runtime-player/src/main/input-look-forward-session-neutral.test.ts:26`
  and `apps/runtime-player/src/main/input-look-forward-session-neutral.test.ts:64`.

Guided calibration:

- Full prompt path, range recording, `canFinish`, profile creation, learned
  signs, blink, mouth-open, and smile ranges are asserted in
  `apps/runtime-player/src/main/input-profiles/input-profile-calibration-session.test.ts:10`,
  `apps/runtime-player/src/main/input-profiles/input-profile-calibration-session.test.ts:32`,
  `apps/runtime-player/src/main/input-profiles/input-profile-calibration-session.test.ts:34`,
  `apps/runtime-player/src/main/input-profiles/input-profile-calibration-session.test.ts:50`,
  `apps/runtime-player/src/main/input-profiles/input-profile-calibration-session.test.ts:58`,
  `apps/runtime-player/src/main/input-profiles/input-profile-calibration-session.test.ts:64`,
  and `apps/runtime-player/src/main/input-profiles/input-profile-calibration-session.test.ts:66`.
- Stable directional sample behavior is asserted in
  `apps/runtime-player/src/main/input-profiles/input-profile-calibration-session.test.ts:70`.

Wave4 input/session behavior:

- Existing Wave4 session behavior still has coverage for idle/default status,
  passive listening, parse/normalize/latest diagnostics, stale transition, and
  malformed-frame diagnostics in `apps/runtime-player/src/main/input-session-state.test.ts:16`,
  `apps/runtime-player/src/main/input-session-state.test.ts:32`,
  `apps/runtime-player/src/main/input-session-state.test.ts:51`,
  `apps/runtime-player/src/main/input-session-state.test.ts:101`, and
  `apps/runtime-player/src/main/input-session-state.test.ts:120`.

## Verification Performed

No `pnpm install` was run.

- Focused Runtime Player Vitest:
  `pnpm.cmd exec vitest run -c vitest.config.ts src/main/input-connect-request-validation.test.ts src/main/input-look-forward-session-neutral.test.ts src/main/input-profile-bridge-request-validation.test.ts src/main/input-profiles/input-profile-calibration-session.test.ts src/main/input-profiles/input-profile-store.test.ts src/main/input-session-state.test.ts`
  - Result: pass, 6 test files / 19 tests.
- Runtime Player unit suite:
  `pnpm.cmd test:unit` from `apps/runtime-player`
  - Result: pass, 20 test files / 79 tests.
- Runtime Player typecheck:
  `pnpm.cmd typecheck` from `apps/runtime-player`
  - Result: pass.
- Source organization:
  `node scripts/check-source-organization.mjs`
  - Result: pass.
- Dependency guard:
  `node scripts/check-dependencies.mjs`
  - Result: pass.
- Scoped whitespace check:
  `git diff --check -- apps/runtime-player/src`
  - Result: pass, with LF/CRLF working-copy warnings only.

## Remaining Issues / Test Gaps

- No automated Electron UI smoke was run for the Control Window page shell or
  button clicks.
- No handler-level test currently drives `registerInputProfileBridgeHandlers`
  through fake Electron IPC registrations.
- No real-device iFacialMocap verification was performed in this review.
- No actual Electron runtime restart was performed to verify persisted profile
  reload from the OS `userData` directory. Unit coverage verifies the path
  construction and read/write behavior using temporary directories.
- Manual Stage cleanliness and Stage live model motion are outside Domain A and
  remain Wave5 Domain B/final integration concerns.

## User-Decision Points

None for Domain A test adequacy.

Future optional hardening:

- Add a pure handler-state seam or fake IPC test for temporary defaults,
  cancel calibration, and finish/save if regressions appear around the bridge
  layer.
- Add a two-frame Look Forward regression test to make "latest frame" explicit
  in test data.
