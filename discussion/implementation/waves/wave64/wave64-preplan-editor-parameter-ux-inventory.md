# Wave64 Preplan Editor Parameter UX Inventory

## verdict

pass

## short summary

Wave64 は現在の `apps/editor` 棚卸だけで計画可能です。ただし、Parameter / Keyform 系の実装ベースラインは設計文書の記述より薄い状態です。

Repository facts としては、Editor には静的な Parameter Bar surface、`parameters` task entry、`parameters` / `keyformSets` を持つ session graph、Deformer Tree / Inspector / Canvas overlay の既存基盤があります。一方で、active parameter state、current value state、Parameter Manager screen、parameter/keyform command、Add / Update / Delete keyform UI は未実装です。

次 wave は、package-domain の keyform operation が未準備なら「正直な Parameter UX shell + read-only / disabled binding affordance」に絞るのが安全です。working Add / Update / Delete loop を出すには package operation / schema / evaluation contract が必要です。

## facts with file paths

### Design facts

- `discussion/design/screen-design/components/parameter-keyform.md`
  - Parameter Bar は 1 つの active parameter / current value を扱う横断領域。
  - Keyform authoring は Parameter Bar と現在の Active Tool / Selection Inspector が協調する。
  - Keyform 専用 Inspector は作らない。
  - v0 の keyform 対象は連続 property に限定する: Drawable opacity、Warp lattice / control point positions、Warp opacity multiplier、Rotation angle、Rotation opacity multiplier。
  - Parts structure、visibility、draw order、mesh topology、parameter definition は keyform 対象外。
- `discussion/design/screen-design/screens/parameter-manager.md`
  - Parameter Manager は parameter definition、preset/custom、range、grouping、usage の専用画面。
  - current value 操作は Parameter Bar / parameter-aware Inspector 側。
- `discussion/design/parameter-preset-ecosystem.md`
  - Core Parameter、Preset/Profile、Facade/Mapping を分離する。
  - Core Parameter に tracker 固有 input や外部 format 固有情報を混ぜない。
- `discussion/design/screen-design/components/rig-tool.md`
  - Rig Tool の keyform authoring は Parameter Bar、Rig Inspector、Canvas overlay の協調として設計されている。
- `discussion/implementation/waves/wave63/wave63-domain-c-report.md`
  - Wave63 Domain C は Deformer Tree / Inspector Editor UX が final pass。
  - Parameter / Keyform authoring、subtree opacity keyforms、Bezier manual control editing、full Rotation draft / pivot editing は意図的に deferred。

### Repository facts

- `apps/editor/src/workspace/panels/parameter-bar.tsx`
  - `Parameter Bar` label、`Active` label、`None selected`、disabled range input、hard-coded `0.50` を表示するだけ。
  - `useEditorSession` / `useEditorUiStore` には未接続。
- `apps/editor/src/workspace/authoring-workspace.tsx`
  - `<ParameterBar />` を workspace body の下、`PsdImportModal` の前に常時 mount。
- `apps/editor/src/state/editor-ui-store.ts`
  - `WorkspaceEntryId` に `"parameters"` がある。
- `apps/editor/src/workspace/workspace-data.ts`
  - Toolbox / App Bar 用に `"Parameters"` task entry を定義。
- `apps/editor/src/workspace/app-bar.tsx`
  - task entry click で `activeEntry` を更新する。`import` だけ modal open side effect がある。
- `apps/editor/src/workspace/toolbox/workspace-toolbox.tsx`
  - Toolbox の Parameters button も `activeEntry` を更新するだけ。
- `apps/editor/src/features/editor-session/model/empty-authoring-session.ts`
  - `graph.parameters: []`、`graph.keyformSets: []` で初期化。
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
  - `session`、`selection`、`structureRows`、`deformerRows`、`drawablePoolItems`、`inspector`、`meshDraft`、`rigDraft`、Rig command callbacks を expose。
  - active parameter、current parameter value、key marker projection、Parameter Manager callback はない。
- `apps/editor/src/features/editor-session/model/editor-selection.ts`
  - shared selection は `part | drawable | rigControl` のみ。
- `apps/editor/src/features/editor-session/model/rig-tool-state.ts`
  - `session.graph.keyformSets` は `hasRigControlKeyforms` 判定にのみ使われる。
  - keyform create/update/delete/evaluate はしない。
- `apps/editor/src/workspace/panels/inspector-panel.tsx`
  - active tool が `mesh` なら Mesh Tool、`rig` なら Rig Tool、それ以外は Project / Part / Drawable Inspector。
