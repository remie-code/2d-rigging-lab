# Control Window Screen Structure

> Runtime Player Control Windowを、1枚の縦積み設定画面ではなく、責務別の小さな管理アプリとして扱うための画面構成。
> Wave13実装事実: Runtime Playerは `Header + Overview / Live Controller / Input / Mapping / Stage / Performance Diagnostics` を実体ページとして公開する。Wave6はInput head position calibrationとMapping Body groupを追加し、Wave7はModel Mapping Profile auto-saveとStage Page + Window State auto-saveを追加した。Wave8はStage pageへRuntime Export startup restore status、Capture Target checklist、Arrange Stage、click-through、always-on-top、Copy Window Titleを追加した。Wave9/Wave10はBrowser Source Outputとnative local preview suspensionを追加した。Wave11はInput Profile near/far calibrationとStage page上のStage Motion panelを追加した。Wave12はLive Controllerでsession-only active Variant switchingを追加し、Stage WindowとBrowser Sourceへ同じsanitized active Variant selectionを反映する。Wave13はshared Stage renderer frame pacingとPerformance Diagnostics pageを追加する。`Model` page と raw/input 用の専用 `Diagnostics` page はまだ公開しない。

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
| Live Controller      |  selected page content                                  |
| Input                |                                                         |
| Mapping              |                                                         |
| Stage                |                                                         |
| Performance Diag.    |                                                         |
+----------------------+---------------------------------------------------------+
```

Stage Windowはこの構造に含めない。Stage Windowは常にmodel onlyである。

将来、Model pageやraw/input diagnostics専用pageに分ける余地は残すが、空のplaceholder pageは出さない。Wave13の`Performance Diagnostics`はそれらとは別の公開済み低優先度pageであり、render pacing evidenceを安全に採取するための画面である。

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
| Live Controller      |
| Input                |
| Mapping              |
| Stage                |
| Performance Diag.    |
+----------------------+
```

各ページの責務:

| Page | Responsibility |
|---|---|
| Overview | ライブ表示に必要な状態が揃っているか、次に何をすべきか |
| Live Controller | Variant差分切替、Reset to Model Default、Look Forward、Center Model、Stage Motion On/Off |
| Input | iFacialMocap接続、transport、port、local IP、Input Profile、near/farを含むhead position calibration |
| Mapping | Auto Mapping結果、semantic slot、strength/invert |
| Stage | Stage Window bounds、Stage view transform、focus、view reset/center、Window State保存状態、Stage Motion、Browser Source Output、Local Preview / Fallback、Capture Target readiness、Arrange Stage、click-through、always-on-top |
| Performance Diagnostics | Native Stage / Browser Source / Both のtimed capture、source/input FPSとrender FPSの分離、frame pacing/render metrics report、Copy Report |

Calibrationは独立navにしない。Input Profileの作成・再調整としてInput page内から起動する guided sub-screen とする。

Future page候補:

| Page | Future responsibility |
|---|---|
| Model | Runtime Export load/change、model summary、artifact status |
| Raw/Input Diagnostics | raw / parsed / normalized / mapped values、copy diagnostics |

raw/input diagnosticsは専用navではなく、Control内のsecondary collapsible debug panelとして残す。Wave13の`Performance Diagnostics` pageは公開済みだが、raw tracking frameを見るための画面ではない。

Stage pageは、Wave7で空のplaceholderではなく実体を持つページとして追加済みである。Wave8ではBroadcast/OBSを自動操作せず、Stage Windowをlocal capture targetとして整える操作を追加した。Live ControllerはWave12で実体pageとして追加済みであり、Stage pageの詳細設定を複製しない。Performance DiagnosticsはWave13で低優先度pageとして追加され、通常live操作導線とは分ける。

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
|   Status: Saved                         Auto mapped 11 / 11                    |
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
- Mapping Profile未保存/保存失敗: Mapping pageで保存状態を確認できるようにする。
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

Wave11 implemented prompts:

