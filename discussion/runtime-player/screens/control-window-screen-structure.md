# Control Window Screen Structure

> Runtime Player Control Windowを、1枚の縦積み設定画面ではなく、責務別の小さな管理アプリとして扱うための画面構成。
> Wave6実装事実: Runtime Playerは `Header + Overview / Input / Mapping` のみを実体ページとして公開する。Wave6はこの構成内にInput head position calibrationとMapping Body groupを追加した。`Model` / `Stage` / 専用 `Diagnostics` ページはまだ公開しない。

## 1. Position

Runtime Playerは、Stage WindowをCleanな配信対象として保ち、Control Windowでロード、入力接続、キャリブレーション、mapping、stage操作、diagnosticsを扱う。

機能が増えた現在、Control Windowにすべてのカードを縦に積むと次の問題が出る。

- Live中によく押す操作が埋もれる。
- Input setupとmodel mappingとdebug情報が同じ重さで見えてしまう。
- Runtime Export未ロードでも可能な操作と、モデルロード後にだけ意味を持つ操作が混ざる。
- Diagnosticsが通常UXを圧迫する。

そのため、現在のControl Windowは次の構造にする。

```text
+--------------------------------------------------------------------------------+
| Runtime Player                  Model: loaded       Input: live       Live: on   |
| [Open Export] [Look Forward] [Focus Stage]                                      |
+----------------------+---------------------------------------------------------+
| Overview             |                                                         |
| Input                |  selected page content                                  |
| Mapping              |                                                         |
+----------------------+---------------------------------------------------------+
```

Stage Windowはこの構造に含めない。Stage Windowは常にmodel onlyである。

将来、Model / Stage / Diagnosticsを専用ページに分ける余地は残すが、現在は空のplaceholder pageを出さない。

## 2. Persistent Header

Headerは、どのページにいてもLive状態と頻出操作を見失わないために置く。

```text
+--------------------------------------------------------------------------------+
| Runtime Player                                                                  |
| Model: kipfel-black.runtime-export  Input: iFacialMocap / 59 fps  Live: Active  |
| [Open Export] [Look Forward] [Focus Stage]                              |
+--------------------------------------------------------------------------------+
```

表示するstatus:

- Model: `Not loaded` / model name / stale mapping。
- Input: `Disconnected` / `Listening` / `Receiving fps` / `Stale`。
- Live: `Unavailable` / `Ready` / `Active`。

Headerに置く操作:

- `Open Export`: Runtime Exportを開く、または切り替える。
- `Look Forward`: 現在の顔向きをsession neutralへ設定する。頻出操作なので深い画面へ沈めない。
- `Focus Stage`: Stage Windowを前面へ出す。

Future操作:

- `Hide Control`: 配信中にControl Windowを隠す。
- `Settings`: window/display設定が増えた時に扱う。

Headerに置かない操作:

- Raw diagnostics。
- Slotごとのmapping編集。
- Profileの詳細管理。
- Runtime parameter sliders。

## 3. Navigation

左navは責務単位で切る。

```text
+----------------------+
| Overview             |
| Input                |
| Mapping              |
+----------------------+
```

各ページの責務:

| Page | Responsibility |
|---|---|
| Overview | ライブ表示に必要な状態が揃っているか、次に何をすべきか |
| Input | iFacialMocap接続、transport、port、local IP、Input Profile |
| Mapping | Auto Mapping結果、semantic slot、strength/invert |

Calibrationは独立navにしない。Input Profileの作成・再調整としてInput page内から起動する guided sub-screen とする。

Future page候補:

| Page | Future responsibility |
|---|---|
| Model | Runtime Export load/change、model summary、artifact status |
| Stage | Stage Windowの表示、focus、view reset、透明/背景確認 |
| Diagnostics | raw / parsed / normalized / mapped values、copy diagnostics |

現在はDiagnosticsは専用navではなく、Control内のsecondary collapsible debug panelとして残す。

## 4. Overview Page

Overviewは、ユーザーが最初に見る通常画面である。

目的は「ライブ表示に必要なものが揃っているか」を一目で分かるようにすること。詳細設定は置かない。

