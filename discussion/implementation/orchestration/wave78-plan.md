# Wave 78 Plan: Keyed Warp Scale Handles

> Wave77でDeformer Tree上の選択・wrap-selected authoringは完了し、手動rig構造を組むための主要操作は揃った。Wave78は、Warp Deformerのkeyform編集で格子点を1点ずつ動かすだけでなく、現在keyformのlattice offsetsを辺/角ハンドルで一括scaleできるようにする。これはrest frame resizeではなく、parameter keyformに記録されるWarp変形編集である。

## 1. Status

- Status: Planned / ready for orchestration
- Target wave: Wave78
- Wave name: `keyed-warp-scale-handles`
- Primary objective:
  - Warp Deformerの現在keyformに対して、Canvas上のedge/corner transform handlesで全control pointsを一括scaleできるようにする。
  - Edge dragは反対側の辺を固定し、XまたはYの一軸だけをscaleする。
  - Corner dragは対角cornerを固定し、X/Yをscaleする。
  - Scale中は既存Warp control point dragと同じくpreviewを出し、pointerupで`controlPointOffsets`を1回commitする。
  - keyform位置以外ではscale handlesを出さない/操作不可にする。
  - `domainBounds`と`restControlPoints`は変更しない。

## 2. Planning Gate Result

Planning Gate result: `Inventory first`, then `Plan directly`.

Why planning is now safe:

- Read-only Sylph Canvas調査で、既存Warp point dragが`useWarpDeformerControlPointInteraction`からpreview / pointerup commitを扱い、`editKeyformKey(updateCurrent)`へfull `controlPointOffsets`を渡す構造であることを確認した。
- Read-only Sylph model/keyform調査で、Warp keyformは`{ kind: "rigControl", property: "controlPointOffsets" }`をtargetとするrow-major `Vec2[]`であり、runtime samplingも同じpoint count/order前提で補間することを確認した。
- 新しいpackage operationは不要で、既存`editKeyformKey(updateCurrent)` pathを使えることを確認した。
- User decisions are explicit:
  - これはrest frame resizeではない。
  - 常に全control pointsをscale対象にする。
  - 選択control pointだけのscaleは行わない。
  - Edge dragは反対側の辺を固定して一軸scaleする。
  - Corner dragは対角corner固定でX/Y scaleする。
  - Alt/Shift modifiersは不要。
  - keyform位置以外ではscale handlesをdisabled/unavailableにする。
  - `domainBounds` / `restControlPoints`は変更しない。

Uncertainty:

- factual: medium. Parent/child Deformer下でのCanvas-space drag精度は既存point dragと同じ制約を引き継ぐ。
- decision: low. UX仕様は明確。
- cost of wrong plan: high. Raw offset倍率scaleやrest frame resizeと混同すると、keyform編集とsave/loadの意味が壊れる。

## 3. Accepted Decisions / Oracles

### 3.1 Feature Meaning

- Feature name: `Keyed Warp Scale`.
- This edits the current parameter keyform's Warp lattice offsets.
- It does not resize the Warp Deformer's rest/domain frame.
- It does not change child bindings, mesh vertices, `domainBounds`, `restControlPoints`, lattice dimensions, or `warpDeformer` metadata.
- Commit target is a full replacement `controlPointOffsets: Vec2[]` for the current exact keyform.

### 3.2 Editability

- Scale handles are available only when the active parameter value is exactly at an editable keyform for the selected Warp Deformer.
- If `canEditValue === false`, scale handles must not be active.
- Wave78 does not implicitly create a keyform when the user drags a scale handle off-key.
- Existing readonly control point display may remain visible off-key, but scale handles must not imply editability.

### 3.3 Scale Behavior

- Always scale all control points in the Warp lattice.
- Ignore current selected control point indices for scale operations.
- Use current keyed/evaluated lattice point positions as the source shape:

```text
P[i] = restControlPoints[i] + currentOffsets[i]
```

- Compute the current point bounds from all `P[i]`.
- Left edge drag:
  - right edge fixed;
  - X-only scale;
  - Y unchanged.
