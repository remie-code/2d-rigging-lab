# Runtime Player Wave6 Final Clean Integration Review

> Target: `runtime-player-wave6-final-integration-clean-review`  
> Reviewer lane: final clean integration review  
> Verdict: `pass`  
> Date: 2026-06-23

## Orchestration Separation Note

Orch-Sylph自身は実装担当ではない。source implementation は必ず別コンテキストの Gnome に委譲し、レビューは必ず別コンテキストの Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。

This review remained read-only for source/tests/docs except this artifact and the Wave6 review map status update.

## Scope Reviewed

Reviewed the Wave6 source-of-truth documents, Domain A/B reports, Domain C final integration report, all six Domain A/B review lanes, Wave6 maps, related Runtime Player maps/screens/backlog, and the requested source/test files directly.

Key source areas inspected:

- Input profile document/parser, calibration sections/start/session, request validation, bridge handlers, and session neutral handling.
- Body semantic slots, auto mapping, live mapping state, Body Follow state, runtime parameter frame generation, request validation, reset hooks, and bridge handlers.
- Preload live/model/input contracts and Stage boundary files, including the Stage renderer and runtime-core evaluation path.

## Findings

No blocking or needs-change findings.

Evidence:

- Domain A and Domain B reports exist and declare pass: `discussion/runtime-player/implementation/waves/wave6/runtime-player-wave6-domain-a-input-profile-position-calibration-report.md`, `discussion/runtime-player/implementation/waves/wave6/runtime-player-wave6-domain-b-body-auto-mapping-live-follow-report.md`.
- All six Domain A/B review lanes exist and declare pass under `discussion/runtime-player/implementation/reviews/wave6/`.
- Existing profiles without head position calibration remain usable. `headPositionRaw` is optional during parse, and old profiles omit it instead of failing: `apps/runtime-player/src/main/input-profiles/input-profile-document-parser.ts:146`, `apps/runtime-player/src/main/input-profiles/input-profile-document-parser.ts:164`. Section readiness marks only head position missing when the optional section is absent: `apps/runtime-player/src/main/input-profiles/input-profile-calibration-sections.ts:57`, `apps/runtime-player/src/main/input-profiles/input-profile-calibration-sections.ts:68`.
- Missing-only and head-position-only recalibration preserve old profile data. Missing-only selects only the head-position prompts for saved profiles missing that section: `apps/runtime-player/src/main/input-profiles/input-profile-calibration-start.ts:93`, `apps/runtime-player/src/main/input-profiles/input-profile-calibration-start.ts:114`. The update path merges the new `headPositionRaw` into the existing calibration without replacing head/eyes/mouth data: `apps/runtime-player/src/main/input-profiles/input-profile-calibration-session.ts:407`.
- Body Auto Mapping preserves the existing nine Wave5 head/eyes/mouth slots and appends Body X/Z only: `apps/runtime-player/src/main/live-mapping/semantic-slot-definitions.ts:38`, `apps/runtime-player/src/main/live-mapping/semantic-slot-definitions.ts:135`, `apps/runtime-player/src/main/live-mapping/semantic-slot-definitions.ts:147`. Direct target filtering still excludes non-authored, computed, hidden, read-only, and non-external targets: `apps/runtime-player/src/main/live-mapping/runtime-export-auto-mapping.ts:52`.
- Body X and Body Z are generated in main through sanitized live parameter frames. Non-finite values are skipped and emitted values are clamped before publication: `apps/runtime-player/src/main/live-mapping/runtime-parameter-frame.ts:28`, `apps/runtime-player/src/main/live-mapping/runtime-parameter-frame.ts:50`, `apps/runtime-player/src/main/live-mapping/runtime-parameter-frame.ts:54`. Body X uses calibrated head horizontal input: `apps/runtime-player/src/main/live-mapping/runtime-parameter-frame.ts:281`. Body Z combines rotation and optional position components: `apps/runtime-player/src/main/live-mapping/runtime-parameter-frame.ts:312`, `apps/runtime-player/src/main/live-mapping/runtime-parameter-frame.ts:373`.
- Body Z degrades safely when head position input/calibration is missing. The position component returns `null` when `head.positionRaw`, `calibration.headPositionRaw`, or its learned sign is absent, while rotation can still contribute: `apps/runtime-player/src/main/live-mapping/runtime-parameter-frame.ts:379`, `apps/runtime-player/src/main/live-mapping/runtime-parameter-frame.ts:383`.
- Body Follow smoothing reset hooks cover the required paths. Main resets on input reset, profile/calibration/Look Forward path, runtime export changing/loaded/cleared: `apps/runtime-player/src/main/runtime-player-main.ts:30`, `apps/runtime-player/src/main/runtime-player-main.ts:38`, `apps/runtime-player/src/main/runtime-player-main.ts:58`. Mapping auto-regeneration and slot updates reset body state: `apps/runtime-player/src/main/model-mapping-bridge-handlers.ts:104`, `apps/runtime-player/src/main/model-mapping-bridge-handlers.ts:118`. Connect/reconnect and disconnect invoke input reset, and disconnect/listening transitions clear stale latest frames: `apps/runtime-player/src/main/input-bridge-handlers.ts:81`, `apps/runtime-player/src/main/input-bridge-handlers.ts:123`, `apps/runtime-player/src/main/input-session-state.ts:147`, `apps/runtime-player/src/main/input-session-state.ts:192`.
- Stage remains model-only and receives no raw tracking/head-position/debug body data. The live frame contract contains runtime export identity, sequence/timestamps, and `parameterValues` only: `apps/runtime-player/src/preload/live-parameter-bridge-contract.ts:1`. Stage passes only `liveFrame.parameterValues` to runtime-core authored parameter evaluation: `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:209`, `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts:58`. Boundary tests assert Stage has no raw tracking input/debug/setup surface: `apps/runtime-player/src/runtime-player-boundary.test.ts:26`, `apps/runtime-player/src/runtime-player-boundary.test.ts:38`.
- Forbidden Wave6 scope was not found in source or docs as implemented behavior. Searches did not find accidental Body Angle Y mapping, Stage Motion from head position, near/far Stage scale/translation, Broadcast/OBS UX, TCP/VMC/OSC transport, persistent Model Mapping Profile save/read, advanced curve editor, or Stage debug UI. The reviewed docs keep those as future/out of scope, for example `discussion/runtime-player/screens/tracking-setup-live-mapping.md:420` and `discussion/runtime-player/backlog/runtime-player-backlog.md:220`.
- Related docs/maps no longer present Body Follow v0 as merely future/planned. They document Wave6 implementation facts and keep only final clean review/manual visual verification as remaining gates: `discussion/runtime-player/_map.md:41`, `discussion/runtime-player/implementation/_map.md:121`, `discussion/runtime-player/screens/_map.md:23`, `discussion/runtime-player/screens/tracking-setup-live-mapping.md:407`, `discussion/runtime-player/backlog/runtime-player-backlog.md:186`.

