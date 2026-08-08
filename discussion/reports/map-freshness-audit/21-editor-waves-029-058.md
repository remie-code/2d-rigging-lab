# Editor Waves 029–058 Map Freshness Audit

> Audit point: Git HEAD `3c3669eefcc375c62d1ec6b4d77a000d7cbbb61c`, 2026-08-08 (Asia/Tokyo). Contract: [audit-contract.md](audit-contract.md).

## Scope and epochs

This audit covers implementation plans, wave/review maps, final or closeout reports, and repository evidence for Waves 29–58. The wave history has three semantic epochs and they must not be collapsed:

1. **Authoring/tooling (W29–W43):** canvas/mini-model/rig-control/layer-tree, binary persistence and portable-bundle boundaries, Product Preflight/Codex proposal ergonomics, then quality-gate and validator-contract consistency. These artifacts describe bounded historical implementation slices.
2. **PSD pipeline (W44–W50):** scripts-only PSD evidence, explicit browser import, selected/multi-layer intake, import-plan approval, Codex-facing leaf intake, and deterministic subtree scaffolding. These artifacts are historical evidence for intentionally narrow parser/materialization boundaries; they do not claim full compositing, renderer/pixel, Cubism, or all-layer import.
3. **Workspace/UI migration and purge/rebuild (W51–W58):** W51–W55 were physically removed during the W56 purge; W56 is abandoned except for its headless/package-separation fact; W57 rebuilt the Editor with the accepted React foundation; W58 adds the PSD Import vertical slice. This epoch is a reset/supersession boundary, not a continuation of the old GUI implementation.

## Checked map inventory and per-map verdict

Every existing map listed below was opened. All are **`historical-evidence-index / Intentionally historical`**: each records a dated completed wave or review gate, and its relative links resolve at HEAD. A later wave or a source reset does not make these maps stale under the audit contract.

### Existing wave maps (13)

| Map | Type / verdict | Evidence |
|---|---|---|
| `discussion/implementation/waves/wave29/_map.md` | historical-evidence-index / Intentionally historical | Header records `pass / implementation-proven`, 2026-06-02; clean review link resolves. |
| `discussion/implementation/waves/wave30/_map.md` | historical-evidence-index / Intentionally historical | Header records `pass / implementation-proven`, 2026-06-02; corrective handback and clean review are indexed. |
| `discussion/implementation/waves/wave31/_map.md` | historical-evidence-index / Intentionally historical | Completion/final report and clean review resolve; final verification table is dated. |
| `discussion/implementation/waves/wave32/_map.md` | historical-evidence-index / Intentionally historical | Completion/final report and clean review resolve; scope/non-goals are explicit. |
| `discussion/implementation/waves/wave33/_map.md` | historical-evidence-index / Intentionally historical | Completion/final report and clean review resolve; narrow direct-manipulation scope is explicit. |
| `discussion/implementation/waves/wave34/_map.md` | historical-evidence-index / Intentionally historical | Completion/final report and clean review resolve; fix-loop closure is recorded. |
| `discussion/implementation/waves/wave35/_map.md` | historical-evidence-index / Intentionally historical | Final report, plan, and clean review links resolve; blocked report is marked historical/superseded. |
| `discussion/implementation/waves/wave36/_map.md` | historical-evidence-index / Intentionally historical | Final report and clean review resolve; package-format non-goals are preserved. |
| `discussion/implementation/waves/wave37/_map.md` | historical-evidence-index / Intentionally historical | Final report and final clean re-review resolve; earlier needs-fix artifacts are retained as history. |
| `discussion/implementation/waves/wave38/_map.md` | historical-evidence-index / Intentionally historical | Final report, review map, and clean review resolve. |
| `discussion/implementation/waves/wave39/_map.md` | historical-evidence-index / Intentionally historical | Domain/final report and clean review resolve; warning-gated traceability decision is historical. |
| `discussion/implementation/waves/wave40/_map.md` | historical-evidence-index / Intentionally historical | Final pass and superseded earlier needs-changes reviews are explicitly distinguished. |
| `discussion/implementation/waves/wave41/_map.md` | historical-evidence-index / Intentionally historical | Final report and clean review resolve; no current-state claim is made. |

### Existing review maps (14)

