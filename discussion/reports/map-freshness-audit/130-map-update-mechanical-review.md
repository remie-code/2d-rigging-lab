# Map update mechanical review

> Pre-root mechanical review of the child and parent map update pass. Audit basis: `3c3669eefcc375c62d1ec6b4d77a000d7cbbb61c`, `map-update-contract.md`, `01-mechanical-inventory.md`, and updater reports `110`–`123`.

## Verdict

**Initial review: needs-fix; superseded by the re-review below.** The initial blocking index defect was corrected by the implementation-parent owner.

| Finding class | Count |
|---|---:|
| Blocking | 1 |
| Nonblocking | 3 |
| Relative links scanned (current maps) | 3,954 |
| Broken relative links (current) | 0 |
| Current `_map.md` files | 316 |

## Scope and ownership audit

The worktree contains **86 tracked modified maps + 35 untracked maps = 121 map paths**. The 35 untracked maps include the pre-existing audit index (`discussion/reports/map-freshness-audit/_map.md`); the updater-owned set is therefore **120 maps**, matching the counts in reports `110`–`123`:

| Updater | Changed/created map paths observed |
|---|---:|
| 110 | 5 |
| 111 | 5 |
| 112 | 8 |
| 113 | 16 (12 changed + 4 created) |
| 114 | 3 |
| 115 | 5 |
| 116 | 6 |
| 117 | 8 |
| 118 | 34 (7 changed + 27 created) |
| 119 | 19 (16 changed + 3 created) |
| 120 | 1 |
| 121 | 2 |
| 122 | 7 |
| 123 | 1 |

Excluding that pre-existing audit index, mechanical ownership matching found **no unmatched map path and no duplicate owner assignment**. There are no staged, unmerged, or lock files, so no concurrent overwrite signal was found. The only tracked non-map changes are the explicitly pre-existing `.codex/agents/gnome.toml` and `.codex/agents/sylph.toml`; the explicitly pre-existing `.codex/skills/context-check/{DESIGN.md,SKILL.md}` and `discussion/expo.zip` are untouched. All other untracked non-map files are authorized audit reports under `discussion/reports/map-freshness-audit/`. No source, test, product artifact, or unrelated configuration change is present.

Created map backing check: all 34 newly-created updater maps and the audit map have a non-empty backing-artifact directory (minimum one non-`_map.md` file); no purged Wave51–55 directory was recreated.

## Link, registration, and graph checks

The current-worktree scan decoded URL-encoded targets, resolved relative paths, accepted existing directories, and normalized directory links to child `_map.md` edges.

| Check | Baseline (`01`) | Current | Result |
|---|---:|---:|---|
| `_map.md` files | 281 | 316 | +35 (created indexes/audit index) |
| Relative links | 3,480 | 3,954 | all current targets resolve |
| Broken relative-link occurrences | 22 | 0 | **pass** (20 unique purged targets removed) |
| Direct parent/child map pairs | 58 | 59 | audit child adds one pair |
| Missing direct registrations | 1 | 0 | **pass**; implementation → orchestration fixed |
| Unique map-link edges | 326 | 472 | +146 |
| Root-reachable maps | 236 | 309 | +73 |
| Orphan candidates | 45 | 7 | −38 |

### Blocking finding B1 — newly-created Wave22 review map is unindexed

`discussion/implementation/reviews/wave22/_map.md` is a newly-created map with backing review artifacts, but it has no path in the root-normalized map graph. The implementation parent links the review artifact (`discussion/implementation/_map.md:119,341`) but not the new review map, while report `121-implementation-parent-update.md` claims that every extant implementation/review map through Wave109 is routed. Add the map link (or an explicit, deliberate absent-index row) in the implementation parent. **Owner: `121-implementation-parent-update.md` / implementation parent updater.**

### Nonblocking orphan baseline (N1)

Six orphan candidates persist from the pinned baseline and were not introduced by this pass: `implementation/reviews/wave69`, `runtime-player/implementation/reviews/wave1`, `wave2`, `wave12`, and `runtime-player/implementation/waves/wave1`, `wave2`. They remain reachable through artifact/prose links and are historical indexes rather than broken targets. If full graph reachability is required, route the Editor item through **121** and the Runtime Player items through **122**; otherwise retain as documented historical orphan candidates.

## Markdown integrity and parent duplication

- Table scan over all 316 maps: **440 table blocks / 3,850 pipe rows; 0 inconsistent column-count blocks**.
- Inline-link delimiter scan: **0 mismatched `[]()` pairs**.
- Per-map duplicate heading names: **0** (same heading names across different historical maps are expected).
- `git diff --check -- .`: exit 0; only normal LF→CRLF conversion warnings were emitted.
- Additional read-only whitespace scan found one trailing-space line in the pre-existing audit input `discussion/reports/map-freshness-audit/20-editor-waves-000-028.md:3`; it is outside updater ownership and nonblocking.

Parent maps retain repeated evidence links, but no malformed table/link resulted. Current duplicate-target references are 456 across 101 maps (baseline 424 across 73 maps). The largest parent-level counts are `implementation/_map.md` 156, `runtime-player/implementation/_map.md` 34, `implementation/orchestration/_map.md` 36, `runtime-player/_map.md` 11, and `design/_map.md` 8. These are mostly legacy summary/table repeats; increases are nonblocking lightweight-parent maintenance items for owners **120 (design), 121 (implementation), 122 (runtime), and 123 (reports)**.

## Handoff

Blocking owner correction B1 must land before treating the pre-root mechanical review as pass. After that correction, the current link/registration/table checks are mechanically clean; semantic freshness and root-map decisions remain with reports `131`, `140`, `141`, and `142`.

## Re-review (correction pass)

The implementation-parent owner added the missing `[reviews/wave22/_map.md](../../implementation/reviews/wave22/_map.md)` registration at `discussion/implementation/_map.md:341`. A fresh scan of every current `discussion/**/_map.md` confirms that the blocking orphan is resolved.

| Check | Re-review result |
|---|---:|
| Current `_map.md` files | 316 |
| Relative links scanned | 3,959 |
| Broken relative links | 0 |
| Unique map-link edges | 475 |
| Root-reachable maps | 310 |
| Orphan candidates | 6 (all persisted baseline candidates; no new orphan) |
| Direct parent/child pairs / missing registrations | 59 / 0 |
| Out-of-scope status paths | 0 |
| `git diff --check -- .` | pass (exit 0; LF→CRLF warnings only) |

The six remaining orphans are exactly the baseline set listed in N1; no new map, broken link, ownership overlap, staged/unmerged state, or source/config/test edit was introduced. **Final mechanical verdict: PASS.**
