# Mesh Image Rendering Architecture

> Draft architecture basis。Mesh内画像描画をCanvas2D実装の延長ではなく、Editor Preview / Viewerで共有されるrendering contractとして定義する。

## 1. 目的

Private 2D Rigging Labでは、PSD由来のDrawable画像をmesh、deformer、parameter、clipping、opacity、draw orderに従って描画する必要がある。

現在のCanvas2D triangle描画は、meshを三角形ごとに `clip()` して `drawImage()` する暫定実装である。この方式では、隣接三角形の共有辺に白線、欠け、二重合成、半透明境界のにじみが出る可能性がある。

この文書の目的は、現状実装を正本にせず、あるべきMesh Image Renderingの契約、技術スタック、texture preparation、Canvas2D撤退条件を定義することである。

## 2. Accepted Decisions

- Primary rendererはWebGL2とする。
- Editor PreviewとViewerは同じrenderer contractを共有する。
- RendererはEditor UIや `AuthoringSession` を直接読まない。
- `RenderScene` の詳細型は実装時にノームが決めてよいが、不変条件は本文書で固定する。
- Texture PreparationはPSD import専用処理にもWebGL2 backendにも閉じ込めず、renderer共通の前処理層として扱う。
- Mesh UVはlayer-local UVを正とする。atlas物理UVは保存データやmesh生成結果へ混ぜない。
- Canvas2D rendererは短期移行足場であり、WebGL2が基本描画要件を満たした時点でStage主描画から撤退する。

## 3. Non-Goals

- Cubism renderer互換を主張すること。
- Photoshop flatten結果のpixel-perfect再現。
- WebGPUを初期primaryにすること。
- Three.js / PixiJSなどの高レベルrendering libraryを前提にすること。
- Canvas2D triangle rendererを長期的に育てること。
- blend mode完全対応、layer effects、smart object、vector maskの同時実装。

## 4. Rendering Contract

Meshは画像を分割して見せるためのものではなく、画像変形のための幾何情報である。

Rendererは次の契約を満たす必要がある。

- 変形していない状態では、mesh有無で見た目が一致する。
- 変形している状態でも、三角形境界は表示結果に現れない。
- 隣接三角形の共有辺はwatertightに描画される。
- 共有辺に隙間が出ない。
- 共有辺の二重描画で濃くならない。
- 半透明境界や低alpha領域で白線・黒線・不自然な色にじみが出にくい。
- draw order、opacity、visibility、basic clippingはEditor PreviewとViewerで同じ意味になる。
- mesh生成アルゴリズムに依存しすぎない。V4で形状品質が上がっても、renderer contractが崩れていれば失敗とみなす。

## 5. Target Architecture

目指す構造:

```text
Authoring Model / Runtime State
  -> RenderScene Builder
  -> RenderScene
  -> Renderer Backend Interface
       -> WebGL2 Renderer
       -> Canvas2D temporary fallback / debug only
  -> Presentation Surface
       -> Editor Preview
       -> Viewer
```

重要なのは、画面上の表示領域がCanvas要素であっても、設計上の主語をCanvas2D実装にしないことである。Presentation SurfaceはEditor PreviewでもViewerでもよく、renderer contractは共有される。

## 6. RenderScene Invariants

`RenderScene` の詳細型名、ファイル分割、DTO表現は実装時に決めてよい。ただし次の不変条件は固定する。

- Rendererは `AuthoringSession` を直接読まない。
- Editor PreviewとViewerは同じ `RenderScene` 系入力を渡す。
- `RenderScene` は描画専用構造であり、編集UIの状態を直接持たない。
- Drawableごとに、少なくとも次の描画情報を表現できる。
  - texture reference。
  - evaluated mesh vertices。
  - layer-local UV。
  - opacity。
  - draw order。
  - visibility。
  - clipping relationship。
- 座標系を明示する。
  - model / stage space。
  - drawable local space。
  - layer-local texture UV。
  - physical texture / atlas UV。
- Mesh UVはlayer-local `0..1` を正とする。
- atlas化、standalone texture、texture repackingは `TextureAllocation` 側で吸収し、meshデータを作り直さない。
- RenderSceneはdeterministicに作れる。

## 7. Package Direction

推奨package構成:

```text
packages/render-core
  - RenderScene / RenderDrawable concepts
  - Mesh + UV + texture ref contract
  - draw order / opacity / visibility / clipping contract
  - renderer backend interface

packages/render-webgl2
  - WebGL2 renderer implementation
  - shader programs
  - texture upload / cache / resource lifetime
  - mesh draw
  - clipping / composition implementation

apps/editor
  - AuthoringSession / editor transient state -> RenderScene
  - Stage UI / toolbar / interaction / overlay

apps/viewer
  - Runtime state -> RenderScene
  - Viewer UI
```

EditorとViewerはrendererを所有しない。どちらも `RenderScene` を作り、共有backendへ渡す。

## 8. Texture Preparation

Texture Preparationは、PSD import結果とWebGL2 texture uploadの間に置く。

```text
Layer Raster Asset
  -> Normalized Texture Source
  -> Render Texture Allocation
  -> WebGL2 Texture
```

### 8.1 Layer Raster Asset

PSD importや将来の素材importが作る素材情報。

- layer画像。
- layer bounds。
- source opacity。
- clipping metadata。
- hidden / visible state。
- provenance。

ここではGPU都合を持たない。atlas rect、WebGL texture id、shader都合を混ぜない。

### 8.2 Normalized Texture Source

Rendererへ渡す前の正規化済み画像素材。

ここで扱うもの:

- alpha edge padding。
- color dilation。
- premultiplied alpha方針。
- transparent / low-alpha edgeのRGB補正。
- image orientation / pixel format normalization。