- Right edge drag:
  - left edge fixed;
  - X-only scale;
  - Y unchanged.
- Top edge drag:
  - bottom edge fixed;
  - Y-only scale;
  - X unchanged.
- Bottom edge drag:
  - top edge fixed;
  - Y-only scale;
  - X unchanged.
- Corner drag:
  - opposite corner fixed;
  - X/Y scale.
- Derive the committed patch from transformed point positions:

```text
nextOffsets[i] = scaledP[i] - restControlPoints[i]
```

- Do not multiply raw offsets by a scale factor. Zero-offset keys must still be scalable.

### 3.4 Interaction

- Hit priority should be:

```text
corner scale handle -> edge scale handle -> control point -> marquee
```

- Drag preview should update evaluated Canvas geometry during pointermove without mutating session state.
- Pointerup should commit once through the existing gesture/undo history path.
- Pointercancel should discard preview without commit.
- Scale handles should visually read as transform handles for the keyed Warp lattice, not as rest frame resize handles.

### 3.5 Legacy / Composition

- Editor-authored Warp offset keyforms use `compositionMode: "replace"` in current flow; Wave78 should keep editing replace-mode keyforms.
- `additiveDelta` support is out of scope unless it is already transparently handled by existing helpers.
- `legacyDefaulted` Warp Deformer read models may show normal Warp UI, but scale handles should be disabled unless exact cardinality and editable replace keyform state are proven.

## 4. Primary Basis

Common:

- [Implementation Orchestration Skill](../../../.agents/skills/implementation-orchestration/SKILL.md)
- [UX-Backed Package Logic Authority](../../development_convention/ux-backed-package-logic-authority.md)
- [Source File Organization Policy](../../development_convention/source-file-organization-policy.md)
- [Dependency Policy](../../development_convention/dependency-policy.md)
- [Operation Policy](../../development_convention/operation-policy.md)
- [Schema and ID Conventions](../../development_convention/schema-and-id-conventions.md)

Wave baseline:

- [Wave77 Plan](wave77-plan.md)
- [Wave77 Final Integration Report](../waves/wave77/wave77-final-integration-report.md)
- [Wave77 Final Clean Integration Review](../reviews/wave77/wave77-final-clean-integration-review.md)

Relevant earlier waves:

- [Wave64 Plan](wave64-plan.md)
- [Wave65 Plan](wave65-plan.md)
- [Wave66 Plan](wave66-plan.md)
- [Wave74 Plan](wave74-plan.md)
- [Wave75 Plan](wave75-plan.md)

Confirmed source facts from read-only investigation:

- `CanvasPreviewPanel` wires `useWarpDeformerControlPointInteraction` and supplies `controlPointPreview`.
- `use-warp-deformer-control-point-interaction.ts` owns Warp point/marquee drag state, preview projection, exact-key edit gate, and pointerup commit.
- `warp-deformer-control-points.ts` contains pure geometry for point positions, hit testing, selection, drag delta, and offset equality.
- `warp-deformer-control-point-gesture.ts` already creates `editKeyformKey(updateCurrent)` gestures for full `controlPointOffsets`.
- `parameter-keyform-state.ts` exposes `canEditValue` only at exact current keyform value.
- Warp lattice point order is row-major: `row * latticeColumns + column`.
- Runtime sampling blends `Vec2[]` element-by-element and requires matching point counts.
- Runtime Warp evaluation starts from zero offsets and applies sampled `controlPointOffsets`.

## 5. Review Policy

Each implementation domain requires three review lanes unless explicitly documented as not applicable:

1. `Spec Compliance Review`
   - Classify each in-scope requirement as `implemented` / `explicit non-goal` / `deferred by plan` / `unclear` / `not relevant`.
   - `unclear` is not pass.
2. `Design / Development Compliance Review`
   - Check module boundaries, deterministic behavior, source organization, UI semantics, and forbidden scope.
