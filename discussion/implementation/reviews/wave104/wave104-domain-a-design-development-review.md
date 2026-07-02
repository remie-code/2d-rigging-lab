# Wave104 Domain A — Design / Development Review

Verdict: **pass**

Reviewer: Review-Sylph (Design・Development lane, Domain A / Perception Command Core)
Date: 2026-07-03
Basis: `discussion/implementation/orchestration/wave104-plan.md` §3.1 / §6 / §13、開発規約4本（`source-file-organization-policy.md` / `dependency-policy.md` / `operation-policy.md` / `schema-and-id-conventions.md`）、補助 basis `discussion/model-authoring/research/evaluation-and-read-path-survey.md`。

## 要約

Domain A（知覚経路コア + `renderView` + `render` capability + 純 zod スキーマ群）の実装は、ソースファイル構成方針・依存方針・スキーマ/ID 規約に適合している。perception/ 配下は責務ごとに小さく分割され（最大 158 行、god file なし、barrel は再エクスポート専任）、依存方向は `authoring-host(app) → {authoring-core, runtime-core, render-core, render-software, contracts}` で正当、循環なし。ai-interface は render 系依存を一切足さず純 zod のまま（package.json / boundary 未緩和）。L0 裁定 3 件（評価器は runtime-core のみ / Editor Canvas 非移植 / renderView 実処理は host・ai-interface はスキーマのみ）と整合。conditional scope（runtime-core / render-software ソース）は無変更で、狭い export 追加すら不要な設計で完遂している。決定論への配慮（ソートによる Map/Set 反復順の安定化・浮動小数の端点厳密化・JSON キー順固定・POSIX パス正規化）が設計に織り込まれている。bbox ヘルパは Domain C が消費できる公開形で提供されている。

実行証跡:
- `node scripts/check-source-organization.mjs` → **Source organization guard passed.**（exit 0）
- `node scripts/check-dependencies.mjs` → cmo3 finding 1 件のみ（後述の既知先行偽陽性。Wave104 由来の新規 finding ゼロ）
- `pnpm run typecheck`（`tsc --noEmit` ルート）→ exit 0
- `npx vitest run` 対象: ai-interface（dependency-boundary 5 + render-view 7 = **12 passed**）、authoring-host perception（**11 passed**、決定論バイト一致・ビュー変換数値・byteLength reject を含む）

---

## 確認項目ごとの判定

### 1. ソースファイル構成（source-file-organization-policy） — PASS

`apps/authoring-host/src/perception/` は責務ごとに分割されている（行数 / 責務）:

| ファイル | 行 | 責務 |
|---|---:|---|
| `index.ts` | 13 | barrel（`export * from` のみ、実装ロジックなし。DEC-FILE-001 準拠） |
| `evaluation-adapter.ts` | 55 | session → NormalizedRuntimeGraph → 評価済み snapshot |
| `texture-resolution.ts` | 150 | §3.4 テクスチャ寸法解決 + byteLength 検証 + reject エラー型 |
| `render-scene-adapter.ts` | 147 | snapshot → RenderScene 組み立て |
| `evaluated-bounds.ts` | 119 | 評価済み bbox ヘルパ（Domain C 共有公開形） |
| `view-resolution.ts` | 147 | framing 解決（modelBounds / stageViewport / drawableFocus） |
| `parameter-sweep.ts` | 45 | sweep サンプリング |
| `contact-sheet.ts` | 80 | グリッド合成 |
| `render-view-sidecar.ts` | 66 | サイドカー構築 + 安定シリアライズ |
| `render-view-command.ts` | 158 | renderView オーケストレーション（純・FS 非依存） |
| `render-view-file-output.ts` | 70 | 唯一の FS 触層 |

- god file / catch-all なし。禁止名（`types.ts` / `schemas.ts` / `utils.ts` / `helpers.ts`）不使用。最大ファイルは 158 行で 1200 行閾値を大きく下回る。
- `render-view-command.ts`（純パイプライン）と `render-view-file-output.ts`（FS 出力）を分離した設計は、純ロジックの単体テスト可能性を保つ良い責務境界（R-FILE-002）。
- ai-interface 側 `ai-render-view-command.ts`（138 行）は renderView の zod スキーマ族を1ファイルに集約。責務は「renderView コマンドのスキーマ」で一貫しており、DEC-FILE-003（大きな union/スキーマ群を named ファイルへ）に沿う。`index.ts` への追加は `export * from "./ai-render-view-command.js"` の1行のみ（barrel 維持）。
- `check-source-organization.mjs` を実行し **passed** を実確認。

