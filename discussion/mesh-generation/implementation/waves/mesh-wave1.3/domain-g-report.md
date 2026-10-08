# Mesh Wave 1.3 — Domain G 完了報告

> authoring-host perception（AI の眼 / software render）経路の contentInset UV remap。editor Wave 1.2 F の姉妹修正。単一ドメイン小 wave。

- Domain id: `mesh-wave1_3-perception-content-inset-uv-remap`
- 担当: Gnome（Orch-Sylph からのサブエージェント委任）
- 状態: **実装完了・全検証 green（新規 fail ゼロ）**。コミット未実施（L0/ユーザー統制点）。

## 1. 変更 / 新規ファイル一覧（絶対パス）

- 改変: `C:\workspace\remie\code\ai-native-live2d-editor\apps\authoring-host\src\perception\render-scene-adapter.ts`
- 新規: `C:\workspace\remie\code\ai-native-live2d-editor\apps\authoring-host\src\perception\render-scene-adapter.test.ts`
- 1行追記: `C:\workspace\remie\code\ai-native-live2d-editor\discussion\design\mesh-rendering\boundary-transparent-margin-design.md`（項5）
- 本報告書: `C:\workspace\remie\code\ai-native-live2d-editor\discussion\mesh-generation\implementation\waves\mesh-wave1.3\domain-g-report.md`

既存 perception テストの期待値変更は**不要だった**（下記 §4 で理由を明記）。Allowed write scope 外への書き込みは無し。Forbidden（`texture-resolution.ts`, render-core/render-software, editor, atlas 側）には一切触れていない。

## 2. 実装した remap 導線の要約

### contentInset 供給（どこで textureId→inset map を作ったか）

`createPerceptionRenderScene`（render-scene-adapter.ts）内、既存 `textureIdByDrawableId`（drawableId→textureId）の直後に、
`session.graph.textureAtlas?.textures` から `textureId → { contentInset?, dimensions? }` の Map（`contentGeometryByTextureId`）を構築。これは `texture-resolution.ts:165` が引くのと**同一 object**（`TextureAtlasEntryDto`）から `contentInset`（四辺）と `dimensions`（padded）を直引きするもの。editor が projection drawable に生やす `contentInset`/`rasterDimensions` を、authoring-host では textureId 経由でアトラスエントリから引くのが唯一の差分（wave 計画 §3 Required 1 準拠）。`exactOptionalPropertyTypes` 整合のため、両フィールドは存在時のみ条件展開してエントリを作る。

### UV remap 適用（どこで uvs に適用したか）

drawables の map 内、textureId 解決（既存 :94 相当、現 :112）と `usedTextureIds.add` の直後で、
`contentGeometryByTextureId.get(textureId)` から geometry を引き、`resolveContentUvRemap(geometry?.contentInset, geometry?.dimensions)` で remap を解決。従来 `uvs: graphDrawable.uvs.map((uv) => ({ x: uv.x, y: uv.y }))` だった行を
`uvs: graphDrawable.uvs.map((uv) => applyContentUvRemap(uv, contentUvRemap))` へ差し替え（wave 計画 §3 Required 2）。

### remap 式（editor と完全同型・非クランプ）

モジュール末尾に `resolveContentUvRemap` / `applyContentUvRemap` と `ContentUvRemap` / `TextureContentGeometry` interface を追加。editor `canvas-render-scene-adapter.ts` の同名関数をそのまま移植し、入力だけ drawable フィールドから `(contentInset, dimensions)` の直接引数へ読み替えた。式:

- `u' = (insetLeft + u × contentW) / paddedW`、`contentW = paddedW − insetLeft − insetRight`
- `v' = (insetTop + v × contentH) / paddedH`、`contentH = paddedH − insetTop − insetBottom`

純アフィン写像のみで**クランプなし**（Required 3、A1 overshoot→透明バンド設計を保存）。防御ロジックも editor 踏襲：
`contentInset` 不在 / `dimensions` 不在 / 全辺0 / malformed（paddedW,H・contentW,H のいずれか ≤0）で `undefined` を返し、`applyContentUvRemap` が入力をそのまま返す＝UV 不変（Required 4 後方互換）。

## 3. テスト結果

### 新規 `render-scene-adapter.test.ts`（8 tests, all pass）

editor Wave 1.2 F の観点を移植。フィクスチャは既存 perception パターン（`createPerceptionFixture` + `evaluatePerceptionSnapshot`）を流用し、eye テクスチャを padded 寸法で登録＋アトラスエントリに `contentInset` を stamp、eye drawable の runtime-graph UV を既知値へ差し替えて `createPerceptionRenderScene` を実行、返る `mesh.uvs` を数値アサーション。

