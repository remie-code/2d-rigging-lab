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
- Remaining work after Wave31 is summarized in [remaining-work-backlog.md](remaining-work-backlog.md). Use it with the capability map before choosing the next wave boundary.
- Wave 31 `package-binary-file-io-byte-intake-pilot-v0` completed on 2026-06-02 with browser `<input type=file>` actual-byte intake, digest / byteLength / mediaType / rights / provenance evidence, package-local current-session byte registration, validator diagnostics, truthful save/load reupload state, byte-only local sample fixture, desktop/mobile e2e smoke, final verification, and clean integration review while keeping PSD parser, image decode, archive, drag-drop, File System Access API, external dependencies, full renderer, pixel oracle, Cubism compatibility, public asset distribution, and persistent binary storage guarantees out of scope.
- Wave 30 `tutorial-like-mvp-mini-model-v0` completed on 2026-06-02 with a rights-clean synthetic mini model recipe, operation log/model diff/package materialization, semantic runtime/viewer tutorial evidence, validator readiness preflight, guided editor workflow, desktop/mobile e2e persistence smoke, final verification, and clean integration review while keeping real asset bytes, file picker/parser/archive, image decode, full renderer, pixel oracle, texture sampling correctness, standalone viewer, public tutorial asset distribution, Cubism compatibility, external dependencies, and package manifest/lockfile changes out of scope.
- Wave 29 `canvas-mesh-editing-v1` completed on 2026-06-02 with bounded canvas/SVG mesh vertex selection, multi-vertex translate, semantic Preview / Viewer / Runtime mesh evidence, validator topology diagnostics, contract fixtures, desktop/mobile e2e persistence smoke, final verification, and clean review path registration while keeping topology/UV editor, full renderer, pixel oracle, real image bytes, file picker/parser/archive, Cubism compatibility, external dependencies, and package manifest/lockfile changes out of scope.
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
- Wave 23 Minimum Open Dynamics v1 vertical slice completed on 2026-05-31 with `createDynamicsGroup` authoring operation support, deterministic runtime dynamics sequence / snapshot / diff / evidence, validator dynamics semantic diagnostics, editor Dynamics panel with preview run/reset, deterministic contract fixtures, desktop/mobile e2e persistence smoke, final verification, and clean integration review while keeping Cubism Physics compatibility, direct vertex physics, asset I/O expansion, file picker, parser work, and external dependencies out of scope. Evidence is recorded in [waves/wave23/wave23-final-report.md](waves/wave23/wave23-final-report.md), [waves/wave23/_map.md](waves/wave23/_map.md), and [reviews/wave23/wave23-clean-integration-review.md](reviews/wave23/wave23-clean-integration-review.md).
- Wave 24 Private Viewer v0 runtime inspection surface completed on 2026-06-01 with editor-internal Viewer / Runtime surface, viewer-context runtime snapshot/diff/evidence, session-only parameter override, viewer validation diagnostics/report refs, semantic preview-vs-viewer equivalence fixture, desktop/mobile e2e persistence smoke, final verification, and clean integration review while keeping standalone viewer app, full renderer, pixel oracle, file picker, parser, archive, image decode, actual binary upload, Cubism compatibility, and external dependencies out of scope. Evidence is recorded in [waves/wave24/wave24-final-report.md](waves/wave24/wave24-final-report.md), [waves/wave24/_map.md](waves/wave24/_map.md), and [reviews/wave24/wave24-clean-integration-review.md](reviews/wave24/wave24-clean-integration-review.md).
- Wave 25 Minimum Rig Control v1 authoring/runtime slice completed on 2026-06-01 with project-defined `rotation2d` rig control creation and child binding, deterministic runtime hierarchy/evidence, validator diagnostics, parent-child and invalid-cycle fixtures, editor Preview / Viewer workflow, desktop/mobile e2e persistence smoke, final verification, and clean integration review while keeping warp lattice full evaluator, direct physics, Cubism compatibility, file picker, parser, image decode, archive, actual binary upload, and external dependencies out of scope. Evidence is recorded in [waves/wave25/wave25-final-report.md](waves/wave25/wave25-final-report.md), [waves/wave25/_map.md](waves/wave25/_map.md), and [reviews/wave25/wave25-clean-integration-review.md](reviews/wave25/wave25-clean-integration-review.md).
- Wave 26 Rig Control Keyform / Viewer Hardening completed on 2026-06-01 with `rigControl:angleDegrees` keyform operation/evidence, runtime local/world transform and affected-target evidence, validator/report hardening, editor keyform UX, Viewer / Runtime observation, desktop/mobile e2e persistence smoke, final verification, and clean integration review while keeping warp lattice full evaluator, direct physics, Cubism compatibility, file picker, parser, image decode, archive, actual binary upload, and external dependencies out of scope. Evidence is recorded in [waves/wave26/wave26-final-report.md](waves/wave26/wave26-final-report.md), [waves/wave26/_map.md](waves/wave26/_map.md), and [reviews/wave26/wave26-clean-integration-review.md](reviews/wave26/wave26-clean-integration-review.md).
- Wave 27 Mask / Clipping / Opacity Authoring v1 completed on 2026-06-01 with semantic `setMaskRelation` operation support, runtime mask/opacity evidence, validator composition diagnostics, rights-clean contract fixtures, Editor Composition / Mask / Opacity UX, Viewer / Runtime semantic observation, desktop/mobile e2e persistence smoke, final verification, and clean integration review while keeping pixel oracle, full renderer, Cubism compatibility, file picker, parser, image decode, archive, actual binary upload, and external dependencies out of scope. Evidence is recorded in [waves/wave27/wave27-final-report.md](waves/wave27/wave27-final-report.md), [waves/wave27/_map.md](waves/wave27/_map.md), [reviews/wave27/_map.md](reviews/wave27/_map.md), and [reviews/wave27/wave27-clean-integration-review.md](reviews/wave27/wave27-clean-integration-review.md).
- Wave 28 Part / Texture / Layer Tree Workflow v1 completed on 2026-06-01 with semantic part hierarchy, drawable part reassignment, existing texture assignment, editor layer selection / lock / editor-hide, Preview / Viewer evidence, validator diagnostics, rights-clean contract fixtures, desktop/mobile e2e persistence smoke, final verification, and clean integration review while keeping full drag-and-drop layer tree, real image bytes, file picker, parser, image decode, archive, pixel oracle, full renderer, Cubism compatibility, and external dependencies out of scope. Evidence is recorded in [waves/wave28/wave28-final-report.md](waves/wave28/wave28-final-report.md), [waves/wave28/_map.md](waves/wave28/_map.md), [reviews/wave28/_map.md](reviews/wave28/_map.md), and [reviews/wave28/wave28-clean-integration-review.md](reviews/wave28/wave28-clean-integration-review.md).

