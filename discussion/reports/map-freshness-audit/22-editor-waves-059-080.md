# Editor Waves 59–80 Map-Freshness Audit

Audit date: 2026-08-08 (Asia/Tokyo). Basis: `audit-contract.md`, `discussion/_map.md`, repository HEAD `3c3669eefcc375c62d1ec6b4d77a000d7cbbb61c`, and the current worktree. The wave maps and review maps are historical evidence; a `pass` below means that the wave gate was recorded as passed, not that the feature is the current product baseline.

## Coverage and verdict inventory

| Checked artifact family | Count | Role / observed verdict |
|---|---:|---|
| `discussion/implementation/orchestration/wave59-plan.md` … `wave80-plan.md` | 22 | Authoring-time plans. W59–67 still say `Planned`; W68–69 say `Final complete / pass`; W70–80 say `Planned / ready for orchestration`. These are intentionally historical plan states, not current gate verdicts. |
| `discussion/implementation/waves/wave59/_map.md` … `wave80/_map.md` | 22 | Every map exists and records a completed/pass gate (W59 `complete / pass`, W60–65 `complete / pass`, W66–68 `final complete / pass`, W69–80 final/pass variants). |
| `discussion/implementation/reviews/wave59/_map.md` … `wave80/_map.md` | 21 + 1 missing | W60–80 review maps exist and record final `pass`. W59 has no review `_map.md`; its three lane reports and final clean review exist, so the review-map entry itself is `Unverifiable`/missing. |
| Wave final/closeout reports (`waves/wave59` … `wave80`) | 22 | All final reports/closeouts are present and pass-classified by their local wave maps. W59–60, W61, W69, and W72 retain domain wording such as `done` or `ready for independent review`; the wave map/final clean review is the gate evidence. |

No broken relative links were found inside the 22 wave maps and 21 existing review maps. The per-wave map/review verdicts are recorded below; “historical” means the map is valid as a record of that wave, while “partially stale” identifies a line that would mislead if read as current state.

| Wave | Wave `_map.md` | Review `_map.md` / final clean review | Freshness finding |
|---:|---|---|---|
| 59 | `complete / pass` | Review map missing (`Unverifiable`); final clean review `pass` | Historical. PSD clipping remains a recorded residual. |
| 60 | `pass` after one fix loop | Present; final `pass` | Historical; DnD outcome is explicitly recorded. |
| 61 | Domain D/final `pass` | Present; 9/9 lanes and final `pass` | **Partially stale:** `waves/wave61/_map.md:47` calls W61 the “current implementation-proven Editor GUI baseline”; root map says the Editor stopped at W102 (`discussion/_map.md:63-64`). |
| 62 | `complete / pass` | Present; final `pass` | Historical. |
| 63 | `complete / pass` | Present; all A/B/C lanes and final `pass` | Historical. |
| 64 | `complete / pass` | Present; final `pass` | Historical; closeout fixed earlier pending wording. |
| 65 | `complete / pass` | Present; final `pass` | Historical. |
| 66 | `final complete / pass` | Present; final `pass` | Historical. |
| 67 | `final complete / pass` | Present; final `pass` | Historical. |
| 68 | Domain A–F and final `pass` | Present; final `pass` | **Partially stale:** `waves/wave68/_map.md:28` says v6B/v6C are deferred while the same map `:30-31` and final report `:12-17` record both implemented/pass. |
| 69 | A–E and final `pass` | Present; final `pass` | **Partially stale as temporal guidance:** `waves/wave69/_map.md:29,34,38` says final backend selection remains a later decision; W70/W71 subsequently promoted the v6D lineage and changed the default. |
| 70 | A/B and final `pass` | Present; final `pass` | Historical route claim: `waves/wave70/_map.md:24` is superseded by W71 and the current Editor default. |
| 71 | Domain A and final `pass` | Present; final `pass` | **Partially stale:** `waves/wave71/_map.md:27` says the Editor default is adaptive-staggered-band; current source is `apps/editor/src/features/editor-session/model/mesh-tool-state.ts:70-71` (`auto-outline-v6d-adaptive-contour-constrainautor`). |
| 72 | Combined final `pass` | Present; final `pass` | Historical; Domain A/B report headers use non-final wording but map/review gate is pass-classified. |
| 73 | `final complete / pass` | Present; final `pass` | Historical next-action text about future Rotation translation is superseded by W75. |
| 74 | `final complete / pass` | Present; final `pass` | Historical next-action text about later keyform/deformer authoring is superseded by W75–78. |
| 75 | `final complete / pass` | Present; final `pass` | **Partially stale:** `waves/wave75/_map.md:27` calls W75 the current implementation baseline; W102 is the current Editor stopping point (`discussion/_map.md:63-64`). |
| 76 | `final complete / pass` | Present; final `pass` | Fake-GL-only clipping proof remains a current residual (`waves/wave76/_map.md:38`; `discussion/implementation/remaining-work-backlog.md:126`). |
| 77 | `final complete / pass` | Present; final `pass` | Missing full browser-click wrap-selected E2E remains a non-blocking residual (`waves/wave77/_map.md:47`). |
| 78 | `final complete / pass` | Present; final `pass` | No pixel smoke and no explicit post-commit rest/domain invariant test remain recorded residuals (`waves/wave78/_map.md:44`). |
| 79 | `final complete / pass` | Present; final `pass` | Historical Viewer v0 scope. Later W84 added Dynamics playback; W79’s out-of-scope statement is not current product scope. |
| 80 | `final complete / pass` | Present; final `pass` | **Partially stale as current-scope text:** `waves/wave80/_map.md:30` says dynamics/export remain out of scope; W84 adds Viewer Dynamics playback (`discussion/implementation/orchestration/_map.md:138`) and W92 adds Runtime Export (`discussion/implementation/orchestration/_map.md:146`). |

