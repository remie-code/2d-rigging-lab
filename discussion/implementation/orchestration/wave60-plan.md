# Wave 60 Plan: Parts Tree / Inspector Editing + DnD Boundary Probe v0

> Parts Tree / Part Container Inspector / Drawable Inspector を、Mesh前の編集基盤として成立させる計画。DnD はリスクを承知で実装対象に含め、GPT-5.5 / Gnome の実装量境界を測るための boundary probe として扱う。

## 1. 状態

- Status: Planned
- Target wave: Wave60
- Wave name: `parts-tree-inspector-editing-dnd-boundary-probe-v0`
- Primary objective: PSD import後、Canvasに表示されたdrawable / part containerを、Parts TreeとInspectorから人間が自然に整理・編集できる状態にする。具体的には、選択同期を維持しつつ、名前変更、visibility、opacity、clipping、part container editor-only visibility gate、Parts Tree collapse、そしてDnDによるreorder / reparentを扱う。

## 2. Planning Gate Result

Planning Gate result before this plan: `Inventory first` -> `Discuss first` -> `Plan directly`.

Inventory basis:

- Sylph inventory verdict: `done`。
- 重要事実:
  - Parts Tree / Inspector / Canvas は `EditorSessionProvider` の `selection` を共有するv0で、選択同期とCanvas hit selectは実装済み。
  - Parts Treeは `apps/editor/src/workspace/panels/structure-tree-panel.tsx` で表示・選択のみ。visibility toggle、collapse、DnD、inline editは未実装。
  - Inspectorは `apps/editor/src/workspace/panels/inspector-panel.tsx` でsummary表示のみ。編集UIは未実装。
  - Canvas projection / renderer は `runtimeVisibility`, `defaultOpacity`, `drawOrder.stableOrder`, `masks` を読むが、part visibility gate / `editorHiddenIds` は読んでいない。
  - `ModelPartSchema` はpart自体のvisibilityを持たない。
  - `EditorStateFileSchema.editorHiddenIds` は存在するが、現行Editor session / Canvas投影には未接続。
  - 既存operationとして `setRuntimeVisibility`, `setDrawOrder`, `setDrawablePart`, `setMaskRelation`, `updatePart` がある。
  - Drawable rename、static opacity edit、editor visibility操作は既存operationが見当たらない。
  - DnD基盤依存は現状見当たらず、Tree側にもdrag/drop handlerはない。

Accepted user decisions:

- Part Container visibilityは当面 `editor-only visibility gate` として扱う。
- Part Container visibilityはruntime / export初期状態に影響させない。
- runtimeに出る表示切替は、Variant / Expression、parameter-driven opacityなどの各機能で扱う。
- 子Drawable個別visibilityは、親Part Container visibility gateで破壊しない。
- DnDは重い可能性があるが、実装できそうかを実際に試す。できなければ、それ自体を知見として記録する。
- DnDを含める理由の一つは、GPT-5.5 / Gnome の実装量境界を測ることである。

Primary basis:

- [Parts Tree Component](../../design/screen-design/components/parts-tree.md)
- [Part Container Inspector Component](../../design/screen-design/components/part-container-inspector.md)
- [Drawable Inspector Component](../../design/screen-design/components/drawable-inspector.md)
- [Canvas / Preview Component](../../design/screen-design/components/canvas-preview.md)
- [Authoring Workspace Screen](../../design/screen-design/screens/authoring-workspace.md)
- [Playwright E2E Oracle](../../design/screen-design/e2e-oracle.md)
- [React Editor Foundation Oracle](../../design/screen-design/react-editor-foundation-oracle.md)
- [UX-Backed Package Logic Authority](../../development_convention/ux-backed-package-logic-authority.md)
- [Source File Organization Policy](../../development_convention/source-file-organization-policy.md)
- [Dependency Policy](../../development_convention/dependency-policy.md)
- [Operation Policy](../../development_convention/operation-policy.md)
- [Schema and ID Conventions](../../development_convention/schema-and-id-conventions.md)
- `.github/skills/implementation-orchestration/SKILL.md`

## 3. UX Acceptance Criteria

