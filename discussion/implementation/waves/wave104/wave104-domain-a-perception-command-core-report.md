# Wave104 Domain A Report: Perception Command Core

- Domain id: `wave104-perception-command-core`
- Status: **complete / pass**（レビュー 3 レーン + 修正ループ 1 回 + 再検証の全 pass 確定）
- Orchestrator: Orch-Sylph（opus）/ Implementer: Gnome（opus、初回 + 狭い修正の 2 回）/ Reviewers: Review-Sylph（opus、独立コンテキスト x4 = 初回 3 レーン + 再検証 1）
- Date: 2026-07-03
- Source of truth: [../../orchestration/wave104-plan.md](../../orchestration/wave104-plan.md) §6（§3.1 / §3.2 / §3.4 / §3.7 / §10 / §13 併用）
- Primary basis: [../../../model-authoring/research/evaluation-and-read-path-survey.md](../../../model-authoring/research/evaluation-and-read-path-survey.md) C 節、[../../../model-authoring/research/perception-path-survey.md](../../../model-authoring/research/perception-path-survey.md)

## 1. Bounded 現状確認の結果（計画 §6 冒頭の 3 点。Gnome 委任前に Orch-Sylph が確認）

計画時点の未読 3 点はすべて解消し、**Escalate 条件に該当する事実は無かった**:

1. **`RuntimeSnapshotDto` フィールド正式名**（`packages/runtime-core/src/snapshot.ts`）: `.drawables`（EvaluatedDrawable: drawableId / meshId / bounds / vertices? / vertexCount / opacity / visible / baseDrawOrder / evaluatedDrawOrder / texture?）、`.masks`（EvaluatedMaskRelation: sourceDrawableIds / targetDrawableIds）、`.drawList`（可視 drawable の描画順）。vertices は `snapshotDetail: "full"` で含まれる。
2. **AuthoringGraph → NormalizedRuntimeGraph 変換の呼び出し形**: `packages/authoring-core/src/to-runtime-graph.ts` の `toRuntimeGraph(session, options?)` が **Runtime Export 非経由**の正式変換として既存（survey 未読分の解消。runtime-player の Runtime Export アダプタ、editor の viewer-runtime-playback とは別系統で、authoring-host から authoring-core 経由で直接呼べる）。
3. **空 `graph.parameters` の評価挙動**: `createRuntimeParameterMap` は空 Map を返し、`evaluateViewerRuntimeSnapshot` は zod default で成立する見込みと判定 → Gnome のテストで rest pose render 成立を実証（Required test 6）。

追加の設計上の重要事実（Gnome へ確定事実として引き渡し）:

- **RenderScene 構築はハイブリッド**: 評価済み頂点は snapshot 由来、UV / triangles は NormalizedRuntimeGraph.drawables 由来（snapshot に UV/triangles は無い）。`createRuntimeDrawableMap` は texture を NormalizedDrawable にマップしないため、texture 参照は AuthoringGraph 側から別途解決が必要。
- **テクスチャ寸法源**: `textureAtlas.textures[].dimensions`（graph 側の正式情報）が存在し §3.4 の byteLength 検証が可能。

## 2. 実装成果の要約

### 2.1 知覚経路コア（apps/authoring-host/src/perception/、全て新規）

session → runtime-core 評価 → RenderScene → PNG + サイドカーの全経路。**Runtime Export 非経由・Editor Canvas 系非移植**（§3.1-1 遵守、Spec Compliance レーンが import 検査で実証）。