- Move closer / farther for near/far depth calibration used by Stage Motion depth scale.

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
- Wave11では`Head position near/far` readinessとmissing-only / section calibrationも追加済みである。Stage Motion scale followはこの明示near/far calibrationを使い、left/right calibration中の偶発的なZ値をproduction depthとして扱わない。

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
|   Profile:      kipfel-black                                                   |
|   Status:       Saved just now                                                 |
|   Runtime:      kipfel-black.runtime-export                                    |
|   [Auto Map] [Reset to Auto Map]                                                |
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
- Model Mapping Profileは、次の保存waveでは手動`Save`ではなく自動保存する。
- Mapping変更は即時Stageへ反映し、最後の変更から短いdebounce後に保存する。
- Mapping page上部の`Mapping Profile` cardで保存状態を表示する。
- HeaderにはMapping保存ボタンを置かない。HeaderはRuntime Export open、Look Forward、Focus Stageなど全体操作に絞る。
- Overviewには`Mapping: Saved / Needs setup / Stale / Save failed`程度の状態だけを出す。
- 保存失敗時だけ`Retry`を表示する。
- 試行錯誤で壊した場合の主導線は`Save`ではなく`Reset to Auto Map`にする。
- Wave6のBody controlsはBody X strength/lag/invert、Body Z rotation strength/invert、position strength/invert、lagを扱う。永続保存waveではこれらもModel Mapping Profileへ保存する。
- Body targetsがない場合はmissing body slotsとして見せ、既存head / eyes / mouth live mappingを止めない。

Live確認:

- Mapping変更はStageへ即時反映される。
- Stage Windowにdebug overlayは出さない。

### 8.1 Model Mapping Profile Auto Save

Model Mapping Profileはモデル依存の設定であり、Input Profileとは別物である。

保存方式:

- 自動保存を基本にする。
- スライダーやtoggle変更は即時Stageへ反映する。
- 永続保存はdebounceする。目安は最後の変更から`500ms〜1000ms`後。
- Runtime Export切り替え、アプリ終了、window close前には保存flushを試みる。
- 保存に失敗した場合だけ、明示的な`Retry`を表示する。

Mapping Profile cardの状態表示:

```text
Saved
Saving...
Unsaved changes
Save failed    [Retry]
Stale export   [Auto Map] [Reset to Auto Map]
```

手動操作:

- `Auto Map`: 現在のRuntime Exportから初期mappingを再生成する。
- `Reset to Auto Map`: 保存済み調整を破棄して自動mappingへ戻す。
- `Retry`: 保存失敗時だけ表示する。

置かない操作:

- Header上の`Save Mapping`。
- すべての変更で押す必要がある手動`Save`。
- Stage Window上の保存UI。

## 9. Wave7 Stage Page v0 And Wave8 Capture Target Controls

Wave7のStage page v0は、Stage Window boundsとStage view transformを扱うページとして始まった。

このページは空のplaceholderではない。Wave7で実体pageとして実装済みであり、Wave8ではBroadcast Stage Setup v0の操作も同じStage pageに追加した。Wave9/Wave10ではBrowser Source Outputとlocal preview suspension表示を追加し、Wave11ではStage Motion panelを追加した。Overviewを肥大化させないため、Stage表示・capture-target準備・Stage-level display transformの低頻度操作はStage pageへ集約する。

Current Stage page responsibilities:

- Stage WindowのOS上の位置・サイズを確認する。
- Stage内のpan/zoomを確認する。
- Stage Windowを前面へ出す。
- Stage viewをreset/centerする。
- Window/View stateの自動保存状態を表示する。
- Stage Motionのenabled、horizontal follow、depth scale、dead zone、reactionを扱う。
- Depth Scaleのnear/far calibration readinessを表示し、不足時はInput calibrationへ誘導する。
- Browser Source OutputのURL、server/client/render diagnostics、local preview suspension statusを扱う。
- Runtime Export startup restore statusを表示し、失敗時はRetry/Open New導線を出す。
- Stage Windowを一時arrange modeで移動できるようにする。
- click-throughをControlからOn/Offし、tray/application menuから解除できるようにする。
- always-on-topをOn/Offし、Window Stateへ保存する。
- Capture Target checklistを表示する。ただしOBS readinessやOBS integration statusは表示しない。
- Stable native title `Runtime Player Stage` を表示し、Copy Window Titleを提供する。

