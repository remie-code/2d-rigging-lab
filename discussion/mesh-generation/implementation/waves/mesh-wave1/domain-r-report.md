# Domain R 実装報告（既存 baseline fail 是正）

担当: Gnome（実装）／ 委任元: Orch-Sylph（ドメイン R）
ブランチ: feature/2d-rigging-eco-system（WIP あり・他ドメイン並列稼働中）
日付: 2026-07-07

## サマリ

診断済みの「安全に修正可能」な baseline 既存 fail のみを是正した。対象2種:
1. `check:deps`（check-dependencies.mjs）の lockfile 誤検知（1件）
2. source 新挙動への追従漏れテスト（10テスト / 8 files）

対象外の tutorial recipe 系4テスト（escalate 済み・設計非整合）には一切触れていない。mesh 系・mesh-tool UI にも触れていない。source（operation-core / validator-core / runtime-core の非テスト .ts）は一切変更していない。

Gate はすべて満たした（詳細は末尾）。

---

## 変更ファイル一覧と変更要旨

### 対象1: check:deps 誤検知修正

- `C:\workspace\remie\code\ai-native-live2d-editor\scripts\check-dependencies.mjs`
  - lockfile 検査を「pnpm-lock.yaml 全文への正規表現 `.test()`」から「**実際の依存パッケージ名だけを抽出して判定**」する方式に精密化。
  - 追加関数 `collectLockfilePackageNames(lockfileText)`: lockfile を行単位に走査し、
    - `resolution:` / `integrity:` / `engines:` / `cpu:` / `os:` / `checksum:` などの**不透明値行を明示的にスキップ**（base64 integrity ハッシュ等のノイズを除外）。
    - `packages:` / `snapshots:` セクションのキー行（`  '@scope/pkg@1.2.3(...)':` / `  pkg@1.2.3:` / 旧 v6 の `  /pkg@1.2.3:`）から package 名を抽出。
    - snapshot の依存行（`      dep-name: 1.2.3(peer@4.5.6)`）のキー名、および peer 修飾子内の `name@version` も抽出。
  - 補助関数 `extractPackageIdentifiers(text)`: 文字列中の `name@version`（scoped 含む・peer 括弧内含む）から package 名を取り出す。
  - lockfile 走査ブロック（旧 :101-109）は、抽出した package 名集合に対してのみ `forbiddenDependencyPatterns` を適用するよう置換。reason 単位で重複排除し、`... via <packageName>` を付して具体名を報告。
  - **変更していない**: manifest 側の `checkDependencyName`（依存名を直接見る）、`forbiddenAssetPatterns`（ファイルパス判定）、`forbiddenDependencyPatterns` の中身（規約の検出意図を保持）。

- `C:\workspace\remie\code\ai-native-live2d-editor\scripts\check-dependencies-guard-self-test.mjs`
  - 回帰担保のため self-test に3ケースを追加:
    1. `forbidden lockfile mention via real cmo3 package name (v9)`（`cmo3-parser@2.3.4:` を検出できること）
    2. `forbidden lockfile mention via scoped moc3 package name (v9)`（`'@vendor/moc3-loader@1.0.0':` を検出できること）
    3. `lockfile integrity-hash substring is not a false positive`（今回のバグ本体。`truncate-utf8-bytes` の integrity ハッシュ内 `cmo3` 断片で誤検知しないこと = exit 0）
  - 既存の `forbidden lockfile mention`（旧 v6 `/live2d-runtime@1.0.0:` 検出）ケースはそのまま維持。

### 対象2: 追従漏れテストの期待値/fixture 更新（source は不変。期待側のみを実挙動へ一致）

group1（fixture 形状 diff）:

1. `C:\workspace\remie\code\ai-native-live2d-editor\fixtures\contracts\imported-source-package-evidence-preview-consistency\expected\imported-source-package-evidence-preview-consistency-summary.json`
   - `packageFileSet.entryCount` 33 → 34（preset catalog ファイル分 +1）。
   - （テスト `packages\operation-core\src\imported-source-package-evidence-preview-consistency.test.ts` の source は不変。`toMatchObject` の期待 fixture のみ更新。）

