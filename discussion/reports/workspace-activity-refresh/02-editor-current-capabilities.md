# Workspace activity refresh — Editor 現行能力

> 基準日: 2026-08-08 (Asia/Tokyo)。調査対象は `apps/editor` と主要 package/test/script であり、実装・テストの存在を製品受入とは同一視しない。Git HEAD は `af5839452f0968a005cb6cd13c62b714aa4e6d4e` (`docs: refresh discussion maps`)。

## 1. Scope / inspected entry points

先に `discussion/reports/workspace-activity-refresh/audit-contract.md`、`discussion/_conventions.md`、`discussion/_map.md` を読み、そこから `discussion/implementation/_map.md`、`discussion/design/screen-design/_map.md`、`discussion/design/module-contracts/_map.md`、`discussion/editor-electron-migration/_map.md` を入口にした。現行能力は map の記述ではなく source/test/package を優先して照合した。

- Editor shell/routes: `apps/editor/src/workspace/authoring-workspace.tsx`、`apps/editor/src/state/editor-ui-store.ts`、`apps/editor/src/app/editor-app.tsx`。
- Import/session: `apps/editor/src/features/psd-import/model/psd-import-planner.ts`、`psd-import-commit.ts`、editor-session model。
- Authoring surfaces: Canvas、Structure Tree、Mesh/Rig/Dynamics/Parameter panels、Diagnostics、Texture Atlas、Variants、Viewer、Runtime Export。
- Package/runtime evidence: `packages/authoring-core`、`operation-core`、`package-format`、`runtime-core`、`validator-core`、`render-core`、`render-webgl2` と各 focused tests。
- Verification scripts: root `package.json`、`apps/editor/package.json`、Editor typecheck/unit、focused Vitest、Electron renderer build。

## 2. Executive summary

1. **現在のEditorはElectronのauthoring-to-viewer prototypeである。** `AuthoringWorkspace` は通常の編集面（Toolbox/Structure Tree/Canvas/Inspector/ParameterBar）と、Viewer、Diagnostics、Texture Atlas、Runtime Export、Variants、Parameter Managerのrouteを持つ（`authoring-workspace.tsx:25-102`、`editor-ui-store.ts:3-11`）。
2. **PSDは明示承認付きの構造scaffold + materialized layer取り込みまで。** cap policy、digest、source metadata、review/approval evidenceは作るが、raw PSD/parser objectの永続化、semantic recognition、repo proposal生成、初期grid mesh、Photoshop compositingは提供しない（`psd-import-planner.ts:39-46,115-153,155-184`）。
3. **編集可能な意味論はPart/Drawable階層、mesh、Rotation/Warp deformer、parameters/keyforms、dynamics、mask/visibility、variantに及ぶ。** これらは operation/session model とCanvas projectionへ接続されるが、pixel/visual品質の人間判定は別である。
4. **Canvasは評価済みmesh/deformer/keyform/visibility/maskを投影し、WebGL2を試みて描画する。** fake GL中心のunit evidenceはあるが、実GPU pixel parity、Canvas2D sunset、低性能端末を含む受入は未閉鎖（`canvas-evaluation.ts:31-45,217-220,330-383`、`canvas-projection.ts:193-235`、`canvas-renderer.ts:77,248-287,853-906`）。
5. **Dynamicsの現行ownerはscalar v2ではなく`dynamics-file-v3`/`worldFrameChainV1`。** Editor previewはruntime-core `stepDynamics` を直接使い、複数output/anchorを扱う。旧scalar文言は歴史・追跡負債として扱う（`dynamics-tool-state.ts:34-37`、`runtime-core/src/dynamics-evaluation.ts:13-26,262-299,378-412`）。
6. **Runtime Exportはpreflightを通った現sessionをpicked directoryへ出力できる。** 出力はJSON群、raw RGBA atlas page、materialized runtime graphのdirectory artifactで、browser picker/external player parityは未検証（`runtime-export-task-screen.tsx:52-142,232-348`）。
7. **Variantsはpackage-persisted group/variantの作成・更新・削除、singleSelect/multiToggle、Drawable membership、Canvas/Viewer previewを持つ。** focused variant/atlas/runtime testsは通るが、visual/product gateは別途残る（`variant-manager-screen.tsx:54-70,129-198,372-569`）。
8. **Diagnosticsはread-only warning projectionと関連surfaceへのjump actionを持つ。** 現source routeは`workspace`だが、unitに旧`import`期待が4件残るため、品質負債を実装欠落と混同しない（`diagnostics-screen.tsx:25-166,221`、`editor-ui-store.ts:27-34`）。
9. **コード検証は部分的にpassしている一方、Editor typecheckとunit全体はfail。** focused package tests 16 files/211 testsはpass、Editor unitは62 pass/1 fail（493 pass/4 fail/4 skipped）。2026-08-08の`apps/editor` tsconfig typecheck再実行はexit 2で、端末に印字された`error TS`行は23本だった（diagnostics総数を別集計した値ではない）。Electron buildはsandboxではspawn EPERM、escalated rerunはpassであり、いずれも現行能力の存在証拠と品質受入を分ける根拠になる。