```text
+--------------------------------------------------------------------------------+
| OVERVIEW                                                                       |
+--------------------------------------------------------------------------------+
| Runtime Export                                                                 |
|   Status: Loaded                         kipfel-black.runtime-export            |
|   [Open Different Export]                                                     |
|--------------------------------------------------------------------------------|
| Input Source                                                                   |
|   Status: Receiving 59 fps              iFacialMocap / UDP / 49983             |
|   [Disconnect]                                                                 |
|--------------------------------------------------------------------------------|
| Input Profile                                                                  |
|   Status: Ready                         Remie / desk                           |
|   [Look Forward] [Recalibrate]                                                |
|--------------------------------------------------------------------------------|
| Model Mapping                                                                  |
|   Status: Auto mapped 5 / 5             Live ready                             |
|   [Edit Mapping]                                                               |
|--------------------------------------------------------------------------------|
| Stage                                                                          |
|   Status: Transparent stage active                                             |
|   [Focus Stage] [Reset Stage View]                                             |
+--------------------------------------------------------------------------------+
```

状態別の主導線:

- Model未ロード: `Open Runtime Export`を強調する。
- Input未接続: `Connect Input`を強調する。
- Input Profileなし: `Start Calibration`を強調する。
- Mappingなし: `Auto Mapping`を強調する。
- すべて揃っている: `Live Active`を表示し、操作は最小にする。

Overviewに置かないもの:

- raw frame。
- blendshape一覧。
- slotごとの詳細slider。
- Runtime Export内部の詳細なtexture/mesh情報。

## 5. Input Page

Input pageは、入力ソースとInput Profileを扱う。

Runtime Export未ロードでもこのページは完全に使える。

```text
+--------------------------------------------------------------------------------+
| INPUT                                                                          |
+--------------------------------------------------------------------------------+
| Source                                                                         |
|   Source:        [ iFacialMocap v ]                                            |
|   Transport:     [ UDP v ]                                                     |
|   Receive port:  [ 49983        ]                                              |
|   Local IP:       192.168.11.14                                                |
|   iPhone IP:     [ optional      ]                                             |
|   Status:        Receiving 59 fps / last packet 11 ms                          |
|   [Connect] [Disconnect]                                                       |
|--------------------------------------------------------------------------------|
| Input Profile                                                                  |
|   Profile:       [ Remie / desk v ]                                            |
|   Range:         Calibrated                                                    |
|   Neutral:       Session neutral set 2 min ago                                 |
|   [Look Forward] [Recalibrate] [Record Range] [Profiles...]                    |
|--------------------------------------------------------------------------------|
| Setup Help                                                                     |
|   Send iFacialMocap UDP to 192.168.11.14:49983                                 |
+--------------------------------------------------------------------------------+
```

Input pageの原則:

- 接続できているかを最優先で見せる。
- `Look Forward`をここにも置く。Headerにも置いてよい。
- Input Profileはモデル非依存として扱う。
- `Recalibrate`はInput Profileの再調整なのでInput pageに置く。
- Runtime Exportの有無でInput操作をdisableしない。
- Wave6ではInput Profile sectionに `Head rotation`、`Eyes / mouth`、`Head position left/right` のready/missing状態を表示し、`Run Missing Only` と head-position-only `Calibrate` / `Recalibrate` を置く。

## 6. Input Calibration Sub-Screen

Input Profileがない場合、またはRecalibrate時に表示するguided sub-screen。

これはmodalでもdrawerでもよいが、Control Window内で完結する。Stageは不要。

```text
+--------------------------------------------------------------------------------+
| INPUT CALIBRATION                                           [Cancel]           |
+--------------------------------------------------------------------------------+
| Profile                                                                         |
|   Name: [ Remie / desk                         ]                               |
|--------------------------------------------------------------------------------|
| Step 1 / 3: Look forward                                                        |
|   Sit naturally and look at the camera.                                         |
|   [Set Look Forward]                                                            |
|--------------------------------------------------------------------------------|
| Step 2 / 3: Record range                                                        |
|   Follow each prompt. Move naturally, not to painful extremes.                  |
|                                                                                |
|   Current prompt: Turn your face left                                          |
|   [<] Head left      ok                                                         |
|   [>] Head right     needs more                                                 |
|   [^] Head up        waiting                                                    |
|   [v] Head down      waiting                                                    |
|   [/] Tilt left      waiting                                                    |
|   [\] Tilt right     waiting                                                    |
|   [.] Blink          waiting                                                    |
|   [o] Open mouth     waiting                                                    |
|                                                                                |
|   Recording: 00:05                                                             |
|   [Start Recording] [Stop]                                                     |
|--------------------------------------------------------------------------------|
| Step 3 / 3: Save                                                                |
|   Head range: ok    Eyes: ok    Mouth: ok                                      |
|   [Save Profile] [Use Temporary Defaults]                                      |
+--------------------------------------------------------------------------------+
```

