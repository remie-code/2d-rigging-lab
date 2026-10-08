# Wave104 Domain C — Design / Development Review

- Wave: Wave104
- Domain: C (`wave104-measurement-ref-e2e`)
- Review lane: Design / Development
- Reviewer: Review-Sylph (opus)
- Date: 2026-07-03
- Verdict: **pass**

## Verdict summary

Domain C（`inspectEvaluatedGeometry` 測量コマンド + §3.4 改訂の検証付き導出梯子 + ref/ e2e + ユーザー
目視 gate 成果物）の**設計・実装品質は高く、L0 裁定・§8 の write scope・開発規約に整合している**。

- 測量は Domain A の評価アダプタ（`evaluatePerceptionSnapshot`）と同一の runtime-core 評価経路を共有し、
  bbox / 頂点を snapshot から直読みして再計算していない（§3.3 遵守）。warp 格子制御点は runtime-core の
  狭い additive export（`EvaluatedRigControlDto.evaluatedControlPoints`）経由で、conditional scope 1
  の選択肢 1 を採用。評価挙動の変更なし。
- read 統合は Domain B の確立パターン（`AiReadCommandHost` の optional method + `executeAiReadCommand`
  の分岐）に完全同型。ai-interface には純 zod スキーマのみ追加し renderer 依存ゼロ。boundary allowlist 非緩和。
- texture-resolution.ts の derived-verified 梯子は §3.4 改訂の梯子どおり（declared 最優先 → rest mesh
  bounds 由来候補を byteLength 厳密一致のみ採用 → 曖昧/不一致は決定論的 reject → 寸法源種別を記録）。
  Domain A の declared 経路は非退行。
- ref/ は e2e 実行後も git status に現れず無変更。決定論（PNG バイト一致）は実機で再現。新規外部依存 / lockfile
  の Domain C 由来変更ゼロ。

判定基準（root `tsc --noEmit` exit 0 + Domain C 所有ファイルのテスト green）を実機で満たす。blocking なし。

## 確認した証拠（実測）

- `npx vitest --run packages/runtime-core/src/rig-control-evaluated-control-points.test.ts`: **3 passed**
  （素の実行で安定 green。`--config vitest.config.ts` を明示した一過性の設定衝突で 3 failed が出たが、素の
  実行では再現せず。実体は green）。
- `npx vitest run --root apps/authoring-host measurement-command texture-resolution-derivation`:
  **9 passed**（measurement 4 + derivation 5）。
- `npx vitest run --root apps/authoring-host ref-e2e`: **4 passed**（validate report 返却 /
  126 テクスチャ derived-verified / PNG バイト一致決定論 / 測量包含関係）。
- `npx vitest run --root apps/authoring-host`（全体）: **12 files / 50 tests passed**（Domain A/B/C
  非退行）。
- `npx vitest run packages/ai-interface`: **17 files / 107 tests passed**（Domain B レビュー時 105 →
  measurement schema/dispatch の追加分を含め非退行）。
- `npx tsc --noEmit`（root）: **exit 0**。
- `node scripts/check-source-organization.mjs`: **passed**。
- `node scripts/check-dependencies.mjs`: cmo3 / pnpm-lock の**既知先行偽陽性 1 件のみ**（exit 0）。
  Domain C 由来の新規 finding ゼロ。
- `git diff --check`: CRLF warning のみ・whitespace エラーなし（clean）。
- `git status --short ref/`（e2e 実行後）: **空**（ref/ 無変更）。
- `git diff pnpm-lock.yaml`: `apps/authoring-host` importer への 4 workspace link 追加のみ（Domain A/B
  install 由来、Domain B レビューで承認済み分類）。Domain C 由来の新規外部依存ゼロ。
- ai-interface boundary allowlist（`dependency-boundary.test.ts:33-39`）: 依然
  `contracts / operation-core / runtime-core / validator-core / zod` の 5 本のみで pass。render-core /
  render-software 非追加。ai-interface package.json 無変更。

