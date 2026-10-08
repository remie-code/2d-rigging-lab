# Wave104 Domain C — Test Adequacy Review

Verdict: **pass**（初回 pass。non-blocking #1（authoring-host typecheck 10 エラー）/ non-blocking #2（測量 warp が rest のみ）を L0 裁定で閉域前に狭く修正。修正 diff の再検証で両者解消かつ検証強度・挙動不変を実確認し、最終 pass を維持。詳細は末尾「再検証（型修正ループ後）」を参照。以下の本文は初回レビューの記録として保存）

Reviewer: Review-Sylph（Test Adequacy lane, Domain C / Measurement + ref e2e）
Date: 2026-07-03（初回） / 2026-07-03（再検証）
Basis: `discussion/implementation/orchestration/wave104-plan.md` §8 Domain C / §3.3 / §3.4（2026-07-03 改訂含む）/ §3.5 / §10。参照先例: `wave104-domain-a-test-adequacy-review.md`。

## 要約

Domain C のテスト群は §8 Required tests を実質的に充足している。ref e2e 5 項目（validate report 取得 / PNG+サイドカー出力 / 決定論バイト一致 / 測量スモーク包含関係 / 実行時間記録）は全て実在し pass、測量ユニットテストは合成フィクスチャで数値検証し、texture 導出は ref 126 テクスチャ全件一致を実カウントで実証、負例（byteLength 不一致 / 曖昧候補 / capability 不足 / 存在しない target）も揃う。

「非オウム返し」の中核は、warp 格子制御点の「評価済み ≠ rest」実証が **runtime-core の `rig-control-evaluated-control-points.test.ts`**（非ゼロ offsets ケース、独立手計算 `(1,2)(7,4)(5,14)(17,28)`、`.not.toEqual(REST)` 付き）で担われている点にある。私はプローブ実験（offset 加算を破壊）で、この export を壊すと当該 2 テストのみが fail し rest-pose テストは pass することを機械的に実証した（＝ export が実データを運び、テストが変形を実際に検出する）。texture 導出の byteLength 厳密検証も、検証を無効化すると負例テストが fail することを実証した。両プローブとも完全復元済み（git diff で実証）。

blocking はゼロ。ただし **`typecheck:authoring-host` を実行すると 10 件の型エラーが出る**（全て Domain C の新規ファイル: measurement-command.test.ts 5 / texture-resolution-derivation.test.ts 3 / texture-resolution.ts 2）。CI ゲート `pnpm check`（= root tsc、apps/ 非対象）と `test:unit`（= packages のみ）はこれを通過してしまうため実行時テストは全緑だが、Domain C 追加コードの型健全性は欠落している。テスト充足性そのものを直接損なわない（vitest は緑）ため blocking にはしないが、Domain D での回収を強く推奨する（non-blocking #1）。

## 実測テスト結果（自分で実行）

| スイート | 実行コマンド | 結果 | Gnome 申告との一致 |
|---|---|---|---|
| authoring-host | `npx vitest run --root apps/authoring-host` | **50 passed / 12 files** | 一致（50 pass） |
| ai-interface | `npx vitest run packages/ai-interface`（root から） | **107 passed / 17 files** | 一致（107 pass） |
| runtime-core | `npx vitest run packages/runtime-core`（root から） | **126 passed / 2 failed（37 files中 2 file failed）** | 一致（非退行 + 既知先行 2 failed） |
| root typecheck | `npx tsc --noEmit` | **0 error（exit 0）** | 一致（apps/ 非対象） |
| authoring-host typecheck | `npx tsc --noEmit -p apps/authoring-host/tsconfig.json` | **10 error（exit 2）** — Domain C 新規ファイルのみ | Gnome 未申告（non-blocking #1） |

ref e2e スモーク（`ref-e2e.test.ts`、4 tests）は authoring-host 50 に含まれ全 pass。実行ログで実データを確認:
- `REF_E2E validatePackage duration 911.7ms` / `validate counts {"info":0,"warning":0,"error":97,"blocking":0}` — report は 97 error を実際に検出（空でない）。§3.5 通り診断内容は fail 条件にしていない。
- `REF_E2E renderView x3 duration 4356.7ms` / `REF_E2E inspectEvaluatedGeometry duration 700.4ms` — 実行時間を記録（非ブロッキング）。

