# Runtime Player Waves 1–23 integration audit

> Audit basis: `audit-contract.md`, pinned HEAD `3c3669eefcc375c62d1ec6b4d77a000d7cbbb61c` (2026-08-08, Asia/Tokyo). This file is the only file written by this slice; existing maps, source, tests, and plans were not changed.

## 1. Scope and checked maps

The Runtime Player evidence slices were integrated from `30-runtime-player-waves-001-012.md`, `31-runtime-player-waves-013-023.md`, `42-render-performance-and-dynamics.md`, `50-ai-cohost.md`, and the mechanical inventory `01-mechanical-inventory.md`. The seven assigned current/index maps were checked directly:

- `discussion/runtime-player/_map.md`
- `discussion/runtime-player/architecture/_map.md`
- `discussion/runtime-player/backlog/_map.md`
- `discussion/runtime-player/implementation/_map.md`
- `discussion/runtime-player/implementation/orchestration/_map.md`
- `discussion/runtime-player/research/_map.md`
- `discussion/runtime-player/screens/_map.md`

Wave child maps checked for status reconciliation: `waves/wave11`, `reviews/wave11`, `waves/wave16`, `reviews/wave16`, `waves/wave18`, `waves/wave19`, `waves/wave20`, `waves/wave21`, and `reviews/wave21`. Wave22/23 reports, reviews, plans, and final reports were checked; the four expected Wave22/23 `_map.md` files are absent.

## 2. Exact parent-map verdicts

| Map | Kind | Verdict | Adjudication |
|---|---|---|---|
| `discussion/runtime-player/_map.md` | `living-current-state` + index | **Partially stale** | Wave11 is still labelled “pending clean review” (`:67`) although its final clean review is `pass`; the current summary stops at Wave21 (`:75-77`) and has no Wave22/23 route. The broad manual list (`:106-107`) also mixes superseded W19 cadence wording with still-open product gates. |
| `discussion/runtime-player/architecture/_map.md` | `living-current-state` | **Partially stale** | Stage/window lifecycle, loader validation, and Wave4 scope are left as open questions (`:45-50`) although Waves7/8/12 delivered them. The accepted process/IPC/sanitized-transport boundaries (`:20-34`) remain valid. |
| `discussion/runtime-player/backlog/_map.md` | `living-index` | **Current** | The map correctly indexes the one backlog artifact and defines status usage (`:11-29`). Its child contains an obsolete active item (3.5), so the child must be corrected before any parent-map change; that child defect does not make this index itself stale. |
| `discussion/runtime-player/implementation/_map.md` | `living-current-state` + index | **Partially stale** | Wave16 remains “pending final clean review” (`:38`, `:101`, `:106`, `:317`) despite `reviews/wave16/_map.md:13-24` and `wave16-final-clean-integration-review.md` being `pass`. W18/W19 contain both pending/manual and closed comparison language (`:328-338`). W21 correctly remains Domain A/B pass with Domain C pending (`:43`); W22/23 implementation/review files are indexed as rows (`:123-126`, `:242-245`) but their child `_map.md` indexes do not exist. |
| `discussion/runtime-player/implementation/orchestration/_map.md` | `living-index` | **Stale** | It stops at Wave21 (`:19-29`), leaves W11 and W16 in obsolete pending states, and has no Wave22/23 plan rows. The later-wave child omission is a missing current index, not merely historical wording; the earlier W1–12 “partial” assessment is therefore escalated to `Stale`. |
| `discussion/runtime-player/research/_map.md` | `living-current-state` | **Partially stale** | Its files/status and current basis stop at Wave10 (`:9-22`) while W11 Stage Motion, W12 Variant, W13–19 diagnostics, W20 lifecycle, W21 dynamics, and W22/23 lipsync now exist. The manual OBS/iFacial checks remain legitimate, but the map needs a current-vs-human-gate split. |
| `discussion/runtime-player/screens/_map.md` | `living-current-state` + index | **Partially stale** | Navigation and Wave21 Dynamics Tune facts are current (`:9-16`, `:25-45`), but Performance Diagnostics still carries the old W16 deep-capture/manual wording (`:17`) and no W22/23 lipsync gate route. The detailed initial-screen artifact also has superseded close-hide/routes/open-question prose. |

