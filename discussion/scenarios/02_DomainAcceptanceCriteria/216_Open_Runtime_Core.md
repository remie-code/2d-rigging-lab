# シナリオ: Open Runtime / Core

> 参照元AC: [216_Open_Runtime_Core.md](../../acceptance-criteria/02_DomainAcceptanceCriteria/216_Open_Runtime_Core.md)
> 状態: 新規Open Stackドメイン シナリオドラフト

## 0. このドラフトの目的

このファイルは、`AC-RUNTIME` を Open Model Package を読み込み、parameter に応じて評価し、描画可能な状態と構造化 runtime state を返すシナリオへ降ろす。

Cubism Core 互換や `.moc3` 読み込みは初期成功条件にしない。Open Runtime の正は、Open Model Format、Open Viewer、Open Package Validator と整合する runtime evaluation である。

## 1. リポジトリ事実

- 参照元ACは、package読み込み、parameter state、vertex/drawable評価、描画統合、runtime state観測を要求している。
- `discussion/concept/modified_concept.md` は、Runtime が Open Model Format を読み込み、parameter値に応じて描画結果を生成できることを新コンセプトに含めている。
- 初期段階では Web / TypeScript SDK とブラウザベースの確認が優先される。

## 2. 設計判断

- Runtime は renderer そのものだけでなく、評価済み drawable state と diagnostics を構造化して返す。
- MotionSync / LipSync 由来の音声入力はこのシナリオでは扱わない。
- runtime evaluation は Open Viewer と Validator から同じ観測結果として検証できる必要がある。

## 3. シナリオ記述方針

- Given: Open Model Package、runtime環境、入力parameter、検証用モデルを書く。
- When: load、parameter更新、評価、render integration、inspection の操作を書く。
- Then: 初期化済みstate、評価済みvertex/drawable、draw command、diagnostics を観測可能に書く。

## SC-RUNTIME-001: Open Model Package を読み込み runtime state を初期化できる

### Given: 前提条件

- `MinimalAvatar_A.openpackage` は Open Package Validator で schema と参照解決が Pass している。
- package には、1つ以上の texture、drawable、mesh、parameter、keyform が含まれる。
- Open Runtime は package loader と runtime state inspection を提供している。

### When: Open Stack実用操作

1. アプリが Open Runtime に `MinimalAvatar_A.openpackage` の読み込みを要求する。
2. Runtime が model body、texture参照、mesh、parameter定義を読み込む。
3. アプリが初期 runtime state を取得する。

### Then: Open Stack期待結果

- Runtime は package ID、format version、runtime instance ID を返す。
- parameter は定義された初期値、最小値、最大値で初期化される。
- drawable は texture参照、mesh、初期visibility、opacity、draw order を持つ runtime state として観測できる。
- 読み込み時の warning/error は diagnostics として取得でき、Open Viewer と Validator が同じIDで参照できる。

### 検証するACの項目

- AC-RUNTIME-001: Open Model Format を読み込めること
- AC-RUNTIME-005: runtime state を観測できること

## SC-RUNTIME-002: parameter state を複数入力源から更新できる

### Given: 前提条件

- `RiggedAvatar_A` には `ParamAngleX`, `ParamEyeLOpen`, `ParamMouthOpenY` が定義されている。
- Runtime は外部入力、expression、motion、physics 由来の parameter更新を区別できる。
- `ParamEyeLOpen` の範囲は `0.0` から `1.0` である。

### When: Open Stack実用操作

1. アプリが外部入力として `ParamAngleX = 0.5` を設定する。
2. アプリが expression `Smile` を適用し、`ParamEyeLOpen` に補正を加える。
3. アプリが `ParamEyeLOpen = -0.2` を外部入力として送る。
4. アプリが parameter state と update diagnostics を取得する。

### Then: Open Stack期待結果

- `ParamAngleX` は外部入力由来の値として保持される。
- `ParamEyeLOpen = -0.2` は定義範囲外として検出され、clampまたはrejectの結果が diagnostics に記録される。
- expression、motion、physics、外部入力の適用順または合成規則を runtime state から確認できる。
- 更新通知には、変更された parameter ID、変更前後の値、入力源、範囲補正の有無が含まれる。

### 検証するACの項目

