# Implementation Map

> Lightweight map for implementation orchestration artifacts.

## Role

This directory stores wave plans, domain completion reports, Review-Sylph reports, integration reviews, early escape reports, and final reports for implementation runs.

## Expected Structure

```text
discussion/implementation/
  _map.md
  orchestration/
  reviews/
  waves/
```

## Current State

- The previous `/goal`-oriented development convention policy has been discarded.
- Active implementation orchestration should use `.agents/skills/implementation-orchestration/SKILL.md` plus wave-specific plans stored here.
- Product/system-level status is summarized in [current-capability-map.md](current-capability-map.md). Use it before planning the next wave; it is not a per-wave changelog.
- Wave 0 foundation scaffold is implementation-proven as of 2026-05-28. Evidence is recorded in [reviews/wave0/wave0-foundation-review.md](reviews/wave0/wave0-foundation-review.md), [waves/wave0/wave0-foundation-completion.md](waves/wave0/wave0-foundation-completion.md), and [waves/wave0/integration-review.md](waves/wave0/integration-review.md).
- A Wave 0 plan exists at [orchestration/wave0-plan.md](orchestration/wave0-plan.md).
- The Wave 0 package naming follow-up was resolved after Wave 0 by aligning active development conventions to `contracts` / `validator-core`.
- Wave 1 contracts foundation completed on 2026-05-29 with public barrel export integration, integration review, final report, and full verification pass. Evidence is recorded in [waves/wave1/wave1-final-report.md](waves/wave1/wave1-final-report.md) and [waves/wave1/integration-review.md](waves/wave1/integration-review.md).
- Wave 2 package / runtime / validator foundation completed on 2026-05-29 with package-format, runtime-core, validator-core, minimal contract fixture, integration review, final report, and full verification pass. Evidence is recorded in [waves/wave2/wave2-final-report.md](waves/wave2/wave2-final-report.md) and [waves/wave2/integration-review.md](waves/wave2/integration-review.md).
- Wave 3 authoring / operation foundation completed on 2026-05-29 with `authoring-core`, `operation-core` DTO / lifecycle foundation, `minimal-operation-create-parameter` fixture, integration review, final report, and full verification pass. Evidence is recorded in [waves/wave3/wave3-final-report.md](waves/wave3/wave3-final-report.md) and [waves/wave3/integration-review.md](waves/wave3/integration-review.md).
- Wave 4 runtime / validation evidence integration completed on 2026-05-29 with authoring runtime adapter, runtime evidence helper, validator evidence helper, operation evidence provider hook, minimal runtime/validation evidence fixture, integration review, final report, and full verification pass. Evidence is recorded in [waves/wave4/wave4-final-report.md](waves/wave4/wave4-final-report.md) and [waves/wave4/integration-review.md](waves/wave4/integration-review.md).
- Wave 5 package persistence / operation log foundation completed on 2026-05-29 with package revision policy, operation log JSONL, authoring-to-package document adapter, package file set writer, runtime/validation artifact materializers, persisted operation evidence fixture, integration review, final report, and full verification pass. Evidence is recorded in [waves/wave5/wave5-final-report.md](waves/wave5/wave5-final-report.md) and [waves/wave5/integration-review.md](waves/wave5/integration-review.md).
- Wave 6 editor-ui operation persistence vertical slice completed on 2026-05-29 with `apps/editor`, browser-safe session adapter, semantic state/view model, operation UI, evidence/package panels, integration review, final report, and full verification pass. Evidence is recorded in [waves/wave6/wave6-final-report.md](waves/wave6/wave6-final-report.md) and [waves/wave6/integration-review.md](waves/wave6/integration-review.md).
- Wave 7 editor project persistence and e2e hardening completed on 2026-05-29 with DOM-free core/editor typecheck split, operation log hydration, browser-local project persistence, save/load/reset UI, durable editor e2e smoke, integration review, final report, and full verification pass. Evidence is recorded in [waves/wave7/wave7-final-report.md](waves/wave7/wave7-final-report.md) and [waves/wave7/integration-review.md](waves/wave7/integration-review.md).
- Wave 8 AI interface dry-run command foundation completed on 2026-05-29 with `packages/ai-interface`, transport-independent command schemas, dry-run / approval / commit executor, read command host contract, editor in-process AI host, transcript fixture, clean integration review, final report, and full verification pass. Evidence is recorded in [waves/wave8/wave8-final-report.md](waves/wave8/wave8-final-report.md), [waves/wave8/integration-review.md](waves/wave8/integration-review.md), and [reviews/wave8/wave8-integration-clean-review.md](reviews/wave8/wave8-integration-clean-review.md).
- Wave 9 AI command approval UI and transcript persistence completed on 2026-05-29 with visible AI approval workflow, browser-local transcript persistence, transcript/operation-log correlation, desktop/mobile e2e coverage, clean integration review, final report, and full verification pass. Evidence is recorded in [waves/wave9/wave9-final-report.md](waves/wave9/wave9-final-report.md), [waves/wave9/integration-review.md](waves/wave9/integration-review.md), and [reviews/wave9/wave9-integration-clean-review.md](reviews/wave9/wave9-integration-clean-review.md).
- Wave 10 AI read / inspection / validation command foundation completed on 2026-05-29 with internal `inspectModel`, `inspectTarget`, and `validatePackage` command contracts, editor projectors, host integration, compact fixture regression, integration review, final report, and full verification pass. Evidence is recorded in [waves/wave10/wave10-final-report.md](waves/wave10/wave10-final-report.md), [waves/wave10/integration-review.md](waves/wave10/integration-review.md), and [reviews/wave10/wave10-integration-clean-review.md](reviews/wave10/wave10-integration-clean-review.md).
- Wave 11 AI operation catalog expansion / keyform foundation completed on 2026-05-29 with authoring keyform mutations, `addKeyform` / `addKeyformGrid2d` operation handlers, registry / lifecycle integration, editor evidence support, AI `addKeyform` command regression, clean review, final report, and full verification pass. Evidence is recorded in [waves/wave11/wave11-final-report.md](waves/wave11/wave11-final-report.md), [waves/wave11/integration-review.md](waves/wave11/integration-review.md), and [reviews/wave11/wave11-clean-review.md](reviews/wave11/wave11-clean-review.md).
- Wave 12 runtime keyform evaluation foundation completed on 2026-05-30 with runtime keyform identity, sampling, target application, snapshot/evidence integration, compact fixture regression, integration review, final report, and full verification pass. Evidence is recorded in [waves/wave12/wave12-final-report.md](waves/wave12/wave12-final-report.md), [waves/wave12/integration-review.md](waves/wave12/integration-review.md), and [reviews/wave12/_map.md](reviews/wave12/_map.md).
- Wave 13 runtime diff and Grid2D evidence hardening completed on 2026-05-30 with enriched runtime diff fields, Grid2D fixture/evidence, keyform diagnostic regressions, AI/editor `addKeyformGrid2d` runtime-visible evidence, inserted diagnostic alignment resolution, integration review, final report, and full verification pass. Evidence is recorded in [waves/wave13/wave13-final-report.md](waves/wave13/wave13-final-report.md), [waves/wave13/integration-review.md](waves/wave13/integration-review.md), and [reviews/wave13/_map.md](reviews/wave13/_map.md).
- Wave 14 editor embedded preview foundation completed on 2026-05-30 with runtime-derived embedded preview projection, preview-ready sample parameter/keyform data, preview-only workflow state, embedded preview UI, desktop/mobile e2e smoke, a sample-aware AI/editor-session regression needs-fix loop, and full final verification pass. Evidence is recorded in [waves/wave14/wave14-final-report.md](waves/wave14/wave14-final-report.md), [waves/wave14/integration-review.md](waves/wave14/integration-review.md), and [reviews/wave14/_map.md](reviews/wave14/_map.md).
- Wave 15 editor drawable / mesh authoring vertical slice completed on 2026-05-30 with GUI generated drawable / deterministic mesh creation, operation log and package persistence, save/load restore, runtime/validation evidence, embedded preview observation, desktop/mobile e2e smoke, and an operation lifecycle needs-fix loop after `generateMesh` became supported. Evidence is recorded in [waves/wave15/wave15-final-report.md](waves/wave15/wave15-final-report.md), [waves/wave15/integration-review.md](waves/wave15/integration-review.md), [waves/wave15/_map.md](waves/wave15/_map.md), and [reviews/wave15/_map.md](reviews/wave15/_map.md).
- Wave 16 drawable layer controls and visibility authoring completed on 2026-05-30 with `setDrawOrder` / `setRuntimeVisibility` operations, runtime / validation evidence, editor workflow/state, drawable list hide/show and move up/down controls, save/load persistence smoke, desktop/mobile e2e, and integration review. Evidence is recorded in [waves/wave16/wave16-final-report.md](waves/wave16/wave16-final-report.md).
- Wave 17 editor mesh vertex editing vertical slice completed on 2026-05-30 with `moveMeshVertex` operation support, runtime / validation evidence, editor workflow state, mesh vertex nudge controls, save/load persistence smoke, desktop/mobile E2E, clean integration review, and final report. Evidence is recorded in [waves/wave17/wave17-final-report.md](waves/wave17/wave17-final-report.md), [waves/wave17/_map.md](waves/wave17/_map.md), and [reviews/wave17/_map.md](reviews/wave17/_map.md).
- Wave 18 split PNG source asset and provenance intake completed on 2026-05-30 with metadata-backed split PNG source asset / layer metadata / rights / provenance intake, operation and validator evidence, editor workflow integration, browser-local save/load, desktop/mobile E2E smoke, clean integration review, and final report. Evidence is recorded in [waves/wave18/wave18-final-report.md](waves/wave18/wave18-final-report.md), [waves/wave18/_map.md](waves/wave18/_map.md), and [reviews/wave18/_map.md](reviews/wave18/_map.md).
- Wave 19 texture-backed preview and part mapping foundation completed on 2026-05-31 with package texture metadata, source layer texture/part mapping, texture-backed SVG preview truthfulness, validator evidence, browser-local persistence, desktop/mobile E2E smoke, clean integration review, and final report. Evidence is recorded in [waves/wave19/wave19-final-report.md](waves/wave19/wave19-final-report.md), [waves/wave19/_map.md](waves/wave19/_map.md), and [reviews/wave19/_map.md](reviews/wave19/_map.md).
- Wave 20 PSD spec field matrix and adapter boundary completed on 2026-05-31 with Adobe PSD spec field matrix, safe rights-cleared sample characterization, parser-free PSD adapter result DTOs, commit-capable `importPsdSourceAsset` materialization, PSD validator diagnostics, synthetic contract fixtures, manual editor PSD adapter/profile intake, desktop/mobile e2e persistence smoke, final verification, and clean integration review. Evidence is recorded in [waves/wave20/wave20-final-report.md](waves/wave20/wave20-final-report.md), [waves/wave20/_map.md](waves/wave20/_map.md), and [reviews/wave20/_map.md](reviews/wave20/_map.md).
- Wave 21 PSD structured profile persistence hardening completed on 2026-05-31 with structured `psdProfile` source manifest persistence, `importPsdSourceAsset` structured materialization, structured validator diagnostics, contract fixture evidence, editor/AI projection, desktop/mobile e2e persistence smoke, split PNG compatibility smoke, final verification, and clean integration review. Evidence is recorded in [waves/wave21/wave21-final-report.md](waves/wave21/wave21-final-report.md), [waves/wave21/_map.md](waves/wave21/_map.md), and [reviews/wave21/_map.md](reviews/wave21/_map.md).
- Wave 22 real asset I/O boundary foundation completed on 2026-05-31 with package-local binary asset reference/storage metadata boundaries, in-memory binary file-set support, rights/provenance and validator evidence, deterministic-byte fixtures, truthful editor missing-bytes/storage UX, browser-local metadata persistence, final verification, and clean integration review while keeping real PSD parsing, image decode, file picker, actual binary upload, archive import/export, filesystem I/O, and external dependencies out of scope. Evidence is recorded in [waves/wave22/wave22-final-report.md](waves/wave22/wave22-final-report.md), [waves/wave22/_map.md](waves/wave22/_map.md), and [reviews/wave22/wave22-clean-integration-review.md](reviews/wave22/wave22-clean-integration-review.md).

