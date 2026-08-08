# Runtime Player Runtime-Leaf Map Update

> Owner: Runtime Player leaf maps (`waves/**/_map.md`, `reviews/**/_map.md`).
> Evidence basis: `30-runtime-player-waves-001-012.md`, `31-runtime-player-waves-013-023.md`, `61-runtime-player-integration.md`, and `42-render-performance-and-dynamics.md`.
> Map-update contract: `map-update-contract.md`; audit HEAD `3c3669eefcc375c62d1ec6b4d77a000d7cbbb61c`.

## Scope and counts

All 46 Runtime Player leaf map paths now exist (waves 1–23 and reviews 1–23). I inspected the 42 pre-existing maps through the audit inventory and targeted current-wave reads, then applied the child/index corrections assigned to this owner.

| Result | Count | Paths |
|---|---:|---|
| Changed | 12 | Existing Wave11, 16, 18, 19, 20, and 21 maps in both `waves/` and `reviews/` (with Wave21 review indexing additions) |
| Created | 4 | `waves/wave22/_map.md`, `reviews/wave22/_map.md`, `waves/wave23/_map.md`, `reviews/wave23/_map.md` |
| Intentionally unchanged | 30 | Existing Wave1–10, Wave12–15, and Wave17 maps/reviews; their historical evidence remains valid |
| Parent maps edited | 0 | `runtime-player/`, implementation parent/orchestration, and other parent maps were outside this ownership slice |

Wave22/23 indexes were created only because each directory contains both a final report and a final clean review (plus a Domain A artifact/review).

## Claims corrected and evidence

### Wave11

- Replaced the report map's `Pass; pending clean review` with `Pass (final clean review pass)` and linked the existing final review evidence.
- Replaced the review map's `Pending Review-Sylph` marker with `Pass`; the review itself records `verdict: pass` and no blocking/major findings (`implementation/reviews/wave11/runtime-player-wave11-final-integration-review.md:1-10`).
- Preserved real iFacialMocap, Stage Motion tuning, OBS parity, restart, and native fallback checks as manual gates.

### Wave16

- Closed the report map's obsolete `pending final clean review` and `In progress` follow-up statuses. Both the final integration and follow-up clean review are already `pass` in `reviews/wave16/_map.md` and their artifacts.
- Reworded the remaining check as a real Runtime Export/iFacialMocap/OBS product-confidence gate. Tracked captures are objective-only; this does not reopen product deep profiling.

### Wave18

- Kept Domain A/B/final review statuses at `pass` while adding the evidence boundary: `tmp/report.log`, `tmp/native-stage.log`, and `tmp/chrome-report.log` are objective captures, not proof of subjective smoothness, alpha/WebGL2 parity, or real-model motion.
- Explicitly preserved the Wave18 decision that deep runtime-core profiling is developer/test-only and not exposed through product IPC, HTTP/WS, or Browser Source transport (`42-render-performance-and-dynamics.md`, `31-runtime-player-waves-013-023.md`).

### Wave19

- Replaced “manual cadence capture remains pending” wording with the bounded tracked comparison: `tmp/report.log` (57.2 live / 40.1 applied-render/rAF), `tmp/chrome-report.log` (59.9 / 56.7 / 83.7), and `tmp/native-stage.log` (60.1 / 50.4).
- Retained provenance and human-gate caveats: logs lack platform/URL metadata and do not establish subjective smoothness, alpha/WebGL2/model parity, real iFacialMocap behavior, or a universal 60 FPS guarantee.

### Wave20

- Preserved `pass` for the allowed implementation scope and made the current lifecycle explicit: normal Control close requests quit/process exit; direct Stage close remains recoverable via `Focus Stage`.
- Kept packaged/dev Electron smoke, reopen, Runtime Export restore, Browser Source, mapping/body follow, Stage Motion, Variant, suspension, and diagnostics as manual follow-up. Historical Wave8 close-hide wording remains historical/out of scope.

### Wave21

- Clarified that Domain A/B are pass but no `wave21-final-integration-report.md` exists; Domain C (Electron/OBS parity, persistence/reset/isolation/artifact checks) remains pending.
- Indexed the three extant final review files in `reviews/wave21/_map.md` and preserved their pass verdicts without promoting the parent gate.

### Waves22–23 (new leaf indexes)

- Wave22 indexes Domain A and final integration reports/reviews. It records source/test/review pass while keeping the real iFacialMocap + vowel-rig gate for closed-vowel over-closing, transition discontinuity, and unsmoothed `w` steps.
- Wave23 indexes Domain A and final integration reports/reviews. It records source/test/review pass, the 479 passed / 2 pre-existing browser-source full-unit caveat, and the real speech gate for transition smoothness, “e” parasitism, and “u” jitter.
- Neither index treats deterministic typecheck/focused tests as external product acceptance.

## Decisions and gates intentionally preserved

- Historical wave maps remain historical evidence; later waves do not rewrite earlier acceptance context.
- Wave21 remains `Domain A/B pass; Domain C pending`.
- Wave18's no-product-deep-profiler boundary and Wave19's bounded OBS/Chrome/Edge comparison are retained.
- Real iFacialMocap, real Runtime Export/vowel-rig, OBS/CEF visual confidence, and packaged/dev Electron checks remain human/device/product gates.
- Wave23's two browser-source full-suite failures remain classified as pre-existing; no new baseline rerun was performed.
- No parent/orchestration/root maps, source, tests, plans, or non-map artifacts were edited.

## Verification

Commands run from the repository root:

- `Get-ChildItem discussion/runtime-player/implementation/waves,discussion/runtime-player/implementation/reviews -Recurse -Filter _map.md` → **46 maps** after creation.
- Markdown relative-link resolver over all 46 maps → **`checked=46 bad=0`**.
- `git diff --check -- discussion/runtime-player/implementation/waves discussion/runtime-player/implementation/reviews` → no whitespace errors; only expected LF→CRLF normalization warnings.
- `git status --short -- discussion/runtime-player/implementation/waves discussion/runtime-player/implementation/reviews` → 12 modified maps and 4 untracked new maps, matching the counts above.

## Remaining issues outside ownership

- Parent current-state maps still require the Phase 2 owner updates described in `31-runtime-player-waves-013-023.md` and `61-runtime-player-integration.md` (Wave22/23 navigation, W16/W19 wording, current human-gate split).
- `screens/`, `research/`, `backlog/`, design, and orchestration plan artifacts are outside this leaf-map ownership; their stale wording is not changed here.
- No Electron GUI, OBS, iPhone/iFacialMocap, real vowel-rig, or two-instance performance run was performed.
