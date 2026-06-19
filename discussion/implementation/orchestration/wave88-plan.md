# Wave 88 Plan: Texture Atlas Artifact Separation + Viewer Atlas Runtime Mode

> Wave87でTexture Atlas Task v0は成立したが、`Apply Atlas` がauthoring `Drawable.textureId` / `Mesh.uvs` をatlas用に差し替える設計になっていた。Wave88はこの意味を修正し、Atlasをauthoring model破壊ではなくruntime artifactとしてproject stateへcommitする。Canvasはoriginal texture固定、Viewerは`Original` / `Atlas Runtime`を切り替えられる状態にする。

## 1. Status

- Status: Planned / ready for orchestration
- Target wave: Wave88
- Wave name: `texture-atlas-artifact-separation-viewer-runtime-mode`
- Primary objective:
  - `Apply Atlas` をartifact-only commitへ変更し、authoring `Drawable.textureId` / `Mesh.uvs` / `topologyRevision` を変更しない。
  - `textureAtlas` artifactとして、generated atlas texture entry、layout summary、generated binary asset、source signatureをproject stateへcommitする。
  - 既存save/load / portable bundleでatlas artifactを保存・復元できる状態を維持する。
  - Authoring Canvasはoriginal texture / original UVで描画し続けることを保証する。
  - Viewerに`Original` / `Atlas Runtime` render source modeを追加する。
  - Viewer `Atlas Runtime` modeでは、authoring stateを変更せず、committed atlas artifactを使ってprojectionを一時remapして描画する。
  - atlas missing / stale時は`Atlas Runtime`をdisabledにする。
  - Texture Atlas / Viewerの設計ドキュメントをこの責務分離に更新する。
  - Workspace Directory ExportはWave88対象外とする。

## 2. Planning Gate Result

Planning Gate result: `Inventory first -> Plan`.

Why planning is now safe:

- ユーザーは以下の設計転換を採用済み:
  - `Apply Atlas` はauthoring texture / UVを差し替えない。
  - `Apply Atlas` はruntime `textureAtlas` artifactをproject stateへcommitする。
  - Canvasはoriginal texture固定。
  - Viewerは`Original` / `Atlas Runtime`を切り替える。
  - missing/stale atlasでは`Atlas Runtime`をdisabledにする。
  - Workspace Directory Exportは後続議論へ回す。
- Sylph AがWave87 Apply / Schema / Operationを調査し、破壊的書き換え箇所が狭いことを確認した。
- Sylph BがCanvas / Viewer描画経路を調査し、Viewer-only projection remapで実装できる見込みを確認した。

Uncertainty:

- factual: medium-low. 破壊的書き換え箇所とViewer projection境界は確認済みだが、source signatureの詳細実装には実装時確認が必要。
- decision: low. UXと責務分離は合意済み。
- cost of wrong plan: high. Atlas Applyの意味を誤ると、authoring編集体験とruntime確認が混線する。

## 3. Accepted Decisions / Oracles

### 3.1 Apply Atlas Meaning

`Apply Atlas` はauthoring modelをatlas textureへ差し替える操作ではない。

Required:

- Commit runtime atlas artifact into project state.
- Preserve authoring `Drawable.textureId`.
- Preserve authoring `Mesh.uvs`.
- Preserve `Mesh.topologyRevision`.
- Preserve source textures.

Forbidden:

- `Drawable.textureId = atlasTextureId` のようなauthoring texture ref差し替え。
- `Mesh.uvs = remappedUv` のようなauthoring UV差し替え。
- topology revision increment caused only by atlas artifact commit.

### 3.2 Runtime Artifact Storage

Runtime atlas artifact lives in project state under existing texture atlas structures.

Artifact meaning:

- `graph.textureAtlas.textures[]` contains generated atlas texture entry.
- `graph.textureAtlas.layoutSummary` contains layout settings, page, placements, and source signature.
- session binary assets contain generated atlas raw RGBA bytes.
- existing save/load / portable bundle paths persist those structures.

Workspace Directory Export is not implemented in Wave88.

### 3.3 Canvas Responsibility

Authoring Canvas is the editing surface. It must remain original texture / original UV only.

