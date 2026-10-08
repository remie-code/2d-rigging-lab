# Root map freshness adjudication

> Audit point: Git `3c3669eefcc375c62d1ec6b4d77a000d7cbbb61c`, 2026-08-08 (Asia/Tokyo).
> This report is the final adjudication for `discussion/_map.md`; it does not edit
> `discussion/_map.md` or any existing map. Evidence is limited to reports `60`,
> `61`, `62`, and `01` unless a cited child report is needed to resolve a conflict.

## 1. Root role and overall verdict

`discussion/_map.md` is a **root living-current-state map plus living index**. It is
the short entry point for the Private 2D Rigging Lab / Prototype, the four-track
policy, top-level topic ownership, current-state pointers, next-action candidates,
and unresolved user decisions. It is not the place for wave-level evidence or a
complete implementation backlog.

**Overall verdict: Partially stale.** The Private baseline and the four-track
separation are current, and the accepted decision that the Editor mainline stops at
Wave102 remains valid. Several root rows and next actions still use pre-closeout
states, however: implementation still presents Wave53 as the latest baseline,
Runtime Player is indexed only through Wave1 at the root, the model-authoring and
AI-cohost rows stop before their current gates, Electron still has a pre-WS1 next
action, Expo says layout is not started despite six finished panels, and the reports
row does not distinguish archive evidence from current owners. These are root-entry
defects, not evidence that the underlying implementation waves failed.

The durable policy boundary is two-axis:

1. **Editor mainline baseline:** Wave102 is the user-declared planning stop. Keep
   this as an accepted decision.
2. **Specialized post-102 evidence:** Waves103–105 (model-authoring), Wave106
   (dynamics/schema), Wave107 (Runtime Player), and Wave108/109 (mesh/render data
   contract) are separately indexed bounded tracks. They do not reopen the Editor
   mainline unless the user re-authorizes it.

## 2. Root sections adjudicated

### 2.1 Positioning and current sources (`discussion/_map.md:7-18`)

The Private Prototype wording and four tracks are **Current** and must remain.
The source list at `:11` is authoritative for product scope and acceptance oracles,
but it is incomplete for current runtime semantics: schema/solver/cardinality is
owned by the accepted dynamics design and Wave106/source evidence. The refresh
should add that two-layer distinction without demoting the root AC as the product
requirement oracle. No policy reversal is implied.

### 2.2 Top-level directory table (`discussion/_map.md:27-46`)

| Root row | Verdict | Replacement truth and owner |
|---|---|---|
| `:31` concept | Current | Private baseline and four-track policy remain current; child `concept/` owns detailed scope history. |
| `:32` acceptance-criteria | Partially stale | Requirements remain the oracle, but old one-output/scalar dynamics text must be explicitly separated from the accepted profile-v2/dynamics-file-v3 semantics in design/Wave106. Child AC map first. |
| `:33` scenarios | Partially stale | Same requirement-vs-implementation distinction as AC; child scenarios map first, then root wording. |
| `:34` design | Partially stale | Root summary is safe, but child design/module-contract maps still contain old dynamics and “next WebGL/V4” wording. Child design maps first. |
| `:35` demo | Current with open gates | Demo policy exists; rights-clean fixture, final disclaimer, and UI wording/preflight checks remain user/legal gates. Child demo map owns detail. |
| `:36` proposal | Current | Template is present; first proposal draft/target remains open. Child proposal map owns detail. |
| `:37` development_convention | Current | P0/P1 and source-organization policy are the current convention; no root correction required. |
| `:38` implementation | **Partially stale** | Wave53 is not the latest implementation baseline. Use the accepted Wave102 mainline stop, repaired orchestration/index maps, and separate post-102 specialized entries. Child implementation parents first. |
| `:39` runtime-player | **Partially stale** | Current implementation reaches Wave23 source/test pass, while W21 Domain C and W11/W20/W22/W23 real-device/product gates remain. Runtime Player child maps first. |
| `:40` model-authoring | **Partially stale** | Equipment and closed-problem cycles 01–19 are complete; do not present 01-eyeball-x as the current “first” problem or automatically schedule closed problem 02. Child model-authoring maps first. |
| `:41` mesh-generation | **Partially stale** | v6D default + v7 comparison toggle and v6/v7 quality hold remain; Wave108/109 render/data contract is complete. Keep quality hold separate from contract completion. Child mesh/render maps first. |
| `:42` render-performance | **Partially stale** | Editor Perf Wave2 is accepted closed; Player Waves13–19 diagnostics/fast-path/cadence work is complete. C7 two-instance strain is an optional, unmeasured reopen, not a current “on hold” implementation. Child performance/runtime maps first. |
| `:43` editor-electron-migration | **Partially stale** | WS1–WS4 and packaging are complete. Remaining status is stale PSD E2E/task debt, independent typecheck/unit debt, and metadata warning; “WS1 not started” is false. Child Electron maps first. |
| `:44` ai-cohost | **Stale at root entry** | C1–C7器 is closed, S1–S8 code and S7/reading/interjection progress exist; remaining S8 kill, brain-swap, and stream-memory human gates must be indexed. Max 20x + Agent SDK is decided. The LLM/perception exception is `apps/soul` only; “repo-wide forbidden” is too broad. Child AI maps first. |
| `:45` expo | **Partially stale** | Six A2 HTML panels and six PDFs exist; state is “artifacts complete, acceptance externally unverified, proof print after acceptance,” not “layout unstarted.” Child Expo map first. |
| `:46` reports | **Partially stale** | Reports/Cubism maps remain private historical research archives. Current performance/runtime owners are `render-performance/` and runtime/design maps; archive links should point there without turning archive next actions into current work. Child archive maps first. |

