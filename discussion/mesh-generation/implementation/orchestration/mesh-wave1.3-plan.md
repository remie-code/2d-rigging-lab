# Mesh Wave 1.3 Plan: authoring-host perception 経路の contentInset UV remap(AIの眼の位置ズレ修正)

> authoring-host の「AIの眼」(perception render)が、PSD 由来 padded テクスチャを content 空間 UV 0..1 のまま描画し contentInset を反映しないため、レンダリング画像上で各パーツ絵柄が自バウンズ中心へ P px(5〜17px・レイヤーサイズ依存)縮む H1 と同型の欠陥を、editor(mesh-wave1.2 Domain F)と同型の adapter UV remap で解消する単一ドメイン小 wave。原因は editor 版と同一機序で、有界調査で repo 確定済み。

## 1. Status

- Status: Planned / ready for orchestration
- Target wave: Mesh Wave 1.3(authoring-host perception の H1 波及先修正)
- 系譜: mesh-wave1.2 Domain F(editor ライブキャンバスの同 H1 修正)の姉妹。根本原因・remap 式・非クランプ設計は 1.2 と同一。適用先が `apps/editor` から `apps/authoring-host` へ移るのみ

## 2. Oracles / User Decisions(2026-07-15 確定)

- 修正方針: **最小修正**。authoring-host perception adapter に contentInset UV remap を入れる。editor 版(mesh-wave1.2 Domain F)の実装をそのまま移植する — ユーザー決定(editor 版と同型で進める合意)
- 配置: mesh-generation トピック内 mesh-wave1.3(案A)— Undine 推奨・ユーザー裁定に委ねる軽い決定(異論なければ本計画で確定)
- 根本原因の正: editor 版調査 [import-position-mismatch-investigation.md](../../../reports/psd-import-fidelity/import-position-mismatch-investigation.md)(H1)+ 本 wave 前の有界調査(下記「有界調査で確定した repo 事実」)
- remap 式の正: editor `apps/editor/src/workspace/canvas/canvas-render-scene-adapter.ts` の `applyContentUvRemap` / `resolveContentUvRemap`、およびアトラス側 `packages/authoring-core/src/texture-atlas-packing.ts:544-588`(contentUvRect)。三者同型
  - `u' = (insetLeft + u × contentW) / paddedW`(contentW = paddedW − insetLeft − insetRight)
  - `v' = (insetTop + v × contentH) / paddedH`(contentH = paddedH − insetTop − insetBottom)
- inset 供給の設計裁定(Undine): **adapter 内で `session.graph.textureAtlas.textures` から contentInset + padded dimensions を直引きする**(editor の projection map と同型)。`texture-resolution.ts` の §3.4 dimension 解決ラダーは変更しない(温存)
- Model Allocation: L0 = fable / Orch-Sylph・Gnome・Review-Sylph = **opus 明示必須**

### 有界調査で確定した repo 事実(本 wave の前提・変更禁止の所与)

- テクスチャエントリ型 `TextureAtlasEntryDto`(`packages/package-format/src/texture-atlas.ts:81-100`)は `dimensions`(=padded, `:89-93`)と `contentInset`(四辺 int nonnegative, `:73-79/:94`)を露出。authoring-host `texture-resolution.ts:165-167` が引く `session.graph.textureAtlas.textures` の各エントリと**同一 object**。editor `canvas-projection.ts:254-255` と同型で読める
- `renderSceneToPng`(`@private-2d-rigging-lab/render-software`)の CPU ラスタライザは **CLAMP_TO_EDGE bilinear**(`packages/render-software/src/raster/texture-sampler.ts:117-151`, clamp は `:58-66`)。render-core / render-software の RenderScene 契約は `contentInset` を一切認識しない(`packages/render-core/src/render-scene.ts:17-23`、grep 一致ゼロ)。よって remap は render 契約を変えず **adapter が `mesh.uvs` へ remap 済み UV を焼き込む**形でのみ入る
- authoring-host が消費する UV(`render-scene-adapter.ts:106` の `graphDrawable.uvs`)は content 空間 0..1。起源は `runtime-graph-drawables.ts:31` `structuredClone(mesh.uvs)` → `mesh-generation.ts` の content bounds 基準 UV。editor の `evaluatedMesh.uvs` と同一起源で、保存 UV は content・remap は描画時変換という editor 前提が成立
- authoring-host / render-core / render-software に既存の contentInset 補正は無い(grep ゼロ)。部分補正との衝突なし
- A1 透明マージン overshoot 設計は software render でも成立(非クランプ remap で overshoot が padded raster の透明バンドへ落ち、CLAMP_TO_EDGE 最外周も透明。`texture-sampler.ts:113-115` が premultiplied 透明減衰を明記)

## 3. Domain G: authoring-host perception contentInset UV remap

Domain id: `mesh-wave1_3-perception-content-inset-uv-remap`

### Allowed write scope

- `apps/authoring-host/src/perception/render-scene-adapter.ts`(contentInset 直引き map + `mesh.uvs` への UV remap 適用)
- `apps/authoring-host/src/perception/render-scene-adapter.test.ts`(**新規作成**。現状専用ユニットテストが無い)
- 既存 perception テストの期待値更新が必要になった場合のみ、`apps/authoring-host/src/perception/*.test.ts`(render-view-command / render-view-file-output 等)を最小改訂。ただし意味論の緩和は禁止(remap で位置が正されることの反映に限る)
- `discussion/design/mesh-rendering/boundary-transparent-margin-design.md` の項5に、software render(authoring-host perception)も同じ content-UV remap を要する旨の**1行追記**(最小差分)
- Domain report / review files(`waves/mesh-wave1.3/domain-g-report.md`, `reviews/mesh-wave1.3/domain-g-review.md`)

