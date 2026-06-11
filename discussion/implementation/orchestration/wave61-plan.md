# Wave 61 Plan: Mixed Ordered Structure Foundation + Import Preview + Mesh Generation v0

> Parts Treeを「描画順つきの階層スタック」として正しく成立させ、その上にPSD Import preview / hidden group semantics と Mesh Tool initial generationを載せる実装計画。3並列へ固執せず、Domain Aを土台として先行し、Domain B/CをA完了後に並列実行する。

## 1. 状態

- Status: Planned
- Target wave: Wave61
- Wave name: `mixed-ordered-structure-import-preview-mesh-generation-v0`
- Primary objective: 既存コードや既存schemaの保全よりも、合意済みUXを真として、Authoring Workspaceの次段階に必要な3つのUXを成立させる。
  - Parts Treeを、Part ContainerとDrawableが同じ親配下で混在ordered childrenとして並ぶ「描画順つき階層スタック」にする。
  - PSD Import ReviewにPSD単体previewを表示し、hidden groupをPart Containerのeditor-only hidden gateへ正しく引き継ぐ。
  - 選択Drawableに対してpreset-based initial mesh generationを行い、preview -> Apply / Regenerate / selected mesh overlayを成立させる。

## 2. Planning Gate Result

Planning Gate result before this plan: `Inventory first` -> `Discuss first` -> `Plan directly`.

Inventory basis:

- Domain A inventory: Mesh Tool / Initial Mesh Generation v0。
- Domain B inventory: PSD Import Preview + Hidden Group Import Semantics。
- Domain C inventory: Parts Tree Mixed Order / DnD Strengthening。

重要事実:

- Mesh:
  - 既存operationとして `generateMesh`, mesh vertex / triangle / UV operations はある。
  - 現行 `generateMesh` はalpha-awareではなく、`auto-grid-v1` はbounds均等gridである。
  - PSD importはempty mesh scaffoldを作る。
  - Drawable raw RGBA bytesはEditor session上の `binaryAssets.fileEntries` から利用でき、Canvas rendererも同じbytesを使っている。
  - Canvas mesh overlay、Mesh Tool UI、draft preview stateは未実装。
- PSD Import Preview / hidden group:
  - Import Review右側は現在placeholderである。
  - Import Review時点でadapter result / materialized layer bytesは存在する。
  - 現行 `visibleInSource` はlocal visibilityではなく、親group hiddenを畳み込んだeffective visibilityである。
  - その結果、現状のままではhidden group配下の子Drawable runtime visibilityまでhidden化され、合意済みUXに反する。
  - Wave60のPart Container hidden gateはeditor session UI stateであり、model part自体にはvisibilityがない。
- Parts Tree / mixed order:
  - 現行Tree projectionは `childPartIds` を先に再帰表示し、その後 `drawableIds` を表示している。
  - 現行package modelは `childPartIds` と `drawableIds` を別配列で持ち、親ごとの混在ordered children fieldを持たない。
  - `drawOrder` はDrawable専用である。
  - 現行DnDは一部reorder / reparentを扱うが、前 / 後 / 中 drop、Part ContainerとDrawableの相互before/after、Container block順序までは満たしていない。

Accepted user decisions:

- 既存コード保全よりも、あるべきUXを真にする。
- 必要に応じて `packages/**` のformat / schema / operation / validator / fixture / testを修正してよい。
- Parts Treeはファイルツリーではなく、描画順つき階層スタックである。
- 同じ親Container配下では、Part ContainerとDrawableを混在したordered children listとして表示する。
- Treeで上にあるものほど前面、下にあるものほど背面。
- Part ContainerはDrawableではないが、配下Drawable群を持つ描画順ブロックとして順序に参加する。
- DnDは所属Container変更だけでなく、前 / 後 / 中 dropによるreorder / reparentを扱う。
- PSD Import Previewではclipping再現を必須要件にしない。
- PSD hidden groupはPart Containerのeditor-only hidden gateへ写す。子Drawable runtime visibilityは親group hiddenだけでは変更しない。
- Mesh Tool v0は単一Drawable中心。batch generation、手動頂点編集、辺/頂点追加削除、詳細分割数UI、高度品質調整は当面扱わない。
- Meshはpreview -> Apply。Regenerateは既存meshをApply時に置換する。