### 2.3 Current-state summary (`discussion/_map.md:48-73`)

Rows `:52-62` are **Current** at the policy/convention level. The following
rows need correction or qualification:

| Root file:line | Stale/partial claim | Replacement truth | Evidence / destination ownership |
|---|---|---|---|
| `discussion/_map.md:63-65` | Wave102 is correctly named, but the text still advertises a Wave93 child-map cutoff and tells readers to trust a post-W80 capability/backlog pair. | Keep Wave102 as accepted Editor mainline stop; point current readers to repaired implementation/orchestration and specialized indexes. Mark capability/backlog as dated snapshots until refreshed. | `60-editor-integration.md:2-3,5`; `23-editor-waves-081-102.md:59-74`; child `implementation/_map.md`, `orchestration/_map.md`, `current-capability-map.md`, `remaining-work-backlog.md` first. |
| `discussion/_map.md:64` | “Current implementation work” omits bounded post-102 tracks and over-compresses Runtime Player/model-authoring status. | Editor mainline remains stopped; model-authoring and Runtime Player are active topic families, while Waves103–109 are specialized evidence, not Editor continuation. | `60-editor-integration.md:27-35`; `61-runtime-player-integration.md:36-51`; child implementation/runtime/model maps first. |
| `discussion/_map.md:66` | Runtime Player root summary routes only Wave1 research/plan artifacts. | Index Waves1–23 through current parent maps; state W21 Domain C plus W11/W20/W22/W23 real-device/product gates explicitly. | `61-runtime-player-integration.md:12-27,39-47`; child `runtime-player/` maps first. |
| `discussion/_map.md:68` | First closed problem is presented as the current authoring frontier. | Closed problems 01–19 and craft second cycle pass; next scope is user-selected, with PNG re-certification and strict-ref/sidecar portability gates. | `60-editor-integration.md:37-41`; `40-model-authoring.md:17-23,62-72`; child `model-authoring/_map.md` first. |
| `discussion/_map.md:69` | Mesh hold is valid but omits the completed Wave108/109 render/data contract. | Preserve v6/v7 quality hold and v6 deletion/Wave2 user gate; separately index non-clamp/gutter/LINEAR and atlasRuntime contract completion. | `60-editor-integration.md:50-55`; `41-mesh-and-rendering.md:87-105`; child mesh/design maps first. |
| `discussion/_map.md:70` | Perf row still starts at Perf Wave1 and presents `reports/editor-render-performance` as current investigation. | Editor Perf Wave2 is accepted closed; Player Waves13–19 diagnostics/cadence are complete; C7 is optional unmeasured; archive report is historical. | `60-editor-integration.md:59-61`; `42-render-performance-and-dynamics.md:31-38,64-70,87-107`; child performance/runtime maps first. |
| `discussion/_map.md:71` | Completion sentence is followed by obsolete “next packaging” wording. | WS1–WS4 and electron-builder packaging pass; retain stale PSD E2E, editor type/test debt, and metadata warning as residuals. | `60-editor-integration.md:69-72`; `43-editor-electron-migration.md:75-89`; child Electron maps first. |
| `discussion/_map.md:73` | AI row says S-series premises/access are unresolved and describes the exception too broadly. | C1–C7器 complete; S1–S8 implementation exists, S7/reading-interjection gates recorded, and S8/brain/stream-memory human gates remain. Max20x + Agent SDK is decided; LLM/perception is allowed only in `apps/soul`. | `62-cross-topic-integration.md:55-63`; `50-ai-cohost.md:3-7,30-48`; child AI maps first. |

