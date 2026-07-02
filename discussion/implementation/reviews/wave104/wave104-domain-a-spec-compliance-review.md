# Wave104 Domain A — Spec Compliance Review

Verdict: **pass**

Reviewer: Review-Sylph (Spec Compliance lane, Domain A / Perception Command Core)
Date: 2026-07-03
Basis: `discussion/implementation/orchestration/wave104-plan.md` §3.1 / §3.2 / §3.4 / §6 / §10、補助 basis `discussion/model-authoring/research/evaluation-and-read-path-survey.md`。

## 要約

Domain A（知覚経路コア + `renderView` + `render` capability）の実装は §3.2 の知覚仕様・§3.4 のテクスチャ寸法解決・§6 の実装/テスト要求・§10 の明示確認項目をすべて満たしている。サイドカー必須フィールドは網羅され、ビュー変換値・drawableFocus フレーミング・sweep セル対応・byteLength reject の各テストは**独立計算の期待値**で検証されており、実装出力のオウム返しではない。決定論（2 回実行バイト一致）はメモリ上・ディスク上の両テストを**自分で実行して pass を実確認**した。Runtime Export は知覚経路に一切 import されておらず、dependency-boundary は緩和されていない。Forbidden write scope への Domain A 由来の変更はゼロ。

実行証跡:
- `npx vitest run --root apps/authoring-host` → **37 passed / 9 files**（決定論テスト・ビュー変換数値テストを含む）
- `npx vitest run packages/ai-interface`（ルートから）→ **101 passed / 16 files**（renderView スキーマ 7 tests・dependency-boundary 5 tests を含む）
- `npx tsc -p apps/authoring-host/tsconfig.json --noEmit` → exit 0

---

## §10 明示確認項目ごとの判定

### 1. サイドカー必須フィールドの充足 — PASS

`packages/ai-interface/src/ai-render-view-command.ts` `RenderViewSidecarSchema`（L116-126）が §3.2 の必須フィールドを全て型で保証:
- 対象パッケージパス: `packagePath`（L118）
- `packageRevision`: L120（`int().nonnegative()`）
- 解決済み `parameterOverrides`: `RenderViewResolvedOverrideSchema[]`（L122、`{parameterId, value}` の配列）
- 解決済みビュー変換: `resolvedView`（L123 → `RenderViewResolvedViewSchema` L74-80）= `stageViewport / outputWidth / outputHeight / pixelsPerStageX / pixelsPerStageY`（§3.2 の `pixelsPerStage` を軸別に保持）
- スイープ時のセル↔パラメータ対応表: `sweep?`（L124 → `RenderViewSweepLayoutSchema` L100-108 → `cells: RenderViewSweepCellSchema[]` に `cellIndex / column / row / parameterId / parameterValue`）

sidecar 生成側 `apps/authoring-host/src/perception/render-view-sidecar.ts` `buildRenderViewSidecar`（L29-58）が全フィールドを埋め、`RenderViewSidecarSchema.parse(...)` で実行時に検証。`packageId` は `session.packageIdentity.packageId`、`packageRevision` は `session.packageRevision`（`render-view-command.ts` L51-52）。スキーマ round-trip テストは `ai-render-view-command.test.ts` L72-98、実出力テストは `render-view-command.test.ts` L79-121（sweep）と L123-159（単発）で確認。

### 2. サイドカーのビュー変換値の数値正確性（オウム返しでないこと） — PASS

`render-view-command.test.ts` "records a numerically correct view transform in the sidecar"（L123-159）を精読:
- `stageViewport {minX:10, minY:20, width:80, height:40}` + `outputWidth:160, outputHeight:40` を入力し、`pixelsPerStageX` の期待値を **`160/80 = 2`、`pixelsPerStageY` を `40/40 = 1` と手計算で独立に導出**して照合（L140-142）。実装出力をそのまま期待値にしていない。
- さらにサイドカーの数値だけから `resolveSoftwareRenderView` を再構築し、stage(50,40) → pixel の期待値を **`((50-10)*2, (40-20)*1) = (80,20)` と独立計算**して照合、順逆往復（`stagePointToImagePixel` / `imagePixelToStagePoint`）も検証（L147-158）。「画像↔モデル座標の翻訳が成立する」ことの実証として妥当。

