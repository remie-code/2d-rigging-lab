# Wave 59 Plan: Canvas Renderer / PSD Drawable Display v0

> PSD import後に、WorkspaceのCanvas / PreviewへPSD由来drawableを実描画し、zoom / pan / fit / selection overlay / toolbarを成立させる縦切り実装計画。実装は単独Gnomeドメインでまとめ、レビューは複数観点で厚くする。

## 1. 状態

- Status: Planned
- Target wave: Wave59
- Wave name: `canvas-renderer-psd-drawable-display-v0`
- Primary objective: Wave58で作成できるようになったPSD由来part / drawable構造を、Canvas / Preview上で実際に見える形へ接続する。import後、visible drawableがPSD bounds / draw order / opacity / visibilityに従って描画され、ユーザーがzoom / pan / fit / selectionを行える状態にする。

## 2. Planning Gate Result

Planning Gate result before this plan: `Inventory first` -> `Plan directly`.

Inventory basis:

- Sylph inventory verdict: `done`。
- 重要事実:
  - PSD parse / import plan / source manifestにはcanvas、source groups、source layers、bounds、source order、visibility、opacity source metadata、materialization evidenceが存在する。
  - Wave58後のcommitでは、part containers / drawables / empty mesh scaffold / texture metadata / source profileは作られる。
  - hidden leavesは`setRuntimeVisibility(false)`でruntime-hidden drawableになる。
  - PSD layer opacityはsource metadata / structural evidenceには残るが、committed drawableの`defaultOpacity`は`1`固定であり、Canvas opacity UXには縦修正が必要である。
  - 実描画に必要なactual RGBA bytesは、現状ではbrowser runtimeに残っていない。adapterが`layer.composite(false, false)`で作ったbytesはdigest / byteLength / binary refsへ変換され、`PsdImportPlan`やauthoring session binary byte storeへ保持されない。
  - Canvas panelは現状静的で、`useEditorSession`を読んでいない。
  - Package側にはmask/clipping relationのcontract / operation / validator / runtime evidenceがあるが、PSD parser adapterはPSD clipping情報を抽出していない。
  - v0描画はCanvas 2Dで十分そうであり、Pixi/Konva/Three/WebGL renderer dependencyは必須ではない。

Accepted user decisions:

- PSD描画はUXの中心であり、後回しにしない。
- ただしPhotoshop / Kritaのようなペインティング機能は不要である。
- Photoshop pixel perfect parityやpixel oracleは不要である。
- 初期はnormal alpha blend、opacity、clipping、selection overlayを中心にする。
- clippingはキャラクターPSDではよく使うため、UX上重要であり無視してよい細部ではない。
- Canvas操作v0は「見る・拡大縮小する・移動する・選ぶ・選択状態を見る」まででよい。
- Wheel zoom、pan、fit、toolbar zoom controls、selection feedbackは必須である。
- Fit Artworkはvisible drawable群の実描画boundsに合わせる機能、Fit CanvasはPSD canvas全体に合わせる機能として扱う。
- Canvas toolbarはCanvas panel header直下に置き、zoom系、fit系、overlay toggle、Isolate Selectedをまとめる。
- Canvas上での移動、変形、複数選択、marquee selection、rotate view、rulers / guides、pixel inspectorはv0で扱わない。
- Wave59の実装は単独Gnomeドメインでよい。過度なmicro splitは避ける。
- 必要なpackage logic修正は許可される。GUI workaroundではなく、合意済みUXを真として縦に直す。

Primary basis:

- [Canvas / Preview Component](../../design/screen-design/components/canvas-preview.md)
- [Authoring Workspace Screen](../../design/screen-design/screens/authoring-workspace.md)
- [Parts Tree Component](../../design/screen-design/components/parts-tree.md)
- [Drawable Inspector Component](../../design/screen-design/components/drawable-inspector.md)
- [Playwright E2E Oracle](../../design/screen-design/e2e-oracle.md)
- [React Editor Foundation Oracle](../../design/screen-design/react-editor-foundation-oracle.md)
- [UX-Backed Package Logic Authority](../../development_convention/ux-backed-package-logic-authority.md)
- [Source File Organization Policy](../../development_convention/source-file-organization-policy.md)
- [Dependency Policy](../../development_convention/dependency-policy.md)
- [Operation Policy](../../development_convention/operation-policy.md)
- [Schema and ID Conventions](../../development_convention/schema-and-id-conventions.md)
- `.github/skills/implementation-orchestration/SKILL.md`

