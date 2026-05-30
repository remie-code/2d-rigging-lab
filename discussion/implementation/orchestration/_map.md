# Implementation Orchestration Map

> Entry map for implementation wave plans and final orchestration reports.

## Files

| Path | Role | Status |
|---|---|---|
| [wave0-plan.md](wave0-plan.md) | Wave 0 implementation foundation plan | Completed / implementation-proven |
| [wave1-plan.md](wave1-plan.md) | Wave 1 contracts-foundation dependency and parallelism plan | Completed / implementation-proven |
| [wave2-plan.md](wave2-plan.md) | Wave 2 package/runtime/validator foundation dependency and parallelism plan | Completed / implementation-proven |
| [wave3-plan.md](wave3-plan.md) | Wave 3 authoring/operation foundation dependency and parallelism plan | Completed / implementation-proven |
| [wave4-plan.md](wave4-plan.md) | Wave 4 runtime/validation evidence integration dependency and parallelism plan | Completed / implementation-proven |
| [wave5-plan.md](wave5-plan.md) | Wave 5 package persistence / operation log foundation dependency and parallelism plan | Completed / implementation-proven |
| [wave6-plan.md](wave6-plan.md) | Wave 6 editor-ui operation persistence vertical slice dependency and parallelism plan | Completed / implementation-proven |
| [wave7-plan.md](wave7-plan.md) | Wave 7 editor project persistence and e2e hardening dependency and parallelism plan | Completed / implementation-proven |
| [wave8-plan.md](wave8-plan.md) | Wave 8 AI interface dry-run command foundation dependency and parallelism plan | Completed / implementation-proven |
| [wave9-plan.md](wave9-plan.md) | Wave 9 AI command approval UI and transcript persistence dependency and parallelism plan | Completed / implementation-proven |
| [wave10-plan.md](wave10-plan.md) | Wave 10 AI read / inspection / validation command foundation dependency and parallelism plan | Completed / implementation-proven |
| [wave11-plan.md](wave11-plan.md) | Wave 11 AI operation catalog expansion / keyform foundation dependency and parallelism plan | Completed / implementation-proven |
| [wave12-plan.md](wave12-plan.md) | Wave 12 runtime keyform evaluation foundation dependency and Orch-Sylph parallelism plan | Completed / implementation-proven |
| [wave13-plan.md](wave13-plan.md) | Wave 13 runtime diff and Grid2D evidence hardening dependency and Orch-Sylph parallelism plan | Completed / implementation-proven |
| [wave14-plan.md](wave14-plan.md) | Wave 14 editor embedded preview foundation dependency and Orch-Sylph parallelism plan | Completed / implementation-proven |
| [wave15-plan.md](wave15-plan.md) | Wave 15 editor drawable / mesh authoring vertical slice dependency and Orch-Sylph parallelism plan | Completed / implementation-proven |
| [wave16-plan.md](wave16-plan.md) | Wave 16 drawable layer controls and visibility authoring dependency and Orch-Sylph parallelism plan | Completed / implementation-proven |
| [wave17-plan.md](wave17-plan.md) | Wave 17 editor mesh vertex editing vertical slice dependency and Orch-Sylph parallelism plan | Completed / implementation-proven |
| [wave18-plan.md](wave18-plan.md) | Wave 18 split PNG source asset and provenance intake dependency and Orch-Sylph parallelism plan | Completed / implementation-proven |

## Current Decision

