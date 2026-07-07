# Mesh Wave 1 Final Report(統合・全体検証・評価 gate 手順)

> 作成: Gnome(実装)。委任元: Orch-Sylph(Mesh Wave 1 Domain D「Final Integration / Clean Review / Map Closeout」)。
> 日付: 2026-07-07
> ブランチ: feature/2d-rigging-eco-system(WIP)
> 位置づけ: Mesh Wave 1 の全ドメイン(A/B/C/R)実装完了・レビュー合格後の統合報告。この文書の「ユーザー目視評価 gate」節が wave 完了後の次アクションの正。

---

## 判定: Mesh Wave 1 実装フェーズ完了(ユーザー目視評価待ち)

全ドメイン(A/B/C/R)が実装完了・Review-Sylph 合格。統合(Domain D)でトグルラベルを v6/v7 に確定し、モノレポ全体検証を実施。mesh 起因の新規 fail はゼロ。残る apps/editor の 4 fail は mesh 非起因の既知 baseline(wave106 P3)。

コードは「実装完了」だが、**v7 が v6 と同等以上の商用風出力になっているか**はコードで判定できない設計事項であり、ユーザー目視評価 gate(本文書末尾)を経て初めて Mesh Wave 2(v6削除)へ進める。

---

## 1. 全ドメイン要約

### Domain A: 中立部品抽出(`mesh-wave1-neutral-geometry`)

- **判定**: completed / **ループ**: 1 / **レビュー**: 合格
- **要点**: v6系ファイルに埋まっていたアルゴリズム中立部品を新設 `packages/authoring-core/src/mesh-geometry/**`(9ファイル)へ抽出し、v6系3ファイル(`mesh-generation-v6-contour-pipeline.ts` / `mesh-generation-v6-alpha-islands.ts` / `mesh-outline-generation.ts`)を import 委譲に切替。抽出は「純粋な移動 + 委譲」のみで v6 の数値挙動は座標同一保存。expandMask の 8px 上限クランプと farthest-point の間隔R を中立側でパラメータ化(v6 経路は既定値を渡して不変)。
- **テスト**: `mesh-generation.test.ts` 76/76(v6決定性回帰14個が exact 座標 `toMatchObject` で座標同一)、authoring-core 260/260(抽出前248 + 中立smoke12)、generate-mesh.test.ts 34/34、typecheck/check:source pass。
- 報告: [domain-a-report.md](domain-a-report.md) / レビュー: [domain-a-review.md](../../reviews/mesh-wave1/domain-a-review.md)

### Domain B: v7 コア(`mesh-wave1-v7-core`)

- **判定**: completed / **ループ**: 1 / **レビュー**: 合格(設計適合レーン + テスト妥当性レーンの2レビュー)
- **要点**: concept-design §2-4 のパイプラインを、Domain A の中立モジュール + `delaunator` + `@kninnug/constrainautor` のみに依存する自己完結構成で新規実装(v7ファイル6本)。v6系ファイルを import しない。契約に V7系統(method/source/backend/dependency ID・candidate・fallback reason・helper)を新設分離、ディスパッチャに v7 分岐を追加、v7 blocked 時は既存 v6d-adaptive 連鎖へ接続。距離変換による細長抑制・多島独立サブメッシュ化・穴埋め・内部点のみ Lloyd 2回。preview スキーマ(`model-edit.ts` の v6Metrics 枠)は無変更、v7 診断は provenance のみ。
- **テスト**: v7新規 16/16(全不透明ピクセルフルスキャンの被覆保証・ε<r 全プリセット×5サイズ・決定性5フィールド完全一致・細長抑制・多島・穴埋め・UV/零面積・フォールバック)、mesh-generation.test.ts 76/76(v6座標同一維持)、authoring-core 276/276(260 + v7新規16)、generate-mesh.test.ts 34/34、typecheck/check:source pass。
- 報告: [domain-b-report.md](domain-b-report.md) / レビュー: [design](../../reviews/mesh-wave1/domain-b-review-design.md) / [tests](../../reviews/mesh-wave1/domain-b-review-tests.md)

