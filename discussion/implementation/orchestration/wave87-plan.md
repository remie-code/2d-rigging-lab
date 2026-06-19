# Wave 87 Plan: Texture Atlas Task v0

> Wave86でMesh生成の主要失敗経路が安定し、Viewer / Dynamics / Diagnosticsも基本導線として成立した。Wave87は、次のruntime接続前段として、編集済みモデルのtexture-backed Drawableをdeterministicにatlas化し、Canvas / Viewerの見た目を破壊せずにruntime-readyなtexture asset構造へ進める。

## 1. Status

- Status: Planned / ready for orchestration
- Target wave: Wave87
- Wave name: `texture-atlas-task-v0`
- Primary objective:
  - runtime graphに所属しているtexture-backed DrawableをTexture Atlas対象として収集する。
  - Drawable Pool上の未所属Drawableをruntime未使用として除外し、ユーザーが認識できるようにする。
  - hiddenな所属済みDrawableは除外せず、`Currently hidden`相当の表示だけに使う。
  - single atlas page v0として、deterministicなpacking previewを生成する。
  - Apply時にgenerated atlas texture asset、layout summary、Drawable texture reference、Mesh UVを更新し、save/load後も成立させる。
  - Texture Atlas専用Task画面を接続し、大きなAtlas Preview、対象summary、settings、warnings、Apply導線を提供する。
  - Workspace Directory Export / AI-native structured workspace saveはWave87対象外とし、次wave前に別途議論する。

## 2. Planning Gate Result

Planning Gate result: `Inventory first -> Plan`.

Why planning is now safe:

- Texture Atlas Task v0のUX方針は [texture-atlas-task.md](../../design/screen-design/screens/texture-atlas-task.md) に反映済み。
- Sylph Aがtexture / mesh / UV / renderer経路を調査し、Atlas Applyの影響境界を確認した。
- Sylph Bがproject state / save-load / task routing / Drawable Pool判定を調査し、専用Task画面と永続化の接続点を確認した。
- ユーザーは以下を採用済み:
  - 対象はruntime graph所属Drawable。
  - Drawable Pool未所属Drawableは除外。
  - hiddenな所属済みDrawableは含める。
  - v0はsingle atlas pageで開始。
  - layout summaryは永続化する。
  - Workspace Directory Exportは後続wave前に別途議論する。

Uncertainty:

- factual: medium. Texture bytes / dimensions / atlas binary asset生成の既存形式に実装時確認が必要。
- decision: low. v0 scopeとUX方針は合意済み。
- cost of wrong plan: high. texture/UV更新を誤るとCanvas/Viewer表示とsave/loadが破綻する。

## 3. Accepted Decisions / Oracles

### 3.1 Target Selection

Wave87のatlas対象は、現在見えているDrawableではなく、runtime graphで使われるtexture-backed Drawableである。

Implementation oracle:

- Include:
  - rig control / deformer hierarchyに所属しているDrawable。
  - 現在Drawable visibility offでも所属済みのDrawable。
  - 現在Parts Container visibility off配下でも所属済みのDrawable。
- Exclude:
  - Drawable Pool上の未所属Drawable。
  - Parts Container。
  - Deformer / rig control。
  - editor-only overlay / preview / handles / mesh wire。
  - unreferenced source texture。
- Warn:
  - bound Drawableにtexture idがない。
  - texture entry / binary asset / dimensionsが解決できない。
  - meshがない、UVが空、vertex/UV countが合わない。
  - selected pageに収まらない。

Current implementation fact:

- Drawable Pool membership is currently defined as “not referenced by any rig control `childDrawableIds`”.
- Current Canvas/runtime paths may still iterate all drawables in places, so Atlas v0 must explicitly use the bound set for target selection instead of relying on broad graph iteration.

### 3.2 Hidden Drawable Policy

Visibility is not target selection.