Required:

- Canvas rendering remains based on authoring `Drawable.textureId` and authoring `Mesh.uvs`.
- Committed atlas artifact must not affect Canvas rendering.
- Canvas tests must prove original texture/UV preservation after Apply Atlas.

### 3.4 Viewer Render Source Modes

Viewer is the completed-model confirmation surface. It should support both authoring-result confirmation and runtime-artifact confirmation.

Required modes:

- `Original`
  - Existing Viewer behavior.
  - Uses original texture / original UV.
- `Atlas Runtime`
  - Uses committed atlas artifact.
  - Does not mutate session graph.
  - Temporarily remaps Viewer projection texture refs/bytes/dimensions/UVs.

UI:

- Place the mode control in Runtime Controls, above parameter search.
- Use a segmented control or equivalent compact two-state UI.
- If `Atlas Runtime` becomes invalid while selected, fall back to `Original`.

### 3.5 Missing / Stale Atlas Policy

`Atlas Runtime` is disabled when atlas is missing or stale.

Missing if:

- no `textureAtlas.layoutSummary`;
- no generated atlas texture entry;
- no atlas `binaryAssetRef`;
- atlas bytes are not loaded;
- atlas dimensions are invalid;
- byte length does not match `page.width * page.height * 4`.

Stale if accepted source inputs changed:

- bound Drawable membership;
- placement drawable / mesh / original texture ids;
- mesh topology / UV / bounds inputs used for atlas generation;
- original texture byte identity / digest / dimensions;
- layout settings such as page size, padding, edge extrusion.

Not stale if only these changed:

- deformer hierarchy transforms;
- keyforms;
- dynamics;
- current parameter values;
- editor hidden part state;
- general `authoringRevision` or `packageRevision` changes unrelated to atlas source inputs.

Implementation should add a persisted source signature or equivalent deterministic freshness marker to `layoutSummary`.

### 3.6 Regenerate / Replace Policy

If an atlas artifact already exists, generating/applying a new preview replaces the previous artifact.

Required:

- Do not block preview only because `textureAtlas.layoutSummary` exists.
- Replace/regenerate semantics must be deterministic.
- Existing `atlas.target.alreadyAtlasApplied` warning behavior must be changed or narrowed so it does not block normal artifact replacement.

### 3.7 Documentation Policy

Wave88 must update design docs so future agents do not reintroduce destructive Atlas Apply semantics.

Required docs:

- [Texture Atlas Task v0 screen spec](../../design/screen-design/screens/texture-atlas-task.md)
- [Viewer / Runtime View](../../design/screen-design/screens/viewer-runtime-view.md)
- relevant screen-design maps if status/summary wording needs updating.

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
- [Screen Design Map](../../design/screen-design/_map.md)

Wave baseline:

- [Wave87 Plan](wave87-plan.md)
- [Wave87 Final Integration Report](../waves/wave87/wave87-final-integration-report.md)
- [Wave87 Final Clean Integration Review](../reviews/wave87/wave87-final-clean-integration-review.md)
- [Wave87 Domain A Report](../waves/wave87/wave87-domain-a-atlas-core-schema-apply-mutation-report.md)
- [Wave87 Domain B Fix Loop 1 Report](../waves/wave87/wave87-domain-b-fix-loop-1-operation-backed-apply-image-preview-report.md)

Factual inventory from planning gate:

- `packages/authoring-core/src/texture-atlas-mutations.ts` `applyTextureAtlasPreview()` registers artifact pieces and then destructively changes authoring drawable/mesh state.
- Destructive writes are concentrated in:
  - `Drawable.textureId = preview.atlasTextureId`;
  - `Mesh.uvs = rewriteUvIntoAtlas(...)`;
  - `mesh.topologyRevision = getNextTopologyRevision(mesh)`.
- Reusable pieces:
  - target selection;
  - single-page packing;
  - generated raw RGBA atlas bytes;
  - binary ref generation;
  - layout summary schema;
  - package / portable bundle atlas save-load paths.
- Viewer reuses Canvas projection and can add `Atlas Runtime` by transforming the Viewer projection before render.
- render-core/WebGL already consumes texture ids and UVs supplied by projection; no renderer change should be required for v0.