### runtime-core の 2 failed が clean HEAD 起因である実証

`packages/runtime-core/src/rig-control-evaluation.ts`（唯一の tracked runtime-core 変更）を `git stash` し、新規テスト `rig-control-evaluated-control-points.test.ts` を一時退避して clean HEAD 相当で runtime-core を実行 →
**同じ 2 file が failed**（`runtime-grid2d-keyform-fixture.test.ts` / `wave30-tutorial-mini-model-contract-fixtures.test.ts`）、pass 数は 126→123（新規 export テスト 3 件が減った分のみ）。復元は `git stash pop` + テストファイル復帰で実施し、`git status` で `rig-control-evaluation.ts` の diff が Wave104 additive export のみ・新規テスト復帰を確認済み。よって 2 failed は Wave104 と無関係の先行 failed であり、Domain C は runtime-core 非退行。

## §8 Required tests ごとの判定

### ref e2e（§8, §3.5）5 項目 — 全て実在・充足

`apps/authoring-host/src/ref-e2e.test.ts`（4 it、5 要件を内包）:

1. **validate report 取得**（it "loads ref and runs validatePackage", L119-145）: `runAuthoringHostCommand` で ref を read-only load し `validatePackage {profile:"strict"}` を実行、`payload.report` の存在を assert。診断内容は §3.5 通り gate しない（97 error はログ記録のみ）。**充足**。
2. **PNG + サイドカー出力**（it "renders the user visual gate PNGs", L177-231）: rest full（view 省略=モデル bounds）/ face focus（drawableFocus, 10% margin）/ eye viewport（明示 stageViewport）の 3 枚を `ref-render-gate/` に出力。各 PNG の byteLength>0、サイドカー revision == package revision（stale ガード）、`textureDimensionSources` 126 件全て `derived-verified` を assert。**充足**。
3. **決定論 2 回バイト一致**（同上, L223-230）: 同一リクエストを **fresh directory** に再レンダし `rerunBytes.equals(firstBytes)` を assert。キャッシュ読みでなく独立生成（別 outDir）。**充足**。
4. **測量スモーク bbox 有限値・包含関係**（it "measures evaluated geometry deterministically", L233-315）: face / irides-l / eyewhite-r の評価済み bbox が全て有限値・width/height>0 を assert し、**両 eye drawable が face bbox に空間的に包含される**（`rectContains`）ことを assert。包含は非自明な spatial relation で vacuous でない（下記「vacuous pass 不在」参照）。決定論は **別 state directory** で独立再評価し `secondResult.results` を `toEqual` で照合（キャッシュ共有なし）。**充足**。
5. **実行時間記録**（L129/201/251, `performance.now()` 差分を console.log）: 非ブロッキング記録。**充足**。

### 測量ユニットテスト（合成フィクスチャの数値検証, §8 required tests） — 充足（ただし warp 部は下記 non-blocking #2）

`apps/authoring-host/src/perception/measurement-command.test.ts`（4 tests）:
- drawable bounds 有限値 + 存在しない drawable の `found:false`（L23-65）: 負例（`draw_does_not_exist`）を含む。**充足**。
- **共有 snapshot との一致**（L67-95）: `evaluatePerceptionSnapshot` から独立取得した `snapshotDrawable.bounds` / `vertices` に `toEqual` で照合。測量が再実装でなく共有評価を返すことの回帰保護。前段で snapshot 側の undefined を throw しているため vacuous でない。**充足**。
- parameterOverrides の echo が parameterId でソートされる（L97-112）。**充足**。
- warp 格子制御点（L115-168）: rest pose（offsets ゼロ）で domainBounds の四隅を含み、全点が domain rect 内、`snapshotWarp.evaluatedControlPoints` に一致。→ 数値は独立（domainBounds は fixture 定数）で bounds/四隅の検証は充足だが、**rest のみで「評価済み ≠ rest」は検証していない**（non-blocking #2）。