### 2.4 Next actions (`discussion/_map.md:75-87`)

| Root file:line | Verdict | Replacement action/owner |
|---|---|---|
| `:77` | Partially stale | Use the repaired implementation/orchestration parent, Wave102 boundary, and specialized maps as basis. Do not treat the Wave54-era capability/backlog pair as current truth. Child implementation maps first. |
| `:78-84` | Current policy/routes | Retain four-track boundary, source-file policy, demo preflight, Future Public Clean Subset, mesh quality hold, and performance topic route; update the child links after child repairs. |
| `:85` | Partially stale | Route to current Runtime Player parent/research/screens maps and Wave22/23 gate indexes, not only Wave1 artifacts. Child Runtime Player maps first. |
| `:86` | Stale | Replace “first action WS1” with Electron residual E2E/typecheck/unit debt and packaging warning handling. Child Electron maps first. |
| `:87` | Stale | Replace “next S-series premises/S1” with S8 kill, brain-swap, stream-memory gates and persona/S9 voice decision. Child AI maps first. |

### 2.5 Unresolved questions (`discussion/_map.md:89-97`)

Rows `:93-96` remain valid. `:97` is **Partially stale**: Wave94–102
backfill is only one part of the queue. The durable unresolved item must include
the 38 historical/missing map decisions, W51–W55 purge/history annotations,
Runtime Player W22/23 missing indexes, W107 review-index coverage, parent omissions
through W89–102, and the child-before-parent refresh order. It must not imply that
the only missing documentation is Wave94–102.

## 3. Authoritative current-state table for root topics

| Top-level topic | Authoritative current state | Root status | Real open gate(s) | Current owner to link |
|---|---|---|---|---|
| Concept | Private Prototype and four tracks are accepted. | Current | Future Public Clean Subset scope when needed. | `concept/`, root AC. |
| Acceptance criteria | Requirement oracle remains current; dynamics v3/profile-v2 semantics live below it. | Partially stale | User choice on v3 traceability/cardinality wording; demo rights/disclaimer checks. | `acceptance-criteria/`, `design/dynamics-world-frame-chain.md`, Wave106. |
| Scenarios | Deterministic preview/validation/demo-safe scenarios exist; old scalar wording needs supersession note. | Partially stale | Decide when AC/scenario text should mirror v3 semantics. | `scenarios/`, design/Wave106. |
| Design | Accepted runtime/dynamics v3, WebGL2 primary + Canvas2D fallback, Skyline/Option E contracts; several child “next” labels are old. | Partially stale | GPU/pixel proof, Canvas2D sunset, diagnostics/evidence UI, v7 policy. | `design/_map.md` and child design maps. |
| Demo | Streaming Demo policy is present. | Current | Rights-clean fixture, final disclaimer/UI/preflight and legal checks. | `demo/_map.md`. |
| Proposal | Feature-proposal template is present. | Current | First proposal draft and target. | `proposal/_map.md`. |
| Development convention | P0/P1 and source-file organization rules are current. | Current | None beyond normal review adoption. | `development_convention/_map.md`. |
| Implementation | Editor mainline stop is Wave102; post-102 Waves103–109 are specialized evidence. | Partially stale | Missing child index decisions; current-capability/backlog refresh choice. | `implementation/orchestration/_map.md`, specialized wave/topic maps. |
| Runtime Player | Waves1–20 source/review pass, W21 Domain A/B pass with Domain C pending, W22/23 source/test pass; real-device/product gates remain. | Partially stale | W11 calibration/parity, W20 lifecycle, W21 dynamics parity, W22/23 live vowel checks, OBS confidence. | `runtime-player/implementation/_map.md`, Wave22/23 maps. |
| Model-authoring | Equipment and closed problems 01–19/second cycle pass; post-45d PNG and portability status are not closed. | Partially stale | PNG byte re-certification, strict-ref/sidecar portability, next closed-problem scope, W107→22/23 vowel gate. | `model-authoring/_map.md`, craft/closed-problems maps. |
| Mesh / rendering | v6D adaptive default + v7 toggle; quality hold; Wave108/109 render/data contract implemented. | Partially stale | v6 deletion/Wave2, formal atlasRuntime acceptance, GPU/pixel parity/Canvas sunset/inset check. | `mesh-generation/`, `design/mesh-rendering/`, render Wave108/109. |
| Render performance / dynamics | Editor Perf Wave2 closed; Player diagnostics/fast-path/cadence complete; Wave106 is semantic replacement, not performance claim. | Partially stale | Optional C7 two-instance hardware capture; no current product deep profiler. | `render-performance/`, Runtime Player Waves13–19, Wave106. |
| Electron migration | WS1–WS4 + packaging complete; residual E2E/typecheck/unit/metadata debt. | Partially stale | PSD E2E precondition/repair timing, debt cleanup, metadata warning. | `editor-electron-migration/`. |
| AI cohost / `apps/soul` | C1–C7器 closed; S1–S8 code present; S7/reading/interjection progress recorded; exception scope is `apps/soul` only. | Stale at root | S8 kill, brain-swap, stream-memory, persona/S9 voice. | `ai-cohost/_map.md`, `soul/_map.md`, `apps/soul/README.md`. |
| Expo | Six HTML + six A2 PDFs complete; acceptance/proof-print externally pending. | Partially stale | Acceptance notification, proof print, rights/legal review. | `expo/_map.md`, `genai-expo-2026/_map.md`. |
| Reports / archives | Cubism and static performance reports are historical evidence, not current implementation oracle. | Partially stale | Archive next-action cleanup and permission/legal review before Cubism experiment restart. | `reports/_map.md`, current `render-performance/` and design/runtime owners. |

