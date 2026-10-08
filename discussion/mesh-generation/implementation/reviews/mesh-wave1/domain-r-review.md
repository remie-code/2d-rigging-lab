# Domain R レビュー（Review-Sylph 独立検証）

対象: Gnome「既存 baseline fail 是正」実装
委任元: Orch-Sylph（ドメイン R）
レビュアー: Review-Sylph（読み取り専任・テスト再実行あり）
日付: 2026-07-07
ブランチ: feature/2d-rigging-eco-system（WIP・他ドメイン並列稼働中）

---

## ループ/判定: **合格**

Gnome の是正は根本原因対応・スコープ遵守・厳密さ保持のすべてを満たす。対象10テスト green、残 fail は escalate 済み tutorial 4件のみ、mesh 無傷、typecheck / check:source / check:deps いずれも pass を**自分で再実行して確認**した。症状隠し・スコープ逸脱・検出力低下は検出されなかった。

要修正なし。ただし申し送り2件（末尾「質問/特記」）あり。

---

## 観点1: 根本原因対応 vs 症状隠し

### check:deps 精密化（合格）

`git diff scripts/check-dependencies.mjs` を精読。修正は「lockfile 全文への `pattern.test(lockfileText)`」を廃し、`collectLockfilePackageNames()` で **実 package 識別子だけを抽出**してから `forbiddenDependencyPatterns` を適用する方式（check-dependencies.mjs:69-146, 175-189）。

- `resolution:` / `integrity:` / `engines:` / `cpu:` / `os:` / `checksum:` の不透明値行を明示スキップ（base64 integrity ハッシュ内の偶発断片を除外）→ これが `truncate-utf8-bytes` の `cmo3` 誤マッチの根本原因を直接絶つ。症状隠しでなく原因除去。
- `forbiddenDependencyPatterns` の**中身は無改変**（検出意図を保持）。骨抜き・ゼロ化なし。
- scoped / peer 修飾子内の識別子も抽出（`extractPackageIdentifiers`, :138-146）。

**検出力の独立検証**（Gnome報告を鵜呑みにせず自分で実施）:
1. 一時 lockfile に本物の `cubism-core@1.0.0:` と scoped `'@live2d/cubism-framework@4.2.1':` を混入し、実 `check-dependencies.mjs` を実行 → **exit 1・両方を具体名付きで検出**（`... via cubism-core` / `... via @live2d/cubism-framework`）。精密化後も本物は捕捉できる。
2. 実リポジトリの `pnpm-lock.yaml`（`cmo3` 断片を含む）に対し実行 → **`Dependency guard passed.` / exit 0**（誤検知解消）。
3. self-test 追加3ケース（check-dependencies-guard-self-test.mjs:36-65）を精読 + 実行: real cmo3 pkg 検出 / scoped moc3 検出 / integrity 断片非検知、いずれも意図どおり。既存 `/live2d-runtime@1.0.0:`（v6形式）検出ケースも維持。

→ 誤検知だけを消し検出力は維持。合格。

### 追従漏れ10件の期待値更新（合格・厳密さ保持）

各 diff を精読。すべて「実出力への一致」であり、アサーション緩和（`toEqual→toContain`・assert 削除・skip 等）は**皆無**:

- validator 2件（rig-control-runtime-evidence.test.ts:411-423 / warp-lattice-diagnostics.test.ts:274-283）: `checks.map(...).toEqual([...])` の**厳密配列比較を維持したまま**、新 check `keyform.unsupportedTargetProperty` を先頭要素として**追加**。件数チェックを外していない（要素追加で件数 +1）。新 check は source 実在（`check-catalog.ts:1516`, `validators/parameter-keyform-package.ts:276`）で専用テスト `parameter-keyform-package.test.ts:59` が pin する意図的挙動 → 真の追従。
- fixture json: entryCount 系（+1 = preset catalog ファイル分）、semanticRole/projectPresetAlias 削除（custom parameter は非保持が確定仕様）、runtime parameterIds（preset catalog 全 34件+committed の実 dump 転記）、wave32 の targetId 除去 / `partId`→`opacityMultiplier` shape 変化。いずれも値の差し替えのみでフィールドを削って甘くしていない。
- `minimal-operation-fixture.test.ts:161` の型注釈から `semanticRole: string` 削除 → fixture データとの整合であり assertion 本体は不変（`git diff` で確認）。

