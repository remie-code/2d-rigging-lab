# Wave 89 Plan: Texture Atlas Performance + Viewer Atlas Runtime Scope Fix

> Wave87/88でTexture Atlas TaskとViewer Atlas Runtime modeは成立したが、Texture Atlas画面のpadding/settings変更やApply Atlasが重く、さらにApply後もViewer `Atlas Runtime` がdisabledになるケースが確認された。Wave89は、新機能を広げず、既存Atlas UXを軽くし、Atlas RuntimeのDrawable対象範囲を仕様に合わせて修正する。

## 1. Status

- Status: Planned / ready for orchestration
- Target wave: Wave89
- Wave name: `texture-atlas-performance-viewer-runtime-scope-fix`
- Primary objective:
  - Texture Atlas settings変更時に、full RGBA atlas imageを再生成・再描画しない。
  - `Generate Preview` 時だけ重いatlas image generationを行う。
  - stale previewでは古いpreview画像を残しつつ、stale状態として表示する。
  - `Apply Atlas` 時の重複target selection / source signature / raw RGBA generation / byte copyを減らす。
  - Viewer `Original` modeで不要なatlas source-signature計算を避ける。
  - Viewer `Atlas Runtime` はruntime graph所属Drawableだけを描画・placement判定対象にし、Drawable Pool / unbound Drawableを描画しない。
  - Viewer `Original` modeは現状維持し、unbound Drawableも表示されてよい。
  - Workspace Directory Export、worker化、multi-page atlas、manual atlas editingはWave89対象外とする。

## 2. Planning Gate Result

Planning Gate result: `Plan directly`.

Why planning is now safe:

- Performance issueのread-only調査で、settings変更時にも`createTextureAtlasPageRgbaBytes()`が呼ばれ、2048/4096 RGBA buffer生成とcanvas paintが同期実行されていることが確認済み。
- Apply時の重さも、preview再生成、target/signature再計算、raw bytes生成、hash、binary asset登録、history deep cloneが重なっていることが確認済み。
- Viewer disabled問題は、AtlasがDrawable Pool/unbound Drawableを除外する一方、Viewerが投影上の全renderable Drawableにplacementを要求していることが原因として特定済み。
- ユーザーは以下を採用済み:
  - Viewer `Atlas Runtime` はruntime graph所属Drawableだけを描画対象にする。
  - Drawable Pool/unbound Drawableは`Atlas Runtime`では描画しない。
  - Viewer `Original` modeは現状維持し、unbound Drawableも表示されてよい。
  - stale previewは消すより、古いpreviewを残してstale表示する方針。
  - worker化やhistory binary storage大改修は後回し。

Uncertainty:

- factual: low. 主な詰まり箇所とdisabled理由は調査済み。
- decision: low. UX方針は合意済み。
- cost of wrong plan: medium. 調整範囲を誤ると重さが残るが、Atlas/Viewerの中核仕様は既に確立している。

## 3. Accepted Decisions / Oracles

### 3.1 Texture Atlas Settings Performance

Settings変更はmetadata-onlyにする。

Required:

- padding / page size / edge extrusion変更時はpreviewをstaleにする。
- settings変更だけでraw RGBA atlas imageを生成しない。
- settings変更だけでcanvas `putImageData()` を呼ばない。
- stale状態では古いpreview imageを残し、stale indicatorを表示する。

Forbidden:

- settings変更のたびに`createTextureAtlasPageRgbaBytes()`を呼ぶ。
- settings変更のたびにtarget source texture bytesをcloneする。
- stale previewをfresh previewとしてApply可能にする。

### 3.2 Generate Preview Responsibility

`Generate Preview` は重い処理を行ってよい唯一のAtlas Task UI actionである。

Required:

- target selection、packing、source signature、raw RGBA atlas image generationはGenerate Preview時に実行する。
- generated preview bytes/imageはpreview signatureに紐付けてcacheまたはstable stateとして扱う。
- Apply前にpreviewがstaleならApplyをguardする。

### 3.3 Apply Atlas Performance

Operation Coreの権威は維持するが、明らかな重複生成/重複計算を減らす。

Required:

- ApplyはOperation Core-backedのままにする。
- Apply時のguardは維持する。
- Apply時に、可能な範囲でGenerate Preview済みのlayout/source signature/bytesを再利用する、または重い生成回数を減らす。
- Apply後のproject stateはWave88のartifact-only semanticsを維持する。

