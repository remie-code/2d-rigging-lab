# Runtime Player Wave5 Domain B Test Adequacy Review

## verdict

pass

## scope reviewed

- Domain B focused tests:
  - `apps/runtime-player/src/main/live-mapping/runtime-export-auto-mapping.test.ts`
  - `apps/runtime-player/src/main/live-mapping/runtime-parameter-frame.test.ts`
  - `apps/runtime-player/src/stage/stage-renderer/stage-live-parameter-frame-match.test.ts`
  - `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts`
  - `apps/runtime-player/src/stage/stage-renderer/runtime-export-stage-scene.test.ts`
  - `apps/runtime-player/src/runtime-player-boundary.test.ts`
- Domain B source under:
  - `apps/runtime-player/src/main/live-mapping/**`
  - `apps/runtime-player/src/main/live-parameter-bridge-handlers.ts`
  - `apps/runtime-player/src/main/model-mapping-bridge-handlers.ts`
  - `apps/runtime-player/src/main/model-mapping-bridge-request-validation.ts`
  - `apps/runtime-player/src/main/runtime-player-main.ts`
  - `apps/runtime-player/src/preload/*mapping*`
  - `apps/runtime-player/src/preload/*live-parameter*`
  - `apps/runtime-player/src/preload/runtime-player-stage-bridge*.ts`
  - `apps/runtime-player/src/preload/stage-preload.ts`
  - `apps/runtime-player/src/stage/runtime-evaluation/**`
  - `apps/runtime-player/src/stage/stage-renderer/**`
  - `apps/runtime-player/src/stage/stage-window-app.tsx`
- Current git status for changed/new Runtime Player and Wave5 review/report files.

## basis documents used

- `discussion/runtime-player/implementation/orchestration/player-wave5-plan.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/runtime-player/architecture/runtime-player-development-policy.md`
- `discussion/runtime-player/implementation/waves/wave5/runtime-player-wave5-domain-a-control-input-profile-calibration-report.md`

## findings

### Blocking

None.

### Needs Changes

None.

## re-review result after fixes

The previous test-adequacy gaps are now covered by focused tests and source-reviewed call sites.

1. Auto Mapping target exclusion is adequate.

   `runtime-export-auto-mapping.test.ts` now includes alias-matching targets that must not be selected:

   - `runtimeRole: "runtime-internal"` with `externalInput: false`
   - authored non-external target with `externalInput: false`
   - computed, hidden, read-only, and manifest-excluded targets

   This directly locks the source filter in `runtime-export-auto-mapping.ts`, which requires `runtimeRole === "external-input"`, `externalInput === true`, `valueSource === "authoredInput"`, manifest inclusion, and no computed/hidden/read-only flags.

2. Runtime parameter frame generation coverage is adequate.

   `runtime-parameter-frame.test.ts` now covers:

   - finite sanitized output from tracking frame, session neutral, profile, and mapping slots
   - invert, strength, disabled slots, and target clamps
   - custom learned signs and non-default profile ranges
   - missing head/gaze values, non-finite blendshape values, and invalid zero-width calibration ranges being skipped without leaking invalid output

   This directly exercises the important null/skip paths in `runtime-parameter-frame.ts` while preserving the required sanitized `RuntimePlayerLiveParameterFrame` contract.

3. Stage stale/not-loaded live parameter boundary coverage is adequate.

   `stage-live-parameter-frame-match.test.ts` now verifies that live parameter frames are rejected when no Runtime Export payload is loaded and when any Runtime Export identity component is stale:

   - `packageId`
   - `packageRevision`
   - `loadedAtIso`

   Source review confirms `static-stage-canvas-renderer.ts` uses `canApplyLiveParameterFrame` in both `setLiveParameterFrame` and the live render path, so the focused predicate test covers the Stage not-loaded/stale identity boundary.

4. Stage minimal preload contract coverage is adequate.

   `runtime-player-boundary.test.ts` now asserts the Stage uses `window.runtimePlayerStage`, uses a separate stage preload path, does not use the Control API, and keeps Stage bridge sources away from input/profile/mapping APIs, diagnostics copy APIs, raw tracking terms, and blendshape data. This matches the Wave5 boundary requirement that Stage receives minimal runtime payload and live parameter data, not setup/debug/raw tracking surfaces.

## coverage assessment

- Mapping semantic slots: adequate. Required slots are asserted, and missing-target behavior is covered.
- Mapping target exclusion: adequate. Computed, hidden, read-only, manifest-excluded, `runtime-internal`, and authored non-external targets are covered.
- Parameter frame generation: adequate. Sanitized output, controls, clamps, learned signs/ranges, missing data, non-finite input, and invalid ranges are covered.
- Main-to-Stage live frame contract: adequate by source review plus focused frame-generation and bridge-boundary tests. Stage receives `RuntimePlayerLiveParameterFrame`, not `TrackingFrame` or raw diagnostics.
- Stage runtime-core evaluation: adequate. Existing tests verify authored parameter values reach runtime-core evaluation and alter evaluated render input.
- Stage stale/not-loaded boundary: adequate. Focused predicate test covers payload absence and stale Runtime Export identity, and source review confirms the renderer uses that predicate.
- Process/preload boundary tests: adequate for static regression coverage against raw Node/Electron access in renderers, debug/setup UI in Stage, raw tracking in Stage, broad Control API exposure to Stage, and React imports from main.

## verification performed in this re-review

- `pnpm.cmd exec vitest run -c vitest.config.ts src/main/live-mapping/runtime-export-auto-mapping.test.ts src/main/live-mapping/runtime-parameter-frame.test.ts src/stage/stage-renderer/stage-live-parameter-frame-match.test.ts src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts src/stage/stage-renderer/runtime-export-stage-scene.test.ts src/runtime-player-boundary.test.ts`
  - Passed: 6 test files, 22 tests.
  - Run from `apps/runtime-player`.
  - Run with escalation because the prior focused Vitest attempt had failed in sandbox with esbuild `spawn EPERM`.

Known parent verification after the fixes:

- Focused Vitest: pass, 6 files / 22 tests.
- `pnpm.cmd typecheck`: pass.
- `pnpm.cmd build`: pass, emitted both `preload.mjs` and `stage-preload.mjs`.
- `pnpm.cmd test:unit`: pass, 23 files / 90 tests.
- Source organization guard: pass.
- Dependency guard: pass.
- Diff check: only LF/CRLF warnings.

`pnpm install` was not run.

## remaining verification

No additional automated test changes are required for Domain B test adequacy.

Manual verification still remains for Wave5 final closeout:

- Real iFacialMocap input moves a loaded Runtime Export model visually on the clean Stage Window.
- Stage remains model-only during live motion: no debug overlay, raw tracking text, sliders, or setup UI.
- Runtime Export reload/clear does not leave stale live pose state on Stage.

## user-decision points

None.