## 3. What was built or investigated

### 3.1 Shell, workspace, and routes

`editor-app.tsx` はElectron preloadのworkspace filesystem bridgeを受け、`EditorSessionProvider` と `FoundationWorkspace` をmountする。`AuthoringWorkspaceContent` はworkspaceが開いていない場合のgateを表示し、active entryに応じて編集面か専用task/viewを切り替える（`authoring-workspace.tsx:25-66,68-102`）。現在のentry unionは `workspace | parameters | variants | atlas | runtimeExport | validate | viewer`（`editor-ui-store.ts:3-11`）。

### 3.2 PSD import and session materialization

`createPsdImportPlan` はPSD adapter結果から承認可能なgroup/leaf scaffold、digest、review rows、materialized bytesを構成する（`psd-import-planner.ts:48-113,187-213`）。構造上限はnodes 1024、depth 16、groups 128、leaves 256、generated nodes 512、raw RGBA 256 MiB（`:39-46`）。commit側はsource assetとstructural operationをoperation-coreへ渡し、materialized layer bytesをbinary asset refとして登録する。

### 3.3 Structure, Canvas, and rendering

Structure projection (`session-tree.ts`) はordered Part Container/Drawable tree、inspector projection、move/reparent/drop validationを提供する（`session-tree.ts:18-109,125,262,395-439`）。Canvas evaluation/projectionはparameter values、keyforms、deformer、runtime visibility、part hidden、variant predicate、mask relationsを統合する（`canvas-evaluation.ts:31-45,217-220,330-383`）。rendererはWebGL2を作り、clipping/maskとmesh drawableを描画する（`canvas-renderer.ts:248-287,853-906`）。UIにはselection/overlay、zoom/pan/fit/1:1がある。

### 3.4 Mesh authoring

`mesh-tool-state.ts` は`largeMotion`/`standard`/`lowMotion` presetsを持ち、現defaultは`auto-outline-v6d-adaptive-contour-constrainautor`、choiceにv6d/v7を持つ（`:48-97`）。`MeshToolInspector` はpreview、apply、regenerate、existing mesh warning、選択drawableのbatch操作を提供する（`mesh-tool-inspector.tsx:40-48,103,170-173,261-274,352-363`）。これは操作経路の実装事実であり、v6d/v7の最終visual quality holdは閉じていない。

### 3.5 Rigging and keyforms

`rig-tool-state.ts`/`rig-tool-inspector.tsx` はRotation2DとWarpLattice2D、5x5 warp/3x3 Bezier draft、parent/reparent、batch create/wrap、parameter binding、control-point/keyed handlesを持つ（`rig-tool-state.ts:21-25,31-47,188-221,255-377`、`rig-tool-inspector.tsx:71-219,322-355,740-963,1141`）。Bezier edit surfaceは保存契約を持つが、evaluation boundaryは明示的に`storedNotEvaluatedV0`（`packages/package-format/src/warp-deformer-contract.ts:16-21`）。

