# Wave106 Domain C レビュー — runtime-player Dynamics Tuning Profile v2（Spec Compliance + design/dev）

- レビュアー: Review-Sylph（Orch-Sylph からの委任）
- 判定基準: `discussion/design/dynamics-world-frame-chain.md` §9 / §5 / §6 裁定 #2
- 対象: `apps/runtime-player/src/**`（Gnome-C の作業スコープ）

## 判定: **合格**

要修正なし。§9 の override 語彙・乗数意味論に完全一致。移行コードなし。旧語彙の非テストソース残置ゼロ。Domain C の書き込みは apps/runtime-player 配下に限定されており packages を触っていない。Gnome 報告の内容は実装・差分で裏付けを確認済みで、鵜呑みではなく独立検証した結果として一致している。

---

## 観点ごとの適合

### 1. override 語彙と §9 の一致 — 適合
`preload/dynamics-tuning-bridge-contract.ts` の `RuntimePlayerDynamicsTuningGroupOverride` は `{ enabled?, outputScale?, limit?, damping?, gravityScale?, lengthScale? }`（14–21行）で §9 の `{enabled?, outputScale?, limit?, damping?, gravityScale?, lengthScale?}` に完全一致。過不足フィールドなし。`RuntimePlayerDynamicsTuningValues`（34–41行）も同6フィールドの観測量。旧 strength/length/sway/reactionSpeed/convergenceSpeed の残置ゼロ（下記 grep）。

### 2. 乗数意味論の正しさ — 適合
`effective-dynamics-tuning.ts` の `applyDynamicsTuningToGroup`（43–76行）:
- `outputScale`: 各 output に対し `output.scale * outputScale`（72行）= **乗算**。正しい。
- `lengthScale`: `segmentLengths.map(L => L * lengthScale)`（64–66行）= 全セグメント長への**乗算**。正しい。
- `limit` / `damping` / `gravityScale` / `enabled`: いずれも `override.X ?? group…`（59, 67, 68, 73行）= **置換**。正しい。
- 恒等元は未指定時 `?? 1`（54–55行）で乗数系のみ 1、置換系は元値保持。

「Scale 接尾辞＝乗数、それ以外＝置換」裁定は §9 本文「outputScale = 出力 scale への乗数、lengthScale = 全セグメント長への乗数」の直接記述に忠実で、命名の自然な読みとして妥当。数値テスト `effective-dynamics-tuning.test.ts`（64–92行 "multiplies scale knobs and replaces the rest"）が scale 0.5×2=1、[12,6]×1.5=[18,9]、damping/gravityScale/limit 置換を `toBeCloseTo`/`toEqual`/`toBe` で検算しており、意味論が固定されている。model 非破壊も検証済み（60–61行、`.not.toBe`）。

### 3. 移行コードなし（裁定 #2）— 適合
`dynamics-tuning-profile-parser.ts` は `value.schemaVersion !== dynamicsTuningProfileSchemaVersion` で即 `ok:false`（33–38行）。schemaVersion は bridge-contract 経由で v2 literal（document.ts 9–10行）。v1 プロファイルの読み替え・変換コードは存在しない。破棄は厳密一致 reject に委ねられている。`dynamics-tuning-profile-store.test.ts`（101–147行）が v1 fixture を `read-failed`（"schema version" 警告）で reject することを実証。裁定 #2 に忠実。

### 4. 旧語彙残置ゼロ（grep）— 適合
`apps/runtime-player/src` 配下:
- sway / reactionSpeed / convergenceSpeed（非テスト）: **NONE**
- tuning 文脈 pendulum（非テスト）: **NONE**
- profile v1 literal: `dynamics-tuning-profile-store.test.ts:115` の1件のみ（v1 破棄テストの意図的 legacy fixture、正当）
- tuning 文脈 strength / influencePercent / invert / normalization / pendulumCount: 非テストソース NONE。`store.test.ts:128` の `strength: 0.5` は同 v1 破棄テストの legacy fixture 内（125–133行、正当）
- signature.ts の旧署名フィールド（invert/influencePercent/pendulumCount/normalization/output.kind）: NONE（clean）

