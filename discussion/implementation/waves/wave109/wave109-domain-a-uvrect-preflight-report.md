# Wave109 Domain A — uvRect preflight 検証の新契約整合(Domain report)

Domain id: `wave109-uvrect-preflight-reconcile`
実装担当: Gnome(サブエージェント委任 / 呼び出し元 = Orch-Sylph)
コミット: **未実施**(wave gate = ユーザー統制点)

## 1. 目的の要約

Wave108 で placement の `uvRect` が「ラスタ全体(contentRect)」→「contentInset を折り込んだ content サブ矩形」へ意味変更された。packing は Wave108 時点で新契約(inset 適用済み uvRect を書き込む)に揃っていたが、Runtime Export preflight の検証 `doesUvRectMatchContentRect` だけが旧契約(uvRect == contentRect)のまま残り、非ゼロ inset の placement を `runtimeExport.invalidPlacementData` で全件偽ブロックしていた。本 wave はこの reconcile 漏れを閉じ、期待値導出を共有ヘルパーへ単一実装化して再乖離を構造的に封じた。

## 2. 作成/変更ファイル(リポジトリ相対)

作成:
- `packages/authoring-core/src/texture-atlas-content-rect.ts` — 共有ヘルパー(`deriveContentSubRectUv` + `ZERO_CONTENT_INSET`)。
- `packages/authoring-core/src/texture-atlas-content-rect.test.ts` — ヘルパー単体テスト(4 ケース)。

変更:
- `packages/authoring-core/src/texture-atlas-packing.ts` — `createTextureAtlasPlacement` の contentUvRect/uvRect 算出をヘルパー呼び出しへ置換。packing 内の `ZERO_CONTENT_INSET` 定数と `contentUvRect` ローカルを削除(ヘルパーへ集約)。import 追加。
- `packages/authoring-core/src/runtime-export-assembly.ts` — `doesUvRectMatchContentRect` の期待値をヘルパーで算出(inset 解決の配線を追加)。呼び出し元へ `session` を渡す。import 追加(`getTextureAtlasEntryById`, `deriveContentSubRectUv`)。
- `packages/authoring-core/src/texture-atlas-packing.test.ts` — `PackingTargetFixture` に `contentInset?` を追加、`createTextureEntry` で伝播、非ゼロ inset の uvRect 数値固定テストを追加。
- `packages/authoring-core/src/runtime-export-assembly.test.ts` — 非ゼロ inset の合格/不合格テスト 2 件と `createInsetRuntimeExportFixtureSession` fixture を追加。

## 3. 実装の要点

### 3.1 共有ヘルパー(単一実装)
`packages/authoring-core/src/texture-atlas-content-rect.ts`:

```
export const deriveContentSubRectUv = (input: {
  readonly contentRect: TextureAtlasRectPixelsDto;
  readonly contentInset: TextureContentInsetDto | undefined;
  readonly pageWidth: number;
  readonly pageHeight: number;
}): TextureAtlasUvRectDto
```

- inset 未指定(undefined)は `ZERO_CONTENT_INSET`(`{left:0,top:0,right:0,bottom:0}`)として扱い、旧 packing-local `ZERO_CONTENT_INSET` の意味論を継承。
- 演算順序は現行 packing と**完全一致**: pixel 空間で `contentUvRect.x = contentRect.x + inset.left` / `width = contentRect.width - inset.left - inset.right`(top/bottom も同様)を先に確定し、その後 `x / pageWidth` 等で正規化(唯一の float 演算)。`bottomRight` も `(contentUvRect.x + contentUvRect.width) / pageWidth` の順で現行と同一。整数 pixel 値のため division 以外に float 演算が無く、出力は厳密一致。
- 根拠コメントに設計文書 §3.1/§4 参照と「packing と preflight 検証が同一関数を共有し再乖離を構造的に封じる」趣旨を記載。

### 3.2 packing 置換
`createTextureAtlasPlacement` は `deriveContentSubRectUv({ contentRect, contentInset: input.target.contentInset, pageWidth, pageHeight })` を呼び、戻り値を `uvRect` にそのまま使用。`contentRect`(pixels)算出や他フィールドは不変。出力値は完全不変(既存 packing テストが green で担保 + 数値固定テスト追加)。

### 3.3 検証側 reconcile
`doesUvRectMatchContentRect(placement, page, session)` へ `session` 引数を追加。inset 解決:
`getTextureAtlasEntryById(session.graph, placement.originalTextureId)?.contentInset` を helper の `contentInset` に渡す(未解決なら undefined → zero inset)。page 寸法は現行どおり `page.width`/`page.height`。`nearlyEqual` 許容差 `1e-9` は据え置き。照合ロジック(topLeft/bottomRight を nearlyEqual で全一致要求)は不変で、期待値の**式だけ**を新契約へ更新。包含チェック化・許容差拡大・スキップは一切入れていない。呼び出し元 `validateRuntimeExportPlacements` は既に `input.session` を保持しており、`input.session` を渡す 1 行のみ変更。

## 4. 追加/変更したテストと担保内容

ヘルパー単体(`texture-atlas-content-rect.test.ts`, 4 件):
- inset undefined = 全 contentRect 正規化。
- 明示 zero inset と undefined が同一結果。
- 非対称 inset の content サブ矩形正規化(数値固定)。
- 4096 ページ・17px inset(claude-chan topwear 相当)で packing と同一 float 順序の一致。