No profile時:

- `Start Calibration`を主ボタンにする。
- `Use Temporary Defaults`は逃げ道として残す。

既存profileの再調整:

- 既存profileを即時上書きしない。
- 保存時に明示する。
- 将来は`Duplicate Profile`で別ユーザー/別姿勢を作れるようにする。

保存先:

```text
<electron userData>/
  input-profiles/
    ifacialmocap/
      profiles.json
```

保存するもの:

- Calibration range。
- Learned signs。
- Profile metadata。
- Active profile id。

保存しないもの:

- 毎回の`Look Forward`によるsession neutral offset。
- Model Mapping Profile。
- Runtime Export固有のparameter名。

### 6.1 Prompt Design

Calibration中の指示は、1つの長い説明文ではなく、短いpromptを順番に出す。

必要なprompt候補:

| Prompt | Captures | Notes |
|---|---|---|
| Look forward | neutral | `Look Forward`と同じsession neutralを取る |
| Turn face left | head rotation horizontal min/max | yaw方向の符号確認にも使う |
| Turn face right | head rotation horizontal min/max | yaw方向の符号確認にも使う |
| Look up | head rotation vertical min/max | pitch方向の符号確認にも使う |
| Look down | head rotation vertical min/max | pitch方向の符号確認にも使う |
| Tilt left | head roll min/max | `Face Angle Z`候補 |
| Tilt right | head roll min/max | `Face Angle Z`候補 |
| Eyes left | gaze horizontal min/max | eye Euler / `eyeLook*`比較に使う |
| Eyes right | gaze horizontal min/max | eye Euler / `eyeLook*`比較に使う |
| Eyes up | gaze vertical min/max | eye Euler / `eyeLook*`比較に使う |
| Eyes down | gaze vertical min/max | eye Euler / `eyeLook*`比較に使う |
| Blink | blink range | `Eye Left/Right Open`用 |
| Open mouth | mouth open range | `Mouth Open`用 |
| Smile | smile range | `Mouth Smile`用 |

Wave6 implemented prompts:

- Move head left / right for head position calibration.

Future prompts:

- Move closer / farther for future scale / depth behavior。

### 6.4 Wave6 Head Position Recalibration

Wave6では、既存の保存済みInput Profileを壊さずにhead position left/right calibrationを追加できる。

```text
Input Profile
  Head rotation                 Ready      Recalibrate
  Eyes / mouth                  Ready      Recalibrate
  Head position left/right      Missing    Calibrate

[ Run Missing Only ] [ Full Calibration ]
```

必要な挙動:

- 既存profileに`headPositionRaw`がなくてもprofileは読み込める。
- `Run Missing Only`は、保存済みprofileで不足しているsectionだけを案内する。
- `Head position left/right`の個別Calibrate/Recalibrateは、head rotation / eyes / mouthを再記録しない。
- `Look Forward`はsession neutralとしてhead rotationとhead positionの両方を更新できる。
- Stage Motionやnear/far distance responseはまだ実装しない。

### 6.2 How To Show Prompts

ユーザーに見せるUIは、次の3層にする。

1. Current prompt:
   - 今何をすればいいかを1文で出す。
   - 例: `Turn your face left`。
2. Coverage checklist:
   - 各方向が十分取れているかを `waiting` / `needs more` / `ok` で出す。
   - ユーザーが何をやり残しているか分かるようにする。
3. Lightweight meters:
   - 必要なら、head / eyes / mouthの大まかなrange meterを出す。
   - raw数値表にはしない。

この画面の目的は、debug値を見ることではなく、profileを安心して作ることである。

### 6.3 Guided vs Free Recording

v0ではguided recordingを基本にする。

理由:

- ユーザーが何をすればよいか迷わない。
- 軸符号とrange不足を拾いやすい。
- 後からmapping不自然さの原因を切り分けやすい。

ただし、将来は`Free Record Range`を追加してもよい。これは慣れたユーザーが数秒間自由に顔・目・口を動かしてrangeを更新する簡易操作である。

## 7. Future Model Page

Model pageはRuntime Exportのロード状態を扱う将来ページ候補である。現在は専用navとして公開せず、Runtime Export open/statusはHeaderとOverviewで扱う。