model-mapping / live-mapping / stage-motion 等の別機能 "strength" は dynamics tuning と無関係で区別済み。

### 5. Domain C の packages 無変更 — 適合（下記の重要な注記あり）
Domain C（Gnome-C）の書き込みは `git status --short apps/runtime-player/` の23ファイルすべてが `apps/runtime-player/src/**` 内で、Gnome 報告の変更ファイル一覧と完全一致。**Domain C は packages を一切変更していない。**

**注記（要 Orch 確認、blocking ではない）**: 作業ツリー全体には packages/** 75ファイル・apps/editor/** 5ファイル・apps/authoring-host/** の未コミット変更が存在する。これらは Wave106 の他ドメイン（Domain A = packages の dynamics-file-v3 置換、editor/authoring-host 系ドメイン）の成果物で、Domain C 起因ではない。委任プロンプト観点5「packages に一切変更が無いこと」を文字通りに読むと `git diff --stat packages/` は多数ヒットするが、これは Domain A の未コミット差分であり、観点の趣旨（Domain C が層を跨いでいないこと）としては合格。もし観点5が「作業ツリー全体で packages がクリーンであること」を意図していたなら、それは Domain A が未コミットである運用状態の問題であって Domain C の欠陥ではない — 判断は Orch に委ねる。

### 6. 命名 §5 の適用 — 適合
`bridge-contract.ts` の `runtimePlayerDynamicsTuningProfileSchemaVersion = "runtime-player-dynamics-tuning-profile-v2"`（1–2行）。§5 命名表と一致。document.ts はこれを再エクスポートで自動追従。

### 7. signature の署名対象更新 — 適合
`dynamics-tuning-signature.ts`（5–55行）:
- inputs: `{ parameterId, kind, scale }`（19–23行）へ更新。旧 influencePercent/invert/normalization 撤去。
- chain: `{ rootOffset{x,y}, segmentLengths, damping, gravityScale }`（28–36行）へ更新。旧 pendulumCount/pendulums 撤去。
- outputs: `{ parameterId, segmentIndex, scale, limit }`（38–43行）へ更新。旧 output.kind/output.invert/strength 撤去。
- 決定性: inputs は `parameterId → kind` 2段ソート（24–27行）、outputs は `parameterId → segmentIndex` 2段ソート（44–47行、旧 kind ソート鍵が消えたための妥当な代替）、groups は `dynamicsGroupId` ソート（49–51行）。ソート維持され決定的。

### 8. 境界の妥当性 — 適合
3つの境界パーサすべてが意味論と整合:
- `dynamics-tuning-bridge-request-validation.ts`（IPC updateGroup）: outputScale/lengthScale=`readOptionalPositiveNumber`（正数、15–28行）、limit/damping/gravityScale=`readOptionalNonNegativeNumber`（非負）、enabled=boolean。正しい。
- `browser-source-server-message.ts` の `readDynamicsTuningGroupOverride`（449–482行）: 同じ正/非負/boolean 判定。差分は override フィールド語彙の置換のみ（下記「既存赤との独立性」参照）。
- `dynamics-tuning-profile-parser.ts` `parseGroupOverride`（128–174行）と `dynamics-tuning-profile-groups.ts` `sanitizeGroupOverride`（160–181行）: outputScale/lengthScale=正数、limit/damping/gravityScale=非負、enabled=boolean で一貫。

IPC 契約: `RuntimePlayerDynamicsTuningGroupUpdateRequest = { groupId } & GroupOverride`（bridge-contract 100–102行）と validation の返り値型が一致。

---

## 裁量判断の妥当性評価

1. **outputSummary の kind → "segment N"**（`dynamics-tuning-profile-groups.ts` 109–115行、`kind: \`segment ${output.segmentIndex}\``）: 新スキーマ output に `kind` が無いため妥当な代替。`RuntimePlayerDynamicsTuningParameterRef.kind: string`（bridge-contract 45行）を optional 化せず既存構造を保つ選択も、control ページの `formatParameterRef`（`${name} (${kind})` → 例 "Front Hair (segment 1)"）を壊さず整合。**妥当。**

2. **スライダー範囲**（`dynamics-tune-page.tsx` 36–77行）: 乗数系 outputScale/lengthScale = min 0.1 / defaultMax 3 / step 0.05（0 起点でなく正数、恒等元 1.0 が範囲中央付近）は乗数の正数制約と整合。置換系 limit=0–2、damping=0–60（§7 unstableSettings 上限 60 参照）、gravityScale=0–10（§7 上限 10 参照）は設計の不安定域境界を参照しており根拠がある。`createSliderRange`（378–397行）が実効値/エクスポート値を含めて min/max を拡張するため、範囲外の既存値でもクランプ破綻しない。**妥当。**

3. **値表示基準**（`dynamics-tuning-profile-groups.ts` `createExportedValues` 183–199行）: 乗数系 outputScale/lengthScale=1.0（恒等元）、置換系 limit=outputs[0].limit / damping=chain.damping / gravityScale=chain.gravityScale / enabled=group.enabled（実効値）。乗数のベースラインを 1.0 とし置換のベースラインを実値とする区別は §9 の意味論と一貫し、UI 上「Export default」表示（dynamics-tune-page 338–340行）と噛み合う。limit を outputs[0] 基準とする点は、複数 outputs 時に先頭のみを代表値とする単純化だが、tuning UI がグループ単位で1つの limit スライダーを出す設計上やむを得ず、実際の適用（applyDynamicsTuningToGroup）は全 outputs に override.limit を置換するため表示と適用の齟齬は「表示が代表値」という範囲に収まる。**妥当。**

4. **署名 outputs ソート鍵 parameterId→segmentIndex**: 旧 kind 消滅に対する決定性維持として妥当（観点7で確認済み）。

---

## 既存赤2件との独立性（Gnome の browser-source-server-message.ts 変更の検証）

Gnome 変更が既存赤2件（`browser-source-server` / `browser-source-server-message` の `effectiveDynamicsTuning: null` フィールド有無不整合）を新たに生んだ/悪化させたかを独立確認した:

- `git diff` で本ファイルの変更は `readDynamicsTuningGroupOverride`（454–482行）の override フィールド語彙置換（strength/length/sway/reactionSpeed/convergenceSpeed → outputScale/limit/damping/gravityScale/lengthScale）**のみ**。
- 既存赤の原因である `readBrowserSourceRuntimeExportResponse` / `readEffectiveDynamicsTuning` の `effectiveDynamicsTuning: null` response shape ロジック（46–106行, 369–419行）は本 diff で**一切変わっていない**（grep で response-shape 差分 NO CHANGE 確認）。
- したがってこの2赤は Domain C 起因でなく、悪化もしていない。**本レビューの blocking にしない**（委任指示どおり）。

Gnome の参考質問（response contract にフィールド追加した wave での解消）は妥当な整理。Domain C scope 外の残置は正当。

---

## 差分（要修正）

なし。

## Orch への質問 / 確認事項（blocking ではない）

1. 観点5の解釈確認: 作業ツリーには Domain A（packages）等の未コミット差分が同居している。これは想定内（複数ドメイン並行の運用状態）で、Domain C 自体は packages を触っていない、という理解で合っているか。もし「Domain C の diff を単独コミット/切り出す前提」なら、apps/runtime-player の23ファイルのみをステージすればよく、他ドメイン差分の混入リスクはコミット手順側で担保される。

## 補足（実測ベースライン）
- tsc exit 0 / 既存赤2件のみ fail は Orch 実測済み。本レビューでは diff・grep・型追従の静的検証で up し、独立に矛盾を検出しなかった。