- `apps/editor/src/workspace/panels/rig-tool-inspector.tsx`
  - Drawable から Rotation / Warp Deformer 作成。
  - Warp draft editor。
  - committed Warp Deformer Inspector。
  - committed Rotation Deformer Inspector。
  - parent Deformer creation。
- `apps/editor/src/workspace/panels/deformer-tree-view.tsx`
  - Deformer rows、bound Drawable references、collapsed-by-default Drawable Pool を表示。
  - Pool Drawable -> Deformer bind、bound Drawable -> Deformer rebind、Deformer -> Deformer reparent を DnD route。
- `apps/editor/src/workspace/canvas/canvas-projection.ts`
  - draft / committed deformer overlay と static deformer opacity multiplier を projection。
  - parameter current value や keyform interpolation は projection しない。
- `apps/editor/src/workspace/canvas/canvas-renderer.ts`
  - Warp grid / control points、Rotation pivot / arc / rest-angle guide を描画。
- `apps/editor/src/workspace/panels/canvas-preview-panel.tsx`
  - pointer interaction は pan / zoom / topmost Drawable selection。
  - Warp control point、Rotation pivot、Rotation angle の edit handle はない。

## existing capabilities

- Parameter Bar の配置 surface は存在する。
- Parameters task entry は App Bar / Toolbox に存在する。
- session graph は `parameters` と `keyformSets` を持つ。
- editor-session command wrapper は operation-core commit pattern を既に持つ。
- Rig Tool は Warp / Rotation Deformer の作成、parent insertion、committed static edits、operation rejection feedback を持つ。
- Deformer Tree / Drawable Pool は keyform authoring の構造的な起点として使える。
- Canvas は draft / committed deformer overlay を表示し、e2e 用 data attributes も持つ。
- Deformer structure flows は既存 test で比較的守られている。

## Inventory Answers

### 1. Parameter Bar v0 currently renders / connected state and commands

現在 render しているもの:

- static title/icon: `Parameter Bar`
- `Active`
- `None selected`
- disabled slider: `aria-label="Parameter value"`, min `0`, max `100`, value `50`
- numeric text: `0.50`

接続状態:

- active parameter state なし。
- current value state なし。
- session parameters / keyformSets 参照なし。
- key marker 表示なし。
- reset / add / update / delete / quick create / manager launcher callback なし。
- direct test なし。

Relevant paths:

- `apps/editor/src/workspace/panels/parameter-bar.tsx`
- `apps/editor/src/workspace/authoring-workspace.tsx`
- `apps/editor/src/state/editor-ui-store.ts`
- `apps/editor/src/workspace/workspace-data.ts`

Planning fact:

- `parameter-keyform.md` の「v0 は active parameter summary / current value slider / key marker summary / callbacks を扱う」という記述は、現在の repository implementation とは一致しない。Wave64 は repository facts を実装 baseline、design docs を target intent として扱う必要がある。

### 2. Current Inspector panels and attachment points

Drawable Inspector:

- Path: `apps/editor/src/workspace/panels/inspector-panel.tsx`
- name、runtime visibility、static opacity、clipping source、source/texture/mesh summary を扱う。
- editor-session actions:
  - `updateDrawableName`
  - `setDrawableRuntimeVisibility`
  - `updateDrawableOpacity`
  - `setDrawableMaskSource`
- parameter-aware section の attachment 候補:
  - static Opacity control の直後。
  - または Source section の前に独立 section。
- v0 では Drawable opacity のみ keyform-aware。visibility / clipping は keyform 対象外。

Warp Deformer Inspector:

- Path: `apps/editor/src/workspace/panels/rig-tool-inspector.tsx`
- selected `rigControl` -> `findWarpDeformerReadModel`。
- name、parent deformer、bound children summary、Bezier edit type、transform / Bezier evaluation summary、keyform lock summary、parent creation、domain bounds、transform / Bezier divisions、static opacity multiplier を扱う。
- `readModel.hasKeyforms` が true の場合、transform / Bezier division inputs は disabled になり、`updateRigControl` payload からも省かれる。
- parameter-aware section の attachment 候補:
  - top Warp Deformer summary の直後。
  - domain / division / static opacity sections の前。
- 注意:
  - lattice/control point keyform state と static deformer structure edit を混ぜない。
  - 現在は control point offset edit state がない。

Rotation Deformer Inspector:

- Path: `apps/editor/src/workspace/panels/rig-tool-inspector.tsx`
- selected `rigControl` -> `findRotationDeformerReadModel`。
- name、parent deformer、bound children summary、read-only pivot/rest angle、keyform lock summary、parent creation、static opacity multiplier を扱う。
- update payload は displayName / opacityMultiplier だけ。
- pivot / restAngle は committed Inspector では display-only。
- parameter-aware section の attachment 候補:
  - top Rotation Deformer summary の直後。
