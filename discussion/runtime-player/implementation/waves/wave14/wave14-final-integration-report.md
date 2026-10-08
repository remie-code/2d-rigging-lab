# Runtime Player Wave14 Final Integration Report

- Domain: Final Integration / Docs Alignment
- Agent: Gnome
- Verdict: pass
- Date: 2026-06-26

Orch-Sylph自身は実装担当ではない。source implementation は必ず別コンテキストの Gnome に委譲し、レビューは必ず別コンテキストの Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。

## Status

Docs/maps integration for Wave14 is complete, and final clean integration review passed.

Final clean integration review: [../../reviews/wave14/wave14-final-clean-integration-review.md](../../reviews/wave14/wave14-final-clean-integration-review.md). Review-Sylph verdict is `pass` with no blocking findings and no source/docs behavior fix required.

## Source Facts

Domain A runtime evaluation cache:

- Report: [domain-a-runtime-evaluation-cache-report.md](domain-a-runtime-evaluation-cache-report.md)
- Clean review: [../../reviews/wave14/domain-a-runtime-evaluation-cache-clean-review.md](../../reviews/wave14/domain-a-runtime-evaluation-cache-clean-review.md)
- Verdict: pass.
- Implemented renderer-owned caching for invariant Runtime Export evaluation scaffolding shared through `StaticStageCanvasRenderer`, so Native Stage and Browser Source use the same cache-capable path.

Domain B diagnostics semantics cleanup:

- Implementation report: [domain-b-diagnostics-semantics-implementation-report.md](domain-b-diagnostics-semantics-implementation-report.md)
- Domain final report: [domain-b-diagnostics-semantics-final-report.md](domain-b-diagnostics-semantics-final-report.md)
- Clean review: [../../reviews/wave14/domain-b-diagnostics-semantics-clean-review.md](../../reviews/wave14/domain-b-diagnostics-semantics-clean-review.md)
- Verdict: pass.
- Updated Performance Diagnostics report/UI terminology so input receive, delivered live frames, applied/evaluated frames, render frames, and Browser Source source timestamp intervals are distinct.

## Cache Boundary Confirmation

Cached invariant data:

- normalized runtime graph adapter result;
- render scaffold / texture source data;
- texture page decode/source signatures;
- model bounds;
- drawable render template data;
- clipping data;
- stable drawable index map.

Not cached:

- `RuntimeSnapshotDto`;
- `RuntimeStateDto`;
- dynamics previous/next state;
- authored values;
- live parameter values;
- evaluated vertices;
- evaluated opacity;
- evaluated draw order;
- evaluated visibility;
- keyform samples.

The cache key includes Runtime Export identity and semantic active Variant selection. Variant timestamp-only changes are excluded. Runtime Export reload, clear, dispose, texture/source changes, and semantic Variant selection changes invalidate or switch cache entries. Live parameter values, frame index, delta time, dynamics state, and Stage view/display transform do not invalidate the cache.

## Diagnostics Semantics Confirmation

Performance Diagnostics now uses these report terms:

- `inputReceiveFpsLatest`
- `inputPacketCount`
- `liveFrameMessageFps`
- `liveFrameMessageCount`
- `appliedLiveFrameFps`
- `appliedLiveFrameCount`
- `renderFps`
- `renderCount`
- `liveFrameSourceTimestampFpsLatest`

`liveFrameSourceTimestampFpsLatest` is Browser Source source timestamp interval diagnostics. It must not be interpreted or labeled as raw input receive FPS.

## Privacy Boundary

Browser Source and copied reports remain sanitized. Wave14 does not expose:

- raw tracking frames;
- raw calibration internals;
- private file paths;
- Browser Source token values;
- full Runtime Export payloads;
- texture or mesh payload contents;
- Control-only debug/status objects.

Browser Source continues to receive Runtime Export payloads required for rendering plus sanitized live parameter frames and sanitized active Variant selection only.

## Preserved Behavior

- Wave10 local preview suspension remains preserved: Browser Source remains the primary broadcast path, and native local preview live rendering can be suspended while Browser Source clients are connected without stopping input processing, mapping, body follow, dynamics, Runtime Export state, Stage transform sync, or Browser Source rendering.
- Wave11 Stage Motion remains preserved: composed Stage transform behavior continues to apply without exposing raw tracking/head-position/calibration data to Browser Source.
- Wave12 Variant switching remains preserved: Native Stage and Browser Source share the session active Variant selection, and Browser Source receives sanitized active Variant selection only.

## Verification Cited From A/B

Domain A:

- Focused Vitest passed: 6 files / 33 tests.
- `pnpm.cmd typecheck`: passed.
- `node scripts/check-source-organization.mjs`: passed.
- `git diff --check` for Domain A files: passed with CRLF normalization warnings only.

Domain B:

- Focused Vitest passed: 3 files / 12 tests.
- `pnpm.cmd typecheck`: passed.
- `node scripts/check-source-organization.mjs`: passed.
- `git diff --check` for Domain B files: passed with CRLF normalization warnings only.

Domain C docs-only verification:

- `pnpm install` was not run.
- Manual Electron/native Stage visual QA was not run in Domain C.
- Manual OBS Browser Source QA was not run in Domain C.
- Final clean integration review passed: [../../reviews/wave14/wave14-final-clean-integration-review.md](../../reviews/wave14/wave14-final-clean-integration-review.md).

## Manual Check Instructions

Real-model manual Electron/OBS diagnostics still need user confirmation after Wave14.

Run this check after Wave14 closeout:

1. Open Runtime Player with the real Runtime Export.
2. Connect iFacialMocap.
3. Connect OBS Browser Source.
4. Run Performance Diagnostics with target `Both`.
5. Compare:
   - `inputReceiveFpsLatest`
   - `liveFrameMessageFps`
   - `appliedLiveFrameFps`
   - `renderFps`
   - `liveRenderInputEvaluationDurationMs`
   - `scheduledFrameDurationMs`
6. Confirm Native Stage local preview suspension still behaves correctly while Browser Source is connected.
7. Confirm Browser Source remains visible in OBS and model motion feels smoother.
8. Toggle Variant selection and confirm Native Stage / Browser Source parity.
9. Toggle Stage Motion and confirm left/right/depth offset behavior remains intact.
10. Confirm copied reports remain free of raw tracking, calibration, private path, token, and full Runtime Export payload data.

## Files Changed By Domain C

- `discussion/runtime-player/implementation/waves/wave14/_map.md`
- `discussion/runtime-player/implementation/waves/wave14/wave14-final-integration-report.md`
- `discussion/runtime-player/implementation/reviews/wave14/_map.md`
- `discussion/runtime-player/implementation/_map.md`
- `discussion/runtime-player/implementation/orchestration/_map.md`
- `discussion/runtime-player/_map.md`
- `discussion/runtime-player/screens/performance-diagnostics.md`

## Residual Risks / User Decision Points

- Real-model manual Electron/OBS diagnostics still need user confirmation after Wave14.
- Product confidence depends on a real capture showing reduced `liveRenderInputEvaluationDurationMs` and `scheduledFrameDurationMs` under the user's Runtime Export.
- No user decision is needed for the docs pass.
