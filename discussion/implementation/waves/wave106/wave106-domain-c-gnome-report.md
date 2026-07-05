# Wave106 Domain C — runtime-player Dynamics Tuning Profile v2 化 Gnome 報告

## 判定

**completed**

`apps/runtime-player` の tuning profile を dynamics-file-v3 / v2 語彙へ全面書き換え、tsc exit 0、tuning/dynamics 関連テスト全 green。着手前から存在する既存赤 2 件（C 起因でない）を切り分けて残置。

## 完了条件の結果

1. **tsc**: `npx tsc --noEmit -p apps/runtime-player/tsconfig.json` → **EXIT 0**（着手前は dynamics 起因エラー多数、全消し）。
2. **tuning/dynamics テスト**: 全 green。
   - 中核 7 ファイル（effective-dynamics-tuning / dynamics-tuning-state / -profile-store / -profile-save-controller / -bridge-handlers / dynamics-tune-page / control-window-app.dynamics-tune）: 21/21 pass。
   - adapter を通す評価系 7 ファイル（default-pose-evaluation / evaluation-cache / variant-visibility / stage-client / broadcast-source-session / stage-scene / directory-loader）: 51/51 pass。
3. **非退行**: runtime-player 全体 428 テスト中 **426 pass / 2 fail**。fail 2 件は **C 起因でない既存赤**（下記「着手前赤の切り分け」）。新規に赤を増やしていない。
4. **旧語彙撤去**: tuning 文脈の旧語彙（strength/length/sway/reactionSpeed/convergenceSpeed、tuning 文脈 pendulum、profile v1 literal）は source から撤去済み（下記 grep 結果）。

## 変更ファイル一覧（すべて `apps/runtime-player/src/**` スコープ内）

### 本体ソース
- `preload/dynamics-tuning-bridge-contract.ts`
  - schemaVersion literal → `runtime-player-dynamics-tuning-profile-v2`
  - `RuntimePlayerDynamicsTuningGroupOverride` → `{ enabled?, outputScale?, limit?, damping?, gravityScale?, lengthScale? }`
  - `RuntimePlayerDynamicsTuningValues` → 同 v2 観測量（enabled/outputScale/limit/damping/gravityScale/lengthScale）
- `stage/runtime-evaluation/effective-dynamics-tuning.ts` — `applyDynamicsTuningToGroup` / `cloneDynamicsGroup` を新スキーマ（chain/inputs{scale}/outputs）+ v2 乗数意味論へ
- `stage/runtime-evaluation/runtime-export-runtime-graph-adapter.ts` — `createDynamicsGroupMap` を NormalizedDynamicsGroup 新形（inputs{scale}/chain/outputs{segmentIndex,scale,limit}）へ
- `main/dynamics-tuning-profiles/dynamics-tuning-profile-groups.ts` — createExportedValues / applyGroupOverride / sanitizeGroupOverride / outputSummary の kind 表示を v2 化
- `main/dynamics-tuning-profiles/dynamics-tuning-profile-parser.ts` — `parseGroupOverride` を v2 フィールドへ（v1 は schemaVersion 厳密一致で自動 ok:false、既存機構をそのまま利用）
- `main/dynamics-tuning-profiles/dynamics-tuning-signature.ts` — 署名対象を新スキーマ（inputs{parameterId,kind,scale} / chain{rootOffset,segmentLengths,damping,gravityScale} / outputs{parameterId,segmentIndex,scale,limit}）へ。solver 節据え置き、ソート決定性維持（outputs のソート鍵を kind→segmentIndex に変更）
- `main/dynamics-tuning-bridge-request-validation.ts` — `readDynamicsTuningGroupUpdateRequest` を v2 フィールドへ（IPC 検証）
- `stage/browser-source/browser-source-server-message.ts` — `readDynamicsTuningGroupOverride`（Browser Source IPC 経由の override パーサ）を v2 フィールドへ。**台帳未列挙だが apps/runtime-player/src 内で完結し、契約型は bridge-contract で既に凍結済み、他 app/packages へ波及ゼロ。旧語彙のまま残すと実質破損のため修正（escalate 不要と判断）**
- `control/dynamics-tune-page.tsx` — スライダー spec を v2（outputScale/lengthScale/limit/damping/gravityScale）へ。ラベル/aria-label/フィールド型を更新