| ファイル | 責務 |
|---|---|
| `evaluation-adapter.ts` | AuthoringSession → `toRuntimeGraph` → `evaluateViewerRuntimeSnapshot(snapshotDetail:"full")` → RuntimeSnapshotDto |
| `texture-resolution.ts` | §3.4 テクスチャ寸法解決。`textureAtlas.textures[].dimensions` を唯一の正とし、`bytes.byteLength === width*height*4` 不一致を決定論的 reject。editor 式の bounds 推定 fallback は明示的に不採用 |
| `render-scene-adapter.ts` | RuntimeSnapshotDto + graph 静的素材（UV/triangles/texture 参照）→ RenderScene（drawList 順・opacity・visible・masks） |
| `evaluated-bounds.ts` | 評価済み bbox ヘルパ（drawable / rigControl 対象）。**Domain C が再利用する公開形** |
| `view-resolution.ts` | view 3 形態の解決: 省略=モデル全体 bounds / 明示 stageViewport / drawableFocus（評価済み bbox + marginRatio） |
| `parameter-sweep.ts` | sweep（parameterId + steps）の姿勢列生成 |
| `contact-sheet.ts` | N 姿勢の決定論的グリッド合成（columns = ceil(sqrt(n))、空セル透明） |
| `render-view-sidecar.ts` | §3.2 必須フィールドのサイドカー生成（タイムスタンプ非含有 = 決定論、stale 防止は packageRevision で担保） |
| `render-view-command.ts` / `render-view-file-output.ts` | renderView コマンド実処理 + PNG/サイドカーのファイル出力 |

CLI 配線: `apps/authoring-host/src/run-render-view-command.ts`（新規）、`cli-arguments.ts` / `run-authoring-host-command.ts`（M、A 関連分）。

### 2.2 ai-interface（純 zod のみ、§3.1-3 遵守）

- `ai-render-view-command.ts`（新規）: renderView payload/result/sidecar スキーマ。`{parameterOverrides?, view?（省略 | stageViewport | drawableFocus{drawableId, marginRatio?}）, outputWidth/Height, sweep?: {parameterId, steps}, outDir}`。schemaVersion は `render-view-sidecar-v1` / `render-view-result-v1` を z.literal 固定
- `ai-command-name.ts` / `ai-capability.ts`: AiCommandName `renderView` + capability `render` 新設
- `ai-command-executor.ts`: render capability gate（実処理は host 側。executor は capability 充足時 not_implemented プレースホルダ）
- **dependency-boundary の allowlist は無変更・render-core / render-software 依存は不追加**（boundary テスト非緩和をレビューで実証）

### 2.3 変更・追加ファイル（Domain A 分）

| ファイル | 種別 |
|---|---|
| `apps/authoring-host/src/perception/`（13 ファイル、テスト 2 本含む） | 新規 |
| `apps/authoring-host/src/run-render-view-command.ts` / `.test.ts` | 新規 |
| `apps/authoring-host/src/test-support/perception-fixtures.ts` | 新規（修正ループで keyform 変形追加） |
| `apps/authoring-host/src/cli-arguments.ts` / `run-authoring-host-command.ts` / `test-support/command-builders.ts` | M（A 関連分） |
| `apps/authoring-host/package.json` / `tsconfig.json` | M（workspace 依存 render 系 3 件 / 参照追加） |
| `packages/ai-interface/src/ai-render-view-command.ts` / `.test.ts` | 新規 |
| `packages/ai-interface/src/ai-command-name.ts` / `ai-capability.ts` / `ai-command-payload.ts` / `ai-command-response-payload.ts` / `ai-command-executor.ts` / `index.ts` | M（A 関連分） |
| `pnpm-lock.yaml` | M（**L0 承認済み**の workspace importer 登録。L0 が `pnpm install` を実行。新規外部依存ゼロ） |

注: `ai-command-executor.ts` / `run-authoring-host-command.ts` / `apps/authoring-host/tsconfig.json` / `package.json` には並行 Batch 1 の Domain B（read 統合 / validate / state-dir ガード）の変更が共存する。本報告とレビューは Domain A 変更分のみを対象とし、全体整合は Domain D の管轄。

Conditional write scope（`packages/runtime-core/src/**` / `packages/render-software/src/**`）は**未使用**（無変更。Design・Development レーンが git で実証）。

## 3. テスト結果

