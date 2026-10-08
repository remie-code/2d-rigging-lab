# 生成素材を既存 Editor モデルへ追加・差し替えする入口の調査

調査日: 2026-09-25  
状態: 静的コード調査完了。実装案は未合意・未実装。実モデルへの書込み・画像生成・テスト実行は行っていない。

## 結論：今できること／追加開発が必要なこと

**素材から Drawable を作り、既存デフォーマへ所属させ、保存・再読込するための部品は既にある。一方、生成 PNG と配置指定を渡すだけで、これらを整合した一つの変更として実行する入口は、調べた現行 UI・CLI・Operation Core では確認できない。**

PSD import の内部をすべて新設する必要はない。ただし `importSplitPngSourceAsset` という名前を「PNG ファイルを開いて描画可能にする API」と受け取ってはいけない。現状は source / layer / texture preview / binary **参照メタデータ**の登録で、ファイルの読込、PNG デコード、RGBA バイトの session 登録とは別である。

| ケース | 既存手段でできる部分 | 判定と不足 |
|---|---|---|
| ① 既存パーツの同サイズ置換 | 登録済み texture へ `setDrawableTexture` で切替。Drawable ID、mesh、UV、keyform、deformer 所属はこの操作で変更されない | **整合した texture が既に登録済みなら既存操作で可能。新規生成 PNG からの一連処理には組合せ／入口開発が必要。** 同サイズだけでは十分でなく、content 領域・位置・padding と source/layer/provenance の一致も必要 |
| ② bbox / origin 拡張を伴う描き足し | 内部 texture upsert、UV 編集、mesh 頂点／三角形編集、mesh 置換という部品は存在 | **既存 rig を保つ自動的な拡張処理は未確認・機能不足。** texture だけ変えても描画領域は増えない。UV再計算、必要領域のmesh追加、keyformの対応、source bounds、deformer domain をまとめて扱う設計が必要 |
| ③ 新パーツ追加 | source import → createDrawable → mesh生成 → order/mask/bind → save/open の部品が存在 | **既存内部機能の組合せで構成可能と判断。専用入口は必要。** bytes intake、RGBA化、dimensions/contentInset、配置、所属を束ねる必要がある。既存モデルでの保存再読込成功を実証したわけではない |

特に重要な制約：**別 sourceAsset として生成画像を import し、既存 Drawable に `setDrawableTexture` するだけでは source/layer mapping が不一致になる。** Operation の commit が成功し得ることと、モデル全体の検証に通ることは別。validator は Drawable 側の sourceAsset / mapped sourceLayer と texture / preview 側の sourceAsset / sourceLayer の一致を確認する。

- [切替 mutation](../../../packages/authoring-core/src/drawable-texture-mutations.ts:20)
- [texture-source-layer 検証](../../../packages/validator-core/src/validators/texture-assets.ts:273)

したがって、「今のうちにできる」は、コードを再利用して入口を作れる見込みがある、という意味まで。**現APIに生成PNGを渡せば、既存rigを壊さず追加完了する状態ではない。**

## 調査基準・範囲

対象 repository: `C:/workspace/remie/code/ai-native-live2d-editor`  
HEAD: `a6bfc0429e642cd4c047f154d834cbd3c26ca72c`  
root package: `private-2d-rigging-lab@0.0.0`、`pnpm@10.12.1`。PSD dependency は `@webtoon/psd@0.4.0`。

作業開始時に dirty。変更済みには `.codex/agents/{gnome,sylph}.toml`、Soul cockpit scripts、discussion conventions / craft / expo / maps があり、reference-guided-rigging 文書群などは untracked。調査対象の packages / editor / authoring-host source には `git status --short` 上の変更表示はなかった。本レポートはその作業ツリーを読んだもの。HEAD のみの純粋な調査とは区別する。

祖先ディレクトリの AGENTS.md、および repository 内の hidden を含む AGENTS.md 検索では適用ファイルを検出しなかった。`discussion/_conventions.md` を読んだ。本レポートだけを新規作成し、地図更新は root 担当。他者の変更には触れていない。

