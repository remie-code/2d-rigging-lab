# Wave 104 Plan: Perception and Measurement Command Surface

> Wave104 は武器製造の第 2 波・最終波。Wave103 で建った「手」（authoring-host CLI）と「網膜」（render-software）に、「目」（renderView + コンタクトシート + サイドカー）「巻尺」（評価済みジオメトリ照会）「健診」（validatePackage）を配線し、`ref/`（配信実証済みモデル）の e2e で締める。ref のレンダ PNG は**ユーザーによる初の目視 gate** を兼ねる。

## 1. Status

- Status: Planned / ready for orchestration
- Target wave: Wave104
- Wave name: `perception-measurement-command-surface`
- Primary objective:
  - 生きた AuthoringSession から runtime-core 評価 → RenderScene → PNG を生成する `renderView` コマンド（フレーミング・コンタクトシート・機械可読サイドカー付き）を authoring-host に追加する。
  - ai-interface の孤立 read 機構（`ai-read-command.ts`）を executor に正式接続し、`validatePackage` を実装する。
  - 評価済みジオメトリ照会（測量）コマンドを追加する。
  - `ref/` を用いた e2e スモークで全経路を実証し、ユーザー目視用の PNG 成果物を残す。
  - Wave103 引き継ぎの小骨 2 本（state-dir 誤用ガード / render-software 範囲外 index テスト）を回収する。

## 2. Planning Gate Result

Planning Gate result: `Inventory first` — 完了済み。

- Inventory: Sylph C（session→評価→RenderScene 経路）/ Sylph D（ai-interface read 系接続点）。統合結果は
  [../../model-authoring/research/evaluation-and-read-path-survey.md](../../model-authoring/research/evaluation-and-read-path-survey.md)。
- ユーザー確認済み 2 件: ①ref e2e の PNG を「ユーザー目視 gate」として位置づける ②103 小骨 2 本の相乗り。
- Uncertainty: factual low（残る未読 3 点 — snapshot.ts フィールド名 / normalized-runtime-graph 変換の呼び出し形 / 空 parameters の深部挙動 — は Domain A の bounded 現状確認に指定済み）、decision low（L0 裁定 3 件で決着、§3.1）、cost of wrong plan low-medium（配線仕事。誤仮定は escalate で露呈する構造）。

## 3. Accepted Decisions / Oracles

### 3.1 L0 裁定（evaluation-and-read-path-survey.md に根拠記録済み）

1. **知覚の評価器は runtime-core（`evaluateViewerRuntimeSnapshot`）を正とする。** Editor Canvas 系（`createCanvasEvaluatedScene`）の移植・共有化はしない。Fable の目は「モデルが実行時に何であるか」（= Player と同じ意味論）を見る。Editor Canvas との二実装乖離リスクは既存の構造的事実であり本 wave のスコープ外（記録のみ）。
2. **read コマンドは `ai-read-command.ts`（`AiReadCommandHost` / `executeAiReadCommand`）を正式経路として executor に統合する。** 完成済み孤立機構の接続であり、再実装はしない。
3. **`renderView` は新規 AiCommandName + 新規 capability `render` として追加し、実処理は host 側に置く。** ai-interface には純 zod のスキーマのみ追加し、render-core / render-software への依存は足さない（dependency-boundary の package.json 厳密 allowlist は無変更）。

### 3.2 知覚コマンドの要求仕様（model-authoring 対話で合意済み）

Required:

- **サイドカー**: すべての描画出力に機械可読 JSON を併産する。必須フィールド: 対象パッケージパス、`packageRevision`、解決済み `parameterOverrides`、解決済みビュー変換（stageViewport / outputWidth / outputHeight / pixelsPerStage — render-software の `ResolvedSoftwareRenderView` 相当）、（スイープ時）セル ↔ パラメータ値の対応表。目的: ①stale 画像での判定事故の構造的防止 ②画像上の相対判断をモデル座標の操作量へ翻訳する「変換器」。
- **フレーミング**: `view` 指定は 3 形態 — 省略（モデル全体 bounds）/ 明示 stageViewport 矩形 / **drawable フォーカス**（`{drawableId, marginRatio?}` を評価済み bbox から解決）。出力解像度指定可。
- **コンタクトシート**: `sweep: {parameterId, steps}` で N 姿勢を 1 枚のグリッド PNG に合成し、セル対応をサイドカーへ。
- **決定論**: 同一パッケージ状態 + 同一リクエスト → バイト同一の PNG。
- **Atlas コミットを前提にしない**: テクスチャは session の binaryAssets（raw RGBA8）から直接供給する。

Forbidden:

- Runtime Export を知覚経路の必須中間物にする。
- 視覚判定に必要な数値（座標・寸法）を画像目測で代替させる設計（→ 測量コマンドが数値を返す）。

### 3.3 測量コマンドの要求仕様

- 新規 read コマンド（命名は `inspect*` 系に従う。例: `inspectEvaluatedGeometry`）。payload: 対象（drawable / rigControl の参照列）+ `parameterOverrides?`。結果: 対象ごとの評価済み bounding box、（フラグ指定時）評価済み頂点、warp 系 rigControl の格子制御点座標。capability は `read`。
- 評価は 3.1-1 と同じ runtime-core 経路・同じアダプタを共有する（bbox ヘルパは Domain A が公開し Domain C が消費）。

### 3.4 テクスチャ寸法の解決方針

- `binaryAssets.fileEntries` は寸法を持たない（survey C）。寸法は AuthoringGraph 側の正式情報（texture atlas の `dimensions`、または texture/drawable エントリの明示寸法）から解決し、**`bytes.byteLength === width*height*4` の整合性検証を必須とする**。信頼できる寸法源が無いケースは escalate（bounds からの推定を黙って採用しない）。
- **2026-07-03 改訂（Domain C escalate への L0 裁定）**: 実モデル（ref 含む、本エディタ産のパッケージ全般）では per-layer texture entry が `dimensions` を持たないことが判明した。§3.4 の本質は「黙った推定の禁止」であり「宣言値以外の禁止」ではないため、解決の梯子を次の通り拡張する:
  1. texture entry の明示 `dimensions`（従来通り最優先）
  2. **検証付き導出**: パッケージ内の正式境界情報（対象 drawable の mesh bounds、PSD source layer bounds 等）から候補 (w, h) を導出し、**`byteLength === w*h*4` が厳密一致した場合のみ採用**する。一致しない・候補が定まらない場合は従来通り決定論的 reject（`missingDimensions` / `byteLengthMismatch`）。
  3. 採用した寸法源の種別（declared / derived-verified）をサイドカーおよび結果メタデータに記録する（黙らせない）。
- この改訂は「検証された寸法のみを使う」という合意済み不変量を保存する。bounds 推定の**無検証**採用は引き続き禁止。

### 3.5 ref e2e とユーザー目視 gate（ユーザー合意済み）

- `ref/`（配信実証済み・rights cleared のユーザー所有モデル）を read-only フィクスチャとして e2e に用いる。
- e2e は rest pose 全体像 + 顔・目元等のフォーカス数枚を PNG + サイドカーで `discussion/model-authoring/experiments/ref-render-gate/` に書き出す（README 付き）。**これはユーザーが目視して描画正しさを承認する、判定梯子最上段の初回行使**である。wave の技術 gate（Domain D）とは独立の、wave 完了後の model-authoring 側 gate として扱う。
- ref の parameters.json は空のため、ref でのスイープは要求しない（スイープ検証は合成フィクスチャで行う）。ref は改変しない（load 元として read-only）。

### 3.6 Model Allocation（103 と同一 + 較正ログ Round 2 反映）

| 役割 | モデル |
|---|---|
| L0 Undine | fable |
| L1 Orch-Sylph（全ドメイン） | opus |
| L2 Gnome（全ドメイン） | opus |
| L2 Review-Sylph（全レーン） | opus |
| 補助的な狭い機械調査のみ | sonnet（狭い問い + アンカー + git 考古学禁止） |