3. `Test Adequacy Review`
   - Check unit/component/e2e coverage, negative cases, and regression protection for existing Warp point editing.

Domain reports must include:

- Basis Coverage Self-Report
- User-Facing UX Trace
- Data / Keyform / Gesture Contract Trace
- Must-not Compliance Evidence
- Residual Risk Classification

## 6. Wave Strategy

```text
Batch 1:
  Domain A: Warp Scale Geometry + Keyform Safety Model

Batch 2:
  Domain B: Canvas Scale Handles + Gesture Integration

Batch 3:
  Domain C: Final Integration / Clean Review / Map Closeout
```

Dependency rationale:

- Domain A produces pure scale math, cardinality guards, and model-level tests.
- Domain B depends on A to render handles, hit-test, preview, and commit scale drags through existing Warp gesture infrastructure.
- Domain C runs after A/B pass or explicit escalation.

## 7. Acceptance Criteria

### 7.1 Warp Scale Geometry

Required:

- A pure helper computes scaled full `controlPointOffsets` from rest points, current offsets, and handle movement.
- Left/right edge handles scale X only with the opposite edge fixed.
- Top/bottom edge handles scale Y only with the opposite edge fixed.
- Corner handles scale X/Y with the opposite corner fixed.
- Orthogonal axis remains unchanged for edge handles.
- All control points are transformed.
- Selected control point state does not affect scale output.
- New offsets are computed as `scaledP - restPoint`.
- Raw offset-vector multiplication is not used as the scale semantics.
- Zero/near-zero span, non-finite values, and cardinality mismatch are guarded deterministically.

Must not:

- Change `domainBounds`.
- Change `restControlPoints`.
- Change lattice row/column counts.
- Support selected-control-point-only scale.
- Add Alt/Shift modifier semantics.

### 7.2 Canvas Interaction

Required:

- Scale handles appear for editable committed Warp Deformers at exact keyform positions.
- Scale handles are unavailable off-key.
- Corner handles and edge handles are hit-tested before control points.
- Dragging a handle previews scaled Warp lattice offsets on Canvas.
- Pointerup commits exactly once through the existing gesture/history path.
- Pointercancel clears preview without commit.
- Existing point drag and marquee selection remain usable.
- Existing Rotation Deformer interaction priority remains intact.
- Scale handle styling clearly distinguishes keyed lattice transform from rest frame resize.

Must not:

- Implicitly create keyforms.
- Commit while `canEditValue === false`.
- Trigger rest-frame update operations.
- Break existing Warp single/multi point drag behavior.

### 7.3 Keyform / Runtime Semantics

Required:

- Commit payload targets `controlPointOffsets`.
- Commit payload has exact `latticeColumns * latticeRows` cardinality.
- Commit uses existing `editKeyformKey(updateCurrent)` path.
- Save/load behavior remains covered by existing keyform persistence path.
- Runtime sampling still interpolates scaled offsets deterministically.
- Invalid point count remains rejected or unevaluated through existing validation path.

Must not:

- Add a new operation when existing `editKeyformKey` is sufficient.
- Reinterpret `controlPointOffsets` as rest-frame control points.
- Broaden additiveDelta editing unless existing behavior already supports it safely.

### 7.4 Tests and UX Proof

Required:

- Pure helper tests cover left/right/top/bottom edge scale.
- Pure helper tests cover all four corner scale handles.
- Tests cover 2x2 and non-square lattice such as 3x2.
- Tests cover all-points scaling, opposite side/corner fixed behavior, and unchanged orthogonal axis for edge handles.
- Tests cover zero/near-zero span guard.
- Tests cover off-key scale handle unavailable behavior.
- Hook/interaction tests cover preview, pointerup commit once, and pointercancel discard.
- Existing Warp point drag tests remain passing.
- Focused runtime or evaluation regression proves scaled offsets affect evaluated geometry deterministically.

## 8. Domain Design