### Domain C: 世代切替UI(`mesh-wave1-generation-ui`)

- **判定**: completed / **ループ**: 1 / **レビュー**: 合格
- **要点**: v6/v7 method トグル UI を apps/editor に追加(選択肢は定数2件配列 `MESH_GENERATION_METHOD_CHOICES`・`{ method, label }`)。method 依存を「トグル section 1ブロック + state + preview 呼び出しへの受け渡し」に閉じ、UI 全体に散らさない。v6削除時は「配列1行削除 + section 撤去」で評価機構が消える薄さ。既定は先頭 = v6d-adaptive で既存 provenance 挙動を保つ。プリセット largeMotion/standard/lowMotion → densityHint high/medium/low の写像は既存を無変更で使用。`packages/**` 無変更。
- **変更ファイル**: `mesh-tool-state.ts` / `editor-session-context.tsx` / `mesh-tool-inspector.tsx` / `mesh-tool-state.test.ts`(変更)、`mesh-tool-generation-method.test.ts`(新規)。
- **テスト**: mesh-tool 系 19/19(state 5 + inspector 11 + generation-method 3)、隣接回帰 47(context-history 25 / commands 17 / auto-refit 5)。typecheck(触ったファイルで新規エラーゼロ・stash 検証済み)/check:source pass。
- 報告: [domain-c-report.md](domain-c-report.md) / レビュー: [domain-c-review.md](../../reviews/mesh-wave1/domain-c-review.md)

### Domain R: 既存 baseline fail 是正(baseline 是正)

- **判定**: completed / **ループ**: 2(1: check:deps 誤検知 + 追従漏れ10テスト / 2: tutorial recipe custom id 化)/ **レビュー**: 合格(両ループ)
- **要点(ループ1)**: `check-dependencies.mjs` の lockfile 検査を「全文正規表現」から「実 package 名だけ抽出して判定」へ精密化(integrity ハッシュ内 `cmo3` 断片の誤検知を根本除去、検出力は self-test で維持)。source 新挙動への追従漏れテスト10件(8 fixture json + validator 2テスト)を実出力へ一致(緩めていない)。
- **要点(ループ2)**: ユーザー裁定(a)により tutorial recipe の mouth_open parameter を preset catalog id `param_mouth_open` から custom id `param_tutorial_mouth_open` へ変更(seed 定数2件 + fixture 2ファイル)。preset catalog・重複判定 source は無改変。`projectPresetAlias` は inert のため無改変で残置(将来設計案件)。
- **テスト**: operation/validator/runtime-core 728/4 → **732/0**(tutorial 4件 green 化)、authoring-core 276/276、authoring-host 82/82、typecheck/check:source/check:deps pass。
- 報告: [domain-r-report.md](domain-r-report.md) / レビュー: [domain-r-review.md](../../reviews/mesh-wave1/domain-r-review.md)

### Domain D: 統合(本文書)

- **判定**: completed / **ループ**: 1
- **唯一の source 変更**: トグルラベル `MESH_GENERATION_METHOD_CHOICES` の v6d-adaptive method の label を `"Current"` → `"v6"`(v7 側はそのまま)。ユーザー裁定「トグルラベルは v6/v7」に対応。
- 詳細: [domain-d-report.md](domain-d-report.md)

---

## 2. 統合検証結果(Domain D 実測・全体 green)

リポジトリルートから実行した実数値:

| 検証 | コマンド | 結果 |
|---|---|---|
| authoring-core | `pnpm exec vitest run packages/authoring-core` | **276 passed / 0 failed**(35 files) |
| operation/validator/runtime-core | `pnpm exec vitest run packages/operation-core packages/validator-core packages/runtime-core` | **732 passed / 0 failed**(129 files) |
| authoring-host | `pnpm run test:authoring-host` | **82 passed / 0 failed**(15 files) |
| apps/editor | `pnpm exec vitest run apps/editor` | **435 passed / 4 failed**(58 files 中 1 failed) |
| typecheck | `pnpm run typecheck`(tsc --noEmit) | **pass**(exit 0) |
| check:deps | `pnpm run check:deps` | **pass**(`Dependency guard passed.` / exit 0) |
| check:source | `pnpm run check:source` | **pass**(`Source organization guard passed.` / exit 0) |

- ラベル差替後に mesh-tool 系トリオ(state / inspector / generation-method)を再確認 → **19/19 green**(ラベルはデータ駆動で、"Current"/"v6" のいずれの文言にもテスト依存なし)。
- check:deps は Domain R 1ループ目の誤検知是正により pass(過去の domain A/B 報告時点の「check:deps fail 既存」はこの是正で解消済み)。

---

## 3. 既知事項

### (a) self-test の claim 走査未実装(別タスク化済み・触れていない)

`scripts/check-dependencies-guard-self-test.mjs` の 1ケース `positive forbidden non-goal claim`(`.md` 内の肯定的 non-goal 主張の検出)が pre-existing で fail する。原因は現行 `check-dependencies.mjs` に `.md`/claim 走査ロジックが存在しないこと。この self-test は npm script `check:deps`(= `check-dependencies.mjs` のみ実行)・vitest・check:source のいずれからも呼ばれず、全体検証ゲートに非含。ユーザー裁定で別タスク化済み(claim 走査を再実装するか規約から要件を落とすかの設計判断)。本 wave では触れていない。

### (b) apps/editor の既存 baseline fail 4件(mesh 非起因)

`apps/editor/src/workspace/diagnostics/diagnostics-jump-actions.test.ts` の 4件が fail する。

- **失敗内容**: `setActiveEntry` spy が `"import"` で呼ばれることを期待するが、entry 名が `"import" → "workspace"` にリネームされた後の実装と食い違う(`expected "spy" to be called with arguments: [ 'import' ]`)。
- **mesh 非起因の根拠**: (1) `diagnostics-jump-actions.ts`(source)も同テストも working tree で無変更(HEAD のまま・`git status` で確認)、mesh のどのドメインも触れていない。(2) 同テストは `mesh-tool-state.ts` / `MESH_GENERATION_METHOD_CHOICES` に一切依存せず、Domain D のラベル1行変更とは無関係。(3) wave106 final integration report の **P3** に「editor テスト赤4件(`diagnostics-jump-actions.test.ts`、entry 名 `"import"→"workspace"` リネーム由来。実装・テストとも wave106 未変更。HEAD `6645c2fe` コミット済み。後続)」として既に記録済みの既知 baseline。
- **扱い**: mesh Wave の scope 外。後続 wave が entry 名リネームの追随を完了させるべき既存課題。Domain D では無断修正しない。

### (c) v7 の `computeMeshQualityMetrics`(V6型参照)依存 = Mesh Wave 2 の入力

v7 backend は品質メトリクス計算に統合層ヘルパ `computeMeshQualityMetrics`(`mesh-quality-metrics.ts`、V6型を参照)を純幾何オプションのみで呼ぶ。これは v6"バックエンド"ではなく統合層の共有ヘルパであり、v7 は v6Metrics 系を一切触れないため設計適合(Domain B design review で確認済み)。ただし Mesh Wave 2(v6削除)計画時、この共有ヘルパが V6型定義を持つため v6削除の対象になり得るか=v7 が孤立しないかを検討する必要がある(Mesh Wave 2 の入力)。

### (d) projectPresetAlias / preset 初期化 operation は将来設計案件

tutorial の createParameter 呼び出しに一貫付与される `projectPresetAlias` は現状 inert(handler が参照しない)だが schema 上は有効。「preset をそのまま初期化する operation」の新設と併せて将来設計案件(Domain R 由来)。本 wave では無改変。