packing(`texture-atlas-packing.test.ts`, +1 件):
- 非ゼロ inset `{left:1,top:0,right:1,bottom:2}` の texture で `uvRect` が content サブ矩形になる(数値固定 `contentRect(2,2,4,4)→uvRect (3/12,2/12)-(5/12,4/12)`)。ヘルパー置換後も packing 出力が新契約どおりであることを固定。既存の zero-inset 数値テスト(padded/content/source/uv)は無変更で green = 出力厳密一致を担保。

preflight(`runtime-export-assembly.test.ts`, +2 件, +1 fixture):
- **合格**: body 源テクスチャに `contentInset {left:1,top:0,right:0,bottom:1}` を仕込み packing→apply した session が `assembleRuntimeExport` で `ready`。**修正前は同 fixture が invalidPlacementData で blocked**(packing は inset uvRect を書くが旧検証が contentRect と照合して落ちる)= 回帰検知点。
- **不合格(検証力維持)**: 同 fixture の body placement の `uvRect` を旧契約値(contentRect 正規化 = inset 無視)へ書き戻すと `runtimeExport.invalidPlacementData` で blocked。緩和が紛れ込んでいないことを担保。
- zero inset / inset 無しの従来ケースは既存多数テスト(既定 fixture)が無変更 green で無退行を担保。

`createInsetRuntimeExportFixtureSession`: 既定 fixture の TEX_BODY に contentInset を注入してから packing/apply する派生 fixture(既存 `createAppliedRuntimeExportFixtureSession` パターン踏襲)。atlas bake bytes/dimensions は不変のため digest/byteLength は valid のまま、かつ source signature は contentInset を含まない(§7 参照)ので staleAtlas も発火しない。

## 5. テスト結果

- focused(必須):
  - `pnpm.cmd exec vitest run packages/authoring-core/src` → **41 files / 317 tests passed**(新規含む)。
  - `pnpm.cmd typecheck` → **pass**(`tsc --noEmit` エラー無し)。
- preferred:
  - `pnpm.cmd exec vitest run packages` → **242 files / 1500 tests passed**。authoring-core 外への波及無しを確認。

環境操作(install 等)は一切不要だった(escalate 無し)。

## 6. 裁量判断(設計未定義を埋めた箇所)

- **entry 欠落 = zero inset 扱い**: `getTextureAtlasEntryById` が undefined を返す場合、ヘルパーへ undefined を渡し zero inset として照合する(指揮書要件 3 の指示どおり)。根拠 = 源テクスチャ entry の欠落自体は別ブロッカー系(`originalTextureId` と drawable.textureId 不一致など)の責務であり、この UV 形状検査の責務ではない。妥当と判断。**疑義があれば Orch 裁定を仰ぐが、指揮書が明示指定しているため escalate ではなく採用。**
- ヘルパーの配置は指揮書推奨どおり新規ファイル `texture-atlas-content-rect.ts`(packing・assembly 双方から import される単一実装)。public index への re-export はしていない(内部モジュール間 import のみで足りる)。

## 7. 注意事項・残課題・注記

- **staleAtlas 併発の注記**: 実データで texprep をやり直して inset が変わるケースでは texture の bytes/dimensions/contentHash が変わり、それらは atlas source signature に含まれるため `runtimeExport.staleAtlas` が必ず併発する(計画 §8 のとおり)。したがって本修正が単独で偽ブロッカーを出す経路は無い。なお **source signature(`texture-atlas-source-signature.ts` の `normalizePackableTarget`)は `contentInset` を署名対象に含めていない**。よって「bytes/dimensions は不変で contentInset だけが変わる」合成状態では staleAtlas は発火しない(本 fixture が `ready` に到達できるのはこのため)。実運用の texprep 再実行は必ず bytes も変えるので、この非包含が実害を生む経路は現状無い。ただし将来 contentInset を独立に編集し得る UI が出来た場合は署名非包含が論点になり得る — Forbidden scope(署名は不変)につき本 wave では触れず、注記のみ残す。
- **content-inset スキーマ三重化(Wave108 Residual ①)への型依存**: ヘルパーは `TextureContentInsetDto`(`packages/package-format/src/texture-atlas.ts:73-79` の `TextureContentInsetSchema`)を単一の inset 型として使用している。packing 側 target.contentInset(`texture-atlas-targets.ts` 経由で textureEntry.contentInset から伝播)、検証側(texture entry.contentInset)ともにこの同一 DTO を指す。三重化集約(後続 wave)が `TextureContentInsetDto` を正典として残す限り、本ヘルパーの型参照は集約後も無改修で通る想定。集約が別名/別形へ移す場合は本ヘルパーの import 1 箇所を追随させれば済む(単一実装ゆえ影響は局所)。
- **Forbidden scope 遵守**: `packages/package-format`(スキーマ)、texprep・生成器・レンダラ・`runtime-export-materialization.ts`・editor UI は一切変更していない。placement schema への contentInset 追加はしていない。Wave108 Residual ① の集約にも着手していない。

## 8. Orch への質問

- 現時点で設計未定義による停止判断は無し(entry 欠落=zero inset は指揮書明示指定を採用)。
- 上記 §7 の「source signature が contentInset を含まない」点は Forbidden scope(署名不変)に触れず注記に留めたが、後続 wave(Residual ① / 独立編集 UI)で論点化する可能性がある旨のみ申し送る。裁定不要なら注記のまま。

## 9. 完了状態

- `doesUvRectMatchContentRect` が新契約で照合、非ゼロ inset 回帰テスト含む focused テスト + typecheck が green。
- packing と検証が同一ヘルパー `deriveContentSubRectUv` を使用、期待値導出の二重実装は消滅。
- preferred(`vitest run packages`)も green。
- コミット未実施(wave gate)。Review-Sylph のレビュー待ち。
