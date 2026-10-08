# Runtime Player Wave18 Final Spec / Completion Review

- date: 2026-06-26
- lane: spec / completion compliance
- reviewer: Review-Sylph
- verdict: `pass`

## Findings

No blocking findings.

Closeout note:

- `post_review_closeout_needed`: no. Closeout was rechecked after final review lane completion; this artifact is listed as `Pass`, the Wave18 report map shows final `Pass`, and the final integration report includes the final review results table.

## Scope

Reviewed Wave18 Domain C final integration for spec/completion compliance only:

- Whether the final report covers Domain C scope from `player-wave18-plan.md`.
- Whether required wording and manual check instructions are present.
- Whether Domains A-B and their review lanes are represented accurately.
- Whether docs/maps avoid overclaiming real OBS Browser Source smoothness as manually verified.
- Whether final docs/report accurately describe Wave18 as lightweight Live Health / FPS / connection / fast-path proof, not a product deep profiler.
- Whether source/test diff evidence supports product Start Capture deep-profiling removal, product Stage / Browser Source transport removal, internal developer/test profiling allowance, and no out-of-scope package/schema/editor changes.

## Basis Files Reviewed

- `discussion/runtime-player/implementation/orchestration/player-wave18-plan.md`
- `discussion/runtime-player/implementation/waves/wave18/domain-a-product-diagnostics-simplification-report.md`
- `discussion/runtime-player/implementation/waves/wave18/domain-b-product-profiling-transport-removal-report.md`
- `discussion/runtime-player/implementation/reviews/wave18/domain-a-spec-compliance-review.md`
- `discussion/runtime-player/implementation/reviews/wave18/domain-a-design-development-compliance-review.md`
- `discussion/runtime-player/implementation/reviews/wave18/domain-a-test-adequacy-review.md`
- `discussion/runtime-player/implementation/reviews/wave18/domain-b-spec-compliance-review.md`
- `discussion/runtime-player/implementation/reviews/wave18/domain-b-design-development-compliance-review.md`
- `discussion/runtime-player/implementation/reviews/wave18/domain-b-test-adequacy-review.md`
- `discussion/runtime-player/implementation/waves/wave18/wave18-final-integration-report.md`
- `discussion/runtime-player/screens/performance-diagnostics.md`
- `discussion/runtime-player/_map.md`
- `discussion/runtime-player/implementation/_map.md`
- `discussion/runtime-player/implementation/waves/wave18/_map.md`
- `discussion/runtime-player/implementation/reviews/wave18/_map.md`
- `discussion/runtime-player/implementation/orchestration/runtime-player-wave-planning-conventions.md`
- `discussion/_conventions.md`

## Changed Files / Diff Inspected

- Inspected `git diff --stat -- apps/runtime-player/src`: current Runtime Player source/test diff is 40 files, 238 insertions, 1734 deletions.
- Inspected targeted source diffs for Control diagnostics/report, Stage IPC/preload/window, Browser Source HTTP/WS/session/client protocol, metrics validation/contract, renderer counters, and evaluator profiling options.
- Inspected tracked docs diff and current untracked Wave18 docs/review-map contents for:
  - `discussion/runtime-player/screens/performance-diagnostics.md`
  - `discussion/runtime-player/_map.md`
  - `discussion/runtime-player/implementation/_map.md`
  - `discussion/runtime-player/implementation/waves/wave18/_map.md`
  - `discussion/runtime-player/implementation/reviews/wave18/_map.md`
  - `discussion/runtime-player/implementation/waves/wave18/wave18-final-integration-report.md`
- Scope guard inspected with `git diff --name-only -- package.json pnpm-lock.yaml pnpm-workspace.yaml apps/editor packages/package-format packages/runtime-core` and `git status --short -uall -- ...`; both returned no output.

## Compliance Checks

