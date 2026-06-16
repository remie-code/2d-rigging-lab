# Wave 75 Plan: Rotation Translation Keyform Authoring + Deformer Inspector Density Cleanup

> Wave74で下位補間は証明されたが、実ユーザー操作列ではRotation translation keyformが作られず、スライダーで平行移動が補間されない問題が残った。Wave75はこのauthoring導線を修正し、あわせてRotation/Warp Deformer Inspectorから重複・非操作情報を削って縦幅を節約する。

## 1. Status

- Status: Planned / ready for orchestration
- Target wave: Wave75
- Wave name: `rotation-translation-keyform-authoring-deformer-inspector-density-cleanup`
- Primary objective:
  - ユーザー操作列で、Rotation Deformerのangleだけでなくtranslationもparameter keyformとして作成・更新され、スライダー中間値で平行移動が線形補間されるようにする。
  - Rotation Deformer UIをWarp Deformer側の方針に寄せ、Parameter Bindingカード内の個別Add/Update/Delete操作を削る。
  - Rotation/Warp Deformer Inspectorから重複するOpacity fieldや非操作情報を削り、操作可能な項目をスクロールなしに見やすくする。

## 2. Planning Gate Result

Planning Gate result: `Plan directly`.

Why planning is now safe:

- ユーザーが実際の再現操作列を提示済み:
  1. PSD import;
  2. mesh generation;
  3. `Create Rotation Deformer`;
  4. active parameterを`Face Angle Z`へ切り替え;
  5. `Ends + Center`でkeyform作成;
  6. parameter valueをmax `30`へ設定;
  7. Canvasで回転handleをドラッグして傾ける;
  8. Canvasでtranslation handleをドラッグして平行移動する;
  9. sliderを動かすと角度だけ補間され、translationが補間されない。
- Sylph read-only調査により、下位のVec2補間・Canvas評価・slider parameter value伝播は存在することが確認済み。
- 本命原因は、`Ends + Center`がRotation Deformerの先頭bindingである`angleDegrees`だけに作用し、translation keyform setが未作成のままCanvas translation dragが`restTranslation`編集に落ちること。
- ユーザーがRotation/Warp Deformer UI cleanup方針を明示済み。

Uncertainty:

- factual: low to medium. 実装箇所の詳細確認はDomain内で必要だが、原因仮説とUX方向は十分具体化済み。
- decision: low. ユーザーのUI削除方針は明確。
- cost of wrong plan: medium. keyform authoring導線を誤ると、今後のDeformer操作全体のUXが混乱する。

## 3. Accepted Decisions / Oracles

- Wave75はWave74完了状態を前提にする。
- Rotation `translation` Vec2補間そのものをruntimeから作り直さない。
- ユーザー操作列そのものを受け入れ基準にする。
- `Ends + Center`後、active parameterのexact key positionでRotation translation handleをドラッグした場合、translationは`restTranslation`ではなくkeyform authoring対象になるべき。
- Translation keyform setが未作成の場合は、既存のRotation angle keyform positionsなど同じrigControl/parameter上のkey positionsを使ってtranslation keyform setをmaterializeし、現在keyだけをdrag結果で更新する。
- Materialize時の他key valuesは、既存のevaluated/rest translationを使い、意図しない全域移動を避ける。
- active parameterがない、またはkeyform contextがない状態でtranslation handleを動かす既存setup操作は、必要に応じて`restTranslation`編集として維持してよい。
- Parameter Bindingカード内の個別Add/Update/Delete buttonsは削除する。
- Rotation/Warp DeformerのOpacity MultiplierはInspector基本情報から削除し、Parameter Binding側のvalue controlを残す。
- Rotation Inspectorは操作可能な項目を優先し、非操作情報や重複表示を削る。
- No slider performance optimization in this wave.
- No mesh generation, renderer architecture, package format, Viewer, Texture Atlas, Variant, Cubism compatibility, or LLM/provider work.

## 4. Primary Basis

Common:

- [Implementation Orchestration Skill](../../../.agents/skills/implementation-orchestration/SKILL.md)
- [UX-Backed Package Logic Authority](../../development_convention/ux-backed-package-logic-authority.md)
- [Source File Organization Policy](../../development_convention/source-file-organization-policy.md)
- [Dependency Policy](../../development_convention/dependency-policy.md)
- [Operation Policy](../../development_convention/operation-policy.md)
- [Schema and ID Conventions](../../development_convention/schema-and-id-conventions.md)