2. `C:\workspace\remie\code\ai-native-live2d-editor\fixtures\contracts\minimal-operation-create-parameter\expected\commit-summary.json`
   - committed custom parameter の `semanticRole: "mouth"` を削除（custom parameter は semanticRole を持たない確定仕様。`parameter-presets.test.ts:75` が根拠）。
   - あわせて `C:\workspace\remie\code\ai-native-live2d-editor\packages\operation-core\src\minimal-operation-fixture.test.ts` の型注釈 `CommitSummaryFixture.addedParameter` から `semanticRole: string` を削除（fixture データと型注釈の整合。アサーション自体は不変）。

3. `C:\workspace\remie\code\ai-native-live2d-editor\fixtures\contracts\minimal-operation-persisted-package\expected\package-file-set-summary.json`
   - `entryCount` 20 → 21、`authoredEntryCount` 13 → 14（preset catalog ファイル分 +1）。

   `C:\workspace\remie\code\ai-native-live2d-editor\fixtures\contracts\minimal-operation-persisted-package\expected\reload-summary.json`
   - committed custom parameter の `semanticRole: "mouth"` と `projectPresetAlias: "private-persisted-smile-control"` を削除（custom parameter は preset alias/semanticRole を持たない確定仕様）。
   - 注記: 同テストの `reloadedDocument.model.parameters.parameters` は length 1 のまま（preset catalog は persisted model parameters ではなく runtime/surface 概念のため。diagnosis の「parameterIds 全部入り」は runtime snapshot 側の話であり、この persisted reload summary には該当なし。実挙動を精密に確認した結果、変更が必要だったのは上記2フィールドのみ）。

4. `C:\workspace\remie\code\ai-native-live2d-editor\fixtures\contracts\rig-control-keyform-angle-operation\expected\package-materialization-summary.json`
   - `materializedPackage.fileSetEntryCount` 18 → 19（preset catalog ファイル分 +1）。他フィールドに diff なし（実挙動を精密確認）。

5. `C:\workspace\remie\code\ai-native-live2d-editor\fixtures\contracts\minimal-operation-runtime-evidence\expected\runtime-snapshot-summary.json`
   - `baselineSnapshot.parameterIds` []（0件）→ preset catalog 全 34件。
   - `candidateSnapshot.parameterIds` [`param_fixture_smile`]（1件）→ preset catalog 34件 + `param_fixture_smile` = 35件。
   - packageRevision 等の base 値・その他フィールドは不変（実際の runtime 出力を dump して parameterIds 配列のみを厳密に転記）。
   - （テスト source `runtime-validation-evidence-fixture.test.ts` は不変。2 assertion 両方 green 化。）

6. `C:\workspace\remie\code\ai-native-live2d-editor\fixtures\contracts\wave32-warp-lattice2d-contract-fixtures\expected\operation-chain-summary.json`
   - `operations[0].targetIds`（`createWarpLattice2dRigControl`）から `part_root` を削除（現 source は `["rig_wave32_body_warp_lattice"]` のみを targets として報告）。

   `C:\workspace\remie\code\ai-native-live2d-editor\fixtures\contracts\wave32-warp-lattice2d-contract-fixtures\expected\package-materialization-summary.json`
   - `rigControl` オブジェクトを実 materialize 出力に一致させた: `partId` を削除し `opacityMultiplier: 1` を追加（warpLattice2d rig control の model schema 進化。`opacityMultiplier` は committed source `packages\package-format\src\model-files.ts` / `packages\operation-core\src\operations\*` に定義済み。WIP 未変更）。
   - 他2 assertion（runtime-viewer-evidence-summary.json / validation-report-summary.json）は実出力と一致（差分なし・未変更）。
   - 補足（diagnosis との差）: diagnosis は #6 について「entryCount/authoredEntryCount +1・parameterIds 増」を予期していたが、実際の diff はそれらではなく `part_root` targetId 除去と rigControl の `partId`→`opacityMultiplier` shape 変化だった（diagnosis も「更新箇所がやや広い可能性あり」と注記）。いずれも committed source（operation-core / package-format、WIP 未変更）由来のため追従漏れと判断し期待側のみ更新。source は触っていない。