### document / state / store / save-controller（型追従・ロジック不変を確認）
- `dynamics-tuning-profile-document.ts`: schemaVersion は bridge-contract 経由で**自動追従**（編集不要）
- `dynamics-tuning-state.ts`: override 語彙は import 型経由で自動追従、フィールド直接参照なし（**編集不要**）
- `dynamics-tuning-profile-store.ts` / `dynamics-tuning-profile-save-controller.ts`: parser 経由でロジック不変（**編集不要**）

### テスト（新語彙・新スキーマ化 + 新設）
- `stage/runtime-evaluation/effective-dynamics-tuning.test.ts`（**override 乗数の数値テスト新設含む**）
- `main/dynamics-tuning-profiles/dynamics-tuning-state.test.ts`
- `main/dynamics-tuning-profiles/dynamics-tuning-profile-store.test.ts`（**v1 プロファイル破棄テスト新設含む**）
- `main/dynamics-tuning-profiles/dynamics-tuning-profile-save-controller.test.ts`
- `main/dynamics-tuning-bridge-handlers.test.ts`
- `control/dynamics-tune-page.test.ts`
- `control/control-window-app.dynamics-tune.test.ts`
- `main/broadcast-source/browser-source-session.test.ts`
- `stage/browser-source/browser-source-stage-client.test.ts`
- `stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts`
- `stage/stage-renderer/runtime-export-evaluation-cache.test.ts`
- `stage/runtime-evaluation/runtime-export-variant-visibility.test.ts`（solverVersion 追従）
- `stage/stage-renderer/runtime-export-stage-scene.test.ts`（solverVersion 追従）
- `main/runtime-export-loader/runtime-export-directory-loader.test.ts`（solver 契約名・capability 追従）

合計 23 ファイル。

## 採用した意味論裁定（§9 の命名の自然な読み）

**「"Scale" 接尾辞を持つノブは乗数、それ以外は置換」** を全面適用（委任プロンプトの裁定に一致）。

| ノブ | 種別 | 適用 | 適用箇所 |
|---|---|---|---|
| `outputScale` | 乗数 | 各 output の `scale * outputScale` | effective-dynamics-tuning.ts |
| `lengthScale` | 乗数 | `segmentLengths.map(L => L * lengthScale)` | effective-dynamics-tuning.ts |
| `limit` | 置換 | `override.limit ?? output.limit` | effective-dynamics-tuning.ts |
| `damping` | 置換 | `override.damping ?? chain.damping` | effective-dynamics-tuning.ts |
| `gravityScale` | 置換 | `override.gravityScale ?? chain.gravityScale` | effective-dynamics-tuning.ts |
| `enabled` | 置換 | `override.enabled ?? group.enabled` | effective-dynamics-tuning.ts |

- **表示値（exportedValues）の基準**: 乗数系（outputScale/lengthScale）は恒等元 **1.0**、置換系は実効値（limit=outputs[0].limit、damping=chain.damping、gravityScale=chain.gravityScale、enabled=group.enabled）。
- **sanitize/parse のバリデーション**: outputScale/lengthScale は**正の有限数**（乗数として 0 以下は無意味）、limit/damping/gravityScale は**非負**、enabled は boolean。

数値テストで検算済み（effective-dynamics-tuning.test.ts の "multiplies scale knobs and replaces the rest"）:
- fixture output.scale=0.5, segmentLengths=[12,6]
- override `outputScale=2, lengthScale=1.5, damping=9, gravityScale=0.25, limit=0.9`
- → output.scale=1.0（0.5×2）, segmentLengths=[18,9]（[12,6]×1.5）, damping=9, gravityScale=0.25, limit=0.9（置換）

## 裁量判断

1. **outputSummary の kind 扱い**: 新スキーマの output に `kind` が無いため、outputSummary の `kind` フィールドを `segment ${segmentIndex}`（例 `"segment 1"`）へ変更。`RuntimePlayerDynamicsTuningParameterRef.kind` は `string` 型なので optional 化せず既存構造を維持（control ページの `formatParameterRef` は `${name} (${kind})` で `Front Hair (segment 1)` と表示）。input 側は新 `kind`（angle/positionX/positionY）をそのまま。
2. **スライダー範囲**:
   - 乗数系: outputScale/lengthScale = min 0.1 / defaultMax 3 / step 0.05（0 起点でなく正数、恒等元 1.0 を中央付近に）
   - 置換系: limit = 0〜2/step0.05（既存準拠）、damping = 0〜60/step0.1（§7 unstableSettings の上限 60 を参照）、gravityScale = 0〜10/step0.05（§7 上限 10 を参照）