**報告に itemize されていなかった fixture が1件**: `fixtures/contracts/runtime-grid2d-keyform-evidence/expected/runtime-grid2d-keyform-evidence-summary.json`（各 override に `baseValue` を追加、4箇所）。これは 356959c6 の runtime baseValue 追加への正当な追従で、対象テスト `runtime-grid2d-keyform-fixture.test.ts`（報告 line 102 で green と記載）に対応。値追加のみで厳密さ低下なし。報告の group1 リストへの記載漏れ（実害なし・下記特記1）。

---

## 観点2: スコープ遵守（合格）

`git status --short` / `git diff --stat` を照合:

- **lockfile / package.json**: 変更集合に**無し**（`git status | grep -iE "lock|package\.json"` → NONE）。依存無変更を明示確認。
- **tutorial recipe 系4テスト・recipe source**: 変更集合に**無し**（`grep -iE "tutorial|wave30|recipe"` → NONE）。escalate 済みを Gnome が勝手に直していないことを確認。
- **operation-core / validator-core / runtime-core の非テスト source .ts**: 変更**無し**（該当 grep で `.test.ts` のみがヒット、非テスト .ts はゼロ）。期待値更新なのに source を書き換える逸脱なし。
- Gnome が触れたのは allowed scope 内のみ: `check-dependencies.mjs` + self-test / fixtures expected json 8ファイル / 3 テストファイルの期待側。

### mesh 系・mesh-tool UI ファイルについて（逸脱ではない）

作業ツリーには mesh 系（`packages/authoring-core/src/mesh-generation*.ts`, `mesh-geometry/**`, v7 新規群）および mesh-tool UI（`apps/editor/.../mesh-tool-state.ts`, `mesh-tool-inspector.tsx`, `editor-session-context.tsx` 等）の変更が存在する。ただしこれらは **Domain A/B/C の並列 WIP**（mesh-generation v6/v7 実装・mesh-tool UI）であり、内容も baseline fail 是正とは無関係な大規模 mesh リファクタ（v6 -1466行規模の再編、v7 新設）。Domain R の是正（check:deps + テスト期待側）とは主題が別で、Gnome 報告も「一切触れていない」と明言。**Domain R 起因の逸脱ではない**と判断。
（注: 委任前提として他ドメイン並列稼働が明示されており、これらの WIP は R のレビュー対象外。R がこれらを壊していないことは観点3の mesh 全 green で担保。）

---

## 観点3: テスト再実行（自分で実行・合格）

| コマンド | 結果 |
|---|---|
| `npx vitest run packages/operation-core packages/validator-core packages/runtime-core --reporter=dot` | **728 passed / 4 failed**（732中）。fail 4件は**すべて escalate 済み tutorial**（`wave30-tutorial-mini-model-*`、理由 `operation.createParameter.duplicateParameter: param_mouth_open`）。対象10テスト該当パッケージに**それ以外の新規 fail ゼロ**。 |
| `npx vitest run packages/authoring-core --reporter=dot` | **276 passed / 276**（35 files 全 green）。mesh-generation 含め無傷。 |
| `node scripts/check-dependencies.mjs` | `Dependency guard passed.` **exit 0**。 |
| `node scripts/check-dependencies-guard-self-test.mjs` | **exit 1**。ただし fail は pre-existing 1件（`positive forbidden non-goal claim`）のみ。Gnome 追加3ケース含む他は pass（下記特記2）。 |
| 独立検出 spot-check（一時 lockfile に real cubism-core / @live2d 混入） | **exit 1・具体名付きで検出**。検出力維持を確認。 |
| `npx tsc --noEmit`（typecheck） | **exit 0**。 |
| `node scripts/check-source-organization.mjs`（check:source） | `Source organization guard passed.` **exit 0**。 |

対象10 green / tutorial 4 fail のみ / mesh 無傷 / typecheck OK / check:source OK / check:deps OK — Gnome 報告と完全一致。

---

## 観点4: 診断妥当性（合格）