Wave60 must satisfy this user-visible path:

```text
Authoring Workspace
  -> Import PSD
  -> Parts Tree shows imported part containers and drawables
  -> user selects part container or drawable
  -> Inspector shows context-specific editable controls
  -> user changes visibility / name / opacity / clipping where supported
  -> Canvas and Parts Tree reflect the change
  -> user can collapse / expand part containers
  -> user can attempt drag-and-drop reorder / reparent in Parts Tree
```

Core UX must provide:

- Parts Tree row selection for part containers and drawables.
- Tree selection and Canvas selection synchronization.
- Part Container collapse / expand.
- Part Container editor-only visibility gate.
- Drawable visibility toggle.
- Part Container Inspector:
  - name edit
  - editor-only visibility gate
  - no child-count / status-summary clutter
  - no subtree bulk show/hide
  - no container opacity
- Drawable Inspector:
  - name edit
  - visibility edit
  - opacity edit
  - clipping target selection / clear
  - minimal source summary only
- Canvas effective visibility:
  - drawable hidden -> not rendered / not hit-tested
  - parent part container editor-hidden -> descendants not rendered / not hit-tested
  - parent re-shown -> child drawable visibility settings are preserved

DnD UX target:

- Drag a drawable row upward / downward to change draw order.
- Drag a drawable row into another part container to change membership.
- Drag a part container into another part container to change parent, if feasible.
- Drop result should preserve selection and update Canvas / Inspector coherently.

DnD boundary rule:

- DnD is in scope as an explicit attempt, not a silent stretch.
- If DnD cannot be completed safely, Domain A must record a concrete boundary finding:
  - what was attempted,
  - where the blocker is,
  - whether it is UI library / model operation / package invariant / test oracle / source organization,
  - what smaller next wave would unlock it.
- A half-working DnD UI must not remain exposed if it corrupts model state or misleads the user.

## 4. Semantics Boundaries

Part Container visibility:

- Editor-only.
- Affects Canvas / Preview and Editor hit testing.
- Affects Parts Tree row hidden/effective-hidden state.
- Does not mutate child Drawable runtime visibility.
- Does not affect runtime/export initial visibility.
- Does not replace Variant / Expression or parameter-driven opacity.

Drawable visibility:

- Uses existing drawable runtime visibility if that remains the least surprising available semantic.
- If a separate editor visibility is introduced, it must be clearly editor-only and must not silently replace runtime visibility.
- If using `editorHiddenIds`, the implementation must keep naming and UI copy clear enough to avoid presenting it as export/runtime behavior.

Draw Order:

- UX target remains Tree上で上にあるdrawableほど前面。
- Canvas drawing must remain deterministic.
- If Tree row order and `graph.drawOrder.stableOrder` disagree, implementation must reconcile them or explicitly keep one as authoritative and document the boundary.

Opacity:

- Static drawable opacity belongs to Drawable Inspector.
- Parameter-driven opacity keyform is not in Wave60.
- Deformer / part subtree fade is not in Wave60.

Clipping:

- Existing model mask relation support may be edited if operation support is sufficient.
- PSD clipping extraction remains outside Wave60 unless already available through current model data.
- Do not claim Photoshop compositing parity.

## 5. E2E Oracle Boundary

Wave60 may add focused Playwright E2E, but only under [Playwright E2E Oracle](../../design/screen-design/e2e-oracle.md).

E2E should verify:

- Import PSD path still works.
- Clicking a drawable row updates Inspector and Canvas selection state.
- Clicking a part row updates Inspector and Canvas subtree selection state.
- Toggling drawable visibility changes Parts Tree state and Canvas renderable count/state.
- Toggling part container editor visibility changes descendant effective Canvas state without changing child drawable visibility setting.
- Opacity edit changes model/session state and Canvas projection state.
- Clipping selector can set / clear a mask relation if implemented.
- DnD, if implemented, changes order or parent membership in structured state.

E2E must not verify:

- pixel-perfect Canvas output.
- screenshot or visual regression.
- exact row spacing, colors, typography, or animation.
- exact DnD pointer choreography beyond a stable user path.
- Photoshop compositing parity.
- internal implementation details that are not part of a user-observable state transition.