- remap 単体（核, 四辺 inset P=4/padded=28）: `[4/28, 24/28]` 系へ写ること
- 非対称 inset + 非正方 raster（inset {3,5,7,9} / 40×60）: 各辺独立適用
- 非クランプ: overshoot UV（-0.3 / 1.3）が [0,1] 外へ線形に写り 0未満/1超が保存されること
- 位置の意味論（H1 解消の実証）: **実装式の写しでなく別ルート不変量**。bounds quad の remap 後 UV の min/max span × padded == CONTENT 寸法（= paddedW − insetL − insetR）で、content が padded 全域でなく content 副矩形を占めることを実証。加えて content 副矩形左端が P px 内側に座ることを確認
- 後方互換 3種: contentInset 不在 / 全辺0 / dimensions 不在（derived-verified rung で解決させつつエントリ dimensions は不在）で UV 不変
- 防御: malformed inset（contentWidth ≤ 0）で UV 不変

コマンド `pnpm exec vitest run src/perception/render-scene-adapter.test.ts` → **8 passed / 8**。

### 回帰（perception 系, 22 tests, all pass）

`pnpm exec vitest run src/perception/render-view-command.test.ts render-view-file-output.test.ts texture-resolution-derivation.test.ts evaluated-bounds.test.ts measurement-command.test.ts` → **22 passed / 22**。deterministic PNG（byte-identical）系も含め不変。

### authoring-host 全 unit（16 files, 90 tests, all pass）

`pnpm exec vitest run` → **90 passed / 90（16 files）**。perception 以外の退行なし。`ref-e2e.test.ts` の実 ref パッケージ deterministic PNG レンダも byte-identical で pass（remap が現状 ref テクスチャに対し恒等＝§4 参照）。

既知 fail: 事前・事後とも無し（全 green）。本変更起因の新規 fail ゼロ＝判定基準クリア。

## 4. 型検査結果

`pnpm run typecheck`（`tsc --noEmit -p tsconfig.json`）→ **エラーなし**。

## 5. 既存テスト期待値を変えなかった理由

現行フィクスチャおよび実 ref パッケージのテクスチャエントリは `contentInset` を持たない（A1 padding 前の import / golden）。remap は `contentInset` 不在で恒等となるため、`createPerceptionRenderScene` を通す既存 render/measurement テストは**すべて byte-identical に不変**。よって Allowed の「既存 perception テストの最小改訂」は発動せず、意味論の緩和も一切行っていない。

## 6. 測定経路（evaluated-bounds / measurement）不変の確認

remap は adapter の `mesh.uvs` 側でのみ適用。`evaluated-bounds.ts`（vertices 由来 bbox）/ `measurement-command.ts`（geometry 由来）は UV 非経由で、コード改変も無し。`evaluated-bounds.test.ts`（2）/ `measurement-command.test.ts`（5）が挙動不変で green。`RenderScene` 契約・render-software サンプラーも不変（remap 済み UV を焼き込むのみ）。

## 7. 裁量判断（設計未定義を合理的に補った箇所）

- **後方互換「dimensions 不在」テストの構成**: アトラスエントリの `dimensions` は texture-resolution（§3.4）と remap geometry の**共有入力**のため、`dimensions` を消すと texture-resolution が derived-verified rung に落ちる。テストは `registerTextureBytesWithoutDimensions` で mesh-bounds 由来 byteLength を与えて解決を成立させつつ、エントリ `dimensions` 不在ゆえ remap が恒等になることを検証した（実パイプライン整合を保った上での最小構成）。
- **UV 既知値化の手法**: `createPerceptionRenderScene` は runtime graph の `graphDrawable.uvs` をそのまま消費するため、evaluate 後に runtime graph を非破壊で再構築（`{ ...graph, drawables: new Map(...) }`）し eye drawable の uvs のみ差し替えた。session / snapshot は実フィクスチャのまま＝実 adapter 経路（texture 解決・mask・順序）を通す。`createRenderScene` は mesh 整合検証を行わない（back-to-front 並べ替えのみ）ことを確認済みで、uvs 差し替えは安全。
- **remap ヘルパの配置**: editor と同型に、モジュール末尾のプライベート関数として定義（export せず）。`TextureContentGeometry` は構造型で package-format 依存を増やさない。

## 8. スコープ / 環境規律

- Forbidden write scope 不可侵（texture-resolution.ts §3.4 ラダー温存・render-core/software 契約不変・editor 参照のみ・atlas 側参照のみ）。
- 新規依存・lockfile 変更・`pnpm install`・コミット無し。回避配線なし。実 PSD アクセスなし（検証は合成フィクスチャ + 既存 read-only ref-e2e のみ）。
- 他セッションの未コミット変更（`.tmp/` 等）には触れていない。

## 9. Escalate 事項

なし。有界調査どおり adapter 完結で成立（`RenderScene` 契約・サンプラー改変不要、texture-resolution 改変不要、既存テスト期待値の意味論緩和不要）。

## 10. 質問（判断に迷う点・不足情報）

なし。wave 計画 §3 の Required implementation 1〜6 / Required tests / 検証コマンドをすべて満たした。レビュー観点（editor 版・アトラス側との式同型性、非クランプ保存、測定経路不変、§3.4 ラダー非改変、スコープ遵守）は別コンテキストの Review-Sylph に委ねる。
