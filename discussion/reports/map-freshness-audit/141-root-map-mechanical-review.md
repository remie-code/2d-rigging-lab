# Final root-map mechanical review

> 2026-08-08 (Asia/Tokyo). Review-only pass after `140-root-map-update.md`; audit basis is `map-update-contract.md` and the passing re-review in `130-map-update-mechanical-review.md`.

## Verdict

**PASS — no blocking mechanical findings.** The root update leaves all current relative targets resolvable, preserves the pre-root parent-registration pass, introduces no new orphan candidate, and stays inside the authorized map/report scope. The six remaining orphan candidates are exactly the six candidates carried forward by the 130 baseline re-review.

## Scope and evidence

- Reviewed `discussion/_map.md`, every current `discussion/**/_map.md`, `map-update-contract.md`, `130-map-update-mechanical-review.md`, and `140-root-map-update.md`.
- Root map is the only map changed by the 140 owner; this report is the only file written by this review. No map, source, test, design body, generated artifact, stage, or commit was changed.
- The worktree has no staged paths and no unmerged paths. The only non-map paths are the explicitly preserved user changes (`.codex/agents/{gnome,sylph}.toml`, `.codex/skills/context-check/{DESIGN,SKILL}.md`, and `discussion/expo.zip`) plus authorized audit reports.

## Current mechanical counts

| Check | 130 re-review | Current after root update | Result |
|---|---:|---:|---|
| Current `_map.md` files | 316 | **316** | pass |
| Relative links scanned | 3,959 | **3,965** | all current targets resolve |
| Broken relative-link occurrences | 0 | **0** | pass |
| Unique map-link edges | 475 | **476** | pass; one additional edge, no new unreachable map |
| Root-reachable maps | 310 | **310** | pass |
| Orphan candidates | 6 | **6** | baseline-only; no new orphan |
| Direct parent/child pairs | 59 | **59** | pass |
| Missing direct registrations | 0 | **0** | pass |
| Markdown table blocks / pipe rows | — | **435 / 3,847** | 0 inconsistent column blocks |
| Inline-link delimiter mismatches | — | **0** | pass |
| `git diff --check -- .` | pass | **pass (exit 0)** | only expected LF→CRLF warnings |

The six orphan candidates are unchanged from the 130 baseline: `implementation/reviews/wave69`, `runtime-player/implementation/reviews/wave1`, `runtime-player/implementation/reviews/wave2`, `runtime-player/implementation/reviews/wave12`, `runtime-player/implementation/waves/wave1`, and `runtime-player/implementation/waves/wave2`. They are historical index candidates, not broken-link findings.

## Root scope, registrations, and audit discoverability

- The root directory table covers all 16 intended top-level topic maps (`concept`, `acceptance-criteria`, `scenarios`, `design`, `demo`, `proposal`, `development_convention`, `implementation`, `runtime-player`, `model-authoring`, `mesh-generation`, `render-performance`, `editor-electron-migration`, `ai-cohost`, `expo`, and `reports`). Directory links normalize to each child `_map.md`; the direct parent check found 59 expected pairs and no missing registration.
- Additional root links to `implementation/orchestration/_map.md`, `implementation/waves/wave106/_map.md`, `runtime-player/implementation/_map.md`, and the historical `reports/editor-render-performance/` route to existing maps and are current-owner/evidence references, not broken or unindexed targets. Root reachability remains 310.
- Audit registration remains reachable through `discussion/_map.md` → `reports/` → `discussion/reports/_map.md` → `map-freshness-audit/`. The audit index has a discoverable `141-root-map-mechanical-review.md` row. Its plain code text and `In progress` status are the expected coordination state until both final reviews complete, not a graph or path failure.

## Findings and ownership

### N1 — persisted historical orphan candidates (nonblocking)

The six paths listed above remain outside the root map-link graph, exactly matching the 130 re-review set. No new map became orphaned during the root update. **Owner: earlier implementation/runtime parent updaters (121/122), if full graph reachability is later required.**

### N2 — repeated detail targets (nonblocking)

Repeated-target scanning reports 466 excess references (`n−1` per repeated target) across 101 maps, compared with 456 in the 130 report. The root map itself contributes 25 excess repeats, chiefly because current-owner maps are named in the directory table, state summary, next actions, and unresolved-gate rows. These are readable legacy/detail repetitions; they do not create malformed links or graph ambiguity. **Owner: root updater (140) for any future root deduplication; topic parent owners for pre-existing child repetitions.**

No blocking finding remains. Created-map verification also passes: all 35 untracked map indexes (34 updater-created maps plus the audit index) have a non-empty backing-artifact directory, and no purged Wave51–55 directory was recreated.

## Handoff

Final mechanical status is **PASS**. Semantic freshness and gate wording remain the responsibility of `142-root-map-semantic-review.md`; this report recommends no map edits.
