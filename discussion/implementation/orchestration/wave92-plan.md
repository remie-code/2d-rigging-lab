# Wave 92 Plan: Runtime Export v0

> Wave92は、Workspace Save / Portable JSONとは別責務の「外部runtime app向け実行用成果物」を書き出すRuntime Export v0を導入する。将来のcamera capture / tracking appがparameter値を送り、外部runtime appが透明背景で描画し、OBSなどが取り込む構成を前提に、Editorはdirectory runtime artifactだけを生成する。

## 1. Status

- Status: Planned / ready for orchestration
- Target wave: Wave92
- Wave name: `runtime-export-v0`
- Primary objective:
  - Runtime Export v0のDTO/schema/file-set contractを追加する。
  - AuthoringSessionからcurrent atlas必須のmaterialized runtime graphを組み立てる。
  - Atlas適用済みUV / texture page参照を持つruntime-ready bundleを生成する。
  - Runtime Export TaskをEditorに追加し、directory exportを書き出せるようにする。
  - Runtime ExportをWorkspace Save / Portable JSON Exportから明確に分離する。
  - runtime/player app、camera mapping、OBS integration、PNG/ZIP/single-file exportは対象外にする。

## 2. Planning Gate Result

Planning Gate result: `Plan directly`.

Why planning is now safe:

- Read-only Sylph Aがpackage-format / authoring-core / runtime-coreのruntime export data inventoryを完了し、現行packageそのままではなくfilter/transform済みbundleが必要だと確認済み。
- Read-only Sylph BがViewer Atlas Runtimeのrender pathを調査し、`NormalizedRuntimeGraph`だけではrender bundleではなく、atlas remap / render projection由来のtexture / UV / mask / render assumptionsが必要だと確認済み。
- Read-only Sylph Cがartifact boundaryを調査し、`package-format` contract、`authoring-core` assembly/preflight、`apps/editor` directory write UXの分担が妥当だと確認済み。
- Runtime Export v0 contractは [../../design/module-contracts/runtime-export-v0-contract.md](../../design/module-contracts/runtime-export-v0-contract.md) に記録済み。
- Runtime Export Task UXは [../../design/screen-design/screens/runtime-export-task.md](../../design/screen-design/screens/runtime-export-task.md) に記録済み。
- ユーザーは次の方針を採用済み:
  - directory-only v0。
  - raw RGBA atlas pageを許容する。
  - Drawable Pool / unbound Drawablesはwarningではなく単純除外。
  - Validate warningsはexport blockしない。
  - Runtime Export v0はmaterialized runtime graphを主成果物にする。
  - runtime/player app、camera capture mapping、OBS integrationは作らない。

Uncertainty:

- factual: low. 調査結果と設計文書が揃っている。
- decision: low. v0方針と非ゴールは合意済み。
- cost of wrong plan: medium. export contractは後続外部runtime appの土台になるため、schema/assembly/editorを順序立ててreviewする。

## 3. Accepted Decisions / Oracles

### 3.1 Runtime Export Responsibility

Runtime Exportは実行用成果物であり、authoring saveではない。

Required:

- Workspace Save / Portable JSON Exportとは別導線にする。
- Export outputはdirectory artifactにする。
- Export outputは外部runtime appが読む前提で、Editor内reload検証はしない。
- current committed Texture Atlasを必須にする。
- Runtime graphはatlas適用済みUV / texture page参照を含むmaterialized graphとして出す。

Forbidden:

- current PackageDocumentをそのままexport成果物にする。
- Portable JSON bundleをRuntime Exportとして流用する。
- Workspace SaveをRuntime Exportの別名にする。
- operation-core mutationとして実装する。

### 3.2 Artifact Shape

v0はdirectory exportである。

Required output shape:

```text
<model>.runtime-export/
  runtime-export.json
  runtime/
    model.json
    atlas.json
  assets/
    textures/
      atlas_page_0.raw-rgba
```

Required:

- `runtime-export.json` はmanifest / version / paths / texture page metadata / digest / render assumptionsを持つ。
- `runtime/model.json` はJSON-serializable materialized runtime graphである。
- `runtime/atlas.json` はatlas placements / sourceSignature / page metadataを持つreference/debug dataである。
- `assets/textures/atlas_page_0.raw-rgba` はraw RGBA8 page bytesである。
- v0実装はsingle atlas pageのみ。ただしschemaは将来の `pages[]` を妨げない形にする。

Forbidden:

- ZIP/archiveをv0で追加する。
- PNG encodingをv0で追加する。
- single JSON + base64をv0で追加する。
- 新規dependencyを追加する。

### 3.3 Export Targets

Runtime Exportの対象はruntime-readyなatlas配置済みDrawableのみである。

Include:

- Deformer hierarchyに所属し、current committed atlasに配置済みのDrawable。
- hiddenな所属済みDrawable。
- keyform / dynamics / parameterで表示や変形が変わる所属済みDrawable。
- mask source / clipping sourceとして必要なincluded Drawable。
- included Drawableに必要なmesh、draw order、mask relation、rig controls、keyforms、parameters、Dynamics。

Exclude:

- Drawable Pool / unbound Drawables。warningにもblockerにもしない。
- Parts Containerそのもの。
- Deformerそのもののtexture対象。ただしrig control dataとしてruntime graphには含む。
- mesh preview / draft mesh。
- uncommitted atlas preview。
- editor overlays / handles / selection / tool state。
- PSD import helper / source metadata / source originals。
- workspace metadata / operation logs / diagnostics payloads。

### 3.4 Export Preflight

Hard block export when deterministic runtime artifact cannot be produced.

Hard block:

- no committed atlas layout/page/texture entry.
- atlas source signature missing.
- atlas stale against current runtime texture targets.
- atlas page binary ref missing.
- atlas page bytes missing.
- page dimensions / byte length / media type / digest mismatch.
- placement data invalid.
- current packable runtime targets not covered by placements.
- runtime graph materialization fails.
- required runtime binaries unavailable.
- browser does not support the required directory export capability.

Do not block:

- Drawable Pool / unbound Drawables.
- non-fatal Validate warnings.
- Dynamics warnings already visible through Validate.

User-facing warning:

- If Validate has warnings, show compact message and `Open Validate` action. Do not show full diagnostics payload in Runtime Export Task.

### 3.5 Runtime Input Boundary

Runtime Export v0 exposes parameter metadata but does not define tracker mapping.

Required:

- Export parameter id, display name, min, max, default, value source/runtime role.
- Distinguish direct external input candidates from computed Dynamics outputs where current data allows.
- Mark Dynamics output parameters as not directly editable by runtime controls if needed.

Out of scope:

- camera/tracker channel names.
- face/body semantic mapping.
- calibration.
- mirroring.
- smoothing.
- confidence.
- lost-tracking reset behavior.

### 3.6 Renderer Assumptions

Runtime Export v0 must make render assumptions explicit enough for a future runtime app.

Required:

- coordinate system / canvas bounds.
- transparent background expectation.
- raw RGBA pixel format.
- alpha/blend assumptions.
- color-space assumption if known.
- texture filtering assumption.
- mask/clipping contract fields.
- Dynamics fixed-step/reset defaults.

Accepted limitation:

- Browser pixel parity for external runtime is not proven in Wave92.
- Wave92 produces contract and artifacts; external runtime app/render pixel proof is future work.

## 4. Primary Basis

Design basis:

- [../../design/module-contracts/runtime-export-v0-contract.md](../../design/module-contracts/runtime-export-v0-contract.md)
- [../../design/screen-design/screens/runtime-export-task.md](../../design/screen-design/screens/runtime-export-task.md)
- [../../design/screen-design/screens/texture-atlas-task.md](../../design/screen-design/screens/texture-atlas-task.md)
- [../../design/screen-design/screens/viewer-runtime-view.md](../../design/screen-design/screens/viewer-runtime-view.md)
- [../../design/screen-design/screens/workspace-save-and-navigation.md](../../design/screen-design/screens/workspace-save-and-navigation.md)

Implementation baseline:

- [wave88-plan.md](wave88-plan.md)
- [wave89-plan.md](wave89-plan.md)
- [wave90-plan.md](wave90-plan.md)
- [wave91-plan.md](wave91-plan.md)
- [../waves/wave91/wave91-final-integration-report.md](../waves/wave91/wave91-final-integration-report.md)
- [../reviews/wave91/wave91-final-clean-integration-review.md](../reviews/wave91/wave91-final-clean-integration-review.md)

Required conventions:

- [../../development_convention/source-file-organization-policy.md](../../development_convention/source-file-organization-policy.md)
- [../../development_convention/dependency-policy.md](../../development_convention/dependency-policy.md)
- [../../development_convention/operation-policy.md](../../development_convention/operation-policy.md)