- Domain C final report coverage: pass. The final report explicitly covers docs/maps alignment and no source/package/editor/schema/dependency work at `discussion/runtime-player/implementation/waves/wave18/wave18-final-integration-report.md:10` and `:14`, then lists every required final integration check at `:44` through `:53`.
- Required exact wording: pass. The final report contains exactly `実装事実に合わせて関連ドキュメントを更新する。` at `discussion/runtime-player/implementation/waves/wave18/wave18-final-integration-report.md:12`.
- Domains A-B pass representation and lane separation: pass. The final report lists Domain A and Domain B with separate spec compliance, design/development compliance, and test adequacy lanes at `discussion/runtime-player/implementation/waves/wave18/wave18-final-integration-report.md:35` through `:40`. The review map lists all six A/B lane artifacts and pass states at `discussion/runtime-player/implementation/reviews/wave18/_map.md:9` through `:24`.
- Manual OBS Browser Source instructions: pass. The final report asks the user to open Runtime Player with a real Runtime Export, connect iFacialMocap, connect OBS Browser Source, run Browser Source or Both Performance Diagnostics, confirm capture no longer visibly degrades smoothness, check lightweight report fields, and save `tmp/report.log` if needed at `discussion/runtime-player/implementation/waves/wave18/wave18-final-integration-report.md:98` through `:113`.
- No overclaim of real OBS smoothness: pass. The final report says real OBS Browser Source smoothness is manually unverified and not proven until the manual check at `discussion/runtime-player/implementation/waves/wave18/wave18-final-integration-report.md:100` and `:116`. The screen doc says manual checks are still pending and must not be recorded as passed until executed at `discussion/runtime-player/screens/performance-diagnostics.md:168` through `:183`. Runtime Player maps also retain pending/unverified wording at `discussion/runtime-player/_map.md:103` and `discussion/runtime-player/implementation/_map.md:293`.
- Lightweight diagnostics, not a product deep profiler: pass. The final report states Performance Diagnostics is lightweight Live Health / FPS / connection / fast-path proof, not a product deep profiler, at `discussion/runtime-player/implementation/waves/wave18/wave18-final-integration-report.md:44`. The screen doc states the same product responsibility/boundary at `discussion/runtime-player/screens/performance-diagnostics.md:25`, `:52`, `:83`, `:116`, and `:123`. Source report formatting emits `diagnosticScope: live-health-fps-connection-fast-path` at `apps/runtime-player/src/control/performance-diagnostics-report.ts:274`.
- Product Start Capture no longer enables deep profiling: pass. `PerformanceDiagnosticsPage` no longer accepts `onSetRuntimeCoreProfiling`; `startCapture`, `finishCapture`, and `clearCapture` manage capture state without profiling requests at `apps/runtime-player/src/control/performance-diagnostics-page.tsx:135`, `:166`, and `:194`. `control-window-app.tsx` now passes only `onCopyReport` into `PerformanceDiagnosticsPage` at `apps/runtime-player/src/control/control-window-app.tsx:869`.
- Product Stage profiling transport removed: pass. Stage bridge channels now expose render metrics/status/actions but no profiling channels at `apps/runtime-player/src/preload/stage-view-bridge-channels.ts:1` through `:18`; the Stage reporter contract exposes `reportRenderMetrics` but no `getRuntimeCoreProfiling` / profiling subscription at `apps/runtime-player/src/preload/runtime-player-stage-bridge-contract.ts:37`; main Stage handlers register status/state/render metrics handlers without profiling mode handlers at `apps/runtime-player/src/main/stage-view-bridge-handlers.ts:90` through `:125`.
- Product Browser Source profiling transport removed: pass. Runtime export responses no longer include profiling state at `apps/runtime-player/src/main/broadcast-source/browser-source-runtime-export-payload.ts:63`. The Browser Source message union starts at `apps/runtime-player/src/preload/browser-source-transport-contract.ts:47` and contains no `runtime-core-profiling-changed` variant; resync sends Runtime Export, frame, display, and Variant state without profiling at `apps/runtime-player/src/main/broadcast-source/browser-source-session.ts:472`. Targeted `rg` found no product `RuntimePlayerRuntimeCoreProfilingMode`, `runtime-core-profiling-changed`, `runtimeCoreProfiling`, `lastRuntimeCore*`, or `runtimeCore.*Duration` matches in the product report/contract/session/client files searched.
- Cheap proof counters and internal developer/test profiling allowance: pass. `publicSnapshotMaterializationCount` is carried directly in the Runtime Player evaluator profile at `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts:47`, records `1` for snapshot and `0` for render-frame at `:118` and `:172`, is forwarded through evaluated render input at `apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts:149`, and is accumulated from the lightweight profile at `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:776`. The remaining `runtimeCoreProfiling?: "disabled" | "deep"` option is local evaluator developer/test surface at `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts:65`, matching the Wave18 allowance and no longer product-reachable through Control, Stage IPC, Browser Source HTTP/WS, or Browser Source client handling.
- Product report deep runtime-core phase timing removal: pass. `PerformanceDiagnosticsTargetReport` keeps lightweight counters at `apps/runtime-player/src/control/performance-diagnostics-report.ts:76` through `:82`; copied report formatting prints fast-path counters and runtime instance cache counters at `apps/runtime-player/src/control/performance-diagnostics-report.ts:909` through `:929`. Targeted `rg` returned no product report/contract/session/client matches for `lastRuntimeCore`, `runtimeCore.*Duration`, or product `runtimeModelCompileDurationMs` output in the searched product files.
- No Runtime Export / Editor / package-format / dependency / lockfile changes: pass. The final report represents this at `discussion/runtime-player/implementation/waves/wave18/wave18-final-integration-report.md:50` through `:53`, `:85`, `:94`, and `:96`. My independent scope guard commands returned no diff or untracked changes under `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `apps/editor`, `packages/package-format`, or `packages/runtime-core`.

## Verification Commands Performed

```text
Get-Content -Encoding UTF8 C:\Users\remie\.codex\skills\discussion-management\SKILL.md
Get-Content -Encoding UTF8 discussion/_conventions.md
rg --files discussion/runtime-player/implementation/reviews/wave18
git status --short -uall
git diff --name-only -- apps/runtime-player/src discussion/runtime-player/screens/performance-diagnostics.md discussion/runtime-player/_map.md discussion/runtime-player/implementation/_map.md discussion/runtime-player/implementation/waves/wave18/_map.md discussion/runtime-player/implementation/reviews/wave18/_map.md discussion/runtime-player/implementation/waves/wave18/wave18-final-integration-report.md package.json pnpm-lock.yaml pnpm-workspace.yaml apps/editor packages/package-format packages/runtime-core
Get-Content -Encoding UTF8 <all basis files listed above>
git diff --stat -- apps/runtime-player/src
git diff --unified=12 -- <targeted Control / Stage / Browser Source / metrics source groups>
rg -n "requestCaptureRuntimeCoreProfiling|onSetRuntimeCoreProfiling|setRuntimeCoreProfiling|getRuntimeCoreProfiling|onRuntimeCoreProfilingChanged|runtime-core-profiling-changed|RuntimePlayerRuntimeCoreProfilingMode|runtimeCoreProfiling" apps/runtime-player/src
rg -n "実装事実に合わせて関連ドキュメントを更新する。|Manual User Check|manual|OBS Browser Source|no longer visibly degrades|visibly degrades|smoothness|未完|pending|not proven|not be recorded as passed|manual real-model" discussion/runtime-player/implementation/waves/wave18/wave18-final-integration-report.md discussion/runtime-player/screens/performance-diagnostics.md discussion/runtime-player/_map.md discussion/runtime-player/implementation/_map.md discussion/runtime-player/implementation/waves/wave18/_map.md discussion/runtime-player/implementation/reviews/wave18/_map.md
rg -n "deep profiler|deep runtime-core|Live Health|live-health-fps-connection-fast-path|product deep profiler|lightweight" discussion/runtime-player/implementation/waves/wave18/wave18-final-integration-report.md discussion/runtime-player/screens/performance-diagnostics.md discussion/runtime-player/_map.md discussion/runtime-player/implementation/_map.md discussion/runtime-player/implementation/waves/wave18/_map.md
rg -n "Domain A|Domain B|spec compliance|Design / development|Test adequacy|pass" discussion/runtime-player/implementation/waves/wave18/wave18-final-integration-report.md discussion/runtime-player/implementation/reviews/wave18/_map.md discussion/runtime-player/implementation/waves/wave18/_map.md
rg -n "Runtime Export format|Editor|package-format|dependencies|lockfile|pnpm install|runtime-core internal|developer/test profiling|Start Capture|Stage / Browser Source profiling transport|publicSnapshotMaterializationCount" discussion/runtime-player/implementation/waves/wave18/wave18-final-integration-report.md discussion/runtime-player/screens/performance-diagnostics.md discussion/runtime-player/_map.md discussion/runtime-player/implementation/_map.md discussion/runtime-player/implementation/waves/wave18/_map.md
git diff --check -- apps/runtime-player/src discussion/runtime-player/screens/performance-diagnostics.md discussion/runtime-player/_map.md discussion/runtime-player/implementation/_map.md
git diff --name-only -- package.json pnpm-lock.yaml pnpm-workspace.yaml apps/editor packages/package-format packages/runtime-core
git status --short -uall -- package.json pnpm-lock.yaml pnpm-workspace.yaml apps/editor packages/package-format packages/runtime-core
```

Results:

- `git diff --check` reported no whitespace errors; only LF/CRLF working-copy warnings.
- Package/schema/editor/runtime-core scope guard commands returned no output.
- I did not run `pnpm install`.
- I did not rerun Vitest or typecheck in this lane; source verification for this spec/completion review used direct diff/search inspection plus the already-reviewed Domain A/B report evidence.

## Residual Risks / User-Decision Points

- Real OBS Browser Source smoothness remains manually unverified until the user runs the Browser Source or Both Performance Diagnostics path with a real Runtime Export, live iFacialMocap input, and OBS Browser Source.
- If the manual check still shows visible Browser Source smoothness degradation, the next user decision is whether to target renderer upload/draw cost, deformer vertex transform cost, frame scheduling, or OBS Browser Source settings, using the lightweight copied report as evidence.
- No additional spec/completion decision is required for Wave18 Domain C based on this lane.

## post_review_closeout_needed

no

Closeout recheck addendum, 2026-06-26:

- Read `discussion/runtime-player/implementation/reviews/wave18/_map.md`: `wave18-final-spec-completion-review.md` is listed with `Pass`, alongside the other final review lanes.
- Read `discussion/runtime-player/implementation/waves/wave18/_map.md`: `wave18-final-integration-report.md` is listed with final `Pass`, and final Review-Sylph lanes are complete with `pass`.
- Read `discussion/runtime-player/implementation/waves/wave18/wave18-final-integration-report.md`: the report now has `Verdict: pass` and a `Final Review Results` table listing this lane as `pass`.
- Closeout verified: yes.