- authoring-host: **37/37 pass**（root から `npx vitest run --root apps/authoring-host`、9 files。再検証レーンが実測確認）
- ai-interface: **101/101 pass**（既存 88 非退行を含む）
- root tsc / app tsc: exit 0、`node scripts/check-source-organization.mjs` pass、`node scripts/check-dependencies.mjs` は既知の先行偽陽性（cmo3 / pnpm-lock line 2486）のみで Wave104 由来の新規 finding ゼロ

計画 §10 Domain A 明示確認項目の実証（Spec Compliance レーンが実再現）:

- **決定論**: 同一パッケージ状態 + 同一リクエスト → 2 回実行バイト一致（in-memory + on-disk の両方、レビューが実再現）
- **サイドカーのビュー変換値の数値正確性**: pixelsPerStage の期待値は手計算由来、photo↔stage 対応は既知座標での往復検証（オウム返しでないことを Test Adequacy レーンが判定）
- **drawableFocus**: 評価済み bbox（rest でなく評価後）由来の viewport 解決を数値検証
- **byteLength 検証**: 不一致の決定論的 reject を負例テストで確認
- **Runtime Export 非経由 / boundary 非緩和**: import 検査・diff 検査で確認

## 4. レビュー判定と修正ループ（1 回 / 上限 5）

| レーン | 初回判定 | 最終判定 | レポート |
|---|---|---|---|
| Spec Compliance | pass | pass | [../../reviews/wave104/wave104-domain-a-spec-compliance-review.md](../../reviews/wave104/wave104-domain-a-spec-compliance-review.md) |
| Design・Development | pass | pass | [../../reviews/wave104/wave104-domain-a-design-development-review.md](../../reviews/wave104/wave104-domain-a-design-development-review.md) |
| Test Adequacy | **needs_fix**（blocking 1 件） | **pass**（再検証で解消確認） | [../../reviews/wave104/wave104-domain-a-test-adequacy-review.md](../../reviews/wave104/wave104-domain-a-test-adequacy-review.md)（初回 + 再検証セクション） |

### 4.1 修正ループの経緯

- **Blocking（Test Adequacy 初回）**: 合成フィクスチャ `perception-fixtures.ts` がパラメータ駆動の変形を持たず、Required test 2（parameterOverrides 変形反映）が「空 override + PNG 非空」の弱い検証、Required test 4（sweep）が全セル恒等画像でメタデータのみの検証だった。レビューは全 34 パラメータ min/max 評価での不変性をプローブで実証（プローブは削除済み・リポジトリ無改変）。実装バグではなくテスト充足性の欠落。
- **L0 裁定**: 修正案 (a) 採用 — フィクスチャに keyform 変形を仕込み、①rest render ≠ override render のバイト列不一致 ②sweep 隣接セルの RGBA8 不一致を assert。理由: 評価→シーン→ラスタ→PNG の全経路の回帰保護となり、閉問題 01（眼球移動の変形を Fable が見る）で実際に使う経路そのものだから。
- **修正 Gnome（狭いスコープ、変更 2 ファイルのみ）**: `perception-fixtures.ts` に `param_perception_eye_region_opacity`（min=-1 / default=1 / max=1）+ opacity keyform（createEnds、operations 経由）を eye / eyeMask 両 drawable に追加。`render-view-command.test.ts` の該当 2 テストを強化 + テスト名を実態に整合。default=max 設計により rest pose は keyform 追加前と byte-identical → 既存の決定論・rest golden テストは無変更で pass。**負の検証**: keyform 一時無効化で強化 2 テストのみが fail することを実証し復元。実装コード（src/perception/）は無変更。
- **再検証（fresh Review-Sylph）**: blocking 解消・独立の負の検証（keyform 無効化 → fail → 復元確認）・スコープ逸脱なし（2 ファイルのみ、実装コード無変更）・authoring-host 37/37 / ai-interface 101/101 実測を確認し **pass 確定**。レポートの verdict 更新・再検証セクション追記済み。

### 4.2 インシデント記録（プロセス上の記録。成果物への影響なし）