### Forbidden write scope

- `apps/authoring-host/src/perception/texture-resolution.ts` の §3.4 dimension 解決ラダー(変更しない・温存。inset は adapter 側で供給する裁定)
- render-core / render-software(`RenderScene` 契約・ラスタライザ・サンプラー)— remap は adapter の `mesh.uvs` 側で行い、契約は不変
- editor 側(`apps/editor/**`)— mesh-wave1.2 で修正済み。参照のみ
- アトラス側(`texture-atlas-packing.ts` ほか)— remap 式の参照元・回帰基準
- mesh-generation v6/v7 パイプライン・契約・package-format 型定義
- 保存済みメッシュ UV 値の書き換え(remap は描画時変換。保存データは content 空間のまま)
- 新規依存・lockfile / コミット / `pnpm install`
- 実 PSD(ユーザー私有素材)へのアクセス・fixture 化(不要かつ禁止)。検証は合成フィクスチャで行う

### Required implementation

1. **contentInset 供給**: `render-scene-adapter.ts` 内で `session.graph.textureAtlas.textures` から textureId → `{ contentInset, dimensions(padded) }` の map を作る(既存 `textureIdByDrawableId`(`:53-55`)と同型)。editor の projection map(`canvas-projection.ts`)に相当する導線を adapter 内で完結させる
2. **UV remap**: `render-scene-adapter.ts:106` の `uvs: graphDrawable.uvs.map(...)` を、当該 drawable の texture の contentInset + padded dimensions から導くアフィン remap(§2 の式)へ差し替える。editor `applyContentUvRemap` / `resolveContentUvRemap` と同式
3. **非クランプ**: remap はアフィン写像のみ。クランプしない(overshoot を透明バンドへ落とす A1 設計を保存)
4. **後方互換**: `contentInset` 不在または全辺 0、あるいは `dimensions` 不在のテクスチャでは UV 不変(従来挙動)。恒等時は早期 return でよい
5. **設計文書追記**: boundary-transparent-margin-design.md 項5に「authoring-host perception(software render)も同じ content-UV remap を要し、mesh-wave1.3 で適用済み」の趣旨を1行追記
6. **測定経路は不変**: evaluated-bounds / measurement-command は vertices 由来で UV 非経由のため対象外。これらの挙動を変えないこと(回帰で確認)

### Required tests

- **remap 単体(本waveの核・新規 `render-scene-adapter.test.ts`)**: 四辺 inset P>0 のテクスチャで、`createPerceptionRenderScene` が返す drawable の `mesh.uvs` が `[P/paddedW, (paddedW−P)/paddedW]` 系へ写ること。editor の `canvas-render-scene-adapter.test.ts` の観点(remap 正当性・後方互換・非クランプ・位置意味論・非対称 inset)を移植
- **後方互換**: contentInset 不在 / 全辺 0 / dimensions 不在で UV が 0..1 のまま不変
- **非クランプ**: content 空間で 0..1 を超える UV が、クランプされず padded 域内の期待座標へ線形に写る
- **位置の意味論**: 合成フィクスチャ(既知パターン content + 既知 P padding)で、remap 後のコンテンツ描画位置が bounds と一致することを数値アサーションで検証(実装式の写しでなく、別ルート不変量で H1 解消を実証すること)
- **測定不変**: 測定・bounds 系テストが挙動不変で green
- **回帰**: 既存 perception 系テスト(`render-view-command.test.ts` / `render-view-file-output.test.ts` / `texture-resolution-derivation.test.ts` / `evaluated-bounds.test.ts`)+ authoring-host 全 unit。判定基準は「**新規 fail ゼロ**」(既知 fail は現状記録と照合)

### Escalate if

- `RenderScene` 契約や render-software サンプラーの変更なしには remap が成立しない構造が見つかった場合(有界調査では adapter 完結と確定済みだが、実装中に反証が出たら)
- inset を adapter 内で供給できず `texture-resolution.ts`(Forbidden)の改変が必要になる場合
- 既存 perception テストの期待値が「意味論の緩和」なしには通らない構造矛盾が出た場合

### User gate(wave 外)

- ユーザーが実 PSD 由来モデルを authoring-host で renderView し、AI の眼のレンダリング画像で目・襟(topwear/neck_back 境界)の位置が比較元と一致することを目視確認する
- 注: remap は描画時変換のため、既存パッケージの再生成は不要(padded ラスタと contentInset は保存済みで正しい)

## 4. Handling Rules

- `.claude/skills/implementation-orchestration/SKILL.md` の全規則に従う(分離 / ループ上限5 / 在席ポーリング / 閉域 / モデル明示)
- レビューは単一 Review-Sylph。観点: 本計画・editor 版(mesh-wave1.2 Domain F)実装との突合、remap 式のアトラス側/editor 側との同型性、非クランプ保存、測定経路不変、texture-resolution.ts §3.4 ラダー非改変、スコープ逸脱なし、テスト再実行
- 必須文言: 「Orch-Sylph自身は実装担当ではない。source implementation は必ず別コンテキストの Gnome に委譲し、レビューは必ず別コンテキストの Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。」
