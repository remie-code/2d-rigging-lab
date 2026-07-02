# Perception Path Survey

> 知覚経路（パッケージ + パラメータ値 → 描画画像）の存否調査。2026-07-02 Sylph 調査（B、モデル: opus）の L0 統合。証拠パス付きリポジトリ事実。

## 結論

**「パッケージ + パラメータ値 → 変形後 RenderScene（純データ）」までは既存部品の純 JS 連結で Node 到達可能。欠けているのは最後の一段「RenderScene → 実ピクセル → PNG」のみ。** 律速は評価ではなくラスタライズ + 読み出しに局在しており、切り分けの見通しは良い。

## 存否一覧

| 項目 | 状態 | 証拠 |
|---|---|---|
| GL 不要な「パラメータ → 評価」評価器 | **存在する** | `packages/runtime-core/src/viewer-evaluation.ts:158`（`evaluateViewerRuntimeSnapshot`）。依存は contracts + zod のみ。`parameterOverrides` を渡し頂点含むスナップショットを得られる（`snapshot.ts:113,187,355`） |
| GL 不要な「評価 → RenderScene」構築 | **存在する** | `apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts:83,138`。純データ、DOM 非依存 |
| Node でのパッケージ読込（fs） | **存在する** | `apps/runtime-player/src/main/runtime-export-loader/runtime-export-directory-loader.ts:2,182,196`（`node:fs/promises`）。Runtime Export のテクスチャは **raw RGBA8**（PNG デコード不要） |
| Node での render-to-image | **存在しない** | 実描画 3 箇所すべて実ブラウザの `getContext("webgl2")` 依存（`render-webgl2/src/webgl2-renderer.ts:281-292`）。ソフトウェアラスタライザ無し |
| ピクセル読み出し口 | **存在しない** | `WebGl2Like` 抽象に `readPixels` 未定義（`webgl2-context.ts:8-115`）。`RendererBackend.render(): void` で**出力を取り出す契約が型レベルに無い**（`render-core/src/renderer-backend.ts:17-20`） |
| PNG エンコーダ / コンタクトシート合成 | **存在しない** | repo 内 grep で toDataURL / toBlob / PNG encode 0 件 |
| e2e スクリーンショット | **無効化** | `apps/editor/playwright.config.ts:11`（`screenshot: "off"`）。検証は DOM 属性ベース、パラメータ注入スクショ経路無し |
| Editor Viewer / Runtime Player のキャプチャ機能 | **存在しない** | Player の OBS ブラウザソース配信（HTTP+WS）はあるが実描画はクライアント側ブラウザ。サーバはピクセルを持たない |

## 最短経路の見立て（事実ベース）

**Runtime Export 形式を起点にした Node 経路**が最短:

1. `runtime-export-directory-loader.ts` が fs で manifest + texture page を読む
2. `createEvaluatedRuntimeExportStageRenderInput(payload, {parameterOverrides})` → runtime-core 評価 → RenderScene（純データ）
3. テクスチャは raw RGBA8 で DOM 不要

**欠落部品（事実。設計は未着手）**: ① Node で動く GL 実装（または純 JS ラスタライザ）② readback 口（`WebGl2Like`/`RendererBackend` の契約拡張）③ PNG エンコーダ ④ コンタクトシート合成。

Editor 経路（`canvas-render-scene-adapter.ts`）はシーン構築こそ DOM 非依存だが、実描画 `canvas-renderer.ts` が DOM 密結合 + テクスチャが PSD 由来 PNG の DOM デコード前提のため不利。

## PSD 読み込みのヘッドレス可否

**Node 実行可能で確定。** `@webtoon/psd@0.4.0` は純 ESM でブラウザ専用 API 依存なし。Node スモークが実在（`scripts/wave44-psd-parser-smoke.mjs` ほか、ルート package.json 登録済み）。

## 問いの外の気づき（B 報告より）

1. コンタクトシート化に必要な「パラメータ差分だけ変えて N フレーム評価」は既存 API（`baselineParameterOverrides` / `parameterOverrides`, `viewer-evaluation.ts:70-71`）で回せる。
2. `RendererBackend.render(): void` が構造的ボトルネック。GL 実装を差し替えても readback 契約を別途足す必要がある。
3. `FakeWebGl2Context`（GL 呼び出し列を記録するテストモック, `webgl2-renderer.test.ts:263`）等の描画等価テスト資産は画像化の正しさ検証に流用余地あり（推測）。
4. **テクスチャ形式が経路で二層**: Runtime Export は raw RGBA8（Node 向き）、open-model-package-v1 / Editor 側は PSD 由来 PNG（DOM デコード前提）。**入力をどちらに据えるかで必要部品が変わる**。

## 変換パス（open-model-package-v1 → Runtime Export）の追調査結果（2026-07-02 追記）

- **変換の中核ロジックは `packages/authoring-core` にあり、DOM/Canvas 非依存で Node 実行可能**: `preflightRuntimeExport` / `assembleRuntimeExport`（`runtime-export-assembly.ts`）、`createRuntimeExportArtifacts`（純粋データ変換）、`createTextureAtlasPageRgbaBytes`（`Uint8Array` ピクセルコピーのみ）。
- **ブラウザ依存なのはディレクトリ書き込みだけ**（`writeRuntimeExportToPickedDirectory` が File System Access API 依存）。`RuntimeExportFileSet` を受けて `node:fs` に書くラッパーを新規に書けば足りる（小規模）。
- 入力は `AuthoringSession`（グラフ状態 + `binaryAssets.fileEntries`）+ **コミット済み Texture Atlas が前提条件**（未コミットは `runtimeExport.noCommittedAtlas` でブロック）。出力は `runtime-export.json` + `runtime/model.json` + `runtime/atlas.json` + `assets/textures/<pageId>.raw-rgba`。
- Runtime Export v0 は**単一ページ atlas のみ**（`assertRuntimeExportV0SinglePageArtifacts` で強制）。
- ヘッドレスからこの変換を起動する既存経路は**無し**（呼び出し元は GUI タスク画面 1 箇所 + テストのみ）。
- テクスチャはこの経路に来る時点で**既に raw RGBA8 として session に格納済み**（PSD→raw RGBA デコードはテクスチャインポート時の別工程。その工程の DOM 依存性は未確認だが、wave44 の Node スモーク `scripts/wave44-psd-layer-materialization.mjs` が Node での layer raw RGBA materialization を実証しており、Node 可能性が高い — 推測）。

## 分岐材料の更新

- 当初の分岐「Runtime Export vs パッケージ直」は、変換ロジックが Node 実行可能と判明したことで**偽の二択になった可能性が高い**: ヘッドレスホストが `AuthoringSession` を保持するなら、operation 実行も Export 組み立ても（そして評価→描画も）**同一プロセス内の関数呼び出し**として繋げられる。
- 残る設計上の注意点: ①Atlas コミットが Export の前提条件（知覚のたびに atlas を要求するか、session 直接評価で迂回するか）②単一ページ atlas 制約 ③PSD インポートのデコード工程の所在（未確認）。
