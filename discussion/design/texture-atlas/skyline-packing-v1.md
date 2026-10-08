# Texture Atlas Skyline Packing v1

> 状態: Accepted implementation target。
> 最終更新: 2026-06-24。

## 1. 目的

`single-page-skyline-v1` は、Texture Atlasの自動配置を、現行の単純なshelf配置より隙間の少ないものへ改善するための新しいpacking algorithmである。

狙いは、各Drawableの矩形サイズを考慮し、過去rowの余りや穴をある程度再利用しながら、deterministicでtestしやすいsingle-page packingを実現することである。

この文書は、Texture Atlas Taskの画面仕様ではなく、packing algorithmの設計方針を記録する。画面UXは [../screen-design/screens/texture-atlas-task.md](../screen-design/screens/texture-atlas-task.md) を参照する。

## 2. 現行実装の事実

現行の主要実装:

- `packages/authoring-core/src/texture-atlas-targets.ts`
- `packages/authoring-core/src/texture-atlas-packing.ts`
- `packages/authoring-core/src/texture-atlas-binary.ts`
- `packages/authoring-core/src/texture-atlas-mutations.ts`
- `apps/editor/src/workspace/viewer/viewer-render-source.ts`
- `packages/authoring-core/src/runtime-export-assembly.ts`
- `packages/authoring-core/src/runtime-export-materialization.ts`

現行algorithm:

- algorithm idは `single-page-shelf-v1`。
- single-pageのみ。
- draw order由来のtarget順に、左から右へ並べる。
- 入らなければ次rowへ進む。
- row heightは、そのrowで最大の配置高さになる。
- 既存rowの余りや穴は再利用しない。
- rotation、multi-page、guillotine、skyline、MaxRectsはない。

現行配置サイズ:

- 各Drawableの配置content sizeは `Math.round(mesh.bounds.width)` / `Math.round(mesh.bounds.height)`。
- 配置時は左右上下に `paddingPixels` を足したpadded rectを使う。
- `sourceRectPixels` は常にtexture全体を指す。
- alpha boundsや透明余白trimは行わない。
- edge extrusionはpadding領域内へコピーするだけで、packing sizeを増やさない。

現行方式で隙間が出やすい理由:

- サイズ順ではなくdraw order順で詰める。
- 背の高い矩形がrow heightを決め、小さい矩形の上下が空く。
- row右側の余りを後続の小さいDrawableで再利用しない。
- 過去rowの穴を再利用しない。
- 透明余白込みのmesh bounds全体を詰める。
- page sizeが大きめ固定寄りで、詰まりの悪さが見えやすい。

## 3. 採用判断

次の開発対象では、Skyline方式を新algorithmとして追加する。

採用する:

- algorithm id: `single-page-skyline-v1`。
- single-page packing。
- size-aware deterministic ordering。
- skyline bottom-left / best-fit系の候補選択。
- paddingとedge extrusionの既存意味論。
- existing target extraction。
- existing artifact-only Apply behavior。

採用しない:

- alpha / transparent trim。
- rotation。
- multi-page atlas。
- manual rect placement。
- user-facing packing algorithm selector。
- Texture Atlas target extractionの変更。
- Texture Atlas membership / Variant / visibility policyの変更。

理由:

- alpha trimは効果が大きい可能性があるが、`sourceRectPixels` とViewer / Runtime Export UV remapの更新が必要になる。
- rotationはUV mappingとpreview/debugの複雑度が上がる。
- MaxRects / guillotineは効果が大きいが、初回改善としては実装とテストの重さが勝ちやすい。
- Skylineは効果、実装難度、determinism、既存schema適合性のバランスがよい。

## 4. 対象抽出は変えない

Skyline v1はpacking algorithmの変更であり、Texture Atlas対象抽出は変えない。

維持する対象基準:

- `selectTextureAtlasTargets()` を共通オラクルにする。
- rigControl graphに所属するDrawableを対象にする。
- Drawable Pool上の未所属Drawableは除外する。
- `runtimeVisibility=false` のDrawableも、runtimeで表示され得るため対象に含める。
- editor hidden Part配下のDrawableも、runtimeで表示され得るため対象に含める。
- Variant対象Drawableも、rig-boundであれば対象に含める。
- mesh / texture / bytesが欠けるDrawableはwarning付きでpackable=falseにする。

## 5. 配置入力

各packable targetから、次の矩形を作る。

```text
contentWidth  = round(mesh.bounds.width)
contentHeight = round(mesh.bounds.height)
packedWidth   = contentWidth  + paddingPixels * 2
packedHeight  = contentHeight + paddingPixels * 2
```

条件:

- `contentWidth > 0`。
- `contentHeight > 0`。
- `packedWidth <= pageWidth`。
- `packedHeight <= pageHeight`。
- raw RGBA byte length validationは既存条件を維持する。

content rect:

```text
contentRect.x = placedPaddedRect.x + paddingPixels
contentRect.y = placedPaddedRect.y + paddingPixels
contentRect.width = contentWidth
contentRect.height = contentHeight
```

edge extrusion:

- packing sizeには影響しない。
- 既存どおりpadding領域内へ最大extrusion pixelぶんコピーする。

## 6. 配置順

Skyline v1では、draw order順ではなく、サイズを考慮したdeterministic orderで配置する。

推奨sort:

1. `packedArea` 降順。
2. `max(packedWidth, packedHeight)` 降順。
3. `packedHeight` 降順。
4. `packedWidth` 降順。
5. 既存target stable order。
6. `drawableId` 昇順。

