# Expo / Research Archives map freshness audit

基準点: Git HEAD `3c3669eefcc375c62d1ec6b4d77a000d7cbbb61c` / 2026-08-08 (Asia/Tokyo)。
既存 map、source、test、設定は変更していない。`discussion/reports/_map.md` は作業ツリーの監査登録行を除外し、`git show 3c3669e:discussion/reports/_map.md` で判定した。

## 1. 担当範囲と確認した map

対象は `discussion/expo/**/_map.md` と、監査生成物を除く `discussion/reports/**/_map.md` である。確認した map は次の11件。

- `discussion/expo/_map.md`
- `discussion/expo/genai-expo-2026/_map.md`
- `discussion/reports/_map.md`（基準点版）
- `discussion/reports/cmo3-moc3-format-spec/_map.md`
- `discussion/reports/cubism-sdk-runtime-structure/_map.md`
- `discussion/reports/deformer-structure-technology/_map.md`
- `discussion/reports/editor-render-performance/_map.md`
- `discussion/reports/psd-import-fidelity/_map.md`
- `discussion/reports/rights-risk-cleanup/_map.md`
- `discussion/reports/runtime-evaluation-semantics-reference/_map.md`
- `discussion/reports/viewer-preview-reference/_map.md`

相対 Markdown リンクは機械確認済み。`discussion/reports/_map.md` 基準点版を含め **11/11 map、50リンク中0 missing**（editor-render-performance map は file:line のコード参照のみで Markdown link なし）。監査生成物 `map-freshness-audit/` の登録行と配下ファイルは契約どおり判定対象外。

## 2. map ごとの種類と判定

| Map | 種類 | 判定 | 短い理由 |
|---|---|---|---|
| `discussion/expo/_map.md` | `living-index` | **Partially stale** | `:15` が「版面は未着手」とするが、子 map・実ファイルでは6面のHTML/PDFが完成。イベント入口リンク自体は有効。 |
| `discussion/expo/genai-expo-2026/_map.md` | `living-current-state` + `living-index` | **Current**（採択状態は外部未検証） | 6面、PDF、版面規格、停止条件の記述は実在成果物・最終コミットと一致。応募の採択待ちは作業場に記録された状態で、公式公開情報から個別案件の結果までは確認できない。 |
| `discussion/reports/_map.md`（HEAD） | `living-index` | **Partially stale** | 9トピックの列挙・archive境界は正しい。`:31` の editor-render-performance を「現行調査」とする案内は、現行の性能正（`render-performance/`）への導線としては古い。 |
| `discussion/reports/cmo3-moc3-format-spec/_map.md` | `historical-evidence-index` | **Intentionally historical** | private research archive、superseded、Cubism形式を現方針で扱わない旨を明示。リンク・除外方針に矛盾なし。 |
| `discussion/reports/cubism-sdk-runtime-structure/_map.md` | `historical-evidence-index` | **Partially stale** | archive位置付けは正しいが、`:20` の `experiments/cubism-web-moc3-inspector/` は基準点ツリーに存在せず、`:34` のSDK差分確認は現行のCubism除外方針と整合しない。 |
| `discussion/reports/deformer-structure-technology/_map.md` | `historical-evidence-index` | **Partially stale** | 調査資料の索引は有効。ただし `:35-36` の「設計へ統合・MVP方式を決定」は、現行の project-defined `rotation2d` / `warpLattice2d` 実装・accepted contract 後の古い次 action。 |
| `discussion/reports/editor-render-performance/_map.md` | `historical-evidence-index` | **Intentionally historical** | 2026-07-07の静的診断レポートの索引として成立。現行性能の意味論は `discussion/render-performance/` が所有するため、この map の診断スナップショットを現行実装状態とは読まない。 |
| `discussion/reports/psd-import-fidelity/_map.md` | `living-current-state` | **Partially stale** | H1の診断は正しいが、`:19,23-25,31-32` の修正候補・設計待ちは `8640d12` のUV remap修正後も残っている。 |
| `discussion/reports/rights-risk-cleanup/_map.md` | `living-index` | **Current** | cleanup report と実装前に読む導線が実在し、Cubism互換を主張しない境界も現行方針と一致。 |
| `discussion/reports/runtime-evaluation-semantics-reference/_map.md` | `historical-evidence-index` | **Partially stale** | 過去参照としての境界は正しいが、`:34-36,42-45` のruntime pipeline/snapshot判断待ちは accepted runtime contract と実装後の古い次 action。 |
| `discussion/reports/viewer-preview-reference/_map.md` | `historical-evidence-index` | **Partially stale** | 過去参照としての境界・リンクは正しいが、`:34-35,41-44` の設計統合・未決は Shared Runtime/Viewer contract と実装済み境界を反映していない。 |