ユーザー意図は、自然な形を素材不足へ合わせて歪める代わりに、必要と判断した画像を追加できること。対象は現行 Editor の editable model であり、現在の flat 試作 renderer 改造や生成画像の品質評価は範囲外。旧 Astra rig 結果は参照していない。

以下の source link は repository 内コードへの相対参照。行は調査時のもの。

## 1. PSD 登録の実経路

### 1.1 UI → parse / plan

1. [PSD import modal](../../../apps/editor/src/features/psd-import/components/psd-import-modal.tsx:81) が import を実行する。
2. [planner](../../../apps/editor/src/features/psd-import/model/psd-import-planner.ts:54) が browser PSD parser adapter を呼び、materialized layer を選び、group/leaf の scaffold と generated IDs、bounds、byte evidence を作る。leaf の bounds と IDs の構成は同ファイル 318 行付近。
3. [browser adapter](../../../apps/editor/src/editor-workflow/browser-psd-parser-adapter.ts:368) が layer の `composite(false, false)` から RGBA を得る。
4. RGBA には透明な縁を追加し、その後の byteLength / width / height / digest を計算する。実バイトの保存先は `assets/textures/psd/<token>/<layer>.raw-rgba`。stage bounds は content 範囲のまま、raster dimensions は padding 込み、両者を `contentInset` が結ぶ。

**PNG を PSD に詰め直すことが唯一の道ではない。** この「画像を decoded raster とメタデータへ変換する境界」を汎用画像用に持てば、その先の model 部品を再利用できる。

### 1.2 commit → graph / bytes

[commitPsdImportPlan](../../../apps/editor/src/features/psd-import/model/psd-import-commit.ts:29) は元 session を clone してから、

- `importPsdSourceAsset`：source metadata / provenance 等
- `importPsdStructuralScaffold`：group Parts と leaf materials
- `registerAuthoringSessionBinaryBytes`：画像の実バイト登録

を行い、新 session を返す。**metadata 操作の後、別途 bytes を登録している**のが重要。

[structural scaffold](../../../packages/operation-core/src/operations/import-psd-structural-scaffold.ts:149) は clone 上で Parts を作り、leaf ごとに `importPsdLayerMaterialization` を実行する。成功時だけ session を置き換える経路がある。

[layer materialization](../../../packages/operation-core/src/operations/import-psd-layer-materialization.ts:243) は、

- texture entry：filePath、dimensions、contentInset、source/layer/provenance、binaryAssetRef
- texture preview reference
- Drawable：part、source、texture、mesh、opacity、visibility、order
- **manual-empty mesh**
- sourceLayer → mappedDrawableIds

を作る。初期 mesh は完成した三角形メッシュではない。[empty mesh](../../../packages/authoring-core/src/mesh-generation.ts:955) は vertices / UV / triangles が空である。

### 1.3 UI history → 保存

[Editor の commitPsdImport](../../../apps/editor/src/features/editor-session/editor-session-context.tsx:1124) は before / after session を一つの `Import PSD` history として記録し、表示 state を更新して workspace に保存する。

この実装を模範にするなら、生成素材追加でも「画像登録だけ成功し、Drawable 作成が失敗した」ような半端な状態をユーザーへ出さず、完成候補 session を切り替える構成を再利用できる。

## 2. 既存 API / 呼出面と、その限界

### 2.1 外から呼べる operation

[OperationPayloadSchema](../../../packages/operation-core/src/operation-payload.ts:81) に次が登録されている。

- `importSplitPngSourceAsset`
- `createDrawable` / `setDrawableTexture` / `setDrawablePart`
- `generateMesh`、頂点／三角形／UV 操作
- `bindRigControlChild` / `moveDrawableRigControlBinding`
- `moveStructureChild` / `setDrawOrder` / `setMaskRelation`
- `applyTextureAtlasPreview`

[AI command payload](../../../packages/ai-interface/src/ai-command-payload.ts:26) は OperationRequest を `dryRunOperation` / `commitOperation` の payload として受ける。commit には approvedDryRunCommandId が必要。