## Findings

### BLOCKING

なし。

### NON-BLOCKING（設計・品質メモ）

- **C-DEV-N-01（記録のみ / Domain C 判定対象外・Domain A 所有）: サイドカーの絶対パス埋め込み**
  - `ref-render-gate/*.render-view.json` の `packagePath` / `pngPath` にマシン絶対パス
    （`C:/workspace/remie/...`）が入る。§3.2 の決定論は「同一パッケージ状態 + 同一リクエスト → バイト同一
    の **PNG**」でありサイドカー JSON のマシン非依存性は要求していない。ref-e2e の決定論アサーションも
    PNG バイト一致のみを検証しており、この観察は決定論違反ではない。ただし別マシンで再生成するとサイドカー
    JSON はパスが変わる。これは **Domain A の render-view-sidecar.ts の設計**であり Domain C の実装範囲外。
    記録のみ（Domain C の blocking / needs_fix にはしない）。

- **C-DEV-N-02（記録のみ）: measurement は evaluated-bounds.ts helper を経由せず snapshot 直読み**
  - `measurement-command.ts` は `evaluatedDrawableBounds` 等の Domain A 公開 helper を呼ばず
    `snapshot.drawables[].bounds` を直読みしている（rig control 側も snapshot 直読み）。返す値は helper が
    返すのと同一（同じ snapshot フィールド）であり、§3.3 の「同じ経路・同じアダプタを共有」（＝
    `evaluatePerceptionSnapshot` 共有）は満たしている。helper の再利用は §3.3 の必須要件ではなく、直読みは
    冗長な間接を避ける妥当な選択。品質メモとして記録のみ。

## 観点別判定

### 1. Write scope 遵守（§8）

- **PASS**。git diff / untracked で変更範囲を実証。
  - allowed scope 内: `apps/authoring-host/src/perception/measurement-command.ts`（新規） /
    `measurement-command.test.ts` / `texture-resolution-derivation.test.ts` / `ref-e2e.test.ts` /
    `test-support/perception-fixtures.ts`、`packages/ai-interface/src/ai-measurement-command.ts`（+test）
    と AiCommandName / payload / response / capability / index への inspectEvaluatedGeometry 追加、
    `ref-render-gate/**`（新規 dir: 3 PNG + 3 サイドカー + measurement gate + README）、
    root `package.json` の `test:ref-e2e` scripts 追加、`authoring-host-command-host.ts` への
    `inspectEvaluatedGeometry` メソッド追加。
  - conditional 1（runtime-core export）: `rig-control-evaluation.ts` に `evaluatedControlPoints`
    optional フィールド + `computeEvaluatedWarpControlPoints` の**狭い additive 追加のみ**。評価挙動不変
    （後述 §3）。Domain A/B 実装の再設計なし。
  - conditional 2（texture-resolution.ts）: derived-verified 梯子の**追加のみ**。declared 経路（rung 1）は
    「behavior identical to Domain A's original path」でコメント明示、reject 順序も維持（後述 §4）。
    Domain A の他 perception ファイルへの再設計なし。
  - forbidden ゼロを実証: `ref/**` 無変更（e2e 後 git status 空）、Editor / Player / render-webgl2 /
    operation-core / validator-core / package-format の挙動変更なし（diff に現れない）、ai-interface への
    render-core/render-software 依存追加なし（boundary 非緩和）、新規外部依存 / lockfile の Domain C 由来
    変更なし（lockfile diff は Domain A/B install 由来の workspace link のみ）。

### 2. 設計整合（§3.3 / Domain A・B パターン共有）

