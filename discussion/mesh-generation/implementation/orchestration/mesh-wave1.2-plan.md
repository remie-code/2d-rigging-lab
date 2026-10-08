# Mesh Wave 1.2 Plan: original 経路の contentInset UV remap(PSDインポート位置ズレ修正)

> PSDインポート直後のライブキャンバスで、パーツ絵柄が自バウンズ中心へ P px(5〜17px・レイヤーサイズ依存)縮んで見える位置ズレを、original 描画経路への contentInset UV remap で解消する単一ドメイン小 wave。原因調査の正は [import-position-mismatch-investigation.md](../../../reports/psd-import-fidelity/import-position-mismatch-investigation.md)。

## 1. Status

- Status: Planned / ready for orchestration
- Target wave: Mesh Wave 1.2(PSDインポート位置ズレ = A1 パディング既知 de-scope の解消)
- 系譜: Mesh Wave 1.1(Domain E: 仮想パディング)が導入した A1/Option E パディング設計の直系フォローアップ。パディング焼き込みと contentInset 記録は正しく、描画側(original 経路)の UV 反映欠落だけが欠陥

## 2. Oracles / User Decisions(2026-07-12 確定)

- 修正方針: **最小修正**。original 経路(編集キャンバス)に contentInset の UV remap を入れる。atlasRuntime プレビューの編集キャンバス導入(大工事)は採らない — ユーザー決定
- 配置: 本 wave は mesh-generation トピック内(案A)— ユーザー決定
- スコープに **設計文書の項5改訂** と **canvas-projection.ts の陳腐化コメント更新** を含める — ユーザー合意
- 根本原因の正: [調査レポート](../../../reports/psd-import-fidelity/import-position-mismatch-investigation.md)(H1 確定・H2/H3/H4 棄却)。座標・パディング・contentInset 記録は正しく、誤りは描画側のみ
- remap 式の正: アトラス側の既存実装 `packages/authoring-core/src/texture-atlas-packing.ts:544-587`(contentUvRect)と同型
  - `u' = (insetLeft + u × contentW) / paddedW`(contentW = paddedW − insetLeft − insetRight)
  - `v' = (insetTop + v × contentH) / paddedH`(contentH = paddedH − insetTop − insetBottom)
- Model Allocation: L0 = fable / Orch-Sylph・Gnome・Review-Sylph = **opus 明示必須**

## 3. Domain F: original 経路 contentInset UV remap

Domain id: `mesh-wave1_2-original-content-inset-uv-remap`

### Allowed write scope

- `apps/editor/src/workspace/canvas/canvas-projection.ts` と同テスト(`canvas-projection.test.ts`)
- `apps/editor/src/workspace/canvas/canvas-render-scene-adapter.ts` と同テスト
- Viewer `original` モード関連ファイル(`apps/editor/src/workspace/viewer/**`)は、**下記 Required implementation 6 の調査で「同一欠陥・同型修正で閉じる」と確認できた場合の追加的変更のみ許可**。構造変更が要るなら変更せず escalate
- `discussion/design/mesh-rendering/boundary-transparent-margin-design.md` の項5(original プレビューの扱い)の**最小差分改訂**
- Domain report / review files(`waves/mesh-wave1.2/domain-f-report.md`, `reviews/mesh-wave1.2/domain-f-review.md`)

### Forbidden write scope

- アトラス側(`texture-atlas-packing.ts` ほか packages/authoring-core のアトラス系)の挙動変更 — remap 式の参照元であり回帰基準
- mesh-generation v6/v7 パイプライン・契約(`mesh-generation-contract.ts`)・`packages/render-core` の UV space 定義(`layer-local-top-left-0-1-v1` の意味論は変えない。remap は editor 側アダプタで行う)
- PSD インポート adapter(`browser-psd-parser-adapter.ts`)と materialization 側(`import-psd-layer-materialization.ts`)— パディング焼き込み・contentInset 記録は正しい(調査レポート §1)
- セッションに保存済みのメッシュ UV 値の書き換え(remap は描画時変換であり、保存データは content 空間のまま)
- 新規依存・lockfile / コミット / `pnpm install`
- 実 PSD(ユーザー私有素材)へのアクセス・fixture 化は不要かつ禁止。検証は合成フィクスチャで行う

### Required implementation