**判定数:** Current 2 / Partially stale 7 / Stale 0 / Intentionally historical 2 / Unverifiable 0。

## 3. Expo 成果物、commit、採択待ちの検証

### 3.1 リポジトリ事実

`discussion/expo/genai-expo-2026/` には、次の6 HTMLと6 PDFが存在する（`Get-ChildItem discussion/expo/genai-expo-2026/sheets/*.html` / `out/*.pdf`）。下書きHTMLは存在せず、PNG素材は14枚。

- HTML: `01-overview.html`, `02-modeling-result.html`, `03-recipe-hand-eye.html`, `04-ai-builds-body.html`, `05-live-operation.html`, `06-human-and-ai.html`
- PDF: 対応する `01`〜`06` の6ファイル

6 HTMLすべてに `@page { size: 420mm 594mm }` と `width: 420mm; height: 594mm` がある。PDFバイトを read-only 解析した結果、6ファイルすべて **1 page**、`MediaBox [0 0 1191.12 1684.08]` pt（A2 420×594mm相当）だった。

基準点ツリーにも6 HTML/6 PDFが存在する（`git ls-tree -r --name-only 3c3669e .../sheets`, `.../out`）。基準点コミット `3c3669eefcc375c62d1ec6b4d77a000d7cbbb61c`（2026-07-26）は、下書き3件を削除し稼働中6面だけを残したコミットである（`git show --name-status 3c3669e`）。従って `genai-expo-2026/_map.md:15,18,26` の「6面稼働・PDF済み」は検証済みである。

一方、親 `discussion/expo/_map.md:15` の「版面は未着手」は、子 map `discussion/expo/genai-expo-2026/_map.md:24-26`、`sheet-plan.md:22-38`、実ファイル、および上記commitと矛盾する。`poster-design.md:3` にも「版面の実制作は未着手」という古いヘッダーが残るため、子 mapの `poster-design.md` 行は裁定索引としては機能するが、ヘッダーは要更新である。

### 3.2 公式事実と採択待ち