`parameter-keyform-state.ts` はopacity、angle、translation、control-point offsets、opacity multiplierのbinding projectionとedit payloadを作り（`:25-31,220-270,364-393`）、Parameter Manager/BarからAdd/Update/Delete/Ends/Ends+Center keyform操作を出す。実装上のkeyform mutationはauthoring-coreにある。

### 3.6 Dynamics authoring and preview

Dynamics tool stateのコメント・importsは`dynamics-file-v3`とruntime-core `stepDynamics`をownerとしている（`dynamics-tool-state.ts:9-37`）。Previewはdriver編集、fixed-step advance、reset、quick tune/preset、output summaryを持つ（`dynamics-tool-state.ts:78-108,474-735,801-873`、`dynamics-tool-inspector.tsx` のPreview/Reset/Quick Tune UI）。runtime-coreはworld-frame Verlet chainを1 stepずつ進め、anchor付きoutput offsetsを返す（`dynamics-evaluation.ts:262-299,378-412`）。

### 3.7 Diagnostics, Atlas, Variants, Viewer, Runtime Export

- Diagnostics: warning count、category rows、details、Mesh/Rig/Parameters/Dynamicsへのjump action（`diagnostics-screen.tsx:25-166,221`）。
- Texture Atlas: single-page skyline preview/apply、padding/edge extrusion、hidden/owned drawable filtering、missing/ready/failed/stale状態（`texture-atlas-task-screen.tsx:42-102,163-221`、`atlas-task-projection.ts:128-172`、`authoring-core/src/texture-atlas-packing.ts:28-29`）。
- Variants: group/variant CRUD、mode、default selection、membership picker、Canvas preview（`variant-manager-screen.tsx:54-70,129-198,372-569`）。
- Viewer: clean stage、runtime-core playback、Original/Atlas Runtime source mode、parameter/variant controls、reset simulation、pan/zoom/fit/1:1（`viewer-runtime-screen.tsx:118-236,393-467,553-702`、`runtime-controls.tsx:212-290,370-417`）。
- Runtime Export: preflight、readiness/blockers、assemble、picked directory write（`runtime-export-task-screen.tsx:67-142,232-348`）。package-formatのexport contractはmanifest/model/atlas pathsとmaterialized graphを定義する（`packages/package-format/src/runtime-export.ts:53-60`）。

## 4. Current repository state

| 観点 | 現行repo fact | 状態の読み方 |
|---|---|---|
| Desktop host | Electron main/preload/renderer build scriptsが存在し、`electron:build`を実行できる（`apps/editor/package.json:8-17`） | build passは配布・UX受入ではない |
| Authoring shell | workspace gate、4-panel authoring、専用route群、PSD modalがsourceにある | route/UIの存在を確認 |
| Import boundary | PSD sourceはmetadata-only、explicit structural approval、raw parser/semantic inference/compositingなし | accepted boundaryであり未実装機能ではない |
| Canvas | evaluated scene/projection、mask、variant predicate、WebGL2 renderer pathがある | GPU/pixel/performance gateは未閉鎖 |
| Mesh/Rig/Keyforms | v6d default/v7 choice、Rotation/Warp、keyform binding/mutationがある | visual quality・Bezier runtime semanticsは別 gate |
| Dynamics | v3/worldFrameChainV1、fixed-step preview、複数output offsets | 旧scalar v2は現行ownerではない |
| Diagnostics | read-only warning/jump screen | stale route assertionがquality debt |
| Atlas/Variants | skyline single-page preview/apply、variant CRUD/membership/preview | pixel parity・UX judgementは未閉鎖 |
| Viewer | clean runtime stage、variant/parameter controls、runtime simulation reset | real rAF smoothness・device/external parity未検証 |
| Runtime Export | preflight→directory artifact write path | picked directory/external player parity未検証 |