group3（validator 新 check 追加）:

7. `C:\workspace\remie\code\ai-native-live2d-editor\packages\validator-core\src\rig-control-runtime-evidence.test.ts`
   - "reports unsupported warp lattice property..." の期待配列に、新 check `keyform.unsupportedTargetProperty`（`targetPath: /model/keyforms/keyformSets/0/target`、evidence: keyformSetId/targetKind/targetId/targetProperty）を**先頭要素**として追加。既存 `rigControl.warpLatticeUnsupportedProperty` は第2要素として維持。実出力の順序に一致。

8. `C:\workspace\remie\code\ai-native-live2d-editor\packages\validator-core\src\warp-lattice-diagnostics.test.ts`
   - "reports unsupported warp lattice keyform property" ケースの期待配列に、同じ新 check `keyform.unsupportedTargetProperty` を**先頭要素**として追加（期待1→実際2件）。

（新 check `keyform.unsupportedTargetProperty` は専用テスト `packages\validator-core\src\parameter-keyform-package.test.ts` が green で通す確定した意図的挙動。）

---

## Gate 実行結果

### Gate 1: 対象10テスト + check:deps green

コマンド: `npx vitest run packages/operation-core packages/validator-core packages/runtime-core --reporter=dot`

- 結果: **728 passed / 4 failed（129 files 中 4 failed）**。
- 対象10テスト（8 files）: **すべて green**（このドメインの pass 件数は 718 → 728 に +10）。
  - imported-source-package-evidence-preview-consistency.test.ts ✓（2/2）
  - minimal-operation-fixture.test.ts ✓（3/3）
  - persisted-operation-evidence-fixture.test.ts ✓（1/1）
  - rig-control-keyform-operation-fixture.test.ts ✓（4/4）
  - runtime-validation-evidence-fixture.test.ts ✓（3/3、対象の2 assertion 含む）
  - wave32-warp-lattice2d-contract-fixtures.test.ts ✓（2/2）
  - runtime-grid2d-keyform-fixture.test.ts ✓（1/1）
  - rig-control-runtime-evidence.test.ts ✓（7/7）
  - warp-lattice-diagnostics.test.ts ✓（14/14）
- 残る 4 failed は **すべて escalate 済みの tutorial recipe 系**（意図的に未修正のまま fail）:
  - operation-core/src/wave30-tutorial-mini-model-contract-fixtures.test.ts
  - operation-core/src/wave30-tutorial-mini-model-recipe.test.ts
  - runtime-core/src/wave30-tutorial-mini-model-contract-fixtures.test.ts
  - validator-core/src/wave30-tutorial-mini-model-contract-fixtures.test.ts
  - 失敗理由はいずれも同一: `operation.createParameter.duplicateParameter: Parameter already exists: param_mouth_open`（preset catalog と `param_mouth_open` の設計非整合）。私は触れていない。
- **新規 fail ゼロ**（私の変更起因で新たに壊れたテストは無し。fail は escalate 済み4件のみ）。

コマンド: `node scripts/check-dependencies.mjs`（= `pnpm run check:deps`）
- 結果: **`Dependency guard passed.` / exit 0**。

### Gate 2: 新規 fail ゼロ
- 上記のとおり、私の変更で新規に壊れたテストは無い。ドメイン3パッケージの fail は escalate 済み4件だけで、これは委任前から既知。

### Gate 3: mesh 系無傷
コマンド: `npx vitest run packages/authoring-core --reporter=dot`
- 結果: **276 passed / 276（35 files 全 pass）**。mesh-generation.test.ts（76 tests）含め全 green。
- 私は mesh を一切触っていないため影響なし。新規 fail ゼロを確認。

