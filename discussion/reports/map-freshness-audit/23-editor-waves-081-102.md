# Editor Waves 81-102 Freshness Audit

## Scope and baseline

- Audit boundary: Wave81 through Wave102 only (dynamics, diagnostics, mesh repair/generation, texture atlas, save/export, lifecycle, performance, variants, and the Wave102 Editor stopping-point claim).
- Audit baseline: Git `3c3669eefcc375c62d1ec6b4d77a000d7cbbb61c` (2026-08-08, Asia/Tokyo), confirmed with `git rev-parse HEAD`.
- Existing worktree changes were not modified. `git status --short` shows only the contract-listed agent files, `discussion/reports/_map.md`, `discussion/expo.zip`, and this audit output tree; no audited `apps/editor`, `packages`, or Wave81-102 artifact source changes are present.
- Wave plans are intent artifacts and retain `Status: Planned / ready for orchestration`; actual completion is taken from each wave's final report and final clean review, not from the immutable plan header.

## Maps checked

Living maps:

- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`

Wave implementation maps (all checked):

- `discussion/implementation/waves/wave81/_map.md`, `discussion/implementation/waves/wave82/_map.md`, `discussion/implementation/waves/wave83/_map.md`, `discussion/implementation/waves/wave84/_map.md`, `discussion/implementation/waves/wave85/_map.md`, `discussion/implementation/waves/wave86/_map.md`
- `discussion/implementation/waves/wave87/_map.md`, `discussion/implementation/waves/wave88/_map.md`, `discussion/implementation/waves/wave89/_map.md`, `discussion/implementation/waves/wave90/_map.md`, `discussion/implementation/waves/wave91/_map.md`, `discussion/implementation/waves/wave92/_map.md`
- `discussion/implementation/waves/wave93/_map.md`, `discussion/implementation/waves/wave94/_map.md`, `discussion/implementation/waves/wave95/_map.md`, `discussion/implementation/waves/wave96/_map.md`, `discussion/implementation/waves/wave97/_map.md`, `discussion/implementation/waves/wave98/_map.md`
- `discussion/implementation/waves/wave99/_map.md`, `discussion/implementation/waves/wave100/_map.md`, `discussion/implementation/waves/wave101/_map.md`, `discussion/implementation/waves/wave102/_map.md`

Wave review maps (all checked):

- `discussion/implementation/reviews/wave81/_map.md`, `discussion/implementation/reviews/wave82/_map.md`, `discussion/implementation/reviews/wave83/_map.md`, `discussion/implementation/reviews/wave84/_map.md`, `discussion/implementation/reviews/wave85/_map.md`, `discussion/implementation/reviews/wave86/_map.md`
- `discussion/implementation/reviews/wave87/_map.md`, `discussion/implementation/reviews/wave88/_map.md`, `discussion/implementation/reviews/wave89/_map.md`, `discussion/implementation/reviews/wave90/_map.md`, `discussion/implementation/reviews/wave91/_map.md`, `discussion/implementation/reviews/wave92/_map.md`
- `discussion/implementation/reviews/wave93/_map.md`, `discussion/implementation/reviews/wave94/_map.md`, `discussion/implementation/reviews/wave95/_map.md`, `discussion/implementation/reviews/wave96/_map.md`, `discussion/implementation/reviews/wave97/_map.md`, `discussion/implementation/reviews/wave98/_map.md`
- `discussion/implementation/reviews/wave99/_map.md`, `discussion/implementation/reviews/wave100/_map.md`, `discussion/implementation/reviews/wave101/_map.md`, `discussion/implementation/reviews/wave102/_map.md`

Also checked `discussion/implementation/orchestration/wave81-plan.md` through `wave102-plan.md`, every Wave81-102 final integration report under `discussion/implementation/waves/waveN/`, every `waveN-final-clean-integration-review.md` under `discussion/implementation/reviews/waveN/`, and the current source/Git state for the claims below.

## Wave evidence and actual status

All 22 waves have a final report and a final clean review. The wave/review maps are historical evidence indexes, not current-state maps; their closeout claims remain internally supported and links resolve.

| Waves | Scope represented by the artifacts | Actual closeout evidence |
|---|---|---|
| 81-84 | Dynamics v2/additive runtime, scrub performance, time-progression preview/Quick Tune, then Viewer playback/solver consolidation | Wave81 final complete/pass after Fix Loop 1 (`waves/wave81/_map.md:8-10`, `reviews/wave81/_map.md:7`); Wave82 pass (`waves/wave82/_map.md:6-8`, `reviews/wave82/_map.md:5-6`); Wave83/84 pass after their recorded fix loops (`waves/wave83/_map.md:6-8`, `waves/wave84/_map.md:6-8`, `reviews/wave84/_map.md:6-8`). |
| 85-86 | Editor-local Diagnostics screen/badges/jumps/tree surfacing; bounded v6D crossing diagnostics and one-point repair | Wave85 final complete/pass (`waves/wave85/_map.md:5`, `reviews/wave85/_map.md:5`); Wave86 final complete/pass (`waves/wave86/_map.md:5`, `reviews/wave86/_map.md:5`). |
| 87-89 | Texture Atlas v0, artifact-only Apply + Viewer Original/Atlas Runtime, then Atlas/Viewer performance and scope guards | Wave87 initial Apply-boundary escalation was resolved by Fix Loop 1 and final pass (`waves/wave87/_map.md:5-7`, `reviews/wave87/_map.md:5`); Wave88 pass (`waves/wave88/_map.md:5-7`); Wave89 Domain A/B/final all pass (`waves/wave89/_map.md:7-10`, `reviews/wave89/_map.md:7-9`). |
| 90-92 | Workspace Save v0, deformer lifecycle cleanup, Runtime Export v0 | Wave90 reports and final integration are pass (`waves/wave90/_map.md:9-17`, `reviews/wave90/_map.md:9-19`); Wave91 pass (`waves/wave91/_map.md:3,9-11`, `reviews/wave91/_map.md:3,9-11`); Wave92 final complete/pass (`waves/wave92/_map.md:7,13-15`, `reviews/wave92/_map.md:7,13-15`). |
| 93-98 | History binary de-dup; nested Warp rest/bind parity; multi-alpha-island mesh generation; Viewer Atlas cache; idle Dynamics throttle; duplicate evaluation removal/instrumentation | Wave93-95 final maps and reviews all pass (`waves/wave93/_map.md:7,13-14`, `waves/wave94/_map.md:7,13-16`, `waves/wave95/_map.md:7,13-15`, corresponding review maps at the same paths); Wave96/97 final integration and review pass (`waves/wave96/_map.md:7-10`, `waves/wave97/_map.md:7-10`, review maps `:7-8`); Wave98 implementation/review maps record pass for all lanes (`waves/wave98/_map.md:5-12`, `reviews/wave98/_map.md:5-8`). |
| 99-102 | Variant model/manager and Canvas preview; Viewer Variant switching; Skyline packing + Blocking Issues; Runtime Export `baseVisible` visibility foundation | Wave99 all domains pass after Fix Loop 1 (`waves/wave99/_map.md:9-12`, `reviews/wave99/_map.md:9-27`); Wave100 pass (`waves/wave100/_map.md:9-16`, `reviews/wave100/_map.md:9-17`); Wave101 final report says `Verdict: pass` and final clean review `pass` (`waves/wave101/wave101-final-integration-report.md:7-15`), with both wave/review maps pass (`waves/wave101/_map.md:9-21`, `reviews/wave101/_map.md:9-24`); Wave102 all domains/final review pass (`waves/wave102/_map.md:9-18`, `reviews/wave102/_map.md:9-24`). |

Current source corroborates the last two implementation claims: `single-page-skyline-v1` is present in `packages/authoring-core/src/texture-atlas-packing.ts:29`, accepted by `packages/package-format/src/texture-atlas.ts:154`, and exercised by the Editor atlas test; `baseVisible` is optional in `packages/package-format/src/runtime-export.ts:335` and emitted/materialized in `packages/authoring-core/src/runtime-export-materialization.ts:146-155`.

## Map classification

| Map set | Type | Verdict | Basis |
|---|---|---|---|
| `discussion/implementation/_map.md` | `living-current-state` + `living-index` | **Partially stale** | It says the latest basis is Wave57-Wave80 and points to post-Wave80 backlog (`:23-24`), while its entries jump from Wave88 to Wave93 (`:50-58`) and omit Wave89-92 and Wave94-102. A no-match `rg` check for those wave labels confirms the omission. Historical child links that are present remain valid. |
| `discussion/implementation/orchestration/_map.md` | `living-index` | **Partially stale** | Its plan table correctly lists Wave89-102 (`:98-111`) but incorrectly leaves Wave101 as `Planned / ready for orchestration` at `:110`, contradicted by the Wave101 final report/review above. Its Current Decision narrative stops at Wave93 (`:141-147`), and the self-note still claims Wave58-102 entries are unlisted (`:211`) despite the table containing them. |
| 22 implementation maps `waves/wave81/_map.md` … `waves/wave102/_map.md` | `historical-evidence-index` | **Intentionally historical** | Each records the wave's closeout evidence, residual risks, and/or fix-loop history. Later waves do not make a historical closeout stale; no broken child-link or contradicted closeout status was found. |
| 22 review maps `reviews/wave81/_map.md` … `reviews/wave102/_map.md` | `historical-evidence-index` | **Intentionally historical** | Review verdicts and fix-loop/re-review traces remain supported by the linked reports. |

Count for this assigned scope: **44 intentionally historical, 2 partially stale, 0 stale, 0 unverifiable**.

## Planned-versus-actual and Editor stopping-point boundary

- The Wave101 plan header remains `Planned / ready for orchestration` (`orchestration/wave101-plan.md:7`), but the implementation map, final report, and final clean review all record pass. This is an orchestration-map status bug, not evidence that Wave101 was unimplemented.
- The root map describes “Editor implementation completed/stopped at Wave102” as a user decision (`discussion/_map.md:63-64,77`) and separately records the known `implementation/_map.md` Wave94-102 backfill omission (`discussion/_map.md:97`). That is a design/policy statement, not a proof that no later Editor code exists.
- Boundary implication only (post-102 waves were not adjudicated here): the Git ancestry from the Wave102 commit (`d2e7b7e`) to current HEAD contains later `apps/editor` commits, including `356959c` (`dynamicsまで対応した`), `e4e8c9d` (Editor performance), Electron migration commits, and later mesh/PSD fixes. Wave106's own plan/map also explicitly names an Editor Dynamics Tool domain (`orchestration/wave106-plan.md:14`, `waves/wave106/_map.md:13`). Therefore “stopped at Wave102” must be clarified as either (a) the intended Wave102 baseline/scope freeze or (b) a literal no-later-Editor-change claim; the latter is contradicted by repository history. This audit does not assess Wave103+ correctness.

## Information-type separation

- Repository facts: map contents and line references above; all Wave81-102 final reports/reviews exist; current source matches Skyline and `baseVisible`; HEAD and clean audited source status were checked.
- Experimental/verification results: pass/fix-loop and residual-risk statements are reported observations from the wave final reports/reviews, not independent re-runs. Typical residuals remain explicitly non-blocking (browser/manual visual proof, FSA picker E2E, immutable-byte assumptions, cache profiling, Skyline no-candidate coverage, and similar wave-local gaps).
- Design/policy decisions: Wave102 intentionally excludes Runtime Player Variant UI and later root-map “Editor stopped” wording is a user decision; these should not be rewritten as implementation facts.
- Inference: the two living implementation maps are partially stale because their current/index sections lag the child artifacts; the literal stopping-point interpretation is unresolved at the post-102 boundary.

## Parent-map conclusion

Wave81-102 evidence is complete and pass-classified across dynamics, diagnostics, mesh repair/islands, atlas, workspace save/export, lifecycle, performance, and variants. Keep all 44 wave/review maps as intentionally historical. Parent maps should correct the Wave101 orchestration status, backfill implementation `_map` entries for Wave89-92 and Wave94-102, remove the contradictory “Wave58-102 unlisted” note, and explicitly qualify the Wave102 Editor stopping-point sentence against later repository history.

## Unresolved and out of scope

- User decision needed only for the meaning of “Editor stopped at Wave102” (baseline freeze versus literal final Editor change). No Wave81-102 implementation blocker was found.
- Post-102 waves (103 onward), their implementation correctness, and their own maps/reviews were not adjudicated; only the boundary implication above was recorded.