実装は `resolveSoftwareRenderView(view)`（`render-view-command.ts` L65）で render-software の正式解決を通しており、サイドカーはその `ResolvedSoftwareRenderView` を写すだけ（`render-view-sidecar.ts` L45-56）。値の由来が正式経路であることを確認。テストは §1 の実行で **pass を実確認**。

### 3. 決定論（2 回実行バイト一致）の実再現 — PASS（自分で実行）

- メモリ上: `render-view-command.test.ts` "renders a deterministic rest-pose PNG (byte-identical across two runs)"（L22-35）— 2 回 render し base64 一致を assert。
- ディスク上: `perception/render-view-file-output.test.ts` "writes byte-identical PNG bytes across two runs of the same request (on disk)"（37 tests のうちファイル出力 2 tests に含まれる）。
- `npx vitest run --root apps/authoring-host` を実行し、両テストを含む **37 passed** を実確認（出力に該当 test 名の ✓ を目視）。決定論の裏付け（sidecar の parameterOverrides を parameterId でソート `render-view-sidecar.ts` L25-27、テクスチャを textureId でソート `texture-resolution.ts` L57-59、contact-sheet が cellCount のみからレイアウトを導出 `contact-sheet.ts` L33-49、POSIX パス正規化 `render-view-file-output.ts` L67-70）もソースで確認。

### 4. drawableFocus の bbox 由来解決 — PASS

- `apps/authoring-host/src/perception/view-resolution.ts` `resolveStageViewport`（L54-89）は drawableFocus 時に `evaluatedDrawableBounds(input.snapshot, view.drawableId)`（L76）で**評価済みスナップショット由来**の bbox を取り、`applyMargin`（L91-101）で `minX = x - width*marginRatio`、`width = width*(1 + marginRatio*2)` を適用。degenerate bbox は `ViewResolutionError` で reject（L82-86）。
- bbox の源 `apps/authoring-host/src/perception/evaluated-bounds.ts` `evaluatedDrawableBounds`（L31-41）は `snapshot.drawables[].bounds` を返す。この snapshot は `evaluateViewerRuntimeSnapshot(graph, {..., snapshotDetail:"full"})` の**評価後**の産物（`evaluation-adapter.ts` L43-49）であり、rest 静的値ではない。
- marginRatio: payload schema でデフォルト `0.1`（`ai-render-view-command.ts` L45）、テスト（`render-view-command.test.ts` L52-77）が `marginRatio=0.25` で期待値を**bbox から独立計算**して照合。**pass を実確認**。

### 5. Runtime Export 非経由 — PASS

`apps/authoring-host/src/perception/` 全ファイルを grep（`runtime-player|RuntimeExport|runtime-export|createRuntimeExport|RuntimeExportModelDto`）した結果、ヒットは `render-scene-adapter.ts` L31 の**コメント文言のみ**（「semantics match the runtime-export stage scene builder」）で、実 import はゼロ。評価経路は `toRuntimeGraph(session)`（authoring-core、Export-free）→ `evaluateViewerRuntimeSnapshot`（runtime-core）（`evaluation-adapter.ts` L42-49）で構成され、runtime-player / Runtime Export DTO を経由しない。§3.2 Forbidden「Runtime Export を知覚経路の必須中間物にする」を満たさない = 適合。

### 6. テクスチャ byteLength 検証の存在 — PASS