**Verdict count: Current 1 / Partially stale 5 / Stale 1 / Intentionally historical 0 / Unverifiable 0.**

## 3. Replacement current state

### 3.1 Deterministic implementation pass

- Waves 1–15 and 17–20 have source/domain reports and clean reviews at pass. W11’s final clean review is explicitly `verdict: pass` (`discussion/runtime-player/implementation/reviews/wave11/runtime-player-wave11-final-integration-review.md:1-10`), so its child map’s “Pending Review-Sylph” marker is residue.
- Wave16 Domains A–D, Domain E final integration, and follow-up proof-diagnostics review are pass (`discussion/runtime-player/implementation/reviews/wave16/_map.md:13-24`). The remaining deep-capture item is a manual/product evidence gate, not a final-review blocker.
- Wave18 intentionally removed product deep-profiling transport. Normal product diagnostics are lightweight live-health/FPS/connection/fast-path proof; evaluator-internal `runtimeCoreProfiling: "deep"` remains developer/test-only (`discussion/runtime-player/implementation/waves/wave18/wave18-final-integration-report.md:54-58,83-88`; current evaluator defaults are `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts:55-70,131-162`).
- Wave19 source/tests/reviews pass. The parent’s later comparison records Chrome/Edge near-60 FPS applied/render versus lower OBS/CEF cadence (`discussion/runtime-player/implementation/_map.md:332-338`). Tracked logs at commit `233db42` are objective evidence, not a benchmark with platform metadata: `tmp/report.log` has live 57.2 / applied-render 40.1 / Browser rAF 40.1 (`tmp/report.log:54-62`), `tmp/chrome-report.log` has 59.9 / 56.7 / 83.7 (`tmp/chrome-report.log:54-62`), and `tmp/native-stage.log` has 60.1 / 50.4 (`tmp/native-stage.log:18-24`).
- Wave20 source/domain/review closeout is pass for its allowed scope. Current lifecycle is Control close → `requestQuit()` and Stage close (`apps/runtime-player/src/main/window-management/control-window-recovery.ts:86-93`); direct Stage close publishes “Stage unavailable” and `Focus Stage` recreates it (`apps/runtime-player/src/main/stage-view-bridge-handlers.ts:104-116,347-400`). A packaged/dev Electron smoke is still unperformed.
- Wave21 is **Domain A/B pass; Domain C pending**. `waves/wave21/_map.md:18-20` and `reviews/wave21/_map.md:25-28` say final Electron/OBS parity remains; no `waves/wave21/wave21-final-integration-report.md` exists. The three final review files pass, but `reviews/wave21/_map.md:79` records that they were not indexed.
- Wave22 and Wave23 are **source/test/review pass** with no child map indexes. W22 clean review independently reran typecheck and 34 focused tests (`discussion/runtime-player/implementation/reviews/wave22/wave22-final-clean-integration-review.md:12-16`); W23 reran typecheck and 38 focused tests, while the full unit result is 479 passed / 2 pre-existing browser-source failures (`.../reviews/wave23/wave23-final-clean-integration-review.md:18-27`).

### 3.2 Human/device/product gates (not implied by implementation pass)