[authoring-host CLI](../../../apps/authoring-host/src/cli.ts:27) → [runAuthoringHostCommand](../../../apps/authoring-host/src/run-authoring-host-command.ts:50) → AiCommandExecutor → [AuthoringHostCommandHost](../../../apps/authoring-host/src/authoring-host-command-host.ts:42) → Operation Core の経路が存在する。host は package directory を読み、成功した commit のみ保存する。

これは **ファイル上の package を開く headless host**。開いている Editor の in-memory session へ即時反映する HTTP upload API と同一ではない。調べた現行 Editor source では、この素材 intake を行う live AI command bridge は見つからなかった。CLI で変更するなら Editor 側の未保存編集との競合を避け、再読込する運用または session bridge が別に必要。

### 2.2 Split PNG operation は metadata intake

[payload schema](../../../packages/operation-core/src/payloads/import-source.ts:384) は layer ごとに imagePath、bounds、texturePreviewReference、texturePreviewBinaryAssetRef、textureId、targetPartId を受ける。全体に placementPolicy、rights、provenance がある。

[実装](../../../packages/operation-core/src/operations/import-split-png-source-asset.ts:108) は source metadata と texture metadata を作る。**PNG decode / filesystem read / bytes register はしない。** [texture materializer](../../../packages/operation-core/src/operations/import-split-png-source-asset-texture.ts:135) が作る texture entry にも `dimensions` / `contentInset` を渡す現在の schema field はない。

同 operation は新規 source ID / texture ID を前提とし、既存 ID は拒否する。既存 source の layer へ新textureだけを追加する汎用 operation としては使えない。

内部の [upsertTexturePreviewAssetMetadata](../../../packages/authoring-core/src/texture-asset-mutations.ts:20) は既存sourceに対して利用でき、dimensions/contentInset を含む entry を扱えるが、これは authoring-core の関数。PNG file を受ける専用 UI/CLI command ではない。

### 2.3 実バイトと画像形式

[registerAuthoringSessionBinaryBytes](../../../packages/authoring-core/src/binary-byte-registration.ts:40) は fileEntries と binaryAssetIndex にバイトを登録する。sourceAsset / texture / provenance / rights 等の参照を持てる。この関数単体は package revision を進める Operation ではない。

現行描画系では、圧縮された PNG ファイルをそのまま raw texture として渡せない。

- [Editor renderability](../../../apps/editor/src/workspace/canvas/canvas-projection.ts:698)：`byteLength === renderWidth * renderHeight * 4`。
- [Editor寸法解決](../../../apps/editor/src/workspace/canvas/canvas-projection.ts:401)：declared raster dimensions を優先、なければ sourceLayer / mesh bounds に fallback。
- [headless texture解決](../../../apps/authoring-host/src/perception/texture-resolution.ts:177)：declared dimensions または検証付きbounds由来寸法と raw byte長を照合。
- [mesh生成の画像解決](../../../packages/authoring-core/src/mesh-generation.ts:2454)：session 内 raw bytes を取り、contentInset がある場合は padding を除去して alpha-aware generation へ渡す。

新しい入口には PNG → RGBA8 decode、alphaの保持、寸法、contentInset、digest、binary refs の整合が必要。古い deterministic data URL の metadata test が存在することだけで、現行canvas/atlas/exportまでPNG直渡し対応済みとは判断しない。

## 3. 同サイズ差し替え：何が保たれ、何が自動ではないか

[setDrawableTexture](../../../packages/authoring-core/src/drawable-texture-mutations.ts:20) は存在確認後、`drawable.textureId` のみを変更する。revision / dirty 更新はあるが、mesh / UV / source mapping / deformer / keyform には触れない。

したがって、**同じ領域・同じ座標対応を持つ texture を正しく登録できれば、既存 rig をそのまま利用できる**。しかし以下を揃える必要がある。

1. 元と新の content 座標が一致する。ピクセル数一致だけでなく、元絵のどの位置に何が描かれるかも維持する。
2. padding込みの寸法だけでなく contentInset を揃える。余白追加を内容の拡張と混同しない。
3. source/layer/provenance の整合を保つ。
4. 描き足した alpha 領域が既存 mesh の三角形に覆われている。alpha が拡張された場所に mesh がなければ描画は増えない。
5. 同textureを複数Drawableが共有している場合の影響範囲を把握する。

