# Control Window Screen Structure

> Runtime Player Control Windowを、1枚の縦積み設定画面ではなく、責務別の小さな管理アプリとして扱うための画面構成。

## 1. Position

Runtime Playerは、Stage WindowをCleanな配信対象として保ち、Control Windowでロード、入力接続、キャリブレーション、mapping、stage操作、diagnosticsを扱う。

機能が増えた現在、Control Windowにすべてのカードを縦に積むと次の問題が出る。

- Live中によく押す操作が埋もれる。
- Input setupとmodel mappingとdebug情報が同じ重さで見えてしまう。
- Runtime Export未ロードでも可能な操作と、モデルロード後にだけ意味を持つ操作が混ざる。
- Diagnosticsが通常UXを圧迫する。

そのため、Control Windowは次の構造にする。

```text
+--------------------------------------------------------------------------------+
| Runtime Player                  Model: loaded       Input: live       Live: on   |
| [Open Export] [Look Forward] [Focus Stage] [Hide Control]                       |
+----------------------+---------------------------------------------------------+
| Overview             |                                                         |
| Input                |  selected page content                                  |
| Model                |                                                         |
| Mapping              |                                                         |
| Stage                |                                                         |
| Diagnostics          |                                                         |
+----------------------+---------------------------------------------------------+
```

Stage Windowはこの構造に含めない。Stage Windowは常にmodel onlyである。

## 2. Persistent Header

Headerは、どのページにいてもLive状態と頻出操作を見失わないために置く。

```text
+--------------------------------------------------------------------------------+
| Runtime Player                                                                  |
| Model: kipfel-black.runtime-export  Input: iFacialMocap / 59 fps  Live: Active  |
| [Open Export] [Look Forward] [Focus Stage] [Hide Control]              [Settings]|
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
- `Hide Control`: 配信中にControl Windowを隠す。

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
| Model                |
| Mapping              |
| Stage                |
| Diagnostics          |
+----------------------+
```

各ページの責務:

| Page | Responsibility |
|---|---|
| Overview | ライブ表示に必要な状態が揃っているか、次に何をすべきか |
| Input | iFacialMocap接続、transport、port、local IP、Input Profile |
| Model | Runtime Export load/change、model summary、artifact status |
| Mapping | Auto Mapping結果、semantic slot、strength/invert |
| Stage | Stage Windowの表示、focus、view reset、透明/背景確認 |
| Diagnostics | raw / parsed / normalized / mapped values、copy diagnostics |

Calibrationは独立navにしない。Input Profileの作成・再調整としてInput page内から起動する guided sub-screen とする。

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

Future prompts:

- Move head left / right for head position and future Stage Motion。
- Move closer / farther for future scale / depth behavior。

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

## 7. Model Page

Model pageはRuntime Exportのロード状態を扱う。

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
|   [Auto Map] [Save Mapping Profile]                                            |
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
+--------------------------------------------------------------------------------+
```

Mapping pageの原則:

- raw iFacialMocap名を主役にしない。
- semantic slot単位で見せる。
- ユーザーが最初に触るのは`enabled`、`invert`、`strength`。
- raw source selection、deadzone、smoothing、curveはAdvancedへ逃がす。

Live確認:

- Mapping変更はStageへ即時反映される。
- Stage Windowにdebug overlayは出さない。

## 9. Stage Page

Stage pageは、OBSや配信用にStage Windowを整える場所。

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

## 10. Diagnostics Page

Diagnostics pageは、問題調査と開発確認のための逃がし先。

通常UXでは閉じておく。

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

## 12. Recommended Next Implementation Shape

次の実装waveで一気に完全な多画面管理アプリを作る必要はない。

ただし、構造はこの形へ寄せる。

優先順:

1. Control Window shell:
   - Header。
   - Left nav。
   - Overview page。
2. Existing controls relocation:
   - Runtime Export load -> Model / Overview。
   - Input connection -> Input / Overview。
   - Debug panel -> Diagnostics。
3. Tracking Setup:
   - Look Forward。
   - Input Profile no-profile guidance。
   - Mapping page。
4. Live Confirmation:
   - mapping outputをStageへ反映。
   - Stageはcleanのまま。

この順なら、今の縦積み画面から段階的に移行できる。

## 13. Open Questions

- Calibration guided sub-screenをpageとして扱うか、drawer/modalとして扱うか。
- Headerの`Look Forward`は常時表示か、input receiving時だけ有効化か。
- `Hide Control`をv0で実装するか、後続に回すか。
- Mapping pageのslot行はcompact tableにするか、group cardにするか。
- Model Mapping Profileの永続保存先。