| Gate | Status and evidence |
|---|---|
| W11 real iFacialMocap near/far calibration, Stage Motion direction/tuning, Browser Source parity, restart persistence | **Pending** (`waves/wave11/_map.md:26-33`). |
| W13–19 OBS product confidence | Objective logs and a user OBS-vs-Chrome/Edge cadence observation exist, but logs lack platform/URL provenance and do not prove alpha, WebGL2 visual parity, real-model motion, or subjective smoothness. Keep those residual product checks explicit; do not claim a universal 60 FPS requirement. |
| W20 lifecycle | **Pending** packaged `.exe` or dev Electron smoke: Control close exits, direct Stage close leaves Control alive, `Focus Stage` reopens, and restore/regression behavior (`waves/wave20/_map.md:24-32`). |
| W21 Dynamics Tune | **Pending** real Runtime Export + iFacialMocap Native Stage/Browser Source parity, persistence, different-export isolation, reset, and artifact immutability checks (`reviews/wave21/wave21-final-test-docs-manual-check-review.md:53-79`). |
| W22 mouth-open coupling | **Pending** real iFacialMocap + vowel-rigged model check for closed-vowel over-closing, transition discontinuity, and whether unsmoothed `w` steps are acceptable (`waves/wave22/wave22-final-integration-report.md:61`). |
| W23 shape blend | **Pending** real speech check for transition form-stutter, “e” parasitism, and “u” jitter; this decides whether smoothing/other deferred waves are warranted (`waves/wave23/wave23-final-integration-report.md:72-73`). |

### 3.3 C7 and AI-cohost boundary

C7 is an accepted **human visual closure**, not a performance benchmark: both Browser Sources were alive in OBS (`discussion/ai-cohost/implementation/orchestration/c7-closure-record.md:6-15`). The user’s “two instances feel heavy” observation is explicitly unmeasured and C7 performance work is out of scope (`:17-21`). Therefore Runtime Player maps must not turn C7 into a scheduled optimization or expose deep profiling through product IPC/Browser Source. A new two-instance CPU/GPU/FPS experiment, target hardware, and developer-only profiling authorization require a separate user decision. The AI-cohost boundary remains that C7 is closed in `ai-cohost`; any optional performance reopen belongs in render-performance/runtime-player evidence, not in the C/S implementation status.

## 4. Information-kind separation

- **Repository facts:** source lifecycle and transport anchors above; child report/review presence; typecheck/focused-test results; tracked log values and commit `233db42`.
- **Design/policy decisions:** Electron main-owned input, sanitized model-only Browser Source boundary (`discussion/runtime-player/architecture/_map.md:20-34`); Wave18 no product deep-profiler transport; C7 performance out of scope.
- **Experiment/manual observations:** user Wave7 restore checks (`discussion/runtime-player/_map.md:47-52`), C7 two-body OBS visibility, and the later OBS/Chrome/Edge cadence comparison. They are not substitutes for a reproducible benchmark or complete product-confidence sweep.
- **Unresolved/user decisions:** whether to reopen C7 load measurement, when to run W20/W21 Electron/OBS checks, and whether W22/W23 vowel behavior warrants smoothing or other follow-up.
- **Official/external facts:** existing iFacialMocap/OBS links in `research/` were not revalidated on the web during this audit.

## 5. Prioritized child-before-parent correction inventory

The following order obeys the audit contract: repair missing/incorrect child indexes and evidence labels before changing parent maps.

### P0 — child/index blockers (13 corrections)