- 修正 Gnome の実行中、ツール呼び出しが本文化する不具合が発生し L0（Undine）が再開させた。作業は完遂され、再検証レーンが成果物を独立検証済み。
- Orch-Sylph の子起動が環境仕様により async 起動となった（ハンドリング規則のフォアグラウンド原則に対する環境側の制約）。孤児は残しておらず、全子の完了を L0 中継・完了通知で受領してから次段へ進んだ。

## 5. non-blocking findings（計 6 件、全レーン合算・重複統合）

1. **sweep セルの column/row 二重計算**（Spec Compliance / Design・Development 両レーンで同一観察）: `render-view-command.ts` の `sweepCells` と `contact-sheet.ts` の充填ロジックが同一計算を二重化。結果は必ず一致しテストで検証済みだが、将来レイアウト変更時の乖離リスク回避には `composeContactSheet` がセル座標も返す形が望ましい。
2. **executor の renderView not_implemented プレースホルダ**: capability 充足時のダミー payload（`pngPath:"not-implemented"` 等）。§3.1-3 の意図通り（実処理は host 側）だが、host 経路が正規であることの担保は Domain D の統合確認で扱う（記録のみ）。
3. **renderView スキーマの `<Name>Schema` 命名（Dto サフィックス不使用）**: DEC-SCHEMA-001 の `<Name>DtoSchema` 形ではないが、ai-interface 既存のコマンド payload/result 群と同一の確立慣習に一致。ai-interface 全体の Dto 命名整備は wave スコープ外。
4. **executor 共存ファイルの Domain B 差分**: `ai-command-executor.ts` / `run-authoring-host-command.ts` 等の read 統合・state-dir ガードは Domain B 管轄としてレビュー対象外に分離。全体整合は Domain D。
5. **drawableFocus の margin 式がテストと実装で同一構造**: bbox 自体は独立取得のため主要バグは検出可能だが、margin 適用の意味論を仕様側から独立に固定する assert があるとより堅い。
6. **sweep テストが steps=4（2x2）の 1 ケースのみ**: 奇数 steps や非平方数レイアウト（trailing 透明セル）の回帰保護がない（`contact-sheet.ts` は空セル透明を実装済みだがテスト未踏）。

## 6. Domain C への引き継ぎ

1. **格子制御点座標は public snapshot に非公開**: warp 系 rigControl の格子制御点座標が `RuntimeSnapshotDto` の公開形に含まれない（Gnome 初回実装時の所見、L0 受領済み）。測量コマンド（`inspectEvaluatedGeometry`、§3.3）が格子制御点座標を返すには runtime-core の狭い export 追加が必要になる見込み → **計画 §8 の conditional として L0 が追記済み**。Domain C はこの前提で着手すること。
2. **評価済み bbox ヘルパの公開形**: `apps/authoring-host/src/perception/evaluated-bounds.ts`（drawable / rigControl 対象）を Domain C が再利用する（§3.3「同じ runtime-core 経路・同じアダプタを共有」）。`perception/index.ts` の barrel から到達可能。
3. **（参考情報）マスクソース通常描画のセマンティクス**: 本リポジトリの renderer はマスクソース drawable を通常描画にも参加させる（Wave103 で承認済みの WebGL2 忠実セマンティクス）。合成フィクスチャでは eyeMask が eye を完全に覆うため、修正 Gnome は keyform を両 drawable に bind した。ref e2e の目視 gate で「マスク用レイヤーが見えている」ように見えても renderer 実装への疑義ではない可能性が高い——目視判定の参考として申し送る。

## 7. 残リスク

- **二評価器の乖離リスク（既知・スコープ外）**: Editor Canvas 系評価器との並行実装による描画結果乖離の構造的リスクは §3.1-1 の L0 裁定どおり記録のみ（本 wave では扱わない）。
- **non-blocking 6 件**: いずれも判定非影響。§5 の 1 / 5 / 6 は将来の堅牢化候補。
- **実モデル規模での実証は未了**: 合成フィクスチャでの実証まで。ref/（実運用モデル）での全経路実証は Domain C の ref e2e が担う（計画 §8 Escalate 条件に ref 由来の失敗が定義済み）。