## 4. Root correction ledger

The ledger counts **22 root correction records**. A record may cover a contiguous
set of root lines, but every stale/partial root claim is named exactly. Ownership
means “repair the child first, then refresh the root row”; “root-only” means no
child map rewrite is required.

| ID | Root file:line | Information type | Replacement truth | Evidence report/path | Destination ownership |
|---|---|---|---|---|---|
| R01 | `discussion/_map.md:11` | Current-source omission | Scope/AC oracles stay authoritative; runtime schema/solver/cardinality is owned by accepted dynamics design + Wave106. | `62-cross-topic-integration.md:34-39`; `discussion/design/dynamics-world-frame-chain.md`, Wave106. | Child design/AC first, then root (not root-only). |
| R02 | `discussion/_map.md:38` | Repository fact / current baseline | Wave53 is historical; accepted Editor mainline planning baseline is Wave102. | `60-editor-integration.md:27-35`; `23-editor-waves-081-102.md:59-74`. | Child implementation parents first. |
| R03 | `discussion/_map.md:39` | Repository fact / index coverage | Runtime Player reaches Wave23 source/test pass; W21 and real-device/product gates remain. | `61-runtime-player-integration.md:12-27,36-51`. | Child Runtime Player maps first. |
| R04 | `discussion/_map.md:40` | Repository fact / current next action | Closed problems 01–19 and craft second cycle passed; no automatic “first problem/closed problem 02” next. | `40-model-authoring.md:14-23,62-72`. | Child model-authoring maps first. |
| R05 | `discussion/_map.md:41` | Repository fact + user quality decision | v6/v7 quality hold remains; Wave108/109 render/data contract is complete. | `41-mesh-and-rendering.md:87-105`. | Child mesh/render maps first. |
| R06 | `discussion/_map.md:42` | Experiment result / open gate | Player diagnostics/cadence complete; C7 two-instance strain is optional and unmeasured, not an active hold. | `42-render-performance-and-dynamics.md:31-38,64-70,87-107`. | Child performance/runtime maps first. |
| R07 | `discussion/_map.md:43` | Repository fact / migration status | WS1–WS4 and packaging pass; residual quality debt is separate. | `43-editor-electron-migration.md:75-89`. | Child Electron maps first. |
| R08 | `discussion/_map.md:44` | Policy + repository fact | C1–C7器 closed; S1–S8 progress exists; `apps/soul` exception permits LLM/perception only there. | `50-ai-cohost.md:30-48`; `62-cross-topic-integration.md:55-63`. | Child AI maps first. |
| R09 | `discussion/_map.md:45` | Repository fact / external-state distinction | Six A2 HTML/PDF panels exist; acceptance is externally unverified and proof print follows acceptance. | `51-expo-and-research-archives.md:34-63`. | Child Expo maps first. |
| R10 | `discussion/_map.md:46` | Archive/current-owner boundary | Reports remain historical/private archive; current performance/runtime truth belongs elsewhere. | `51-expo-and-research-archives.md:66-79`; `42-render-performance-and-dynamics.md`. | Child reports map first. |
| R11 | `discussion/_map.md:63-65` | Repository fact / planning pointer | Keep Wave102 decision; repair W94–102 and specialized index coverage; capability/backlog are snapshots until refreshed. | `60-editor-integration.md:27-35,84-89`. | Child implementation parent/index first. |
| R12 | `discussion/_map.md:64` | Current-work routing | Model-authoring and Runtime Player are active topic families; specialized Waves103–109 are bounded evidence, not Editor continuation. | `60-editor-integration.md:27-35`; `61-runtime-player-integration.md:36-51`. | Child implementation/runtime/model maps first. |
| R13 | `discussion/_map.md:66` | Index coverage | Root route must include Runtime Player Waves1–23 and human gates. | `61-runtime-player-integration.md:12-27,39-47`. | Child Runtime Player maps first. |
| R14 | `discussion/_map.md:68` | Repository fact / model-authoring state | Equipment and second cycle complete; PNG/post-45d and portability are open gates. | `40-model-authoring.md:17-23,37-41,62-72`. | Child model-authoring maps first. |
| R15 | `discussion/_map.md:69` | Repository fact + quality decision | Keep quality hold and separately index render contract completion. | `41-mesh-and-rendering.md:87-105`. | Child mesh/render maps first. |
| R16 | `discussion/_map.md:70` | Experiment/current-owner boundary | Perf Wave2 close and Player Wave13–19 evidence are current; static report is historical; C7 optional. | `42-render-performance-and-dynamics.md:31-38,64-70,87-107`; `51-expo-and-research-archives.md:66-69`. | Child performance/report maps first. |
| R17 | `discussion/_map.md:71` | Repository fact / debt | Packaging is complete; stale E2E and type/test debt remain. | `43-editor-electron-migration.md:75-89`. | Child Electron maps first. |
| R18 | `discussion/_map.md:73` | Policy + implementation state | C/S progress and `apps/soul` exception must replace “S-series premises/access unresolved.” | `50-ai-cohost.md:30-48`; `62-cross-topic-integration.md:55-63`. | Child AI maps first. |
| R19 | `discussion/_map.md:77` | Planning source | Use repaired orchestration/current index + Wave102 and specialized maps; do not use stale capability/backlog as sole basis. | `60-editor-integration.md:84-89`. | Child implementation maps first. |
| R20 | `discussion/_map.md:85` | Index coverage / human gates | Route to Runtime Player current parent and W22/23 gate indexes, not only Wave1 artifacts. | `61-runtime-player-integration.md:52-76`. | Child Runtime Player maps first. |
| R21 | `discussion/_map.md:86` | Planning action | WS1 is complete; next action is residual Electron E2E/type/test/metadata debt. | `43-editor-electron-migration.md:75-89`. | Child Electron maps first. |
| R22 | `discussion/_map.md:87,97` | Planning + unresolved index coverage | AI next action is human gates, and implementation documentation queue includes purge/history + W22/23/W107/index omissions, not only W94–102. | `50-ai-cohost.md:70-78`; `60-editor-integration.md:84-89`; `61-runtime-player-integration.md:78-95`; `01-mechanical-inventory.md:22-42,347-376`. | Child AI/implementation/runtime maps first, then root only. |