## Verification Performed

No `pnpm install` was run.

Commands run:

```text
pnpm.cmd typecheck
```

Result from `apps/runtime-player`: pass.

```text
pnpm.cmd exec vitest run -c vitest.config.ts src/main/input-profiles/input-profile-document-parser.test.ts src/main/input-profiles/input-profile-calibration-sections.test.ts src/main/input-profiles/input-profile-calibration-start.test.ts src/main/input-profiles/input-profile-calibration-session.test.ts src/main/input-profile-bridge-request-validation.test.ts src/main/input-look-forward-session-neutral.test.ts src/main/live-mapping/runtime-export-auto-mapping.test.ts src/main/live-mapping/runtime-parameter-frame.test.ts src/main/input-session-state.test.ts
```

Result from `apps/runtime-player`:

- Sandboxed run failed before tests with esbuild `Error: spawn EPERM`.
- Escalated rerun passed: 9 files / 42 tests.

```text
pnpm.cmd test:unit
```

Result from `apps/runtime-player`:

- Sandboxed run failed before tests with esbuild `Error: spawn EPERM`.
- Escalated rerun passed: 26 files / 114 tests.

```text
node scripts/check-source-organization.mjs
node scripts/check-dependencies.mjs
git diff --check -- apps/runtime-player/src discussion/runtime-player
git status --short -uall
```

Results:

- Source organization guard: pass.
- Dependency guard: pass.
- Scoped whitespace check: pass, with Git LF-to-CRLF working-copy warnings only.
- Worktree status shows the expected Wave6 source/docs/review additions and pre-existing `test_data/iFaceMocap/*.json` samples; no package manifest/lockfile changes were present.

I also relied on the existing Domain A/B reports and six Domain A/B review artifacts for lane-specific source/test evidence, then spot-checked the implementation directly rather than trusting reports alone.

## Remaining Manual Verification Needs

- Launch Electron Runtime Player and inspect Input Profile section readiness plus missing-only / head-position-only calibration controls.
- Inspect Mapping page Body group, Body X controls, and Body Z rotation/position controls in the live Control Window.
- Load a Runtime Export with authored `Body Angle X` / `Body Angle Z` keyforms.
- Connect real iFacialMocap input and verify clean Stage body motion.
- Confirm existing face / eyes / mouth motion remains active with body slots present or missing.
- Confirm Stage stays model-only during Body Follow and shows no setup/debug/raw tracking body UI.
- Tune Body X/Z default strengths and lag if real-device visual evidence shows the defaults feel wrong.

## User Decision Points

None blocking Wave6 source/test/docs pass.

Future planning decisions:

- Whether to adjust Body X strength, Body Z rotation strength, Body Z position strength, or lag after real-device visual testing.
- Whether Body Follow settings should later become part of a persistent Model Mapping Profile.
- When to plan Stage Motion from head position, near/far distance response, Stage window placement/capture controls, or Broadcast/OBS UX.
- Whether to add React/IPC interaction tests for Mapping page Body controls in a later hardening wave.

## Files Changed By This Review

- `discussion/runtime-player/implementation/reviews/wave6/runtime-player-wave6-final-clean-integration-review.md`
- `discussion/runtime-player/implementation/reviews/wave6/_map.md`