Primary basis:

- [Parts Tree Component](../../design/screen-design/components/parts-tree.md)
- [Part Container Inspector Component](../../design/screen-design/components/part-container-inspector.md)
- [Drawable Inspector Component](../../design/screen-design/components/drawable-inspector.md)
- [Canvas / Preview Component](../../design/screen-design/components/canvas-preview.md)
- [Mesh Tool Component](../../design/screen-design/components/mesh-tool.md)
- [PSD Import Task Screen](../../design/screen-design/screens/psd-import-task.md)
- [Authoring Workspace Screen](../../design/screen-design/screens/authoring-workspace.md)
- [Playwright E2E Oracle](../../design/screen-design/e2e-oracle.md)
- [React Editor Foundation Oracle](../../design/screen-design/react-editor-foundation-oracle.md)
- [UX-Backed Package Logic Authority](../../development_convention/ux-backed-package-logic-authority.md)
- [Source File Organization Policy](../../development_convention/source-file-organization-policy.md)
- [Dependency Policy](../../development_convention/dependency-policy.md)
- [Operation Policy](../../development_convention/operation-policy.md)
- [Schema and ID Conventions](../../development_convention/schema-and-id-conventions.md)
- `.github/skills/implementation-orchestration/SKILL.md`

## 3. Wave Strategy

Wave61は完全3並列にしない。

理由:

- Domain Aのmixed ordered children / draw-order authorityは、BのPSD import初期構造とCのMesh target / Canvas overlayの土台である。
- Domain Aがpackage schemaやoperationを変える可能性があるため、B/CをA完了前に開始すると前提が壊れやすい。
- BとCはAのorder / visibility / Canvas projection contractが固まれば比較的独立する。

実行順:

```text
Batch 1:
  Domain A: Mixed Ordered Children / Structure Order Foundation

Batch 2:
  Domain B: PSD Import Preview + Hidden Group Semantics
  Domain C: Mesh Tool / Initial Mesh Generation v0

Batch 3:
  Domain D: Final Integration / Clean Review / Map Closeout
```

Domain Aは、Domain B/Cに渡す短い「order / visibility / projection contract note」をDomain A reportへ含めること。

## 4. UX Acceptance Criteria

Wave61 must satisfy these user-visible paths.

### 4.1 Parts Tree Mixed Ordered Structure

```text
Authoring Workspace
  -> Import PSD or use existing session
  -> Parts Tree shows part containers and drawables in one mixed order per parent
  -> Tree order matches draw order
  -> Drag row before / after / into target
  -> Tree, Canvas draw order, selection, Inspector remain coherent
```

Required:

- Same-parent Part Container / Drawable mixed row order.
- No forced "all containers first, then drawables" grouping.
- Tree上で上にあるものほど前面。
- Container is a draw-order block for its descendants.
- DnD supports:
  - before row
  - after row
  - inside Part Container
- Invalid drops are blocked:
  - cyclic container nesting
  - drawable into illegal root position
  - order state that cannot be represented safely
- Selection remains on moved item.
- Inspector reflects moved item parent / order.
- Canvas projection uses the same order authority as Parts Tree.

### 4.2 PSD Import Preview + Hidden Group Semantics

```text
Import PSD
  -> select PSD file
  -> Import Review appears
  -> right side shows selected PSD preview
  -> left side shows planned Parts structure
  -> hidden PSD group becomes editor-hidden Part Container after import
  -> child Drawable runtime visibility is preserved unless layer itself is hidden
```

Required:

- PSD Preview displays selected PSD only.
- Existing workspace model and destination composition are not shown in the preview.
- Preview displays effective visible layers/groups.
- Hidden layers and hidden group descendants are not shown in the Import Review preview.
- Layer opacity is reflected if practical.
- Clipping is not required for Import Review preview.
- Local visibility and effective visibility are separated enough to distinguish:
  - layer itself hidden
  - parent group hidden
- Hidden group maps to editor-only Part Container hidden gate.
- Hidden group does not mutate child Drawable runtime visibility by itself.
- Runtime / export part visibility semantics are not introduced.

### 4.3 Mesh Tool / Initial Mesh Generation v0

```text
Authoring Workspace
  -> select Drawable
  -> activate Mesh Tool
  -> choose preset
  -> preview mesh overlay appears
  -> Apply commits mesh
  -> Regenerate previews replacement and Apply replaces existing mesh
```

Required:

- Single Drawable target.
- Container selected -> Inspector shows Drawable picker within selected container.
- Project / none selected -> short empty state asking user to select Drawable.
- Presets:
  - Large Motion
  - Standard
  - Low Motion
- Initial algorithm: alpha-aware grid triangulation.
- Draft preview does not mutate project mesh.
- Apply commits generated mesh.
- Regenerate keeps existing mesh until Apply, then replaces it.
- Cancel discards draft.
- Mesh overlay shows selected Drawable mesh only.
- Overlay toggle changes display state only, not project state.
- Hidden Drawable can be selected and mesh-generated.
- Mesh Tool may temporarily preview hidden Drawable without changing model visibility.
- Clipping state does not alter mesh generation source; mesh is generated from Drawable's own texture / alpha bounds.

## 5. Domain Design

| Batch | Domain | Dependency | Purpose |
|---|---|---|---|
| 1 | A. Mixed Ordered Children / Structure Order Foundation | Wave60 final baseline | Make Parts Tree/order/DnD/model contract match accepted UX |
| 2 | B. PSD Import Preview + Hidden Group Semantics | Domain A pass / contract note | Improve Import Review preview and preserve hidden group semantics |
| 2 | C. Mesh Tool / Initial Mesh Generation v0 | Domain A pass / contract note | Add selected Drawable mesh generation, preview/apply/regenerate, overlay |
| 3 | D. Final Integration / Clean Review / Map Closeout | Domains A/B/C pass or explicit escalate | Verify wave integration, update maps, record closeout |

Domain B and Domain C may run in parallel only after Domain A has a pass or an explicit accepted boundary result. If Domain A changes package schema or core order authority, Domain B/C must use Domain A's report as basis.

## 6. Domain A: `wave61-mixed-ordered-children-structure-order-foundation`

Purpose:

- Make Parts Tree, model/order semantics, DnD, and Canvas projection reflect the accepted "hierarchical draw stack" UX.

Expected implementation areas:

1. Mixed ordered children authority
   - Introduce or derive a parent-local ordered children representation that can contain both Part Container and Drawable entries.
   - If package format/schema needs a durable field, add it with focused migration/validator/operation/test support.
   - Do not force the implementation into existing `childPartIds` then `drawableIds` display if that contradicts UX.

2. Package / operation consistency
   - Update package-format / authoring-core / operation-core as needed.
   - Existing code保全より、accepted UXを真にする。
   - If adding durable mixed children requires validator / fixture / AI-facing command updates, include focused changes rather than GUI-only workaround.

3. Parts Tree projection
   - Display mixed ordered children per parent.
   - Maintain collapse / visibility / selection behavior from Wave60.
   - Keep rows compact and avoid debug/evidence pollution.

4. DnD semantics
   - Implement before / after / inside drop intent.
   - Provide clear drop feedback.
   - Support:
     - Drawable before/after Drawable
     - Drawable before/after Part Container
     - Drawable inside Part Container
     - Part Container before/after Drawable
     - Part Container before/after Part Container
     - Part Container inside Part Container
   - Block cyclic nesting and illegal root/membership states.