Human/user visual check remains the oracle for density, readability, hover affordance, row compactness, and whether DnD feels natural.

## 6. Domain Design

Wave60 intentionally uses one large implementation domain plus one closeout domain.

| Batch | Domain | Parallelism | Dependency | Purpose |
|---|---|---|---|---|
| 1 | A. Parts Tree / Inspector Editing + DnD Boundary Probe v0 implementation | One large implementation domain | Wave59 Canvas renderer baseline + Wave60 UX basis | Implement the full Parts Tree / Inspector vertical slice and attempt DnD |
| 2 | B. Final integration / clean review / map closeout | After A | A pass or explicit boundary result | Verify integration, update maps, record concise closeout |

Do not split Domain A into separate UI / package / test domains merely because it touches several files. This wave depends on session state, operation calls, Parts Tree projection, Inspector editing, Canvas effective visibility, and E2E staying aligned.

Domain A may split support work only if the Orch-Sylph records a concrete reason and keeps a single Gnome accountable for the vertical slice. Any split must use non-overlapping write scopes.

## 7. Domain A: `wave60-parts-tree-inspector-editing-dnd-boundary-probe-v0`

Purpose:

- Make Parts Tree and Inspector usable as the primary structure-editing surface before Mesh UX begins.
- Attempt DnD reorder / reparent within the same vertical slice.

Required implementation areas:

1. Editing command/session bridge
   - Add or expose an Editor-side path to apply supported model edits from Inspector / Parts Tree.
   - Prefer existing operation APIs where practical.
   - If accepted UX requires missing operations, add focused package/operation support under [UX-Backed Package Logic Authority](../../development_convention/ux-backed-package-logic-authority.md).
   - Avoid GUI-only state that contradicts package/model truth, except for clearly editor-only UI state such as collapse or editor-only hidden gates.

2. Parts Tree projection and row UI
   - Keep rows compact.
   - Add part container collapse / expand.
   - Add visibility icons for part containers and drawables.
   - Show effective-hidden state without verbose labels.
   - Keep normal UI free of raw evidence/debug refs.
   - Maintain selected row styling and Canvas selection synchronization.

3. Part Container editor-only visibility gate
   - Implement editor-only hidden state for part containers.
   - Apply ancestor hidden gates when projecting drawable effective visibility.
   - Canvas render and hit testing must respect effective visibility.
   - Re-showing parent must restore child drawable visibility choices.
   - Do not write runtime/export part visibility semantics.

4. Part Container Inspector
   - Add name edit using existing `updatePart` or focused equivalent.
   - Add editor-only visibility gate control.
   - Keep it sparse: no child count summary, no child status summary, no subtree bulk operations, no opacity.

5. Drawable Inspector
   - Add name edit. If missing operation support blocks this, add focused support rather than leaving GUI-only renaming.
   - Add visibility edit.
   - Add opacity edit. If missing operation support blocks this, add focused support.
   - Add clipping target selection / clear using existing `setMaskRelation` if feasible.
   - Keep source summary compact and non-dominant.

6. Draw order and reorder foundation
   - Preserve the UX rule: Tree上で上にあるdrawableほど前面。
   - Use `setDrawOrder` or focused operation support to make reorder durable in session/model state.
   - Ensure Canvas draw order follows the same authority as the Parts Tree after reorder.

7. DnD boundary probe
   - Implement drag-and-drop reorder of drawable rows if feasible.
   - Implement drag-and-drop drawable reparent to part container if feasible.
   - Attempt part container reparent if feasible after drawable DnD is stable.
   - Use a dependency only if justified by concrete ergonomics/robustness need and compliant with [Dependency Policy](../../development_convention/dependency-policy.md).
   - If DnD cannot be completed safely, remove/disable misleading partial UI and record the blocker.

8. Canvas integration
   - Canvas render projection must use effective visibility.
   - Canvas hit test must ignore effective-hidden drawables.
   - Canvas selection must remain stable after Inspector edits and DnD.
   - Isolate Selected must not mutate model visibility.