### Gate 4: typecheck
コマンド: `npx tsc --noEmit`（= `pnpm run typecheck`）
- 結果: **exit 0（エラーなし）**。

### Gate 5: check:source
コマンド: `node scripts/check-source-organization.mjs`（= `pnpm run check:source`）
- 結果: **`Source organization guard passed.` / exit 0**。

---

## check:deps 修正の検出力担保（本物の cmo3/moc3/live2d を今後も検出できること）

2方向で担保した:

1. **self-test への回帰ケース追加**（`scripts/check-dependencies-guard-self-test.mjs`、上記対象1参照）。
   - 実 package 名 `cmo3-parser@2.3.4:`（v9）と scoped `'@vendor/moc3-loader@1.0.0':`（v9）を**検出できること（exit 1）**を pin。
   - 旧 v6 形式 `/live2d-runtime@1.0.0:` の検出（既存ケース）を維持。
   - integrity ハッシュ内の `cmo3` 断片で**誤検知しないこと（exit 0）**を pin（バグ本体の回帰ガード）。

2. **一時的な多ケース検証スクリプト**（scratchpad、コミット対象外）で以下を実挙動確認済み（すべて期待どおり）:
   - v9 real cmo3 package key → 検出
   - v9 scoped moc3 package key → 検出
   - v9 cmo3 が snapshot dependency 行にある → 検出
   - v9 cubism が peer 修飾子 `(cubism-core@3.0.0)` にある → 検出
   - integrity ハッシュ内の cmo3 断片（本バグ）→ 非検出
   - hash 内の model3/moc3/cubism 断片 → 非検出

規約 `discussion/development_convention/dependency-policy.md` の検出意図（本物の Cubism/cmo3/moc3/live2d/model3/motion3/physics3/pose3 依存を flag する）は `forbiddenDependencyPatterns` 自体を無改変とすることで保持。誤検知を消すために検出力を落とすことはしていない。

---

## 質問・特記事項（Orch-Sylph への申し送り）

1. **既存の self-test 事前 fail（私の対象外・要判断）**: `scripts/check-dependencies-guard-self-test.mjs` は私の作業前から1ケース `positive forbidden non-goal claim`（`.md` 内の "Cubism compatibility is implemented" 等の肯定的 non-goal 主張の検出）が **fail** している（`expected exit 1, got 0`）。
   - 原因: 現行 `check-dependencies.mjs` には `.md`/claim 走査ロジックが存在しない（過去に削除されたか、self-test 側だけ古い意図を持ち越している）。`dependency-policy.md` §「Current Automated Guard Entry Points」:51/53 はこの claim 走査を記述しているが、実装が伴っていない。
   - この self-test は私の Gate（`check:deps` npm script は `check-dependencies.mjs` のみ実行）には含まれず、vitest / check:source からも呼ばれない。よって私の変更起因ではなく、私が追加した3ケースは pass している（唯一の fail は上記の pre-existing 1件のみ）。
   - **判断依頼**: これは「claim 走査を再実装して規約に合わせる」か「規約とテストから claim 走査要件を落とす」かの**方針判断**を要する別問題（source/規約の設計判断）。私の Domain R scope（診断済み安全修正のみ）を超えるため手を付けていない。別ドメイン/別タスクとして扱うか要判断。

2. **診断と実 diff の差（#6 wave32）**: 上記「6.」の補足のとおり、wave32 fixture の実 diff は diagnosis 記載（entryCount/parameterIds 系）とは異なり、`part_root` targetId 除去と rigControl の `partId`→`opacityMultiplier` shape 変化だった。いずれも committed source（WIP 未変更の operation-core/package-format）由来のため「追従漏れ」と判断し期待側のみ更新した。source 変更は不要だったため escalate ではなく修正で閉じている。念のため申し送る（committed source の rigControl schema 進化を前提とした fixture 更新である旨）。