- **PASS**。
  - `measurement-command.ts` は `evaluatePerceptionSnapshot(session, {parameterOverrides})`（Domain A の
    評価アダプタ）を呼び、`full`-detail snapshot の `drawables[].bounds` / `drawables[].vertices` /
    `rigControls[].bounds` / `rigControls[].evaluatedControlPoints` を直読みする。bbox 計算や評価経路の
    再実装なし。renderView と同じ評価経路を共有し、測量と描画が同じ評価ポーズを記述する（コメントでも明示）。
  - read 統合: `AiReadCommandHost.inspectEvaluatedGeometry?` を optional method として追加し、
    `executeAiReadCommand` に `host.inspectEvaluatedGeometry === undefined → not_implemented` 分岐 +
    ok 分岐を追加。これは inspectModel / inspectTarget / validatePackage と完全同型（capability `read`
    チェック・transcript 記録は既存機構のまま）。executor 側で再実装していない。host は
    `AuthoringHostCommandHost implements AiReadCommandHost` で inspectEvaluatedGeometry と validatePackage
    のみ提供し、他 read は未実装（機構が not_implemented を返す）。Domain B のパターンに整合。
  - パラメータ override の echo は決定論的（`parameterId` で localeCompare sort）。

### 3. runtime-core export の設計品質（conditional 1）

- **PASS**。
  - `evaluatedControlPoints: z.array(Vec2DtoSchema).optional()` を `EvaluatedRigControlSchema` に追加。
    optional のため既存 DTO 消費者に影響しない（`...(x === undefined ? {} : { x })` パターンで
    exactOptionalPropertyType 対応）。
  - 値は warp 評価中に**既に内部計算済み**の `WarpLattice2dLocalState.controlPointOffsets` を
    `restControlPoints[i] + offset[i]` で合成しただけ。`computeEvaluatedWarpControlPoints` は pure かつ
    決定論的で、length 不一致（blocked/invalid config）時は undefined を返す防御的設計（部分整合座標を
    出さない）。**評価ロジック自体への変更なし**（warp 評価の呼び出し順・結果に手を入れていない）。
  - 命名・スキーマは既存慣習（zod / Dto 型 / `Vec2DtoSchema` 消費）に整合。JSDoc が「narrow, additive
    export ... does not change any evaluation behavior」と明示。
  - テスト（`rig-control-evaluated-control-points.test.ts`）は評価器から独立に期待値を手計算
    （rest / half / full の 3 点で `rest[i] + offset[i]` を検証、各隅に distinct offset を与えて index
    順序も pin）。オウム返しでなく数値検証。既存 runtime-core テスト非退行（full suite の tsc/vitest green）。

### 4. texture-resolution.ts の導出設計（conditional 2 / §3.4 改訂）

- **PASS**。
  - **候補源の妥当性**: rest mesh bounds（対象 drawable の `mesh.bounds`）を候補源に選定。整数かつ正の
    bounds のみを候補化（非整数は「pixel-dimension claim ではない」として除外）。コメントに ref に対する
    bounded 確認結果（126 per-layer テクスチャすべてが単一参照 drawable の整数 mesh bounds を持ち
    byteLength 一致）を根拠記録。梯子拡張の根拠が報告されている。
  - **安全弁**: `byteLength === w*h*4` 厳密一致した候補のみ採用。`Number.isSafeInteger` で乗算オーバーフロー
    もガード。一致候補が 0 → `byteLengthMismatch` reject、複数 distinct 候補が一致（曖昧）→
    `missingDimensions` reject。無検証 bounds 推定の採用は不可能な構造。
  - **declared 優先の梯子順**: rung 1（`textureEntry.dimensions !== undefined`）が最優先で、declared
    経路は byteLength 検証必須・reject 順序とも Domain A オリジナルと同一（コメント明示）。rung 2 は
    declared 不在時のみ。§3.4 改訂の梯子どおり。
  - **寸法源の記録**: `TextureDimensionSourceKind = "declared" | "derived-verified"` を
    `resolveTextureDimensionSources` で公開し、renderView サイドカーの `textureDimensionSources[]` と
    ref-e2e が記録。黙った推定なし（"verified AND announced, never silent"）。ai-interface サイドカー
    スキーマへの `textureDimensionSources[]` optional 追加も Domain C の allowed 範囲（sidecar は
    Domain A 所有だが optional 追加は非破壊）。
  - **テスト**（`texture-resolution-derivation.test.ts` 5 件）: 導出成功 / byteLengthMismatch /
    候補なし（非整数 mesh bounds）/ 曖昧（4x4 と 8x2 が両方 area=16→byteLength 64 で一致 → reject）/
    declared 優先。期待値は mesh bounds を読んで byteLength を独立構築。曖昧ケースの設計が特に堅牢。