Known source facts:

- `packages/package-format/src/model-files.ts`: PackageDocument model DTOs.
- `packages/package-format/src/texture-atlas.ts`: committed atlas artifact DTOs.
- `packages/package-format/src/package-file-set.ts`: file-set precedent.
- `packages/package-format/src/package-binary-file-set.ts`: binary entry/digest verification precedent.
- `packages/authoring-core/src/to-runtime-graph.ts`: current runtime graph adapter.
- `packages/authoring-core/src/runtime-graph-*.ts`: runtime graph projections.
- `packages/authoring-core/src/texture-atlas-targets.ts`: runtime target selection and Drawable Pool exclusion.
- `packages/authoring-core/src/texture-atlas-source-signature.ts`: atlas stale detection.
- `packages/authoring-core/src/texture-atlas-binary.ts`: raw RGBA atlas binary convention.
- `apps/editor/src/workspace/viewer/viewer-render-source.ts`: Viewer Atlas Runtime availability and remap logic.
- `apps/editor/src/workspace/viewer/viewer-runtime-playback.ts`: Viewer runtime parameter/dynamics playback.
- `apps/editor/src/features/workspace-storage/model/workspace-directory-io.ts`: directory write pattern.
- `apps/editor/src/workspace/workspace-data.ts`: Toolbox entries.

## 5. Wave Strategy

Wave92 should run in ordered batches.

```text
Batch 1:
  Domain A: Runtime Export Package Contract

Batch 2:
  Domain B: Runtime Export Assembly / Preflight

Batch 3:
  Domain C: Runtime Export Editor Task

Batch 4:
  Domain D: Final Integration / Clean Review / Map Closeout
```

Dependency rationale:

- Domain A establishes the serializable DTO/schema/file-set contract.
- Domain B depends on Domain A and materializes export artifacts from `AuthoringSession`.
- Domain C depends on Domain B for readiness/preflight and file-set entries to write.
- Domain B and C are not parallelized because C's UX/status model and tests depend on B's actual preflight result shape.
- Domain D integrates after A/B/C pass or explicit escalation.

## 5.1 Domain Design

| Batch | Domain | Dependency | Parallelism | Purpose |
|---|---|---|---|---|
| 1 | A. Runtime Export Package Contract | Wave91 final pass and Runtime Export design docs | First / blocking | Add pure Runtime Export DTO/schema/file-set/path/binary metadata contract in package-format |
| 2 | B. Runtime Export Assembly / Preflight | Domain A pass | After A; not parallel with A | Add authoring-core export preflight, current atlas guard, materialized runtime graph assembly, atlas-applied UV generation, and raw RGBA binary collection |
| 3 | C. Runtime Export Editor Task | Domain B pass | After B; not parallel with B | Add Toolbox entry, Runtime Export Task screen, readiness UI, directory write flow, and focused app tests |
| 4 | D. Final Integration / Clean Review / Map Closeout | Domain A+B+C pass or explicit escalation | Final only | Validate combined export contract/assembly/UX behavior, record reports/reviews/maps, and run final checks |

## 6. Domain A: Runtime Export Package Contract

Domain id: `wave92-runtime-export-package-contract`

Purpose:

- Define pure serializable Runtime Export v0 DTOs and schemas.
- Define file-set path rules and manifest shape.
- Keep contract browser-independent and runtime-player-independent.

Allowed write scope:

- `packages/package-format/src/**`
- `packages/package-format/src/**/*.test.ts`
- Domain A report/review files under `discussion/implementation/waves/wave92/` and `discussion/implementation/reviews/wave92/`

Forbidden write scope:

- `apps/editor/src/**`
- `packages/authoring-core/src/**`
- `packages/runtime-core/src/**`
- `packages/operation-core/src/**`
- package dependencies / lockfile
- Texture Atlas algorithm files
- Workspace Save unrelated behavior

Required implementation:

- Runtime Export manifest schema.
- Runtime materialized graph schema:
  - model/canvas metadata.
  - parameters and input/output role metadata.
  - included drawables.
  - meshes with atlas-applied UVs.
  - draw order.
  - masks/clipping.
  - rig controls/deformer hierarchy.
  - keyforms.
  - Dynamics groups / solver contract data.
  - texture page references.
- Runtime atlas metadata schema:
  - pages array.
  - placements.
  - atlas source signature.
  - source/content/padded rects and UV rects.