3. 環境問題・依存欠落等は無し。依存の追加/削除・lockfile 変更・`pnpm install` は一切していない。コミット/stash/checkout も一切していない（作業ツリーに変更を残すのみ）。write scope 外（mesh 系・mesh-tool UI・対象10テストの source .ts）は変更していない。

---

# 2ループ目: tutorial recipe の custom id 化（baseline fail 残り4件の是正）

担当: Gnome（実装）／ 委任元: Orch-Sylph（ドメイン R・2ループ目）
日付: 2026-07-07

## ユーザー裁定(a)の記録

1ループ目で escalate した tutorial recipe 系4テストの fail（`operation.createParameter.duplicateParameter: Parameter already exists: param_mouth_open`）について、2026-07-07 にユーザー裁定(a)が確定した:

- **recipe 側を直す**。tutorial recipe の mouth_open parameter を Live2D 標準 preset id `param_mouth_open` から **custom id `param_tutorial_mouth_open`** へ変更する。
- **preset catalog の不変条件は一切変更しない**。preset id `param_mouth_open` は catalog（`packages/package-format/src/parameter-presets.ts:67`）に残るのが正しい。重複判定 source（`packages/operation-core/src/operations/create-parameter.ts` の `hasInitializedParameter` 経由 precondition）も無改変。
- 「preset をそのまま初期化する operation」は将来の設計案件であり本 wave では作らない。
- 期待値更新は「実 source 出力に正確に一致」させる。テストを緩める（toContain 化・assert 削除・skip）は禁止。tutorial テストの pin 意図（operation 列・package graph・readiness evidence）は保つ。

## 変更ファイル一覧と変更要旨（3ファイル）

1. `C:\workspace\remie\code\ai-native-live2d-editor\packages\authoring-core\src\tutorial-mini-model-seed.ts`
   - `TUTORIAL_MINI_MODEL_IDS.parameters.mouthOpen`: `"param_mouth_open"` → `"param_tutorial_mouth_open"`（:76）。
     - これが整合的な単一修正点。recipe :190（createParameter payload の `parameterId`）と :377（addKeyform payload の `parameterId`）はいずれも `TUTORIAL_MINI_MODEL_IDS.parameters.mouthOpen` 定数参照なので自動追従する。payload 側リテラルを直接変える方式では keyform binding が旧 id を指して壊れるため、定数を変えるのが正しい（実コードで確認済み）。
   - `TUTORIAL_MINI_MODEL_IDS.keyformSets.mouthOpacity`: `"keyset_drawable_draw_tutorial_mouth_opacity_mouth_open_1"` → `"keyset_drawable_draw_tutorial_mouth_opacity_tutorial_mouth_open_1"`（:91）。
     - **追加で必要になった追従**（Orch 事前調査に無かった点。逸脱として明記）。keyform set id は `add-keyform` operation が `keyset_${targetKind}_${targetId}_${targetProperty}_${stripIdPrefix(parameterId, "param_")}_${keyValue}` として**生成**する（`packages/operation-core/src/operation-ids.ts:116-125`）。parameterId から `param_` を剥がした部分が id に埋め込まれるため、`param_mouth_open` → `param_tutorial_mouth_open` の変更で生成 id の該当トークンが `mouth_open` → `tutorial_mouth_open` に変わる。seed のこの定数はテスト/fixture が突き合わせる「期待生成 id」なので、実 source 出力に合わせて更新した。
     - 補足: operation id `op_tutorial_add_mouth_opacity_keyform`（recipe :374 で明示指定）と `op_tutorial_create_parameter_mouth_open`（recipe :189 で明示指定）は parameterId 由来ではなく固定リテラルのため**変更不要**（変更していない）。

2. `C:\workspace\remie\code\ai-native-live2d-editor\fixtures\contracts\wave30-tutorial-mini-model-contract-fixtures\expected\editor-state-readiness-evidence-summary.json`
   - opacityKeyform の `id`（:84）を旧生成 keyset id → 新生成 keyset id（`..._tutorial_mouth_open_1`）へ更新。上記 #1 の keyset id 変化への追従。