## 5. Broken historical links versus genuinely missing current indices

The mechanical baseline is 281 maps, 3,480 links, 22 broken relative links, one
missing child-map registration, and 45 orphan candidates. These are queues, not
semantic verdicts (`01-mechanical-inventory.md:22-42`).

### Delete or annotate as history (do not recreate as current files)

- **21 of 22 broken links** are implementation-parent references to purged
  Wave51–55 plans/reports/reviews. Commit `99a31c8` intentionally removed those
  artifacts. Replace links with “purged / Git-history-only” annotations or an
  immutable commit reference; retain W56 abandonment and W57 rebuild facts.
- Historical wave maps whose wording says “current baseline” (W61, W68–W71,
  W75, W80) should be qualified as as-of-wave evidence, not rewritten to falsify
  their historical pass.
- `current-capability-map.md` (Wave54-era) and the static reports under
  `reports/` remain dated snapshots/historical evidence. Their old “next” prose
  must not be used as current planning truth.
- `discussion/design/screen-design/_map.md:21` points at the absent
  `inventories/_map.md`; this is a separate broken historical/current index
  candidate and must be removed or created only after an explicit ownership
  decision, not silently treated as implementation loss.

### Genuinely missing or incomplete current indices

- Runtime Player Wave22 and Wave23 each lack both a wave map and review map (four
  current index files). Create/index them with “source/test pass; real-device gate
  pending.”