## Key References

| Path | Purpose |
|---|---|
| [current-capability-map.md](current-capability-map.md) | Product/system-level status map: intended capability, implemented surface, incomplete workflow areas, future scope, and next-wave decision points |
| [orchestration/wave0-plan.md](orchestration/wave0-plan.md) | Current Wave 0 implementation foundation plan |
| [orchestration/wave1-plan.md](orchestration/wave1-plan.md) | Wave 1 contracts-foundation dependency and Orch-Sylph parallelism plan |
| [orchestration/wave2-plan.md](orchestration/wave2-plan.md) | Wave 2 package/runtime/validator foundation dependency and Orch-Sylph parallelism plan |
| [orchestration/wave3-plan.md](orchestration/wave3-plan.md) | Wave 3 authoring/operation foundation dependency and Orch-Sylph parallelism plan |
| [orchestration/wave4-plan.md](orchestration/wave4-plan.md) | Wave 4 runtime/validation evidence integration dependency and Orch-Sylph parallelism plan |
| [orchestration/wave5-plan.md](orchestration/wave5-plan.md) | Wave 5 package persistence / operation log foundation dependency and Orch-Sylph parallelism plan |
| [orchestration/wave6-plan.md](orchestration/wave6-plan.md) | Wave 6 editor-ui operation persistence vertical slice dependency and Orch-Sylph parallelism plan |
| [orchestration/wave7-plan.md](orchestration/wave7-plan.md) | Wave 7 editor project persistence and e2e hardening dependency and Orch-Sylph parallelism plan |
| [orchestration/wave8-plan.md](orchestration/wave8-plan.md) | Wave 8 AI interface dry-run command foundation dependency and Orch-Sylph parallelism plan |
| [orchestration/wave9-plan.md](orchestration/wave9-plan.md) | Wave 9 AI command approval UI and transcript persistence dependency and Orch-Sylph parallelism plan |
| [orchestration/wave10-plan.md](orchestration/wave10-plan.md) | Wave 10 internal AI read / inspection / validation command foundation dependency and Orch-Sylph parallelism plan |
| [orchestration/wave11-plan.md](orchestration/wave11-plan.md) | Wave 11 AI operation catalog expansion / keyform foundation dependency and Orch-Sylph parallelism plan |
| [orchestration/wave12-plan.md](orchestration/wave12-plan.md) | Wave 12 runtime keyform evaluation foundation dependency and Orch-Sylph parallelism plan |
| [orchestration/wave13-plan.md](orchestration/wave13-plan.md) | Wave 13 runtime diff and Grid2D evidence hardening dependency and Orch-Sylph parallelism plan |
| [orchestration/wave14-plan.md](orchestration/wave14-plan.md) | Wave 14 editor embedded preview foundation dependency and Orch-Sylph parallelism plan |
| [orchestration/wave15-plan.md](orchestration/wave15-plan.md) | Wave 15 editor drawable / mesh authoring vertical slice dependency and Orch-Sylph parallelism plan |
| [orchestration/wave16-plan.md](orchestration/wave16-plan.md) | Wave 16 drawable layer controls and visibility authoring dependency and Orch-Sylph parallelism plan |
| [orchestration/wave17-plan.md](orchestration/wave17-plan.md) | Wave 17 editor mesh vertex editing vertical slice dependency and Orch-Sylph parallelism plan |
| [orchestration/wave18-plan.md](orchestration/wave18-plan.md) | Wave 18 split PNG source asset and provenance intake dependency and Orch-Sylph parallelism plan |
| [orchestration/wave19-plan.md](orchestration/wave19-plan.md) | Wave 19 texture-backed preview and part mapping foundation dependency and Orch-Sylph parallelism plan |
| [orchestration/wave20-plan.md](orchestration/wave20-plan.md) | Wave 20 PSD spec field matrix and adapter boundary dependency and Orch-Sylph parallelism plan |
| [orchestration/wave21-plan.md](orchestration/wave21-plan.md) | Wave 21 PSD structured profile persistence hardening dependency and Orch-Sylph parallelism plan |
| [orchestration/wave22-plan.md](orchestration/wave22-plan.md) | Wave 22 real asset I/O boundary foundation dependency and Orch-Sylph parallelism plan |
| [waves/wave1/_map.md](waves/wave1/_map.md) | Wave 1 domain completion reports, integration review, and final report |
| [waves/wave2/_map.md](waves/wave2/_map.md) | Wave 2 domain completion reports, integration review, and final report |
| [waves/wave3/_map.md](waves/wave3/_map.md) | Wave 3 domain completion reports, integration review, and final report |
| [waves/wave4/_map.md](waves/wave4/_map.md) | Wave 4 domain completion reports, integration review, and final report |
| [waves/wave5/_map.md](waves/wave5/_map.md) | Wave 5 domain completion reports, integration review, and final report |
| [waves/wave6/_map.md](waves/wave6/_map.md) | Wave 6 domain completion reports, integration review, and final report |
| [waves/wave7/_map.md](waves/wave7/_map.md) | Wave 7 domain completion reports, integration review, and final report |
| [waves/wave8/_map.md](waves/wave8/_map.md) | Wave 8 domain completion reports, integration review, and final report |
| [waves/wave9/_map.md](waves/wave9/_map.md) | Wave 9 domain completion reports, integration review, and final report |
| [waves/wave10/_map.md](waves/wave10/_map.md) | Wave 10 domain completion reports, integration review, and final report |
| [waves/wave11/_map.md](waves/wave11/_map.md) | Wave 11 domain completion reports, integration review, and final report |
| [waves/wave12/_map.md](waves/wave12/_map.md) | Wave 12 domain completion reports, integration review, and final report |
| [waves/wave13/_map.md](waves/wave13/_map.md) | Wave 13 domain completion reports, integration review, and final report |
| [waves/wave14/_map.md](waves/wave14/_map.md) | Wave 14 domain completion reports, integration review, and final report |
| [waves/wave15/_map.md](waves/wave15/_map.md) | Wave 15 domain completion reports, needs-fix loop, integration review, and final report |
| [waves/wave16/wave16-final-report.md](waves/wave16/wave16-final-report.md) | Wave 16 final report for drawable layer controls and visibility authoring |
| [waves/wave17/wave17-final-report.md](waves/wave17/wave17-final-report.md) | Wave 17 final report for editor mesh vertex editing vertical slice |
| [waves/wave18/wave18-final-report.md](waves/wave18/wave18-final-report.md) | Wave 18 final report for split PNG source asset and provenance intake |
| [waves/wave19/wave19-final-report.md](waves/wave19/wave19-final-report.md) | Wave 19 final report for texture-backed preview and part mapping foundation |
| [waves/wave20/wave20-final-report.md](waves/wave20/wave20-final-report.md) | Wave 20 final report for PSD spec field matrix and adapter boundary |
| [waves/wave21/wave21-final-report.md](waves/wave21/wave21-final-report.md) | Wave 21 final report for PSD structured profile persistence hardening |
| [waves/wave21/_map.md](waves/wave21/_map.md) | Wave 21 domain completion reports, final verification, and final report |
| [waves/wave22/wave22-final-report.md](waves/wave22/wave22-final-report.md) | Wave 22 final report for real asset I/O boundary foundation |
| [waves/wave22/_map.md](waves/wave22/_map.md) | Wave 22 domain completion reports, clean integration review, and final report |
| [reviews/wave1/_map.md](reviews/wave1/_map.md) | Wave 1 domain review reports |
| [reviews/wave2/_map.md](reviews/wave2/_map.md) | Wave 2 domain review reports |
| [reviews/wave3/_map.md](reviews/wave3/_map.md) | Wave 3 domain review reports |
| [reviews/wave4/_map.md](reviews/wave4/_map.md) | Wave 4 domain review reports |
| [reviews/wave5/_map.md](reviews/wave5/_map.md) | Wave 5 domain review reports |
| [reviews/wave6/_map.md](reviews/wave6/_map.md) | Wave 6 domain and clean integration review reports |
| [reviews/wave7/_map.md](reviews/wave7/_map.md) | Wave 7 clean integration review reports |
| [reviews/wave8/_map.md](reviews/wave8/_map.md) | Wave 8 clean integration review reports |
| [reviews/wave9/_map.md](reviews/wave9/_map.md) | Wave 9 clean integration review reports |
| [reviews/wave10/_map.md](reviews/wave10/_map.md) | Wave 10 clean integration review reports |
| [reviews/wave11/_map.md](reviews/wave11/_map.md) | Wave 11 clean review reports |
| [reviews/wave12/_map.md](reviews/wave12/_map.md) | Wave 12 domain review reports |
| [reviews/wave13/_map.md](reviews/wave13/_map.md) | Wave 13 domain review reports |
| [reviews/wave14/_map.md](reviews/wave14/_map.md) | Wave 14 domain review reports |
| [reviews/wave15/_map.md](reviews/wave15/_map.md) | Wave 15 domain review reports and needs-fix review |
| [reviews/wave20/_map.md](reviews/wave20/_map.md) | Wave 20 domain review reports and clean integration review |
| [reviews/wave21/_map.md](reviews/wave21/_map.md) | Wave 21 domain review reports and clean integration review |
| [reviews/wave22/wave22-clean-integration-review.md](reviews/wave22/wave22-clean-integration-review.md) | Wave 22 clean integration review |
| [../development_convention/source-file-organization-policy.md](../development_convention/source-file-organization-policy.md) | Source file responsibility and `index.ts` guardrail |
| `.agents/skills/implementation-orchestration/SKILL.md` | Active orchestration skill basis |

## Next Actions

1. Use the Wave 22 binary boundary final report and clean integration review before planning actual binary byte intake, file picker, archive I/O, image decode, or parser work.
2. Keep external HTTP/WebSocket/MCP transport and LLM provider integration in Future scope unless the current MVP boundary is explicitly changed.
3. Continue passing [../development_convention/source-file-organization-policy.md](../development_convention/source-file-organization-policy.md) to implementation domains that write authored source.