9. Tests
   - Add focused unit tests for projection/effective visibility/order logic where practical.
   - Add focused E2E for only the user state transitions listed in section 5.
   - Avoid pixel/screenshot/visual assertions.

Allowed write scope:

- `apps/editor/**`
- focused `packages/**` files needed for name/opacity/editor-hidden/order/reparent/mask operation consistency
- focused tests / fixtures needed for Wave60
- `package.json`, `pnpm-lock.yaml`, workspace config only if a justified dependency is needed
- `scripts/**` only for focused guard/test updates directly tied to this wave
- `discussion/implementation/waves/wave60/**`
- `discussion/implementation/reviews/wave60/**`

Forbidden write scope:

- Broad GUI rewrite outside Parts Tree / Inspector / required Canvas/session support.
- Restoring old legacy GUI panels or old debug/evidence-heavy normal UI.
- Runtime/export part visibility semantics.
- Variant / Expression Manager implementation.
- Parameter-driven opacity/keyform implementation.
- Mesh generation or mesh editing.
- Rig / Dynamics / Texture Atlas implementation.
- Project Save / Load.
- Photoshop pixel parity implementation.
- Pixel/screenshot E2E oracle.
- Cubism / Live2D SDK or file compatibility.
- External HTTP/WebSocket/MCP transport or LLM/provider work.

Dependency policy:

- Native React/DOM DnD or pointer handlers are acceptable if they are maintainable.
- A focused DnD helper dependency is allowed only if the Gnome records why native handling would be more brittle or costly.
- Do not add a broad UI framework solely for DnD.
- Do not add dependencies that force a major visual redesign.

Required verification:

- `pnpm --dir apps/editor typecheck`
- `pnpm --dir apps/editor build`
- root `pnpm run typecheck`
- root `pnpm run test:unit`
- root `pnpm run check`
- Focused unit tests for session projection / effective visibility / order mutation if added
- Focused Playwright E2E for import -> select -> Inspector edit -> Canvas/Tree state reflection
- DnD E2E if DnD is implemented; if DnD is not implemented, boundary report must explain why no DnD E2E exists
- `git diff --check -- apps packages scripts package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json discussion`

If Vite / Vitest / Playwright require dev server startup, the implementation domain must avoid leaving long-running processes alive. If a dev server is needed for verification, it must be started in a controlled process and stopped.

Domain A review gates:

- Review-Sylph 1: UX / screen-design / source-structure review.
  - Confirm Parts Tree / Part Container Inspector / Drawable Inspector follow the accepted screen-design docs.
  - Confirm DnD, if present, matches user expectations and does not expose misleading partial behavior.
  - Confirm normal UI is not polluted with diagnostics/evidence/debug/test text.
  - Confirm source organization follows [Source File Organization Policy](../../development_convention/source-file-organization-policy.md).
- Review-Sylph 2: package / operation / data contract review.
  - Confirm package/operation changes are justified by accepted UX and do not invent product semantics.
  - Confirm editor-only part visibility does not leak into runtime/export semantics.
  - Confirm drawable rename/opacity/visibility/mask/order/reparent behavior is durable and coherent where implemented.
  - Confirm draw order authority is not split between Parts Tree and Canvas.
- Review-Sylph 3: test adequacy / E2E oracle review.
  - Confirm tests cover the user path without visual/pixel assertions.
  - Confirm DnD testing is either present for implemented DnD or explicitly absent with a reviewed boundary finding.
  - Confirm no test-only UI text or debug surfaces are added for convenience.
  - Confirm no long-running dev server process remains.

## 8. Domain B: `wave60-final-integration-clean-review-map-closeout`

Purpose:

- Integrate Domain A report and reviews.
- Update implementation maps.
- Record concise closeout and clean integration review.
- Preserve DnD boundary finding if DnD is partial or deferred.

Allowed write scope:

- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`
- `discussion/implementation/waves/wave60/**`
- `discussion/implementation/reviews/wave60/**`
- small screen-design map/status corrections only if Domain A changed documented status

Forbidden:

- Source implementation.
- Retrying Domain A implementation directly.
- Rewriting screen design beyond status/link corrections.
- Creating a large narrative final report unless there is a real blocker or major scope deviation.

Required verification:

- Confirm Domain A completion report exists.
- Confirm all three Domain A review lanes exist and have pass / needs_changes / escalate verdicts.
- Confirm required validation results are recorded.
- Confirm DnD outcome is explicit: implemented, partially implemented but disabled, or deferred with concrete blocker.
- Confirm maps cite Wave60 status accurately.

## 9. Subagent / Orch-Sylph Execution Policy

Wave60 follows the implementation orchestration skill.

1. Undine launches Orch-Sylph per domain.
2. Orch-Sylph must not implement source itself.
3. Source implementation must be delegated to Gnome.
4. Review must be delegated to independent Review-Sylph.
5. Orch-Sylph must wait for delegated agents to reach final state.
6. Do not stop, cancel, close, or mark child agents failed merely because they are waiting or a wait call times out.
7. A wait timeout is polling timeout, not failure.
8. Subagents must not ask the user directly.
9. Undine must not inspect broad source/diff/test details directly.
10. Domain A should remain a single large implementation domain unless a concrete, recorded reason justifies a split.

Each assignment must include:

```text
Orch-Sylph自身は実装担当ではない。source implementation は必ず別コンテキストの Gnome に委譲し、レビューは必ず別コンテキストの Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。
```

Domain A Gnome must also receive:

```text
合意済みUX / AC / screen design を実現するために必要な場合、packages/** のロジック、schema、validator、command、fixture、testを修正してよい。GUIだけのworkaroundでpackage挙動を間違ったままにしないこと。ただし、新しい製品意味や不明な永続化・互換・権利境界は勝手に決めず、Orch-Sylph / Undineへescalateすること。
```

Domain A Gnome must also receive the DnD boundary instruction:

```text
DnDはWave60の明示対象である。実装できそうかを実際に試すこと。ただし、状態破壊や誤誘導を起こす半端なDnD UIを残してはならない。実装不能または危険と判断した場合は、何がどこで詰まったか、次に何を分離すべきかを具体的に記録し、UI上は無効化または非表示にすること。
```

## 10. Pass Criteria

Wave60 core passes when:

- Import PSD後、Parts Treeからpart container / drawableを選択できる。
- Inspectorが選択対象に応じてPart Container Inspector / Drawable Inspectorとして切り替わる。
- Part Containerのcollapse / expandが機能する。
- Part Containerのeditor-only visibility gateが機能する。
- Part Containerをhiddenにすると配下drawableがCanvasで非表示・hit-test対象外になる。
- Part Containerをvisibleへ戻すと、子Drawable個別visibilityが保持された状態で復元される。
- Part Container name editがsession/model stateへ反映される。
- Drawable name editがsession/model stateへ反映される。
- Drawable visibility editがCanvas / Parts Treeへ反映される。
- Drawable opacity editがCanvas projection / rendererへ反映される。
- Drawable clipping target set / clearが、実装された範囲でmodel/session stateへ反映される。
- Tree順 / draw orderの authority が明確で、Canvas描画順と矛盾しない。
- Minimal Playwright E2E validates main path without visual/pixel assertions.
- Required validation commands pass or concrete blocker is escalated.
- Domain A report、3 review lanes、Domain B closeout / clean reviewが記録されている。

Wave60 DnD probe passes when one of these is true:

- DnD reorder / reparent is implemented, reviewed, and covered by focused E2E or equivalent structured verification; or
- DnD is not completed, but the wave records a reviewed boundary finding with concrete blockers and leaves no misleading partial DnD UI exposed.

Wave60 must not pass if:

- Inspector remains summary-only.
- Part Container visibility mutates child Drawable runtime visibility instead of acting as editor-only gate.
- Runtime/export part visibility semantics are added silently.
- Canvas renders or hit-tests effective-hidden descendants.
- GUI-only edits contradict package/model state without a clear editor-only boundary.
- DnD corrupts tree order, parent membership, selection, or Canvas projection.
- DnD is omitted silently after being assigned.
- E2E becomes a visual/pixel oracle.