- Runtime Player Wave21 review map lacks its three final review-file entries; this
  is an index defect, not a missing implementation gate.
- Implementation parent/orchestration maps omit existing W89–W102 child evidence
  and post-102 specialized W103–W108 routes; backfill links after child decisions.
- Wave107 has a wave map and review artifacts but no review `_map.md`; decide
  whether to create the historical index or explicitly record the absent index.
- The 38 expected missing implementation map paths in `60-editor-integration.md`
  are mostly historical coverage gaps (W16, W22, W42–W59 and W107 review). They
  do not imply missing waves; creation is an explicit documentation choice.

## 6. Child-before-parent update waves

The recommended order is **10 update waves**. A later wave must not overwrite a
child’s historical evidence or promote a human gate to an automated pass.

1. **Historical purge/index triage.** Annotate W51–W55 as purged/Git-history-only,
   classify the 38 absent implementation indexes, and decide the absent
   screen-design inventories index.
2. **Dynamics ownership.** Add supersession links in AC/scenario/module-contract
   children for profile-v2/dynamics-file-v3/Wave106; only then refresh root AC,
   scenario, and design rows.
3. **Implementation current index.** Repair implementation/orchestration child
   coverage through W89–W102 and add deliberate W103–W108 specialized entries;
   label current-capability/backlog snapshots before refreshing implementation root.
4. **Runtime Player.** Add/index W22/23 maps, repair W11/W16/W18/W19/W21 wording,
   and separate source/test pass from W11/W20/W21/W22/W23 product gates; then
   update the root Runtime Player row/routes.
5. **Mesh and rendering.** Reconcile v6/v7 hold, Wave108/109 contract,
   WebGL2/V4 historical labels, and atlasRuntime gate; then update mesh/design
   root entries.
6. **Performance and dynamics boundary.** Mark Perf Wave2/Player Waves13–19
   complete, keep C7 optional/unmeasured, and preserve Wave106 as semantics-only;
   then update root performance rows.
7. **Electron migration.** Mark WS1–WS4/packaging complete, index residual E2E,
   type/test, and metadata debt; then update root Electron rows/actions.
8. **AI cohost / soul.** Index S7/S8, brain-swap, reading/interjection, and
   stream-memory children; record `apps/soul` exception and human gates; then
   update AI root rows/actions.
9. **Model-authoring, Expo, and archive hygiene.** Correct closed-problem/PNG
   status, Expo six-panel completion, and archive current-owner links; then update
   the corresponding root rows.
10. **Root integration.** Apply the 22-record correction ledger, retain accepted
    Private/four-track/Wave102 decisions, and replace the narrow unresolved
    Wave94–102 item with the complete index/history queue.

## 7. Real user-decision gates (open; 22)

These are unresolved user, human-device, legal, or product gates. They are not
implementation failures and must remain separate from automated `pass` reports.

1. **Dynamics traceability:** decide how profile-v2/dynamics-file-v3 cardinality is
   reflected in Domain-09 AC/scenario wording.
2. **Runtime Player W11 calibration/parity:** real iFacialMocap near/far calibration,
   Stage Motion direction/tuning, Browser Source parity, and restart persistence.
3. **Runtime Player W13–19 product confidence:** OBS alpha/WebGL2/real-model motion,
   capture smoothness, and provenance-complete cadence confidence.
4. **Runtime Player W20 lifecycle smoke:** packaged/dev Electron Control close,
   Stage direct close recovery, and Focus Stage reopen.
5. **Runtime Player W21 Dynamics Tune:** real Runtime Export + iFacialMocap Native
   Stage/Browser Source parity, persistence, reset, isolation, and immutability.
6. **Runtime Player W22/23 lipsync:** real speech checks for mouth-open coupling,
   closed-vowel over-closing, transitions, “e” parasitism, and “u” jitter.