### 5. コード品質（規約適合）

- **PASS**。
  - source-file-organization-policy: 新規ファイルは責務単位（measurement-command.ts = 測量 resolver、
    texture-resolution.ts の derivation = 寸法梯子）。テストは隣接配置。perception/index.ts は barrel
    re-export のみ。catch-all ファイルなし。
  - schema-and-id-conventions: `inspect-evaluated-geometry-result-v1` / `ref-measurement-gate-v1` は
    versioned kebab（スペースなし）。`InspectEvaluatedGeometryPayloadSchema` 等は discriminatedUnion で
    kind を判別、`min(1)` で空 target を reject、`z.number().finite()` で NaN/Inf を排除。
  - 命名一貫性: `measureEvaluatedGeometry` / `resolveTextureDimensionSources` /
    `TextureDimensionSourceKind` / `computeEvaluatedWarpControlPoints` は責務が明快。private フィールド
    `#packageDocument`、`readonly`、optional スプレッドパターンを踏襲。
  - `any` の濫用なし。テストの型キャストはアサーション用で許容範囲。フィクスチャは operations で組み立て
    （§8「フィクスチャは operations で組み立ててよい」に適合）、`now` は固定日付で決定論的。

### 6. 決定論

- **PASS**。
  - 測量結果: parameterOverrides を sorted echo、bounds/vertices/制御点は評価 snapshot 直読み。ref-e2e が
    「同一リクエスト 2 回で `results` 完全一致」を実測。
  - PNG: ref-e2e が「同一リクエストを別ディレクトリに再レンダしてバイト一致」を実測（`rerunBytes.equals`）。
  - サイドカー / measurement gate JSON: タイムスタンプ・乱数・UUID・generatedAt 系キーなし（grep で確認）。
    measurement gate は `packageRevision` + `results` のみ。実行時間の console.log は非ブロッキングかつ
    成果物ファイルに入らないため決定論に無影響。
  - 唯一の環境依存はサイドカーの絶対パス（C-DEV-N-01。Domain A 所有・PNG 決定論に無影響・記録のみ）。

## 質問（L0 / Orch-Sylph へ）

1. **Domain C report の不在**: `discussion/implementation/waves/wave104/` に
   `wave104-domain-c-measurement-ref-e2e-report.md`（§12 Expected Persistent Artifacts）が未作成。
   Design/Development レーンとしてはコード実装が pass だが、conditional scope 2 件（runtime-core export /
   texture-resolution 梯子）の justification と bounded 確認根拠（候補源選定 = rest mesh bounds）は
   §8 が「explicit report justification」を要求している。現状これらはコード JSDoc / 本レビューには
   記録されているが、Domain 報告書としての記録が未了。report 作成は Gnome / Orch-Sylph の管轄と理解して
   よいか（Design/Development レビューの pass 判定には影響しないが、§8 の scope 契約充足として Domain D
   統合前に必要）。
2. C-DEV-N-01（サイドカー絶対パス）は Domain A 所有の設計で Domain C 判定対象外と分類したが、ref-render-gate
   成果物のポータビリティが将来問題になるなら Domain A 側 findings として拾い上げるべきか。現時点では
   §3.2 の決定論定義（PNG バイト一致）を満たすため記録のみとした。