Input接続やmapping編集をここに置かない。

```text
+--------------------------------------------------------------------------------+
| MODEL                                                                          |
+--------------------------------------------------------------------------------+
| Runtime Export                                                                 |
|   Status:      Loaded                                                          |
|   Directory:    C:/.../kipfel-black.runtime-export                             |
|   Model:        kipfel-black                                                   |
|   Revision:     28                                                             |
|   [Open Different Export] [Reload]                                             |
|--------------------------------------------------------------------------------|
| Runtime Artifact                                                               |
|   Atlas:        Ready                                                          |
|   Drawables:     86 exported                                                   |
|   Parameters:    24                                                            |
|   Dynamics:      3 groups                                                      |
|--------------------------------------------------------------------------------|
| Notes                                                                          |
|   This page verifies model loading only. Use Mapping for live tracking setup.   |
+--------------------------------------------------------------------------------+
```

Model pageの目的:

- Runtime Exportが読めているか。
- Stageに表示できるartifactが揃っているか。
- 別モデルへ切り替える導線。

Model pageに置かないもの:

- Input Source接続。
- Mapping strength。
- Runtime parameter sliders。

## 8. Mapping Page

Mapping pageは、入力をモデルparameterへどう反映するかを扱う。

Runtime Exportがない場合、Mapping pageは説明と`Open Runtime Export`導線を表示する。

```text
+--------------------------------------------------------------------------------+
| MAPPING                                                                        |
+--------------------------------------------------------------------------------+
| Mapping Profile                                                                |
|   Profile:      Auto mapping for kipfel-black                                  |
|   Status:       Auto mapped 5 / 5                                              |
|   [Auto Map]                                                                   |
|--------------------------------------------------------------------------------|
| Head Rotation                                                                  |
|   Face Angle X  <- Head horizontal     Strength [100% -----]  [Invert] [On]    |
|   Face Angle Y  <- Head vertical       Strength [ 80% -----]  [Invert] [On]    |
|   Face Angle Z  <- Head tilt           Strength [ 60% -----]  [Invert] [On]    |
|--------------------------------------------------------------------------------|
| Eyes                                                                           |
|   Eye Left Open   <- Left blink       Strength [100% -----]  [Invert] [On]     |
|   Eye Right Open  <- Right blink      Strength [100% -----]  [Invert] [On]     |
|   Eyeball X       <- Gaze horizontal  Strength [ 70% -----]  [Invert] [On]     |
|   Eyeball Y       <- Gaze vertical    Strength [ 70% -----]  [Invert] [On]     |
|--------------------------------------------------------------------------------|
| Mouth                                                                          |
|   Mouth Open      <- Jaw open         Strength [100% -----]  [On]              |
|   Mouth Smile     <- Smile            Strength [ 80% -----]  [On]              |
|--------------------------------------------------------------------------------|
| Body                                                                           |
|   Body X         <- Head horizontal  Strength [ 35% ---] Lag [75%] [Invert][On]|
|   Body Z         <- Head tilt + X    Rotation [25%] Position [40%] Lag [75%]   |
+--------------------------------------------------------------------------------+
```

Mapping pageの原則:

- raw iFacialMocap名を主役にしない。
- semantic slot単位で見せる。
- ユーザーが最初に触るのは`enabled`、`invert`、`strength`。
- raw source selection、deadzone、smoothing、curveはAdvancedへ逃がす。
- Model Mapping Profileの永続保存は現在のv0では扱わない。
- Wave6のBody controlsはBody X strength/lag/invert、Body Z rotation strength/invert、position strength/invert、lagを扱う。保存済みModel Mapping Profileにはまだ書き込まない。
- Body targetsがない場合はmissing body slotsとして見せ、既存head / eyes / mouth live mappingを止めない。

Live確認:

- Mapping変更はStageへ即時反映される。
- Stage Windowにdebug overlayは出さない。

## 9. Future Stage Page

Stage pageは、OBSや配信用にStage Windowを整える将来ページ候補である。現在は専用navとして公開せず、`Focus Stage`などの最小操作をHeader/Overviewから行う。

