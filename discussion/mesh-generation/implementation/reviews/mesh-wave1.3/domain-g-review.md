# Mesh Wave 1.3 — Domain G レビュー（Review-Sylph）

> authoring-host perception（AI の眼 / software render）経路の contentInset UV remap。editor Wave 1.2 F の姉妹修正。

- Domain id: `mesh-wave1_3-perception-content-inset-uv-remap`
- レビュー担当: Review-Sylph（Orch-Sylph からのサブエージェント委任）
- 対象コミット状態: working tree（未コミット）
- **判定: 合格（要修正なし）**

---

## 総括

wave 計画 §3 の Required implementation 1〜6 / Required tests をすべて満たし、editor Wave 1.2 F 実装およびアトラス側 `deriveContentSubRectUv` と remap 式が三者同型であることを確認した。新規テストは観点（remap 正当性・非対称inset・非クランプ・位置意味論・後方互換4種・防御）を網羅し、自分で回した全テストが green（新規 fail ゼロ）、typecheck もエラーなし。Forbidden write scope（texture-resolution.ts §3.4 ラダー・render-core/software 契約・editor・atlas）不可侵。

`git status` に本 Domain の Allowed write scope 外のファイル（ref PNG 3枚、`_map.md`）が現れるが、**いずれも本レビュー対象の変更に起因しないこと**を検証で確定した（下記 観点8）。

---

## 観点別確認結果

### 1. 計画・editor 版実装との突合 — 適合

- `render-scene-adapter.ts` 内、既存 `textureIdByDrawableId`（:53-55）の直後に `contentGeometryByTextureId`（:65-73）を構築。`session.graph.textureAtlas?.textures` から textureId → `{ contentInset?, dimensions? }` を直引き。`texture-resolution.ts:165` が引くのと同一 object（`TextureAtlasEntryDto`）。editor が projection drawable に生やす inset/raster を、adapter 内で textureId 経由に閉じており、editor の projection map 相当の導線が adapter 内で完結している（Required 1）。
- UV remap 適用（:120-124, :130）は textureId 解決の直後に geometry を引き `resolveContentUvRemap` → `graphDrawable.uvs.map((uv) => applyContentUvRemap(uv, contentUvRemap))`（Required 2）。
- `exactOptionalPropertyTypes` 整合のため両フィールドを存在時のみ条件展開している点も妥当。

### 2. remap 式の同型性（三者一致） — 適合

adapter（:266-269）:
```
x' = (insetLeft + u·contentWidth) / paddedWidth
y' = (insetTop  + v·contentHeight)/ paddedHeight
contentWidth  = paddedWidth  − insetLeft − insetRight
contentHeight = paddedHeight − insetTop  − insetBottom
```
- **editor `applyContentUvRemap`/`resolveContentUvRemap`（canvas-render-scene-adapter.ts:120-170）とは逐語一致**。関数構造・防御ガード・全辺0 早期 return・malformed（≤0）ガードまで同一。唯一の差分は入力ソース（editor: drawable フィールド `contentInset`/`rasterDimensions` / adapter: 直接引数）で、これは wave 計画 §3 が指定した意図的差分。
- **アトラス側 `deriveContentSubRectUv`（texture-atlas-content-rect.ts:45-69）と同型**。per-texture raster（contentRect 原点 0・paddedW=pageW）へ帰着させると、
  - u=0 → insetLeft/paddedW = `topLeft.x`
  - u=1 → (insetLeft+contentW)/paddedW = `bottomRight.x`
  で content UV [0,1] をアトラスの content 副矩形 `[topLeft, bottomRight]` へ写す同一アフィン。
- 軸ごとの left/top/right/bottom 対応は正しく、非対称 inset {3,5,7,9} × 非正方 40×60 のテスト（test:169-192）で各辺独立適用を実証。破綻なし。

### 3. 非クランプ保存 — 適合

- `applyContentUvRemap`（:258-270）はアフィン写像のみでクランプ・min/max を一切含まない。
- 非クランプテスト（test:194-220）が overshoot UV（−0.3 / 1.3）が [0,1] 外へ線形に写り、`toBeLessThan(0)` / `toBeGreaterThan(1)` で 0未満/1超が保存されることを実証。A1 透明マージン設計（overshoot が padded 透明バンドへ落ちる）が保存される。

### 4. 後方互換 — 適合（要求3種を上回る4種）

`resolveContentUvRemap` の恒等 early return（:222-246）を、テストが以下4ケースで実証（test:259-334）:
- contentInset 不在（:259-275）
- 全辺0 inset（:277-293）
- dimensions 不在（atlas エントリ dimensions 欠落・derived-verified rung で texture 解決は成立、:295-314）
- malformed（contentWidth ≤ 0、:316-334）

いずれも `mesh.uvs` が入力 0..1 のまま `toEqual` で不変。

### 5. 位置の意味論（H1 解消の実証） — 適合

test:222-257 は**実装式の写しでなく独立不変量**を用いる: bounds quad（content 端 UV 0/1）の remap 後 UV の min/max span × padded == CONTENT 寸法（= paddedW − insetL − insetR）を検証。remap 不在（H1）なら span は padded 全域（PADDED px）になるため、この不変量は式の同義反復ではなく「content が padded 全域でなく content 副矩形を占める」ことを別ルートで実証している。加えて左端が P px 内側に座ること（`min×PADDED == PADDING`）も確認。

### 6. 測定経路不変 — 適合

- `evaluated-bounds`（vertices 由来 bbox）/ `measurement-command`（geometry 由来）は UV 非経由。コード改変なし（`git diff` 対象外）。
- `evaluated-bounds.test.ts`（2）/ `measurement-command.test.ts`（5）green。
- 実 ref パッケージの `ref-e2e.test.ts`（7）green、`inspectEvaluatedGeometry` の deterministic measurement / containment も不変。