5. Draw order / Canvas projection
   - Tree order and Canvas draw order must use the same authority.
   - Container block order must flatten descendants deterministically for Canvas rendering.
   - Hit testing and part subtree selection must not regress.

6. Downstream contract note
   - Domain A report must include:
     - order authority
     - how to insert PSD source-order entries
     - how Canvas flattening works
     - which APIs/commands Domain B/C should call
     - any remaining constraints

Allowed write scope:

- `apps/editor/**`
- `packages/package-format/**`
- `packages/authoring-core/**`
- `packages/operation-core/**`
- `packages/validator-core/**`
- `packages/ai-interface/**` only if command/schema/catalog consistency is directly affected by package operation changes
- focused tests / fixtures needed for order, DnD, migration, validator consistency
- `discussion/implementation/waves/wave61/**`
- `discussion/implementation/reviews/wave61/**`

Forbidden:

- Mesh generation implementation.
- PSD Import Preview implementation.
- Runtime/export part visibility semantics.
- Broad unrelated GUI redesign.
- Pixel/screenshot E2E oracle.

Required verification:

- `pnpm --dir apps/editor typecheck`
- `pnpm --dir apps/editor build`
- root `pnpm run typecheck`
- root `pnpm run test:unit`
- root `pnpm run check`
- focused unit tests for mixed order / flatten draw order / invalid drop prevention
- focused E2E for row order and DnD before/after/inside if practical
- `git diff --check -- apps packages scripts package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json discussion`

Domain A review gates:

- Review-Sylph 1: UX / screen-design / source-structure review.
- Review-Sylph 2: package / operation / data contract review.
- Review-Sylph 3: test adequacy / E2E oracle review.

## 7. Domain B: `wave61-psd-import-preview-hidden-group-semantics`

Purpose:

- Make PSD Import Review show the selected PSD preview and map hidden PSD groups to editor-only hidden Part Containers without corrupting child Drawable runtime visibility.

Dependency:

- Must start after Domain A pass / order contract note.
- Must use Domain A's insertion/order authority for planned structure and committed structure if relevant.

Expected implementation areas:

1. Import Review PSD Preview
   - Replace placeholder with selected PSD-only preview.
   - Use adapter result / materialized layer bytes available at Import Review time.
   - Fit preview to PSD canvas bounds.
   - Display effective visible layers/groups.
   - Reflect layer opacity where practical.
   - Do not implement clipping preview as a requirement.
   - Do not use screenshot/pixel oracle.

2. Local vs effective visibility
   - Preserve enough metadata to distinguish local layer hidden from parent group hidden.
   - Avoid treating parent-hidden as child Drawable runtime-hidden.
   - Keep compatibility with existing source profile/evidence where practical.

3. Hidden group import semantics
   - Hidden PSD group -> Part Container editor-only hidden gate.
   - Parent hidden gate hides descendants in Editor Canvas.
   - Child Drawable runtime visibility is preserved unless the leaf layer itself is hidden.
   - Runtime/export part visibility semantics are not introduced.

4. Commit / session bridge
   - Initialize editor hidden part ids or equivalent editor-only state from import result.
   - Maintain Parts Tree / Canvas / Inspector coherence after import.

5. Test-facing surface
   - Add structured state / stable hooks for preview ready and hidden group semantics if needed.
   - E2E should validate path/state, not pixels.

Allowed write scope:

- `apps/editor/src/features/psd-import/**`
- `apps/editor/src/editor-workflow/browser-psd-parser-adapter.ts`
- focused `apps/editor/src/features/editor-session/**` needed for hidden part initialization
- focused `packages/**` files needed for PSD source/profile/evidence visibility semantics
- focused tests / fixtures
- `discussion/implementation/waves/wave61/**`
- `discussion/implementation/reviews/wave61/**`

Forbidden:

- Mesh generation.
- Parts Tree mixed-order redesign beyond consuming Domain A contract.
- Runtime/export part visibility semantics.
- Clipping preview requirement.
- Source PSD raw bytes durable persistence changes unless explicitly escalated.
- Pixel/screenshot oracle.