Must not:

- direct editor-session mutationへ戻す。
- destructive authoring texture/UV rewriteへ戻す。
- Operation Core stale checkを外す。

### 3.4 Viewer Original Performance

Viewer `Original` modeはAtlas Runtime availability/source signatureの重い計算を毎回行わない。

Required:

- `Original` modeでは、atlas source signature hashingやtarget selectionを避けるか、必要最小限にする。
- Runtime playback中にOriginal modeでatlas source signatureが毎frame相当に走らないようにする。

### 3.5 Viewer Atlas Runtime Drawable Scope

Viewer `Atlas Runtime` はruntime/export相当の確認モードである。

Required:

- `Atlas Runtime` projectionはruntime graph所属Drawableだけを描画対象にする。
- Drawable Pool / unbound Drawableは`Atlas Runtime` projectionから除外する。
- placement必須判定もruntime graph所属Drawableに限定する。
- runtime graph所属Drawableにplacementがない場合はdisabled/errorにする。
- Viewer `Original` modeは現状維持し、unbound Drawableも表示してよい。

Forbidden:

- Drawable Pool/unbound DrawableをAtlas targetに無理に含める。
- `Atlas Runtime`でunbound Drawableのmissing placementを理由に全体をdisableする。
- `Original` modeの責務をこのwaveで変更する。

### 3.6 Non-goals

Wave89 does not implement:

- Workspace Directory Export;
- Web Worker conversion;
- structural sharing / binary-storage history overhaul;
- multi-page atlas;
- manual atlas editor;
- Canvas atlas render mode;
- browser pixel proof;
- camera capture;
- new dependencies.

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
- [Wave88 Plan](wave88-plan.md)
- [Wave88 Final Integration Report](../waves/wave88/wave88-final-integration-report.md)
- [Wave88 Final Clean Integration Review](../reviews/wave88/wave88-final-clean-integration-review.md)

Factual inventory:

- Texture Atlas settings change currently updates React settings and synchronously runs `createTextureAtlasTaskProjection()`.
- `createTextureAtlasTaskProjection()` calls `createPreviewPage(preview)`.
- `createPreviewPage()` calls `createTextureAtlasPageRgbaBytes()` even when preview is stale.
- `createTextureAtlasPageRgbaBytes()` allocates `page.width * page.height * 4` and copies source/extrusion pixels.
- Preview canvas copies bytes again through `new Uint8ClampedArray(image.rgbaBytes)` and `putImageData()`.
- `selectTextureAtlasTargets()` clones source texture bytes with `new Uint8Array(binaryEntry.bytes)`.
- Apply recreates preview through Operation Core and authoring-core guard paths, then creates/hashes/registers atlas bytes.
- Viewer currently disables Atlas Runtime if any projected renderable Drawable lacks placement.
- Texture Atlas target selection intentionally excludes Drawable Pool/unbound Drawable.

Likely implementation areas:

- `apps/editor/src/workspace/atlas/atlas-task-projection.ts`
- `apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx`
- `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts`
- `packages/authoring-core/src/texture-atlas-targets.ts`
- `packages/authoring-core/src/texture-atlas-packing.ts`
- `packages/authoring-core/src/texture-atlas-binary.ts`
- `packages/authoring-core/src/texture-atlas-mutations.ts`
- `packages/operation-core/src/operations/apply-texture-atlas-preview.ts`
- `apps/editor/src/workspace/viewer/viewer-render-source.ts`
- `apps/editor/src/workspace/viewer/viewer-render-source.test.ts`
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`
- `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts`

## 5. Review Policy

Each implementation domain requires three review lanes unless explicitly documented as not applicable:

1. `Spec Compliance Review`
   - Check performance UX behavior, stale preview semantics, Atlas Runtime drawable scope, and explicit non-goals.
2. `Design / Development Compliance Review`
   - Check boundaries, no broad renderer/history rewrite, no new dependencies, no destructive apply regression, and no UI-local domain duplication.
3. `Test Adequacy Review`
   - Check regression tests for settings/no generation, Generate Preview generation, Apply reduced duplication, Viewer scope, and Original-mode no heavy signature.

Domain reports must include:

- Basis Coverage Self-Report
- Current-State Confirmation
- Performance Bottleneck Trace
- Stale Preview Trace
- Apply Computation Trace
- Viewer Runtime Scope Trace
- Must-not Compliance Evidence
- Verification
- Residual Risks

## 6. Wave Strategy

```text
Batch 1:
  Domain A: Texture Atlas Task / Apply Performance Fix
  Domain B: Viewer Atlas Runtime Scope + Original Mode Perf Guard