7. **Model-authoring PNG recertification:** whether post-`45d2734` PNG bytes are
   covered by the 2026-07-03 approval.
8. **Model-authoring portability:** strict-ref errors and sidecar portability
   acceptance for the current authoring output.
9. **Model-authoring next scope:** choose the next closed problem rather than
   assuming closed problem 02.
10. **Mesh quality/Wave2:** permanent v6 retention, v6/v7 toggle lifespan, and
    authorization for v6 deletion/Wave2.
11. **Wave108 formal gate:** atlasRuntime visual acceptance versus commit/Wave109
    export-to-player evidence.
12. **Mesh visual/pixel boundary:** real GPU/pixel parity, Canvas2D sunset criteria,
    and any remaining original-inset recheck.
13. **Optional C7 performance experiment:** hardware/browser targets and a
    two-instance CPU/GPU/FPS capture; no current product deep-profiler transport.
14. **Electron residual timing:** stale PSD E2E workspace/native-picker repair,
    independent typecheck/unit debt, and packaging metadata warning handling.
15. **AI S8 safety gate:** kill during speech, reject all firing, restore, and prove
    no normal-speech regression.
16. **AI brain-swap gate:** rollout cleanup, long-run behavior, and final operating
    choice for Opus/Sol/Terra fallback.
17. **AI stream-memory gate:** save/privacy, next-stream auto-load, OFF behavior,
    and manual/periodic update.
18. **AI persona/S9 voice:** decide when the voice/persona is fixed; body/rig remains
    model-authoring-owned.
19. **Expo acceptance/proof print:** acceptance notification and post-acceptance
    real-size proof print.
20. **Expo/archive legal gate:** permission/scope review before any Cubism inspector
    or archived experiment is resumed.
21. **Demo safety gate:** rights-clean fixture plus final disclaimer/UI wording and
    automated preflight checks.
22. **Proposal target:** choose the first Live2D Feature Proposal draft/submission
    target.

Accepted decisions that must remain explicit (not counted above): Private baseline
and four tracks; Editor mainline stop at Wave102; Cubism exclusion; Runtime Player
sanitized transport and no product deep profiling; v6D/v7 quality hold; Wave106
semantics replacement without a performance claim; `apps/soul` exception with
LLM/perception forbidden outside that enclave; D4 YouTube, D6 key-operation
ladder, and D7 Variant-out-of-scope.

## 8. Items that must remain historical

- Wave-level implementation/review maps are `historical-evidence-index` records.
  Their pass/complete verdicts remain valid as-of-wave observations even when a
  later source reset or a stale plan header exists.
- W51–W55 are intentional purge history. Do not fabricate current reports/maps for
  deleted artifacts.
- W61/W68/W69/W70/W71/W75/W80 “current/default/next” wording is historical and may
  be qualified, not rewritten into a different historical result.
- Wave54 `current-capability-map.md`, the post-W84 `remaining-work-backlog.md`, and
  static `reports/editor-render-performance` are dated snapshots. Preserve them as
  evidence while routing current readers elsewhere.
- Runtime Player W19 logs, C7 two-instance observation, model-authoring PNG
  approval, Wave108 closeout wording, and Expo acceptance state are bounded
  experiments/user observations, not universal guarantees.
- Cubism SDK/Core, MOC3/Model3, and related inspector/deformer research remain
  private historical archives under the current Cubism-exclusion policy.

## 9. Coverage and limitations

- Audited root integration from reports `60`, `61`, `62`, and mechanical baseline
  `01`; lower reports were consulted only for cited ambiguity resolution. No new
  full product/test/human-device run was performed.
- Mechanical totals are baseline counts: 281 maps, 3,480 links, 22 broken relative
  links, one missing child-map registration, and 45 orphan candidates. A path
  defect does not prove semantic staleness.
- Electron GUI, OBS/iFacialMocap, real vowel, GPU/pixel, Expo acceptance, and AI
  human gates were not rerun. Their statuses are recorded as repository facts,
  historical observations, or open gates as labeled above.
- The 38 missing implementation map paths and four Runtime Player W22/23 map
  indexes are coverage decisions, not missing implementation claims. Creation,
  deletion, or immutable-header normalization still requires user direction.
- This report is the durable planning basis only. It intentionally leaves
  `discussion/_map.md` and all existing maps unchanged.