3. `C:\workspace\remie\code\ai-native-live2d-editor\fixtures\contracts\wave30-tutorial-mini-model-contract-fixtures\expected\package-graph-summary.json`
   - `maskOpacity.opacityKeyformIds[0]`（:62）を新生成 keyset id へ更新（#1 追従）。
   - `dynamics` オブジェクトのフィールド名 `driverParameterIds` → `inputParameterIds`（:72）。
     - **これは mouth_open とは無関係な、1ループ目まで recipe throw に隠れていた既存 fixture staleness**。recipe が throw していた間は `summarizePackageGraph` の toEqual アサーションまで到達しなかったため露見していなかった。custom id 化で throw が消え recipe が commit まで成功するようになった結果、この assertion が実行され、fixture の古いフィールド名が実出力と食い違うことが判明した。
     - 実 source 出力が権威: テストヘルパ `summarizePackageGraph`（`packages/operation-core/src/wave30-tutorial-mini-model-contract-fixtures.test.ts:178-180`）は `{ dynamicsGroupId, inputParameterIds: dynamicsGroup.inputs.map(...), outputParameterId }` を生成する。よって fixture 側のフィールド名を実出力に一致させた（テストを緩めていない・値 `["param_face_yaw","param_body_bob"]` は不変）。`toEqual` はキー順不感のためキー並びは変えていない。

### projectPresetAlias の扱い（Orch 実装指針 #3 への回答）

recipe :193 の `projectPresetAlias: "project.mouthOpen"` は**変更しない**（削除もしない）と判断した。根拠:

- `createParameter` operation handler（`packages/operation-core/src/operations/create-parameter.ts:70-78`）は payload から `parameterId / displayName / valueSource / min / max / default / recommendedUiStep` のみを読んで parameter を構築し、**`projectPresetAlias` を一切参照しない**（parameter へ転送されない・inert）。これは f62cc2f4 以降の確定挙動として実コードで確認した。
- ただし `projectPresetAlias` は payload schema 上は有効な optional フィールド（`packages/operation-core/src/payloads/model-edit.ts:378 z.string().optional()`）であり、tutorial の4つの createParameter 呼び出し（:167 faceYaw / :178 bodyBob / :189 mouthOpen / :200 hairSway）**すべてに一貫して**付与されている。
- 今 fail の原因は id が preset catalog と衝突したこと（重複判定は parameterId のみをキーにする）であって、`projectPresetAlias` は fail に一切関与していない。mouthOpen の分だけ削除すると他3呼び出しとの一貫性を壊し、4つ全部削除するのは本 fail-fix wave の scope（裁定「必要な範囲だけ・recipe の id を custom 化」）を超える。
- したがって最小 scope 原則に従い `projectPresetAlias` は無改変とした。inert であるため残置しても実 parameter・重複判定・テスト期待値のいずれにも影響しない（全 gate green で確認）。

## Gate 実行結果（1-7）

### Gate 1: 対象4テスト green（732 中 fail 0）
コマンド: `npx vitest run packages/operation-core packages/validator-core packages/runtime-core --reporter=dot`
- **修正前（本ループ着手時）: 728 passed / 4 failed（129 files）** — 4件すべて `Parameter already exists: param_mouth_open`。
- **修正後: 732 passed / 0 failed（129 files 全 pass）**。1ループ目時点の 728/4 → 732/0 を達成。
- 対象4テストの内訳（すべて green）:
  - `packages/operation-core/src/wave30-tutorial-mini-model-contract-fixtures.test.ts` ✓
  - `packages/operation-core/src/wave30-tutorial-mini-model-recipe.test.ts` ✓
  - `packages/validator-core/src/wave30-tutorial-mini-model-contract-fixtures.test.ts` ✓
  - `packages/runtime-core/src/wave30-tutorial-mini-model-contract-fixtures.test.ts` ✓

