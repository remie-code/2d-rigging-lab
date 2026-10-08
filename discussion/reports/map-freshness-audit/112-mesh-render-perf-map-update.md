# Mesh / Render / Performance Map Update

> Map-update contract Phase 1 updater report. Audit basis: `3c3669eefcc375c62d1ec6b4d77a000d7cbbb61c` / 2026-08-08. Edits are limited to the maps listed below and this report; no source, tests, design bodies, root maps, runtime maps, staging, or commits.

## 1. Owned maps inspected

- `discussion/design/canvas-evaluation/_map.md`
- `discussion/design/mesh-generation/_map.md`
- `discussion/design/mesh-rendering/_map.md`
- `discussion/design/texture-atlas/_map.md`
- `discussion/mesh-generation/_map.md`
- `discussion/mesh-generation/implementation/_map.md`
- `discussion/render-performance/_map.md`
- `discussion/reports/editor-render-performance/_map.md`

Evidence read before editing:

- `discussion/reports/map-freshness-audit/map-update-contract.md`
- `discussion/reports/map-freshness-audit/11-design-and-conventions.md`
- `discussion/reports/map-freshness-audit/41-mesh-and-rendering.md`
- `discussion/reports/map-freshness-audit/42-render-performance-and-dynamics.md`
- `discussion/reports/map-freshness-audit/62-cross-topic-integration.md`
- `discussion/reports/map-freshness-audit/90-root-map-integration.md`
- Wave66/67/101/108 reports, Wave109 Domain A report, mesh `evaluation-log.md`, Perf Wave 2 measurements, and Runtime Player Waves13–19 evidence.

## 2. Maps changed / created / intentionally unchanged

| Category | Count | Paths |
|---|---:|---|
| Changed maps | 8 | All eight owned maps listed in §1 |
| Created maps | 0 | No missing map under the owned mesh-generation tree required creation |
| Created report | 1 | This file (`112-mesh-render-perf-map-update.md`) |
| Intentionally unchanged owned maps | 0 | — |

## 3. Claims replaced and evidence

### Mesh generation

- Replaced stale `v2.5/v2.6/current next`, backend-selector, and visual-gate-pending wording with the repository current method: `auto-outline-v6d-adaptive-contour-constrainautor` default, `auto-outline-v7-margin-contour` comparison toggle, v6/v7 round-2 user verdict “一長一短”, and Wave 2/v6 deletion hold. Evidence: `41-mesh-and-rendering.md` §§2–5; `discussion/mesh-generation/evaluation-log.md` round 2; `apps/editor/src/features/editor-session/model/mesh-tool-state.ts`.
- Marked Mesh Wave 1, 1.1, 1.2, and 1.3 report/review lanes complete; removed “user visual evaluation pending” and “Wave 1.3 Planned” entry claims. Evidence: Mesh Wave implementation/review artifacts and `41-mesh-and-rendering.md` §4.
- Replaced unresolved UV-clamp wording with Wave108 Option E and Wave109 preflight reconciliation: non-clamped generation UV, size-dependent transparent padding/gutter, LINEAR, contentInset/uvRect shared expectation. Evidence: `wave108-final-integration-report.md`, `wave109-domain-a-uvrect-preflight-report.md`.

### Rendering / atlas / Canvas evaluation

- Canvas evaluation is now indexed as implemented at Wave66; Wave67 renderer consumes evaluated scene data, with semantic/pixel parity and Canvas2D sunset still separate gates. Evidence: `11-design-and-conventions.md` §2–§3; Wave66/67 final reports.
- Mesh rendering now records WebGL2 foundation as implemented (Wave67), Skyline default plus shelf artifact read compatibility (Wave101), and Wave108/109 transparent-margin + preflight contracts. Historical “next WebGL2/V4” wording was removed. Evidence: Wave67, Wave101, Wave108, and Wave109 reports.
- Texture Atlas map now treats `single-page-skyline-v1` as the current default; shelf is compatibility-only. Wave109 non-zero inset preflight is linked as a current contract, not a future plan.

### Performance / dynamics boundary

- Editor Perf Wave2 remains implemented and user-accepted as “Editor の動作として十分”; `real-model-003.md` absence is a conditional measurement fact, not an active acceptance hold.
- Runtime Player Waves13–19 are indexed as completed fast-path / diagnostics / cadence work. Deep profiling is developer/test-only after Wave18 transport removal; OBS/Chrome/Edge is a manual observation, and C7 two-instance strain is optional/unmeasured rather than a product performance failure. Evidence: `42-render-performance-and-dynamics.md` §§4–6; Runtime Player parent map/Wave18–19 reports; C7 closure record.
- Historical `reports/editor-render-performance/_map.md` remains historical and now routes current readers to `render-performance/_map.md`.

## 4. Decisions and gates intentionally preserved

- v6/v7 quality hold, v6 default, v7 comparison toggle, toggle lifetime, and authorization for Wave 2/v6 deletion remain unresolved user decisions.
- Wave108 formal atlasRuntime visual acceptance, real GPU/readPixels/pixel parity, Canvas2D sunset, and any current `original` inset residual remain manual/device gates. Automated tests and clean reviews are not promoted to those gates.
- Wave101 Skyline implementation/pass and Wave109 non-zero-inset preflight fix are implementation facts; they do not imply mesh-quality superiority.
- Editor Perf close is not reopened by the missing numeric 30fps measurement. Runtime Player product deep-profiler transport is not reintroduced.
- Wave106 dynamics v3 is kept as a semantics/schema replacement with no render-performance claim.

## 5. Link and diff verification

- Read-only map inventory: `Get-ChildItem -Recurse -Filter _map.md discussion/mesh-generation` → 2 owned maps; no missing child map created.
- Relative-link spot check over all eight changed maps: links to Wave66/67/101/108/109, evaluation log, mesh-rendering, and render-performance targets resolve to existing files (no new broken links observed).
- `git diff --check -- discussion/design/canvas-evaluation/_map.md discussion/design/mesh-generation/_map.md discussion/design/mesh-rendering/_map.md discussion/design/texture-atlas/_map.md discussion/mesh-generation discussion/render-performance discussion/reports/editor-render-performance discussion/reports/map-freshness-audit/112-mesh-render-perf-map-update.md` → pass (working-tree LF/CRLF warnings only where emitted by Git).
- No stage or commit performed. Existing unrelated worktree changes were preserved.

## 6. Remaining issues outside ownership

- `discussion/design/_map.md`, `discussion/_map.md`, `discussion/runtime-player/**`, and `discussion/reports/_map.md` require their designated owner update after this child-first pass.
- Formal Wave108 atlasRuntime visual evidence, GPU/pixel parity, Canvas2D sunset policy, `original` inset reproduction, C7 hardware capture, and any v6/v7 quality re-evaluation were not run here.
- Wave109 has a Domain A report/review but no separate final report; the map links the available evidence without inventing one.

## 7. Semantic-review correction (N-01)

`131-map-update-semantic-review.md` identified one wording ambiguity in the owned mesh-generation design map: the v6d row could be read as product-quality acceptance because it said “Accepted current mainline / implementation-proven by visual check.” The row now explicitly says **technical/default route** and treats focused tests/visual evidence as implementation evidence only. The v6/v7 round-2 “一長一短” quality hold, toggle-lifetime decision, and authorization for Wave 2/v6 deletion remain open; no product or human quality gate was marked complete.