### texture 導出テスト（§3.4 改訂, 126 全件一致 + 負例） — 充足

`apps/authoring-host/src/perception/texture-resolution-derivation.test.ts`（5 tests）:
- 正例: mesh bounds から導出し `dimensionSource:"derived-verified"` を返す。期待寸法は fixture の mesh bounds から**独立取得**（`meshBoundsFor` が graph を直接読む）。**充足**。
- 負例3種: off-by-one で `byteLengthMismatch`（L73-93）、整数候補なしで `missingDimensions`（L95-116）、面積等しい 2 候補（4x4 と 8x2）で ambiguous → `missingDimensions`（L118-149）。**曖昧候補 reject を含み充足**。
- declared 優先（L151-164）: declared 経路が derived より優先されることを確認。**充足**。

ref 全件一致（`ref-e2e.test.ts` L147-175）: `usedTextureIds` を `toHaveLength(126)` で数え、`resolveTextureDimensionSources` の 126 records 全てが `derived-verified` かつ整数正値であることを assert。**126 は実カウント**（下記 vacuous pass 不在参照）。**充足**。

### runtime-core `evaluatedControlPoints` export テスト（非オウム返しの中核） — 充足

`packages/runtime-core/src/rig-control-evaluated-control-points.test.ts`（3 tests）:
- rest pose（param=0）で offsets ゼロ → evaluated == REST（L56-63）。
- **非ゼロ offsets（param=1）で evaluated = rest+offset、独立手計算 `(1,2)(7,4)(5,14)(17,28)` と照合し、かつ `.not.toEqual(REST_CONTROL_POINTS)`**（L65-83）。各隅に **distinct offset** を与えているため index 順序も pin される。§8 required test 2(b) の「評価済み ≠ rest の実証」を満たす。
- midpoint（param=0.5）で線形補間 half offset（L85-94）。
- 実装（`rig-control-evaluation.ts` の `computeEvaluatedWarpControlPoints`）は additive export（内部計算済み `controlPointOffsets` の公開のみ、評価挙動不変）。**充足**。

### ai-interface 測量スキーマ・capability・read 分岐テスト — 充足

`packages/ai-interface/src/ai-measurement-command.test.ts`（6 tests）:
- payload デフォルト（`parameterOverrides:{}` / `includeVertices:false`）、**空 target list の reject**（L64-68, 負例）、drawable+rigControl の result round-trip。
- read dispatch: read capability で host 委譲、**capability 不足で `permission_denied`**（L111-128, 負例）、host 未実装で `not_implemented`（L130-146）。**充足**。

## プローブ実験（実施・完全復元済み）

Domain A 先例に倣い、疑わしい 2 箇所を破壊して該当テストが fail することを実証。両方とも実施後に完全復元し、git で実証済み。

### プローブ1: warp control point export の実効性

- 変更: `packages/runtime-core/src/rig-control-evaluation.ts` の `computeEvaluatedWarpControlPoints` を offset 非加算（rest のみ返す）に一時破壊。
- 結果: `rig-control-evaluated-control-points.test.ts` の **非ゼロ offsets / midpoint の 2 テストのみ fail**、rest-pose テストは pass。さらに `measurement-command.test.ts` は **4/4 pass のまま**（＝ 測量ユニットの warp テストは rest のみで非rest変形を検出しない、non-blocking #2 の裏付け）。
- 復元: Edit で元式（`restPoint.x + offset.x` / `.y + offset.y`）に戻し、`git diff` に "PROBE"/"void offset" 残渣なし・diff が Wave104 additive export のみ（49 insertions / 1 deletion）であることを確認。

### プローブ2: texture 導出の byteLength 厳密検証の実効性

- 変更: `apps/authoring-host/src/perception/texture-resolution.ts` の verified フィルタ（`w*h*4 === byteLength`）を常時 true に一時破壊。
- 結果: `texture-resolution-derivation.test.ts` の **「off-by-one で reject」負例テストが fail**（"expected function to throw an error, but it didn't"）。
- 復元: Edit で `=== bytes.byteLength` に戻し、grep で "PROBE" 残渣なしを確認。