## 3. UX Acceptance Criteria

Wave59 must satisfy this user-visible path:

```text
Authoring Workspace
  -> Import PSD
  -> user selects PSD
  -> Import Review appears
  -> user clicks Import
  -> modal closes
  -> Parts Tree shows imported structure
  -> Canvas / Preview shows imported visible drawable artwork
  -> user can zoom / pan / fit
  -> selecting Parts Tree row highlights corresponding Canvas bounds
  -> clicking Canvas selects topmost drawable by deterministic hit test
```

Canvas renderer v0 must show:

- PSD canvas bounds as the Stage coordinate basis.
- visible drawable imagery at PSD bounds.
- draw order / source order in a deterministic way.
- runtime visibility.
- drawable opacity, including PSD source opacity where imported.
- selection bounds / outline for selected drawable or selected part subtree.
- empty state only when no drawable artwork is available.

Canvas toolbar v0 must provide:

- zoom out
- zoom percentage or compact zoom indicator
- zoom in
- 100% / 1:1
- Fit Artwork
- Fit Canvas
- Toggle Grid
- Toggle Canvas Bounds
- Toggle Selection Bounds
- Isolate Selected

The implementation may include mesh/deformer overlay buttons in disabled/inactive state only if that helps preserve the toolbar layout, but Mesh / Rig overlay functionality is not required in Wave59.

## 4. Clipping Boundary

Clipping is accepted as important UX and must not be treated as an irrelevant future detail.

Wave59 must do one of the following:

1. Implement PSD clipping extraction and map it into existing package mask/clipping relation behavior, then render it in Canvas v0; or
2. If `@webtoon/psd` / current adapter facts show PSD clipping cannot be extracted deterministically within this wave, implement the renderer-side support for existing model mask/clipping relations and record a concrete blocker for PSD import clipping extraction.

Wave59 must not:

- claim Photoshop compositing parity;
- fake clipping in the UI without model/package representation;
- silently ignore clipping while presenting the renderer as complete PSD import rendering;
- add a broad renderer dependency only to avoid understanding the existing package mask relation path.

If implementing PSD clipping extraction requires a new dependency, unclear license boundary, or a new durable product concept, Domain A must escalate rather than decide silently.

## 5. E2E Oracle Boundary

Wave59 may add focused Playwright E2E, but only under [Playwright E2E Oracle](../../design/screen-design/e2e-oracle.md).

E2E should verify:

- Authoring Workspace loads.
- Import PSD path still works.
- After Import, Canvas contains a renderer surface representing imported drawable display.
- Basic toolbar controls are reachable.
- Fit action and zoom action do not break the Canvas state.
- Parts Tree selection updates Canvas selection state.
- Canvas click can select a drawable in a deterministic fixture case.

E2E must not verify:

- pixel-perfect rendered image.
- screenshot or visual regression.
- exact canvas pixels.
- exact toolbar spacing, dimensions, or color.
- Photoshop compositing parity.
- tooltip full text.
- internal renderer implementation details.

Human/user visual check remains the oracle for visual quality, framing, density, and whether the display feels correct.

## 6. Domain Design

Wave59 intentionally uses one implementation domain and one closeout domain.

| Batch | Domain | Parallelism | Dependency | Purpose |
|---|---|---|---|---|
| 1 | A. Canvas Renderer / PSD Drawable Display v0 implementation | One large implementation domain | Wave58 PSD Import E2E v0 + Wave59 Canvas UX basis | Implement the full Canvas drawable display vertical slice |
| 2 | B. Final integration / clean review / map closeout | After A | A pass or explicit escalate | Verify integration, update maps, record concise closeout |

Do not split Domain A merely because it crosses `apps/editor` and `packages/**`. This wave's coherence depends on byte availability, package opacity, session projection, renderer drawing, selection, and E2E staying aligned.

Domain A may split support work only if the Orch-Sylph records a concrete reason and keeps a single Gnome accountable for the vertical slice. Any split must use non-overlapping write scopes.

## 7. Domain A: `wave59-canvas-renderer-psd-drawable-display-v0`

Purpose:

- Make imported PSD drawable artwork visible and navigable in the Authoring Workspace Canvas / Preview.

Required implementation areas:

1. Render data availability
   - Ensure materialized PSD layer RGBA bytes or an equivalent browser-renderable representation remains available to the Editor runtime after import.
   - Do not persist raw source PSD bytes durably unless a plan explicitly changes that boundary.
   - Prefer a browser runtime render cache or existing binary byte registration path that respects package privacy / persistence boundaries.
   - Avoid storing parser raw objects in durable state.

2. PSD opacity vertical fix
   - Preserve PSD source layer opacity into committed drawable opacity where appropriate.
   - Update operation/package/validator/tests consistently if existing package logic hardcodes opacity in a way that contradicts accepted UX.
   - Use [UX-Backed Package Logic Authority](../../development_convention/ux-backed-package-logic-authority.md) as the authority for this package-level correction.

3. Canvas render projection
   - Add a session-derived projection for Canvas drawing.
   - Include canvas bounds, drawable id, part ancestry if needed, texture/source refs, image/bitmap handle or byte ref, bounds, draw order, runtime visibility, opacity, hidden state, and selection state.
   - Keep projection logic outside the React component when practical.

4. Canvas 2D renderer
   - Replace the static Canvas placeholder with a Canvas 2D rendering surface.
   - Draw visible drawable imagery by bounds and order.
   - Apply opacity.
   - Show PSD canvas bounds / grid / origin in lightweight overlay form.
   - Show selection bounds / outline.
   - Keep empty state only for truly no-renderable-artwork cases.

5. View navigation
   - Implement wheel zoom centered around pointer position.
   - Implement pan, at minimum Space + left drag. Middle drag may be added if straightforward.
   - Implement Fit Artwork.
   - Implement Fit Canvas.
   - Implement 100% / 1:1.
   - Keep view state local to Canvas unless a later UX requires persistence.

6. Canvas toolbar
   - Add compact toolbar under Canvas panel header.
   - Group view controls, overlay controls, and focus controls.
   - Use icon buttons with tooltips where practical.
   - Avoid large text labels that consume vertical space.
   - Keep toolbar height compact.

7. Selection and hit testing
   - Parts Tree selection must update Canvas selection overlay.
   - Canvas click must select the topmost visible drawable under the pointer.
   - Hit test should be deterministic and respect current view transform.
   - Hidden drawables should not be hit-test targets by default.
   - If selected part/group has multiple drawable descendants, show a subtree selection outline or clear selected-region indication.

8. Visibility reflection
   - Runtime visibility must affect Canvas rendering.
   - GUI visibility controls are not required in this wave, but the renderer must reflect existing session visibility state.

9. Isolate Selected
   - Implement Canvas-only isolate/dim mode if feasible within the vertical slice.
   - This must not mutate model visibility.
   - If selected drawable exists, keep it normal and dim other drawable imagery.
   - If selected part/group exists, keep descendants normal and dim others.
   - If not feasible after renderer groundwork, escalate or explicitly defer only with concrete reason; do not silently omit if the toolbar exposes the action.

10. Clipping / mask support
   - Support existing model mask/clipping relations in Canvas rendering if such relations exist in the session.
   - Attempt PSD clipping extraction only if current parser/adapter facts support it deterministically.
   - If PSD clipping extraction is not feasible in Wave59, record a concrete implementation blocker and keep the non-goal clear.

Allowed write scope:

- `apps/editor/**`
- focused `packages/**` files needed for byte availability, opacity, mask/clipping relation rendering data, operation/schema/validator consistency, and tests
- focused tests / fixtures needed for Canvas renderer v0
- `package.json`, `pnpm-lock.yaml`, workspace config only if a justified dependency or test command is needed
- `scripts/**` only for focused guard/test updates directly tied to this wave
- `discussion/implementation/waves/wave59/**`
- `discussion/implementation/reviews/wave59/**`

Forbidden write scope:

- Broad GUI rewrite outside Canvas / Preview and required session support.
- Restoring old legacy GUI panels or old debug/evidence-heavy normal UI.
- Reintroducing visual regression / screenshot oracle.
- Photoshop pixel parity implementation.
- Paint / pixel editing tools.
- Mesh editing, Rig editing, Dynamics editing, Texture Atlas implementation.
- Cubism / Live2D SDK or file compatibility.
- Public demo asset additions.
- Persisted source PSD raw bytes unless explicitly escalated and accepted.
- External HTTP/WebSocket/MCP transport or LLM/provider work.

Dependency policy:

- Canvas 2D should be attempted first.
- A renderer dependency is not forbidden, but must be justified by a concrete v0 blocker and pass [Dependency Policy](../../development_convention/dependency-policy.md).
- Do not add Pixi/Konva/Three/WebGL dependency merely for convenience.
- Do not add Photoshop/compositing libraries without explicit escalation.