**source mismatch の具体例**：

- 元 Drawable: sourceAsset = PSD A、mapped layer = neck。
- 生成 PNG を sourceAsset B の layer patch として登録。
- textureId だけ B の texture に切替。

この場合、元 Drawable は A / neck のまま。validator の [texture-assets.ts:298](../../../packages/validator-core/src/validators/texture-assets.ts:298) は一致しないと判定する。`setDrawableTexture` 自身の precondition は Drawable / texture の存在、lock、no-op 等であり、この横断的な移行をしない。

候補は二つある（未合意）。

- 元の論理 source/layer に対する派生 texture として新バイト・生成由来を記録する。
- 新 source/layer へ Drawable の source/provenance と mappedDrawableIds を一緒に移す。

どちらでも生成履歴をPSDの未加工素材として偽装しない。現行 `updateDrawable` は displayName / opacity の変更であり、source移行専用operationではない。旧textureを残して新IDへ切り替える方が、比較・取消し・共有texture保全を設計しやすい。

## 4. bbox / origin を広げる描き足し

例：首 texture の上側へ描き足して content の y / height が変わる。

### 4.1 画像と geometry は独立

texture切替は mesh を広げない。sourceLayer.bounds だけの変更でも既存三角形は増えない。反対に同じ UV 0..1 に縦長画像を貼るだけだと、元の首全体が古い mesh の範囲へ詰められる。

位置を保つ考え方として、旧content矩形を `(x0,y0,w0,h0)`、新を `(x1,y1,w1,h1)` とすると、同一ピクセル密度・軸平行配置の場合、旧UVが参照したcontent位置を新UVへ移す式は、

```text
u1 = (x0 + u0*w0 - x1) / w1
v1 = (y0 + v0*h0 - y1) / h1
```

となる。これは設計用の説明であり、実行していない。既存UVの意味、contentInset、既存の独自UV編集を確認して適用する必要がある。生成画像のスケールが変わる場合は追加の座標対応が要る。

### 4.2 mesh / keyform の危険

[generateMesh](../../../packages/operation-core/src/operations/generate-mesh.ts:159) は生成meshを [replaceDrawableMesh](../../../packages/authoring-core/src/mesh-mutations.ts:37) へ渡す。この関数は mesh を置き換えるが、全既存 keyform を新 topology へ移植する処理ではない。

[mesh topology mutations](../../../packages/authoring-core/src/mesh-topology-mutations.ts:106) には頂点追加／削除、三角形操作、UV操作がある。bounds と topologyRevision を更新する。しかしこの実装から、既存の全mesh keyformの自動補間移行は確認できない。

[mesh keyform適用](../../../packages/runtime-core/src/keyform-target-application.ts:161) は頂点配列を replace し、additiveDelta では基底とpatchの頂点数一致を要求する。**頂点数や順序を変えても旧keyformが有効だ、と考えてはいけない。** 頂点数が同じでも意味の対応が違えば破綻する。

既存 rig を保つための条件：

- Drawable / mesh / vertex の identity と対応を維持できるか確認する。
- 既存meshに直接keyformがあるなら、新頂点の各keyでの姿勢をどう求めるか決める。
- deformerだけにkeyformがある場合でも、新頂点が適切なdomain内に入り、期待の形になるか全姿勢を確認する。
- domainを広げると既存点の正規化位置も変わる可能性があるため、単純拡張を無害扱いしない。
- source bounds、texture dimensions/contentInset、UV、mesh、mask の整合をまとめて更新する。

別Drawableとして補足部分を足す案は、既存mesh topologyを保ちやすい。ただし境界の継ぎ目、重なり、alpha、両者の運動を別に整える必要がある。「必ず別パーツ化する」という決定ではない。

## 5. 新パーツ追加に必要な情報と既存部品

### 5.1 source → Drawable → mesh

[createDrawable](../../../packages/operation-core/src/operations/create-drawable.ts:75) は displayName由来のDrawable ID / mesh IDを生成し、sourceAsset / sourceLayer / texture / Part / initialBoundsを受ける。[bounds解決](../../../packages/operation-core/src/operations/create-drawable.ts:216) は明示 initialBounds、sourceLayer bounds、fallback の順。名前衝突に注意する。