### 7. texture-resolution.ts §3.4 ラダー非改変 — 適合

`git status` / `git diff` に `apps/authoring-host/src/perception/texture-resolution.ts` は現れず。§3.4 dimension 解決ラダー温存。inset は adapter 側で供給する裁定どおり。

### 8. スコープ逸脱 — 実装スコープは適合。対象外の working-tree ドリフトを検証で無害と確定

`git status` の変更ファイル全体:
- **実装スコープ（適合）**: `render-scene-adapter.ts`（+ 新規 `render-scene-adapter.test.ts`）、`boundary-transparent-margin-design.md` 項5 の1行追記（Required 5・最小差分、over-reach なし）。新規依存・回避配線・lockfile 変更なし。
- **対象外だが本変更起因でないと証明**:
  - `discussion/model-authoring/experiments/ref-render-gate/ref-{eyes-viewport,face-focus,rest-full}.png`（3枚）: `ref-e2e.test.ts` が REF_GATE_DIR（コミット済み位置）へ書き出す gate 成果物。**ref パッケージは contentInset を一切持たない**（`ref/model/*.json` に contentInset ゼロ件・textureAtlas ファイルも modelFiles に無し）ため、adapter の remap は ref に対し**恒等**で、本変更は原理的に ref PNG を変えられない。ref-e2e 再実行後の 3枚の `git hash-object` は変更前と**完全一致**（決定性確認）。よって PNG のドリフトは本 Domain 起因ではなく、git HEAD（6645c2f）以降の別セッション（`.tmp/` の facex/facey/facez 作業等）による既存ドリフト。**Domain G の欠陥ではない。**
  - `discussion/mesh-generation/implementation/_map.md`: wave1.2 完了記録 + wave1.3 行追加のオーケストレーション索引更新。Gnome の実装差分ではなく Orch-Sylph の索引管理と推定（→ 下記「質問」参照）。

### 9. テスト再実行（Review-Sylph が自分で実行） — 適合（新規 fail ゼロ）

| コマンド | 結果 |
|---|---|
| `pnpm exec vitest run src/perception/render-scene-adapter.test.ts`（新規） | **8 passed / 8** |
| `pnpm exec vitest run src/perception`（回帰・8 files） | **55 passed / 55** |
| `pnpm exec vitest run src/ref-e2e.test.ts`（実 ref パッケージ） | **7 passed / 7** |
| `pnpm run typecheck`（`tsc --noEmit`） | **エラーなし** |

既知 fail・新規 fail ともゼロ。`pnpm install` は実行していない。

---

## 式同型性の突合結果（具体）

| | 式 | 出典 |
|---|---|---|
| adapter | `x'=(insetLeft+u·contentW)/paddedW`（:266-269） | render-scene-adapter.ts |
| editor | 同上・逐語一致（防御ガード含む） | canvas-render-scene-adapter.ts:158-170 |
| atlas | content UV [0,1] → `[topLeft.x, bottomRight.x]` = `[insetLeft/paddedW, (insetLeft+contentW)/paddedW]`（per-texture 帰着） | texture-atlas-content-rect.ts:52-67 |

三者一致。軸別（left/top/right/bottom）対応も一致し、非対称・非正方で破綻しないことをテストで実証。

---

## 裁量判断の妥当性評価

Gnome 報告 §7 の3点（dimensions 不在テスト構成 / UV 既知値化の非破壊 graph 再構築 / remap ヘルパのモジュール末尾 private 配置）はいずれも妥当。特に「dimensions 不在」テストは、dimensions が texture-resolution と remap geometry の共有入力である事実を踏まえ、`registerTextureBytesWithoutDimensions` で解決を成立させつつ remap を恒等にする実パイプライン整合構成で、恣意的モックでなく妥当。UV 既知値化も session/snapshot は実フィクスチャのまま実 adapter 経路（texture 解決・mask・順序）を通しており健全。

---

## 懸念・質問（Orch-Sylph へ）

1. **ref PNG 3枚のドリフト（無害だが要認識）**: 上記のとおり本変更起因ではなく別セッション由来の既存ドリフト。Domain G のコミット時にこれら 3枚を巻き込まないよう、**コミット対象を Allowed write scope（render-scene-adapter.ts / 新規 test / design md 項5 / report / review）に限定する**ことを推奨。ref PNG と `_map.md` は別途 Orch-Sylph の判断でコミット単位を分けるべき。
2. **`_map.md` の帰属**: wave1.2 完了記録・wave1.3 行追加はオーケストレーション索引更新であり Gnome の Allowed scope 外。Orch-Sylph 自身の索引管理であれば問題なし。もし Gnome が書いたのであれば scope 越境の記録として認識されたい（内容自体は索引の事実更新で害はない）。→ Orch-Sylph に帰属確認を委ねる。
3. escalate 事項なし。RenderScene 契約・サンプラー・texture-resolution 改変なしで adapter 完結、既存テスト期待値の意味論緩和も不要（remap が既存フィクスチャ/ref に対し恒等のため byte-identical）。

---

## 結論

**合格。** wave 計画 §3/§4 の契約を満たし、三者式同型・非クランプ保存・後方互換・位置意味論（H1 解消）・測定経路不変・§3.4 ラダー非改変・実装スコープ遵守をすべて確認した。要修正なし。コミット時のみ、対象外の ref PNG / `_map.md` を Domain G のコミットに巻き込まないよう Orch-Sylph の統制を推奨する。