Editor sourceには64 test files（E2E specを含む）、packagesには242 test filesが存在する（`rg --files` inventory）。

## 5. Accepted decisions and boundaries

- 製品基線は rights-clean/private-local な `Private 2D Rigging Lab / Prototype` であり、Cubism SDK/Core、`.moc3`/`.model3.json`互換、既存Cubism model解析、第三者素材の取り込みを目標にしない（`discussion/concept/modified_concept.md`、`discussion/acceptance-criteria/01_RootAcceptanceCriteria.md`）。
- Editor/repoは deterministic GUI/operation surfaceを正とし、semantic PSD recognition、repo proposal generation、LLM/provider埋込み、auto-rigging inferenceを提供しない（`discussion/development_convention/codex-friendly-automation-policy.md`）。
- operation-coreが編集操作のsource of truthで、reportsやdated Wave記録は実装・受入oracleではない。Editor mainline planningはWave102で停止し、W103–109はspecialized evidenceとして扱う（`discussion/implementation/_map.md`、`discussion/_map.md`）。
- Current dynamics semanticsはaccepted `dynamics-file-v3`/`worldFrameChainV1`。scalar v2/old additive pendulum記録は歴史的または追跡負債であり、現在仕様に読み替えない。
- PSDのraw bytesはmetadata-only、groupはPart container only、明示structural approvalが必要という境界はsource contractで固定されている（`psd-import-planner.ts:141-183`）。

## 6. Verification and experiment evidence

### Refreshで実行したもの

| Command | 結果 | 解釈 |
|---|---|---|
| `pnpm.cmd --filter @private-2d-rigging-lab/editor typecheck`（2026-08-08、scope=`apps/editor` tsconfig） | **FAIL**（exit 2）。端末に印字された`error TS`行は23本。これはこの実行のprinted-line countであり、diagnostics総数を別に正規化した値ではない。別実行を手集計した`21 diagnostics`（`07`）とは同じ尺度として比較しない | Editorの型品質負債（branded IDs、optional fields、projection/tests等）。能力の不存在を意味しない。 |
| `pnpm.cmd --filter @private-2d-rigging-lab/editor test:unit` | **62 files pass / 1 fail; 493 passed, 4 failed, 4 skipped (501 total)**。失敗は`diagnostics-jump-actions.test.ts` 4件で、旧期待`setActiveEntry("import")`と現sourceの`workspace`が不一致 | stale assertionの可能性を示すが、修正・受入は未実施 |
| focused Vitest: package-format/runtime-core/validator-core/authoring-coreの16 files | **211 tests pass** | export/dynamics/variant/atlas/mesh/validator契約の局所証拠 |
| `pnpm.cmd --filter @private-2d-rigging-lab/editor electron:build`（2026-08-08、scope=`apps/editor`、`electron-vite build`） | sandbox実行はesbuild `spawn EPERM`でexit 1。escalated rerunは**PASS**で、electron-viteが`main 9.53 kB`、`preload 1.24 kB`、`renderer 2,316 transformed modules`と出力 | これは当該commandの出力単位・丸めのmeasurement-specific値。別測定での`main 10`/`preload 3`表記とは同一尺度として比較せず、renderer bundle生成の局所証拠として扱う。型check/人間UX受入を閉じない |
| `rg --files apps/editor/src apps/editor/e2e` test inventory | 64 Editor test files | coverageの規模把握。全機能受入の主張ではない |

### Existing evidenceとして参照したもの

Wave66 Canvas、Wave85 Diagnostics、Wave92 Runtime Export、Wave99 Variants、Wave101 Skyline、Wave106 Dynamics v3等のmap/review/test記録を、実装の起点・意味論の変遷として参照した。これらのhistorical passは、現在の人間・GPU・device・rights acceptanceの完了証明には昇格していない。

## 7. Historical progression / turning points