Required verification:

- `pnpm --dir apps/editor typecheck`
- `pnpm --dir apps/editor build`
- root `pnpm run typecheck`
- root `pnpm run test:unit`
- root `pnpm run check`
- Existing PSD parser/import smoke if still relevant / available
- Focused unit tests for render projection / opacity / hit-test / fit math where practical
- Focused Playwright E2E for import -> Canvas display -> selection / toolbar path
- `git diff --check -- apps packages scripts package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json discussion`

If Vite / Vitest / Playwright require dev server startup, the implementation domain must avoid leaving long-running processes alive. If a dev server is needed for verification, it must be started in a controlled process and stopped.

Domain A review gates:

- Review-Sylph 1: UX / screen-design / source-structure review.
  - Confirm Canvas UX follows [Canvas / Preview Component](../../design/screen-design/components/canvas-preview.md).
  - Confirm toolbar grouping, zoom/pan/fit, selection overlay, and non-goals are respected.
  - Confirm normal UI is not polluted with diagnostics/evidence/debug/test text.
  - Confirm source organization follows [Source File Organization Policy](../../development_convention/source-file-organization-policy.md).
- Review-Sylph 2: package / data contract / vertical consistency review.
  - Confirm render bytes availability does not violate persistence/privacy boundaries.
  - Confirm opacity is preserved coherently through package/editor paths.
  - Confirm package/schema/validator/evidence surfaces remain consistent where touched.
  - Confirm UX-backed package changes are justified by accepted UX and not invented product semantics.
  - Confirm clipping/mask status is truthful and not faked.
- Review-Sylph 3: test adequacy / E2E oracle review.
  - Confirm tests cover the vertical path without asserting visual/pixel parity.
  - Confirm E2E follows [Playwright E2E Oracle](../../design/screen-design/e2e-oracle.md).
  - Confirm focused unit coverage exists for deterministic renderer math where feasible.
  - Confirm no test-only UI text or debug surfaces are added for convenience.
  - Confirm no long-running dev server process remains.

## 8. Domain B: `wave59-final-integration-clean-review-map-closeout`

Purpose:

- Integrate Domain A reports and reviews.
- Update implementation maps.
- Record concise closeout and clean integration review.

Allowed write scope:

- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`
- `discussion/implementation/waves/wave59/**`
- `discussion/implementation/reviews/wave59/**`
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
- Confirm any clipping limitation is explicit and not hidden.
- Confirm maps cite Wave59 status accurately.

## 9. Subagent / Orch-Sylph Execution Policy

Wave59 follows the implementation orchestration skill.

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

## 10. Pass Criteria

Wave59 passes when:

- Import PSD後、Canvas / Previewにvisible drawable artworkが表示される。
- PSD canvas boundsがStage基準として扱われる。
- drawable imageryがbounds / deterministic order / runtime visibility / opacityに従って描画される。
- PSD opacityがimport後のdrawable表示に反映される。
- render bytes or equivalent browser-renderable representationがruntimeで利用可能である。
- Wheel zoomが機能する。
- Panが機能する。
- Fit Artworkが機能する。
- Fit Canvasが機能する。
- 100% / 1:1が機能する。
- Canvas toolbarがcompactに配置され、view / overlay / focus controlsを持つ。
- Parts Tree選択がCanvas selection overlayに反映される。
- Canvas clickでtopmost visible drawableを選択できる。
- hidden drawableは通常描画・hit test対象にならない。
- Isolate Selectedが実装される、または具体的理由付きで明示的にescalate/deferされ、UIが虚偽表示をしない。
- Existing model mask/clipping relationsがある場合、Canvas rendererがそれを無視しない。
- PSD clipping extractionについて、実装されたか、実装不能理由と次のseamが明確に記録されている。
- Minimal Playwright E2E validates main path without visual/pixel assertions.
- Required validation commands pass or concrete blocker is escalated.
- Domain A report、3 review lanes、Domain B closeout / clean reviewが記録されている。

Wave59 must not pass if:

- Canvas remains a static placeholder after import.
- Canvas display depends only on row labels / DOM debug text rather than model/render data.
- GUI workaround hides incorrect package behavior.
- actual image display is absent but the wave claims drawable rendering is complete.
- clipping is silently ignored while presented as supported.
- E2E becomes a visual/pixel oracle.

