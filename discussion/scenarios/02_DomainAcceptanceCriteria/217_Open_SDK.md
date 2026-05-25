# シナリオ: Open SDK

> 参照元AC: [217_Open_SDK.md](../../acceptance-criteria/02_DomainAcceptanceCriteria/217_Open_SDK.md)
> 状態: 新規Open Stackドメイン シナリオドラフト

## 0. このドラフトの目的

このファイルは、`AC-SDK` を外部アプリが Open Runtime を組み込み、Open Model Package を読み込み、parameter操作、描画統合、inspection を行うシナリオへ降ろす。

初期段階では Web / TypeScript SDK を優先する。Native SDK、Unity/Unreal plugin は将来拡張候補であり、このシナリオの初期成功条件ではない。

## 1. リポジトリ事実

- 参照元ACは、Web / TypeScript SDK、model loading API、parameter control API、rendering integration API、validation / inspection API を要求している。
- `discussion/concept/modified_concept.md` は、SDK を外部アプリから Open Runtime を利用するための作成対象として位置付けている。
- 初期段階では、ブラウザベースの検証、UI作成、AIエージェント操作との相性を理由に Web / TypeScript が優先される。

## 2. 設計判断

- SDK は Runtime の内部実装を隠すだけでなく、検証・レビューに必要な state と diagnostics へ到達できるAPIを持つ。
- SDK は Cubism SDK の互換APIを成功条件にしない。
- SDK のサンプルは、Open Source 公開可能な Open Sample Model Set を使う。

## 3. シナリオ記述方針

- Given: TypeScriptアプリ、Open Model Package、Runtime、canvas、inspection要求を書く。
- When: import、load、parameter操作、render loop統合、inspection取得を書く。
- Then: 型、戻り値、エラー、diagnostics、描画結果、購読通知を検証可能に書く。

## SC-SDK-001: Web / TypeScript アプリから SDK を導入して Runtime を初期化できる

### Given: 前提条件

- TypeScript のサンプルアプリ `open-live2d-web-sample` が存在する。
- SDK package は TypeScript 型定義を提供している。
- サンプルアプリは Open Source 公開可能な `MinimalAvatar_A.openpackage` を参照する。

### When: Open Stack実用操作

1. 開発者が SDK を TypeScript アプリに import する。
2. 開発者が Runtime instance を作成する。
3. 開発者が SDK の公開型を使って model loading と canvas binding のコードを書く。
4. 開発者が typecheck を実行する。

### Then: Open Stack期待結果

- SDK は Web / TypeScript から import できる公開APIを持つ。
- Runtime instance 作成、設定、破棄に必要な型が提供される。
- サンプルコードは proprietary SDK/Core を必須依存にせず typecheck できる。
- API documentation または型情報から、初期化に必要な引数、戻り値、失敗時のエラー型を確認できる。

### 検証するACの項目

- AC-SDK-001: Web / TypeScript SDK を優先して提供できること
- AC-SDK-002: model loading API を提供できること

## SC-SDK-002: model loading API で package lifecycle を扱える

### Given: 前提条件

- `MinimalAvatar_A.openpackage` は Validator で Pass している。
- `BrokenAvatar_MissingTexture.openpackage` は texture参照欠落を含む検証用packageである。
- SDK は load、unload、dispose、getLastError または同等のエラー取得APIを提供する。

### When: Open Stack実用操作

1. アプリが `MinimalAvatar_A.openpackage` を SDK 経由で読み込む。
2. アプリが読み込み済み model handle から package metadata と parameter一覧を取得する。
3. アプリが model を unload する。
4. アプリが `BrokenAvatar_MissingTexture.openpackage` の読み込みを試みる。

### Then: Open Stack期待結果

- 正常packageでは、model handle、runtime instance ID、metadata、初期diagnosticsを取得できる。
- unload 後は、model handle を使った parameter操作が明示的なエラーとして扱われる。
- 欠落textureのpackageでは、失敗した参照path、参照元drawable、エラー種別をSDKから取得できる。
- 読み込み失敗はアプリの描画ループを破壊せず、再試行または別package読み込みへ移行できる。