以下は現行能力の根拠になった実装史であり、current truthではない。

| Wave/時期 | 変化（historical evidence） |
|---|---|
| W57–60 | Editor foundation、PSD import、Canvas、Parts/Structure treeの初期面を形成 |
| W61–66 | mesh/tool、rig/deformer、Canvas evaluation/maskの編集意味論を接続 |
| W67 | WebGL2 renderer pathを追加。後続のpixel/GPU gateは別に残った |
| W70–78 | v6d mesh、keyforms、rig hardening、batch/parent semanticsを拡張 |
| W84–85 | Viewer dynamics playbackとDiagnostics v0を追加 |
| W92 | Runtime Export task/package bridgeを追加 |
| W99–101 | Variantsとsingle-page skyline atlasを追加 |
| W102 | Editor mainline planning stop。以後のspecialized tracksは再開判断なしにmainlineへ統合しない |
| W106 | Dynamics v3/world-frame chainのaccepted implementation evidence |
| W108–109 | renderer/data contract・周辺統合のspecialized evidence |

## 8. Open gates, debts, and uncertainties

### Implementation/evidence debts

- Editor typecheck（2026-08-08、`apps/editor` tsconfig、exit 2）のprinted `error TS` 23行を解消または明示的に許容する必要がある。別実行のmanual `21 diagnostics`（`07`）は別集計であり、この23行と同じdiagnostic countとして扱わない。
- Diagnostics jump testの旧`import`期待と現`workspace` routeの整合を決める必要がある。
- Electron PSD E2Eはworkspace/native picker前提を含む stale/環境依存状態で、今回のunit/build結果だけでは閉じない。
- Canvasの実GPU/WebGL2 pixel parity、mask/clippingの実画像品質、Canvas2D sunset、mesh v6d/v7のquality holdは未検証。
- Warp Bezierは`storedNotEvaluatedV0`であり、runtime evaluationを追加するかどうかは別設計判断。

### Human / device / product gates

- 実端末でのViewer rAF smoothness、runtime dynamicsの継続・settle感、Original/Atlas source parity、外部playerとの一致。
- PSD importのpreview clarity、materialized texture/alphaの実画像確認、rights/provenance確認。
- Runtime Exportのpicked-directory UX、再読込、外部player/packagingでの互換確認。
- Atlas padding/extrusionとCanvas/Viewerのpixel parity、Variant membership UIの可読性。
- Demo-safe capture、disclaimer、rights-clean fixture、legal/permission判断。これらはコードpassだけでは完了しない。

### Uncertainties / decisions not made here

- old dynamics scalar wordingをAC/scenarioへどう追跡表示するか。
- v6d/v7 meshの最終quality ownerと切替時点。
- Canvas2D fallbackの寿命、GPU failure時のproduct behavior。
- Editor mainlineをW102後に再開するか（specialized W103–109の存在だけでは決めない）。

## 9. Candidate next work（推奨ではなく、事実から導ける候補）

1. 現行sourceをownerにしてEditor typecheckのprinted `error TS` 23行（別集計の21 diagnosticsとは尺度が異なる）とDiagnostics stale assertionを分類・修正する。
2. PSD/Electron E2Eのworkspace/native picker前提を再確認し、実端末でimport→materialized layer→Canvasを観測する。
3. GPU/WebGL2・mask・atlas・mesh v6d/v7のpixel/visual gateを、fake GL unitとは別の実画像手順で記録する。
4. ViewerのrAF/runtime dynamics、reset、Original/Atlas Runtime、Variantsを実ブラウザ/Electron環境で確認する。
5. Runtime Exportをpicked directoryから再読込し、外部player/packagingでのartifact parityを記録する。
6. Warp Bezierの`storedNotEvaluatedV0`を維持するか、runtime evaluationを設計するかを別途決定する。
7. Wave102 mainline stopとW103–109 specialized evidenceの扱いを、ユーザー判断後にmap/planへ反映する。

## 10. Evidence index

