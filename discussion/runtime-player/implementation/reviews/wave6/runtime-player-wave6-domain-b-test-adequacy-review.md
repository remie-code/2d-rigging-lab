# Runtime Player Wave6 Domain B Test Adequacy Review

> Target: `runtime-player-wave6-body-auto-mapping-live-follow`  
> Lane: Test Adequacy Review  
> Verdict: `pass`

## Scope Reviewed

Reviewed the focused Domain B tests, the source under test, relevant bridge/reset paths, reported verification evidence, and reviewer-run verification commands.

Tests reviewed:

- `apps/runtime-player/src/main/live-mapping/runtime-export-auto-mapping.test.ts`
- `apps/runtime-player/src/main/live-mapping/runtime-parameter-frame.test.ts`
- `apps/runtime-player/src/main/input-session-state.test.ts`

Source reviewed:

- `apps/runtime-player/src/preload/model-mapping-bridge-contract.ts`
- `apps/runtime-player/src/main/live-mapping/body-follow-state.ts`
- `apps/runtime-player/src/main/live-mapping/semantic-slot-definitions.ts`
- `apps/runtime-player/src/main/live-mapping/runtime-export-auto-mapping.ts`
- `apps/runtime-player/src/main/live-mapping/runtime-parameter-frame.ts`
- `apps/runtime-player/src/main/live-mapping/live-mapping-state.ts`
- `apps/runtime-player/src/main/model-mapping-bridge-request-validation.ts`
- `apps/runtime-player/src/main/model-mapping-bridge-handlers.ts`
- `apps/runtime-player/src/main/input-bridge-handlers.ts`
- `apps/runtime-player/src/main/input-session-state.ts`
- `apps/runtime-player/src/main/runtime-player-main.ts`
- `apps/runtime-player/src/control/mapping-page.tsx`
- `apps/runtime-player/src/main/live-parameter-bridge-handlers.ts`

## Basis Documents Used

- `discussion/runtime-player/implementation/orchestration/player-wave6-plan.md`
- `discussion/runtime-player/implementation/waves/wave6/runtime-player-wave6-domain-b-body-auto-mapping-live-follow-report.md`
- `discussion/runtime-player/implementation/waves/wave6/runtime-player-wave6-domain-a-input-profile-position-calibration-report.md`
- `discussion/runtime-player/implementation/reviews/wave6/runtime-player-wave6-domain-a-test-adequacy-review.md`
- `discussion/runtime-player/architecture/runtime-player-development-policy.md`

## Findings

No blocking or non-blocking findings.

The focused tests cover the core Body Auto Mapping and Body Follow pure logic required for Domain B. UI body controls and new mapping update validation are not directly covered by React/validation tests, but the reviewed source is thin, typed, and backed by typecheck plus unit-suite coverage of the downstream state/frame behavior. I am treating those as residual gaps, not findings for this wave.

## Test Coverage Assessment