- File-set shape for:
  - `runtime-export.json`
  - `runtime/model.json`
  - `runtime/atlas.json`
  - `assets/textures/*.raw-rgba`
- Path guards for export file-set entries.
- Binary metadata contract for raw RGBA atlas pages.
- Parse/serialize or validate helpers as appropriate.

Required tests:

- Valid minimal runtime export manifest/model/atlas parses.
- Directory file-set paths accept v0 shape.
- Path traversal / absolute / backslash / duplicate paths are rejected.
- Raw RGBA page metadata validates dimensions, byte length, media type, and digest fields.
- v0 single-page artifact validates while schema allows future `pages[]`.
- DTO rejects editor/workspace-only sections if explicitly represented as forbidden.

Escalate if:

- package-format would need runtime-core imports.
- schema cannot represent materialized graph without leaking non-serializable `Map` types.
- contract requires new dependencies.

## 7. Domain B: Runtime Export Assembly / Preflight

Domain id: `wave92-runtime-export-assembly-preflight`

Dependencies:

- Domain A `pass`.

Purpose:

- Build Runtime Export v0 artifacts from `AuthoringSession`.
- Reuse atlas target/signature logic and runtime graph adapters.
- Materialize atlas-applied UVs and texture page refs.
- Produce hard-block preflight result for Editor UX.

Allowed write scope:

- `packages/authoring-core/src/**`
- `packages/authoring-core/src/**/*.test.ts`
- Domain B report/review files under `discussion/implementation/waves/wave92/` and `discussion/implementation/reviews/wave92/`

Forbidden write scope:

- `apps/editor/src/**`
- `packages/package-format/src/**`, except importing Domain A exposed APIs.
- `packages/runtime-core/src/**`, unless an import-only type/adapter usage is already allowed; avoid source edits.
- `packages/operation-core/src/**`
- mesh generation algorithm files
- Texture Atlas packing algorithm changes
- Workspace Save unrelated behavior
- package dependencies / lockfile

Required implementation:

- Runtime Export preflight function.
- Hard-block checks:
  - no committed atlas.
  - missing source signature.
  - stale atlas.
  - missing atlas page / texture entry / binary ref / bytes.
  - dimensions / byte length / media type / digest mismatch.
  - invalid placement data.
  - current packable runtime targets not covered by placements.
  - runtime graph materialization failure.
  - required binary unavailable.
- Runtime target filtering:
  - include only current packable runtime targets covered by atlas.
  - exclude Drawable Pool / unbound Drawables without warning.
- Materialized graph assembly:
  - start from existing runtime graph semantics where useful.
  - make graph JSON-serializable.
  - add atlas texture page refs and atlas-applied UVs to included drawables/meshes.
  - include parameters, keyforms, rig controls, Dynamics, masks, draw order needed for included targets.
  - exclude editor/workspace/source/draft/diagnostics data.
- Runtime atlas metadata assembly.
- Raw RGBA atlas page binary collection.
- Return export file-set entries suitable for app directory write.

Out of scope:

- PNG encoding.
- ZIP/archive.
- runtime/player validation.
- camera/tracker mapping.
- Viewer UI changes.

Required tests:

- Valid session with current committed atlas produces manifest/model/atlas/textures entries.
- Missing atlas hard-blocks.
- Stale atlas hard-blocks.
- Missing atlas bytes hard-block.
- Digest/byte length/media type mismatch hard-block.
- Invalid/missing placement hard-block.
- Drawable Pool / unbound Drawables are excluded without warning/blocking.
- Materialized exported mesh UVs point at atlas page coordinates.
- Included masks reference only included drawables or fail deterministically if unsupported.
- Validate warnings do not block assembly/preflight.
- Source PSD/original bytes and workspace/editor data are not included.

Escalate if:

- Viewer-only atlas remap logic must be duplicated unsafely instead of moved/shared.
- runtime graph materialization requires changing runtime-core semantics.
- masks referencing excluded drawables require a product decision: filter relation vs hard block.

## 8. Domain C: Runtime Export Editor Task

Domain id: `wave92-runtime-export-editor-task`

Dependencies:

- Domain B `pass`.

Purpose:

- Expose Runtime Export v0 in the Editor as a dedicated Task.
- Present readiness/preflight status.
- Write directory artifact using app-layer browser directory IO.
- Keep Runtime Export distinct from Workspace Save and Portable JSON.

Allowed write scope:

- `apps/editor/src/features/editor-session/**`
- `apps/editor/src/features/runtime-export/**`
- `apps/editor/src/workspace/**`
- `apps/editor/src/state/**`
- focused app tests
- Domain C report/review files under `discussion/implementation/waves/wave92/` and `discussion/implementation/reviews/wave92/`

Forbidden write scope:

- `packages/package-format/src/**`, except importing Domain A APIs.
- `packages/authoring-core/src/**`, except importing Domain B APIs.
- `packages/runtime-core/src/**`
- `packages/operation-core/src/**`
- Texture Atlas algorithm changes.
- Workspace Save format changes.
- Portable JSON behavior changes except labels/links if needed.
- package dependencies / lockfile.

Required implementation:

- Add Runtime Export Toolbox entry / route / task screen.
- Add Runtime Export Task UI:
  - readiness state.
  - blocked state with action to Texture Atlas or Validate.
  - ready summary.
  - included/excluded counts.
  - Validate warning indicator.
  - format details.
  - Export Runtime action.
- Directory export write flow:
  - use app-layer directory/file IO patterns.
  - write `runtime-export.json`, `runtime/model.json`, `runtime/atlas.json`, and raw RGBA page bytes.
  - no Portable JSON download fallback.
  - no Workspace Save mutation.
- Capability handling:
  - if directory export is unavailable, disable export with clear reason.
- Navigation:
  - Back returns to neutral Authoring Workspace.
  - `Open Texture Atlas` routes to Texture Atlas Task.
  - `Open Validate` routes to Validate.
- Preserve Viewer and Atlas Runtime behavior.

Out of scope:

- Runtime/player app.
- OBS integration.
- camera mapping UI.
- exported bundle reload.
- single-file export.
- ZIP/archive.
- PNG.
- automatic atlas generation from Runtime Export Task.

Required tests:

- Toolbox contains Runtime Export entry.
- Runtime Export Task opens and Back returns to neutral workspace.
- Missing atlas shows blocked state and `Open Texture Atlas`.
- Stale atlas shows blocked state.
- Valid current atlas shows Ready and enables Export Runtime.
- Validate warnings show compact warning and do not disable Export Runtime.
- Drawable Pool excluded count appears as excluded/non-warning.
- Directory write emits expected files and raw RGBA bytes.
- Directory export unavailable disables export without falling back to Portable JSON.
- Export Runtime does not call Workspace Save or Portable JSON export.
- Existing Workspace Save / Portable JSON tests remain passing.

Escalate if:

- Browser directory export cannot be tested without broad e2e infrastructure.
- Runtime Export Task routing conflicts with Workspace Save Gate.
- Editor task requires changes to Domain B API shape.

## 9. Domain D: Final Integration / Clean Review

Domain id: `wave92-final-integration-clean-review`

Dependencies:

- Domain A `pass`
- Domain B `pass`
- Domain C `pass`

Purpose:

- Verify combined Runtime Export v0.
- Confirm maps/reports are updated.
- Confirm Runtime Export remains separate from Workspace Save / Portable JSON.

Allowed write scope:

- `discussion/implementation/waves/wave92/**`
- `discussion/implementation/reviews/wave92/**`
- orchestration/review/wave maps if status updates are required

Required checks:

- Domain reports and all review lanes present.
- Focused package-format tests for Runtime Export contract.
- Focused authoring-core tests for export assembly/preflight.
- Focused app tests for Runtime Export Task/directory write.
- `pnpm typecheck`.
- source organization check.
- dependency check.
- `git diff --check`.
- Forbidden-scope diff check for package dependencies, runtime/player implementation, PNG/ZIP dependency, Workspace Save mutation, Portable JSON reuse.

## 10. Review Policy

Each implemented domain requires independent review lanes:

1. Spec Compliance Review
2. Design / Development Compliance Review
3. Test Adequacy Review

Spec Compliance Review must explicitly check:

- directory-only export.
- raw RGBA texture page output.
- materialized graph includes atlas-applied UVs and texture page refs.
- current atlas is required and stale/missing atlas hard-blocks.
- Drawable Pool / unbound Drawables are excluded without warning/blocking.
- Validate warnings do not block export.
- runtime/player/camera/OBS implementation is not added.
- Workspace Save and Portable JSON remain separate.

Design / Development Review must explicitly check:

- `package-format` owns pure contract only.
- `authoring-core` owns assembly/preflight.
- `apps/editor` owns UX and browser IO.
- Browser FSA types do not leak into packages.
- runtime-core is not made dependent on package/authoring/file IO.
- operation-core is not used for non-mutating export.
- no new dependencies / lockfile changes.
- no catch-all source files or dependency policy violations.