[createDrawableWithMesh](../../../packages/authoring-core/src/drawable-mutations.ts:31) は graph.drawables / meshes、Part children、source mappedDrawableIds、drawOrder、stable orderへ追加する。既存Drawableを再生成する必要はない。

ただし作成直後はmanual-empty mesh。通常のriggingで使う三角形meshを `generateMesh` 等で与える必要がある。空meshのEditor表示ができてもruntime用メッシュ完成とは扱わない。

### 5.2 描画順・mask・運動所属

- **Part所属とdeformer所属は別**。`partId`を首と同じグループにするだけで首のFace-Xに追従するとは限らない。
- [bindRigControlChild payload](../../../packages/operation-core/src/payloads/rig-control.ts:84)：parentRigControlId と drawable childを指定できる。[mutation](../../../packages/authoring-core/src/rig-control-mutations.ts:277) が親のchildへ結びつける。
- 既存所属の移動用に `moveDrawableRigControlBinding` がある。付け替えと追加を混同しない。
- [setMaskRelation](../../../packages/operation-core/src/payloads/model-edit.ts:512)：mask側Drawableとtarget側Drawableを指定する。画像自身のalphaとは別の構造。
- [moveStructureChild](../../../packages/operation-core/src/payloads/model-edit.ts:119)：Part内・他要素の前後という挿入位置を指定できる。
- `setDrawOrder` もあるが、runtime描画順は [Part order のflatten](../../../packages/authoring-core/src/runtime-graph-drawables.ts:52) に基づく。整数のbaseDrawOrderだけを書けばよいとはしない。

追加受付の最小入力候補は、画像、contentのcanvas矩形、既存Part、挿入位置、deformer ID、mask関係、visibility/variant方針、生成由来。生成結果がすでに「中間姿勢」の画像なら、それをneutral素材に直接扱うと二重変形になる可能性がある。**素材の基準姿勢／座標系**も明示する必要がある。これはAPI以前に制作側が決める情報である。

## 6. 永続化・undo・atlas・export

### 保存／再読込

[workspace-save](../../../packages/authoring-core/src/workspace-save.ts:28) は sessionからPackageDocumentを作り、sessionのbinary entriesも保存planへ渡す。

[package-directory-io](../../../apps/authoring-host/src/package-directory-io.ts:42) は同じpackage形式を開き、binary registration targetsに対応する実ファイルを読み、hydrateする。saveはtextとbinary decisionsを処理する（同ファイル104行付近）。

新PNGをディレクトリへ置くだけでは、読込対象の参照がなくsessionに入らない。参照だけ作ってbytes登録せず「保存できた」とするのも不足。CLIは読込時点の登録対象をhydrateするため、後続operationで初めて追加された参照を自動で外部ファイルから取り込むAPIとはならない。

既存のファイル書込みループは複数ファイルを順次書く実装なので、OS障害まで含むtransactionalな原子保存を保証しているとは述べない。

### revision／history

[precondition](../../../packages/operation-core/src/preconditions.ts:52) はbasePackageRevision一致を確認し、[commit lifecycle](../../../packages/operation-core/src/lifecycle/commit.ts:76) はcommitted package revisionを増やしoperation logを持つ。bytes登録の内部関数だけ呼んでも、このlifecycleは自動で通らない。

[Editor history](../../../apps/editor/src/features/editor-session/model/editor-session-history.ts:63) はbefore/after sessionを保存しundo/redoする。PSD import UIのように素材追加全体を一historyへ束ねるのが再利用候補。CLIでcommitした変更が、既に開いているEditorのundo stackへ自動追加されるとは確認していない。

### atlas／runtime export

source画像やmeshを変えた後、以前のatlasをそのまま正しいものとして使わない。[source signature](../../../packages/authoring-core/src/texture-atlas-source-signature.ts:64) はDrawable、mesh/UV、texture metadata、bytes fingerprintを含む。

[runtime export assembly](../../../packages/authoring-core/src/runtime-export-assembly.ts:213) はsignature欠落・不一致を検出する。追加/差し替え後はatlas再構築・applyとruntime exportの再生成が必要になる。