Wave baseline:

- [Wave74 Plan](wave74-plan.md)
- [Wave74 Final Integration Report](../waves/wave74/wave74-final-integration-report.md)
- [Wave74 Final Clean Integration Review](../reviews/wave74/wave74-final-clean-integration-review.md)
- [Wave74 Domain A Report](../waves/wave74/wave74-domain-a-deformer-foundation-fixes-report.md)
- [Wave74 Domain B Report](../waves/wave74/wave74-domain-b-save-load-keyform-visibility-hardening-report.md)

Design / UX:

- [Rig Tool Component](../../design/screen-design/components/rig-tool.md)
- [Parameter Keyform Component](../../design/screen-design/components/parameter-keyform.md)
- [Canvas Preview Component](../../design/screen-design/components/canvas-preview.md)

Confirmed source facts from read-only investigation:

- `parameter-keyform-state.ts` interpolates Vec2 and writes sampled Rotation translation into `rigTranslationById`.
- Parameter Bar slider updates the editor `parameterValues` map.
- Canvas projection/evaluation receives those `parameterValues`.
- Canvas rotation evaluation uses `rigTranslationById` before rest fallback.
- `use-rotation-deformer-interaction.ts` resolves translation edit mode to `restTranslation` when no translation keyform set exists.
- Parameter Bar generic `Ends + Center` acts on the selected first binding, which is `angleDegrees` for Rotation Deformer.

## 5. Review Policy

The implementation domain requires three review lanes:

1. `Spec Compliance Review`
   - Checks this plan and primary basis docs.
   - Each in-scope requirement must be classified as `implemented` / `explicit non-goal` / `deferred by plan` / `unclear` / `not relevant`.
   - `unclear` is not pass.
2. `Design / Development Compliance Review`
   - Checks module boundaries, UI responsibility, operation boundary, deterministic behavior, source organization, dependency policy, and forbidden scope.
3. `Test Adequacy Review`
   - Checks browser/user-flow proof, unit/component coverage, and negative coverage for removed UI.

Each Gnome report must include:

- Basis Coverage Self-Report
- User-Facing UX Trace
- Keyform Authoring Contract Trace
- UI Removal / Density Cleanup Trace
- Must-not Compliance Evidence
- Residual Risk Classification

## 6. Wave Strategy

Wave75 uses one implementation domain plus one final integration domain.

```text
Batch 1:
  Domain A: Rotation/Warp Deformer Keyform Authoring and Inspector Density Cleanup

Batch 2:
  Domain B: Final Integration / Clean Review / Map Closeout
```

Rationale:

- The behavior fix and UI cleanup touch overlapping Editor files such as Canvas interaction hooks, Parameter Binding UI, Parameter Bar, Rig Inspector, and e2e tests.
- Splitting into parallel domains would create avoidable write collisions.
- This is a cohesive UX correction: keyform authoring should move to Canvas/Parameter Bar, while per-binding card buttons and duplicate Inspector controls are removed.

## 7. Acceptance Criteria

### 7.1 Rotation Translation Keyform Authoring From User Operation

Required:

- The exact user workflow must work:
  1. import PSD;
  2. generate mesh for target part;
  3. create Rotation Deformer from `Create Rotation Deformer`;
  4. set active parameter to `Face Angle Z`;
  5. press `Ends + Center`;
  6. move parameter to max `30`;
  7. drag Rotation angle handle;
  8. drag Rotation translation handle;
  9. move parameter slider and observe both angle and translation interpolate.
- After `Ends + Center` creates angle keyforms, a translation handle drag at an exact active key position must update/create a Rotation `translation` keyform for that parameter value.
- If no Rotation `translation` keyform set exists, the implementation must materialize one deterministically from the same active parameter and existing key positions for the same rigControl where practical.
- Materialized non-current translation keys must use the current setup/evaluated/rest translation so only the dragged key gains the new translated value.
- Existing Rotation `angleDegrees` keyform editing must continue to work.
- Existing lower-level Vec2 interpolation behavior from Wave74 must remain intact.
- Slider midpoint after the drag must show interpolated `translation.x/y` in Canvas overlay data and visible artwork movement.