すべての Agent 呼び出しで `model` を明示指定すること。

### 3.7 サブエージェント・ハンドリング規則

`.claude/skills/implementation-orchestration/SKILL.md` の「サブエージェント・ハンドリング規則」（2026-07-02 制定）を全階層に適用する。要点: **L1 以下の子起動はフォアグラウンドのみ（`run_in_background` 禁止）**、並列は 1 メッセージ内の複数呼び出し、沈黙で再起動しない、孤児を残さない、手ぶらのターン終了禁止、install 等の環境操作は L0/ユーザー統制。

## 4. Primary Basis

- [../../model-authoring/research/evaluation-and-read-path-survey.md](../../model-authoring/research/evaluation-and-read-path-survey.md)（Wave104 の直接根拠）
- [../../model-authoring/research/perception-path-survey.md](../../model-authoring/research/perception-path-survey.md)
- [../../model-authoring/premises/operating-policies.md](../../model-authoring/premises/operating-policies.md)（判定の梯子・知覚能力・ref の位置づけ）
- [wave103-plan.md](wave103-plan.md) / [../waves/wave103/wave103-final-integration-report.md](../waves/wave103/wave103-final-integration-report.md)（引き継ぎリスク A-3 / B-1 / accepted 含む）
- Required conventions: [../../development_convention/source-file-organization-policy.md](../../development_convention/source-file-organization-policy.md)、[../../development_convention/dependency-policy.md](../../development_convention/dependency-policy.md)、[../../development_convention/operation-policy.md](../../development_convention/operation-policy.md)、[../../development_convention/schema-and-id-conventions.md](../../development_convention/schema-and-id-conventions.md)

Known source facts（証拠パスは survey 文書内）:

- `evaluateViewerRuntimeSnapshot`（runtime-core、純依存、parameterOverrides 未指定可）。`NormalizedRuntimeGraph` を要求（変換の呼び出し形は未読 → Domain A 現状確認）。
- `RuntimeSnapshotDto` に RenderScene 構築素材（evaluatedMesh / draw order / opacity / masks / texture 参照）が揃う見込み（フィールド正式名は snapshot.ts 未読 → Domain A 現状確認）。
- render-software 公開 API: `renderSceneToPng` / `RenderRgba8TextureSource` / `resolveSoftwareRenderView` / 順逆座標変換（Wave103 成果）。
- `ai-read-command.ts` = 完成済み・未接続の read 機構（capability チェック・validatePackage 委譲込み）。executor の read 9 コマンドは現状 not_implemented 固定。
- validator-core は個別バリデータ群 + `buildValidationReport` + `getValidationProfileConfig` の集約構成（単一エントリポイント無し）。
- capability 一覧: `["read", "dryRunEdit", "commitWithApproval", "validate", "runScenario"]`。render 系は新設。

## 5. Wave Strategy

```text
Batch 1（並列）:
  Domain A: 知覚経路コア（評価アダプタ + renderView + コンタクトシート + サイドカー）
  Domain B: read 機構接続 + validatePackage + 103 小骨 2 本

Batch 2:
  Domain C: 測量コマンド + ref/ e2e（A の評価アダプタと B の read 経路に依存）

Batch 3:
  Domain D: Final Integration / Clean Review / Map Closeout
```

Dependency rationale: A と B は書き込みスコープが分離可能（A = 知覚スタック + renderView スキーマ、B = executor 統合 + validator 配線）。C は A のアダプタ・bbox ヘルパと B の read 経路の両方を消費するため Batch 2。

## 5.1 Domain Design

