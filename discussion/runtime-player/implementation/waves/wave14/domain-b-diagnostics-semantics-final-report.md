# Wave14 Domain B Diagnostics Semantics Final Report

- Domain: Diagnostics Semantics Cleanup
- Orchestrator: Orch-Sylph
- Verdict: pass
- Date: 2026-06-26

Orch-Sylph自身は実装担当ではない。source implementation は必ず別コンテキストの Gnome に委譲し、レビューは必ず別コンテキストの Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。

## Result

Domain B passed after one implementation pass and one clean Review-Sylph review. No fix loop was required.

## Source Files Changed By Gnome

- `apps/runtime-player/src/control/performance-diagnostics-report.ts`
- `apps/runtime-player/src/control/performance-diagnostics-report.test.ts`
- `apps/runtime-player/src/control/performance-diagnostics-page.tsx`
- `apps/runtime-player/src/control/browser-source-output-panel.tsx`
- `apps/runtime-player/src/control/stage-page.browser-source.test.ts`

## Report And Review Artifacts

- Implementation report: `discussion/runtime-player/implementation/waves/wave14/domain-b-diagnostics-semantics-implementation-report.md`
- Clean review record: `discussion/runtime-player/implementation/reviews/wave14/domain-b-diagnostics-semantics-clean-review.md`
- Final domain report: `discussion/runtime-player/implementation/waves/wave14/domain-b-diagnostics-semantics-final-report.md`

## Semantics Confirmed

- `[Input]` reports `inputReceiveFpsLatest` and `inputPacketCount`.
- Target sections distinguish `liveFrameMessageFps/count`, `appliedLiveFrameFps/count`, and `renderFps/count`.
- Browser Source source timestamp FPS remains available as `liveFrameSourceTimestampFpsLatest`.
- Browser Source source timestamp FPS is no longer labeled as raw input receive FPS.
- Performance Diagnostics UI and Browser Source Output panel labels avoid the old misleading `Source FPS` wording.
- Reports remain compact, readable, and privacy-safe.

## Verification

- Focused Vitest:
  - sandbox attempt failed before tests with `spawn EPERM`;
  - elevated rerun passed: 3 files / 12 tests.
- `pnpm.cmd typecheck`: passed.
- `node scripts/check-source-organization.mjs`: passed.
- `git diff --check` for Domain B files: passed with CRLF normalization warnings only.
- `pnpm install` was not run.

## Review Result

Review-Sylph verdict: pass.

Covered lanes:

- design/development compliance;
- test adequacy.

Reviewer confirmed no blocking findings. Reviewer also checked the applied/evaluated FPS derivation and found no escalation needed because `liveRenderInputEvaluationDurationSampleCount` increments where pending live frames are evaluated/applied in the normal rAF path.

## Residual Risks

- Electron visual QA was not run.
- Real OBS Browser Source capture was not run.
- Variant-switch captures may include immediate re-evaluation in the applied count, so steady-state FPS analysis should be interpreted separately from capture windows that include Variant transitions.
- Concurrent Domain A stage renderer/runtime-evaluation changes exist in the worktree and were not modified by Domain B.