- Drawable runtime visibility and Parts Container editor hidden state are summary badges only.
- Hidden-but-bound Drawable must still be packed.
- This prevents future runtime/camera-driven visibility changes from revealing missing texture assets.

### 3.3 Atlas Page Policy

Wave87 starts with single atlas page.

- If all included drawables fit, preview can be generated.
- If they do not fit, show deterministic warning / preview failure.
- Multi-page optimization is out of scope.
- Manual placement is out of scope.

### 3.4 Persistence Policy

Wave87 must persist enough atlas state for save/load and future workspace directory export.

Required persistent meaning:

- generated atlas texture entry;
- generated atlas binary asset reference;
- page size;
- padding;
- edge extrusion setting;
- deterministic algorithm id / version;
- per-drawable placement summary;
- per-drawable original texture id or equivalent provenance sufficient to explain the atlas assignment;
- per-drawable atlas rect / UV rect summary.

The exact schema may be an extension of `TextureAtlasFileSchema` or a sibling layout summary schema, but it must serialize through the existing package / portable bundle save-load path.

Do not base64-embed atlas image bytes into JSON.

### 3.5 Atlas Apply Policy

Apply Atlas may update:

- `graph.textureAtlas`;
- generated binary asset entries;
- included `Drawable.textureId`;
- included `Mesh.uvs`;
- atlas layout summary metadata.

Apply Atlas must not update:

- mesh topology / triangles / vertices, except UVs;
- deformer hierarchy;
- keyform values;
- dynamics groups;
- parameter definitions;
- visibility state;
- Drawable Pool membership;
- source texture deletion.

Source texture assets should be retained in v0. Atlas Apply should be explainable and not make future re-pack/refit impossible.

### 3.6 Workspace Directory Export Boundary

AI-native structured workspace save is desirable, but Wave87 does not implement it.

Wave87 should produce data that a future workspace directory export can naturally write as:

```text
model/
assets/
  texture-atlas.json
  textures/
    atlas-page-0.<existing-texture-format>
```

However, Wave87 must not add directory picker, filesystem workspace save, ZIP/archive, File System Access API, or a user-visible image export workflow.

## 4. Primary Basis

Common:

- [Implementation Orchestration Skill](../../../.agents/skills/implementation-orchestration/SKILL.md)
- [UX-Backed Package Logic Authority](../../development_convention/ux-backed-package-logic-authority.md)
- [Source File Organization Policy](../../development_convention/source-file-organization-policy.md)
- [Dependency Policy](../../development_convention/dependency-policy.md)
- [Operation Policy](../../development_convention/operation-policy.md)
- [Schema and ID Conventions](../../development_convention/schema-and-id-conventions.md)

Design basis:

- [Texture Atlas Task v0 screen spec](../../design/screen-design/screens/texture-atlas-task.md)
- [Viewer / Runtime View](../../design/screen-design/screens/viewer-runtime-view.md)
- [Diagnostics / Evidence View](../../design/screen-design/screens/diagnostics-evidence-view.md)
- [Screen Design Map](../../design/screen-design/_map.md)

Wave baseline:

- [Wave85 Plan](wave85-plan.md)
- [Wave85 Final Integration Report](../waves/wave85/wave85-final-integration-report.md)
- [Wave86 Plan](wave86-plan.md)
- [Wave86 Final Integration Report](../waves/wave86/wave86-final-integration-report.md)
- [Wave86 Final Clean Integration Review](../reviews/wave86/wave86-final-clean-integration-review.md)

Factual inventory from planning gate:

- `DrawableDto.textureId` points to `TextureAtlasEntryDto.textureId`.
- actual texture bytes resolve through `binaryAssetRef.packageRelativePath` into session binary assets.
- `MeshDto.uvs` are consumed by Canvas and Viewer through shared render projection paths.
- Canvas and Viewer share enough rendering infrastructure that a correct texture/UV rewrite should affect both.
- Existing `texture-atlas-v1` stores texture entries / preview assets but not page layout / placements / settings.
- Toolbox already has an `atlas` entry, but `AuthoringWorkspace` does not route to a dedicated Atlas screen yet.
- Portable bundle serialization already collects texture atlas binary refs, but generated atlas asset round-trip must be proven.