- Body auto mapping is covered. `runtime-export-auto-mapping.test.ts:12` asserts all 11 slots, preserving the existing nine head/eyes/mouth slots and adding `body-x` / `body-z`; `runtime-export-auto-mapping.test.ts:77` and `:85` assert Body X/Z defaults.
- Body target alias coverage is adequate. `runtime-export-auto-mapping.test.ts:97` covers Body X by display name and Body Z by parameter id alias, while the first test covers project preset aliases.
- Existing mapping filters are preserved. `runtime-export-auto-mapping.test.ts:127` covers computed, hidden, read-only, non-external, and manifest-excluded targets; `:194`, `:199`, and `:204` confirm missing body targets do not collapse the existing nine non-body slots.
- Runtime frame generation coverage is adequate. `runtime-parameter-frame.test.ts:156` covers Body X and Body Z from calibrated head rotation plus head position.
- Component tuning coverage is adequate. `runtime-parameter-frame.test.ts:194` covers Body Z rotation/position strengths and inversion.
- Clamping and finite output coverage is adequate. `runtime-parameter-frame.test.ts:225` covers oversized body inputs/strengths and finite emitted values.
- Missing data behavior is covered for the important Wave6 path. `runtime-parameter-frame.test.ts:122` covers missing/non-finite source values generally, and `:255` proves missing head position calibration still allows head/mouth output and Body Z rotation output.
- Smoothing and deterministic reset are covered at the state/value level. `runtime-parameter-frame.test.ts:284` proves lagged output and `RuntimePlayerBodyFollowState.reset()` behavior.
- Input disconnect stale-frame prevention is covered. `input-session-state.test.ts:120` proves `setIdle()` clears the latest live-rate tracking frame and copied raw frame.
- Reset hook source coverage is adequate. `runtime-player-main.ts:33`, `:42`, `:61`, `:67`, and `:74` reset body follow on input/profile/export changes; `model-mapping-bridge-handlers.ts:114` and `:124` reset on auto-map and slot updates.
- Request validation source coverage is adequate for this lane. `model-mapping-bridge-request-validation.ts:21` through `:36` reads the new body fields; `:82` through `:109` bounds finite strengths and smoothing. There is no dedicated validation test file for these new fields.
- UI body control source coverage is adequate for this lane. `mapping-page.tsx:235`, `:309`, and `:359` render body rows and Body X/Z sliders/toggles; `:496` through `:519` adds the Body group. There is no React interaction test for this UI.
- Stage/raw-data boundary is source-reviewed. `model-mapping-bridge-handlers.ts:49` through `:75` reads the latest tracking frame only in main and publishes a `RuntimePlayerLiveParameterFrame`; `live-parameter-bridge-handlers.ts:21` through `:28` sends only that frame or a clear event to Stage.

## Commands Reviewed Or Run

No `pnpm install` was run.

Reviewer-run focused tests:

```text
pnpm.cmd exec vitest run -c vitest.config.ts src/main/live-mapping/runtime-export-auto-mapping.test.ts src/main/live-mapping/runtime-parameter-frame.test.ts src/main/input-session-state.test.ts
```

Result:

- Sandbox run failed before tests with `Error: spawn EPERM` while starting esbuild.
- Escalated rerun passed: 3 files / 18 tests.

Reviewer-run Runtime Player typecheck:

```text
pnpm.cmd typecheck
```

Result: pass.

Reviewer-run Runtime Player unit suite:

```text
pnpm.cmd test:unit
```

Result: pass, 26 files / 114 tests.

Reviewer-run guards:

```text
node scripts/check-source-organization.mjs
node scripts/check-dependencies.mjs
git diff --check -- apps/runtime-player/src discussion/runtime-player/implementation/waves/wave6 discussion/runtime-player/implementation/reviews/wave6
```

Results:

- Source organization guard: pass.
- Dependency guard: pass.
- Whitespace check: pass, with Git LF-to-CRLF working-copy warnings only.

Gnome-reported evidence is consistent with reviewer-run results: focused tests, typecheck, unit suite, source organization guard, dependency guard, and whitespace check were all reported passing after the same sandbox `spawn EPERM` pattern for Vitest.

## Remaining Test / Manual Verification Gaps

- No React component/interaction test directly clicks the new Mapping Page Body controls. Source and typecheck are sufficient for this wave, but manual Control Window inspection remains required.
- No dedicated test directly asserts `readMappingSlotUpdateRequest()` accepts/rejects the new body control fields. Source review and downstream focused tests are sufficient for this wave.
- No real Electron Runtime Player manual verification was performed in this review context.
- No real iFacialMocap plus Runtime Export with authored `Body Angle X` / `Body Angle Z` keyforms was verified in this review context.
- Default Body X/Z strengths and lag are source/test validated but still need real-device visual tuning.

## User-Decision Points

None blocking for Domain B.

Future decisions after manual testing:

- Whether to adjust default Body X strength, Body Z rotation/position strengths, or lag.
- Whether to add persistent Model Mapping Profile storage for Body Follow controls in a later wave.
- Whether the next wave should add explicit React/IPC validation tests for Mapping Page body controls.