```text
+--------------------------------------------------------------------------------+
| STAGE                                                                          |
+--------------------------------------------------------------------------------+
| Stage Window                                                                   |
|   Status:        Open                                                          |
|   Size:          900 x 1200                                                     |
|   Position:      x 1200 / y 80                                                  |
|   Persistence:   Saved just now                                                 |
|   [Focus Stage]                                                                |
|--------------------------------------------------------------------------------|
| View                                                                           |
|   Zoom:          82%                                                           |
|   Position:      x -32 / y 140                                                  |
|   Persistence:   Saved just now                                                 |
|   [Reset View] [Center Model]                                                   |
|--------------------------------------------------------------------------------|
| Stage Motion                                                                   |
|   Enabled:       On                                                            |
|   Horizontal:    Strength 80 px / Limit 120 px / Invert off                    |
|   Depth Scale:   Strength 6% / Limit 10% / Near/Far ready                      |
|   Stabilization: Dead zone 0.03 / Reaction 8                                   |
|   Persistence:   Saved just now                                                 |
|--------------------------------------------------------------------------------|
| Browser Source Output                                                          |
|   URL, server/client/render status, heartbeat, local preview suspension         |
|--------------------------------------------------------------------------------|
| Persistence                                                                    |
|   Scope:         This device                                                    |
|   Storage:       window-state/runtime-player.json                               |
|--------------------------------------------------------------------------------|
| Capture Target                                                                 |
|   Stage Window: Open       Runtime Export: Loaded                              |
|   Model: Visible           Background: Transparent                             |
|   Stage UI: Hidden         Window title: Runtime Player Stage [Copy]           |
|   Click-through: Off [Toggle]    Always on top: Off [Toggle]                   |
|   [Arrange Stage]                                                              |
+--------------------------------------------------------------------------------+
```

Stage page v0に置くもの:

- Focus Stage。
- Reset Stage View。
- Center Model。
- Stage window bounds保存状態。
- Stage pan/zoom保存状態。
- Stage Motion設定とnear/far calibration readiness。
- Browser Source Output status。
- 保存状態 `Saved / Saving / Save failed`。
- 必要なら `Retry`。
- Runtime Export startup restore status。
- Capture Target checklist。
- Arrange Stage。
- Click-through toggle。
- Always-on-top toggle。
- Copy Window Title。

Stage page v0に置かないもの:

- Mapping slot編集。
- Raw diagnostics。
- Runtime Export artifact details。
- OBS integration/readiness claim。
- OBS source creation。
- Spout output。
- background preview。
- runtime parameter sliders。
- debug diagnostics。
- raw tracking/head-position values。

### 9.1 Stage Window Bounds vs Stage View Transform

Stage window boundsとStage view transformは別物として保存する。

```text
Stage window bounds
  - window x / y
  - window width / height
  - OS上の表示位置とサイズ

Stage view transform
  - pan x / y
  - zoom
  - Stage内でモデルをどこにどう表示するか
```

ユーザー体験:

1. Stage Windowの端や角をOS/Electron window resizeでDnDし、OBS等に載せたい枠の大きさにする。
2. Stage内でマウスホイール/ドラッグして、モデルの表示位置と大きさを整える。
3. Window boundsとview transformは自動保存される。
4. 次回起動時に同じStage window位置・サイズ・モデル表示位置で戻る。

v0ではStage page上で数値編集しない。OSの通常window move/resize、Stage内の既存pan/zoom操作、`Reset View`、`Center Model`で十分とする。

### 9.2 Window State Persistence

Window State Persistenceも自動保存である。

保存対象:

- Control Window bounds。
- Stage Window bounds。
- Stage view pan/zoom。
- Stage environment `alwaysOnTop`。

保存対象外:

- Runtime Export auto restore。
- Stage transparency。
- click-through。
- OBS/capture automation settings。
- Model Mapping Profile。

関連保存場所:

```text
<electron userData>/
  window-state/
    runtime-player.json

<electron userData>/
  startup-state/
    runtime-player-startup.json
```

