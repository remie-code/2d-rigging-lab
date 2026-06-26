# Runtime Player Wave17 Final Test / Docs Review

- Verdict: pass
- Lane: Review-Sylph final test / verification / documentation adequacy
- Date: 2026-06-26
- Scope: Wave17 Domains A-D inherited verification, Domain E verification evidence, focused final checks, Performance Diagnostics documentation adequacy, and manual check wording.

## Findings

No blocking findings.

1. Inherited A-D verification is sufficient for the Wave17 final pass recommendation. The final integration report records all A-D report and three-lane review verdicts as pass at `discussion/runtime-player/implementation/waves/wave17/wave17-final-integration-report.md:30`, and summarizes the inherited focused verification at `discussion/runtime-player/implementation/waves/wave17/wave17-final-integration-report.md:97` through `discussion/runtime-player/implementation/waves/wave17/wave17-final-integration-report.md:100`. The review map independently lists A-D review lanes as pass at `discussion/runtime-player/implementation/reviews/wave17/_map.md:8` through `discussion/runtime-player/implementation/reviews/wave17/_map.md:19`.

2. Domain E verification coverage is adequate. The final report explicitly excludes source/test edits, Runtime Export format work, Editor work, package-format schema work, dependency work, lockfile work, and `pnpm install` at `discussion/runtime-player/implementation/waves/wave17/wave17-final-integration-report.md:14`. It records prohibited diff checks and docs whitespace checks at `discussion/runtime-player/implementation/waves/wave17/wave17-final-integration-report.md:103` through `discussion/runtime-player/implementation/waves/wave17/wave17-final-integration-report.md:116`. My reruns also found no package manifest, lockfile, Editor, or package-format diff output.

3. Focused tests cover the required behavior. Runtime-core parity/materialization/freshness coverage is in `packages/runtime-core/src/runtime-core.test.ts:579`, `packages/runtime-core/src/runtime-core.test.ts:835`, `packages/runtime-core/src/runtime-core.test.ts:836`, and `packages/runtime-core/src/runtime-core.test.ts:843`; nested warp fast-path parity is covered at `packages/runtime-core/src/rig-control-nested-warp-rest-bind-semantics.test.ts:46` and `packages/runtime-core/src/rig-control-nested-warp-rest-bind-semantics.test.ts:91`. Runtime Player fast-path connection and profile proof are covered by `apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts:110`, `apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts:112`, `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts:316`, `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts:342`, and `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts:346`. Target-local separation is covered at `apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.test.ts:90`, `apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.test.ts:185`, and `apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.test.ts:382`.

4. Diagnostics validation and copied report wording are covered. Metrics validation accepts legacy/new safe metrics and rejects malformed new counters at `apps/runtime-player/src/main/performance-diagnostics-metrics-validation.test.ts:12`, `apps/runtime-player/src/main/performance-diagnostics-metrics-validation.test.ts:178`, and `apps/runtime-player/src/main/performance-diagnostics-metrics-validation.test.ts:183`. Report tests assert render-frame scope wording, public snapshot materialization scope wording, render-frame output duration wording, compatibility source-field wording, unknown/sampleCount=0 behavior, and privacy exclusions at `apps/runtime-player/src/control/performance-diagnostics-report.test.ts:358` through `apps/runtime-player/src/control/performance-diagnostics-report.test.ts:376`, `apps/runtime-player/src/control/performance-diagnostics-report.test.ts:587`, `apps/runtime-player/src/control/performance-diagnostics-report.test.ts:633` through `apps/runtime-player/src/control/performance-diagnostics-report.test.ts:636`, and `apps/runtime-player/src/control/performance-diagnostics-report.test.ts:677`.

5. Manual check instructions are concrete and do not overclaim manual results. The final report requires a real Runtime Export, iFacialMocap, OBS Browser Source, Browser Source deep capture, copied report saved to `tmp/report.log`, before/after metric comparison, and copied-report privacy confirmation at `discussion/runtime-player/implementation/waves/wave17/wave17-final-integration-report.md:120` through `discussion/runtime-player/implementation/waves/wave17/wave17-final-integration-report.md:140`. The Performance Diagnostics doc keeps manual real-model OBS diagnostics pending at `discussion/runtime-player/screens/performance-diagnostics.md:7`, gives the detailed manual list at `discussion/runtime-player/screens/performance-diagnostics.md:176` through `discussion/runtime-player/screens/performance-diagnostics.md:194`, and says not to record those checks as passed until manually executed at `discussion/runtime-player/screens/performance-diagnostics.md:196`.

6. Performance Diagnostics docs explain the new metrics and remaining unknown/sampleCount=0 interpretation without overclaiming results. The docs introduce `compiledRenderFrameCount`, `publicSnapshotMaterializationCount`, and `runtimeCoreRenderFrameOutputDurationMs` at `discussion/runtime-player/screens/performance-diagnostics.md:101`, explain `sampleCount=0` / `unknown` at `discussion/runtime-player/screens/performance-diagnostics.md:119`, scope public snapshot path metrics separately from live render-frame metrics at `discussion/runtime-player/screens/performance-diagnostics.md:130` through `discussion/runtime-player/screens/performance-diagnostics.md:134`, and preserve report privacy exclusions at `discussion/runtime-player/screens/performance-diagnostics.md:150` through `discussion/runtime-player/screens/performance-diagnostics.md:162`.

## Verification Performed

- `pnpm.cmd typecheck` passed.
- `node scripts/check-source-organization.mjs` passed with `Source organization guard passed.`
- Focused Vitest initially failed in the sandbox with Vite/esbuild `spawn EPERM`; escalated rerun passed: 9 files / 113 tests.
- `git diff --check -- discussion/runtime-player/implementation/_map.md discussion/runtime-player/_map.md discussion/runtime-player/screens/performance-diagnostics.md discussion/runtime-player/backlog/runtime-player-backlog.md` produced no whitespace findings; only CRLF working-copy warnings.
- `git diff --check -- packages/runtime-core/src apps/runtime-player/src` produced no whitespace findings; only CRLF working-copy warnings.
- `git diff --no-index --check -- NUL` against the untracked Wave17 final report and Wave17 maps produced no whitespace findings; only normal no-index diff status and CRLF warnings.
- `git diff --name-only -- package.json pnpm-lock.yaml pnpm-workspace.yaml apps/editor packages/package-format` produced no output.
- I did not run `pnpm install`.

## Residual Risks / User-Decision Points

- Real OBS Browser Source smoothness is still unproven until the user captures a real-model Browser Source deep Performance Diagnostics report and saves it to `tmp/report.log`; the final report records this at `discussion/runtime-player/implementation/waves/wave17/wave17-final-integration-report.md:120` and `discussion/runtime-player/implementation/waves/wave17/wave17-final-integration-report.md:145`.
- A deep capture can legitimately report `unknown` / `sampleCount=0` if no deep-profiled live render-frame sample is observed; this is documented and should not be treated as a renderer failure by itself.
- If the real capture still shows low FPS after public snapshot bypass, the next decision should be based on the captured report: likely deformer vertex transform cost, render-frame vertex copy cost, or renderer upload/draw cost.
- Review map closeout after final review lanes is outside this lane because this task forbids editing maps.

## Recommendation

Pass the Wave17 final test/docs lane.