Likely implementation areas:

- `packages/package-format/src/texture-atlas.ts`
- `packages/authoring-core/src/texture-atlas-mutations.ts`
- `packages/authoring-core/src/texture-atlas-targets.ts`
- `packages/authoring-core/src/texture-atlas-packing.ts`
- `packages/operation-core/src/payloads/texture-atlas.ts`
- `packages/operation-core/src/operations/apply-texture-atlas-preview.ts`
- `apps/editor/src/workspace/viewer/**`
- `apps/editor/src/workspace/atlas/**`
- `apps/editor/src/workspace/canvas/**` tests only if proving Canvas original preservation
- `discussion/design/screen-design/screens/texture-atlas-task.md`
- `discussion/design/screen-design/screens/viewer-runtime-view.md`

## 5. Review Policy

Each implementation domain requires three review lanes unless explicitly documented as not applicable:

1. `Spec Compliance Review`
   - Check accepted destructive-apply removal, Canvas responsibility, Viewer modes, missing/stale policy, and Workspace Directory Export exclusion.
2. `Design / Development Compliance Review`
   - Check package/operation/viewer boundaries, no broad renderer change, no UI-local atlas logic duplication, and source organization.
3. `Test Adequacy Review`
   - Check artifact-only Apply tests, Canvas preservation tests, Viewer Original/Atlas Runtime tests, missing/stale disabled tests, and save/load/operation evidence.

Domain reports must include:

- Basis Coverage Self-Report
- Current-State Confirmation
- Artifact-only Apply Trace
- Source Signature / Stale Policy Trace
- Canvas Preservation Trace
- Viewer Atlas Runtime Trace
- Documentation Trace
- Must-not Compliance Evidence
- Verification
- Residual Risks

## 6. Wave Strategy

```text
Batch 1:
  Domain A: Artifact-only Atlas Apply / Source Signature / Operation Contract

Batch 2:
  Domain B: Viewer Original / Atlas Runtime Mode

Batch 3:
  Domain C: Final Integration / Docs / Clean Review / Map Closeout
```

Dependency rationale:

- Domain A must remove destructive authoring mutation and establish persisted source signature before Viewer can reliably determine missing/stale atlas.
- Domain B depends on Domain A's artifact-only state and source signature.
- Domain C integrates source, docs, reports, maps, and final clean review.

## 7. Acceptance Criteria

### 7.1 Artifact-only Apply

Required:

- `Apply Atlas` registers generated atlas texture entry.
- `Apply Atlas` registers generated atlas binary asset bytes.
- `Apply Atlas` writes or replaces `textureAtlas.layoutSummary`.
- `Apply Atlas` records source signature or equivalent freshness marker.
- `Apply Atlas` preserves authoring `Drawable.textureId`.
- `Apply Atlas` preserves authoring `Mesh.uvs`.
- `Apply Atlas` preserves mesh vertices / triangles / topologyRevision.
- Existing source textures remain available.

Must not:

- Treat atlas generation as a mesh topology mutation.
- Rewrite authoring UVs.
- Rewrite authoring drawable texture refs.
- Delete source texture assets.

### 7.2 Operation Core Contract

Required:

- Operation Core `applyTextureAtlasPreview` continues to own user-facing Apply.
- Operation diff / evidence reflects artifact-only changes, not drawable/mesh model rewrites.
- Stale preview rejection still works.
- Replacing an existing atlas artifact is allowed and deterministic.

Must not:

- Reintroduce direct editor-session mutation.
- Leave operation tests asserting destructive drawable/mesh changes.

### 7.3 Save / Load / Portable Bundle

Required:

- Save/load preserves `textureAtlas.textures`, generated atlas binary asset ref, layout summary, and source signature.
- Portable bundle round-trip preserves generated atlas binary bytes.
- Reloaded project can still use the artifact for Viewer Atlas Runtime if not stale.

### 7.4 Canvas Original Preservation

Required:

- After Apply Atlas, Canvas projection still uses original drawable texture ids.
- After Apply Atlas, Canvas projection still uses original mesh UVs.
- Canvas rendering path does not use atlas artifact unless a future explicit Canvas mode is added.

