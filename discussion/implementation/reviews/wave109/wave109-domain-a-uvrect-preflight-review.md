# レビューレポート: Wave109 Domain A — uvRect preflight reconcile

- ループ: 1 / 5
- 判定: 合格

## 設計適合

観点1〜6すべて適合。現物照合で確認。

1. **導出が単一実装** — 適合。packing(`createTextureAtlasPlacement`)・検証(`doesUvRectMatchContentRect`)ともに `deriveContentSubRectUv`(`packages/authoring-core/src/texture-atlas-content-rect.ts`)を呼ぶ。packing 側の diff で旧 `contentUvRect` ローカルと packing-local `ZERO_CONTENT_INSET` 定数はいずれも削除済み(別式の残存なし)。`ZERO_CONTENT_INSET` はヘルパー側に単一集約され、undefined inset を zero inset として吸収。

2. **packing 出力の厳密不変** — 適合。ヘルパーは pixel 空間で per-side inset を確定してから page 寸法で除算する順序で、旧 packing の float 演算順序と完全一致(除算のみが float op、整数 pixel 由来)。既存の zero-inset 数値固定テスト群が無変更で green = 出力厳密一致を担保。加えて packing 側に非ゼロ inset の数値固定テスト(`contentRect(2,2,4,4)` inset `{1,0,1,2}` → uvRect `(3/12,2/12)-(5/12,4/12)`)が追加され新契約値を固定。

3. **期待値の出所が commit 済みデータ** — 適合。inset は `getTextureAtlasEntryById(session.graph, placement.originalTextureId)?.contentInset` で解決(`texture-asset-selectors.ts`、graph の textures から find)。揮発状態・再計算に依存せず、commit 済み texture entry と placement のみが入力。page 寸法も従来どおり `page.width`/`page.height`。

4. **検証力が緩和されていない** — 適合。照合ロジックは topLeft/bottomRight を `nearlyEqual`(許容差 `1e-9` 据え置き)で全一致要求のまま。包含チェック化・許容差拡大・スキップは一切なし。変更は「期待値の式のみ」を新契約へ更新。旧契約値(inset 無視の contentRect 正規化)が今も落ちる不合格テストが実在し有効(下記テスト適合)。

5. **entry 欠落 = zero inset** — 適合。`textureEntry?.contentInset` が undefined → ヘルパーが zero inset として照合。これは計画 §5 Required implementation 3 の明示指定(「entry が見つからない場合の扱いは zero inset として照合」)どおりで、Gnome の裁量創作ではない。ソースコメントにも「entry の欠落は他ブロッカー系の責務」と設計意図を明記。

6. **Forbidden scope 遵守** — 適合。wave の変更は authoring-core src の6ファイル(新規2: `texture-atlas-content-rect.ts` + `.test.ts` / 変更4: packing・assembly と各 test)に閉じる。`packages/package-format`(スキーマ・placement への contentInset 追加)、texprep・生成器・レンダラ・`runtime-export-materialization.ts`・editor UI はいずれも無変更。placement schema への contentInset 追加なし。Wave108 Residual ①(スキーマ三重化集約)未着手。
   - 注: git status に `apps/soul/agent/**`(cockpit)の変更が並ぶが、これはセッション開始時点で既に存在する別作業(操縦席UI改定)であり本 wave の footprint ではない。wave109 の実装は authoring-core に限定されている。

## テスト適合

観点7(必須テスト4項目)いずれも実在かつ有効なアサーション。

- **非ゼロ inset が通る** — `runtime-export-assembly.test.ts`「accepts non-zero-inset placements whose uvRect is the content sub-rect」。`createInsetRuntimeExportFixtureSession` が body 源テクスチャに `contentInset {left:1,top:0,right:0,bottom:1}`(2px raster に対し非自明)を注入し packing→apply。`assembleRuntimeExport` が `ready`。修正前は packing の inset uvRect と旧検証の contentRect 照合が食い違い `invalidPlacementData` で blocked = 回帰検知点として成立(inset が実際に uvRect に効いていることを fixture が保証)。
- **旧契約値が落ちる** — 同ファイル「still blocks a placement whose uvRect ignores the source contentInset」。同 fixture の body placement uvRect を旧契約値(contentRect 正規化 = inset 無視)へ書き戻すと `runtimeExport.invalidPlacementData` で blocked。非ゼロ inset ゆえ contentRect ≠ content サブ矩形で、検証力維持を実証。
- **zero inset 無退行** — 既定 fixture 由来の既存多数テストが無変更 green。ヘルパー単体テストでも undefined と明示 zero inset の同値を固定。
- **packing 出力厳密一致** — packing 既存 zero-inset 数値テスト無変更 green + 非ゼロ inset 数値固定テスト追加 + ヘルパー単体の「4096 ページ・17px inset で packing と同一 float 順序」テスト。

ヘルパー単体テスト(`texture-atlas-content-rect.test.ts`, 4件)も意味のあるアサーション(undefined=全 contentRect / zero と undefined 同値 / 非対称 inset 数値固定 / 実データ scale float 順序一致)。

## テスト結果

自分で再実行し全 green を確認(Gnome report の主張と一致):

- `pnpm.cmd exec vitest run packages/authoring-core/src` → **41 files / 317 tests passed**(必須)。
- `pnpm.cmd typecheck`(`tsc --noEmit`)→ **pass**(エラーなし。削除した packing-local 定数に伴う orphan import なし: `TextureAtlasRectPixelsDto` は packing 内で他4箇所現用)。
- `pnpm.cmd exec vitest run packages` → **242 files / 1500 tests passed**(preferred)。

環境操作(install 等)不要。escalate なし。

## 裁量判断

- **entry 欠落 = zero inset**: 計画 §5 の明示指定であり裁量ではない(上記観点5)。合理的で妥当。
- **ヘルパー配置**: 新規 `texture-atlas-content-rect.ts`(packing・assembly 双方から import される単一実装)。public index への re-export はせず内部 import のみ — 適切(単一実装の要件を満たし、露出を最小化)。
- **source signature が contentInset を非包含**という Gnome 申し送り(§7)は、Forbidden scope(署名不変)に触れず注記に留めた判断が妥当。本 wave では bytes/dimensions 不変ゆえ fixture が `ready` 到達でき、実運用の texprep 再実行は必ず bytes を変えるため実害経路なし。将来の独立編集 UI 出現時に論点化し得る旨の申し送りは適切。裁定不要(注記のまま容認)。

## 差分・残課題

なし。実装は計画 §5 の Allowed scope 内に閉じ、Required implementation 4項目・Required tests 4項目をすべて満たし、Review focus の全観点に適合。検証力の緩和なし、二重実装の消滅を確認。
