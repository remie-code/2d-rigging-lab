# Editor と Host が使う参照画像の契約

Wave 1 の独立レビュー済み。ユーザー操作の受領条件は [2 Wave計画 §2](../../orchestration/reference-image-overlay-wave-plan.md#2-accepted-user-gate) にある。

## 配置と基準点

- `transform.origin` はモデル座標で画像左上。`transform.pivot` は画像のピクセル座標。倍率 `scale` は縦横共通。モデル座標の Y は下向きなので、正の `rotationDegrees` は時計回り。
- 画像上の座標 `p` は `origin + scale × R(rotationDegrees) × p` でモデル座標へ写る。基準点の置き直しでは `pivot` だけを更新する。拡縮または回転時は、更新前の基準点のモデル座標を求め、更新後も同じ座標へ写るよう `origin` を計算する。
- Host は同じモデル座標へ `stageViewport` と出力寸法の変換を適用する。Editor は Canvas のモデル座標から pan/zoom を適用する。UI のドラッグ入力は Canvas からモデル座標へ逆変換し、基準点の入力はさらに画像座標へ逆変換する。
- 画像の四辺を含む範囲で基準点を指定する。`referenceImagePointToModel` と `modelPointToReferenceImage` は相互に逆変換する。`updateReferenceImageState` は基準点を設定し、その位置を中心に絶対倍率・絶対回転角を適用してから、モデル座標の `translation` を加える。回転角の保存範囲は `[-180°, 180°)`。

## 状態と表示

- `image` は `sha256`、`width`、`height`、`byteLength` で画像を識別する。表示状態は `displayMode` と `opacity`。モデルのみでも設定値を保持する。
- workspace の `authoring/reference-image.json` は `reference-image-workspace-v1` の JSON。`reference` が状態を持つか `null` で除去を表す。画像の元 PNG は `authoring/reference-images/<sha256>.png`。参照が未登録の旧 workspace に JSON は存在しない。
- Host の `renderView` では `referenceMode` を省略すると保存状態を使用する。参照がなければモデルを表示する。明示的なモデル単独描画では参照の破損や欠落に影響されない。

## Host API

- `referenceImage` の `get` は `read`、`register`・`update`・`remove` は `editReference` capability を使う。`register` は `imagePath` と任意の `settings`、`update` は `settings` を受け取る。差替えは `register` で新規の初期状態から始める。操作は workspace の参照状態へ直接保存される。
- `renderView` は `render` capability を使う。出力 sidecar に描画した `referenceMode` と参照を描画した場合の `referenceImage` を記録する。保存状態を変えずにモードを明示できる。明示的な `reference` と `overlay` は登録済み PNG を必要とする。
- CLI の起動方法とリクエスト例は [Host 利用手順](../../../../apps/authoring-host/reference-image.md) を参照。Host は同じ workspace の Host コマンドを既存の package lock で直列化する。

## Editor の接続点

- `@private-2d-rigging-lab/contracts` が `ReferenceImageState`、`ReferenceImageTransform`、`ReferenceImageUpdate` と対応スキーマを公開する。PNG の上限は各辺 8,192 px、総画素 16,777,216、バイト数 64 MiB。
- `@private-2d-rigging-lab/authoring-core` の `readReferencePngDimensions` で登録前に静止 PNG の形式・寸法を調べ、Editor の画像デコーダで読み込みを確認する。`describeReferenceImageBytes` は寸法と元バイト列から画像識別情報を作る。`createReferenceImageState` と `updateReferenceImageState` で登録直後の配置を指定できる。
- `REFERENCE_IMAGE_STATE_PATH`、`referenceImageBinaryPath`、`parseWorkspaceReferenceImage`、`serializeWorkspaceReferenceImage`、`verifyWorkspaceReferenceImageBytes` を使って workspace の状態とバイト列を読み書きする。新規 PNG の書き込みが完了してから JSON を書き換える。
- Host の更新はコマンドごとに即時保存する。Editor で未保存の参照・モデルを保持する間の表示、Undo/Redo、`Save Workspace` による確定は Wave 2 の接続範囲。通常の Host CLI から参照できる状態は、対象 workspace へ書き込み済みの値。