Must not:

- Convert the user action into only `restTranslation` when there is an active exact keyform context.
- Require the user to manually add a separate Translation keyform card entry before dragging the translation handle in the described workflow.
- Rework runtime interpolation primitives unless a direct bug is proven.

### 7.2 Rotation Parameter Binding Cleanup

Required:

- Remove per-card Add/Update/Delete action buttons from Rotation Parameter Binding cards:
  - `Rotation angle`;
  - `Translation`;
  - `Opacity multiplier`.
- Cards may remain as value displays/controls where useful, but they must not present duplicate keyform commit buttons.
- The intended keyform authoring routes must be Canvas handles and Parameter Bar.
- UI should not imply that Translation card buttons are necessary for the main workflow.

Must not:

- Remove the ability to inspect current/interpolated values entirely.
- Leave hidden test-only affordances as the only way to author keyforms.

### 7.3 Rotation Inspector Density Cleanup

Required:

- Rotation Deformer basic card keeps operation-worthy fields:
  - `Name`;
  - `Parent deformer`.
- Remove non-essential/non-editable summary rows from the basic Rotation Deformer card:
  - `Bound children`;
  - `Angle keyforms`.
- Combine `Pivot X`, `Pivot Y`, `Rest translation X`, `Rest translation Y`, and `Rest angle` into a compact single-row or otherwise height-efficient layout.
- Use short labels that still distinguish setup/rest fields from parameter-driven keyform values.
- Remove or compress explanatory copy that consumes vertical space without enabling action.
- Remove standalone Rotation `Opacity multiplier` Inspector section; keep the Parameter Binding slider/value path instead.

Must not:

- Remove setup editing for pivot/rest translation/rest angle.
- Confuse setup/rest values with keyform/interpolated values.
- Create UI cards inside cards or introduce a larger visual footprint than the existing layout.

### 7.4 Warp Inspector and Parameter Binding Cleanup

Required:

- Remove Warp Deformer basic-card `Opacity multiplier` field because Parameter Binding already exposes the slider/value control below.
- Remove per-card `+` Add buttons from Warp Parameter Binding cards:
  - `Warp lattice offsets`;
  - `Opacity multiplier`.
- If Update/Delete buttons exist in the same per-card action region, remove the duplicate per-card action region consistently unless a documented existing workflow requires otherwise.
- Preserve Warp lattice offset value controls and the displayed point count.
- Preserve Warp/Opacity value display and slider behavior where already present.

Must not:

- Remove Warp lattice offset authoring through the accepted Canvas/Parameter Bar path.
- Change Warp Deformer deformation or mesh behavior.

### 7.5 Tests and UX Proof

Required:

- Add or update focused Playwright coverage for the user workflow in 7.1.
- The test must assert at least:
  - `Face Angle Z` max key after angle drag changes evaluated angle;
  - translation handle drag at max key creates/updates a `translation` keyform;
  - moving slider to midpoint changes `data-deformer-overlay-translation-x/y` to midpoint values;
  - artwork/evaluated mesh movement reflects the translation where stable.
- Add after-save/load assertion if stable within existing portable save/load fixture path, or record why it is covered by Wave74 package/save-load evidence and the new browser workflow is enough.
- Add focused component/model tests for materializing missing Rotation translation keyforms from existing active key positions.
- Add focused UI tests or snapshots/assertions proving removed buttons/fields are gone and remaining controls are still reachable.
- Existing Wave74 validation paths must remain green.

## 8. Domain Design

| Batch | Domain | Dependency | Purpose |
|---|---|---|---|
| 1 | A. Rotation/Warp Deformer Keyform Authoring and Inspector Density Cleanup | Wave74 pass baseline | Fix the actual Rotation translation authoring flow and remove duplicate Deformer UI controls |
| 2 | B. Final Integration / Clean Review / Map Closeout | Domain A pass or explicit escalation | Combined validation, independent clean review, reports/maps |

## 9. Domain A: `wave75-deformer-keyform-authoring-inspector-density-cleanup`

Purpose:

- Make the user-described Rotation translation workflow produce keyframed, interpolated translation.
- Tighten Rotation/Warp Deformer UI so keyform authoring routes are not split across duplicate per-card buttons.

Expected implementation areas:

- `apps/editor/src/workspace/canvas/use-rotation-deformer-interaction.ts`
- `apps/editor/src/workspace/canvas/rotation-deformer-gesture.ts`
- `apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts`
- `apps/editor/src/features/editor-session/model/parameter-keyform-state.ts`
- `apps/editor/src/features/editor-session/model/parameter-keyform-state.test.ts`
- `apps/editor/src/workspace/panels/parameter-binding-section.tsx`
- `apps/editor/src/workspace/panels/parameter-binding-section.test.tsx` or existing `.test.ts`
- `apps/editor/src/workspace/panels/rig-tool-inspector.tsx`
- `apps/editor/src/workspace/panels/parameter-bar.tsx` only if needed to preserve intended authoring route
- `apps/editor/e2e/portable-project-save-load.e2e.spec.ts` or a new focused e2e if local registry patterns allow
- `packages/operation-core/**` only if existing edit-keyform operation cannot support the required materialization payload
- `packages/authoring-core/**` only if operation-level mutation support is missing

Allowed write scope:

- `apps/editor/**`
- `packages/operation-core/**` for narrow keyform operation support only
- `packages/authoring-core/**` for narrow keyform mutation support only
- `discussion/implementation/waves/wave75/**`
- `discussion/implementation/reviews/wave75/**`

Forbidden write scope:

- Mesh generation algorithms.
- Runtime interpolation rewrites unless a direct bug is proven.
- Renderer architecture.
- Package format changes.
- Viewer / Runtime View.
- Texture Atlas / Variant / Dynamics expansion.
- Slider performance optimization.
- Browser-local save / archive / filesystem / File System Access API.
- Cubism SDK / `.moc3` / `.model3.json` compatibility.
- External transport or LLM/provider integration.
- New dependencies unless dependency policy is followed and escalated.

Required tests / evidence:

- Browser reproduction of the user workflow.
- Unit/model test for missing translation keyform materialization from existing Rotation key positions.
- Unit/model test that one exact key drag updates that key without clobbering the other materialized keys.
- Regression test that dragging translation with no active keyform context still behaves as setup/rest editing if that remains the intended fallback.
- UI assertions that Rotation Parameter Binding action buttons are removed.
- UI assertions that Warp Parameter Binding Add buttons are removed.
- UI assertions that Rotation/Warp Inspector duplicate opacity fields are removed.
- UI assertions that Rotation setup fields remain editable and compact.

Early escape triggers:

- Existing operation schema cannot express materializing a translation keyform set and updating the current key without broader operation changes.
- Parameter Bar ownership of generic keyform controls conflicts with removing per-card action buttons for opacityMultiplier authoring.
- Browser reproduction cannot target the translation handle deterministically without adding an explicit test-facing hook.
- The expected behavior conflicts with existing documented Rig Tool design.

## 10. Domain B: `wave75-final-integration-clean-review-map-closeout`

Purpose:

- Validate the combined UX correction, obtain independent clean review, and update persistent maps/reports.

Expected implementation areas:

