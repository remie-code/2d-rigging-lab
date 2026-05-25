# シナリオ: Open External API

> 参照元AC: [221_Open_External_API.md](../../acceptance-criteria/02_DomainAcceptanceCriteria/221_Open_External_API.md)
> 状態: 新規Open Stackドメイン シナリオドラフト

## 0. このドラフトの目的

このファイルは、`AC-API` を外部アプリやAIエージェントが Open Live2D Stack を操作・観測するためのAPIシナリオへ降ろす。

Open External API は、VTube Studio等の既存外部API完全互換を初期成功条件にしない。正は、Open Editor / Viewer / VTuber App / Runtime を構造化APIで操作できることである。

## 1. リポジトリ事実

- 参照元ACは、parameter送受信、model state取得、expression/motion操作、automation API、WebSocket / HTTP / plugin境界を要求している。
- `discussion/concept/modified_concept.md` は、External API を AI-native operation layer の基盤として位置付けている。
- Open AI Agent Interface は External API の上位または隣接する利用者になる。

## 2. 設計判断

- APIは、UIクリックの再現ではなく、Open Stack の概念を直接操作する構造化境界として扱う。
- 通信方式は未決だが、シナリオでは WebSocket / HTTP / plugin の責務境界と認可を検証対象にする。
- MotionSync / LipSync と Video Editor 操作は当面スコープ外とする。

## 3. シナリオ記述方針

- Given: 実行中アプリ、API client、model、認可状態を書く。
- When: parameter取得/設定/購読、state取得、操作、自動化、plugin呼び出しを書く。
- Then: API response、event、diagnostics、権限境界、version互換性を観測可能に書く。

## SC-API-001: parameter の取得・設定・購読ができる

### Given: 前提条件

- Open Viewer または Open VTuber App が `RiggedAvatar_A` を読み込み済みである。
- External API server は有効で、client は有効なsession tokenを持つ。
- `ParamAngleX` の範囲は `-1.0` から `1.0` である。

### When: Open Stack実用操作

1. client が parameter一覧取得APIを呼ぶ。
2. client が `ParamAngleX` の現在値を取得する。
3. client が `ParamAngleX = 0.5` を設定する。
4. client が parameter change event を購読する。
5. client が `ParamAngleX = 2.0` を設定しようとする。

### Then: Open Stack期待結果

- parameter一覧には、ID、名前、現在値、初期値、最小値、最大値、用途metadataが含まれる。
- `ParamAngleX = 0.5` は Runtime state に反映され、購読clientへeventが送られる。
- 範囲外入力は reject または clamp され、その規則、結果、diagnostics がAPI responseに含まれる。
- 認可されていないclientはparameter設定に失敗し、失敗理由が構造化エラーとして返る。

### 検証するACの項目

- AC-API-001: parameter 送受信 API を提供できること
- AC-API-005: WebSocket / HTTP / plugin 境界を定義できること

## SC-API-002: model structure、runtime state、validation result を取得できる

### Given: 前提条件

- Open Viewer は `RiggedAvatar_A` を読み込み済みである。
- Viewer 上で Validator が実行され、validation result が保存されている。
- API client は read権限を持つ。

### When: Open Stack実用操作

1. client が model structure API を呼ぶ。
2. client が runtime state snapshot API を呼ぶ。
3. client が validation result API を呼ぶ。
4. client が diagnostics の対象IDから Viewer内の対象drawableを参照する。

### Then: Open Stack期待結果

- model structure response には、part、drawable、mesh、parameter、expression、motion、physics、metadata の概要が含まれる。
- runtime state response には、現在parameter、評価済みdrawable state、mask state、diagnostics が含まれる。
- validation result response には、check ID、status、対象ID、根拠、修復候補が含まれる。
- 各responseの対象IDは、Viewer、Validator、AI Agent Interface で同じ対象を指す。

### 検証するACの項目

- AC-API-002: model state 取得 API を提供できること
- AC-API-001: parameter 送受信 API を提供できること

## SC-API-003: expression / motion / physics / placement を外部から操作できる

### Given: 前提条件

- Open VTuber App は `VTuberAvatar_A` を読み込み済みである。
- model には expression `Smile`、motion `IdleBlink`、physics `HairSway` がある。
- API client は operation権限を持つ。

### When: Open Stack実用操作

1. client が expression `Smile` の適用APIを呼ぶ。
2. client が motion `IdleBlink` の再生APIを呼ぶ。
3. client が physics `HairSway` の有効/無効を切り替える。
4. client が model placement を `{ x: 120, y: -80, scale: 0.8, rotation: -5 }` に設定する。

### Then: Open Stack期待結果

- expression、motion、physics、placement の各操作は operation ID と結果statusを返す。
- Runtime state には適用中expression、再生中motion、physics有効状態、placementが反映される。
- 存在しない expression ID を指定した場合、対象IDと利用可能候補を含むエラーが返る。
- 操作履歴はAIエージェントが後でdiff/provenanceへ利用できる形で保持される。

### 検証するACの項目

- AC-API-003: expression / motion 操作 API を提供できること
- AC-API-002: model state 取得 API を提供できること

## SC-API-004: Editor / Viewer / VTuber App の操作を自動化できる

### Given: 前提条件

- Open Viewer と Open VTuber App が External API automation endpoint を公開している。
- API client は automation権限を持つ。
- `RiggedAvatar_A.openpackage` は利用可能である。

### When: Open Stack実用操作

1. client が Viewer に package読み込み操作を送る。
2. client が Viewer に `ParamAngleX = -1, 0, 1` のsnapshot取得操作を送る。
3. client が VTuber App に tracking mapping設定操作を送る。
4. client が各操作の結果と生成されたreportを取得する。

### Then: Open Stack期待結果

- automation command は、対象アプリ、操作名、引数、期待する戻り値、権限を構造化して持つ。
- 各操作は operation ID、status、生成物ID、diagnostics を返す。
- Viewer snapshot と VTuber mapping report は、後続レビューで参照できる保存済みartifactとして扱える。
- UI表示位置やボタン名に依存せず、Open Stack の概念操作として再実行できる。

### 検証するACの項目

- AC-API-004: automation API を提供できること
- AC-API-002: model state 取得 API を提供できること

## SC-API-005: WebSocket / HTTP / plugin の境界と互換性を定義できる

### Given: 前提条件

- External API は、HTTP request、WebSocket event、plugin extension の候補を持つ。
- API version `0.1` のclientと、API version `0.2` のserverが存在する。
- 未認可plugin `UnknownPlugin_A` が接続を試みる。

### When: Open Stack実用操作

1. client が HTTP で現在stateを取得する。
2. client が WebSocket で parameter event を購読する。
3. `UnknownPlugin_A` が operation権限を要求する。
4. version `0.1` client が version `0.2` server に接続する。

### Then: Open Stack期待結果

- HTTP は snapshot取得や短い操作、WebSocket は継続event購読、plugin は拡張操作境界として責務が説明される。
- 未認可pluginは operation を実行できず、必要権限、拒否理由、監査ログIDを返す。
- version差がある場合、server は対応version、非推奨API、互換可能/不可能な機能を返す。
- API境界は Open Stack の仕様として定義され、既存外部APIとの完全互換を前提にしない。

### 検証するACの項目

- AC-API-005: WebSocket / HTTP / plugin 境界を定義できること
- AC-API-004: automation API を提供できること

## 4. 未決事項

- 初期通信方式を HTTP優先にするか WebSocket優先にするか。
- API認可とローカル接続のセキュリティ境界。
- plugin API の署名、配布、sandbox方針。
- External API と AI Agent Interface の境界。