### 復元後の再検証

`rig-control-evaluated-control-points.test.ts` + `texture-resolution-derivation.test.ts` + `measurement-command.test.ts` を再実行 → **12/12 pass**。リポジトリは完全に元状態。

## vacuous pass の不在 — 確認

- **包含関係 assert**（ref e2e L282-283）: `rectContains(faceBounds, iridesBounds)` は 4 辺の数値比較。L267 で `bounds === undefined` を throw しているため undefined 同士の自明比較にならない。face が eye を包含するのは非自明（drawable 選定は評価済み snapshot から発見された実 id）。
- **126/126**（ref e2e L152/L162, derivation は L157）: `expect(usedTextureIds).toHaveLength(126)` が先行して 0 件なら fail するので、空配列で全称量化 `.every()` が vacuous true になる経路を塞いでいる。records も `toHaveLength(126)` で件数固定。
- **snapshot 一致**（measurement L73-74）: snapshot 側 undefined を先に throw、`toEqual` は実データ同士。

## non-blocking findings

1. **`typecheck:authoring-host` が 10 件の型エラーで fail（全て Domain C 新規ファイル）。** 内訳:
   - `measurement-command.test.ts`（5 件）/ `texture-resolution-derivation.test.ts`（3 件）: payload/graph をオブジェクトリテラルで構築する際、plain `string`（fixture の `ids.*` は `string` 型）を branded id（`DrawableId`/`MeshId`/`RigControlId`）フィールドへ代入している（`InspectGeometryTargetSchema` が `DrawableIdSchema` = branded を要求）。zod parse を経ないため実行時は緑だが型不正。
   - `texture-resolution.ts`（2 件, L183/L222）: `resolveTextureBytes` に渡す `textureEntry` が `exactOptionalPropertyTypes:true` 下で `binaryAssetRef?: {...}` 受け側型と非互換（`... | undefined` を明示許容していない）。**これは実装コードの型エラー**（Design/Development レーンとも重複しうる）。
   - 影響評価: CI ゲート `pnpm check`（= `typecheck:root`（apps/ 非対象）+ `test:unit`（= `vitest run packages`、apps/ 非対象）+ deps + source）は **これを検出しない**。§9 Domain D の required check も `pnpm typecheck`（root）を挙げるのみで `typecheck:authoring-host` を明示列挙していない。よって Wave 標準経路は緑のまま通る。しかし Domain C 追加コードの型健全性は欠落しており、`test:authoring-host` を回す開発者/CI では顕在化する。Domain A の render-view 実装群は同 tsconfig 下でエラーゼロ（10 件は全て Domain C ファイル）なので先行状態ではなく Domain C 帰属。**テストの vacuous/オウム返しには該当しないため blocking にしないが、Domain D で `typecheck:authoring-host` 緑化を回収することを強く推奨**（テストの branded-id は `parse()` 経由か `as` キャストで、実装 2 件は受け側型に `| undefined` 追加で解消可能）。

2. **測量ユニットテストの warp テストが rest pose のみ（`evaluated == rest`）で「評価済み ≠ rest」を検証していない。** `measurement-command.test.ts` L115-168 は offsets ゼロの rest しか測らず、プローブ1 で示した通り export を壊しても pass する。§8 required test 2(b)「warp 格子点テストが評価済み ≠ rest を実証」の実証責任は runtime-core の export テスト（充足）が全面的に負っており、測量コマンド（authoring-host 層）を通した非rest格子点の end-to-end 回帰保護は無い。measurement 実装は snapshot の `evaluatedControlPoints` をそのまま転写するだけ（`measurement-command.ts` L112-119）なので、export テストが緑なら測量出力も追随する構造ではある。**judgment に影響しないが**、測量コマンド経由で非ゼロ offsets の warp を 1 ケース測る回帰があるとより堅い。

## 質問（Orch-Sylph へ）