Required verification:

- `pnpm --dir apps/editor typecheck`
- `pnpm --dir apps/editor build`
- root `pnpm run typecheck`
- root `pnpm run test:unit`
- root `pnpm run check`
- focused PSD import preview / hidden group tests
- focused Playwright E2E if fixture/state support exists
- `git diff --check -- apps packages scripts package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json discussion`

Domain B review gates:

- Review-Sylph 1: UX / PSD Import / source-structure review.
- Review-Sylph 2: package / visibility semantics / data contract review.
- Review-Sylph 3: test adequacy / E2E oracle review.

## 8. Domain C: `wave61-mesh-tool-initial-generation-v0`

Purpose:

- Add Mesh Tool v0 for selected Drawable initial mesh generation.

Dependency:

- Must start after Domain A pass / order contract note.
- Must not alter PSD import bytes/visibility semantics owned by Domain B.

Expected implementation areas:

1. Alpha-aware mesh generation
   - Add deterministic alpha-aware grid triangulation.
   - Use Drawable's own texture / alpha bounds.
   - Keep texture bounds and mesh geometry bounds coherent; do not break Canvas image byte dimension assumptions.
   - Preset values may be conservative and documented.

2. Operation / package support
   - Extend existing `generateMesh` or add focused operation support if needed.
   - Apply must commit the same geometry that preview displayed.
   - Regenerate replaces existing mesh only on Apply.

3. Mesh Tool UI
   - Active Mesh Tool switches Inspector to mesh workflow.
   - Drawable selected -> preset preview / generated state.
   - Container selected -> Drawable picker within selected container.
   - None/project selected -> short select-DRAWABLE empty state.
   - No batch generation.

4. Draft preview state
   - Draft mesh lives in Editor UI/session state until Apply.
   - Cancel / tool close / target change discards draft without confirmation.

5. Canvas mesh overlay
   - Show selected Drawable committed/draft mesh overlay.
   - Mesh overlay toggle changes display only.
   - Mesh Tool may temporarily render selected hidden Drawable for editing preview without changing model visibility.

6. Tests
   - Unit tests for mesh generation and alpha/bounds behavior.
   - Focused UI/E2E for selected Drawable -> preset -> preview -> Apply -> generated status.
   - No pixel/screenshot oracle.

Allowed write scope:

- `apps/editor/**`
- `packages/authoring-core/**`
- `packages/operation-core/**`
- `packages/package-format/**` only if mesh DTO/schema consistency requires it
- `packages/validator-core/**` only for focused mesh validation consistency if needed
- focused tests / fixtures
- `discussion/implementation/waves/wave61/**`
- `discussion/implementation/reviews/wave61/**`

Forbidden:

- Parts Tree mixed-order redesign beyond consuming Domain A contract.
- PSD Import preview / hidden group semantics changes.
- Batch mesh generation.
- Manual vertex edit.
- Edge / vertex add-delete UI.
- Detailed split-count UI.
- Advanced mesh quality tuning.
- Runtime/export behavior beyond existing mesh semantics.
- Pixel/screenshot oracle.

Required verification:

- `pnpm --dir apps/editor typecheck`
- `pnpm --dir apps/editor build`
- root `pnpm run typecheck`
- root `pnpm run test:unit`
- root `pnpm run check`
- focused mesh generation tests
- focused Playwright E2E if stable enough
- `git diff --check -- apps packages scripts package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json discussion`

Domain C review gates:

- Review-Sylph 1: UX / Mesh Tool / source-structure review.
- Review-Sylph 2: package / mesh operation / data contract review.
- Review-Sylph 3: test adequacy / E2E oracle review.

## 9. Domain D: `wave61-final-integration-clean-review-map-closeout`

Purpose:

- Integrate Domains A/B/C reports and reviews.
- Verify dependency order was respected.
- Update implementation maps.
- Record concise closeout and final clean integration review.