### 7.5 Viewer Atlas Runtime Projection

Required:

- Viewer `Original` mode matches existing clean-stage behavior.
- Viewer `Atlas Runtime` mode creates a temporary projection using atlas texture bytes and remapped UVs.
- Viewer remap does not mutate `session.graph`.
- Viewer projection can resolve atlas binary bytes and dimensions.
- Remapped UVs follow placement `uvRect`.
- `renderCanvasProjection` / render-core / WebGL can consume the remapped projection without renderer changes.

Must not:

- Route Viewer rendering through runtime-core if that requires broad texture materialization changes.
- Change Canvas projection semantics for Viewer-only behavior.

### 7.6 Viewer UI

Required:

- Add `Original` / `Atlas Runtime` mode control to Runtime Controls.
- Put the control above parameter search.
- Disable `Atlas Runtime` with a deterministic reason when atlas is missing or stale.
- Fall back to `Original` if selected mode becomes invalid.
- Do not show atlas diagnostics as primary Viewer content; detailed problems remain in task/validation surfaces.

### 7.7 Stale Detection

Required:

- Missing and stale status are deterministic.
- Deformer/keyform/dynamics/parameter changes do not stale atlas.
- Mesh/UV/bounds/source texture/membership/settings changes do stale atlas.
- Tests cover at least one stale and one non-stale case.

### 7.8 Design Documentation

Required:

- Texture Atlas doc states:
  - Apply commits runtime artifact;
  - authoring texture/UV are preserved;
  - Workspace Directory Export is future scope.
- Viewer doc states:
  - Viewer supports `Original` and `Atlas Runtime`;
  - `Atlas Runtime` uses committed artifact;
  - missing/stale disables `Atlas Runtime`.
- Maps are updated if needed.

## 8. Domain Design

| Batch | Domain | Dependency | Purpose |
|---|---|---|---|
| 1 | A. Artifact-only Atlas Apply / Source Signature / Operation Contract | Wave87 final pass | Remove destructive Apply semantics and persist source signature |
| 2 | B. Viewer Original / Atlas Runtime Mode | Domain A pass | Add Viewer mode toggle and projection-only atlas remap |
| 3 | C. Final Integration / Docs / Clean Review / Map Closeout | Domain A+B pass | Validate combined behavior, update docs/maps/reports, obtain final clean review |

## 9. Domain A: `wave88-artifact-only-atlas-apply-source-signature`

Purpose:

- Change Atlas Apply semantics from destructive authoring rewrite to artifact-only project commit.

Expected implementation areas:

- `packages/package-format/src/texture-atlas.ts`
- `packages/authoring-core/src/texture-atlas-mutations.ts`
- `packages/authoring-core/src/texture-atlas-targets.ts`
- `packages/authoring-core/src/texture-atlas-packing.ts`
- `packages/operation-core/src/payloads/texture-atlas.ts`
- `packages/operation-core/src/operations/apply-texture-atlas-preview.ts`
- focused tests for authoring-core, operation-core, package-format, portable bundle
- `discussion/implementation/waves/wave88/**`
- `discussion/implementation/reviews/wave88/**`

Allowed write scope:

- `packages/package-format/src/**` for atlas schema/source signature.
- `packages/authoring-core/src/**` for artifact-only apply, source signature computation, target/regenerate semantics, tests.
- `packages/operation-core/src/**` for atlas operation contract/diff/tests.
- `discussion/implementation/waves/wave88/**`
- `discussion/implementation/reviews/wave88/**`

Conditional write scope requiring explicit report justification:

- `apps/editor/src/workspace/atlas/**` only if Atlas Task stale/wording must change to align with artifact-only apply.
- `apps/editor/src/features/editor-session/**` only if operation result shape requires narrow session integration adjustment.

Forbidden write scope:

- Viewer UI/render mode.
- Workspace Directory Export.
- Manual atlas editing.
- Multi-page atlas.
- Camera capture.
- Mesh generation algorithms.
- Deformer/keyform/dynamics behavior.
- New dependencies.