1. non-blocking #1（authoring-host typecheck 10 エラー）の扱いを確認したい。CI ゲート `pnpm check` は通過するため Wave104 の pass 判定を妨げないと判断したが、**`typecheck:authoring-host` を Domain D の必須チェックに昇格させ回収するか**、それとも「apps/ 型チェックは Wave スコープ外の既存構造」として記録に留めるか、L1/L0 判断を仰ぎたい。特に `texture-resolution.ts` L183/L222 は実装コードの型エラーで、Design/Development レーンの所見と突き合わせるべき。
2. non-blocking #2（測量 warp が rest のみ）は runtime-core export テストで実証責任が果たされているため許容と判断したが、測量コマンド層に非rest warp の回帰を 1 本追加するかは Orch-Sylph 裁量。

## 判定

§8 Required tests は実在し実質的。非オウム返し・負例・vacuous pass 不在・決定論の実質・既存テスト非退行（既知先行 2 failed は clean HEAD 起因と実証）を確認。プローブ 2 本で warp export と byteLength 検証の実効性を機械的に実証し完全復元。blocking なし。**pass**。non-blocking 2 件（特に #1 の型安全性欠落）は Domain D での回収を推奨。

## 再検証（型修正ループ後）

Reviewer: Review-Sylph（Test Adequacy 再検証レーン, fresh コンテキスト）
Date: 2026-07-03
呼び出し元: Orch-Sylph

再検証スコープ: 初回 non-blocking #1（`typecheck:authoring-host` の型エラー 10 件、全て Domain C 新規ファイル）を L0 裁定で閉域前修正とし、Gnome が狭い型修正を実施した。その **修正 diff に限定した再検証**であり、フルレビューの再実施ではない。併せて Gnome 裁量で非 rest warp 回帰テスト 1 本（初回 non-blocking #2 の直接回収）が追加されたため、これも実質性を確認した。環境操作（install 等）は一切行っていない。

### 確認項目ごとの結果と根拠

**1. 挙動不変（texture-resolution.ts の変更は型注釈のみ）— 確認**
実際の型変更は `apps/authoring-host/src/perception/texture-resolution.ts` の `resolveTextureBytes` パラメータ型（L317-329）にあり、`readonly binaryAssetRef?: {...} | undefined` へ `| undefined` を明示したもの（L321-322 にコメント「`| undefined` is required for exactOptionalPropertyTypes compatibility ... type-only; no runtime effect」）。exactOptionalPropertyTypes 下で optional プロパティ型に `undefined` を許容するための純型変更で、この型を消費する実行文（L335 の `input.textureEntry.binaryAssetRef` 参照 → undefined チェック → 分岐）は不変。declared/derived-verified ラダー、byteLength 検証、reject コード、制御フローに一切変更なし。値・分岐・制御フローへの影響なし。（Gnome 申告は「L183/L222 付近」だが実体は同関数のパラメータ型定義。両ラダー rung から呼ばれる共通ヘルパの型なので実質同一箇所。挙動不変の結論は変わらない。）

**2. 検証強度不変（テスト側は branded id 型付けのみ、assert 削除・緩和ゼロ）— 確認**
Domain C 新規テストの `IdSchema.parse` 使用箇所を全数確認:
- `apps/authoring-host/src/perception/measurement-command.test.ts` L19-20: `asDrawableId`/`asRigControlId` = `DrawableIdSchema.parse`/`RigControlIdSchema.parse`。コメント通り prefix 検証して同一 string を返すだけ。
- `apps/authoring-host/src/perception/texture-resolution-derivation.test.ts` L132/L141: `MeshIdSchema.parse`/`DrawableIdSchema.parse`。周囲の assert（L151-153 `toBeInstanceOf` / `.code toBe("missingDimensions")` / `.detail toContain("ambiguous")`）は不変。
- `apps/authoring-host/src/validate-package-document.test.ts` L79: `SourceAssetIdSchema.parse`。周囲の assert（L92-94 `missingSourceChecks.length > 0` / `status "fail"` / `counts.error > 0`）は不変。
いずれも従来 plain string を渡していた位置を branded 化する型変更に留まり、期待値・assert 文・負例条件に手が入っていない。検証強度不変。

