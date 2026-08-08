# Model Authoring / Post-Editor Map Freshness Audit

> Audit point: `3c3669eefcc375c62d1ec6b4d77a000d7cbbb61c` (2026-08-08, Asia/Tokyo). This report is the only file changed by this audit task.

## 1. Scope and checked maps

担当範囲は `discussion/model-authoring/**/_map.md` と、post-Editor implementation evidence for Waves 103–105/107、`apps/authoring-host`、`packages/render-software`、および Wave107 の runtime-player boundary である。

実際に確認した model-authoring map は次の3枚（リンク検査は 27/0、38/0、15/0 = 80 links / 0 missing）。

- `discussion/model-authoring/_map.md`
- `discussion/model-authoring/closed-problems/_map.md`
- `discussion/model-authoring/craft/_map.md`

併せて確認した implementation evidence は `waves/wave103–105/_map.md`、`reviews/wave103–105/_map.md`、`waves/wave107/_map.md`、各 final report/review、`orchestration/wave103-plan.md`・`wave104-plan.md`・`wave105-plan.md`・`wave107-plan.md`、`apps/authoring-host/src/**`、`packages/render-software/src/**`、`apps/runtime-player/src/main/live-mapping/**`、`discussion/runtime-player/implementation/waves/wave22–23/**` である。

## 2. Map verdicts

| Map | Kind | Verdict | Basis / stale or suspicious text |
|---|---|---|---|
| `discussion/model-authoring/_map.md` | `living-current-state` | **Partially stale** | Current equipment and human gate are recorded at lines 40–42 and 58–69, but “next action = closed problem 02” at `discussion/model-authoring/_map.md:46-48` is obsolete: closed problems 01–19 are already passed and craft’s second-cycle work is closed at `discussion/model-authoring/craft/_map.md:25-32`. The unresolved “Git commit granularity” item at `:78-82` conflicts with the explicit `1 committed operation = 1 git commit` invariant at `craft/_map.md:36,41` (whether a separate policy document is still desired is a user decision). The map also does not index Wave107’s player surveys (`research/player-{ifacialmocap,calibration,mapping-strength}-survey.md`) or `variant-feature-survey.md`. |
| `discussion/model-authoring/closed-problems/_map.md` | `living-index` + current status | **Partially stale** | Problem rows 01–19 are current and all marked passed at `closed-problems/_map.md:15-42`. “Prepare second cycle” at `:44-47` is stale: the second-cycle Fable run is recorded complete at `craft/_map.md:25-32`, and recipe 09/10 third-run evidence is current at `craft/_map.md:21-22`. Unresolved bullets “re-run / tuft volumetric treatment” and “far-key chord term” at `:53-56` are contradicted by the layered-shell resolution and chord-term decision at `craft/_map.md:25-32`; `front_hair` pixel cleanup (`:57`) and the post-19 problem sequence (`:58`) remain genuinely open. |
| `discussion/model-authoring/craft/_map.md` | `living-index` + current recipe state | **Partially stale** | Recipe/status rows are current through 2026-07-17 (`:11-22`), and second-cycle completion is explicit (`:25-32`). However the entry blurb still says conductor stage 2/3 tests are in progress at `craft/_map.md:5`, while `_conductor.md:111-112` records both dry-run calibrations and the user rulings as completed. Recipe 07 still says “tuft is for a future re-run” at `craft/_map.md:18`, while the layered-rotation-shells route is marked done at `:25-29`; this needs wording clarification (recipe-07-specific re-run versus the already-closed layer-coordinate experiment). |

The three maps have no broken relative links. Their problem is temporal/state accuracy, not link reachability.

## 3. Post-Editor implementation evidence

### Waves 103–105: authoring equipment is implemented