### 2. 依存方針（dependency-policy） — PASS

**依存方向**:
- `apps/authoring-host` の新規依存（`package.json` / `tsconfig.json` / `pnpm-lock.yaml` の importer）は全て `@private-2d-rigging-lab/{render-core, render-software, runtime-core, validator-core}` の workspace 内リンク。app → packages の方向で正当。
- perception 各モジュールの import を精査: `authoring-core`（session, toRuntimeGraph）、`runtime-core`（evaluate, DTO 型）、`render-core`（RenderScene, texture source, signature）、`render-software`（renderSceneToPng, resolveSoftwareRenderView, encodeRgba8ToPng, 座標変換）、`contracts`（RectDto）、`ai-interface`（renderView スキーマ・型）。いずれも下位/横の許可パッケージで、逆流なし。
- **ai-interface が純 zod のまま**: `packages/ai-interface/package.json` は無変更（`git diff` 空）、dependencies は `contracts / operation-core / runtime-core / validator-core / zod` の5件を維持。render-core / render-software は不在。`ai-render-view-command.ts` は `contracts`（`ParameterIdSchema`）と `zod` のみ import し、render 系はコメント言及のみで実 import ゼロ。L0 §3.1-3 の「ai-interface に render 依存を足さない」を満たす。

**循環依存**: perception 内は `evaluated-bounds ← view-resolution`、`texture-resolution ← render-scene-adapter`、`{evaluation-adapter, view-resolution, parameter-sweep, render-scene-adapter, contact-sheet, sidecar} ← render-view-command ← render-view-file-output` の単方向依存で、循環なし。パッケージ間も app→package の一方向。

**外部依存の増加**: `pnpm-lock.yaml` の diff は importers セクションの `workspace:*` internal link 追加のみ（`git diff pnpm-lock.yaml` で確認）。**新規外部依存ゼロ**。Cubism/proprietary 依存の混入なし。L0 承認済みの workspace importer 登録として blocking にしない方針と一致。

### 3. L0 裁定との整合（§3.1） — PASS

- **§3.1-1（評価器は runtime-core のみ、Editor Canvas 非移植）**: `evaluation-adapter.ts` は `toRuntimeGraph(session)`（authoring-core の Export-free 変換）→ `evaluateViewerRuntimeSnapshot(graph, {snapshotDetail:"full"})`（runtime-core）のみを使用。`apps/authoring-host/src` 全体を grep しても `createCanvasEvaluatedScene` / `CanvasEvaluated` / `apps/editor` への参照はゼロ。Editor Canvas 系の移植・共有化の混入なし。
- **§3.1-3（renderView 実処理は host、ai-interface はスキーマのみ）**: 実 render + PNG/サイドカー FS 出力は host 側 `run-render-view-command.ts` → `perception/render-view-file-output.ts` に存在。ai-interface executor は `render` capability gate のみを行い、capability 充足時は `not_implemented` を返す（実処理を持たない）。ai-interface に renderer/FS 依存が入っていないことを §2 で確認済み。
- Runtime Export の知覚経路非経由: perception 配下に Runtime Export の実 import なし（`render-scene-adapter.ts` L31 のコメント文言のみ）。§3.2 Forbidden に非該当。

### 4. スキーマ・ID 規約（schema-and-id-conventions） — PASS