### 検証するACの項目

- AC-SDK-002: model loading API を提供できること
- AC-SDK-005: validation / inspection API を提供できること

## SC-SDK-003: parameter control API で値取得・設定・購読ができる

### Given: 前提条件

- `RiggedAvatar_A` には `ParamAngleX` と `ParamMouthOpenY` が定義されている。
- `ParamAngleX` の範囲は `-1.0` から `1.0` である。
- SDK は parameter一覧、値取得、値設定、範囲確認、変更購読を提供する。

### When: Open Stack実用操作

1. アプリが parameter一覧を取得する。
2. アプリが `ParamAngleX` の現在値と範囲を取得する。
3. アプリが `ParamAngleX = 0.75` を設定する。
4. アプリが `ParamAngleX = 2.0` を設定しようとする。
5. アプリが parameter change event を購読する。

### Then: Open Stack期待結果

- parameter一覧には、ID、表示名、初期値、現在値、最小値、最大値、単位または用途metadataが含まれる。
- `ParamAngleX = 0.75` は Runtime state に反映され、購読者へ変更通知が送られる。
- `ParamAngleX = 2.0` は範囲外として reject または clamp され、その規則と結果が返る。
- 変更通知には、parameter ID、変更前後の値、入力源、適用frameが含まれる。

### 検証するACの項目

- AC-SDK-003: parameter control API を提供できること
- AC-SDK-005: validation / inspection API を提供できること

## SC-SDK-004: アプリ側の描画ループへ Runtime を統合できる

### Given: 前提条件

- TypeScript サンプルアプリには WebGL canvas がある。
- `RiggedAvatar_A` は SDK 経由で読み込み済みである。
- SDK は frame update、evaluate、render もしくは描画コマンド取得APIを提供する。

### When: Open Stack実用操作

1. アプリが `requestAnimationFrame` のループを開始する。
2. 各frameで SDK の update/evaluate/render を呼ぶ。
3. アプリが canvas resize を発生させる。
4. アプリが描画後 diagnostics を取得する。

### Then: Open Stack期待結果

- モデルは canvas 上に表示され、frame更新ごとに Runtime の評価結果が反映される。
- canvas resize 後も表示位置、scale、描画領域が更新される。
- SDK は rendererを内包する場合でも、アプリ側rendererへ描画コマンドを渡す場合でも、責務境界をAPI上で説明できる。
- diagnostics には frame time、描画drawable数、skip理由、texture準備状態が含まれる。

### 検証するACの項目

- AC-SDK-004: rendering integration API を提供できること
- AC-SDK-005: validation / inspection API を提供できること

## SC-SDK-005: validation / inspection API でレビュー可能な state を取得できる

### Given: 前提条件

- `RiggedAvatar_A` は SDK 経由で読み込み済みである。
- アプリは Viewer ではなく独自UIで model inspection を表示する。
- SDK は runtime state、drawable、parameter、diagnostics、validation report を取得できる。

### When: Open Stack実用操作

1. アプリが model structure snapshot を取得する。
2. アプリが `ParamAngleX = -1`, `0`, `1` の各状態で runtime diff を取得する。
3. アプリが validation report を JSON として保存する。

### Then: Open Stack期待結果

- snapshot には、package metadata、drawable一覧、mesh概要、parameter一覧、texture参照、diagnosticsが含まれる。
- runtime diff は、parameter差分、評価済みvertex差分、visibility/opacity差分を構造化して返す。
- validation report は Open Package Validator と同じ結果IDまたは互換可能な項目名で保存できる。
- AIエージェントは SDK 経由でも Viewer と同等のレビュー材料を取得できる。

### 検証するACの項目

- AC-SDK-005: validation / inspection API を提供できること
- AC-SDK-003: parameter control API を提供できること

## 4. 未決事項

- SDK package名、module形式、対応ブラウザ範囲。
- Runtime内蔵rendererをSDK標準にするか、renderer統合APIを主にするか。
- Native / Game Engine SDK の着手時期。
- SDK diagnostics と Validator report の共通schema。