公式サイトは「生成AIなんでも展示会 Vol.6」、開催日 2026-09-23、会場 浜松町、サークル出展受付開始 2026-07-24 を公開している（[公式トップ](https://www.genai-expo.com/)、[出展受付開始のお知らせ](https://www.genai-expo.com/news/entry-open)）。公式ページには個別出展者の採択結果・応募者別ステータスは掲載されていない。

したがって、`discussion/expo/_map.md:15` と `discussion/expo/genai-expo-2026/_map.md:26` の「応募済み・採択待ち」は**作業場に記録されたユーザー状態**としては現時点の導線に使えるが、外部公式情報から個別に再検証できない。採択後の実寸試し刷り（子 map `:32`、③約64dpi・②88dpi）は有効な停止解除条件として残す。採択通知の受領はユーザーだけが確定できる。

### 3.3 既存 untracked artifact

契約に記載された既存変更 `discussion/expo.zip` は未追跡、640,109 bytes、SHA-256 `69C9156E504C0C5F03BEE279172B162A6D4F1DDD63A85D731A5D39786311C4E5`（`git status --short`, `Get-Item`, `Get-FileHash`）。この監査では内容・目的を推定せず、mapの成果物数にも含めない。

## 4. stale / 疑わしい記述と replacement truth

### 4.1 Expo 親 map

- `discussion/expo/_map.md:15` — 「骨子合意、版面は未着手」は誤り。`genai-expo-2026/_map.md:24-26`、`sheet-plan.md:22-38`、6 HTML/6 PDFの実在、commit `3c3669e` が replacement truth。
- `discussion/expo/genai-expo-2026/poster-design.md:3` — child mapから参照される裁定文書のヘッダーだけが旧状態。`sheet-plan.md:22-38` と子 map `:26` が現在の版面状態を示す。

### 4.2 Reports 親 map と性能レポート境界

- 基準点 `discussion/reports/_map.md:31` — `editor-render-performance/` を「現行調査」と案内するが、現行の性能方針・実測・Wave 2受け入れは `discussion/render-performance/_map.md:36-54` にある。性能レポートの静的仮説（`discussion/reports/editor-render-performance/_map.md:13-15`）は過去診断として保持し、性能の意味論は別担当の `render-performance/` を正とする。
- `discussion/reports/_map.md:32` のPSD行はH1発見を正しく索引するが、修正済み状態を表さない。子 mapの修正候補の更新を親統合時に行う。

### 4.3 Archive map の古い次 action

- `discussion/reports/cubism-sdk-runtime-structure/_map.md:20,34` — 実験ディレクトリが基準点に無く、SDK差分確認を未来作業として残す。`discussion/reports/_map.md:11-13` と `discussion/design/module-contracts/module-boundaries.md:20` の現行Cubism除外を優先し、実験は「過去記録・未検証」と明示する。
- `discussion/reports/deformer-structure-technology/_map.md:35-36,42-45` — `bilinear-grid-v1`/pivot affine の暫定合意は、現行の `rotation2d`/`warpLattice2d` implementation-proven（`discussion/implementation/current-capability-map.md:27`）と accepted runtime contract（`discussion/design/module-contracts/runtime-core-contract.md:39-44`）に置換された。Cubismベジェ/3D補助は引き続きMVP外の未決。
- `discussion/reports/runtime-evaluation-semantics-reference/_map.md:34-36,42-45` — Shared Runtimeの評価順序、snapshot粒度、unsupported layersの判断は `discussion/design/module-contracts/runtime-core-contract.md:12-24,32-49,346-350` に反映済み。元レポートは historical evidence として残せるが、未決 register は更新候補。
- `discussion/reports/viewer-preview-reference/_map.md:34-35,41-44` — Editor Preview/Viewer/Shared Runtime境界は `discussion/design/mvp-authoring-runtime/00-mvp-vertical-slice-architecture.md:30-58` と `discussion/design/module-contracts/runtime-core-contract.md:32-49` に反映済み。Cubism Viewer互換を採らない境界は current。

### 4.4 PSD H1修正

- `discussion/reports/psd-import-fidelity/_map.md:17-19` のH1診断は正しい。
- 同 `:23-25,31-32` の「remap着手候補・設計判断待ち」は stale。commit `8640d12218297908af5d7d03a8be4e8af8826b6e` が `canvas-projection.ts` に `contentInset`/`rasterDimensions` を運び、`canvas-render-scene-adapter.ts` でUV remapを実装し、テストも追加した（`git show --stat 8640d12`）。現行コードの remap は `apps/editor/src/workspace/canvas/canvas-render-scene-adapter.ts:98-168`、projection carry は `apps/editor/src/workspace/canvas/canvas-projection.ts:70-82,250-299`。

## 5. 情報種別の区別

- **公式事実:** イベント名・日付・会場・出展受付開始（公式サイト上の公開情報）。個別採択結果は未公開/未確認。
- **リポジトリ事実:** mapと子成果物の存在、6 HTML/6 PDF、A2 CSS、PDF page/media box、Git tree/commit、`8640d12` のUV remap実装、現行 runtime/deformer contract。
- **設計・方針決定:** Expoの成果物ベース基軸（`poster-design.md`）、Cubism SDK/Core・形式を扱わない方針（reports root / module boundaries）、Shared Runtime/Viewer境界（runtime-core contract）。
- **実験・検証結果:** PDFバイトの1-page/A2解析、HTML/CSS pattern check、リンク存在検査。Cubism Web inspectorは実験ディレクトリ不在のため再実行できない。
- **仮説:** `editor-render-performance` のボトルネック順位は当時の静的仮説であり、現行性能の正ではない。
- **未決事項:** 採択通知の受領、採択後の実寸試し刷り、歴史的archive mapの古いnext actionをどこまでbackfillするか、Cubism inspector記録を再開する権限。

## 6. 親 map へ反映すべき結論

1. `discussion/expo/_map.md` の出展行を「6面HTML/PDF完成・採択待ち・採択後に試し刷り」へ更新する。子 `genai-expo-2026/_map.md` は成果物状態の索引として維持し、採択状態は「repo記録・外部未検証」と注記する。
2. `discussion/reports/_map.md` は9トピック（監査登録行を除く）を維持し、editor-render-performanceは `render-performance/` が現行正、PSDは `8640d12` でH1修正済みと分離して案内する。
3. Cubism/Viewer/Runtime/Deformerの過去レポートは private research archive / historical evidence と明記し、古い次 action・未決表は accepted design/implementationへのリンクを付けてから更新する。archive本文を現在の仕様・UX oracleとして扱わない。
4. `discussion/expo.zip` は目的を推定せず、既存untracked変更として保持する。

## 7. 未解決事項・ユーザー判断点

- 個別の採択通知が届いたか、また試し刷りを開始してよいかは外部状態であり、ユーザー判断が必要。
- 親/子 mapの stale status と archive next action を今回の監査後に更新するか（更新順序・文言）はユーザー合意が必要。
- Cubism Web inspectorを再開する場合は、現行のCubism除外方針と別 permission/legal/scope review を先に行う必要がある。

## 8. 調査できなかった範囲

- 出展者個別の採択データ、メール、フォーム内部状態はリポジトリおよび公式公開ページから確認できない。
- `experiments/cubism-web-moc3-inspector/` は基準点ツリーに無く、`web-moc3-inspector-implementation-note.md` に記録された当時の実験を再実行・再検証できない。
- PDFの視認性（64/88dpiでの実寸可読性）は画像レンダリングによる目視確認を行っていない。ここではファイル存在、ページ数、MediaBox、HTML/CSS寸法のみ検証した。