## Key References

| Path | Purpose |
|---|---|
| [current-capability-map.md](current-capability-map.md) | Product/system-level status map: intended capability, implemented surface, incomplete workflow areas, future scope, and next-wave decision points |
| [remaining-work-backlog.md](remaining-work-backlog.md) | Remaining work backlog after Wave30, including near-term product work, asset I/O decision gates, quality residuals, and recommended next-wave choices |
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
| [orchestration/wave23-plan.md](orchestration/wave23-plan.md) | Wave 23 Minimum Open Dynamics v1 vertical slice dependency and Orch-Sylph parallelism plan |
| [orchestration/wave24-plan.md](orchestration/wave24-plan.md) | Wave 24 Private Viewer v0 runtime inspection surface dependency and Orch-Sylph parallelism plan |
| [orchestration/wave25-plan.md](orchestration/wave25-plan.md) | Wave 25 Minimum Rig Control v1 authoring/runtime slice dependency and Orch-Sylph parallelism plan |
| [orchestration/wave26-plan.md](orchestration/wave26-plan.md) | Wave 26 Rig Control Keyform / Viewer Hardening dependency and Orch-Sylph parallelism plan |
| [orchestration/wave27-plan.md](orchestration/wave27-plan.md) | Wave 27 Mask / Clipping / Opacity Authoring v1 dependency and Orch-Sylph parallelism plan |
| [orchestration/wave28-plan.md](orchestration/wave28-plan.md) | Wave 28 Part / Texture / Layer Tree Workflow v1 dependency and Orch-Sylph parallelism plan |
| [orchestration/wave29-plan.md](orchestration/wave29-plan.md) | Wave 29 Canvas Mesh Editing v1 dependency and Orch-Sylph parallelism plan |
| [orchestration/wave30-plan.md](orchestration/wave30-plan.md) | Wave 30 Tutorial-like MVP Mini Model v0 dependency and Orch-Sylph parallelism plan |
| [orchestration/wave31-plan.md](orchestration/wave31-plan.md) | Wave 31 Package Binary / File I/O Decision + Browser Byte Intake Pilot v0 dependency and Orch-Sylph parallelism plan |
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
| [waves/wave23/wave23-final-report.md](waves/wave23/wave23-final-report.md) | Wave 23 final report for Minimum Open Dynamics v1 vertical slice |
| [waves/wave23/_map.md](waves/wave23/_map.md) | Wave 23 domain completion reports, clean integration review, and final report |
| [waves/wave24/wave24-final-report.md](waves/wave24/wave24-final-report.md) | Wave 24 final report for Private Viewer v0 runtime inspection surface |
| [waves/wave24/_map.md](waves/wave24/_map.md) | Wave 24 domain completion reports, clean integration review, and final report |
| [waves/wave25/wave25-final-report.md](waves/wave25/wave25-final-report.md) | Wave 25 final report for Minimum Rig Control v1 authoring/runtime slice |
| [waves/wave25/_map.md](waves/wave25/_map.md) | Wave 25 domain completion reports, clean integration review, and final report |
| [waves/wave26/wave26-final-report.md](waves/wave26/wave26-final-report.md) | Wave 26 final report for Rig Control Keyform / Viewer Hardening |
| [waves/wave26/_map.md](waves/wave26/_map.md) | Wave 26 domain completion reports, clean integration review, and final report |
| [waves/wave27/wave27-final-report.md](waves/wave27/wave27-final-report.md) | Wave 27 final report for Mask / Clipping / Opacity Authoring v1 |
| [waves/wave27/_map.md](waves/wave27/_map.md) | Wave 27 domain completion reports, review map links, final verification, and final report |
| [waves/wave28/wave28-final-report.md](waves/wave28/wave28-final-report.md) | Wave 28 final report for Part / Texture / Layer Tree Workflow v1 |
| [waves/wave28/_map.md](waves/wave28/_map.md) | Wave 28 domain completion reports, remediation/rerun links, review map links, final verification, and final report |
| [waves/wave29/wave29-final-report.md](waves/wave29/wave29-final-report.md) | Wave 29 final report for Canvas Mesh Editing v1 |
| [waves/wave29/_map.md](waves/wave29/_map.md) | Wave 29 domain completion reports, review map links, final verification, and final report |
| [waves/wave30/wave30-final-report.md](waves/wave30/wave30-final-report.md) | Wave 30 final report for Tutorial-like MVP Mini Model v0 |
| [waves/wave30/_map.md](waves/wave30/_map.md) | Wave 30 domain completion reports, corrective handback, review map links, final verification, and final report |
| [waves/wave31/wave31-final-report.md](waves/wave31/wave31-final-report.md) | Wave 31 final report for Package Binary / File I/O Decision + Browser Byte Intake Pilot v0 |
| [waves/wave31/_map.md](waves/wave31/_map.md) | Wave 31 domain completion reports, review map links, final verification, and final report |
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
| [reviews/wave23/_map.md](reviews/wave23/_map.md) | Wave 23 domain review reports and clean integration review |
| [reviews/wave23/wave23-clean-integration-review.md](reviews/wave23/wave23-clean-integration-review.md) | Wave 23 clean integration review |
| [reviews/wave24/_map.md](reviews/wave24/_map.md) | Wave 24 domain review reports and clean integration review |
| [reviews/wave24/wave24-clean-integration-review.md](reviews/wave24/wave24-clean-integration-review.md) | Wave 24 clean integration review |
| [reviews/wave25/_map.md](reviews/wave25/_map.md) | Wave 25 domain review reports and clean integration review |
| [reviews/wave25/wave25-clean-integration-review.md](reviews/wave25/wave25-clean-integration-review.md) | Wave 25 clean integration review |
| [reviews/wave26/_map.md](reviews/wave26/_map.md) | Wave 26 domain review reports and clean integration review |
| [reviews/wave26/wave26-clean-integration-review.md](reviews/wave26/wave26-clean-integration-review.md) | Wave 26 clean integration review |
| [reviews/wave27/_map.md](reviews/wave27/_map.md) | Wave 27 domain review reports and clean integration review |
| [reviews/wave27/wave27-clean-integration-review.md](reviews/wave27/wave27-clean-integration-review.md) | Wave 27 clean integration review |
| [reviews/wave28/_map.md](reviews/wave28/_map.md) | Wave 28 domain review reports, remediation/rerun reviews, and clean integration review placeholder |
| [reviews/wave28/wave28-clean-integration-review.md](reviews/wave28/wave28-clean-integration-review.md) | Wave 28 clean integration review |
| [reviews/wave29/_map.md](reviews/wave29/_map.md) | Wave 29 domain review reports and clean integration review path |
| [reviews/wave29/wave29-clean-integration-review.md](reviews/wave29/wave29-clean-integration-review.md) | Wave 29 clean integration review |
| [reviews/wave30/_map.md](reviews/wave30/_map.md) | Wave 30 domain review reports, corrective handback review, and clean integration review |
| [reviews/wave30/wave30-clean-integration-review.md](reviews/wave30/wave30-clean-integration-review.md) | Wave 30 clean integration review |
| [reviews/wave31/_map.md](reviews/wave31/_map.md) | Wave 31 domain review reports and clean integration review |
| [reviews/wave31/wave31-clean-integration-review.md](reviews/wave31/wave31-clean-integration-review.md) | Wave 31 clean integration review |
| [../development_convention/source-file-organization-policy.md](../development_convention/source-file-organization-policy.md) | Source file responsibility and `index.ts` guardrail |
| `.agents/skills/implementation-orchestration/SKILL.md` | Active orchestration skill basis |

## Next Actions

1. Plan the next implementation wave from [current-capability-map.md](current-capability-map.md) and [remaining-work-backlog.md](remaining-work-backlog.md).
2. Keep external HTTP/WebSocket/MCP transport and LLM provider integration in Future scope unless the current MVP boundary is explicitly changed.
3. Continue passing [../development_convention/source-file-organization-policy.md](../development_convention/source-file-organization-policy.md) to implementation domains that write authored source.