- AC-RUNTIME-002: parameter state を保持・更新できること
- AC-RUNTIME-005: runtime state を観測できること

## SC-RUNTIME-003: parameter に応じて vertex と drawable state を評価できる

### Given: 前提条件

- `RiggedAvatar_A` には、`ParamAngleX` に紐付く頭部drawableと deformer相当構造が存在する。
- `ParamAngleX = -1`, `0`, `1` の keyform が定義されている。
- `ParamEyeLOpen` によって左目drawableの opacity または vertex が変化する。

### When: Open Stack実用操作

1. アプリが `ParamAngleX = 0` で evaluation を実行する。
2. アプリが `ParamAngleX = 1` に更新して evaluation を再実行する。
3. アプリが `ParamEyeLOpen = 0` に更新して evaluation を再実行する。
4. アプリが評価済み drawable state を取得する。

### Then: Open Stack期待結果

- `ParamAngleX = 0` と `ParamAngleX = 1` では、対象drawableの評価済みvertex座標が異なる。
- `ParamEyeLOpen = 0` では、左目の閉眼に関係する drawable state が keyform に従って変化する。
- 評価結果には、入力parameter、参照keyform、対象deformer相当構造、評価済みvertex、visibility、opacity、draw order、mask状態が含まれる。
- 評価不能な参照がある場合、Runtime は描画クラッシュではなく diagnostics として対象IDを返す。

### 検証するACの項目

- AC-RUNTIME-003: parameter に応じた vertex / drawable 状態を評価できること
- AC-RUNTIME-005: runtime state を観測できること

## SC-RUNTIME-004: WebGL等の描画基盤へ描画情報を提供できる

### Given: 前提条件

- `RiggedAvatar_A` の texture は読み込み済みである。
- 複数drawableに draw order と clipping / mask の指定がある。
- アプリ側には WebGL canvas または同等の描画ターゲットがある。

### When: Open Stack実用操作

1. アプリが Runtime に1フレーム分の evaluation を要求する。
2. アプリが Runtime から描画コマンドまたは描画用drawable配列を取得する。
3. アプリが取得した情報を WebGL renderer に渡す。
4. アプリが描画後の frame diagnostics を取得する。

### Then: Open Stack期待結果

- 描画情報は draw order 順に並び、各drawableに texture、uv、triangle index、評価済みvertex、opacity、blend情報が含まれる。
- clipping / mask が指定された drawable は、mask生成またはmask参照に必要な情報を持つ。
- renderer は Open Model Package の texture と mesh を使って非空のモデル表示を生成できる。
- frame diagnostics は、描画対象数、skipされたdrawable、texture未準備、mask未解決などを構造化して返す。

### 検証するACの項目

- AC-RUNTIME-004: 描画統合できること
- AC-RUNTIME-003: parameter に応じた vertex / drawable 状態を評価できること

## SC-RUNTIME-005: runtime state と評価診断を AIエージェントが取得できる

### Given: 前提条件

- `RiggedAvatar_A` は Runtime に読み込まれている。
- `ParamAngleX = 1` で一部の髪drawableが mask 範囲外に出る検証状態を作れる。
- AI Agent Interface または SDK inspection API が runtime state を取得できる。

### When: Open Stack実用操作

1. AIエージェントが現在の runtime state snapshot を要求する。
2. AIエージェントが parameter、drawable、mesh、mask、diagnostics の詳細を取得する。
3. AIエージェントが `ParamAngleX = 0` と `ParamAngleX = 1` の runtime diff を要求する。

### Then: Open Stack期待結果

- snapshot には、parameter state、評価済みdrawable state、texture state、mask state、警告/エラーが含まれる。
- runtime diff には、変化した parameter、vertex、visibility、opacity、draw order、diagnostics が含まれる。
- mask 範囲外などの問題は、対象drawable ID、原因、影響、修復候補を生成できる粒度で報告される。
- AIエージェントは runtime state を自然文スクリーンショットに依存せず構造化データとして検証できる。

### 検証するACの項目

- AC-RUNTIME-005: runtime state を観測できること
- AC-RUNTIME-003: parameter に応じた vertex / drawable 状態を評価できること

## 4. 未決事項

- parameter 合成順序と override 規則。
- 評価済みvertexの数値許容誤差。
- Runtime と renderer の責務境界。
- mask/clipping の最小実装方式。