| Batch | Domain | Dependency | Gnome model | Purpose |
|---|---|---|---|---|
| 1 | A. Perception Command Core | Wave103 成果のみ | opus | session → runtime-core 評価 → RenderScene → PNG + サイドカーの全経路と `renderView` コマンド |
| 1 | B. Read Integration / Validate / Chores | Wave103 成果のみ | opus | `ai-read-command.ts` の executor 統合、`validatePackage` 実装、state-dir ガード、B-1 テスト |
| 2 | C. Measurement + ref e2e | A・B の pass | opus | `inspectEvaluatedGeometry` + ref/ e2e スモーク + ユーザー目視 gate 成果物 |
| 3 | D. Final Integration / Clean Review | A-C の pass | —（review 中心） | 最終検証・記録・地図 |

## 6. Domain A: Perception Command Core

Domain id: `wave104-perception-command-core`

Bounded 現状確認（Gnome 委任前に Orch-Sylph が確認、または Gnome の最初の作業として指定）:

- `packages/runtime-core/src/snapshot.ts` の `RuntimeSnapshotDto` フィールド正式名（evaluatedMesh / draw order / opacity / masks / texture 参照）。
- `packages/runtime-core/src/normalized-runtime-graph.ts` の `AuthoringGraph → NormalizedRuntimeGraph` 変換の呼び出し形。
- 空 `graph.parameters` での評価挙動（rest pose が返るか）。

Allowed write scope:

- `apps/authoring-host/**`（知覚アダプタ層: session → NormalizedRuntimeGraph → snapshot → RenderScene、テクスチャ供給、renderView 実装、サイドカー生成、コンタクトシート合成、bbox ヘルパ公開）
- `packages/ai-interface/src/**` — `renderView` の AiCommandName 追加、capability `render` 追加、payload/result スキーマ（純 zod）とテストに限る狭い追加。dependency-boundary の allowlist は変更しない
- ルート `package.json` — scripts 追加のみ
- Domain A report / review files

Conditional write scope requiring explicit report justification:

- `packages/runtime-core/src/**` — 変換/型の**狭い export 追加のみ**（評価挙動の変更は escalate）
- `packages/render-software/src/**` — 合成ヘルパ等の狭い追加のみ（既存描画意味論の変更は escalate）

Forbidden write scope:

- `apps/editor/**`（Editor Canvas 系の移植・共有化を含む）、`apps/runtime-player/**`
- `packages/render-webgl2/**`、`packages/operation-core/**`、`packages/validator-core/**`、`packages/package-format/**`
- ai-interface への render-core / render-software 依存の追加、boundary テスト緩和
- 新規外部依存 / lockfile 変更、Runtime Export 経由の知覚経路

Required implementation:

- 評価アダプタ: AuthoringSession → NormalizedRuntimeGraph → `evaluateViewerRuntimeSnapshot(parameterOverrides)` → `RuntimeSnapshotDto`
- シーンアダプタ: `RuntimeSnapshotDto` → RenderScene（draw order / opacity / visible / masks / texture 参照。§3.4 のテクスチャ寸法解決 + byteLength 検証込み）
- 評価済み bbox ヘルパ（drawable / rigControl 対象。Domain C が再利用する公開形）
- `renderView` コマンド: payload `{parameterOverrides?, view?（省略= モデル全体 | stageViewport | drawableFocus{drawableId, marginRatio?}）, outputWidth/Height, sweep?: {parameterId, steps}, outDir}` → PNG + サイドカー JSON をファイル出力し、応答 JSON にパスとメタデータを返す
- サイドカー: §3.2 の必須フィールド。スイープ時はセル対応表
- コンタクトシート: N 姿勢を決定論的レイアウトで 1 枚に合成

Required tests（rights-clean 合成フィクスチャ。フィクスチャは operations で組み立ててよい）:

- 合成パッケージの rest pose render golden（決定論 2 回実行バイト一致）
- parameterOverrides 指定時の変形反映 render
- drawableFocus フレーミング（評価済み bbox 由来の viewport 解決を数値検証）
- sweep → グリッド PNG + サイドカーのセル対応の正確性
- サイドカーのスキーマ・ビュー変換値の正確性（既知座標で photo↔stage 対応を検証）
- 空 parameters パッケージの rest pose render 成立
- テクスチャ寸法不整合（byteLength 不一致）の決定論的 reject
- ai-interface: renderView スキーマ・capability のユニットテスト、boundary テスト非緩和