Required tests / evidence:

- Apply preserves all original `Drawable.textureId`.
- Apply preserves all original `Mesh.uvs`.
- Apply preserves mesh topology revisions.
- Apply writes/replaces atlas layout summary and texture entry.
- Apply registers generated atlas binary bytes.
- Operation diff/evidence no longer claims drawable/mesh rewrites.
- Regenerate/replace works when a prior atlas artifact exists.
- Save/load / portable bundle round-trip preserves artifact.
- Source signature changes for mesh/UV/source texture/settings/membership changes.
- Source signature does not change for deformer/keyform/dynamics-only changes.

Early escape triggers:

- artifact-only apply cannot preserve save/load without broad package schema replacement.
- source signature cannot be computed deterministically from available data.
- existing Atlas Task cannot generate preview after prior artifact without broad UI rewrite.

## 10. Domain B: `wave88-viewer-original-atlas-runtime-mode`

Purpose:

- Add Viewer render source mode toggle and runtime artifact rendering without changing Canvas or authoring state.

Expected implementation areas:

- `apps/editor/src/workspace/viewer/viewer-clean-stage.ts`
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx`
- `apps/editor/src/workspace/viewer/runtime-controls.tsx`
- new `apps/editor/src/workspace/viewer/viewer-render-source.ts` or equivalent helper
- focused Viewer / Canvas projection tests
- focused Runtime Controls tests
- `discussion/implementation/waves/wave88/**`
- `discussion/implementation/reviews/wave88/**`

Allowed write scope:

- `apps/editor/src/workspace/viewer/**`
- `apps/editor/src/workspace/canvas/**` only for tests or narrow projection type support needed by Viewer.
- `apps/editor/src/workspace/atlas/**` only for shared missing/stale helper reuse, not UI overhaul.
- `apps/editor/src/features/editor-session/**` only for passing render source mode state if necessary.
- `discussion/implementation/waves/wave88/**`
- `discussion/implementation/reviews/wave88/**`

Conditional write scope requiring explicit report justification:

- `packages/render-core/src/**` only if existing render scene types need a narrow field for atlas runtime projection.

Forbidden write scope:

- Authoring-core Apply semantics, except narrow helper reuse if Domain A exposes API after pass.
- render-webgl2 shader/renderer changes unless an early escape is recorded.
- Workspace Directory Export.
- Viewer playback/dynamics features unrelated to render source mode.
- Canvas user-facing render mode toggle.
- New dependencies.

Required tests / evidence:

- Viewer Original mode keeps existing projection behavior.
- Viewer Atlas Runtime mode remaps texture id, bytes/dimensions, and UVs using placement `uvRect`.
- Viewer Atlas Runtime mode does not mutate `session.graph`.
- Canvas projection remains original after Apply Atlas.
- Missing atlas disables Atlas Runtime.
- Stale atlas disables Atlas Runtime.
- Deformer/keyform/dynamics changes do not stale Atlas Runtime.
- Runtime Controls shows mode control and disabled reason.
- Selected invalid `Atlas Runtime` mode falls back to `Original`.

Early escape triggers:

- Viewer projection remap requires broad renderer/WebGL changes.
- existing projection shape cannot represent temporary atlas bytes without mutating session.
- source signature/missing-state API from Domain A is insufficient and cannot be fixed narrowly.

## 11. Domain C: `wave88-final-integration-docs-clean-review-map-closeout`

Purpose:

- Validate combined Wave88 behavior, update design docs, obtain independent clean review, and close maps/reports.

Expected implementation areas:

- `discussion/design/screen-design/screens/texture-atlas-task.md`
- `discussion/design/screen-design/screens/viewer-runtime-view.md`
- `discussion/design/screen-design/screens/_map.md`
- `discussion/design/screen-design/_map.md`
- `discussion/implementation/waves/wave88/**`
- `discussion/implementation/reviews/wave88/**`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`
- narrow source/test fixes only if final clean review requires them.

Allowed write scope:

- docs/maps/reports listed above.
- source/test files only for narrow clean-review fixes.

Forbidden write scope:

- new product features;
- Workspace Directory Export;
- manual atlas editing;
- multi-page atlas;
- camera capture;
- broad refactors.

Acceptance:

- Domain A and Domain B reports exist and pass.
- Required review lanes exist and pass.
- Final clean integration review exists and passes before Wave88 is marked complete.
- Final report records:
  - artifact-only Apply semantics;
  - source signature / stale policy;
  - Canvas original preservation;
  - Viewer Original / Atlas Runtime behavior;
  - save/load evidence;
  - documentation updates;
  - forbidden scope compliance;
  - residual risks and next user-decision points.

Required checks:

- `pnpm typecheck`
- focused authoring-core / operation-core atlas tests
- focused package / portable bundle tests
- focused Canvas / Viewer projection tests
- focused Viewer UI tests
- `node scripts/check-source-organization.mjs`
- `node scripts/check-dependencies.mjs`
- `git diff --check`

## 12. Verification Matrix

| Requirement | Minimum evidence |
|---|---|
| Apply does not rewrite Drawable texture refs | authoring-core apply test |
| Apply does not rewrite Mesh UVs/topology revision | authoring-core apply test |
| Layout summary/source signature persists | package/portable bundle tests |
| Existing atlas can be replaced | authoring-core/operation test |
| Operation Core diff is artifact-only | operation-core test |
| Canvas remains original | Canvas projection test |
| Viewer Original mode unchanged | Viewer projection test |
| Viewer Atlas Runtime remaps projection only | Viewer render source test |
| Missing/stale disables Atlas Runtime | Viewer/UI tests |
| Deformer/keyform/dynamics do not stale atlas | source signature test |
| Runtime Controls mode UI exists | Viewer UI test |
| Docs capture design shift | docs diff + clean review |

## 13. Expected Persistent Artifacts

Reports:

- `discussion/implementation/waves/wave88/wave88-domain-a-artifact-only-atlas-apply-source-signature-report.md`
- `discussion/implementation/waves/wave88/wave88-domain-b-viewer-original-atlas-runtime-mode-report.md`
- `discussion/implementation/waves/wave88/wave88-final-integration-report.md`
- `discussion/implementation/waves/wave88/_map.md`

Reviews:

- `discussion/implementation/reviews/wave88/wave88-domain-a-spec-compliance-review.md`
- `discussion/implementation/reviews/wave88/wave88-domain-a-design-development-review.md`
- `discussion/implementation/reviews/wave88/wave88-domain-a-test-adequacy-review.md`
- `discussion/implementation/reviews/wave88/wave88-domain-b-spec-compliance-review.md`
- `discussion/implementation/reviews/wave88/wave88-domain-b-design-development-review.md`
- `discussion/implementation/reviews/wave88/wave88-domain-b-test-adequacy-review.md`
- `discussion/implementation/reviews/wave88/wave88-final-clean-integration-review.md`
- `discussion/implementation/reviews/wave88/_map.md`

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
- Preserve authoring texture/UV in Apply Atlas.
- Keep Workspace Directory Export out of scope.
- Do not add dependencies.
- Do not add Cubism compatibility or public format claims.

Review-Sylph instructions must include:

- Review from source, tests, plan, reports, and docs, not only from Gnome summary.
- Report `pass`, `needs_changes`, or `escalate`.
- Do not ask the user directly.
- Do not edit files unless explicitly delegated a narrow fix after review.
- Treat destructive atlas apply, Canvas atlas rendering, missing stale tests, missing Viewer disabled state, or workspace export claims as blocking unless explicitly escalated.

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
- Must not implement unrelated workspace export, camera, transport, Dynamics, Mesh generation, Deformer, or keyform features.

Review-Sylph:

- Reviews from artifacts and source, not only from Gnome summary.
- Must produce assigned lane report.
- Spec Compliance Review must not silently treat basis omissions as future scope.
- Must check artifact-only Apply, Canvas responsibility, Viewer render source mode, stale policy, save/load, docs, and forbidden scope explicitly.

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
- Canvas atlas render mode toggle.
- New external dependencies.
- Base64 image embedding in JSON.
- Cubism SDK / `.moc3` / `.model3.json` / `.physics3.json` compatibility.