Allowed write scope:

- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`
- `discussion/implementation/waves/wave61/**`
- `discussion/implementation/reviews/wave61/**`
- small screen-design map/status corrections only if implementation changed documented status

Forbidden:

- Source implementation.
- Retrying A/B/C implementation directly.
- Rewriting screen design beyond status/link corrections.
- Large narrative report unless there is a real blocker or major scope deviation.

Required verification:

- Confirm Domain A pass and contract note exist before B/C start.
- Confirm Domains B/C pass or explicit escalate after A.
- Confirm all review lanes exist and are pass / accepted boundary.
- Confirm required validation results are recorded.
- Confirm maps cite Wave61 status accurately.
- `git diff --check -- discussion/implementation`

## 10. Subagent / Orch-Sylph Execution Policy

Wave61 follows the implementation orchestration skill.

1. Undine launches Domain A Orch-Sylph first.
2. Domain A Orch-Sylph must delegate source implementation to Gnome and reviews to independent Review-Sylphs.
3. Undine waits for Domain A final state. A wait timeout is polling timeout, not failure.
4. Only after Domain A pass or explicit accepted boundary result, Undine launches Domain B and Domain C Orch-Sylphs in parallel.
5. Domain B/C Orch-Sylphs must delegate source implementation to Gnome and reviews to independent Review-Sylphs.
6. Undine waits for Domain B/C final states. Do not close/cancel/interrupt child agents due to slow response or wait timeout.
7. Domain D runs after A/B/C completion.
8. Subagents must not ask the user directly.
9. If user decision is required, Domain escalates to Undine.
10. Undine must not inspect broad source/diff/test details directly.

Each assignment must include:

```text
Orch-Sylph自身は実装担当ではない。source implementation は必ず別コンテキストの Gnome に委譲し、レビューは必ず別コンテキストの Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。
```

Each Gnome assignment must also include:

```text
合意済みUX / AC / screen design を実現するために必要な場合、packages/** のロジック、schema、validator、command、fixture、testを修正してよい。GUIだけのworkaroundでpackage挙動を間違ったままにしないこと。ただし、新しい製品意味や不明な永続化・互換・権利境界は勝手に決めず、Orch-Sylph / Undineへescalateすること。
```

## 11. Pass Criteria

Wave61 passes when:

- Domain A establishes accepted mixed ordered structure semantics.
- Parts Tree displays Part Container and Drawable in one mixed order per parent.
- Tree order and Canvas draw order share the same authority.
- DnD before / after / inside works or records a concrete accepted boundary without misleading UI.
- Domain B shows PSD Import Review preview of selected PSD without clipping requirement.
- Domain B distinguishes local hidden from parent-hidden enough to preserve child Drawable runtime visibility under hidden group.
- Domain B maps hidden PSD group to editor-only hidden Part Container.
- Domain C provides selected Drawable mesh generation with preset preview -> Apply.
- Domain C provides Regenerate as replacement draft -> Apply.
- Domain C shows selected mesh overlay and supports hidden Drawable edit preview without changing model visibility.
- Required validation commands pass or concrete blocker is escalated.
- Review lanes for A/B/C pass or accepted boundary is explicitly recorded.
- Domain D closeout / clean integration review and maps are recorded.

Wave61 must not pass if:

- Parts Tree still groups all containers before drawables within the same parent while claiming mixed ordered UX.
- Tree order and Canvas draw order diverge silently.
- Package/model constraints force GUI-only state that contradicts accepted UX without explicit accepted boundary.
- Hidden PSD group still mutates child Drawable runtime visibility merely because parent group is hidden.
- PSD Import preview claims clipping/Photoshop parity.
- Mesh generation mutates project mesh before Apply.
- Regenerate destroys existing mesh before Apply.
- Mesh Tool cannot generate mesh for hidden Drawable selected from Parts Tree.
- E2E becomes a visual/pixel oracle.