---

## 4. ユーザー目視評価 gate の手順(wave 外・最重要)

Mesh Wave 1 完了後の次アクション。コードでは判定できない「v7 が商用風出力として v6 と同等以上か」をユーザーが目視で評価する。合格して初めて Mesh Wave 2(v6削除)へ進む。

### 手順

1. **髪など有機的パーツで生成する**(毛先・房のある有機的シルエットが3特徴の差が最も出る対象)。
2. **世代トグル v6/v7 を比較する**(Mesh Tool インスペクタの Generation トグルで v6 ⇔ v7 を切替、同一 drawable で見比べる)。
3. **3プリセットを比較する**: largeMotion(大きく動く = high)/ standard(標準 = medium)/ lowMotion(あまり動かない = low)の3つで頂点密度の違いを確認する。
4. **3特徴のゲシュタルトを商用参照画像と目視突合する**。次の3つが**揃って初めて「同等」と認知される**(個別に実現しても意味がない):
   1. マージン付き簡略輪郭(シルエットの外側に r のマージンを取った、簡略化された滑らかな外周)
   2. 疎な頂点(少ない三角形)
   3. 毛先の粗い包み(細部を忠実に分割せず、少数の細長い三角形でざっくり包む)
5. **v7 パラメータ初期値の調整要否を判断する**。以下は工学的出発点であり、評価で調整する前提:
   - `r = clamp(0.012 × max(texW, texH), 4px, 16px)`(マージン半径・全プリセット共通)
   - `ε = 0.8 × r`(DP 簡略化許容誤差・ε < r 結合則)
   - `L = 12(大きく動く)/ 18(標準)/ 28(あまり動かない)px`(頂点間隔・プリセットが動かす唯一の値)

### 評価の合意事項(未決)

「何をもって v7 の品質が高い(= v6削除可)とするか」の品質評価基準は、評価フェーズ入口でユーザーと合意する(mesh-generation/_map.md 未決事項)。

---

## 5. 評価合格後の次段: Mesh Wave 2(v6削除計画)

ユーザー目視評価が合格したら、v6 削除を Mesh Wave 2 として計画する。対象:

- **v6ファイル群**: `mesh-generation-v6*.ts`・関連バックエンド群。ただし v6/v1〜v4 の決定性回帰テストとの依存関係、及び中立モジュール(`mesh-geometry/**`)が v7 と共有される点に注意。
- **v6 method 定数**: 契約の V6系統(method/source/backend/dependency ID・candidate)。
- **トグル**: `MESH_GENERATION_METHOD_CHOICES` の v6 行削除(配列1行)+ `mesh-tool-inspector.tsx` の `mesh-tool-generation-toggle` section 撤去。Domain C が「配列1行 + section 撤去」で消える薄さを担保済み。
- **`computeMeshQualityMetrics` の V6型依存**: 上記既知事項(c)。この共有ヘルパが v6削除対象になり得るか=v7 が孤立しないかを Mesh Wave 2 計画の入力として検討する。

---

## 参照

- 概念設計(正): [concept-design.md](../../../concept-design.md)
- wave 計画: [mesh-wave1-plan.md](../../orchestration/mesh-wave1-plan.md)
- 各ドメイン報告: [A](domain-a-report.md) / [B](domain-b-report.md) / [C](domain-c-report.md) / [R](domain-r-report.md) / [D](domain-d-report.md)
- 各ドメインレビュー: [A](../../reviews/mesh-wave1/domain-a-review.md) / [B-design](../../reviews/mesh-wave1/domain-b-review-design.md) / [B-tests](../../reviews/mesh-wave1/domain-b-review-tests.md) / [C](../../reviews/mesh-wave1/domain-c-review.md) / [R](../../reviews/mesh-wave1/domain-r-review.md)