### Gate 2: 新規 fail ゼロ
- 私の変更（seed 定数2件 + fixture 2ファイル）起因で新たに壊れたテストは無い。ドメイン3パッケージは 732/732 全 pass。authoring-core・authoring-host も全 pass（下記）。`TUTORIAL_MINI_MODEL_IDS` の全 consumer を確認し、リテラル `param_mouth_open` を tutorial 文脈で持つ in-scope ファイルは seed.ts のみ（それ以外の consumer は定数参照で自動追従）であることを grep で確認済み。apps/editor・apps/runtime-player の `param_mouth_open` は preset catalog 由来の独立使用で `TUTORIAL_MINI_MODEL_IDS`・tutorial keyset id を参照しないため無影響（触れていない）。

### Gate 3: mesh 系無傷（seed.ts は authoring-core）
コマンド: `npx vitest run packages/authoring-core --reporter=dot`
- 結果: **276 passed / 276（35 files 全 pass）**。1ループ目時点 276/276 を維持。seed.ts 変更後も全 green。

### Gate 4: typecheck
コマンド: `npx tsc --noEmit`
- 結果: **exit 0（エラーなし）**。

### Gate 5: check:source
コマンド: `node scripts/check-source-organization.mjs`
- 結果: **`Source organization guard passed.` / exit 0**。

### Gate 6: check:deps（1ループ目修正の維持確認）
コマンド: `node scripts/check-dependencies.mjs`
- 結果: **`Dependency guard passed.` / exit 0**。1ループ目の修正は無傷。

### Gate 7: authoring-host 新規 fail 無し
コマンド: `npx vitest run --root apps/authoring-host --reporter=dot`（= `pnpm run test:authoring-host`）
- 結果: **82 passed / 82（15 files 全 pass）**。authoring-host の tutorial consumer（`test-support/perception-fixtures.ts` / `test-support/authoring-host-fixtures.ts` / `perception/measurement-command.test.ts`）はいずれも `TUTORIAL_MINI_MODEL_IDS` 定数参照で自動追従し、新規 fail なし。

## 質問・特記事項（Orch-Sylph への申し送り）

1. **Orch 事前調査に無かった追加追従を2件行った（逸脱として明記）**:
   - (a) seed の `keyformSets.mouthOpacity` 定数（生成 keyset id）の更新。parameterId 変更が add-keyform の id 生成規則を通じて keyset id を変えるため必須だった。
   - (b) `package-graph-summary.json` の `driverParameterIds` → `inputParameterIds` リネーム。これは mouth_open と無関係な既存 fixture staleness で、recipe throw が消えて初めて到達する assertion により露見した。実 source 出力（`summarizePackageGraph` ヘルパ）に一致させる形で修正した（テストは緩めていない）。
   いずれも「実 source 出力に正確に一致させる」原則の範囲内であり、preset catalog・重複判定 source・その他 non-test source は無改変。

2. **projectPresetAlias は無改変**（上記「projectPresetAlias の扱い」参照）。inert だが schema 有効・4呼び出しに一貫付与のため、最小 scope で残置。将来「preset 初期化 operation」設計時、または projectPresetAlias の廃止/実装を決める設計案件でまとめて扱うのが妥当（本 wave の scope 外）。

3. **触るな指定は全遵守**: preset catalog（parameter-presets.ts）・create-parameter.ts・mesh 系・mesh-tool UI・1ループ目 Domain R 修正（check-dependencies.mjs / self-test / 更新済み fixtures / validator 2テスト）はいずれも無改変。self-test の pre-existing fail `positive forbidden non-goal claim`（別タスク化確定）にも触れていない。依存の追加/削除・lockfile 変更・pnpm install・コミット/stash/checkout も一切していない。

4. **git status 自己照合済み**: 本ループで私が変更したのは上記3ファイルのみ。他の working-tree 変更（mesh 系・apps/editor・1ループ目 Domain R fixtures 等）は並列ドメイン/1ループ目由来で、私は触れていない。