Batch 2:
  Domain C: Final Integration / Clean Review / Map Closeout
```

Dependency rationale:

- Domain A and Domain B can run in parallel if their write scopes remain disjoint:
  - Domain A owns Atlas Task / authoring-core / operation-core performance.
  - Domain B owns Viewer runtime source scope and Original mode guard.
- If either domain needs to modify the other's primary files, it must report the need instead of silently crossing scope.
- Domain C integrates both after pass or explicit escalation.

## 7. Acceptance Criteria

### 7.1 Settings Change Does Not Generate Atlas Bytes

Required:

- Changing padding/page size/edge extrusion marks preview stale.
- Changing settings does not call raw RGBA page generation.
- Changing settings does not repaint atlas preview image.
- Apply is disabled while preview is stale.
- Old preview remains visible with clear stale affordance.

### 7.2 Generate Preview Owns Heavy Image Generation

Required:

- Generate Preview creates target selection, packing, source signature, and raw atlas image.
- Generate Preview produces actual artwork preview.
- Generate Preview stores or caches generated image data under a stable preview signature.
- Re-rendering the same screen does not regenerate raw atlas bytes unless inputs changed and user generates again.

### 7.3 Apply Avoids Avoidable Redundant Work

Required:

- Apply remains Operation Core-backed.
- Apply validates stale state.
- Apply reduces redundant target selection/source signature/raw bytes generation where safe.
- Apply does not return or copy large raw bytes more than necessary.
- Apply remains artifact-only and does not mutate authoring texture/UV.

### 7.4 Viewer Original Mode Avoids Atlas Runtime Work

Required:

- Viewer `Original` mode does not perform atlas source signature hashing per projection/frame.
- Viewer `Original` mode does not run atlas target selection just to render.
- Viewer `Original` mode behavior remains otherwise unchanged.

### 7.5 Viewer Atlas Runtime Scope

Required:

- `Atlas Runtime` includes only runtime graph / rig-bound Drawable in projection.
- Drawable Pool/unbound Drawable is omitted from `Atlas Runtime` projection.
- Missing placement only disables Atlas Runtime for runtime graph Drawable.
- Unbound Drawable with no placement does not disable Atlas Runtime.
- `Original` mode can still show unbound Drawable.

### 7.6 Diagnostics / Debuggability

Required:

- Viewer disabled reason remains deterministic.
- At least tests or debug-facing reason detail can distinguish missing placement from stale/missing artifact.
- If feasible without UI clutter, include reason code/details in a developer-facing path.

## 8. Domain Design

| Batch | Domain | Dependency | Purpose |
|---|---|---|---|
| 1 | A. Texture Atlas Task / Apply Performance Fix | Wave88 final pass | Stop stale/settings changes from regenerating bytes; reduce Apply duplication; keep stale preview visible |
| 1 | B. Viewer Atlas Runtime Scope + Original Mode Perf Guard | Wave88 final pass | Exclude Drawable Pool from Atlas Runtime, limit placement requirement, avoid Original-mode atlas signature work |
| 2 | C. Final Integration / Clean Review / Map Closeout | Domain A+B pass or explicit escalation | Validate combined behavior, record reports/reviews/maps |

## 9. Domain A: `wave89-texture-atlas-task-apply-performance-fix`

Purpose:

- Make Texture Atlas interactions responsive by removing avoidable synchronous image generation and redundant Apply work.

Expected implementation areas:

- `apps/editor/src/workspace/atlas/atlas-task-projection.ts`
- `apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx`
- `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts`
- `packages/authoring-core/src/texture-atlas-targets.ts`
- `packages/authoring-core/src/texture-atlas-packing.ts`
- `packages/authoring-core/src/texture-atlas-binary.ts`
- `packages/authoring-core/src/texture-atlas-mutations.ts`
- `packages/operation-core/src/operations/apply-texture-atlas-preview.ts`
- focused tests for touched files
- `discussion/implementation/waves/wave89/**`
- `discussion/implementation/reviews/wave89/**`

Allowed write scope:

- `apps/editor/src/workspace/atlas/**`
- `packages/authoring-core/src/texture-atlas-*.ts`
- `packages/operation-core/src/**texture-atlas**`
- focused tests for touched modules
- `discussion/implementation/waves/wave89/**`
- `discussion/implementation/reviews/wave89/**`

Conditional write scope requiring explicit report justification:

- `apps/editor/src/features/editor-session/**` only for narrow Apply/history integration performance fixes.
- `packages/package-format/src/texture-atlas.ts` only if type shape must distinguish preview image cache metadata without adding new product scope.

Forbidden write scope:

- Viewer render source / Runtime Controls files.
- Workspace Directory Export.
- workerization.
- history structural-sharing overhaul.
- multi-page atlas.
- manual atlas editor.
- destructive atlas apply.
- new dependencies.

Required tests / evidence:

- Settings change after preview does not call page-byte generation.
- Settings change marks preview stale and disables Apply.
- Old preview remains visible while stale.
- Generate Preview creates page bytes exactly once for a given user action in the focused test.
- Apply remains Operation Core-backed and artifact-only.
- Apply avoids documented redundant generation or records any remaining unavoidable pass with rationale.
- Existing Atlas Task tests remain passing.

Early escape triggers:

- Avoiding stale byte generation requires broad React state rewrite beyond Atlas Task.
- Apply duplication cannot be reduced without violating Operation Core stale-check authority.
- Performance fix requires workerization or new dependencies.

## 10. Domain B: `wave89-viewer-atlas-runtime-scope-original-perf-guard`

Purpose:

- Align Viewer Atlas Runtime with runtime/export semantics and avoid unnecessary atlas work in Original mode.

Expected implementation areas:

- `apps/editor/src/workspace/viewer/viewer-render-source.ts`
- `apps/editor/src/workspace/viewer/viewer-render-source.test.ts`
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`
- `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts`
- focused tests for touched files
- `discussion/implementation/waves/wave89/**`
- `discussion/implementation/reviews/wave89/**`

Allowed write scope:

- `apps/editor/src/workspace/viewer/**`
- focused tests for touched modules
- `discussion/implementation/waves/wave89/**`
- `discussion/implementation/reviews/wave89/**`

Conditional write scope requiring explicit report justification:

- `packages/authoring-core/src/texture-atlas-targets.ts` only if an existing exported helper is needed to compute runtime-bound Drawable ids without duplication.
- `apps/editor/src/workspace/atlas/**` only if a shared fixture/test helper must be adjusted.

Forbidden write scope:

- Atlas Task performance files owned by Domain A unless explicitly coordinated.
- Authoring-core Apply semantics.
- Canvas render mode toggle.
- render-webgl2 renderer/shader changes.
- Workspace Directory Export.
- new dependencies.

Required tests / evidence:

- After Apply Atlas with unbound Drawable Pool drawables present, Viewer Atlas Runtime is available.
- Atlas Runtime projection omits unbound Drawable Pool drawables.
- Atlas Runtime still disables when a runtime graph Drawable is missing placement.
- Original mode still includes unbound Drawable where current behavior does.
- Original mode does not recompute atlas source signature / target selection on every projection.
- Missing/stale artifact tests remain passing.

Early escape triggers:

- Determining runtime-bound Drawable set requires changing runtime graph semantics broadly.
- Filtering Atlas Runtime projection requires broad Canvas projection rewrite.
- Original-mode performance guard requires changing Viewer playback architecture broadly.

## 11. Domain C: `wave89-final-integration-clean-review-map-closeout`

Purpose:

- Validate combined Wave89 behavior, obtain independent clean review, and update persistent reports/maps.

Expected implementation areas:

- `discussion/implementation/waves/wave89/**`
- `discussion/implementation/reviews/wave89/**`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`
- narrow source/test fixes only if final clean review requires them.

Allowed write scope:

- docs/maps/reports listed above.
- source/test files only for narrow clean-review fixes.

Forbidden write scope:

- new product features;
- Workspace Directory Export;
- workerization;
- manual atlas editing;
- multi-page atlas;
- camera capture;
- broad refactors.

Acceptance:

- Domain A and Domain B reports exist and pass.
- Required review lanes exist and pass.
- Final clean integration review exists and passes before Wave89 is marked complete.
- Final report records:
  - settings/performance behavior;
  - Apply computation behavior;
  - Viewer Atlas Runtime scope;
  - Viewer Original performance guard;
  - forbidden scope compliance;
  - validation results;
  - residual risks and next user-decision points.

Required checks:

- `pnpm typecheck`
- focused Atlas Task performance tests
- focused authoring-core / operation-core atlas tests if touched
- focused Viewer render source tests
- focused Runtime Controls tests
- `node scripts/check-source-organization.mjs`
- `node scripts/check-dependencies.mjs`
- `git diff --check`

## 12. Verification Matrix

| Requirement | Minimum evidence |
|---|---|
| Settings change does not generate RGBA bytes | Atlas Task test with spy/counter |
| Stale preview remains visible and Apply disabled | Atlas Task UI test |
| Generate Preview creates bytes only on action | Atlas Task projection/UI test |
| Apply remains Operation Core-backed | operation/editor test |
| Apply stays artifact-only | authoring/operation tests |
| Original mode avoids atlas signature work | Viewer render source test |
| Atlas Runtime excludes Drawable Pool | Viewer projection test |
| Unbound Drawable does not disable Atlas Runtime | Viewer regression test |
| Runtime Drawable missing placement still disables | Viewer negative test |
| No worker/export/manual editor scope | source review + final report |

## 13. Expected Persistent Artifacts

Reports:

- `discussion/implementation/waves/wave89/wave89-domain-a-texture-atlas-task-apply-performance-fix-report.md`
- `discussion/implementation/waves/wave89/wave89-domain-b-viewer-atlas-runtime-scope-original-perf-guard-report.md`
- `discussion/implementation/waves/wave89/wave89-final-integration-report.md`
- `discussion/implementation/waves/wave89/_map.md`

Reviews:

- `discussion/implementation/reviews/wave89/wave89-domain-a-spec-compliance-review.md`
- `discussion/implementation/reviews/wave89/wave89-domain-a-design-development-review.md`
- `discussion/implementation/reviews/wave89/wave89-domain-a-test-adequacy-review.md`
- `discussion/implementation/reviews/wave89/wave89-domain-b-spec-compliance-review.md`
- `discussion/implementation/reviews/wave89/wave89-domain-b-design-development-review.md`
- `discussion/implementation/reviews/wave89/wave89-domain-b-test-adequacy-review.md`
- `discussion/implementation/reviews/wave89/wave89-final-clean-integration-review.md`
- `discussion/implementation/reviews/wave89/_map.md`

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
- Keep Workspace Directory Export out of scope.
- Do not add dependencies.
- Do not add workerization unless explicitly escalated and approved.
- Preserve Wave88 artifact-only Apply semantics.
- Preserve Viewer Original mode behavior except for avoiding unnecessary atlas work.

Review-Sylph instructions must include:

- Review from source, tests, plan, and reports, not only from Gnome summary.
- Report `pass`, `needs_changes`, or `escalate`.
- Do not ask the user directly.
- Do not edit files unless explicitly delegated a narrow fix after review.
- Treat stale settings byte generation, destructive Apply regression, Atlas Runtime disabling due to unbound Drawable Pool, missing tests, or forbidden scope as blocking unless explicitly escalated.

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
- Must not implement unrelated workspace export, workerization, camera, transport, Dynamics, Mesh generation, Deformer, or keyform features.

Review-Sylph:

- Reviews from artifacts and source, not only from Gnome summary.
- Must produce assigned lane report.
- Spec Compliance Review must not silently treat basis omissions as future scope.
- Must check performance behavior, viewer runtime scope, tests, and forbidden scope explicitly.

Waiting rule:

- `wait_agent` timeout is polling timeout, not failure.
- No parent agent may terminate a child agent's work merely because it has not responded yet.
- If interruption is unavoidable, record incomplete / blocked / escalated. Do not pass the wave gate.

## 16. Out of Scope

- Workspace Directory Export / AI-native structured workspace save.
- Web Worker conversion.
- History structural sharing / binary asset storage overhaul.
- User-visible image export button for atlas pages.
- ZIP/archive/File System Access API.
- Multi-page atlas optimization.
- Manual atlas rect editing.
- Packing algorithm comparison UI.
- texture compression / mipmap optimization.
- browser pixel proof.
- camera capture / face tracking input.
- Runtime app outside the Editor.
- Mesh generation changes.
- Deformer/keyform/dynamics changes.
- Canvas atlas render mode toggle.
- New external dependencies.
- Base64 image embedding in JSON.
- Cubism SDK / `.moc3` / `.model3.json` / `.physics3.json` compatibility.
