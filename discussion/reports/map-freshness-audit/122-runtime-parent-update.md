# Runtime Player Runtime-Parent Map Update

> Owner: Runtime Player parent maps. Evidence basis: `map-update-contract.md`, `113-runtime-leaf-map-update.md`, `61-runtime-player-integration.md`, `42-render-performance-and-dynamics.md`, `50-ai-cohost.md`, and `90-root-map-integration.md`. Audit HEAD: `3c3669eefcc375c62d1ec6b4d77a000d7cbbb61c`.

## Scope and counts

| Result | Count | Paths |
|---|---:|---|
| Changed | 7 | `runtime-player/_map.md`, `architecture/_map.md`, `backlog/_map.md`, `implementation/_map.md`, `implementation/orchestration/_map.md`, `research/_map.md`, `screens/_map.md` |
| Created | 1 | This report |
| Intentionally unchanged | 0 | No assigned parent map was skipped |
| Child/source/test files edited | 0 | Wave/review leaf maps were preserved after the child-first pass; no product artifacts were touched |

## Claims reconciled

- Wave22/23 plans, report indexes, and review indexes are now reachable from the runtime-player root, implementation parent, and orchestration map. Their deterministic source/typecheck/focused-test reviews remain `pass`; real iFacialMocap + vowel-rig speech behavior remains a separate gate.
- Wave11 and Wave16 stale pending-review wording was replaced with final pass plus explicit real-device/OBS confidence gates. Wave21 remains **Domain A/B pass; Domain C pending**, with no invented final integration report.
- Waves13–20 implementation/diagnostics status is separated from product evidence: Wave18 lightweight diagnostics and no-product-deep-profiler boundary are current; Wave19 OBS/Chrome/Edge and Native Stage captures are bounded objective evidence; Wave20 lifecycle implementation is pass while packaged/dev Electron smoke remains pending.
- Runtime Player maps now state the current privacy/transport boundary: sanitized model-only Browser Source, Native Stage local preview/fallback, and runtime-core deep profiling developer/test-only after Wave18.
- Architecture open questions that Waves7/8/12 and Wave4 already delivered are historicalized. Backlog, research, and screens next steps route to current manual gates instead of reopening implemented adapters or product deep profiling.
- The AI-cohost/C7 boundary is preserved: C7 is an accepted human visual closure, not a measured performance benchmark or an automatic Runtime Player optimization queue. Any two-instance load experiment requires a separate decision and belongs to render-performance/runtime-player evidence.

## Decisions and gates preserved

- Wave21 Domain C parity, persistence, reset, export-isolation, and artifact-immutability checks remain pending.
- Real OBS/CEF alpha/WebGL2/model parity, real iFacialMocap motion, Dynamics Tune/Stage Motion/Variant parity, and packaged/dev Electron lifecycle remain human/device/product gates.
- Wave22 keeps unsmoothed winner-intensity mouth-open coupling; Wave23 keeps normalized vowel shape blend and deferred smoothing/τ/curve follow-ups until real speech is observed.
- Spout2, OBS automation/source creation, input auto-connect, Runtime Export format changes, Editor changes, and product deep-profiler transport remain out of scope.
- Historical close-hide wording in detailed screen/backlog artifacts is not silently rewritten by this parent pass; those child artifacts require their assigned leaf owner if a separate correction is authorized.

## Verification

- Relative-link resolver over the seven assigned maps plus this report: **`checked=380 bad=0`**.
- `git diff --check -- discussion/runtime-player/...`: no whitespace errors (only expected LF→CRLF normalization warnings).
- Leaf evidence basis remains **46** Wave/review child maps, including the newly created Wave22/23 indexes from the leaf-owner pass.
- No Electron GUI, packaged executable, OBS, iPhone/iFacialMocap, real vowel-rig, or two-instance CPU/GPU benchmark was run in this parent update.

## Remaining issues outside ownership

- `discussion/runtime-player/backlog/runtime-player-backlog.md`, `screens/initial-runtime-player-screen.md`, `screens/performance-diagnostics.md`, and `research/broadcast-capture-paths.md` contain detailed historical prose beyond this parent-map ownership; their current parent routes now identify the remaining gates.
- Root `discussion/_map.md`, render-performance, AI-cohost, and reports parent maps require their own owner updates after this child-first parent pass.
- External iFacialMocap/OBS URLs and protocol claims were not revalidated on the web during this repository-only audit.