3. **値表示の基準**: 上表の通り、乗数系=1.0、置換系=実効値。
4. **署名の outputs ソート鍵**: 旧 `kind` が消えたため `parameterId → segmentIndex` の 2 段ソートで決定性維持。
5. **browser-source-server-message.ts の修正**: 上記「本体ソース」参照。scope 内・波及ゼロと判断し escalate せず修正。

## 旧語彙 grep 結果

```
=== profile v1 literal（source 除くテスト） ===
apps/runtime-player/src/main/dynamics-tuning-profiles/dynamics-tuning-profile-store.test.ts:115:
  schemaVersion: "runtime-player-dynamics-tuning-profile-v1"   ← v1 破棄テストの意図的 legacy fixture（正当）

=== tuning-context pendulum ===
dynamics-tune-page.test.ts: not.toContain("Pendulum count")   ← 旧UIが無いことの否定 assert（正当）
dynamics-tuning-profile-store.test.ts: v1 破棄テストのコメント/legacy fixture（正当）

=== tuning override vocab（strength/sway/reactionSpeed/convergenceSpeed）===
- source(.ts 非テスト) の残存はゼロ（browser-source-server-message.ts も修正済み）
- 残ヒットは全て別機能: model-mapping / live-mapping / stage-motion / window-state / mapping-page.tsx
  の "strength"（マッピング強度・モーション強度）で dynamics tuning とは無関係（scope 外・正当）
- dynamics-tuning-profile-store.test.ts の v1 破棄テスト内 legacy fixture（意図的・正当）
```

tuning 文脈の旧語彙・v1 literal は「v1 破棄テストの意図的 legacy fixture」を除き source から完全撤去。

## 着手前赤の切り分け

runtime-player 全 428 テスト中 **2 件が fail**。いずれも **C 起因でない既存赤**:

1. `main/broadcast-source/browser-source-server.test.ts > serves current Runtime Export payload to authorized Browser Source clients`
2. `stage/browser-source/browser-source-server-message.test.ts > readBrowserSourceRuntimeExportResponse > accepts the not-loaded response shape`

**切り分け根拠**:
- 両失敗の内容は完全に同一 — `not-loaded` レスポンスに実装が `effectiveDynamicsTuning: null` を含めるが、テストの `toStrictEqual` 期待値にそのフィールドが無い、という**フィールドの有無**の不整合。
- 原因の `effectiveDynamicsTuning: null` 出力は `browser-source-server-message.ts`（HEAD コミット `4627bbd3 [modify]playerでの物理演算調整機能` 由来、**作業ツリー未変更 = git status クリーン**）の実装。失敗テスト 2 ファイルも**作業ツリー未変更**。→ HEAD 時点で既に矛盾する既存赤。
- 両テストは tuning override 語彙（outputScale/damping 等）に**一切触れていない**（grep: NO_TUNING_VOCAB）。私の変更は override の**フィールド名**（strength→outputScale 等）であり、`effectiveDynamicsTuning: null` という**フィールドの有無**とは独立。
- 結論: この 2 赤は Domain C の作業と独立した既存赤。新規赤ゼロ。**Domain C では修正しない**（当該テスト/実装は本タスクの write scope の主眼外であり、effectiveDynamicsTuning フィールドの response 追加は別 wave/別ドメインの成果物）。

## escalate / 質問

なし（本タスクは §9 の裁定で全て解決、packages / install / 他 app 波及なし）。

参考質問（呼び出し元判断用、ブロッカーではない）:
- 上記既存赤 2 件（`effectiveDynamicsTuning: null` の response shape 不整合）は、response contract にフィールドを追加した wave の担当ドメインで解消すべきもの。Domain C の scope 外として残置したが、もし本 wave 内で潰すべきなら担当割り当ての指示を頂きたい。

---

## 修正ループ（D-1 / D-2 — Test Adequacy レビュー対応）

Review-Sylph の Test Adequacy レビュー（`discussion/implementation/reviews/wave106/wave106-domain-c-test-adequacy-review.md`、判定「要修正」）の D-1（必須）/ D-2（補強）に対応。**実装ロジック（本体 .ts）は不変、テスト追加のみ。**

### 追加したテストファイル・ケース

