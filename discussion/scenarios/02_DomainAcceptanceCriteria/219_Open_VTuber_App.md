# シナリオ: Open VTuber App

> 参照元AC: [219_Open_VTuber_App.md](../../acceptance-criteria/02_DomainAcceptanceCriteria/219_Open_VTuber_App.md)
> 状態: 新規Open Stackドメイン シナリオドラフト

## 0. このドラフトの目的

このファイルは、`AC-VTUBER` を Open Model Format を前提にした配信利用アプリのシナリオへ降ろす。

VTube Studio 完全互換は初期成功条件にしない。Open VTuber App の正は、Open Model Package を読み込み、tracking input を parameter に mapping し、配信向け表示と外部制御を Open Live2D Stack のAPIとして成立させることである。

## 1. リポジトリ事実

- 参照元ACは、配信用model読み込み、tracking input mapping、smoothing/calibration、expression hotkey/model placement、外部APIとAI設定補助を要求している。
- `discussion/concept/modified_concept.md` は、Open VTuber App を Open Model Format 前提の配信アプリとして定義している。
- MotionSync / LipSync は当面スコープ外であり、音声解析による口形状推定はこのシナリオでは扱わない。

## 2. 設計判断

- tracking input は、実カメラ入力だけでなく、検証可能な記録済みtracking frameでも再現できる必要がある。
- 配信向け表示は、Open Runtime の評価結果と Viewer/Validator の diagnostics を共有できる必要がある。
- 外部APIとAI設定補助は、配信操作を構造化して観測・修復できることを重視する。

## 3. シナリオ記述方針

- Given: Open Model Package、tracking source、mapping、配信表示状態を書く。
- When: model load、tracking適用、calibration、hotkey、placement、外部API操作を書く。
- Then: parameter更新、表示、配信向け出力、設定report、AI-readable diagnostics を観測可能に書く。

## SC-VTUBER-001: Open Model Package を配信用モデルとして読み込める

### Given: 前提条件

- `VTuberAvatar_A.openpackage` は Open Package Validator で Pass している。
- package には、顔向き、目、口、表情に使う parameter が含まれる。
- Open VTuber App は Open Runtime と配信用stageを初期化できる。

### When: Open Stack実用操作

1. ユーザーが Open VTuber App で `VTuberAvatar_A.openpackage` を選択する。
2. アプリが Runtime を初期化し、配信用stageにモデルを表示する。
3. ユーザーが model metadata と load diagnostics を確認する。

### Then: Open Stack期待結果

- モデルは配信用stage上に表示される。
- アプリは package ID、format version、model name、使用可能parameter、expression一覧を表示できる。
- load diagnostics は、Open Viewer/Validator と対応する schema、参照、runtime初期化結果を含む。
- `.moc3` や VTube Studio向け設定が存在しなくても、Open Model Package として表示できる。

### 検証するACの項目

- AC-VTUBER-001: Open Model Package を配信用モデルとして読み込めること

## SC-VTUBER-002: tracking input を model parameter へ mapping できる

### Given: 前提条件

- `VTuberAvatar_A` には `ParamAngleX`, `ParamAngleY`, `ParamEyeLOpen`, `ParamEyeROpen`, `ParamMouthOpenY` がある。
- 記録済みtracking frame `TrackingFace_TurnLeft_Smile` は、顔向き、目開き、口開きの値を含む。
- mapping table には、tracking field と model parameter の対応が定義されている。

### When: Open Stack実用操作

1. ユーザーが tracking source として記録済みtracking frameを選択する。
2. ユーザーが `faceYaw -> ParamAngleX`, `leftEyeOpen -> ParamEyeLOpen`, `mouthOpen -> ParamMouthOpenY` を mapping する。
3. アプリが tracking frame を1秒分再生する。
4. ユーザーが parameter timeline と runtime state を確認する。

### Then: Open Stack期待結果

- tracking input は mapping table に従って model parameter へ変換される。
- parameter timeline には、tracking field、変換後parameter、変換式、clamp結果が記録される。
- Runtime表示は tracking frame の顔向き、目、口の変化に応じて変化する。
- 未対応tracking field は無視またはNeeds reviewとして報告され、暗黙に別parameterへ流れない。