Test Adequacy Review must explicitly check:

- contract parse/serialize/path guard cases.
- preflight hard-block cases.
- valid export file-set case.
- Drawable Pool exclusion.
- atlas-applied UV materialization.
- Editor blocked/ready/export flows.
- Workspace Save / Portable JSON non-regression.

## 11. Expected Persistent Artifacts

Wave reports:

- `discussion/implementation/waves/wave92/wave92-domain-a-runtime-export-package-contract-report.md`
- `discussion/implementation/waves/wave92/wave92-domain-b-runtime-export-assembly-preflight-report.md`
- `discussion/implementation/waves/wave92/wave92-domain-c-runtime-export-editor-task-report.md`
- `discussion/implementation/waves/wave92/wave92-final-integration-report.md`
- `discussion/implementation/waves/wave92/_map.md`

Review reports:

- `discussion/implementation/reviews/wave92/wave92-domain-a-spec-compliance-review.md`
- `discussion/implementation/reviews/wave92/wave92-domain-a-design-development-review.md`
- `discussion/implementation/reviews/wave92/wave92-domain-a-test-adequacy-review.md`
- `discussion/implementation/reviews/wave92/wave92-domain-b-spec-compliance-review.md`
- `discussion/implementation/reviews/wave92/wave92-domain-b-design-development-review.md`
- `discussion/implementation/reviews/wave92/wave92-domain-b-test-adequacy-review.md`
- `discussion/implementation/reviews/wave92/wave92-domain-c-spec-compliance-review.md`
- `discussion/implementation/reviews/wave92/wave92-domain-c-design-development-review.md`
- `discussion/implementation/reviews/wave92/wave92-domain-c-test-adequacy-review.md`
- `discussion/implementation/reviews/wave92/wave92-final-clean-integration-review.md`
- `discussion/implementation/reviews/wave92/_map.md`

## 12. Subagent Contract

Orch-Sylph instructions must include:

- Use this active wave plan as source of truth.
- Start with bounded current-state confirmation for assigned domain.
- Delegate implementation to Gnome.
- Delegate independent reviews to Review-Sylphs.
- Wait for all started children.
- Treat `wait_agent` timeout as polling timeout.
- Do not close or interrupt running children.
- Close completed child sessions before final domain report.
- Report `pass`, `needs_fix`, `blocked`, or `escalate`.

Gnome instructions must include:

- You are not alone in the codebase.
- Do not revert unrelated changes.
- Work only in allowed scope.
- Do not run `pnpm install`.
- Do not add dependencies.
- Preserve Workspace Save / Portable JSON behavior from Wave90.
- Preserve Texture Atlas artifact separation from Wave88/89.
- Preserve Viewer Atlas Runtime behavior.
- Include Basis Coverage Self-Report and Deferred Basis Items.

Review-Sylph instructions must include:

- Review source and tests, not only Gnome summary.
- Report `pass`, `needs_changes`, or `escalate`.
- Remain read-only unless explicitly delegated a narrow fix.
- Treat forbidden scope as blocking unless explicitly escalated.

## 13. Orchestration Policy

Root / Undine:

- Owns wave plan, user questions, dependency graph, and final report.
- Must not implement Wave92 source changes.
- Must wait for every started subagent.
- Must treat wait timeouts as polling.
- Must not close running children.

Orch-Sylph:

- Owns one domain loop.
- Must start with bounded current-state confirmation.
- Must delegate implementation and review.
- Must wait for Gnome and all Review-Sylphs.
- Must close completed children.
- Must report domain verdict and evidence.

No parent may pass the wave gate while a child is incomplete, running, or unresolved.

## 14. Out of Scope

- Runtime/player app.
- Camera capture / tracker integration.
- OBS integration.
- Camera parameter mapping UI.
- Export bundle reload inside the Editor.
- ZIP/archive export.
- PNG texture export.
- single-file/base64 export.
- automatic atlas generation inside Runtime Export Task.
- multi-page atlas implementation beyond schema allowance.
- WebGL/browser pixel parity proof for external runtime.
- Workspace Save format changes.
- Portable JSON reuse or replacement.
- Operation log persistence.
- New dependencies.
- Cubism SDK / `.moc3` / `.model3.json` / `.physics3.json` compatibility.