- `discussion/implementation/waves/wave75/**`
- `discussion/implementation/reviews/wave75/**`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`
- Relevant design maps only if status links need alignment

Acceptance:

- Domain A report exists and records `pass` or explicit escalation.
- Domain A Spec / Design-Development / Test Adequacy reviews exist and pass, or explicit escalation is recorded.
- Final clean integration review exists and passes before the wave is marked complete.
- Final report records:
  - user workflow reproduction;
  - Rotation translation keyform materialization behavior;
  - slider midpoint interpolation proof;
  - Rotation UI cleanup;
  - Warp UI cleanup;
  - deliberately removed controls;
  - validation results;
  - residual risks.
- Maps mark Wave75 status correctly.

Forbidden:

- Production source implementation except narrow documentation/map fixes.
- Closing the wave without independent final clean review.
- Treating missing child-agent responses as pass.

Required checks:

- `pnpm typecheck`
- Focused editor model/component tests
- Focused canvas/rotation interaction tests
- Focused Playwright user workflow path
- Existing portable save/load keyform path if touched
- `node scripts/check-source-organization.mjs`
- `node scripts/check-dependencies.mjs`
- `git diff --check`

## 11. Verification Matrix

| Requirement | Minimum evidence |
|---|---|
| User workflow creates Rotation translation keyform | Playwright plus model/canvas tests |
| Slider midpoint interpolates translation | Playwright overlay assertion and canvas/model test |
| Angle keyform editing still works | Existing/focused regression |
| Translation drag without key context remains sane | Focused regression or explicit documented behavior |
| Rotation per-card keyform buttons removed | Component/e2e/UI assertion |
| Warp per-card `+` buttons removed | Component/e2e/UI assertion |
| Rotation basic Inspector only shows operation-worthy fields | Component/e2e/UI assertion |
| Rotation setup fields remain editable in compact layout | Component/e2e/UI assertion |
| Warp basic Inspector opacity field removed | Component/e2e/UI assertion |
| No mesh/runtime/package-format expansion | Diff/review check |

## 12. Expected Persistent Artifacts

Reports:

- `discussion/implementation/waves/wave75/wave75-domain-a-deformer-keyform-authoring-inspector-density-cleanup-report.md`
- `discussion/implementation/waves/wave75/wave75-final-integration-report.md`
- `discussion/implementation/waves/wave75/_map.md`

Reviews:

- `discussion/implementation/reviews/wave75/wave75-domain-a-spec-compliance-review.md`
- `discussion/implementation/reviews/wave75/wave75-domain-a-design-development-review.md`
- `discussion/implementation/reviews/wave75/wave75-domain-a-test-adequacy-review.md`
- `discussion/implementation/reviews/wave75/wave75-final-clean-integration-review.md`
- `discussion/implementation/reviews/wave75/_map.md`

## 13. Subagent Contract

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
- Preserve Wave74 lower-level interpolation and save/load behavior.
- Keep the UI cleanup scoped to the controls named in this plan.

Review-Sylph instructions must include:

- Review from source, tests, plan, and reports, not only from Gnome summary.
- Report `pass`, `needs_changes`, or `escalate`.
- Do not ask the user directly.
- Do not edit files unless explicitly delegated a narrow fix after review.

## 14. Orchestration Policy

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
- May modify `packages/**` only when the assigned domain explicitly allows it and accepted UX/architecture requires it.
- May add dependencies only through dependency policy compliance and escalation.
- Must include Basis Coverage Self-Report and Deferred Basis Items.
- Must not implement mesh generation, slider performance, Viewer, browser-local save slot, archive/filesystem, new package format, or editor-local pose persistence outside this plan.

Review-Sylph:

- Reviews from artifacts and source, not only from Gnome summary.
- Must produce assigned lane report.
- Spec Compliance Review must not silently treat basis omissions as future scope.
- Must check user workflow proof, translation keyform authoring, UI removal scope, forbidden scope, and test adequacy.

Waiting rule:

- `wait_agent` timeout is polling timeout, not failure.
- No parent agent may terminate a child agent's work merely because it has not responded yet.
- If interruption is unavoidable, record incomplete / blocked / escalated. Do not pass the wave gate.

## 15. Out of Scope

- Slider performance optimization.
- New parameter system design.
- Full timeline/keyframe editor.
- Persisting selection, active tool, canvas view, current parameter values, undo history, drafts, selected control point, in-progress gestures, or manual collapsed tree state.
- Browser-local save slot / IndexedDB UI.
- Cloud persistence.
- ZIP/archive/native filesystem/File System Access API/directory picker/drag-drop import/export.
- New package format.
- Mesh generation algorithm changes.
- Manual mesh topology expansion.
- Runtime interpolation rewrite unless direct bug is proven.
- Viewer / Runtime View.
- Texture Atlas Task.
- Variant / Expression Manager.
- Dynamics expansion.
- Renderer/WebGL architecture expansion.
- Pixel oracle / Photoshop compositing parity.
- Auto-rigging.
- Semantic recognition from part name, drawable name, or image content.
- Cubism SDK / `.moc3` / `.model3.json` compatibility.
- External HTTP / WebSocket / MCP transport.
- LLM provider integration.
- Repo-side semantic proposal generation / auto-fix.