| Batch | Domain | Dependency | Purpose |
|---|---|---|---|
| 1 | A. Warp Scale Geometry + Keyform Safety Model | Wave77 pass baseline | Add pure keyed lattice scale math and model/cardinality safety coverage |
| 2 | B. Canvas Scale Handles + Gesture Integration | Domain A pass | Add edge/corner handles, hit testing, preview, and commit integration |
| 3 | C. Final Integration / Clean Review / Map Closeout | Domains A-B pass or explicit escalation | Combined validation, clean review, reports/maps |

## 9. Domain A: `wave78-warp-scale-geometry-keyform-safety-model`

Purpose:

- Add pure model helpers for edge/corner keyed Warp scale and guard the full-offset commit shape.

Expected implementation areas:

- `apps/editor/src/workspace/canvas/warp-deformer-scale.ts` or equivalent sibling helper
- `apps/editor/src/workspace/canvas/warp-deformer-scale.test.ts`
- `apps/editor/src/workspace/canvas/warp-deformer-control-points.ts` only if shared point helpers need export
- `apps/editor/src/workspace/canvas/warp-deformer-control-points.test.ts` if existing test file is the local convention
- `packages/operation-core/src/operations/edit-keyform-key.test.ts` only if cardinality rejection coverage is missing
- `packages/authoring-core/src/keyform-mutations.test.ts` only if package-level Warp cardinality coverage is missing
- `packages/runtime-core/src/**` tests only if no existing deterministic scaled-offset runtime regression exists

Required tests / evidence:

- Edge scale tests for left/right/top/bottom.
- Corner scale tests for all corners.
- Non-square lattice test.
- Zero/near-zero span guard.
- Non-finite/cardinality mismatch guard.
- Evidence that helper returns full offset arrays and never mutates inputs.

Early escape triggers:

- Existing editor coordinate helpers cannot provide stable rest/current point positions without broad refactor.
- Operation/keyform validation gap requires schema redesign rather than narrow tests.

## 10. Domain B: `wave78-canvas-keyed-warp-scale-handles-gesture-integration`

Purpose:

- Expose keyed Warp scale handles on Canvas and route drag preview/commit through existing Warp keyform gesture flow.

Expected implementation areas:

- `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts`
- `apps/editor/src/workspace/canvas/canvas-renderer.ts`
- `apps/editor/src/workspace/canvas/canvas-evaluation.ts`
- `apps/editor/src/workspace/canvas/canvas-projection.ts`
- `apps/editor/src/workspace/panels/canvas-preview-panel.tsx`
- `apps/editor/src/workspace/canvas/*test.ts`
- `apps/editor/e2e/psd-import.e2e.spec.ts` only for focused smoke if practical

Required tests / evidence:

- Scale handles hidden/unavailable off-key.
- Scale handles appear at exact editable keyform positions.
- Hit priority covers corner/edge before point drag.
- Pointermove preview updates full `controlPointOffsets`.
- Pointerup commits once.
- Pointercancel discards preview.
- Existing point drag and marquee tests remain passing.
- Canvas/evaluation projection shows scaled preview affects evaluated geometry.

Early escape triggers:

- Pointer event infrastructure cannot distinguish scale handles from point handles without broad Canvas rewrite.
- Parent-transformed Warp coordinate issue causes worse behavior than existing point drag and needs a product decision.

## 11. Domain C: `wave78-final-integration-clean-review-map-closeout`

Purpose:

- Validate combined Wave78 behavior, obtain independent clean review, and update persistent maps/reports.

Expected implementation areas:

- `discussion/implementation/waves/wave78/**`
- `discussion/implementation/reviews/wave78/**`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`

Acceptance:

- Domain A-B reports exist and record `pass` or explicit escalation.
- Required review lanes exist and pass, or explicit escalation is recorded.
- Final clean integration review exists and passes before Wave78 is marked complete.
- Final report records:
  - feature meaning and non-goals;
  - edge/corner scale math;
  - keyform editability gate;
  - preview/commit path;
  - no rest-frame mutation evidence;
  - validation results;
  - residual risks.
- Maps mark Wave78 status correctly.

Required checks:

- `pnpm typecheck`
- Focused editor canvas/model tests
- Focused keyform/operation/runtime tests if changed
- Focused Playwright smoke if practical
- `node scripts/check-source-organization.mjs`
- `node scripts/check-dependencies.mjs`
- `git diff --check`

## 12. Verification Matrix

| Requirement | Minimum evidence |
|---|---|
| Left/right edge X-only scale | Pure helper tests |
| Top/bottom edge Y-only scale | Pure helper tests |
| Corner XY scale | Pure helper tests |
| All points scale | Pure helper tests on 2x2 and 3x2 |
| Opposite side/corner fixed | Pure helper tests |
| Off-key handles unavailable | Hook/component/projection test |
| Preview without mutation | Hook/projection test |
| Pointerup single commit | Hook/gesture test |
| Pointercancel discard | Hook/gesture test |
| Existing point drag not regressed | Existing and focused tests |
| No domain/rest mutation | Test or source review evidence |
| Runtime scaled offset deterministic | Runtime/evaluation regression |

## 13. Expected Persistent Artifacts

Reports:

- `discussion/implementation/waves/wave78/wave78-domain-a-warp-scale-geometry-keyform-safety-model-report.md`
- `discussion/implementation/waves/wave78/wave78-domain-b-canvas-keyed-warp-scale-handles-gesture-integration-report.md`
- `discussion/implementation/waves/wave78/wave78-final-integration-report.md`
- `discussion/implementation/waves/wave78/_map.md`

Reviews:

- `discussion/implementation/reviews/wave78/wave78-domain-a-spec-compliance-review.md`
- `discussion/implementation/reviews/wave78/wave78-domain-a-design-development-review.md`
- `discussion/implementation/reviews/wave78/wave78-domain-a-test-adequacy-review.md`
- `discussion/implementation/reviews/wave78/wave78-domain-b-spec-compliance-review.md`
- `discussion/implementation/reviews/wave78/wave78-domain-b-design-development-review.md`
- `discussion/implementation/reviews/wave78/wave78-domain-b-test-adequacy-review.md`
- `discussion/implementation/reviews/wave78/wave78-final-clean-integration-review.md`
- `discussion/implementation/reviews/wave78/_map.md`

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
- Preserve Wave77 accepted behavior.
- Keep rest-frame resize, selected-point-only scale, implicit key creation, Alt/Shift modifiers, and domain/rest mutation out of implementation.

Review-Sylph instructions must include:

- Review from source, tests, plan, and reports, not only from Gnome summary.
- Report `pass`, `needs_changes`, or `escalate`.
- Do not ask the user directly.
- Do not edit files unless explicitly delegated a narrow fix after review.

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
- Must not implement rest frame resize, selected-control-point-only scale, implicit keyform creation, additiveDelta expansion, or Canvas selection redesign.

Review-Sylph:

- Reviews from artifacts and source, not only from Gnome summary.
- Must produce assigned lane report.
- Spec Compliance Review must not silently treat basis omissions as future scope.
- Must check forbidden scope and negative cases explicitly.

Waiting rule:

- `wait_agent` timeout is polling timeout, not failure.
- No parent agent may terminate a child agent's work merely because it has not responded yet.
- If interruption is unavoidable, record incomplete / blocked / escalated. Do not pass the wave gate.

## 16. Out of Scope

- Rest frame resize.
- `domainBounds` edits.
- `restControlPoints` edits.
- Lattice row/column count edits.
- Selected-control-point-only scale.
- Alt/Shift scale modifiers.
- Off-key implicit keyform creation.
- New operation type for Warp scale.
- AdditiveDelta authoring expansion.
- Canvas Ctrl/Shift multi-select.
- Deformer Tree changes.
- Mesh generation changes.
- Renderer architecture work.
- Viewer / Runtime View implementation.
- Texture Atlas Task.
- Timeline / motion clip authoring.
- Auto-rigging or semantic inference.
- Cubism SDK / `.moc3` / `.model3.json` compatibility.