## Corrections and current evidence

- Editor baseline: W61/W75 “current baseline” lines are historical. The root map records Editor completion at Wave102 and the current work focus (`discussion/_map.md:63-64`); `discussion/implementation/_map.md:53` also records W84 as a later completed Viewer/runtime milestone.
- Mesh route: the W68 deferred sentence is internally contradicted by its own Domain C/D lines. W69’s v6D/v6E/v6F implementation and W70/W71 route changes are recorded in `discussion/implementation/orchestration/_map.md:125-127`. The current source default is `auto-outline-v6d-adaptive-contour-constrainautor` (`apps/editor/src/features/editor-session/model/mesh-tool-state.ts:70-71`), so W70/W71 route statements must be read as historical.
- Viewer scope: current source now includes runtime-core dynamics imports and playback (`apps/editor/src/workspace/viewer/viewer-runtime-playback.ts:16-22`, `viewer-runtime-screen.tsx:213-226`), contradicting a literal reading of W79/W80’s old “dynamics out of scope” text. W84’s map entry is the authoritative correction.
- Wave76’s WebGL residual is not closed by later maps: the repository still has the fake-GL guard and no recorded real `readPixels` proof. Treat it as `Current` risk, not as a failed Wave76 gate.

## Parent-map implications and gaps

1. `discussion/implementation/_map.md:23-24` still describes a “post-Wave80” backlog and says Wave57–80 are the latest state. `remaining-work-backlog.md:3-9` says that backlog was replaced after W84 and that the old Dynamics-before-Viewer premise is obsolete. This parent map text is `Stale`; refresh it to point at the current orchestration map/backlog.
2. `discussion/_map.md:38` still says the Wave53 final report/review is the latest implementation-proven baseline, contradicting `discussion/_map.md:63-64` (Wave102 complete/current work). The line-38 claim is `Stale`.
3. Relative-link checking found missing historical Wave51–55 targets in parent maps, although this W59–80 subtree is link-complete: `discussion/implementation/_map.md:59-61,129,133-149` and `discussion/implementation/orchestration/_map.md:60-64,204-207` point to absent `wave51`–`wave55` plans/reports/reviews (`rg --files discussion/implementation | Select-String 'wave5[1-5]'` returns no files). Classify those parent entries `Unverifiable` until artifacts are restored or links are explicitly marked archived.
4. `discussion/implementation/current-capability-map.md` is already labeled historical/Wave54-era by `discussion/implementation/_map.md:24` and `remaining-work-backlog.md:9,120`; do not use it to re-open W59–80 claims.

## Audit gaps / user-decision points

- The missing W59 review `_map.md` is the only map artifact gap in the requested W59–80 range; final review evidence itself is present.
- Historical residuals that remain actionable are the real WebGL/readPixels clipping proof (W76), browser wrap-selected coverage (W77), Warp post-commit rest/domain invariants and pixel smoke (W78), and any human visual mesh-quality decision after W69–71. These are not grounds to change the recorded wave verdicts.
- No user decision is required to classify the maps. A documentation refresh should decide whether to restore/archive the missing Wave51–55 artifacts and update the contradictory parent “latest baseline” prose.

## Audit commands

- `rg --files discussion/implementation/waves/wave59..wave80` and `rg --files discussion/implementation/reviews/wave59..wave80` for artifact inventory.
- Read-only `Select-String` status/link checks over all wave/review maps and final reports.
- Relative Markdown-link check over all existing W59–80 wave/review maps: no broken links.
- Current-source checks: `apps/editor/src/features/editor-session/model/mesh-tool-state.ts:70-71`, `apps/editor/src/workspace/viewer/viewer-runtime-playback.ts:16-22`, `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:213-226`.
