# Editor / Implementation Integration Map-Freshness Audit

> Audit point: Git `3c3669eefcc375c62d1ec6b4d77a000d7cbbb61c`, 2026-08-08 (Asia/Tokyo). This report is the only file written for this assignment. Existing maps, source, tests, configuration, and other audit reports were not changed.

## 1. Scope and method

The integration read the audit contract and audit map first, then the durable reports `01`, `11`, `20`, `21`, `22`, `23`, `40`, `41`, `42`, and `43`. The implementation parent/index maps checked directly were:

- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/_map.md` (parent implications only)

The evidence range covers Wave 0–102 implementation/review history and the post-102 specialized evidence in Waves 103–108. Cross-topic child maps were checked where they change the interpretation of the implementation parent: model-authoring, mesh-generation/design mesh maps, render-performance, and editor-electron-migration. Relative-link and missing-map findings use the mechanical inventory (`01-mechanical-inventory.md:347-386`) and the domain reports; no new full product test run or GUI gate was attempted.

## 2. Adjudicated integration verdict

| Map/family | Role | Verdict | Integration decision |
|---|---|---|---|
| Existing Wave/review maps for Waves 0–102 | `historical-evidence-index` | **Intentionally historical** (with a few misleading “current baseline” sentences) | Preserve each wave’s recorded final `pass`/`complete` gate. A later wave, source reset, or stale plan header does not invalidate historical evidence. Historical “current” language should be qualified when a reader could mistake it for today’s baseline. |
| Existing post-102 maps for Waves 103–108 | `historical-evidence-index` | **Intentionally historical** | These are specialized cross-topic evidence (authoring host/perception, dynamics schema, runtime-player, and mesh/render boundary). They do not reopen the Editor mainline. Wave107 remains runtime-player-only by its final report. |
| Missing expected leaf maps | historical index coverage defect | **Stale / absent evidence indexes** | Record the missing paths explicitly or create maps only after user agreement. Do not infer that an absent map means an absent wave. W51–W55 are a separate purge/history case. |
| `discussion/implementation/_map.md` | `living-current-state` + `living-index` | **Partially stale** | It contains broken/purged W51–W55 links, omits large child-map ranges, stops its indexed history at W93, and still points planning at a post-W80 backlog/current-capability pair. |
| `discussion/implementation/orchestration/_map.md` | `living-index` | **Partially stale** | W101 is incorrectly `Planned`, W107 is missing, W51–W55 links target purged files, the current-decision prose stops at W93, and `:211` falsely says W58–102 entries are unlisted. |
| `discussion/implementation/current-capability-map.md` | historical product/system snapshot | **Intentionally historical; unsafe as current planning truth** | Its own header is Wave54-era (`:1-4`). Keep as a dated snapshot or supersede it; do not use its Wave54 capability rows to deny W57–102 or specialized post-102 evidence. |
| `discussion/implementation/remaining-work-backlog.md` | `living-current-state` snapshot | **Partially stale** | It is a valid post-W84 snapshot, but it predates W87–102 and 103–108. Atlas, Runtime Export, Variant, Skyline, and later specialized work are still presented as candidates or omissions. |
| `discussion/_map.md` | root `living-current-state` + index | **Partially stale** | W53 is still called the latest implementation baseline, Render Player/Electron summaries are pre-closeout, and the “use current-capability + backlog as truth” pointer is unsafe. The accepted “Editor mainline stopped at Wave102” decision remains valid as a scope/baseline decision and must be retained, with a qualification for later specialized waves. |

### Wave102 boundary adjudication

The root statement at `discussion/_map.md:63-64,77` is treated as an accepted user decision: **the Editor mainline is intentionally stopped/frozen at the Wave102 baseline for planning purposes**. It is not a claim that no later commit can touch `apps/editor`. The post-102 evidence is partitioned as follows:

- Waves 103–105 are model-authoring equipment/perception work (`40-model-authoring.md:27-35`), with no Editor mainline feature claim.
- Wave106 is a dynamics/schema replacement and tuning boundary; Editor Domain B and Player Domain C pass, but no render-performance delta was measured (`42-render-performance-and-dynamics.md:72-76`).
- Wave107 changes `apps/runtime-player/**` only; its review explicitly records zero Editor, authoring-host, or package changes (`40-model-authoring.md:43-53`).
- Wave108 is a mesh/render data contract; current source and Wave109 follow-up provide implementation evidence, but the remaining formal atlasRuntime human-gate question is separate (`41-mesh-and-rendering.md:50-55,96-105`).

Therefore, later specialized waves are **post-mainline evidence and bounded cross-topic work**, not proof that the user’s Wave102 mainline-stop decision was false. A future map refresh should expose both axes explicitly: `Editor mainline baseline = Wave102 (accepted scope decision)` and `specialized post-102 evidence = separately indexed, non-mainline unless re-authorized`.

## 3. Historical leaf coverage and link defects (child layer first)

### 3.1 Missing map paths

The following **38 expected map paths** are absent. This is map/index coverage, not a failed implementation gate.

| Group | Missing paths | Evidence and replacement truth |
|---|---|---|
| Early implementation gaps (3) | `discussion/implementation/waves/wave16/_map.md`; `discussion/implementation/reviews/wave16/_map.md`; `discussion/implementation/reviews/wave22/_map.md` | Wave16 final report is `pass / Completed / implementation-proven` and its six completion/integration artifacts exist (`20-editor-waves-000-028.md:51-65,89-103`). Wave22 has final and clean-review evidence; only the review map is absent (`20-editor-waves-000-028.md:95-103`). Create a historical index or record explicit absence; do not change wave status. |
| W42–W58 coverage (33) | `waves/wave42/_map.md`; `waves/wave43/_map.md` … `waves/wave58/_map.md`; `reviews/wave43/_map.md` … `reviews/wave58/_map.md` | W42 final report/review exist. W43–W50 and W56–W58 have final/domain/closeout evidence but no per-wave/review map. W51–W55 are additionally purged by commit `99a31c8`; their plans and canonical reports are deleted (`21-editor-waves-029-058.md:56-65,87-90`). For W43–W50 and W56–W58, link existing artifacts; for W51–W55, mark Git-history-only/purged rather than inventing current artifacts. |
| W59 review gap (1) | `discussion/implementation/reviews/wave59/_map.md` | Wave59 wave map and final clean review are present and pass; only the review index is absent (`22-editor-waves-059-080.md:7-14,18-20,55-59`). |
| W107 review gap (1) | `discussion/implementation/reviews/wave107/_map.md` | Wave107 wave map and three review artifacts exist, and final report/review record the runtime-player-only boundary plus real-device gate pending (`40-model-authoring.md:43-53`). Create a review index only if the standard coverage is desired. |

### 3.2 Existing historical maps whose wording can mislead as current state

These maps remain historical indexes; only their current-sounding sentence should be qualified during a documentation pass.

| File:line | Stale/suspicious wording | Replacement truth/evidence |
|---|---|---|
| `discussion/implementation/waves/wave61/_map.md:47` | Calls Wave61 the “current implementation-proven Editor GUI baseline.” | Historical Wave61 closeout only. Root policy uses Wave102 as the accepted Editor mainline baseline (`discussion/_map.md:63-64`; `23-editor-waves-081-102.md:59-70`). |
| `discussion/implementation/waves/wave68/_map.md:28,32` | Says v6B/v6C are deferred and leaves the temporary selector narrative as current. | W68 experiment passed; W70/W71 later selected the v6D lineage, while current UI is v6D default plus v6/v7 generation-family toggle (`41-mesh-and-rendering.md:42-48,71-78`; `apps/editor/src/features/editor-session/model/mesh-tool-state.ts:69-97`). |
| `discussion/implementation/waves/wave69/_map.md:29,33-39` | Leaves backend selection as a later decision. | Historical W69 comparison. W70/W71 changed the route; current default is `auto-outline-v6d-adaptive-contour-constrainautor`, and v6/v7 quality/toggle longevity remains a user decision (`41-mesh-and-rendering.md:59-69,87-100`). |
| `discussion/implementation/waves/wave70/_map.md:24` | Describes support-ring v6D as the normal Editor default route. | Historical W70 route; W71 and later tuning changed the default to v6D adaptive contour constrainautor (`41-mesh-and-rendering.md:61-69,73-78`). |
| `discussion/implementation/waves/wave71/_map.md:27` | Describes adaptive-staggered-band as the Editor default. | Historical W71 implementation; current source default is `auto-outline-v6d-adaptive-contour-constrainautor` (`apps/editor/src/features/editor-session/model/mesh-tool-state.ts:69-71`; `41-mesh-and-rendering.md:44-48`). |
| `discussion/implementation/waves/wave75/_map.md:27` | Calls W75 the current completed implementation baseline. | Historical W75 pass. Use Wave102 as the accepted mainline stopping baseline; do not rewrite W75’s pass evidence (`22-editor-waves-059-080.md:31-39`). |
| `discussion/implementation/waves/wave80/_map.md:30` | Says dynamics/export remain out of scope. | Historical W80 scope. W84 added Viewer Dynamics playback and W92 added Runtime Export (`22-editor-waves-059-080.md:38-45`; `discussion/implementation/orchestration/_map.md:138,146`). |

## 4. Cross-topic child maps and specialized evidence

### 4.1 Model-authoring / Waves 103–107

| File:line | Finding | Replacement truth/evidence |
|---|---|---|
| `discussion/model-authoring/_map.md:46-48` | “Next = closed problem 02” is obsolete after closed problems 01–19 and craft second-cycle work passed. | Keep the completed equipment summary; next action is a new user-scoped closed-problem choice or PNG re-certification, not automatic cp02 (`40-model-authoring.md:17-23,62-67`). |
| `discussion/model-authoring/_map.md:58-64` | Records the 2026-07-03 PNG approval as if it proves current bytes. | Preserve that approval as a historical user decision. Commit `45d2734` replaced all three PNGs; no separate approval for post-45d bytes was found (`40-model-authoring.md:37-41,69-72`). Current PNG approval is unresolved. |
| `discussion/model-authoring/_map.md:78-82` | Leaves Git commit granularity unresolved despite craft’s explicit `1 committed operation = 1 git commit`. | Move the invariant to accepted policy; retain only whether a separate policy document is desired as a user decision (`40-model-authoring.md:21,55-67`; `discussion/model-authoring/craft/_map.md:36,40-44`). |
| `discussion/model-authoring/closed-problems/_map.md:44-47,53-58` | “Prepare second cycle” and re-run/tuft/chord bullets are stale or resolved. | Second cycle is complete; keep only `front_hair` pixel cleanup and post-19 sequencing as open, with craft’s layered-shell/chord decisions as evidence (`40-model-authoring.md:21-23`). |
| `discussion/model-authoring/craft/_map.md:5,18` | Blurb/recipe text says conductor tests or tuft work are in progress/future. | `_conductor.md:111-112` records both dry-run calibrations complete; qualify recipe-07 wording as either a recipe-specific re-run or historical layer experiment (`40-model-authoring.md:21-23`). |

Wave107’s runtime-player real-device vowel check remains a user gate, not Editor mainline work (`40-model-authoring.md:62-67`). Wave107’s nearest-reference/single-vowel semantics are historical; current live semantics are Wave22/23 normalized five-vowel blending (`40-model-authoring.md:45-53`).

### 4.2 Mesh / rendering child maps

| File:line | Finding | Replacement truth/evidence |
|---|---|---|
| `discussion/mesh-generation/_map.md:16,22,26,35` | Evaluation is described as round-1/visual-pending and UV clamp remains unresolved. | Round 2 is complete: v6/v7 are one-long/one-short, topic held, v6 default + v7 toggle retained; Wave108/Option E resolved UV non-clamp + transparent padding/gutter + LINEAR (`41-mesh-and-rendering.md:27-40,87-100`). |
| `discussion/mesh-generation/implementation/_map.md:9,20-21,35,39-40` | W1.3 is `Planned`, visual gate is pending, next action is v6 deletion, and old test totals look current. | W1.2/W1.3 report/review pass; round-2 human evaluation completed; Wave2 (v6 deletion) is unstarted and user-held. Keep historical W1 totals separate from Wave108/109 verification (`41-mesh-and-rendering.md:35-40,71-78`). |
| `discussion/design/mesh-generation/_map.md:17-19,43-48` | v6a/b/c and v6d/e/f selectors can read as current UI and “do not restore selector” conflicts with the v6/v7 toggle. | Label W68/69 selectors as historical backend experiments. Current UI is generation-family v6/v7 toggle; current default is v6D adaptive contour (`11-design-and-conventions.md:70-84`; `41-mesh-and-rendering.md:42-48`). |
| `discussion/design/mesh-rendering/_map.md:31,33` | WebGL2 foundation and V4 are future next work. | Wave67 already implemented WebGL2 primary + Canvas2D fallback and V4 sidecar. Remaining work is real GPU/pixel parity and Canvas2D sunset criteria (`11-design-and-conventions.md:86-96`; `41-mesh-and-rendering.md:50-55`). |

The Wave108 report’s “uncommitted / device gate pending” wording is a closeout-time snapshot. Current Git contains `70485f4`; `899cb2e` fixes export preflight and records export→player inspection. Treat formal user acceptance as a separate unresolved gate unless that evidence is accepted (`41-mesh-and-rendering.md:50-55,96-105`).

### 4.3 Render-performance child map

| File:line | Finding | Replacement truth/evidence |
|---|---|---|
| `discussion/render-performance/_map.md:40-54,61` | Player remains “on hold” with product deep-profile wiring as next action; Editor measurement003/60fps is presented as pending despite accepted close. | Waves 13–19 completed the available Player diagnostics/fast-path/cadence work; deep profiling is developer/test-only after Wave18; latest OBS/Chrome comparison attributes cadence gap to OBS/CEF; C7 two-instance strain is an unmeasured optional reopen (`42-render-performance-and-dynamics.md:31-38,64-70,78-100`). Editor “sufficient” is an acceptance decision, while absent `real-model-003.md` is only an unmeasured benchmark (`42-render-performance-and-dynamics.md:50-55,87-107`). |

`discussion/reports/editor-render-performance/_map.md` remains intentionally historical. Its `toFixed` line references pre-Perf-Wave-2 source and must not be reused as current prescription (`42-render-performance-and-dynamics.md:40-46,94-100`).

### 4.4 Electron migration child maps

| File:line | Finding | Replacement truth/evidence |
|---|---|---|
| `discussion/editor-electron-migration/shell/_map.md:21` | “Next: WS2” remains after WS2 pass. | WS1 and WS2 are complete/pass with user smoke; mark the line historical or remove it (`43-editor-electron-migration.md:27-42`). |
| `discussion/editor-electron-migration/persistence/_map.md:24-26` | “Close then WS3/WS4” remains after WS3/WS4 pass; plan still says Draft. | WS2, WS3, WS4 all complete; retain symlink/type-collision residuals and stale plan metadata as history (`43-editor-electron-migration.md:35-42`). |
| `discussion/editor-electron-migration/cleanup/_map.md:3,5,17-28` | Intro says E2E depends on Vite and next says packaging is separate; all-E2E-green wording is misleading. | Web→Electron wiring and editor portable removal are complete, but 11 E2E tests stop on stale workspace/import assertions; packaging is also complete (`43-editor-electron-migration.md:43-55`). |
| `discussion/editor-electron-migration/packaging/_map.md:27-29` | “No unresolved items” omits packaging report’s non-blocking `description`/`author` warning. | Keep packaging pass and icon evidence; index the warning and stale source-image filename as residual/history (`43-editor-electron-migration.md:57-62`). |
| `discussion/editor-electron-migration/_map.md:27-33` | Work-stream completion is correct, but root-facing next wording must not imply WS1 is unstarted. | WS1–WS4 and packaging are complete; stale E2E (`task_2d91b388`) and independent editor type/test debt remain (`43-editor-electron-migration.md:19-25,75-89`). |

## 5. Parent/index update inventory (after child decisions)

The following is the recommended **child-before-parent** order. These are proposed documentation corrections only; no map was edited in this audit.

### Priority P0 — establish historical coverage and remove false links

1. **Record or create the 38 missing leaf map indexes** from §3.1. Existing final reports/reviews remain authoritative. Do not recreate W51–W55 files without an explicit decision; mark them purged/Git-history-only using commit `99a31c8` (`21-editor-waves-029-058.md:56-65,87-90`).
2. **Repair the parent’s child-map index omissions** after the leaf decision:
   - `discussion/implementation/_map.md:202-237` omits the existing Wave0 map and only has final-report links for Wave16/17–19; `:283-312` omits Wave0 and Wave17–19 review maps and calls the existing Wave28 review map a “placeholder.” Add existing maps or explicit absent-map rows (`20-editor-waves-000-028.md:26-31,128-145`).
   - The same map jumps from Wave88 to Wave93 (`:454-468`), omitting W89–W92 and W94–W102 child evidence; backfill from the pass-classified maps/reviews (`23-editor-waves-081-102.md:35-57,72-79`).
   - Add deliberate cross-topic entries for W103–W108, including W107’s absent review index, without presenting them as Editor mainline continuation (`40-model-authoring.md:43-53`; `41-mesh-and-rendering.md:59-69`).

### Priority P1 — repair living implementation parents

3. **`discussion/implementation/_map.md`**
   - `:23-24` claims the latest usable state is post-W80 and tells readers to use a backlog that predates W87–102. Replace with a short pointer to the orchestration map plus Wave102 baseline and specialized-domain indexes.
   - `:59-64,129-149` and `:290-301` link W51–W55 plans/reports/reviews that are absent. Replace every target with an explicit “purged/Git-history-only” note or an archived commit link; preserve W56/W57/W58 epoch decisions (`21-editor-waves-029-058.md:67-90`).
   - `:311` says the Wave28 review map is a placeholder; it is a pass/clean review (`20-editor-waves-000-028.md:132-145`).
   - `:473-481` still selects W66/W67 as current implementation baselines and repeats old non-goals as next actions. Keep those as historical references; current mainline baseline is the accepted Wave102 scope, while W103–108 are separately indexed specialized evidence.

4. **`discussion/implementation/orchestration/_map.md`**
   - `:60-64,204` contains broken W51–W55 links. Replace with purge/history labels, not fabricated current targets (`01-mechanical-inventory.md:353-373`).
   - `:110` must change Wave101 from `Planned / ready for orchestration` to final pass; the final report/map/review all pass (`23-editor-waves-081-102.md:43-44,59-63`).
   - Add Wave107 between `:115` and `:116`, and label 103–108 as specialized cross-topic evidence. Wave107’s implementation/review scope is runtime-player-only and its real-device gate remains open (`40-model-authoring.md:43-53,62-67`).
   - `:118-147` current-decision prose stops at Wave93. Add a compact W94–W102 pass summary and explicit specialized-wave boundary; do not turn this into an assertion that Editor mainline continued after Wave102.
   - `:211` says W58–W102 entries are unlisted even though plan rows exist at `:90-111`. Replace with the narrower truth: implementation parent child-artifact backfill is incomplete, while orchestration plans W58–W102 are present.

### Priority P1 — make capability/backlog documents honest about their role

5. **`discussion/implementation/current-capability-map.md:1-4,22-32,312-316`**
   - Keep the dated Wave54 snapshot, but make its historical status machine-visible and point current readers to orchestration + Wave102 and domain maps. Rows claiming Wave53/Wave54 as current capability are historical evidence, not current product truth (`21-editor-waves-029-058.md:91-103`).
   - Do not delete useful boundaries/non-goals; split “historical implementation-proven at Wave54” from “current source fact.”

6. **`discussion/implementation/remaining-work-backlog.md`**
   - `:3-10` is a 2026-06-19 post-W84 snapshot, not a current post-W108 backlog. Keep the old-backlog replacement explanation but add a superseding date/entry point.
   - `:96-99,108-115,142-160` still treats Texture Atlas, Variant Manager, Skyline, and Runtime Export direction as future candidates. W87–W92 and W99–W101 pass evidence supersedes those candidates (`11-design-and-conventions.md:27-33`; `23-editor-waves-081-102.md:39-46`). Keep only residuals and user choices that remain open.
   - `:120-128` residuals (fake-GL proof, absent benchmark, visual/manual QA) are useful when labeled as measurements/gates; they must not be used to claim missing capability.

### Priority P2 — root map integration

7. **`discussion/_map.md`**
   - `:38` says Wave53 is the latest implementation-proven baseline. Replace with the accepted Wave102 mainline baseline; purged W53 links must be Git-history-only (`21-editor-waves-029-058.md:79-81`; `23-editor-waves-081-102.md:59-74`).
   - `:41` mesh hold can remain, but cross-link that Wave108/109 completed the render/data contract without changing the v6/v7 quality verdict (`41-mesh-and-rendering.md:87-94`).
   - `:42` should replace “Player on hold / reopen condition” with Waves13–19 diagnostics/cadence completion and optional, unmeasured C7 two-instance reopen (`42-render-performance-and-dynamics.md:94-107`).
   - `:43` and `:71` should say WS1–WS4 plus packaging completed; only stale E2E/task debt and packaging warnings remain (`43-editor-electron-migration.md:75-89`).
   - Preserve `:63-64` as the user decision, but append “post-102 specialized waves are separately indexed and do not reopen the Editor mainline unless re-authorized.”
   - `:65` is unsafe because both linked files are historical/stale. Point to orchestration/_map and the specialized topic maps; mark capability/backlog as snapshots until refreshed.
   - `:69-70` should retain mesh hold and replace “Perf Wave1 from measurement foundation” with Perf Wave2 complete/accepted and current optional gates.
   - `:77` can retain Wave102 as the mainline handling rule, but its basis links should be the repaired implementation/orchestration parent, not the stale current-capability/backlog pair.
   - `:86` (“first action WS1”) is obsolete; replace with Electron residual E2E/task debt or remove from next actions.
   - `:97` should expand from “Wave94–102 backfill” to the complete child-map/parent-link repair inventory, including W51–W55 purge and post-102 specialized coverage.

## 6. Information-type separation

### Repository facts

- Final reports and clean reviews pass for Waves 0–102 in the audited ranges; stale `Planned` headers are execution-time plan snapshots, not current gate authority (`20-editor-waves-000-028.md:105-117`; `23-editor-waves-081-102.md:33-46`).
- Current Editor source corroborates Wave99/101/102 claims: Variant Manager UI exists, Skyline is the packing default, and `baseVisible` is materialized (`11-design-and-conventions.md:27-31`; `23-editor-waves-081-102.md:44-46`).
- Current mesh default/toggle, transparent-margin implementation, render WebGL2/Canvas2D foundation, and Electron WS/package status are source/repository facts cited above.
- W51–W55 deletion is intentional purge history (`99a31c8`), not accidental loss (`21-editor-waves-029-058.md:87-90`).

### Accepted decisions / policy

- Editor mainline planning stops at Wave102 (root user decision). Later specialized waves do not supersede it without a new user decision.
- W56 is abandoned except for its headless/package-separation fact; W57 rebuild is the accepted React Editor foundation (`21-editor-waves-029-058.md:87-90,98-103`).
- Mesh current conservative state is v6D default + v7 comparison toggle; v6 removal/Wave2 is user-held (`41-mesh-and-rendering.md:87-100`).
- Wave106 dynamics v3/profile v2 replacement is accepted pass, with no performance claim (`42-render-performance-and-dynamics.md:72-76,80-92`).
- Deep profiling remains developer/test-only after Wave18 unless a new design is accepted (`42-render-performance-and-dynamics.md:80-92`).

### Experiments / verification results

- Wave pass/review reports are as-of-wave observations, not current performance or visual quality claims.
- Perf Wave2 before/after values, the model-authoring user PNG approval, W68–W71 mesh comparisons, Wave76 fake-GL proof, and Wave108 package/focused tests are experiments/verification results. They do not by themselves close the remaining human/device gates.

### Unresolved user gates and decisions

1. Whether post-`45d2734` model-authoring PNG bytes are covered by the 2026-07-03 approval (`40-model-authoring.md:37-41,62-67`).
2. Wave107 live vowel real-device gate (`40-model-authoring.md:62-67`).
3. Formal Wave108 atlasRuntime visual acceptance versus commit subject + Wave109 export→player evidence (`41-mesh-and-rendering.md:96-105`).
4. Whether v6 is permanently retained, the v6/v7 toggle lifespan, and whether to authorize Mesh Wave2 deletion (`41-mesh-and-rendering.md:96-100`).
5. Optional C7 two-instance Player performance experiment and hardware/browser targets; no capture currently exists (`42-render-performance-and-dynamics.md:87-107`).
6. Stale Electron PSD E2E repair timing and native-picker test hook (`43-editor-electron-migration.md:82-89`).
7. Create missing historical maps versus record explicit absent/purged rows; normalize immutable plan headers or leave them as history (`20-editor-waves-000-028.md:147-150`; `21-editor-waves-029-058.md:103-111`).
8. Whether current-capability/backlog should be refreshed in place or superseded by a new current index.

## 7. Prioritized correction-count summary

Counts below are inventory counts, not edits performed:

- **38 missing expected map paths**: 3 early gaps, 33 W42–W58 coverage gaps, 1 W59 review gap, 1 W107 review gap.
- **22 mechanically broken relative-link candidates** at the audit baseline; 21 are implementation parent references to purged W51–W55 artifacts and 1 is the unrelated screen-design inventory link (`01-mechanical-inventory.md:347-376`).
- **7 historical wave maps** with current-sounding baseline/scope wording requiring qualification (W61, W68, W69, W70, W71, W75, W80).
- **13 cross-topic living child maps** requiring state/index correction before parent refresh (model-authoring family 3, mesh generation/design 4, render-performance 1, Electron migration 5), plus the related design-root findings in report 11.
- **5 living parent/index files** requiring refresh (`implementation/_map`, `orchestration/_map`, `remaining-work-backlog`, `current-capability-map` role labeling, and root `discussion/_map` implications).
- **8 explicit user-gate/decision items** remain open (§6); none is evidence that Wave0–102 failed or that the Wave102 mainline-stop decision was false.

## 8. Verification limits

- No existing map, source, test, configuration, or another agent’s report was modified.
- No new full typecheck/unit/e2e run was required for this historical/index audit. Focused checks and pass counts quoted above come from committed reports, source inspection, and read-only link/path checks.
- Electron GUI, model PNG, Wave107 vowel, and Wave108 atlasRuntime user gates were not physically rerun. Their status is recorded as repository fact, unresolved gate, or historical observation as labeled above.
- This report does not decide whether to recreate missing maps, rewrite immutable plan headers, or authorize any implementation wave.