- **#2 semanticRole 削除**: 根拠 `packages/package-format/src/parameter-presets.test.ts:75-76` の `expect(custom).not.toHaveProperty("semanticRole")` / `not.toHaveProperty("projectPresetAlias")` を実確認。custom parameter が両フィールド非保持である確定仕様と一致 → fixture からの両削除は妥当。
- **#8/#9 新 check**: `keyform.unsupportedTargetProperty` が source（check-catalog / validator）に実在し専用テスト `parameter-keyform-package.test.ts` が pin（該当テスト green は上記 728 pass に含まれる）→ 「新 check を足した」正当な追従であり「件数チェックを外した」ものでないことを確認。
- **追従漏れ vs escalate の切り分け**: 10件は source（committed f62cc2f4 / 356959c6）が正しくテスト期待が古い → 期待側更新で閉じる。tutorial 4件は `param_mouth_open` が preset catalog と衝突し `duplicateParameter` で reject する**設計非整合**で、fixture 更新だけでは閉じない（recipe/preset catalog の設計判断が必要）→ escalate 妥当。切り分けは適切。
- **#6 wave32 の diagnosis 差**: 実 diff は diagnosis 予期（entryCount/parameterIds 系）と異なり `part_root` targetId 除去 + rigControl の `partId`→`opacityMultiplier` shape 変化だった。いずれも committed source（operation-core / package-format、WIP 未変更）由来のため追従漏れ判断は妥当。source 未変更を観点2で確認済み。

---

## 質問/特記

1. **報告の記載漏れ（実害なし）**: `runtime-grid2d-keyform-evidence-summary.json`（baseValue 追加4箇所）が group1 の itemize リストに載っていない。実際の変更は正当（356959c6 追従）で対象テストも green だが、報告の網羅性として次回は列挙されたい。判定には影響しない。

2. **pre-existing self-test fail `positive forbidden non-goal claim`（Gnome 申し送りへの見解）**: Gnome の診断に同意。この fail は現行 `check-dependencies.mjs` に `.md`/claim 走査ロジックが存在しないことに起因し、Gnome の作業前から存在（`check:deps` npm script・vitest・check:source からは呼ばれず、Gate に非含）。Gnome の変更起因ではなく、追加3ケースは pass。**Domain R scope 外**であり、「claim 走査を再実装して規約に合わせる」か「規約・self-test 側から claim 走査要件を落とす」かは source/規約の設計判断を要する別タスク。R の合格判定を妨げない。Orch-Sylph から別ドメイン/別 escalate として扱うことを推奨。

3. 破壊的操作・修正は一切行っていない（読み取り + テスト/チェッカー run のみ）。

---

# 2ループ目レビュー（tutorial recipe の custom id 化）

レビュー担当: Review-Sylph（読み取り専任）／ 委任元: Orch-Sylph（ドメイン R・2ループ目）／ 日付: 2026-07-07

## 判定: **合格**

Gnome の2ループ目報告（domain-r-report.md :168 以降）どおり、ユーザー裁定(a)に忠実な最小 scope 修正であることを、diff・source・fixture・生成規則・全ゲート再実行で自ら確認した。テスト緩和・触るな指定違反・症状隠しはいずれも無し。

## 観点別検証結果

### 観点1: 裁定への忠実性・最小 scope（合格）

- **変更は主張どおり3ファイルに閉じている**。`git diff` で確認:
  - `packages/authoring-core/src/tutorial-mini-model-seed.ts`: `parameters.mouthOpen`（:76）`param_mouth_open`→`param_tutorial_mouth_open`、`keyformSets.mouthOpacity`（:91）が生成 keyset id を追従（`..._mouth_open_1`→`..._tutorial_mouth_open_1`）。この2行のみ。
  - `fixtures/.../wave30-.../expected/editor-state-readiness-evidence-summary.json`: opacityKeyform の id 追従1行。
  - `fixtures/.../wave30-.../expected/package-graph-summary.json`: opacityKeyformIds[0] 追従 + `driverParameterIds`→`inputParameterIds` リネーム。
- **触るな指定の無変更を `git status --porcelain` で確認**:
  - `packages/package-format/src/parameter-presets.ts`（catalog）→ 変更なし。preset id `param_mouth_open` は :67 に残存（`createWeightPreset("param_mouth_open", ...)`）。
  - `packages/operation-core/src/operations/create-parameter.ts`（重複判定）→ 変更なし。
  - `packages/operation-core/src/tutorial-mini-model-recipe.ts`（recipe 本体）→ 変更なし。payload は `TUTORIAL_MINI_MODEL_IDS` 定数参照のため自動追従する設計で、定数1点変更が正しいアプローチ（payload リテラル直変更なら keyform binding が旧 id を指して壊れる）。
- 3ファイルは 1ループ目変更集合（scripts/check-dependencies*.mjs, 1ループ目 fixtures, validator 2テスト等）とも並列ドメイン WIP（mesh 系・apps/editor mesh-tool UI）とも重複せず、切り分け済み。