[export materialization](../../../packages/authoring-core/src/runtime-export-materialization.ts:174) はsource mesh UVをatlasへ写す。したがってEditor canvasで見えたことだけで、Viewer atlas mode / runtime exportまで完了とはしない。maskに関係するDrawableがexport対象から除外されていないかも確認が必要。

## 7. 既存テストから読める範囲

本調査では以下を読んだが、実行していない。

- [import-split-png-source-asset.test.ts:38](../../../packages/operation-core/src/operations/import-split-png-source-asset.test.ts:38)：dry-run無変更、metadata commit、binary refsを未検証metadataとして扱うこと、ID衝突等。
- [drawable-part-texture-operations.test.ts:61](../../../packages/operation-core/src/operations/drawable-part-texture-operations.test.ts:61)：texture割当後のrevision、diff、package document反映。生成PNGからのintakeや既存rigの視覚保全の証明ではない。
- [node-fs-backed-directory-roundtrip.test.ts:62](../../../apps/editor/src/features/workspace-storage/model/node-fs-backed-directory-roundtrip.test.ts:62)：textureを含むworkspaceの保存・再読込とbinary hydration。
- [keyform-target-application.ts:191](../../../packages/runtime-core/src/keyform-target-application.ts:191)：頂点数不一致時の扱いはsourceで確認。今回のneck拡張の移行成功を示すテストではない。

## 8. 最小変更案（提案・未合意）

共通の「生成素材intake」サービスを一つ設け、GUIとheadlessの呼出面をその薄いadapterにする案が最も再利用しやすい。PSD parserを偽装してgenerated画像を流すより、source/layerとrasterの共通部分を使う。

### 第一段階：新規追加と厳密な同領域置換

1. **読込・preview**：画像decode、RGBA8化、寸法/contentInset/hash、canvas placement、基準姿勢、alpha確認、変更対象一覧。
2. **整合計画**：新規／差し替えを明示し、source/layer/provenanceの関連を確定。既存metadata・IDs・rigをsnapshotし、同領域置換ではmesh/UVに触らないことを検証する。
3. **候補sessionで実行**：既存core mutation/operation、bytes登録を組み合わせる。新規ならmesh/order/mask/deformer bindingを付ける。差し替えならmappingを保つ派生texture案かsource移行案のどちらかを明示して実装する。
4. **一つの変更として確定**：revision、operation記録、Editor history、保存planを揃える。途中失敗で元sessionへ部分変更を残さない。
5. **再読込と画像確認**：保存packageを新しく開いて表示、既存パラメータ姿勢、mask、atlas再生成、exportを確認する。

既存APIがあるからこのサービスが不要、とは言えない。一方、rendererやrig graphの新しい概念を導入する必要があるとも言えない。

### 第二段階：content拡張の移行

①同一領域置換と③新規追加が成立してから、②を独立モードとして扱う案。旧/新矩形、保持すべき旧画像位置、既存mesh/keyform一覧、新領域へのmesh追加、deformer domain、maskをpreviewし、**単純resizeとrig保全の移行を区別する**。

最小試作では、既存meshを変更しない別補足Drawable追加から試す選択肢もある。実際の首に最適かはrootの造形判断であり、この調査から決定しない。

## 9. 未検証・次の確認事項

- 実際のモデルpackageに対する追加、同領域置換、保存再読込、全keyの描画比較は未実施。
- 実行中Editorのworkspaceとheadless packageを同時更新する同期・競合方針は未検証。
- 生成画像のdecode実装選択、色管理、alpha境界品質は未選定。
- source派生として記録するか、sourceを移すかは未決。validatorを緩めてごまかす案は採らない。
- bbox拡張時のmesh/keyform移行は、既存rigの形式を読んで設計する必要がある。任意の全rigを自動保全できると断言しない。
- 本調査の否定的所見は、示した現行schema/callpathの範囲。「repository内のすべての非公開関数に代替策が絶対にない」と証明したものではない。
- 構造検証や保存成功は自然な見た目の合格ではない。rootの画像確認とユーザーの判断を別に残す。