- The active orchestration basis is `.codex/skills/implementation-orchestration/SKILL.md` plus wave-specific plans under `discussion/implementation/`.
- The previous `/goal`-oriented development convention policy has been discarded.
- Wave 0 is complete and provides the package/test/check scaffold.
- Wave 1 `contracts-foundation` completed on 2026-05-29. The final domain was `wave1-contracts-integration`.
- Wave 1 public integration keeps `packages/contracts/src/index.ts` as a barrel-only export surface.
- Wave 2 `package-runtime-validator-foundation` completed on 2026-05-29. The final domain was `wave2-integration-review-and-final-report`.
- Wave 2 public integration keeps `packages/package-format/src/index.ts`, `packages/runtime-core/src/index.ts`, and `packages/validator-core/src/index.ts` as barrel-only export surfaces.
- Wave 3 `authoring-operation-foundation` completed on 2026-05-29. The final domain was `wave3-integration-review-and-final-report`.
- Wave 3 introduced `authoring-core`, operation DTOs, minimal dry-run / commit lifecycle, and `minimal-operation-create-parameter` fixture while keeping public `index.ts` files barrel-only.
- Wave 4 `runtime-validation-evidence-integration` completed on 2026-05-29. The final domain was `wave4-integration-review-and-final-report`.
- Wave 4 connected authoring sessions to runtime snapshots and validation reports through provider-based operation evidence while keeping `operation-core` free of direct runtime/validator imports.
- Wave 5 `package-persistence-and-operation-log-foundation` completed on 2026-05-29. The final domain was `wave5-integration-review-and-final-report`.
- Wave 5 made operation evidence durable at the package-relative file set level: package revision policy, operation log JSONL, authoring-to-package document adapter, package file set writer, runtime/validation generated artifact materializers, and persisted operation evidence fixture.
- Wave 6 `editor-ui-operation-persistence-vertical-slice` completed on 2026-05-29. It created `apps/editor` as a Vite + vanilla TypeScript browser app and proved the `createParameter` operation persistence flow from GUI to reload summary.
- Wave 7 `editor-project-persistence-and-e2e-hardening` completed on 2026-05-29. It split editor/core typecheck boundaries, added browser project persistence, supported operation log hydration, wired save/load/reset UI, and turned browser smoke into a durable e2e script.
- Wave 8 `ai-interface-dry-run-command-foundation` completed on 2026-05-29. It created `packages/ai-interface`, implemented transport-independent command schemas, dry-run / approval / commit execution, editor in-process host integration, and transcript-backed AI command fixtures.
- Wave 9 `ai-command-approval-ui-and-transcript-persistence` completed on 2026-05-29. It added visible AI dry-run approval workflow, browser-local transcript persistence, transcript/operation-log correlation, and desktop/mobile e2e coverage while keeping transport adapters out of scope.
- Wave 10 `ai-read-inspection-validation-command-foundation` completed on 2026-05-29. It added internal `inspectModel`, `inspectTarget`, and `validatePackage` commands, editor projectors, host integration, compact fixture regression, and clean review while keeping external transport out of scope.
- Wave 11 `ai-operation-catalog-expansion-keyform-foundation` completed on 2026-05-29. It added authoring keyform mutation support, `addKeyform` / `addKeyformGrid2d` operation handlers, registry / lifecycle integration, editor evidence support, and AI host regression for `addKeyform` while keeping runtime-visible keyform deformation out of scope.
- Wave 12 `runtime-keyform-evaluation-foundation` completed on 2026-05-30. It restored explicit Orch-Sylph execution policy and implemented runtime-visible keyform sampling, target application, snapshot/evidence integration, and a compact fixture.
- Wave 13 `runtime-diff-and-grid2d-evidence-hardening` completed on 2026-05-30. It added enriched runtime diff fields, Grid2D evidence / fixture, diagnostic regressions, AI/editor `addKeyformGrid2d` runtime-visible evidence, and an inserted diagnostic alignment gate for `keyform.grid2dDuplicateKey`.
- Wave 14 `editor-embedded-preview-foundation` completed on 2026-05-30. It added runtime-derived embedded editor preview projection, preview-ready sample parameter/keyform data, preview-only workflow state, embedded preview UI, desktop/mobile e2e smoke, and a sample-aware AI/editor-session regression needs-fix loop. Final verification passed after sandbox-limited commands were rerun with escalation.
- Wave 15 `editor-drawable-mesh-authoring-vertical-slice` completed on 2026-05-30. It added GUI creation of rights-clean generated drawable / deterministic mesh, operation log and package persistence, runtime/validation evidence, embedded preview observation, desktop/mobile e2e smoke, and a needs-fix loop that updated operation lifecycle coverage after `generateMesh` became supported. Final verification passed after sandbox-limited commands were rerun with escalation.
- Wave 16 `drawable-layer-controls-and-visibility-authoring` completed on 2026-05-30. It added drawable reorder and runtime visibility controls, runtime / validation evidence, save/load persistence smoke, desktop/mobile e2e coverage, and final integration review.
- Wave 17 `editor-mesh-vertex-editing-vertical-slice` completed on 2026-05-30. It added a minimal GUI `moveMeshVertex` workflow with operation/runtime evidence, editor workflow state, vertex nudge controls, browser-local persistence, desktop/mobile E2E smoke, and clean integration review while preserving Undine -> Orch-Sylph -> Gnome/Review-Sylph context isolation.
- Wave 18 `split-png-source-asset-and-provenance-intake` completed on 2026-05-30. It added metadata-backed split PNG source asset / layer metadata / rights / provenance intake, operation evidence, validator evidence, editor workflow integration, browser-local persistence, desktop/mobile E2E smoke, and clean integration review while preserving the Wave18 higher-parallelism Orch-Sylph/Gnome/Review-Sylph separation.