`apps/authoring-host/src/perception/texture-resolution.ts`:
- 寸法源は `textureEntry.dimensions`（L83）= AuthoringGraph の texture atlas エントリの正式寸法のみ。`dimensions === undefined` は `missingDimensions` で reject し、コメントで「bounds-derived estimates are not accepted (§3.4)」と明記（L84-91）。bounds 推定 fallback を黙って採用していない。
- byteLength 検証: `expectedByteLength = dimensions.width * dimensions.height * 4`（L115）と `binaryEntry.bytes.byteLength` を照合し、不一致（および `!Number.isSafeInteger`）で `byteLengthMismatch` を throw（L116-125）。決定論的 reject。
- テスト: `render-view-command.test.ts` "rejects a texture whose byteLength does not match its declared dimensions (§3.4)"（L175-191）が寸法 8x8（期待 256 bytes）に対し byteLength 16 を仕込んで `TextureResolutionError` を assert。**pass を実確認**。

### 7. boundary 非緩和 — PASS

- `packages/ai-interface/package.json` は **無変更**（`git diff` 空）。dependencies は `contracts / operation-core / runtime-core / validator-core / zod` の 5 件のまま = render-core / render-software の追加なし。
- `dependency-boundary.test.ts` は**無変更**（`git status --porcelain` に現れず）。厳密 allowlist（L33-39 で 5 依存を `toEqual`）・forbidden import パターン（L44-45）・barrel-only チェックを保持。`npx vitest run packages/ai-interface` で **dependency-boundary.test.ts 5 tests pass** を実確認。
- 新規スキーマ `ai-render-view-command.ts` は `contracts`（allowlist内）と `zod` のみ import。render-software への言及はコメント（L9,17,70）に留まり実 import なし。

### 8. Forbidden write scope 非侵害 — PASS

`git status --porcelain` で確認:
- `apps/editor/**` / `apps/runtime-player/**` / `packages/render-webgl2/**` / `packages/operation-core/**` / `packages/validator-core/**` / `packages/package-format/**`: いずれも変更ゼロ。
- `packages/render-software/`: `src/raster/out-of-range-triangle-index.test.ts` の**新規テスト 1 件のみ**で、これは Domain B（§7 B-1 の許可済みテスト追加）であり Domain A 由来ではない。
- `packages/ai-interface/src/`: renderView スキーマ + capability + executor 配線（executor は Domain B と共有ファイル、`renderView` gate 分は §6 Domain A 許可スコープ内）。
- `apps/authoring-host/src/perception/**` および renderView CLI ハンドラは §6 の allowed write scope 内。

---

## blocking findings

なし。

## non-blocking findings

1. **sweep セルの column/row の二重計算（軽微な冗長）** — `render-view-command.ts` の `sweepCells`（L123-129）が `swept.index % contactSheet.layout.columns` で column/row を再計算しており、`composeContactSheet` 内（`contact-sheet.ts` L63-64）と同一ロジックを二度書いている。両者とも同じ `columns` を使うため**結果は必ず一致**し、テスト（`render-view-command.test.ts` L119-120）でセル 0/3 の位置が検証済み。整合性上の問題はないが、将来レイアウト規則を変える際の乖離リスクを避けるなら composeContactSheet がセル座標も返す形が望ましい。判定に影響なし。

2. **executor の `renderViewNotImplementedPayload` プレースホルダ** — `ai-command-executor.ts` の render capability gate は capability 充足時に `not_implemented` を返し、スキーマ充足用のダミー payload（`pngPath:"not-implemented"` 等）を生成する（Domain A 共有分）。これは §3.1-3「実処理は host 側」の意図通りで、実 render は authoring-host の `runRenderViewCommand`（`run-render-view-command.ts`）が担う。設計として正しいが、caller がこのダミー sidecar を実データと誤読しないよう、host 経路が正規であることは Domain D の統合確認で担保されるべき（記録のみ）。

3. **Domain B 由来の executor 共存差分** — `ai-command-executor.ts` の read ディスパッチ（`#executeReadCommand`）配線は Domain B の変更。Domain A レビューでは Domain A 分（`#executeRenderView` / render capability / renderView union 追加）のみを検証対象とし、read 統合の妥当性は Domain B レビューの管轄。全体整合は Domain D。

## 質問

なし。Domain A の §10 全項目が実行証跡付きで pass しており、blocking なしの pass 判定に迷う点はない。