Escalate if:

- NormalizedRuntimeGraph 変換が存在しない/評価挙動の変更を要する
- RuntimeSnapshotDto に RenderScene 構築素材が不足（mask / order の欠落）
- テクスチャ寸法の信頼できる源が graph に無い
- 空 parameters で評価が例外を投げる

## 7. Domain B: Read Integration / Validate / Chores

Domain id: `wave104-read-integration-validate-chores`

Allowed write scope:

- `packages/ai-interface/src/**` — executor から `executeAiReadCommand` への統合（read 系ディスパッチの差し替え）、関連テスト。boundary allowlist・承認ライフサイクルは変更しない
- `apps/authoring-host/**` — `AiReadCommandHost` 実装（`validatePackage` 必須。他 read メソッドは未実装のまま = 機構が not_implemented を返すことを確認）、CLI からの validate 到達、state-dir ガード
- `packages/render-software/src/**` — B-1（範囲外 triangle index スキップの専用テスト）の**テスト追加のみ**
- ルート `package.json` — scripts 追加のみ
- Domain B report / review files

Forbidden write scope:

- `apps/editor/**`、`apps/runtime-player/**`、`packages/validator-core/src/**` の挙動変更（消費のみ。狭い export 追加は justification 付き conditional）
- 承認ライフサイクル・dry-run 強制の緩和、boundary テスト緩和
- 新規外部依存 / lockfile 変更

Required implementation:

- executor 統合: read 系コマンドを `executeAiReadCommand` + optional read host 経由に接続（transcript 記録・capability チェックは既存機構のまま活きること）
- `validatePackage` host 実装: 現在の session graph に対し validator-core の個別バリデータ群を実行し `buildValidationReport` で `{reportId, report}` に集約（profile は payload の `ValidationProfileSchema` に従う）
- CLI: validate コマンドが exit code / JSON 応答で到達可能
- state-dir ガード: `--state-dir` がパッケージディレクトリ内を指す場合は決定論的に reject（Wave103 A-3）
- B-1 テスト（render-software、テストのみ）

Required tests:

- 統合後の executor: read 系が host 未実装メソッドで not_implemented、capability 不足で permission_denied、`validatePackage` 実装済みで ok を返す
- validatePackage: 健全な合成パッケージで pass 相当 report、既知の欠陥を仕込んだフィクスチャで該当診断を含む report
- 既存 88 テスト（ai-interface）の非退行、承認ライフサイクルテストの非退行
- state-dir ガードの reject ケース
- B-1: 範囲外 index の三角形がスキップされる専用テスト

Escalate if:

- validator オーケストレーションが editor 専用ロジックを要求する
- executor 統合が dry-run/commit ライフサイクルと衝突する

## 8. Domain C: Measurement + ref e2e（Batch 2）

Domain id: `wave104-measurement-ref-e2e`

Dependencies: Domain A（評価アダプタ・bbox ヘルパ）と Domain B（read 経路）の pass。

Allowed write scope:

- `apps/authoring-host/**`（`inspectEvaluatedGeometry` の host 実装、ref e2e テスト）
- `packages/ai-interface/src/**` — 測量コマンドの AiCommandName / payload / result スキーマ（純 zod）とテストに限る狭い追加
- `discussion/model-authoring/experiments/ref-render-gate/**`（PNG + サイドカー + README。**新規ディレクトリ**）
- ルート `package.json` — scripts 追加のみ
- Domain C report / review files

Conditional write scope requiring explicit report justification（2026-07-03 追記。Domain A 実装時の発見: 評価済み格子制御点座標は public snapshot（`EvaluatedRigControlDto` = bounds + transform のみ）に含まれない）:

- `packages/runtime-core/src/**` — **評価済み warp 格子制御点座標の狭い export 追加のみ**（内部で計算済みの値の公開。評価挙動・既存スナップショットフィールドの変更は escalate）。既存テストの非退行必須。
- 上記が非侵襲に実現できない場合の代替: 測量結果の warp 系を「bounds + rest 制御点（graph 由来）+ keyform offsets（graph 由来）」の組に縮退させ、評価済み絶対座標は提供しない。この縮退を採る場合は結果スキーマにその旨を明示し、ドメイン報告書に判断根拠を記録すること。

Conditional write scope 追記 2（2026-07-03。ref の per-layer texture dimensions 欠落 escalate への L0 裁定）:

- `apps/authoring-host/src/perception/texture-resolution.ts`（および付随テスト）— **§3.4 改訂の「検証付き導出」梯子の追加実装のみ**。導出候補源の選定は bounded 確認で決定し根拠を報告書に記録。byteLength 厳密検証なしの寸法採用は引き続き禁止。既存の declared-dimensions 経路・reject 経路の非退行必須。Domain A の他ファイルの再設計は禁止。

Forbidden write scope:

- **`ref/**` への一切の書き込み**（read-only フィクスチャ）
- Domain A/B が確定させた実装の再設計、新規外部依存 / lockfile 変更

Required implementation:

- `inspectEvaluatedGeometry`（§3.3。capability `read`、Domain A の bbox ヘルパ再利用、warp 系の格子制御点座標を含む）
- ref e2e スモーク（vitest、`ref/` を read-only で load）:
  1. CLI load → `validatePackage` 実行（report が返ること。診断内容自体は fail 条件にしない — ref は実運用モデルであり、診断の有無は記録対象）
  2. rest pose 全体像 + フォーカス 2-3 枚（顔・目元。drawableFocus または明示 viewport）を render → PNG + サイドカーを `discussion/model-authoring/experiments/ref-render-gate/` に出力
  3. 同一リクエスト 2 回でバイト一致（決定論）
  4. 測量スモーク: 代表 drawable 数個の評価済み bbox が有限値・妥当な包含関係を返す
  5. 実行時間の記録（非ブロッキング）
- `ref-render-gate/README.md`: 各 PNG の内容・生成コマンド・sidecarの読み方・「ユーザー目視 gate の対象物である」旨

Required tests: 上記 e2e 自体 + 測量コマンドのユニットテスト（合成フィクスチャで bbox/頂点/格子点の数値検証）。

Escalate if:

- ref/ の load が Domain A/B の実装で成立しない（パッケージ規模・形式差異による失敗）
- ref のテクスチャ寸法解決が §3.4 の方針で成立しない

## 9. Domain D: Final Integration / Clean Review（Batch 3）

Domain id: `wave104-final-integration-clean-review-map-closeout`

Wave103 Domain C と同型。Required checks:

- Domain A-C の report + 各レビューレーンの存在・pass
- focused テスト: authoring-host / ai-interface / render-software / runtime-core、および ref e2e
- `pnpm typecheck`、**`npx tsc --noEmit -p apps/authoring-host/tsconfig.json`（2026-07-03 昇格: root tsc は apps/ を対象にしないため、app 単位の型健全性を必須チェックとする）**、`node scripts/check-source-organization.mjs`、`node scripts/check-dependencies.mjs`（**cmo3 偽陽性 = pnpm-lock.yaml line 2486 の既知先行偽陽性として分類**。Wave104 由来の新規 finding ゼロを確認）、`git diff --check`
- Forbidden-scope diff check: Editor / Player / render-webgl2 / operation-core 挙動変更なし、boundary 非緩和、承認ライフサイクル非緩和、ref/ 無変更、新規依存なし
- 既知の先行 18 failed（clean HEAD 起因）の分類継続
- 最終統合報告書 / final clean integration review（独立 Review-Sylph）/ waves・reviews の `_map.md` / orchestration `_map.md` の Wave104 エントリ更新

## 10. Review Policy

