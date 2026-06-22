# Runtime Player Wave6 Domain A Test Adequacy Re-Review

> Target: `runtime-player-wave6-input-profile-position-calibration`  
> Lane: Test Adequacy Re-Review  
> Verdict: `pass`

## Scope Reviewed

This re-review only checked the narrow fix for the two prior Test Adequacy findings.

Basis / report:

- `discussion/runtime-player/implementation/waves/wave6/runtime-player-wave6-domain-a-input-profile-position-calibration-report.md`

Fix files reviewed:

- `apps/runtime-player/src/main/input-profiles/input-profile-calibration-sections.ts`
- `apps/runtime-player/src/main/input-profiles/input-profile-document-parser.ts`
- `apps/runtime-player/src/main/input-profiles/input-profile-document-parser.test.ts`
- `apps/runtime-player/src/main/input-profiles/input-profile-calibration-sections.test.ts`
- `apps/runtime-player/src/main/input-profiles/input-profile-calibration-start.test.ts`

## Prior Findings

### Finding 1: Incomplete/malformed `headPositionRaw.learnedSigns` readiness

Status: resolved.

Evidence:

- `apps/runtime-player/src/main/input-profiles/input-profile-calibration-sections.ts:59` now derives head-position section readiness from `isInputProfileHeadPositionCalibrationReady`.
- `apps/runtime-player/src/main/input-profiles/input-profile-calibration-sections.ts:68` requires finite neutral/min/max and usable `bodyLeft` plus `bodyRight` learned signs.
- `apps/runtime-player/src/main/input-profiles/input-profile-document-parser.ts:255` now returns `null` for present but incomplete/invalid head-position calibration.
- `apps/runtime-player/src/main/input-profiles/input-profile-document-parser.test.ts:94` covers missing learned signs.
- `apps/runtime-player/src/main/input-profiles/input-profile-document-parser.test.ts:118` covers invalid learned signs.
- `apps/runtime-player/src/main/input-profiles/input-profile-calibration-sections.test.ts` covers incomplete in-memory head position as `missing` and complete signs as `ready`.

Assessment:

- The parser now rejects/skips present but incomplete/invalid `headPositionRaw` signs.
- Section status no longer marks incomplete in-memory `headPositionRaw` as `Ready`.
- This satisfies the Domain B readiness concern from the prior review.

### Finding 2: Old-profile head-position update persistence

Status: resolved.

Evidence:

- `apps/runtime-player/src/main/input-profiles/input-profile-calibration-start.test.ts:114` adds a store-level old-profile upgrade test.
- The test exercises missing-only session start, records the head-position prompts, creates the updated profile, saves it through `InputProfileStore.saveProfile`, and reads the persisted JSON.
- `apps/runtime-player/src/main/input-profiles/input-profile-calibration-start.test.ts:162` asserts the active profile remains `profile_desk`.
- `apps/runtime-player/src/main/input-profiles/input-profile-calibration-start.test.ts:168` asserts the original `createdAtIso` is preserved.
- `apps/runtime-player/src/main/input-profiles/input-profile-calibration-start.test.ts:171` through `:176` assert existing head/eyes/mouth calibration is preserved and `headPositionRaw` is persisted.

Assessment:

- The test is not a full Electron IPC handler test, but it covers the requested store/finish-like persistence path sufficiently for this lane.
- It proves old saved profiles can add head position without profile replacement or full recreation.

## Verification Commands Run

No `pnpm install` was run.

Focused Runtime Player Vitest:

```text
pnpm.cmd exec vitest run -c vitest.config.ts src/main/input-profiles/input-profile-document-parser.test.ts src/main/input-profiles/input-profile-calibration-sections.test.ts src/main/input-profiles/input-profile-calibration-start.test.ts src/main/input-profiles/input-profile-calibration-session.test.ts src/main/input-profile-bridge-request-validation.test.ts src/main/input-look-forward-session-neutral.test.ts
```

Result: pass, 6 files / 24 tests.

Runtime Player typecheck:

```text
pnpm.cmd typecheck
```

Result: pass.

Runtime Player package unit suite:

```text
pnpm.cmd test:unit
```

Result: pass, 26 files / 107 tests.

Note: Vitest commands were run with escalated execution because this workspace previously hit sandbox `spawn EPERM` during esbuild service startup.

## Remaining Gaps

- Real Electron Control Window interaction was not manually verified in this re-review.
- Real iFacialMocap head-position calibration was not manually recorded in this re-review.
- There is still no React component test for the Input Profile section row button wiring, but the prior blocking behavior risks are now covered by pure/store-level tests.

## User-Decision Points

None for this test lane.

## Domain B Start Statement

From this lane's perspective, Domain B can start. The prior Test Adequacy blockers are resolved and the focused/typecheck/unit verification passes.