- 注意:
  - Rotation angle keyform UI には editable current angle control が必要だが、現在は存在しない。

Deformer Tree selection:

- Path: `apps/editor/src/workspace/panels/deformer-tree-view.tsx`
- Deformer row click -> `selectRigControl`
- bound Drawable ref click -> `selectDrawable`
- Drawable Pool row click -> `selectDrawable`
- gap:
  - bound Drawable ref を選んでも selection は `{ kind: "drawable", id }` だけ。
  - Parts Tree 由来の Drawable selection、Deformer Tree bound ref 由来、Drawable Pool 由来を Inspector が区別できない。
  - Drawable opacity keyform を Deformer Tree context に限定するなら、graph から binding context を derive するか selection context を拡張する必要がある。

### 3. Existing editor-session commands/actions for parameter/keyform-like work

Existing command wrapper:

- Path: `apps/editor/src/features/editor-session/model/editor-session-commands.ts`
- `createOperationCore()`
- `OperationRequestSchema.parse`
- `operationCore.commitOperation`

Editor wrappers が呼ぶ package operation types:

- `updatePart`
- `updateDrawable`
- `setRuntimeVisibility`
- `setMaskRelation`
- `setDrawablePart`
- `setDrawOrder`
- `moveStructureChild`
- `generateMesh`
- `createWarpDeformer`
- `createRotation2dRigControl`
- `bindRigControlChild`
- `moveDrawableRigControlBinding`
- `reparentRigControl`
- `updateRigControl`

Parameter/keyform-like に近いもの:

- `updateDrawable` は static Drawable opacity を編集できる。ただし keyform operation ではない。
- `updateRigControl` は static Warp / Rotation deformer fields を編集できる。
- `updateRigControl` は package validation により keyform cardinality conflict を reject する。
- `rig-tool-state.ts` は `graph.keyformSets` を読んで `hasKeyforms` を出す。

存在しないもの:

- active parameter selection action。
- current parameter value action。
- parameter definition create/update/delete action。
- keyform add/update/delete action。
- keyform operation type を呼ぶ editor command wrapper。

### 4. Canvas editing hooks for Warp lattice / Rotation overlay

Existing display hooks:

- `createCanvasRenderProjection` は `deformerDraft` を受け取り draft Warp overlay を作る。
- committed selected `rigControl` は Warp / Rotation overlay になる。
- Warp overlay:
  - domain bounds
  - transform columns/rows
  - Bezier columns/rows
  - child refs
  - draft/committed status
- Rotation overlay:
  - bounds
  - pivot
  - rest angle
  - child refs
  - committed status
- renderer は Warp grid / control points と Rotation pivot / arc / rest-angle guide を描く。
- Canvas surface は e2e assertion 用に overlay kind/status/grid/pivot/rest angle data attributes を持つ。

Editing hooks:

- Canvas pointer events は pan / zoom / click-to-select Drawable のみ。
- Warp lattice control points の hit-test / drag edit はない。
- Rotation pivot の hit-test / drag edit はない。
- Rotation angle の direct edit hook はない。
- Warp draft / committed Warp edits は Inspector numeric fields 経由。
- committed Rotation pivot/restAngle は read-only summary。
- Canvas renderer は static deformer opacity multiplier を descendant Drawable opacity に反映するが、Drawable geometry の warp / rotate preview はしない。

Conclusion:

- 現状は display overlay まで。control points / pivot / angle を Canvas で編集する loop は未実装。

### 5. Selection state vs Parts Tree / Deformer Tree / Drawable Pool

Shared selection:

- `EditorSelection = part | drawable | rigControl`
- `EditorSessionProvider` の single `selection` から以下を derive:
  - Parts Tree rows
  - Deformer Tree rows
  - Drawable Pool items
  - Inspector projection
  - Canvas projection

Parts Tree:

- `part` / `drawable` を選ぶ。
- part hierarchy、drawable membership、runtime visibility、editor-only part hidden gate、draw/order movement を扱う。

Deformer Tree:

- Deformer row は `rigControl` を選ぶ。
- bound Drawable ref と Drawable Pool row は `drawable` を選ぶ。
- deformer binding / rebind / reparent を扱う。
- Parts membership / draw order は変えない。

Drawable Pool:

- `session.graph.rigControls` の childDrawableIds に含まれない Drawable を pool として出す。
- Parts 所属とは独立。