| Map | Type / verdict |
|---|---|
| `discussion/implementation/reviews/wave29/_map.md` | historical-evidence-index / Intentionally historical |
| `discussion/implementation/reviews/wave30/_map.md` | historical-evidence-index / Intentionally historical |
| `discussion/implementation/reviews/wave31/_map.md` | historical-evidence-index / Intentionally historical |
| `discussion/implementation/reviews/wave32/_map.md` | historical-evidence-index / Intentionally historical |
| `discussion/implementation/reviews/wave33/_map.md` | historical-evidence-index / Intentionally historical |
| `discussion/implementation/reviews/wave34/_map.md` | historical-evidence-index / Intentionally historical |
| `discussion/implementation/reviews/wave35/_map.md` | historical-evidence-index / Intentionally historical |
| `discussion/implementation/reviews/wave36/_map.md` | historical-evidence-index / Intentionally historical |
| `discussion/implementation/reviews/wave37/_map.md` | historical-evidence-index / Intentionally historical |
| `discussion/implementation/reviews/wave38/_map.md` | historical-evidence-index / Intentionally historical |
| `discussion/implementation/reviews/wave39/_map.md` | historical-evidence-index / Intentionally historical |
| `discussion/implementation/reviews/wave40/_map.md` | historical-evidence-index / Intentionally historical |
| `discussion/implementation/reviews/wave41/_map.md` | historical-evidence-index / Intentionally historical |
| `discussion/implementation/reviews/wave42/_map.md` | historical-evidence-index / Intentionally historical (final review `pass`; the corresponding wave map is absent). |

Mechanical link check: a read-only PowerShell `Test-Path` pass over these 27 existing maps found zero missing relative links. The maps preserve review-loop history (for example, initial `needs_fix`/`needs_changes` followed by a final `pass`) rather than asserting those intermediate verdicts are current.

## Missing map/report coverage

| Artifact class | Missing paths | Finding |
|---|---|---|
| Wave maps | `discussion/implementation/waves/wave42/_map.md`; `wave43` through `wave58` `_map.md` (17 paths) | Final/domain artifacts exist for most of W42–W50 and closeout artifacts exist for W56–W58, but no per-wave map indexes them. This is absent evidence-map coverage, not evidence that the waves did not run. |
| Review maps | `discussion/implementation/reviews/wave43/_map.md` through `wave58/_map.md` (16 paths) | Individual reviews/clean reviews exist for W43–W50 and W56–W58, but no review-map index exists. |
| Plans | `wave51-plan.md` through `wave55-plan.md` | Intentionally deleted by purge commit `99a31c8`; not recoverable from the current tree without consulting Git history. |
| Final reports | W51–W55 canonical wave final reports | Intentionally deleted by purge commit `99a31c8`; W56 has domain reports only, W57 has a Domain C closeout, and W58 has a Domain B final-integration closeout rather than a canonical `waveN-final-report.md`. |

The W42 final report and clean review are present (`waves/wave42/wave42-final-report.md`, `reviews/wave42/wave42-clean-integration-review.md`), so only the W42 **wave map** is missing. W43–W50 have final/domain-H reports and clean reviews but no wave/review maps. W56–W58 have plans and reports/reviews as listed above, but no maps.

## Stale or suspicious current claims

### 1. Parent implementation map links to purged artifacts

`discussion/implementation/_map.md:59-64` still presents W51–W54 as complete and links their plans, final reports, and reviews; those 14 targets do not exist at HEAD. The same map says W55 is superseded (`:64`), but its plan is also absent. This is a **stale current index**, not a stale historical wave map. The map itself acknowledges that W51–W55 were removed only indirectly through the W56 description (`:209`).

The parent implementation map also declares W57/W58 complete (`:26-27`, `:210`) and those closeout/review paths do exist. Its note at `:211` explicitly admits that W58–W102 entries are not backfilled; do not infer later-wave status from this W29–W58 audit.

### 2. Parent orchestration map has the same broken W51–W55 entries

`discussion/implementation/orchestration/_map.md:60-64` links `wave51-plan.md` … `wave55-plan.md` and describes their statuses. A read-only link check reports seven missing targets (the five plans plus the W51 review link and its plan/review references). W29–W50 and W56–W58 plan links resolve.

### 3. Root map retains a purged W53 “latest baseline” claim