Likely implementation areas:

- `packages/package-format/src/texture-atlas.ts`
- `packages/package-format/src/package-file-set.ts`
- `packages/package-format/src/portable-package-bundle.ts`
- `packages/authoring-core/src/authoring-graph.ts`
- `packages/authoring-core/src/package-document-from-authoring-session.ts`
- `packages/authoring-core/src/portable-project-bundle.ts`
- `packages/authoring-core/src/texture-asset-mutations.ts`
- `packages/authoring-core/src/drawable-texture-mutations.ts`
- `packages/authoring-core/src/mesh-topology-mutations.ts`
- new focused atlas modules under `packages/authoring-core/src/`
- `apps/editor/src/workspace/authoring-workspace.tsx`
- `apps/editor/src/workspace/workspace-data.ts`
- new Texture Atlas Task UI files under `apps/editor/src/workspace/atlas/` or equivalent existing feature boundary

## 5. Review Policy

Each implementation domain requires three review lanes unless explicitly documented as not applicable:

1. `Spec Compliance Review`
   - Check accepted UX, target selection semantics, persistence policy, and explicit non-goals.
2. `Design / Development Compliance Review`
   - Check package boundaries, source organization, no new dependencies, operation/schema discipline, and renderer boundary preservation.
3. `Test Adequacy Review`
   - Check target selection tests, packing/apply tests, save-load tests, UI routing/tests, and Canvas/Viewer parity evidence.

Domain reports must include:

- Basis Coverage Self-Report
- Current-State Confirmation
- Target Selection Trace
- Packing / Apply Trace
- Persistence Trace
- Canvas / Viewer Parity Trace
- Must-not Compliance Evidence
- Verification
- Residual Risks

## 6. Wave Strategy

```text
Batch 1:
  Domain A: Atlas Core / Schema / Apply Mutation

Batch 2:
  Domain B: Texture Atlas Task UI / Routing / Preview Workflow

Batch 3:
  Domain C: Final Integration / Clean Review / Map Closeout
```

Dependency rationale:

- Domain A must define the authoritative target selection, pack preview, generated asset, UV rewrite, and save/load contract before UI can safely apply it.
- Domain B depends on Domain A APIs and must avoid inventing UI-local atlas behavior.
- Domain C runs only after Domain A and B pass or explicit escalation is recorded.
- Workspace Directory Export is intentionally deferred.

## 7. Acceptance Criteria

### 7.1 Atlas Target Selection

Required:

- Compute included drawables from rig-control-bound/runtime graph membership, not current visibility.
- Exclude Drawable Pool/unbound drawables.
- Mark included hidden drawables with summary metadata rather than excluding them.
- Produce deterministic warnings for missing texture, missing binary, missing mesh, invalid UV/vertex count, and cannot-fit cases.
- Produce a stable summary for Included / Excluded / Warnings.

Must not:

- Treat current Canvas visibility as the atlas include oracle.
- Include editor overlays or draft previews.
- Delete or mutate unbound Drawable Pool entries.

### 7.2 Deterministic Single-Page Packing Preview

Required:

- Generate a single-page layout preview from included drawables and settings.
- Use deterministic ordering and deterministic packing.
- Support page size, padding, and edge extrusion setting.
- Fail gracefully with warning if any target cannot fit.
- Preserve enough preview data for UI hover/select and Apply.

Must not:

- Add manual rect editing.
- Add algorithm comparison UI.
- Add multi-page optimization.
- Add new external dependencies.

### 7.3 Generated Atlas Asset

Required:

- Generate an atlas texture binary asset using the existing project texture byte convention.
- Record dimensions in a way Canvas / Viewer projection can resolve reliably.
- Apply padding and edge extrusion or explicitly record any implementation limitation as an early escape.
- Register the generated atlas texture entry in `graph.textureAtlas`.
- Preserve original source texture assets.