Model Mapping Profileとは保存場所を分ける。
Runtime Export auto restoreはWindow Stateの保存対象ではないが、Wave8で別のStartup Stateとして保存する。

```text
<electron userData>/
  model-mapping-profiles/
    <safe-package-id>/
      <fingerprint>.json

<electron userData>/
  window-state/
    runtime-player.json
```

理由:

- Mapping Profileはモデルごとの「動き」の設定である。
- Window Stateは端末・画面環境ごとの「見え方」の設定である。
- 同じRuntime Exportを別PCで使ってもwindow位置は共有しない方が自然である。
- 同じPCで別モデルを開いてもStage window位置・サイズは使い回せる方が自然である。

保存タイミング:

- window move/resize後にdebounce保存。
- Stage pan/zoom変更後にdebounce保存。
- close前にflush。
- restore失敗時はdefault layoutへfallback。

保存失敗は通常UXを邪魔しない。Stage pageまたはDiagnostics/Overviewに小さく出す程度にする。

## 10. Diagnostics Separation

Runtime Playerには、用途の違うdiagnosticsが2種類ある。

1. Wave5由来のraw/input diagnostics debug panel。
2. Wave13のPerformance Diagnostics page。

これらは混ぜない。raw/input diagnosticsは、問題調査と開発確認のための将来の逃がし先であり、現在は専用nav pageにせず、Control Window内のsecondary/collapsible debug panelとして通常UXから畳んでおく。

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

Performance Diagnosticsの原則:

- 低優先度nav pageとして公開する。
- Native Stage / Browser Source / Bothをtargetに選べる。
- 10s / 30sのtimed capture、Start Capture、Stop Capture、Copy Report、Clear Report、report previewを持つ。
- target availabilityと比較run guidanceを表示する。
- reportはsource/input FPSとrender FPSを分け、rAF delta、render duration、render count、scheduled/immediate render count、live frame message count、Stage view/display transform counts、duplicate transform skip count、coalesced live frame count、canvas size、devicePixelRatioを含める。
- reportはraw tracking frames、calibration internals、Browser Source token、private file paths、full Runtime Export payloadを含めない。
- 詳細責務は [performance-diagnostics.md](performance-diagnostics.md) に置く。

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

Wave5/Wave6/Wave7/Wave8/Wave9/Wave10/Wave11/Wave12/Wave13で実装された現在の形状:

- Persistent Header。
- `Overview` / `Live Controller` / `Input` / `Mapping` / `Stage` / `Performance Diagnostics` のnavigation。
- Runtime Export open/status、input connection、profile/calibration、mapping/live readinessをControlで扱う。
- raw/input Diagnosticsはsecondary collapsible debug panelとして残す。
- Stage Windowはcanvas model-onlyで、debug overlay、raw tracking text、parameter sliderを出さない。
- Mainがprofile/calibration/mapping/live parameter frameを所有し、Stageはsanitized parameter valuesをruntime-core評価へ渡す。
- Input Profileはhead position left/right section readinessとmissing-only/head-position-only recalibrationを持つ。
- Mappingは既存9個のhead/eyes/mouth slotsを保ち、Body X/Z slotsとBody Follow controlsを追加する。
- Mapping / Body Follow controlsはModel Mapping ProfileとしてRuntime Export identityごとに自動保存/復元する。
- Model Mapping Profileは`<electron userData>/model-mapping-profiles/<safe-package-id>/<fingerprint>.json`へ保存する。
- Body Follow outputはmain-owned sanitized parameter frameとしてStageへ届く。Stageはraw tracking/head-position/debug body dataを受け取らない。
- Stage pageはStage Window bounds、Stage view pan/zoom、Focus Stage、Reset View、Center Model、window-state保存状態を扱う。
- Window Stateは`<electron userData>/window-state/runtime-player.json`へ保存し、Model Mapping Profileとは分ける。
- Runtime Export startup restoreは`<electron userData>/startup-state/runtime-player-startup.json`へ保存し、Window State / Model Mapping Profile / Input Profileとは分ける。
- Stage pageはCapture Target checklist、Arrange Stage、click-through、always-on-top、Copy Window Titleも扱う。
- click-throughは起動時Offで、永続保存しない。
- always-on-topはWindow Stateの`stageEnvironment.alwaysOnTop`として保存する。
- Browser Source Outputはprimary broadcast pathとしてStage pageにあり、Browser Source接続中はnative local preview live renderingだけをsuspendする。
- Input Profileは`Head position left/right`と`Head position near/far`のready/missing状態を分ける。
- Stage MotionはStage page上のcompact panelとして実装済みで、Mapping pageには置かない。
- Stage Motion設定はWindow State / local display settingとして自動保存する。
- Manual Stage pan/zoomは保存済みbase transformであり、Stage Motionはその上に一時的なhorizontal/scale display offsetを合成する。
- Browser SourceはStage Motion適用後のsanitized composed Stage transformを受け取り、raw tracking frame、raw head position、calibration internals、debug diagnosticsは受け取らない。
- Wave10 native local preview suspension中もBrowser Source rendering、input processing、mapping、body follow、dynamics、Runtime Export state、Stage transform sync、Stage Motionはactiveのまま維持する。
- Live Controller pageはRuntime Export Variant Groupsを表示し、`singleSelect` / `multiToggle`、`Reset to Model Default`、`Look Forward`、`Center Model`、`Stage Motion` On/Offを扱う。
- Runtime Playerのactive Variant selectionはsession-onlyであり、Runtime Export defaultsから初期化され、Runtime Export load/reload/restartでdefaultsへ戻る。Runtime Export clear/unload時はsession selectionを消す。
- New Runtime Exports with drawable `baseVisible` support runtime Variant switching; legacy exports without complete `baseVisible` still load but switching is disabled with re-export guidance.
- Native Stage Window and Browser Source use the same session active Variant selection. Browser Source reload/resync includes the current active selection.
- Browser Source receives sanitized active Variant selection only; raw tracking frames, iFacialMocap diagnostics, calibration internals, and private file paths do not cross into Browser Source for Variant switching.
- Wave13でshared Stage renderer frame pacingを追加し、live framesとStage view/display transform invalidationは可能な範囲でscheduled rAF renderingへ合流する。
- duplicate unchanged Stage view/display transformsはskipされ、skip countとしてmetricsに出る。
- Native StageはStage view IPC経由でrenderer metricsをControlへ渡す。
- Browser SourceはBrowser Source diagnostics pathでsanitized renderer diagnostics/metricsを渡す。
- Performance Diagnostics pageはtarget Native Stage / Browser Source / Both、duration 10s / 30s、Start/Stop Capture、Copy Report、Clear Report、report preview、target availability、comparison run guidanceを扱う。
- Performance Diagnostics reportはsource/input FPSとrender FPSを分け、agentsへ戻せるcounterを含むが、raw tracking frames、calibration internals、Browser Source token、private file paths、full Runtime Export payloadは含めない。
- Wave10 local preview suspension、Wave11 Stage Motion、Wave12 Variant switchingはWave13後も維持する意図で扱う。

Future page候補:

- Model page。
- Dedicated raw/input diagnostics page。
- Hide Control / display settings。
- Persistent Model Mapping Profile management。
- Last-active Variant persistence。

この順なら、今の縦積み画面から段階的に移行できる。

## 13. Open Questions

- Dedicated Model / raw-input Diagnostics pagesをどのwaveで実体化するか。Performance DiagnosticsはWave13で別pageとして実体化済み。
- Header上に明示的な`Hide Control`操作を置くか。Wave8ではControl close-hideとtray/menu recoveryを実装済み。
- background previewを扱うか。
- Stage Motionのreal-device default tuningをどこまで詰めるか。
- Player last-active Variant persistenceを将来実装するか。
- Spout Output、OBS automationをどのwaveで扱うか。
- Wave8のElectron/OBS-adjacent手動確認: Control close-hide/reopen、Explicit Quit flush/exit、Runtime Export valid/invalid startup restore、Arrange drag、click-through tray recovery、always-on-top persistence、Capture Target checklist/Copy Window Title、OBS Window Capture title/alpha smoke。