1. **C01** Create `implementation/waves/wave22/_map.md` indexing Domain A and final integration report; preserve “source pass / real-device gate pending.”
2. **C02** Create `implementation/reviews/wave22/_map.md` indexing Domain A and clean review; preserve clean-pass and human-gate distinction.
3. **C03** Create `implementation/waves/wave23/_map.md` with the same pass/manual-gate split.
4. **C04** Create `implementation/reviews/wave23/_map.md` with the same pass/manual-gate split and pre-existing full-suite-failure caveat.
5. **C05** Update `implementation/reviews/wave21/_map.md`: index the three final review files (`wave21-final-design-development-regression-review.md`, `wave21-final-spec-completion-review.md`, `wave21-final-test-docs-manual-check-review.md`) and state that no final integration report exists, so Domain C remains pending (`:79`).
6. **C06** Update `implementation/reviews/wave11/_map.md:12-18` from “Pending Review-Sylph” to the existing final-review `pass`; retain real-device/OBS gaps.
7. **C07** Update `implementation/waves/wave16/_map.md:13-25` from pending/in-progress review wording to pass; retain only the real Runtime Export/iFacial/OBS deep-capture item as a human evidence gate. (The linked review map already records pass.)
8. **C08** Reconcile `implementation/waves/wave18/_map.md:28` with the later W19 evidence: distinguish objective capture from subjective/visual product confidence and remove any implication that product deep profiling is a next action.
9. **C09** Reconcile `implementation/waves/wave19/_map.md:28-39` and its final report’s manual-pending wording with the recorded OBS/Chrome/Edge comparison and tracked logs; retain provenance and residual alpha/visual/product checks.
10. **C10** Update `screens/performance-diagnostics.md:7,194-218` to record W19 cadence comparison as bounded historical observation, while keeping no-60-FPS guarantee and remaining real-model/OBS gates explicit.
11. **C11** Relabel `backlog/runtime-player-backlog.md:158-167` item 3.5 from a deferred unimplemented feature to implementation-complete W4–W6 with remaining real-device verification; do not route planning back to already-built adapter/mapping code.
12. **C12** Historical-label `screens/initial-runtime-player-screen.md:231,252,263-267` (close-hide, W5-only navigation, and pre-Wave7/8 open questions); route current readers to the current lifecycle/navigation maps.
13. **C13** Update `research/broadcast-capture-paths.md:7,13,80-87` status from “through W9/W10, cadence pending” to “implementation through W19; cadence comparison recorded; alpha/WebGL2/real-model product checks still pending.”

### P1 — parent-map updates after child repairs (6 corrections)

14. **P01** Update `discussion/runtime-player/_map.md`: add W22/23 routes and current lipsync facts; replace W11/W16 pending-review language; split objective performance logs/user cadence observation from still-open Electron, OBS, iFacial, dynamics, and vowel gates; update next navigation beyond W21.
15. **P02** Update `discussion/runtime-player/implementation/_map.md`: close W16 review status, reconcile W18/W19 performance wording, retain W20 lifecycle and W21 Domain C pending, and link new W22/23 child maps rather than only direct report files.
16. **P03** Update `discussion/runtime-player/implementation/orchestration/_map.md`: add Wave22/23 plans and statuses; correct W11 and W16 stale pending labels; keep W20 manual lifecycle and W21 Domain C statuses.
17. **P04** Update `discussion/runtime-player/architecture/_map.md`: historical-label delivered Stage/window/loader/Wave4 questions and add current lifecycle, sanitized transport, Runtime Dynamics Tune ownership, and Wave18 profiling boundary as reads.
18. **P05** Update `discussion/runtime-player/research/_map.md`: extend current basis/index through W19/W23 evidence, link bounded logs, and separate remaining manual OBS/iFacial/vowel checks from implementation facts.
19. **P06** Update `discussion/runtime-player/screens/_map.md`: correct W16 deep-profile wording, add W22/23 lipsync gate links, and route historical initial-screen prose to its child artifact; keep W21 Dynamics Tune manual checks pending.

**Correction inventory count: 13 child/index corrections + 6 parent-map corrections = 19 total.** `backlog/_map.md` itself requires no parent edit after C11; its verdict remains `Current`.

## 6. Not verified in this audit

- No new Electron GUI, packaged executable, OBS, iPhone/iFacialMocap, real vowel-rig, or two-instance CPU/GPU measurement was performed.
- No new full-suite rerun was treated as acceptance. W23’s two browser-source failures remain the review’s pre-existing classification until a separately authorized baseline rerun.
- Existing external URLs and protocol claims were not revalidated against current vendor documentation.