Parameter-aware Inspector に必要な追加:

- `rigControl` selection は Warp / Rotation parameter sections を付けるには足りている。
- Drawable opacity keyform を正しく出すには、selection source または binding context が必要。
- active parameter/current value state が必要。
- target-property keyform lookup projection が必要。

### 6. Minimal Parameter Manager screen shell

Current state:

- Parameter Manager component は存在しない。
- `activeEntry === "parameters"` の画面 body は存在しない。
- App Bar / Toolbox の Parameters entry は `activeEntry` を set するだけ。
- `TaskViewEntryBar` は存在するが、現在の `AuthoringWorkspace` には task body router がない。

Structural recommendation:

- `authoring-workspace.tsx` や `workspace-data.ts` を肥大化させず、focused component を追加する。
- 候補:
  - `apps/editor/src/workspace/tasks/parameter-manager-screen.tsx`
  - または `apps/editor/src/workspace/parameter-manager/parameter-manager-screen.tsx`
- `AuthoringWorkspace` 側には small task surface router を置くのが自然。
- `AuthoringSession` から parameter/keyform projection を作る helper は `apps/editor/src/features/editor-session/model/` に responsibility 単位で置く。
- `discussion/development_convention/source-file-organization-policy.md` に従い、`index.ts` / catch-all file / `workspace-data.ts` への実装集中は避ける。

### 7. Tests currently covering Parameter Bar / Rig Tool / Deformer flows

Tests found:

- `apps/editor/src/features/editor-session/model/rig-tool-state.test.ts`
  - Warp draft creation。
  - committed Deformer Tree projection。
  - bound Drawable insertion payload。
  - Drawable Pool computation。
  - parent Deformer payload。
- `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts`
  - package operation wrapper coverage。
  - Warp / Rotation creation。
  - bind / rebind / reparent。
  - `updateRigControl`。
  - invalid operation rejection。
  - keyform cardinality conflict rejection。
- `apps/editor/src/workspace/panels/rig-tool-inspector.test.ts`
  - keyformed Warp Deformer の division fields disabled。
  - disabled division edits を `updateRigControl` payload から omit。
- `apps/editor/src/workspace/canvas/canvas-projection.test.ts`
  - Canvas selection / visibility / opacity / masks。
  - mesh overlays。
  - draft / committed Warp overlay。
  - committed Rotation overlay。
  - static deformer opacity multiplier。
- `apps/editor/e2e/psd-import.e2e.spec.ts`
  - import。
  - Parts Tree / Inspector edits。
  - Mesh Tool flow。
  - Warp Deformer draft / commit / edit。
  - stale draft rejection feedback。
  - committed Deformer reparent from Inspector。
  - Rotation Deformer creation。
  - parent Warp insertion。

Tests not found:

- Parameter Bar direct test。
- Parameter Manager test。
- active parameter/current value test。
- key marker projection test。
- keyform add/update/delete editor command test。
- parameter-aware Drawable/Warp/Rotation Inspector test。
- Canvas parameter current value / keyform interpolation preview test。

Likely Wave64 tests:

- Parameter Bar component/unit:
  - no parameter。
  - active parameter。
  - disabled current value。
  - current value clamp。
  - read-only key marker summary。
- editor-session model:
  - active parameter projection。
  - target-property keyform lookup from `graph.keyformSets`。
- Inspector component:
  - Drawable opacity binding section。
  - Warp binding section。
  - Rotation binding section。
  - disabled states when no active parameter exists。
- E2E:
  - Parameters task entry opens Parameter Manager shell。
  - if package keyform ops exist: create deformer -> select parameter -> add/update keyform -> marker appears。
  - if package keyform ops do not exist: blocked/disabled UI and no mutation。

### 8. Editor-independent work vs package dependency

Editor-only / package-independent:

- Static Parameter Bar を honest stateful shell に置き換える。
- editor-local active parameter/current value preview state を追加する。
- existing `session.graph.parameters` / `session.graph.keyformSets` を read-only display に使う。
- key marker summary を existing keyform keys から derive する。
- existing `"parameters"` entry を minimal Parameter Manager shell に wire する。
- package operation がない場合、Parameter Binding sections は disabled Add/Update/Delete として出す。
- target-property capability projection を追加する:
  - Drawable opacity
  - Warp lattice / opacity
  - Rotation angle / opacity
- Deformer Tree bound Drawable context の扱いを補う。
- UI shell / disabled path の tests を追加する。

Package-domain 待ち / 要 coordination:

- parameter definition lifecycle operation。
- preset role catalog source of truth。
- keyform add/update/delete operation。
- target-property schema。
- state patch schema。
- interpolation / evaluation rule。
- current parameter value による Canvas preview。
- Warp control point offsets cardinality validation。
- operation/evidence/diagnostics payload。

## gaps for Parameter / Keyform Editing Loop v0

- active parameter state がない。
- current parameter value state がない。
- key marker projection がない。
- Parameter Manager screen がない。
- Quick Create / Select UI がない。
- parameter preset catalog UI がない。
- parameter-aware Inspector section がない。
- keyform Add / Update / Delete command がない。
- keyform operation wrapper がない。
- parameter current value による Canvas preview evaluation がない。
- Warp control point / Rotation pivot / Rotation angle の Canvas edit がない。
- bound Drawable selection context が `drawable id` 以上の情報を持たない。
- static property edit と keyform property edit の UI distinction がない。
- Parameter Bar implementation と design doc の Wave53 v0 status claim がずれている。

## tests found / likely tests needed

Found:

- Rig Tool state unit tests。
- Editor session command unit tests。
- Rig Tool Inspector component test。
- Canvas projection unit tests。
- PSD import e2e including Mesh / Rig / Deformer flows。

Needed:

- Parameter Bar unit/component tests。
- Parameter Manager shell e2e/component tests。
- active parameter/current value state tests。
- key marker projection tests。
- parameter-aware Inspector tests。
- keyform command wrapper tests, only after package operation exists。
- e2e for one narrow working keyform loop, only after package operation exists。

## recommended Wave64 editor domain scope

If package keyform operations are not ready:

1. Parameter Bar を truthful shell にする。
2. Parameters task entry から minimal Parameter Manager shell を開けるようにする。
3. Drawable / Warp / Rotation Inspector に read-only/disabled Parameter Binding section を追加する。
4. `graph.keyformSets` から target-property keyform existence / marker summary を read-only derive する。
5. disabled paths と shell behavior の focused tests を追加する。

If package keyform operations are ready:

1. editor command wrappers を keyform operations に追加する。
2. 最初の working loop は 1 property に絞る。
3. 推奨 first property は Drawable opacity または Warp opacity multiplier。
4. Warp control point offsets / Rotation angle は、編集 state と preview/evaluation の不足が大きいため後段が安全。
5. Add / Update / Delete -> marker update -> Inspector state -> Canvas preview の focused e2e を追加する。

Wave64 で避けるべき範囲:

- full preset ecosystem。
- Parameter Control Palette。
- 2D/grid parameter UI。
- Camera Capture / tracker facade。
- Bezier manual control point editing。
- subtree opacity keyforms。
- full geometric deformer evaluation in Canvas。

## dependency on package domain

Editor は UI shell と read-only projection までは進められます。実際に Parameter / Keyform Editing Loop v0 を成立させるには package-domain から以下が必要です。

- Parameter definition lifecycle。
- Keyform lifecycle operations。
- target-property schemas。
- state patch schemas。
- interpolation / evaluation。
- validation diagnostics。
- operation/evidence payload。

これらがない状態で Add / Update / Delete keyform を working command として見せるのは避けるべきです。

## user-decision points

- Wave64 は disabled/read-only Parameter UX shell を先に出すか、package keyform operations まで待って working loop を出すか。
- Parameter Manager は full workspace task surface、modal/task window、right-side/dedicated panel のどれにするか。設計は Manager / Task screen だが、現実装には task-body router がない。
- Drawable opacity keyform は任意 Drawable selection で出すか、Deformer Tree / bound Drawable context に限定するか。
- package operation が ready の場合、v0 の最初の keyform property はどれにするか: Drawable opacity、Warp opacity multiplier、Rotation angle、Warp control point offsets。
- active parameter/current value は editor-local UI state から始めるか、package/session state として永続化するか。

## unresolved technical risks

- Design docs と repository implementation で Parameter Bar v0 の現在地が一致していない。
- current selection shape は Deformer Tree bound Drawable opacity authoring には情報不足の可能性がある。
- Canvas は guide 表示だけで、edit handle や parameterized deformation evaluation を持たない。
- Rotation Deformer は pivot/restAngle が read-only で、angle keyform 用の editable control がない。
- Warp lattice keyform authoring に必要な control point offset edit state がない。
- `updateRigControl` は keyform cardinality conflict を reject するため、新 UI は不可能な division edit path を出さない必要がある。
- Parameter preset source of truth が未確定: package-provided catalog か editor-local constants か。
- この inventory では test / typecheck は実行していない。結果は source と basis document inspection に基づく。