1. **contentInset 伝搬**: `canvas-projection.ts` で textureEntry の `contentInset`(+ padded `dimensions`)を `CanvasRenderableDrawable` へ伝搬する(現状 contentInset が下流へ渡っていない。候補箇所は調査レポート §4: `:232-238, 360-395`)
2. **UV remap**: `canvas-render-scene-adapter.ts` で、content 空間 UV を padded ラスタの**コンテンツ副矩形**へ写すアフィン変換(§2 の式)を適用する。bounds quad(`createBoundsQuadRenderMesh`)・grid・輪郭メッシュの全 content UV に一様適用
3. **非クランプ**: remap はアフィン写像のみとし、クランプしない。被覆マージン overshoot(content UV が 0..1 の外に相当する頂点)が padding の透明域へ落ちる A1 設計を保存する
4. **後方互換**: `contentInset` 不在または全辺 0 のテクスチャエントリ(旧セッション・非 PSD 系)では UV 不変(従来挙動)
5. **陳腐化コメント更新**: `canvas-projection.ts:366-377` の「§5.5 de-scoped — atlasRuntime is the canonical preview」コメントを実状(original も contentInset remap で内容位置を正す)へ更新
6. **有界調査(Viewer original)**: Viewer 画面の `original` モードが同じ「padded ラスタ + content UV」経路を共有しているか確認する。共有(または同一欠陥の別経路で同型修正が Allowed scope 内で閉じる)なら修正し、構造変更が要るなら事実を報告して escalate
7. **設計文書改訂**: boundary-transparent-margin-design.md 項5を「original プレビューも contentInset UV remap により内容位置を正とする(パディング枠は remap により見た目から消える)。atlasRuntime が runtime 一致検証の正典である地位は不変」の趣旨で最小改訂

### Required tests

- **remap 単体(本waveの核)**: 四辺 inset P>0 のテクスチャで、bounds quad の UV が `[P/paddedW, (paddedW−P)/paddedW]` 系に写ること。grid・輪郭メッシュの UV にも同一式が適用されること
- **後方互換**: `contentInset` 不在 / 全辺 0 で UV が 0..1 のまま不変であること
- **非クランプ**: content 空間で 0..1 を超える UV(被覆マージン相当)が、クランプされずに padded 域内の期待座標へ線形に写ること
- **位置の意味論**: 合成フィクスチャ(既知パターンのコンテンツ + 既知 P のパディング)で、remap 後のコンテンツ描画位置が bounds と一致することを数値アサーションで検証(ピクセルレンダリングテストは必須ではない。数値で足りるかは Gnome 裁量・レビューで妥当性判断)
- **回帰**: `canvas-projection.test.ts` / `packages/package-format/src/texture-content-inset.test.ts` / `packages/authoring-core/src/texture-atlas-transparent-gutter.test.ts` を含む既存テストが green。判定基準は mesh-wave1 同様「**新規 fail ゼロ**」(既知 fail は現状記録と照合)

### Escalate if

- `CanvasRenderableDrawable` / render scene の型変更が `packages/render-core` 側の契約変更を要求する場合
- Viewer original 経路が構造変更(共有部品の新設等)を要する場合
- contentInset が描画側へ届かない導線(セッション復元・別インポート経路等)が見つかり、Forbidden scope の修正が必要になる場合

### User gate(wave 外)

- ユーザーが実 PSD(私有素材)を再インポートし、目・襟(topwear/neck_back 境界)の位置が比較元ツールの表示と一致することを目視確認する
- 注: remap は描画時変換のため、**既存のインポート済みセッションも再インポート不要で**修正後の表示になる見込み(パディング済みラスタと contentInset は保存済みで正しいため)。gate ではその確認も兼ねる

## 4. Handling Rules

- `.claude/skills/implementation-orchestration/SKILL.md` の全規則に従う(分離 / ループ上限5 / 在席ポーリング / 閉域 / モデル明示)
- レビューは単一 Review-Sylph。観点: 調査レポート §4 方針・本計画との突合、remap 式のアトラス側(`texture-atlas-packing.ts:544-587`)との同型性確認、非クランプ保存、テスト再実行、スコープ逸脱なし
- 必須文言: 「Orch-Sylph自身は実装担当ではない。source implementation は必ず別コンテキストの Gnome に委譲し、レビューは必ず別コンテキストの Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。」