白線や境界にじみは、WebGL2だけでなくtexture source品質にも依存するため、この層を独立させる。

### 8.3 Render Texture Allocation

1 layer = 1 textureなのか、atlas内rectなのかを吸収する層。

Rendererは次の情報を受け取れる必要がある。

- textureRef。
- standalone texture or atlas texture。
- atlas rect。
- uv transform。
- gutter / padding size。

Mesh生成・保存・deformer評価はlayer-local UVを使い続ける。WebGL2で描く直前に、layer-local UVをphysical texture UVへ変換する。

```text
mesh uv: layer-local 0..1
texture allocation: standalone texture or atlas rect
renderer: layer-local uv -> physical texture uv
```

### 8.4 WebGL2 Texture

WebGL2 backendが所有するGPU resource。

- texture upload。
- texture cache。
- resource lifetime。
- context loss handling。
- filtering / wrap mode。
- premultiplied alpha upload policy。

## 9. Alpha / Blend Policy

初期推奨:

- 内部描画はpremultiplied alphaを基本にする。
- blendは `ONE, ONE_MINUS_SRC_ALPHA` 系を基本候補にする。
- texture preparationでtransparent / low-alpha edgeへ近傍色をdilateする。
- atlas化する場合は各layer rectにgutterを置き、端texelを外側へextrudeする。

この方針により、次を同じ設計で扱う。

- mesh triangle境界の白線。
- 半透明輪郭の色にじみ。
- atlas境界sampling。
- transparent RGB由来の白/黒 fringe。

## 10. WebGL2 Clipping Direction

ClippingはCanvas2Dの `clip()` 的な処理ではなく、renderer contract上のcomposition stepとして扱う。

初期推奨:

- clipping target drawableを評価後meshでmask化する。
- clipped drawable描画時にmask alphaを参照する。
- v0ではbasic clippingを対象にし、Photoshop mask / vector mask / layer effectsは扱わない。
- clipping relationshipは `RenderScene` に含める。
- clipping結果はEditor PreviewとViewerで同じ意味になる。

実装方式はノームが決めてよい。候補:

- offscreen mask render target。
- stencil buffer。
- alpha mask texture。

ただし、Canvas2D固有のclip semanticsへ寄せない。

## 11. Canvas2D Sunset Policy

Canvas2D rendererは短期移行足場である。

残してよい期間:

- WebGL2 rendererがStageでPSD import済みDrawableを描けるまで。
- WebGL2 rendererがmesh deformation、opacity、draw order、basic clippingを扱えるまで。
- WebGL2実装の比較・debugに必要な最小期間。

撤退条件:

```text
WebGL2 rendererが
  PSD drawable
  + mesh deformation
  + opacity
  + draw order
  + basic clipping
をEditor Previewで描けたら、Canvas2DをStage主描画から外す。
```

撤退後の扱い:

- 新機能をCanvas2D rendererへ追加しない。
- 明示的なdebug / fixture generation用途がなければ削除対象にする。
- Canvas2Dをfallbackとして長期育成しない。

## 12. Relation To Mesh Generation

Mesh generationとmesh renderingは別問題である。

- Mesh generationは、どの頂点・辺・三角形を作るかを扱う。
- Mesh renderingは、その三角形で画像をどう破綻なく描くかを扱う。

`auto-outline-v4-contour-band` は形状品質を改善する。特に輪郭付近の三角形配置を自然にする。しかし、rendererが共有辺をwatertightに描けなければ、V4でも白線やにじみは残る。

したがって次waveでは、V4をsidecarとして進めつつ、mesh image renderingは独立した主課題として扱う。

## 13. Relation To Deformer Evaluation

Rendererは評価済みmesh verticesを描く。親子Deformerの相互作用が誤っていれば、WebGL2 rendererでも誤った形を正確に描いてしまう。

したがって親子Deformer評価は、rendererとは別domainで修正する。ただし、最終的には `RenderScene` へ入る評価済みmesh verticesが、Deformer Tree上の親子関係と一致している必要がある。

## 14. Acceptance Criteria

設計AC:

- Mesh image renderingがCanvas2D実装ではなく共有renderer contractとして定義されている。
- WebGL2 primaryが明記されている。
- Editor PreviewとViewerのrenderer共有が明記されている。
- `RenderScene` の不変条件が明記されている。
- Texture PreparationとTexture Allocationが分離されている。
- layer-local UVとatlas physical UVの境界が明記されている。
- Canvas2D撤退条件が明記されている。

実装AC候補:

- WebGL2 rendererで1枚のDrawable textureをmesh vertices / UVで描ける。
- 隣接三角形の内部共有辺が通常表示で見えない。
- opacityとdraw orderが反映される。
- basic clippingがEditor Previewで成立する。
- Editor PreviewとViewerが同じrenderer packageを使う。
- Canvas2D rendererに新機能が追加されていない。

人間visual check:

- mesh overlay offの状態で、mesh境界線が見えない。
- 目、まつげ、髪先など高コントラスト・細線パーツで不自然な白線やギザつきが目立たない。
- V2.6 / V4のmesh形状差と、renderer由来の描画差を切り分けて確認できる。

## 15. Unresolved Questions

- `RenderScene` / `RenderDrawable` の具体的なTypeScript型。
- `packages/render-core` / `packages/render-webgl2` の正確な依存方向。
- clipping v0の実装方式をoffscreen mask、stencil、alpha mask textureのどれにするか。
- texture preparationをどのpackageへ置くか。
- WebGL2 context loss / resource disposalをv0でどこまで扱うか。
- Canvas2D撤退後にdebug rendererとして残す明確な価値があるか。