**3. 追加回帰テストの実質（非 rest warp 回帰が実在・非オウム返し・pass）— 確認**
`measurement-command.test.ts` L179-215「returns evaluated warp control points offset from rest under parameterOverrides (non-rest regression)」が実在。
- 期待値の独立固定: 定数 `WARP_KEYFORM_OFFSET = { x: 5, y: -3 }`（L219）が独立定義され、fixture 側の keyform max キー（L327 `constantOffsets(WARP_KEYFORM_OFFSET)`）に注入される一方、テスト側は `drivenPoints` を `restPoints.map(p => ({ x: p.x + 5, y: p.y - 3 }))` と `toEqual`（L207-212）で全格子点照合。期待値はコマンド出力の写経ではなく rest + {5,-3} を独立に構築している。
- 格子点構築: `editKeyformKey` の `action: "createEnds"` で min（zero offsets = rest 維持）と max（定数 offset）を **1 つのキーフォームセット**に構築（L319-329、コメントで「二つの単一キー set は各々無条件適用される」危険を回避する理由を明示）。`constantOffsets` は rest control point 数だけ offset を生成し、driven 評価の全格子点数値一致を assert。
- 変形の実効: `expect(drivenPoints).not.toEqual(restPoints)`（L214）で driven が rest と genuinely 異なることも固定。
- pass 実測: 下記 authoring-host スイート 51 pass に含まれ（`measurement-command.test.ts` 5 tests 全 pass）、当該回帰も pass。
オウム返しでなく実質的。初回 non-blocking #2（測量コマンド層に非 rest warp end-to-end 回帰が無い）を直接回収している。

**4. 完了条件の実測（Review-Sylph 自身が実行）**

| 検証 | コマンド | 結果 | 見込み一致 |
|---|---|---|---|
| authoring-host typecheck | `npx tsc --noEmit -p apps/authoring-host/tsconfig.json` | **exit 0**（初回 10 エラー → 0） | 一致 |
| root typecheck | `npx tsc --noEmit` | **exit 0** | 一致 |
| authoring-host tests | `npx vitest run --root apps/authoring-host` | **51 passed / 12 files**（初回 50 → +1 非 rest warp 回帰） | 一致（51 見込み） |
| ai-interface tests | `npx vitest run packages/ai-interface`（root から） | **107 passed / 17 files** | 一致（107 見込み） |
| runtime-core tests | `npx vitest run packages/runtime-core`（root から） | **125 passed / 2 failed（36 files中 2 file failed）** | 非退行 |

runtime-core の 2 failed（`runtime-grid2d-keyform-fixture.test.ts` / `wave30-tutorial-mini-model-contract-fixtures.test.ts`）が clean HEAD 起因であることを再検証で決定的に実証した: (a) `rig-control-evaluation.ts` を stash して HEAD 状態に戻しても同一 2 file が同一失敗（`op_tutorial_create_parameter_mouth_open to commit` 失敗 / `baseline.parameters` 不一致）、(b) さらに全 working tree 変更（tracked + untracked）を stash して完全 clean HEAD で実行しても同一 2 failed。両失敗は tutorial mini model の operation commit 系（operation-core 領域）で、Domain C スコープ（Measurement / ref e2e / texture-resolution / branded id 型付け）と因果なし。stash は全て `pop` で完全復元し、`git status`（41 エントリ = 当初と一致）と `texture-resolution.ts` 存在を確認済み。

### 再検証の判定

修正 diff は (1) texture-resolution.ts が型注釈のみで挙動不変、(2) テスト側が branded id 型付けのみで assert 削除・緩和・期待値変更ゼロ、(3) 追加された非 rest warp 回帰が独立期待値（rest + {5,-3}）で全格子点照合する実質テストで pass、(4) 完了条件（authoring-host typecheck exit 0 / root typecheck exit 0 / authoring-host 51 pass / ai-interface 107 pass / runtime-core 非退行、既知 2 failed は clean HEAD 起因と実証）を全て満たす。初回 non-blocking #1 は解消、non-blocking #2 は直接回収された。閉域前修正は検証強度を一切損なわず、むしろ型健全性と回帰保護を強化している。

本レーンの verdict は初回から **pass** を維持する（冒頭 verdict 行を最終 pass に更新済み）。