Must not:

- Base64-embed the atlas image in JSON.
- Require PNG encoding or filesystem image export if the current project texture pipeline does not already support it.
- Depend on a browser-only side effect for package persistence.

### 7.4 Apply Mutation

Required:

- Update included `Drawable.textureId` to the generated atlas texture id.
- Rewrite included `Mesh.uvs` to sample the drawable's atlas rect.
- Preserve mesh vertices and triangles.
- Increment/revision mesh state only according to existing mesh mutation semantics.
- Persist layout summary and generated asset through save/load / portable bundle round-trip.
- Keep Canvas and Viewer visually consistent enough that the same pose still renders with the same artwork placement.

Must not:

- Change deformer/keyform/dynamics behavior.
- Change draw order.
- Change visibility.
- Claim workspace directory export support.

### 7.5 Texture Atlas Task UI

Required:

- Connect existing Toolbox `Texture Atlas` entry to a dedicated Task screen.
- Provide Back navigation consistent with Viewer / Diagnostics style.
- Show large Atlas Preview area.
- Show target summary: Included / Excluded / Warnings.
- Show Included / Excluded / Warnings lists with readable reason labels.
- Show settings for page size, padding, and edge extrusion.
- Provide `Generate Preview` and `Apply Atlas` actions.
- Disable or guard `Apply Atlas` when preview is missing, stale, or failed.
- Show currently hidden included drawables as included-but-hidden, not excluded.

Must not:

- Put the main atlas preview inside the Inspector.
- Add camera capture controls.
- Add general workspace save/export UI.
- Add manual rect editing.

### 7.6 Save / Load / Viewer Round Trip

Required:

- Save and reload an applied atlas without losing generated atlas texture entry, binary asset, layout summary, drawable texture refs, or UVs.
- Canvas and Viewer must resolve the generated atlas texture after reload.
- Existing portable bundle export/import must preserve generated atlas binary refs.

Must not:

- Require the original in-memory PSD import session for reloaded atlas rendering.
- Depend on transient UI preview state for runtime rendering.

## 8. Domain Design

| Batch | Domain | Dependency | Purpose |
|---|---|---|---|
| 1 | A. Atlas Core / Schema / Apply Mutation | Wave86 baseline + Texture Atlas spec | Implement target selection, deterministic single-page pack preview, generated atlas asset, layout persistence, Apply mutation, and package tests |
| 2 | B. Texture Atlas Task UI / Routing / Preview Workflow | Domain A pass | Connect dedicated Atlas screen, render summary/preview/settings/warnings, and wire Generate/Apply to Domain A |
| 3 | C. Final Integration / Clean Review / Map Closeout | Domain A+B pass or explicit escalation | Combined validation, clean review, reports/maps |

## 9. Domain A: `wave87-atlas-core-schema-apply-mutation`

Purpose:

- Build the package/authoring foundation that makes Texture Atlas a real project transformation rather than UI-only preview.

Expected implementation areas:

- `packages/package-format/src/texture-atlas.ts`
- `packages/package-format/src/package-file-set.ts`
- `packages/package-format/src/portable-package-bundle.ts`
- `packages/authoring-core/src/package-document-from-authoring-session.ts`
- `packages/authoring-core/src/portable-project-bundle.ts`
- `packages/authoring-core/src/texture-asset-mutations.ts`
- `packages/authoring-core/src/drawable-texture-mutations.ts`
- `packages/authoring-core/src/mesh-topology-mutations.ts`
- new `packages/authoring-core/src/texture-atlas-*` modules or equivalent focused files
- focused tests for touched package/authoring modules
- `discussion/implementation/waves/wave87/**`
- `discussion/implementation/reviews/wave87/**`

Allowed write scope:

- `packages/package-format/src/**` only for atlas schema/file-set/portable bundle support.
- `packages/authoring-core/src/**` only for atlas target selection, packing, generated asset, apply mutation, persistence, and focused tests.
- `packages/validator-core/src/**` only if a narrow atlas validation warning/check is required by the accepted UX.
- `discussion/implementation/waves/wave87/**`
- `discussion/implementation/reviews/wave87/**`

Conditional write scope requiring explicit report justification:

- `packages/runtime-core/src/**` only if texture metadata must be reflected in normalized runtime graph.
- `apps/editor/src/workspace/canvas/**` or `apps/editor/src/workspace/viewer/**` only for resolving generated atlas texture dimensions or shared projection bugs discovered by tests.

Forbidden write scope:

- Workspace Directory Export / filesystem directory save.
- ZIP/archive/File System Access API.
- camera capture / tracking input.
- Viewer controls unrelated to atlas verification.
- Mesh generation algorithms.
- Deformer/keyform/dynamics behavior.
- Manual texture/UV editor.
- New external dependencies.
- Cubism SDK / `.moc3` / `.model3.json` / `.physics3.json` compatibility.

Required tests / evidence:

- Target selection includes bound hidden drawables and excludes unbound Drawable Pool drawables.
- Target selection emits deterministic warning objects for missing texture/mesh/binary/invalid UV cases.
- Single-page packing is deterministic.
- Cannot-fit target fails preview safely.
- Generated atlas asset bytes and texture entry are registered.
- Apply updates `Drawable.textureId` and rewrites `Mesh.uvs` while preserving vertices/triangles.
- Save/load or portable bundle round-trip preserves atlas metadata and generated binary asset.
- Re-applying or generating from an already atlas-applied state is either safely supported or explicitly guarded with a deterministic warning.

Early escape triggers:

- Existing texture byte format cannot represent generated atlas dimensions without broad renderer changes.
- UV rewrite cannot be made reversible/explainable enough to support future re-pack.
- Save/load requires a workspace-directory feature rather than existing package/portable bundle paths.
- Target selection cannot distinguish bound drawables from Drawable Pool without changing runtime semantics broadly.

## 10. Domain B: `wave87-texture-atlas-task-ui-routing-preview`

Purpose:

- Expose Texture Atlas v0 as a dedicated human Task screen that uses Domain A as the source of truth.

Expected implementation areas:

- `apps/editor/src/workspace/authoring-workspace.tsx`
- `apps/editor/src/workspace/workspace-data.ts`
- `apps/editor/src/state/editor-ui-store.ts` if route/state support needs narrow adjustment
- new `apps/editor/src/workspace/atlas/**` or equivalent focused Atlas Task files
- focused UI tests near existing workspace/diagnostics/viewer/task patterns
- `discussion/implementation/waves/wave87/**`
- `discussion/implementation/reviews/wave87/**`

Allowed write scope:

- `apps/editor/src/workspace/**` for Atlas Task screen, routing, preview projection, and tests.
- `apps/editor/src/features/editor-session/**` only for selectors/projections needed by the Atlas screen.
- `apps/editor/src/state/**` only for narrow active screen/tool routing support.
- `discussion/implementation/waves/wave87/**`
- `discussion/implementation/reviews/wave87/**`

Conditional write scope requiring explicit report justification:

- `packages/authoring-core/src/**` only for narrow API fixes discovered while wiring UI, after Domain A is complete.

Forbidden write scope:

- Duplicating atlas target selection or packing logic in UI-local code.
- Inspector-based Atlas UI.
- Manual placement editor.
- Workspace Directory Export.
- Viewer / Dynamics / Mesh / Deformer feature changes unrelated to atlas application.
- New dependencies.

Required tests / evidence:

- Toolbox `Texture Atlas` opens the dedicated Atlas Task screen.
- Back navigation returns to Authoring Workspace.
- Screen displays Included / Excluded / Warnings counts.
- Unbound Drawable Pool items appear as excluded, not included.
- Hidden bound drawables appear as included with hidden indication.
- Generate Preview populates atlas preview state.
- Apply Atlas is disabled before valid preview and enabled after valid preview.
- Apply calls Domain A mutation and updates project state.
- Stale preview guard works when settings or target inputs change.

Early escape triggers:

- Atlas preview needs renderer capabilities that would require a broad Canvas rewrite.
- Existing task routing cannot add Atlas without changing unrelated screen behavior.
- UI cannot show target summary without duplicating core logic.

## 11. Domain C: `wave87-final-integration-clean-review-map-closeout`

Purpose:

- Validate combined Wave87 behavior, obtain independent clean review, and update persistent maps/reports.

Expected implementation areas:

- `discussion/implementation/waves/wave87/**`
- `discussion/implementation/reviews/wave87/**`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`

Acceptance:

- Domain A and Domain B reports exist and record `pass` or explicit escalation.
- Required review lanes exist and pass, or explicit escalation is recorded.
- Final clean integration review exists and passes before Wave87 is marked complete.
- Final report records:
  - target selection semantics;
  - generated atlas asset behavior;
  - layout summary persistence;
  - Apply mutation behavior;
  - Canvas / Viewer and save/load evidence;
  - UI workflow behavior;
  - forbidden scope compliance;
  - validation results;
  - residual risks and next user-decision points, especially Workspace Directory Export.
- Maps mark Wave87 status correctly.

Required checks:

- `pnpm typecheck`
- Focused package-format / authoring-core atlas tests
- Focused portable bundle save/load tests
- Focused Canvas / Viewer projection tests if touched
- Focused Atlas Task UI tests
- `node scripts/check-source-organization.mjs`
- `node scripts/check-dependencies.mjs`
- `git diff --check`

## 12. Verification Matrix

| Requirement | Minimum evidence |
|---|---|
| Bound hidden drawables included | Domain A target selection test + Domain B UI summary test |
| Drawable Pool unbound drawables excluded | Domain A target selection test + Domain B UI summary test |
| Deterministic single-page packing | Domain A packing test |
| Cannot-fit warning/failure | Domain A packing negative test |
| Generated atlas asset registered | Domain A apply test |
| Drawable texture refs updated | Domain A apply test |
| Mesh UVs rewritten without topology changes | Domain A apply test |
| Layout summary persisted | package-format / portable bundle round-trip test |
| Canvas resolves applied atlas | focused Canvas projection/evaluation test |
| Viewer resolves applied atlas | focused Viewer/runtime screen test if needed |
| Dedicated Atlas screen route | Domain B UI/routing test |
| Generate/Apply workflow | Domain B interaction test |
| No workspace directory export claim | Source review + final report |

## 13. Expected Persistent Artifacts

Reports:

- `discussion/implementation/waves/wave87/wave87-domain-a-atlas-core-schema-apply-mutation-report.md`
- `discussion/implementation/waves/wave87/wave87-domain-b-texture-atlas-task-ui-routing-preview-report.md`
- `discussion/implementation/waves/wave87/wave87-final-integration-report.md`
- `discussion/implementation/waves/wave87/_map.md`

Reviews:

- `discussion/implementation/reviews/wave87/wave87-domain-a-spec-compliance-review.md`
- `discussion/implementation/reviews/wave87/wave87-domain-a-design-development-review.md`
- `discussion/implementation/reviews/wave87/wave87-domain-a-test-adequacy-review.md`
- `discussion/implementation/reviews/wave87/wave87-domain-b-spec-compliance-review.md`
- `discussion/implementation/reviews/wave87/wave87-domain-b-design-development-review.md`
- `discussion/implementation/reviews/wave87/wave87-domain-b-test-adequacy-review.md`
- `discussion/implementation/reviews/wave87/wave87-final-clean-integration-review.md`
- `discussion/implementation/reviews/wave87/_map.md`

## 14. Subagent Contract

Domain assignment must include:

- target and wave;
- dependencies;
- allowed write scope;
- forbidden write scope;
- basis documents;
- applicable policies;
- required tests and verification;
- expected evidence;
- loop limit;
- early escape triggers.

Each Orch-Sylph must start with bounded current-state confirmation before delegating to Gnome.

Gnome instructions must include:

- This workspace may already have unrelated dirty changes.
- Do not revert user or other-agent changes.
- Do not run broad refactors.
- Implement within the domain write scope.
- Keep Texture Atlas v0 bounded to single-page deterministic packing.
- Use core/domain APIs as source of truth; do not duplicate target selection in UI.
- Preserve Canvas / Viewer rendering behavior.
- Preserve save/load / portable bundle behavior.
- Do not add workspace directory export.
- Do not add external dependencies.
- Do not add Cubism compatibility or public format claims.

Review-Sylph instructions must include:

- Review from source, tests, plan, and reports, not only from Gnome summary.
- Report `pass`, `needs_changes`, or `escalate`.
- Do not ask the user directly.
- Do not edit files unless explicitly delegated a narrow fix after review.
- Treat hidden Drawable exclusion, Drawable Pool inclusion, UI-local packing logic, missing save/load proof, missing generated asset proof, or workspace export claims as blocking unless explicitly escalated.

## 15. Orchestration Policy

This wave must follow `.agents/skills/implementation-orchestration/SKILL.md`.

Root / Undine:

- Owns wave plan, dependency graph, user questions, and final decision.
- Must not implement the wave.
- Must preserve root context.
- Must wait for every started subagent.
- Must treat `wait_agent` timeout as polling timeout, not failure.
- Must not close, kill, interrupt, or summarize running children as complete.

Orch-Sylph:

- Owns exactly one domain loop.
- Must start with bounded current-state confirmation for its domain.
- Must delegate implementation to Gnome unless the domain is review-only.
- Must delegate review to independent Review-Sylphs.
- Must include separate Spec Compliance Review lane.
- Must wait for Gnome and Review-Sylph completion.
- Must not cancel, close, or interrupt child agents because they are slow or waiting.
- Must close completed child agent sessions at the end of the domain.
- Must not close running child sessions.
- Must report `pass`, `needs_fix`, `blocked`, or `escalate` with file paths, validation, and residual risks.

Gnome:

- Receives domain-specific basis sections only.
- Implements within allowed scope.
- May add dependencies only through dependency policy compliance and escalation.
- Must include Basis Coverage Self-Report and Deferred Basis Items.
- Must not implement unrelated workspace export, Viewer playback, camera, transport, Dynamics, Mesh generation, Deformer, or keyform features.

Review-Sylph:

- Reviews from artifacts and source, not only from Gnome summary.
- Must produce assigned lane report.
- Spec Compliance Review must not silently treat basis omissions as future scope.
- Must check target selection, packing/apply semantics, save/load, generated asset persistence, UI workflow, and forbidden scope explicitly.

Waiting rule:

- `wait_agent` timeout is polling timeout, not failure.
- No parent agent may terminate a child agent's work merely because it has not responded yet.
- If interruption is unavoidable, record incomplete / blocked / escalated. Do not pass the wave gate.

## 16. Out of Scope

- Workspace Directory Export / AI-native structured workspace save.
- User-visible image export button for atlas pages.
- ZIP/archive/File System Access API.
- Multi-page atlas optimization.
- Manual atlas rect editing.
- Packing algorithm comparison UI.
- texture compression / mipmap optimization.
- camera capture / face tracking input.
- Runtime app outside the Editor.
- Mesh generation changes.
- Deformer/keyform/dynamics changes.
- Viewer feature additions unrelated to verifying applied atlas rendering.
- Inspector-based Atlas UI.
- New external dependencies.
- Base64 image embedding in JSON.
- Cubism SDK / `.moc3` / `.model3.json` / `.physics3.json` compatibility.