- Wave103 is technically closed: `waves/wave103/_map.md:9-18` and `reviews/wave103/_map.md:9-19` record all domain/review lanes as pass. Commit `2f80ca0aa2e3c6d0dbbb88421f20f27cc6153a45` is an ancestor of the audit HEAD. The current source still contains the one-shot CLI lifecycle (`apps/authoring-host/src/run-authoring-host-command.ts:70-126,194-204`), and the pure-TS deterministic path is present in `packages/render-software/src/render-scene-to-png.ts:22-34` and `software-renderer.ts:145-152`.
- Wave104 is technically closed: `waves/wave104/_map.md:9-21` and `reviews/wave104/_map.md:9-22` record pass after the documented fix/re-verification loops. Commit `6645c2fe9a98a99bc999eefa4f81c50af3ed3807` is an ancestor. Current source evidence: `renderView` resolves the live session and sidecar (`apps/authoring-host/src/perception/render-view-command.ts:50-111`), measurement uses the same gated evaluation path (`measurement-command.ts:37-77`), and model framing uses visible-only evaluated bounds (`evaluated-bounds.ts:112-127`). The final report records 51 authoring-host tests, 107 ai-interface tests, 37 render-software tests, 126/126 derived-verified texture dimensions, and pass at `waves/wave104/wave104-final-integration-report.md:35-39,56-67`.
- Wave105 is technically closed: `waves/wave105/_map.md:9-28` and `reviews/wave105/_map.md:9-18` record pass, including the P5 test-only fix. Commit `1f072704ae9563a4a3e6d770b74f08b7979bf375` is an ancestor. The current variant gate is snapshot-level `base visible && predicate` (`apps/authoring-host/src/perception/evaluation-adapter.ts:29-37,92-127`), and render/measurement/framing consume that same snapshot (`render-view-command.ts:56-111`, `measurement-command.ts:37-77`, `evaluated-bounds.ts:112-127`). The final report records 241 focused tests, root/app typecheck green, no forbidden-scope changes at `waves/wave105/wave105-final-integration-report.md:26-42`.

Equipment status therefore is: **hand** (authoring-host CLI), **retina** (software rasterizer), **eye** (`renderView`/framing/contact sheet/sidecar), **tape** (`inspectEvaluatedGeometry`), and **health check** (`validatePackage`) all exist and are wired through the normal host path. This matches the current-state summary at `discussion/model-authoring/_map.md:40-44`.

### Human/visual gate state

- The historical Wave104/Wave105 final reports correctly said the visual gate was outside the technical wave gate (`waves/wave104/wave104-final-integration-report.md:95-108`; `waves/wave105/wave105-final-integration-report.md:72-78`). Those are historical evidence, not current-state claims.
- The model-authoring current map records the user’s 2026-07-03 approval (“完璧だ、これであっている”) for the three Default-outfit PNGs at `discussion/model-authoring/_map.md:58-64`. This is the current repository’s only explicit human visual-gate verdict.
- The artifact identity needs re-confirmation: commit `45d2734fa4e77e35299ac5c83916cff4567dec73` (2026-07-26) replaced all three `experiments/ref-render-gate/*.png` files (binary size changes are recorded by `git show --stat 45d2734`). Their sidecars still report package revision 1844 and current `ref-rest-full` is 389×1024, while the README still says 392×1024 at `experiments/ref-render-gate/README.md:33-35,54-58`. No separate user-gate statement for the post-45d PNG bytes was found. Treat “the old Wave105 PNG gate passed” and “the current PNG bytes are approved” as different facts until the user confirms they are equivalent.

## 4. Wave107: relationship and missing orchestration coverage

Wave107 is an **intentionally historical implementation evidence map**, not a current authoring-host state map. Its implementation map records final clean-review pass and the real-device gate pending at `discussion/implementation/waves/wave107/_map.md:9-13,40-45`; its final report records the same at `wave107-final-integration-report.md:7-11,68-95`. Commit `19006ac2678e92b9f59452b7233b2c018a6d7e1` (plus follow-up commits `dd906b5` and `f0ecc21`) is reachable from HEAD. Wave107 changes are runtime-player-only; the final review explicitly records `apps/runtime-player/**` only and zero `packages/**`, editor, authoring-host, or lockfile changes (`wave107-final-integration-report.md:30-34,50-66`).