`discussion/_map.md:38` says the W53 final report/review is the latest final implementation-proven baseline, but both files were deleted in `99a31c8`. `discussion/_map.md:64` says Wave53-era detail remains under implementation history; W51–W55 history is not in the current tree. These are current-entry claims and should be rewritten or explicitly marked as Git-history-only. The root map’s separate statement that W53-era detail is superseded is directionally correct but does not repair the broken baseline links.

### 4. Frozen plan headers still say `Status: Planned`

Every extant plan in this scope (W29–W50 and W56–W58) retains a planning header (`wave29-plan.md:8`, `wave43-plan.md:8`, `wave50-plan.md:8`, `wave56-plan.md:7`, `wave58-plan.md:7`) even though the parent orchestration map records completed/pass, abandoned, or superseded outcomes (`orchestration/_map.md:38-67`) and final artifacts record pass. Treat the plan body as a historical design input; the status token is stale unless the project intentionally keeps plans immutable. No plan was edited in this audit.

### 5. Purge/rebuild commit explains the epoch break

Git commit `99a31c8` (`[WIP]wave56破棄、技術スタックを決めた.`) deletes `discussion/implementation/orchestration/wave51-plan.md` through `wave55-plan.md`, all W51–W55 wave reports/reviews, and the legacy `apps/editor` GUI/e2e; it adds W56/W57 material. This is repository evidence for intentional supersession/purge, not an accidental missing-file condition. The parent maps nevertheless must not link deleted files as if they were current.

## Current repository evidence (repository facts)

- `pnpm.cmd typecheck` passes at the audit point (read-only command, exit 0).
- The current Editor is the post-reset app: `apps/editor/src/workspace/workspace-data.ts:45` exposes `Import PSD`; `apps/editor/src/features/psd-import/components/psd-import-modal.tsx:30-68` contains the PSD task state/plan path; and `apps/editor/e2e/psd-import.e2e.spec.ts:38-62` exercises fixture selection, Import Review, Parts structure, and modal close. This supports the W57/W58 current bounded slice, not the deleted W51–W54 GUI claims.
- Current package source still contains PSD structural diagnostics (`packages/validator-core/src/check-catalog.ts:1036-1220`) and PSD operation/catalog paths; source retention does not restore the deleted Editor GUI evidence.
- Git status at the audit point contains only the contract/audit outputs plus the pre-existing user-owned `.codex` and `discussion/expo.zip` changes; no source/map edits were made by this audit.

## Information-type separation

- **Repository facts:** file existence/link checks, commit `99a31c8` deletions, current source paths, and the successful `pnpm.cmd typecheck` command.
- **Historical evidence:** W29–W50 final/domain reports and review artifacts; W56 reports; W57/W58 closeouts and reviews. Their pass verdicts describe their then-scoped runs.
- **Design/policy decisions:** W55 superseded by W56 purge; W56 abandoned except for the Domain B/C headless/package-separation fact; W57 React foundation and W58 PSD Import boundaries (recorded in their plans/closeouts).
- **Inference/recommendation:** parent/root map links to purged files are stale current-entry claims; missing W42–W58 maps are coverage gaps. This is an audit conclusion, not a new product decision.
- **Unresolved:** whether to recreate per-wave maps for W42–W58, or record explicit “no map by design/purge” rows; whether to remove/annotate W51–W55 links in parent/root maps; and whether immutable plans should receive a historical/closed status marker.

## Parent-map implications

1. Keep the 27 existing W29–W42 maps as intentionally historical evidence indexes; do not rewrite them merely because later waves reset the Editor.
2. In the parent implementation and orchestration maps, replace or annotate all W51–W55 links as Git-history-only/purged, and stop claiming W53 is the current latest baseline.
3. Add explicit absent-map coverage for W42–W58 (or create maps after user agreement). If maps are created, preserve the three epochs above and link the existing final/closeout artifacts without promoting historical scope to current capability.
4. Treat `Status: Planned` in frozen plans as historical unless the user decides to normalize statuses; the parent orchestration map remains the current status authority.

## Investigated / not investigated

Investigated: all existing W29–W41 wave maps, W29–W42 review maps, W29–W50 and W56–W58 plans, W29–W50 final/domain-H reports, W56–W58 reports/reviews, parent/root implementation maps, commit `99a31c8`, current PSD/Editor source paths, and a read-only typecheck.

Not investigated: W0–W28 or W59+ map domains, full unit/e2e reruns, visual/browser inspection, or restoration of intentionally deleted W51–W55 artifacts. No existing map, source, test, configuration, or other report was modified.