| Evidence | 種別 | 用途 |
|---|---|---|
| `apps/editor/src/workspace/authoring-workspace.tsx:25-102` | Current source | shell、route、panel構成 |
| `apps/editor/src/state/editor-ui-store.ts:3-11,27-40` | Current source | entry/tool unionとnavigation state |
| `apps/editor/src/features/psd-import/model/psd-import-planner.ts:39-46,48-61,115-153,193-213` | Current source | PSD cap、approval、persistence boundary、materialized bytes |
| `apps/editor/src/workspace/canvas/canvas-evaluation.ts:31-45,217-220,330-383` | Current source | evaluated mesh/deformer/visibility/mask |
| `apps/editor/src/workspace/canvas/canvas-projection.ts:193-235,349` | Current source | Canvas projection/variant predicate |
| `apps/editor/src/workspace/canvas/canvas-renderer.ts:77,248-287,853-906` | Current source | WebGL2/clipping/mesh draw path |
| `apps/editor/src/features/editor-session/model/session-tree.ts:18-109,125,262,395-439` | Current source | hierarchy/inspector/move/reparent |
| `apps/editor/src/features/editor-session/model/mesh-tool-state.ts:48-97` + `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:261-363` | Current source | mesh presets/v6d-v7/preview-apply |
| `apps/editor/src/features/editor-session/model/rig-tool-state.ts:21-47,188-377` + `packages/package-format/src/warp-deformer-contract.ts:16-21` | Current source/contract | rig authoring and Bezier evaluation boundary |
| `apps/editor/src/features/editor-session/model/parameter-keyform-state.ts:25-31,220-270,364-393` | Current source | parameter/keyform bindings and payloads |
| `apps/editor/src/features/editor-session/model/dynamics-tool-state.ts:9-37,474-735,801-873` + `packages/runtime-core/src/dynamics-evaluation.ts:13-26,262-299,378-412` | Current source | dynamics v3 preview/solver |
| `apps/editor/src/workspace/diagnostics/diagnostics-screen.tsx:25-166,221` | Current source | diagnostics projection/jump/details |
| `apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx:42-102,163-221` + `apps/editor/src/workspace/atlas/atlas-task-projection.ts:128-172` | Current source | atlas preview/apply/stale state |
| `apps/editor/src/workspace/variants/variant-manager-screen.tsx:54-70,129-198,372-569` | Current source | variant CRUD/membership/preview |
| `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:118-236,393-467,553-702` | Current source | clean Viewer/runtime playback/controls |
| `apps/editor/src/workspace/runtime-export/runtime-export-task-screen.tsx:52-142,232-348` + `packages/package-format/src/runtime-export.ts:53-60` | Current source/contract | preflight and directory export |
| `apps/editor/package.json:8-17`, `package.json:8-20` | Current scripts | typecheck/unit/build/check entrypoints |
| Refresh commands in §6 | Experiment result | current verification, with counts and failure modes |
| `discussion/implementation/_map.md`, `discussion/design/screen-design/_map.md`, `discussion/design/module-contracts/_map.md` | Historical/current map context | Wave owners, superseded wording, open gates |

## 11. Limitations

- Bounded refreshであり、全repo・全Wave・全source/testの再監査ではない。historical Waveは現行sourceの補助証拠としてのみ参照した。
- 実行したEditor unit/typecheckは品質負債を露呈したが、修正は依頼範囲外のため行っていない。focused package testsは局所契約の証拠であり、製品E2Eやhuman acceptanceを代替しない。
- Electron PSD E2E、実GPU/pixel、実端末Viewer、外部runtime player、rights/legal、demo captureはこのrefreshで実施していない。
- 共有worktreeでは並行テストにより`apps/editor/test-results`のtracked artifactが変更され得る。本reportはその変更を戻さず、source/mapへの変更を行っていない。
- 本reportは新しい製品判断、scope変更、Wave102 mainline再開、mesh/dynamicsのowner変更を決めていない。