Domain A / B / C それぞれに独立レビューレーン 3 本（Spec Compliance / Design・Development / Test Adequacy、すべて Review-Sylph, opus）。

Domain A Spec Compliance の明示確認項目: サイドカー必須フィールドの充足（特にビュー変換値の数値正確性）、決定論（2 回実行バイト一致の実再現）、drawableFocus の bbox 由来解決、Runtime Export 非経由、テクスチャ byteLength 検証の存在、boundary 非緩和。

Domain B Spec Compliance の明示確認項目: 承認ライフサイクル・dry-run 強制の非緩和（executor 統合後も）、transcript が read 系を記録し続けること、validatePackage の report が validator-core スキーマに適合、state-dir ガード、既存テスト非退行。

Domain C Spec Compliance の明示確認項目: ref/ が無変更であること（git status）、e2e 決定論、PNG + サイドカーの対応整合、README の目視 gate 説明、測量値の数値検証がオウム返しでないこと。

## 11. Verification Matrix

| Requirement | Minimum evidence |
|---|---|
| session 直接評価で PNG が得られる（Export 非経由） | Domain A golden + import 検査 |
| サイドカーで画像↔モデル座標の翻訳が成立 | Domain A ビュー変換数値テスト |
| コンタクトシートのセル↔パラメータ対応 | Domain A sweep テスト |
| stale 画像防止（revision 紐付け） | Domain A サイドカースキーマテスト |
| read 機構の正式接続 + validatePackage 実働 | Domain B 統合テスト |
| 承認ライフサイクル非緩和 | Domain B 非退行テスト + レビュー |
| 測量が正確な数値を返す | Domain C 合成フィクスチャ数値テスト |
| 実モデル（ref）で全経路が動く | Domain C ref e2e |
| 描画の正しさ（人間判定） | **wave 外: ユーザーが ref-render-gate/ の PNG を目視**（§3.5） |
| ref/ 無変更・新規依存ゼロ | Domain D guard + diff check |

## 12. Expected Persistent Artifacts

- `discussion/implementation/waves/wave104/wave104-domain-{a,b,c}-*-report.md`、`wave104-final-integration-report.md`、`_map.md`
- `discussion/implementation/reviews/wave104/wave104-domain-{a,b,c}-{spec-compliance,design-development,test-adequacy}-review.md`、`wave104-final-clean-integration-review.md`、`_map.md`
- `discussion/model-authoring/experiments/ref-render-gate/`（PNG + サイドカー + README）

## 13. Subagent Contract

- Orch-Sylph / Gnome / Review-Sylph の共通義務は Wave103 計画 §12 と同一。加えて **§3.7 のハンドリング規則を全階層に適用**（子はフォアグラウンドのみ、並列は 1 メッセージ複数呼び出し、model 明示指定、孤児禁止）。
- Orch-Sylph は担当ドメインの bounded 現状確認から開始し、実装は Gnome、レビューは独立 Review-Sylph 3 レーンに委譲。ループ上限 5、ユーザー判断の漏れ検知で即 escalate。
- Gnome: allowed scope 厳守、`pnpm install` 禁止（必要時 escalate → L0）、Basis Coverage Self-Report / Deferred Basis Items を含める。
- Review-Sylph: ソースとテストを自分で確認。boundary 緩和・承認ライフサイクル緩和・ref/ 変更・依存追加は blocking。

## 14. Out of Scope

- 閉問題 01 の実験実行そのもの（wave 完了後、model-authoring トピックの実験フェーズ）
- Editor Canvas 評価系との統合・乖離解消（記録のみ）
- 動的（dynamics）を含む描画・時間軸レンダリング、構造オーバーレイ（メッシュワイヤ・格子重畳 — 将来拡張として名前のみ確保）
- Runtime Export / Player / Editor UI の変更、PSD import 自動化
- read コマンドのうち validatePackage / inspectEvaluatedGeometry 以外の実装（getEditorState 等は not_implemented のまま）
- 新規外部依存、Cubism 互換