**D-1 (1) IPC validation** — 新規 `apps/runtime-player/src/main/dynamics-tuning-bridge-request-validation.test.ts`（7 テスト）
- 全フィールド正常な v2 override が通ること / 欠落フィールドが省かれること
- `outputScale: -1` および `0` が throw（"outputScale must be positive"）
- `lengthScale: 0` および `-0.5` が throw（"lengthScale must be positive"）
- `limit: -0.1` / `damping: -1` / `gravityScale: -2` が throw（"must be non-negative"）
- groupId 欠落が throw / reset request の groupId trim

**D-1 (2) sanitize** — 新規 `apps/runtime-player/src/main/dynamics-tuning-profiles/dynamics-tuning-profile-groups.test.ts`（5 テスト）
- `sanitizeGroupOverride`: 有効 v2 フィールド保持 / 負・0 の outputScale・lengthScale が `Object.keys` から drop / 負の limit・damping・gravityScale が drop / 無効キーだけ落ち有効キー（damping:4）は残る
- 症状連結: `sanitizeGroupOverrides({outputScale:-2})` が `{}` になり、それを `createDynamicsTuningGroupStatuses` に渡すと `hasOverride:false` / `override:null` / `effectiveValues === exportedValues`（乗数系恒等 1.0）となる（＝ override 未指定と同じ既定値挙動）

**D-1 (3) parser** — 新規 `apps/runtime-player/src/main/dynamics-tuning-profiles/dynamics-tuning-profile-parser.test.ts`（3 テスト）
- 有効 v2 override document のパース / 無効フィールド（負 outputScale）が null 化されて drop・有効フィールド（damping:4）は残り warning に "invalid fields" 追加 / 全フィールド無効なら group ごと `profile.groups` から除外され warning 追加

**D-2 v1破棄→既定値 end-to-end** — 既存 `dynamics-tuning-profile-store.test.ts` の v1破棄テストに追記
- v1 破棄で `loaded.profile` が null → その null を `createEffectiveRuntimeExportDynamicsGroups` に渡すと exported dynamics group の恒等クローン（`toEqual` かつ `.not.toBe`）が返ることを同一テスト内で連結。計画 §8 後半「既定値で動く」を症状レベルで固定

### 配置の裁量判断
- validation / parser / groups はいずれも専用 `.test.ts` が存在しなかったため**新規ファイルで作成**（責務ごとに独立ファイルが明確）。
- D-2 は import の都合上も store.test.ts 側に無理なく足せた（既存の model fixture を流用）ため、レビュー第一候補どおり **store.test.ts に追記**。

### テスト結果
- 追加分: validation 7 + groups 5 + parser 3 = **15 新規テスト**（+ store.test.ts の D-2 assert 追記）→ 全 pass。
- 追加4ファイル単位実行: **19/19 pass**。
- runtime-player 全体: **441 pass / 2 fail**（total 428→443、+15）。fail 2 件は着手前 HEAD 由来の既存赤（browser-source `effectiveDynamicsTuning` フィールド有無、Domain C 起因でない）で不変。**新規赤ゼロ**。
- `npx tsc --noEmit -p apps/runtime-player/tsconfig.json` → **exit 0** を維持。

### テスト作成中に観察した実装挙動（実バグではない・報告のみ）
`createDynamicsTuningGroupStatuses`（`dynamics-tuning-profile-groups.ts`）は受け取った `overrides` を**サニタイズせずに生のまま** `applyGroupOverride` へ渡す（L96-97）。そのため、もし生の無効 override（例 `{outputScale:-2}`）が直接渡ると、表示用 `effectiveValues.outputScale` に -2 がそのまま反映されうる。
- ただしこれは**実運用では発生しない**: この関数に渡る `overrides` は常に `RuntimePlayerDynamicsTuningState` 側で `sanitizeGroupOverride`（updateGroup）/ `sanitizeGroupOverrides`（getEffectiveProfile / restore）を通過済みで、無効値は入り口で drop される。
- また `effectiveValues` は**表示専用**で、実際の乗算経路（`getEffectiveProfile()` → `sanitizeGroupOverrides` → effective-dynamics-tuning → adapter）には無効値が到達しない。
- したがってレビューが警戒する「負の outputScale が素通りして乗算で符号反転」は実運用経路では起きない。テストは実運用経路（sanitize を通した空マップ → 恒等）を固定する形にした。
- **判断**: 実バグでないため実装は変更せず。もし「表示関数も入力を防御的に sanitize すべき（多重防御）」という方針なら別タスクで対応可能（指示を仰ぐ）。