### 観点2: 追加追従2件の妥当性（症状隠しでない・合格）

- **keyset id 追従**: `operation-ids.ts:116-125` の `addKeyform` 生成規則を自ら読了。id = `keyset_${target.kind}_${target.id}_${targetProperty}_${stripIdPrefix(parameterId,"param_")}_${keyValue}`。tutorial mouth opacity keyform（target=drawable/`draw_tutorial_mouth`/opacity, keyValue=1）に `param_tutorial_mouth_open` を与えると `keyset_drawable_draw_tutorial_mouth_opacity_tutorial_mouth_open_1` が生成される。fixture の新 id と完全一致。旧 id `..._mouth_open_1` は `packages/ fixtures/ apps/` 全域から消滅済み（grep 確認）。
- **`driverParameterIds`→`inputParameterIds` リネーム**: テストヘルパ `summarizePackageGraph`（`wave30-tutorial-mini-model-contract-fixtures.test.ts:177-181`）が実際に `dynamics: { dynamicsGroupId, inputParameterIds: dynamicsGroup.inputs.map(...), outputParameterId }` を生成することを自ら確認。fixture 側を実出力キー名に一致させた正当な staleness 解消。値 `["param_face_yaw","param_body_bob"]` は不変、`toEqual` アサーションは緩められていない（toContain 化・assert 削除・skip・キー削除いずれも無し）。recipe throw が custom id 化で解消され初めて到達した assertion による露見という Gnome の説明は整合的。旧キー `driverParameterIds` は fixture ディレクトリから消滅済み。

### 観点3: preset catalog 不変条件（合格）

- preset id `param_mouth_open` は catalog `parameter-presets.ts:67` に残存。
- preset 由来で `param_mouth_open` を使う consumer（apps/editor の parameter-manager/runtime-controls 系テスト、apps/runtime-player の live-mapping 系）は working tree で無変更（`git status --porcelain` に非該当）。これらは `TUTORIAL_MINI_MODEL_IDS`・tutorial keyset を参照しない独立使用で無影響。

### 観点4: テスト・チェッカー再実行（自ら実行、全 pass）

| コマンド | 結果 |
|---|---|
| `npx vitest run packages/operation-core packages/validator-core packages/runtime-core --reporter=dot` | **732 passed / 0 failed**（129 files）。tutorial 4件 green 化・他無傷 |
| `npx vitest run packages/authoring-core --reporter=dot` | **276 passed / 276**（35 files）。mesh 無傷・seed.ts 反映後も全 green |
| `npx vitest run --root apps/authoring-host --reporter=dot` | **82 passed / 82**（15 files）。tutorial consumer 自動追従確認 |
| `node scripts/check-dependencies.mjs` | `Dependency guard passed.` exit 0（1ループ目修正維持） |
| `node scripts/check-source-organization.mjs` | `Source organization guard passed.` exit 0 |
| `npx tsc --noEmit` | exit 0（エラーなし） |

Gnome 報告の件数（732/0, 276/276, 82/82, 全 checker pass）を独立に再現・一致確認した。

### 観点5: projectPresetAlias 残置の判断（合格・見解）

- `create-parameter.ts:70-78` を読了。handler は payload から `parameterId/displayName/valueSource/min/max/default/recommendedUiStep` のみを parameter へ転送し、`projectPresetAlias` を一切参照しない → **inert の主張は正しい**。重複判定も parameterId をキーにするため、alias は今回の fail に無関与。
- schema 上有効な optional フィールドで、tutorial の4 createParameter 呼び出しに一貫付与されている。mouthOpen 分だけ削除すると一貫性を壊し、4件一括削除は本 fail-fix wave の scope 超過。
- **見解: 残置は妥当**。inert かつ全ゲート green で無害が裏付けられており、alias の廃止/実装は将来の設計案件（「preset 初期化 operation」設計時）でまとめて扱うのが適切。本 wave では無改変が正しい判断。

## 質問/特記

1. **報告の網羅性**: 2ループ目報告は3ファイル・追加追従2件を正確に列挙しており、実 diff と齟齬なし。1ループ目レビューで指摘した記載漏れの類は本ループでは無し。

2. **pre-existing self-test fail `positive forbidden non-goal claim`**: 委任どおり本判定に含めていない（別タスク化確定）。今回の3ファイル変更は self-test に無関係で、Gnome も無改変。

3. 破壊的操作・修正・git 操作・pnpm install は一切行っていない（読み取り + テスト/チェッカー run のみ）。