### 検証するACの項目

- AC-VTUBER-002: tracking input を parameter へ mapping できること
- AC-VTUBER-005: 外部APIとAI設定補助を提供できること

## SC-VTUBER-003: smoothing と calibration を扱える

### Given: 前提条件

- `VTuberAvatar_A` は配信用stageに読み込み済みである。
- tracking input には、neutral pose と顔向きが急変する frame列が含まれる。
- アプリは smoothing係数、基準姿勢、感度、範囲補正を設定できる。

### When: Open Stack実用操作

1. ユーザーが現在のtracking frameを neutral pose として calibration する。
2. ユーザーが `ParamAngleX` の感度を `1.2` に設定する。
3. ユーザーが smoothing を off と on で切り替え、同じtracking frame列を再生する。
4. ユーザーが補正前後の parameter timeline を比較する。

### Then: Open Stack期待結果

- calibration 後は、neutral pose の tracking値が model parameter の基準値へ対応する。
- 感度設定は、変換後parameter値に反映される。
- smoothing on の状態では、急変する入力に対して parameter変化が連続的になる。
- timeline report には、raw tracking値、calibrated値、smoothed値、clamp結果、適用設定IDが含まれる。

### 検証するACの項目

- AC-VTUBER-003: smoothing と calibration を扱えること
- AC-VTUBER-002: tracking input を parameter へ mapping できること

## SC-VTUBER-004: expression hotkey と model placement を配信向けに扱える

### Given: 前提条件

- `VTuberAvatar_A` には expression `Smile`, `Surprised` が含まれる。
- アプリは hotkey、model position、scale、rotation、background transparency を設定できる。
- 配信用stageは透過背景をサポートできる。

### When: Open Stack実用操作

1. ユーザーが `Smile` を hotkey `Ctrl+1` に割り当てる。
2. ユーザーが model position を右下、scale を `0.8`、rotation を `-5deg` に設定する。
3. ユーザーが background transparency を有効にする。
4. ユーザーが hotkey を押して expression を切り替える。

### Then: Open Stack期待結果

- hotkey入力により `Smile` expression が適用され、runtime state に適用中expression IDが記録される。
- model placement は stage上の表示位置、scale、rotationとして反映される。
- 透過背景は配信向け出力の設定として確認でき、背景色とalpha状態を区別できる。
- hotkey、placement、transparency設定は profile として保存・再読み込みできる。

### 検証するACの項目

- AC-VTUBER-004: expression hotkey と model placement を扱えること
- AC-VTUBER-001: Open Model Package を配信用モデルとして読み込めること

## SC-VTUBER-005: 外部APIとAI設定補助で配信設定を検証できる

### Given: 前提条件

- `VTuberAvatar_A` は読み込み済みで、tracking mapping は一部未設定である。
- Open External API は、parameter state、tracking mapping、expression、placement を取得・設定できる。
- AIエージェントは validation report と runtime state を取得できる。

### When: Open Stack実用操作

1. AIエージェントが現在の配信設定を取得する。
2. AIエージェントが未設定tracking field と未使用parameterを検出する。
3. AIエージェントが mapping候補と calibration手順を提示する。
4. ユーザーが候補を適用し、アプリが設定validationを再実行する。

### Then: Open Stack期待結果

- 外部APIは、model ID、parameter一覧、tracking mapping、hotkey、placement、diagnostics を構造化して返す。
- AIエージェントの提案は、対象tracking field、対象parameter、変換式、理由、想定影響を含む。
- 適用後の validation report は、未設定項目の解消、残ったNeeds review、runtime表示への影響を示す。
- 外部APIは VTube Studio 互換プロトコルを前提にせず、Open Live2D Stack のAPI境界として検証される。

### 検証するACの項目

- AC-VTUBER-005: 外部APIとAI設定補助を提供できること
- AC-VTUBER-002: tracking input を parameter へ mapping できること

## 4. 未決事項

- 初期tracking providerをwebcam実装にするか、記録済みtracking frameを先に標準化するか。
- OBS向け出力の具体方式。
- VTube Studio等との将来連携を plugin として扱うか、移行支援として扱うか。
- physics strength と idle motion の最小UI。