意図:

- 大きい矩形を先に置き、後続の小さい矩形で隙間を埋めやすくする。
- 同じ入力なら常に同じlayoutにする。
- draw orderは描画順の意味であり、texture atlasのpacking順とは分離する。

## 7. Skyline配置アルゴリズム

Skylineは、page内の「現在埋まっている領域の上端」をx方向の区間として管理する。

初期状態:

```text
skyline = [
  { x: 0, y: 0, width: pageWidth }
]
```

各矩形について、全skyline nodeを候補として走査する。

候補評価:

1. node.xを矩形左端候補とする。
2. `node.x + packedWidth <= pageWidth` を満たさなければ無効。
3. 矩形が覆うx範囲に含まれるskyline区間の最大yを `candidateY` とする。
4. `candidateY + packedHeight <= pageHeight` を満たさなければ無効。
5. 候補の評価値を計算する。

候補のtie-break:

1. `candidateY + packedHeight` が小さいもの。
2. `candidateY` が小さいもの。
3. 覆うskyline span内の水平余りが小さいもの。
4. `candidateX` が小さいもの。
5. 元のstable target orderが小さいもの。

配置:

```text
placedPaddedRect = {
  x: candidateX,
  y: candidateY,
  width: packedWidth,
  height: packedHeight
}
```

skyline更新:

1. 配置矩形の上端として `{ x, y: y + packedHeight, width: packedWidth }` を挿入する。
2. 配置矩形に覆われる既存nodeを削除または左右にtrimする。
3. 隣接していて同じyを持つnodeをmergeする。
4. nodeはx昇順に保つ。

失敗:

- どの候補にも置けない場合、現行と同じく `atlas.pack.cannotFit` 相当のpreview failureにする。
- 自動でpage sizeを変更しない。
- 自動でmulti-pageへ逃がさない。

## 8. Artifact / Signature

Skyline v1は新algorithmであり、layout summaryやsource signatureにalgorithm identityを含める。

要求:

- 新規layoutは `single-page-skyline-v1` として記録する。
- 旧 `single-page-shelf-v1` layout artifactは、読み取り不能にしない。
- algorithm idが変わった場合、既存atlas artifactはstale扱いになってよい。
- Apply時は、previewと同じsettings / algorithm / source signatureで再生成されることを検証する。

非要求:

- 旧layoutを新algorithmへ自動移行しない。
- ユーザーにpacking algorithmを選ばせない。

## 9. Preview / Apply / Viewer / Runtime Export

Preview:

- Skyline v1でlayoutを生成する。
- Preview UI上では、従来通りpacked rect、usage、padding、warningsを表示する。
- Skyline内部traceは通常表示しない。

Apply:

- generated atlas texture entry、layout summary、source signature、placements、raw RGBA bytesをcommitする。
- authoring `Drawable.textureId`、`Mesh.uvs`、topology revisionは変更しない。
- original texture / original UVは保持する。

Viewer:

- `Original` は従来通りoriginal texture / UVを使う。
- `Atlas Runtime` はcommitted atlas artifactを使い、Viewer projectionだけをremapする。
- Skyline v1導入では `sourceRectPixels` の意味を変えないため、Viewer remapの大規模変更は不要なはずである。

Runtime Export:

- committed atlas artifactからruntime atlasをmaterializeする。
- runtime modelのatlas UV semanticsは維持する。
- Skyline v1によるplacement変更はRuntime Exportの入力layoutとして扱う。

## 10. Tests / Verification

必須テスト:

- mixed-size rectanglesで、non-overlapである。
- すべてのplaced rectがpage内に収まる。
- 同じ入力から同じlayoutが生成される。
- padding込みrectとcontent rectが正しく計算される。
- edge extrusionの既存挙動が壊れない。
- 収まらないtargetはdeterministicにcannotFitになる。
- 旧 `single-page-shelf-v1` artifactの読み取り互換が壊れない。
- algorithm idがsource signature / stale判定に反映される。
- PreviewとApplyの再生成一致検証が働く。
- Viewer `Atlas Runtime` がSkyline v1 layoutを使って表示できる。
- Runtime ExportがSkyline v1 layoutをmaterializeできる。

推奨テスト:

- 現行shelfで隙間が出やすいmixed-size fixtureに対し、Skyline v1の使用面積またはbounding usageが改善する。
- サイズが同じ矩形群でstable order tie-breakが効く。
- 細長い矩形と大きい矩形の混在でも穴を再利用できる。

避けるべきテスト:

- 大量のexact coordinate snapshotだけに依存するテスト。
- algorithm改善時に不要に壊れる脆いsnapshot。

## 11. Future Scope

Skyline v1後に検討する候補:

- Alpha / transparent trim。
- `sourceRectPixels` を使った実source rect cropping。
- rotation packing。
- multi-page atlas。
- Auto page size shrink / fit。
- atlas usage metricの改善。例: content usageとpacked usageの併記。

これらは、Skyline v1の範囲には含めない。

## 12. 未決事項

- 実装時に、`single-page-skyline-v1` を既存UIの唯一defaultにするか、内部fallbackとして旧shelfを残すか。
- page sizeをAuto shrinkさせるかどうか。Skyline v1では扱わない想定だが、後続UXとしては有用な可能性がある。
- 使用率の表示をcontent面積基準のままにするか、packing効率を示す補助metricを追加するか。
