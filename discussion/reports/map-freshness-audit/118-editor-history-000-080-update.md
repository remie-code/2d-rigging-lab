# Editor history Wave 0–80 map update

> Map-update contract report for the exclusive Wave 0–80 implementation/review leaf maps. Audit basis: `20-editor-waves-000-028.md`, `21-editor-waves-029-058.md`, `22-editor-waves-059-080.md`, `60-editor-integration.md`, and `01-mechanical-inventory.md`.

## Scope and ownership

- Inspected every existing `discussion/implementation/waves/wave0..80/_map.md` and `discussion/implementation/reviews/wave0..80/_map.md` in the current tree, excluding purged Wave51–55 directories (no artifacts exist to index).
- Inspected the artifact directories for missing indexes in Wave16, Wave42–50, Wave56–59 and their reviews.
- Edited only owned leaf maps and this report. Parent implementation/orchestration maps, root maps, source, tests, and non-map artifacts were left untouched.

## Counts

| Category | Count | Paths / notes |
|---|---:|---|
| Existing owned maps inspected | 125 | 63 wave maps + 62 review maps (0–80, excluding purged 51–55) |
| Maps changed | 7 | `waves/wave61`, `wave68`, `wave69`, `wave70`, `wave71`, `wave75`, `wave80` |
| Maps created | 27 | 13 wave maps (`wave16`, `wave42–50`, `wave56–58`) + 14 review maps (`wave16`, `wave22`, `wave43–50`, `wave56–59`) |
| Existing maps intentionally unchanged | 118 | Remaining existing owned maps; recorded pass/history evidence remains valid |
| Purged maps intentionally not recreated | 10 | `waves/reviews/wave51..55`; Git-history-only implication recorded below |

The created maps are historical indexes because each corresponding artifact directory contains reports/reviews and an index is useful. Wave56 is explicitly indexed as an abandoned/reset boundary; Wave57/58 carry the post-reset foundation and PSD Import evidence. Wave51–55 were removed by purge commit `99a31c8`; no fabricated files or current claims were added.

## Time-qualified historical claims

The seven audit-identified current-sounding claims were qualified without changing their recorded wave gates:

1. `waves/wave61/_map.md` now labels Wave61's GUI baseline as a historical 2026-06-10 closeout and points current planning to the accepted Wave102 mainline stopping baseline.
2. `waves/wave68/_map.md` now distinguishes the v6A/B/C implementation/pass evidence from the later v6D route and labels the temporary selector as Wave68 history.
3. `waves/wave69/_map.md` now time-qualifies the v2.6 default and “later backend selection” language; Wave70/71 route changes are named as subsequent history.
4. `waves/wave70/_map.md` now labels the support-ring default as the Wave70 route, superseded by Wave71 adaptive-contour routing.
5. `waves/wave71/_map.md` now labels adaptive-staggered-band as the Wave71 route and records the later current-source default (`auto-outline-v6d-adaptive-contour-constrainautor`).
6. `waves/wave75/_map.md` now labels Wave75 as its closeout baseline and points current planning to Wave102.
7. `waves/wave80/_map.md` now labels dynamics/export exclusions as a Wave80-era scope snapshot and records Wave84 Viewer Dynamics / Wave92 Runtime Export as later evidence.

Evidence for the qualifications is the audit's current-source and integration checks: `discussion/_map.md:63-64` (accepted Wave102 stopping baseline), `apps/editor/src/features/editor-session/model/mesh-tool-state.ts:70-71` (current mesh default), `discussion/implementation/orchestration/_map.md:125-127,138,146` (later mesh/viewer/export waves), and `22-editor-waves-059-080.md` / `60-editor-integration.md` claim tables.

## Decisions and gates preserved

- Every existing wave/review final `pass`/`complete` gate remains unchanged; intermediate `needs_fix`/`needs_changes` artifacts remain historical evidence.
- Wave68–71 backend implementation evidence and Wave76 fake-GL residual are not rewritten into a new product decision.
- Wave102 remains the accepted Editor mainline stop; later specialized waves are not silently merged into that mainline.
- Wave51–55 remain Git-history-only/purged. Their old parent-map links are outside this ownership and must be corrected by the parent-map owners.
- Historical Wave56 abandonment/reset boundary and the bounded PSD/parser/materialization non-goals remain explicit.

## Verification

- Relative Markdown-link check over all 152 owned maps (existing + created, 0–80 excluding purged directories): **0 missing links**.
- `git diff --check -- discussion/implementation/waves/... discussion/implementation/reviews/...`: pass (only repository LF/CRLF conversion warnings where Git reports them).
- No stage, commit, checkout, reset, or source/test command was run.

## Remaining issues outside ownership

- Parent `discussion/implementation/_map.md`, `discussion/implementation/orchestration/_map.md`, `discussion/_map.md`, and current-capability/backlog wording still require the Phase 2 owners' refresh (including purged Wave51–55 links and old “latest baseline” prose).
- Wave81+ maps/reviews, including the optional missing Wave107 review index, are outside this report's Wave0–80 ownership.
- Any user/device/human acceptance gates and current product-scope decisions remain unresolved unless their owning maps already provide evidence.