There are three structural index gaps:

1. `discussion/implementation/orchestration/_map.md:112-116` lists Waves 103–106 and 108 but **has no Wave107 entry**.
2. `discussion/implementation/_map.md` has no 103–108 entries at all (the map remains a pre-wave historical parent).
3. `discussion/implementation/reviews/wave107/_map.md` does not exist, although the wave map links three review files individually (`waves/wave107/_map.md:15-21`). Wave107 review evidence is present, but the standard review-map coverage used by Waves 103–105 is missing.

Wave107’s historical “nearest-reference argmax / single non-zero vowel” description must not be mistaken for the current runtime-player contract. Later runtime-player Waves 22/23 intentionally changed mouth-open coupling and lifted cp17 to a normalized five-vowel blend (`discussion/design/vowel-lipsync-mapping.md:3-5`; current `apps/runtime-player/src/main/live-mapping/vowel-lipsync-estimator.ts:49-60,311-365` and `runtime-parameter-frame.ts:172-184,264-270`). Thus Wave107 remains correct as a historical snapshot, while a current cross-topic map must point to Wave22/23 for live semantics.

## 5. Information-type separation

- **Repository facts:** the three authoring capabilities and their source paths above; target paths are git-clean (`git status --short -- apps/authoring-host packages/render-software apps/runtime-player` returned no target changes); commits `2f80ca0`, `6645c2f`, `1f07270`, and `19006ac` are ancestors of HEAD.
- **Design/user decisions:** ai-interface dry-run/auto-approval and direct live-session perception are recorded as settled at `discussion/model-authoring/_map.md:71-76`; the 2026-07-03 human PNG approval is recorded at `:58-64`; Wave107 real-device verification remains a user gate (`wave107-final-integration-report.md:68-70`).
- **Experiment/review results:** the wave maps and final reports are pass evidence as-of each wave; Wave107’s 62 vowel tests and pre-existing red ledger are historical observations (`wave107-final-integration-report.md:36-66`), not a claim that the later runtime-player blend behavior was part of Wave107.
- **Inference:** the root model-authoring “next action = closed problem 02” is stale because cp02–cp19 and second-cycle craft work are already recorded as passed. The exact next new closed-problem scope is not inferable from repository facts alone.

## 6. True next action and user decisions

1. **Current runtime-player gate:** perform the Wave107 → Wave22/23 real-device user gate (live vowel speech; transition smoothness, no jitter/flicker, closed-mouth zero/finite-zero behavior, toggle and strength). The implementation/review work is complete; this is the explicitly documented remaining gate.
2. **Current authoring track:** do not start “closed problem 02” merely because the root map says so. Decide whether the next action is (a) a new closed-problem scope after the completed 01–19/second-cycle/third-run evidence, or (b) a fresh visual recertification of the post-45d render-gate PNGs.
3. **Map integration:** after audit, add Wave107 and its review coverage to the implementation parent index (including a deliberate decision whether to create the missing `reviews/wave107/_map.md`). Also add/index the Wave107 player-survey artifacts under model-authoring research or explicitly classify them as cross-topic runtime-player evidence.
4. **Open technical/user choices:** classify the 97 strict-ref validation errors, decide whether absolute sidecar paths need portability work, and decide whether current PNG bytes are covered by the 2026-07-03 approval. These are non-blocking follow-ups, not evidence that the equipment is missing.

## 7. Verification limits

- I attempted focused Vitest execution for authoring-host, render-software, and Wave107 vowel suites. Both root and app-local invocations failed before test collection with Windows `spawn EPERM` while Vitest bundled `vitest.config.ts` through esbuild. The pass counts in this report therefore come from the committed wave reports/reviews, not a fresh test run in this sandbox.
- I did not perform the physical user gates; the 2026-07-03 visual approval and the Wave107 real-device gate are reported repository facts/user decisions, respectively. The post-45d PNG approval is not independently evidenced.
- No existing map, source, test, configuration, or another agent’s report was modified.
