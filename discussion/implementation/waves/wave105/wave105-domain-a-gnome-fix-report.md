# Wave105 Domain A — Gnome Fix Report (Test Adequacy P5 gap closure)

実装者: Gnome（opus）。委任元: Orch-Sylph（Wave105 Domain A 完遂役）。
基盤: `discussion/implementation/reviews/wave105/wave105-domain-a-test-adequacy-review.md`（P5 / The gap 節）。
制約遵守: テストのみ追加、本番コード無変更（下記 mutation 実証で git 差分ゼロを証明）。

## 採用した案: 案 A（`modelEvaluatedBounds` への直接ユニットテスト）

理由:
- レビューが推奨した通り、フィクスチャ改変より局所的で、`modelEvaluatedBounds` の契約
  （visible-only union）を直接固定できる。
- co-located 問題（eye/eye-mask が同一領域に重なり片方を隠しても union bbox が縮まらない）を
  確実に回避できる。手組み snapshot なら隠れる drawable を可視 union の bbox 外へ明示配置でき、
  visible-only vs union-all の差が rect の width/height に直に現れる。
- `modelEvaluatedBounds` は `snapshot.drawables[].{visible, bounds}` のみを参照する
  （`evaluated-bounds.ts:121-128` を確認）ため、レンダラやフィクスチャを介さず最小 snapshot で
  契約全体を exercise できる。案 B（フィクスチャ追加 + 差分 framing 比較）はレンダリング経路を
  巻き込む分、gap を捕まえる assertion の因果が間接的になる。

## 追加したテスト

ファイル: `apps/authoring-host/src/perception/evaluated-bounds.test.ts`（新規、127 行）

- ヘルパ `snapshotWithDrawables`（:37-72）: `modelEvaluatedBounds` が消費する
  `drawables[].visible` / `drawables[].bounds` のみを与え、他フィールドは schema 妥当な既定で
  埋めた最小 `RuntimeSnapshotDto` を組む。既存 `snapshot-comparison.test.ts` の手組み snapshot 規約に準拠。
- テスト 1（:75-104）「excludes a hidden drawable that sits OUTSIDE the visible union's bbox」:
  - 可視 drawable を `[0,10]×[0,10]`、`visible:false` の drawable を可視 union の外
    `[100,120]×[100,120]` に配置。
  - `expect(bounds).toEqual({ x: 0, y: 0, width: 10, height: 10 })`。
  - 旧挙動（union-all）なら `{ x:0, y:0, width:120, height:120 }` に広がり赤化 = mutation 検出。
- テスト 2（:106-124）「unions every drawable when all are visible」: gate-free framing 不変を固定。
  両 drawable 可視なら union は `{ x:0, y:0, width:120, height:120 }`。visible-only／union-all
  どちらでも緑（この test は mutation 非検出。gate-free 経路の回帰防止用のペア）。

## Mutation 実証（実効性の証明）

手順（レビュー P5 の再現）:
1. テスト追加後、単体全緑を確認（2 passed）。
2. `evaluated-bounds.ts:124-128` の `.filter((drawable) => drawable.visible)` を一時除去（union-all に戻す）。
3. 再実行:
   - テスト 1「excludes a hidden drawable …」が **赤化**:
     `expected { x:0, y:0, width:120, height:120 } to deeply equal { x:0, y:0, width:10, height:10 }`。
   - テスト 2（gate-free）は緑のまま（狙い通り visible-only の除外だけを捕捉）。
   - → 追加テストが P5 gap を確実に閉じることを実証。
4. 即座に filter を復元。

復元の git 実証:
- `git diff apps/authoring-host/src/perception/evaluated-bounds.ts` は Wave105 Domain A の
  **元実装差分（作業開始前から存在する未コミット変更）そのもの**であり、mutation の痕跡は無い。
  復元後の実体は `.filter((drawable) => drawable.visible)` 込みの visible-only 実装（`evaluated-bounds.ts:124-128`）。
- 元差分の内容（JSDoc の visible-only 説明 + filter 追加）は Wave105 実装完了時点と一致。私による
  恒久変更はゼロ。

## 検証結果一覧

| 項目 | コマンド | 結果 |
|---|---|---|
| 追加テスト単体 | `npx vitest run apps/authoring-host/src/perception/evaluated-bounds.test.ts` | 2 passed |
| 全 authoring-host（ref e2e 含む） | `npx vitest run apps/authoring-host` | 15 files / 82 tests passed |
| 型チェック | `npx tsc --noEmit -p apps/authoring-host/tsconfig.json` | exit 0 |
| mutation 赤化 | filter 除去 → 単体再実行 | テスト 1 赤化（gate-free は緑）→ 復元済み |
| 追加物の限定 | `git status --porcelain | grep evaluated-bounds` | `?? evaluated-bounds.test.ts` のみ追加。`M evaluated-bounds.ts` は Wave105 元差分（作業前から存在） |

## スコープ遵守

- 書込みは `apps/authoring-host/src/perception/evaluated-bounds.test.ts`（新規テスト）のみ。
- `perception-fixtures.ts` は改変不要（案 A のため）。本番コード（`evaluated-bounds.ts` 等）・
  runtime-core / render-* / package-format・lockfile・新規依存の変更なし。

## 質問 / 残リスク

- なし。P5 gap は閉じ、全緑・型 OK・mutation 実効性実証・本番無変更をすべて満たした。