- **DTO/Schema 命名（DEC-SCHEMA-001/003）**: renderView のスキーマ群は外部境界 DTO ではなく zod スキーマ + 派生型として `<Name>Schema` / `<Name>` の対で定義（例: `RenderViewSidecarSchema` / `RenderViewSidecar`、`RenderViewResultSchema` / `RenderViewResult`）。これらは serialized 外部境界だが `Dto` サフィックスは付いていない。ただし本規約の `<Name>DtoSchema` は「external boundary DTO」に対する要求であり、既存 ai-interface のコマンド payload/result 群（`ValidatePackagePayloadSchema`、`InspectModelResultSchema` 等）も同一の非 Dto 命名で確立している。**周辺の確立慣習に一致**しており、renderView だけが逸脱しているわけではない（後述 non-blocking 1 に記録）。
- **schemaVersion のリテラル固定**: `render-view-sidecar-v1` / `render-view-result-v1` を `z.literal` で固定（DEC-SCHEMA-010 の版付き語彙方針に沿う。kebab-case + `-v1`、スペースなし）。
- **機械可読 ID（DEC-SCHEMA-002, R-SCHEMA-002）**: コマンド名 `renderView`（camelCase）、capability `render`（camelCase）、いずれもスペースなし。`ParameterIdSchema`（contracts 由来）を parameterId に再利用しておりローカル重複定義なし（R-SCHEMA-001）。file identifier `render-view.json` / `render-view-sidecar` は kebab-case。
- **zod の使い方**: `discriminatedUnion("kind", ...)` で framing variant を型安全に、`z.record(ParameterIdSchema, z.number().finite())` で override を、数値には `.finite()` / `.positive()` / `.int()` / 範囲（`min/max`）を適切に付与。sweep steps は `min(2).max(64)`、output は `min(1).max(8192)` と境界明示。実行時 `.parse(...)` によるサイドカー/結果の検証も sidecar builder / file-output で行われている（generated が authored を再定義しない、R-SCHEMA-006 に沿う）。

### 5. 設計の質（責務分離・公開形・決定論） — PASS