```text
+--------------------------------------------------------------------------------+
| STAGE                                                                          |
+--------------------------------------------------------------------------------+
| Stage Window                                                                   |
|   Status:        Open                                                          |
|   Background:    Transparent                                                   |
|   Capture:       Use this window in OBS                                        |
|   [Focus Stage] [Reset Stage View] [Center Model]                              |
|--------------------------------------------------------------------------------|
| View                                                                           |
|   Zoom:          100%                                                          |
|   Position:      x 0 / y 0                                                     |
|   [Reset View]                                                                 |
|--------------------------------------------------------------------------------|
| Preview Background                                                             |
|   [Transparent] [Checker] [Solid Gray]                                         |
+--------------------------------------------------------------------------------+
```

Stage pageに置く候補:

- Focus Stage。
- Reset Stage View。
- background preview。
- future: always-on-top。
- future: click-through。
- future: stage size / safe area。

Stage pageに置かないもの:

- Mapping slot編集。
- Raw diagnostics。
- Runtime Export artifact details。

## 10. Future Diagnostics Page / Wave5 Debug Panel

Diagnostics pageは、問題調査と開発確認のための将来の逃がし先である。

現在は専用nav pageにせず、Control Window内のsecondary/collapsible debug panelとして通常UXから畳んでおく。

```text
+--------------------------------------------------------------------------------+
| DIAGNOSTICS                                                                    |
+--------------------------------------------------------------------------------+
| Connection                                                                      |
|   State: receiving      FPS: 59.5      Last packet: 11 ms                      |
|   Remote: 192.168.11.62:62636                                                  |
|   Malformed: 0          Parse warnings: 0      Normalize warnings: 0           |
|--------------------------------------------------------------------------------|
| Raw Frame                                                                       |
|   trackingStatus-1|jawOpen-5|eyeBlink_L-0|...                                  |
|   [Copy Diagnostics]                                                           |
|--------------------------------------------------------------------------------|
| Parsed Frame                                                                    |
|   Blendshapes: 54                                                              |
|   Head rotation: x 0.20 / y 24.08 / z 3.84                                     |
|   Head position: x 0.032 / y 0.034 / z -0.657                                  |
|--------------------------------------------------------------------------------|
| Normalized / Mapped                                                             |
|   tracking frame summary                                                       |
|   mapped parameter output summary                                              |
+--------------------------------------------------------------------------------+
```

Diagnosticsの原則:

- 通常画面に混ぜない。
- Copy diagnosticsを常に用意する。
- Stage Windowへ表示しない。
- Mapping後はmapped parameter valuesもここで見られるようにする。

## 11. Stage Window

Stage Windowは設定画面ではない。

```text
+--------------------------------------------------+
|                                                  |
|                                                  |
|                  live model only                 |
|                                                  |
|              transparent background              |
|                                                  |
+--------------------------------------------------+
```

Stage Windowに出さないもの:

- toolbar。
- parameter sliders。
- debug text。
- mesh/deformer overlays。
- connection status。
- calibration guide。

必要な操作はControl Windowから行う。

## 12. Current Implementation Shape

Wave5/Wave6で実装された現在の形状:

- Persistent Header。
- `Overview` / `Input` / `Mapping` のみのnavigation。
- Runtime Export open/status、input connection、profile/calibration、mapping/live readinessをControlで扱う。
- Diagnosticsはsecondary collapsible debug panelとして残す。
- Stage Windowはcanvas model-onlyで、debug overlay、raw tracking text、parameter sliderを出さない。
- Mainがprofile/calibration/mapping/live parameter frameを所有し、Stageはsanitized parameter valuesをruntime-core評価へ渡す。
- Input Profileはhead position left/right section readinessとmissing-only/head-position-only recalibrationを持つ。
- Mappingは既存9個のhead/eyes/mouth slotsを保ち、Body X/Z slotsとBody Follow controlsを追加する。
- Body Follow outputはmain-owned sanitized parameter frameとしてStageへ届く。Stageはraw tracking/head-position/debug body dataを受け取らない。

Future page候補:

- Model page。
- Stage page。
- Dedicated Diagnostics page。
- Hide Control / display settings。
- Persistent Model Mapping Profile management。

この順なら、今の縦積み画面から段階的に移行できる。

## 13. Open Questions

- Dedicated Model / Stage / Diagnostics pagesをどのwaveで実体化するか。
- `Hide Control`をどのwaveで実装するか。
- Model Mapping Profileの永続保存先とRuntime Export fingerprint。
- Stage Windowのalways-on-top / click-through / background previewをどのwaveで扱うか。
- Stage Motion、near/far distance response、Broadcast/OBS UXをどのwaveで扱うか。