- **責務分離**: 評価アダプタ（session→snapshot）/ シーンアダプタ（snapshot→RenderScene、texture 供給は texture-resolution に委譲）/ view 解決 / サイドカー / コンタクトシートが各々独立モジュール。renderView オーケストレーション（純）と FS 出力を分離し、純パイプラインを単体テスト可能に保つ。良好な altitude。
- **bbox ヘルパの公開形**: `evaluated-bounds.ts` が `EvaluatedDrawableBounds` / `EvaluatedRigControlBounds` / `evaluatedDrawableBounds` / `allEvaluatedDrawableBounds` / `evaluatedRigControlBounds` / `unionBounds` / `modelEvaluatedBounds` を barrel 経由で公開。Domain C（測量）が消費する「共有契約」として、drawable と rigControl の両対象を返し、`RectDto`（contracts）を型に採る形は再利用可能で妥当。ヘッダコメントにも「Domain C reuses this exact public form」と明記。
- **決定論への配慮**（設計に織り込み済み）:
  - **Set/Map 反復順**: texture 解決は `[...new Set(textureIds)].sort(localeCompare)`（`texture-resolution.ts` L57-59）で安定化。sidecar の parameterOverrides は `Object.entries(...).sort(by parameterId)`（`render-view-sidecar.ts` L25-27）で反復順非依存化。sweep の parameterId 選択もテスト側で sort 済み。
  - **浮動小数**: sweep 値は `min + span*index/(steps-1)`（`parameter-sweep.ts` L43）で端点を厳密に min/max に一致させる（`steps>=2` をスキーマで保証し除数 ≥1）。
  - **JSON キー順**: サイドカーは固定形のオブジェクトリテラルを `JSON.stringify(sidecar, null, 2)` でシリアライズ（`render-view-sidecar.ts` L65-66）。キー順は literal 形状で固定され、同一入力でバイト安定。
  - **パス**: `render-view-file-output.ts` が `toPosixPath` で `\` → `/` に正規化し、result/sidecar のパスをプラットフォーム非依存に（L67-70）。
  - **タイムスタンプ**: サイドカー/結果にタイムスタンプを含めない設計で、時刻由来の非決定性を排除（stale 判定は packageRevision で担保）。
  - コンタクトシートのレイアウトは cellCount のみから列数を導出（`contactSheetColumns` = `ceil(sqrt(n))`）し、入力順に left-to-right/top-to-bottom で充填。決定論的。

### 6. write scope 遵守（§6） — PASS

`git status` / `git diff --stat` で確認:
- **Conditional scope 無変更**: `packages/runtime-core/` は変更ゼロ（狭い export 追加すら発生していない — 既存 API で完遂）。`packages/render-software/src/` はソース無変更（追加は `raster/out-of-range-triangle-index.test.ts` の1件のみで、これは Domain B §7 の B-1 テストであり Domain A 由来ではない）。「無変更と報告されている」という前提を実 git で裏取り。
- **Forbidden scope 非侵害**: `apps/editor/` / `apps/runtime-player/` / `packages/render-webgl2/` / `packages/operation-core/` / `packages/validator-core/src/` / `packages/package-format/src/` いずれも変更ゼロ。ai-interface への render 依存追加なし、boundary テスト緩和なし（§2 で確認）。
- **Allowed scope 内**: `apps/authoring-host/**`（perception/ + renderView CLI ハンドラ）、`packages/ai-interface/src/**`（renderView スキーマ/capability/executor gate）、`apps/authoring-host/package.json` / `tsconfig.json` は §6 許可内。

### 7. チェックスクリプト — PASS（新規 finding なし）

- `node scripts/check-source-organization.mjs` → **Source organization guard passed.**（exit 0）
- `node scripts/check-dependencies.mjs` → finding 1 件:
  `pnpm-lock.yaml: lockfile mentions forbidden dependency class (Cubism cmo3 parser/runtime dependency)`
  この finding の原因は `pnpm-lock.yaml` の integrity ハッシュ行（`sha512-95Pu1QXQvruGEhv62XCMO3Mm90Gsc...`）内に大文字小文字無視で "cmo3" 相当の部分文字列が偶発的に含まれること。**`git show HEAD:pnpm-lock.yaml` で同一 integrity 行が Wave104 変更前から存在することを確認**したため、これは既知の先行偽陽性（計画書 §9/§13 の line 2486 相当。行番号は環境で前後するが原因は同一の integrity ハッシュ偽陽性）。Domain A の lockfile 変更は importers セクションの workspace link 追加のみで、**Wave104 由来の新規 finding はゼロ**。
- `pnpm run typecheck`（`tsc --noEmit`）→ exit 0。

---

## blocking findings

なし。

## non-blocking findings

1. **renderView スキーマの `<Name>Schema` 命名（`Dto` サフィックス不使用）** — `RenderViewSidecarSchema` / `RenderViewResultSchema` 等は serialized 外部境界（サイドカー JSON / コマンド result）を成すが、schema-and-id-conventions DEC-SCHEMA-001 の `<Name>DtoSchema` 形ではなく `<Name>Schema` を採る。ただし ai-interface の既存コマンド payload/result 群（`ValidatePackagePayloadSchema` 等）も一貫して非 Dto 命名で確立しており、renderView のみの逸脱ではない。周辺慣習との整合を優先した実装として妥当。ai-interface 全体の Dto 命名整備は本 wave スコープ外。判定に影響なし（記録のみ）。

2. **sweep セルの column/row 再計算** — `render-view-command.ts` の `sweepCells` が `swept.index % contactSheet.layout.columns` で column/row を再導出し、`contact-sheet.ts` 内の充填ロジックと同一計算を二重化している。両者とも同一 `columns` を使うため結果は必ず一致し、テストでセル 0/3 の位置が検証済み。将来レイアウト規則を変更する際の乖離リスクを避けるなら `composeContactSheet` がセル座標も返す形が望ましいが、現状の整合性に問題はない。（Spec Compliance レーンと同一の観察）

3. **executor 共存ファイルの Domain B 差分** — `ai-command-executor.ts` の read ディスパッチ配線（`#executeReadCommand` / `readHost`）、および `run-authoring-host-command.ts` の state-directory ガード・readHost 統合は Domain B の変更で、Domain A の renderView 分岐と同一ファイルに共存する。本レビューは Domain A 分（renderView union / `render` capability / `#executeRenderView` gate / `isRenderViewCommand` 分岐）に限定して検証した。read 統合・state-dir ガードの妥当性は Domain B レビューの管轄、全体整合は Domain D の管轄（計画書の指示どおり non-blocking 記録に留める）。

## 質問

なし。Domain A の Design・Development 観点（ソース構成・依存方向・L0 整合・スキーマ/ID 規約・設計の質・write scope・チェックスクリプト）は全項目が実行証跡付きで pass しており、blocking なしの pass 判定に迷う点はない。
