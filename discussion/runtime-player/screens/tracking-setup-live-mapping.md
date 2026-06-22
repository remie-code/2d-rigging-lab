# Tracking Setup / Live Mapping UX

> iFacialMocapなどのtracking inputを、Runtime Exportのモデルへ自然に反映するためのSetup / Calibration / Auto Mapping / Live確認UX。
> Wave6実装事実: Input Profile / Look Forward / Guided Calibration v0 / head position left/right calibration / Auto Mapping v0 + Body X/Z / Stage Live Parameter Application が実装済み。Persistent Model Mapping Profile save、advanced source selection、deadzone/curve、Stage Motionはfuture。

## 1. Goal

ユーザーが得るべき体験は、「データが取れている」ではなく、「自分の顔にモデルが自然についてくる」である。

そのため、次のUXはdebug viewerではなく、Tracking Setupとして設計する。

主な到達点:

- iFacialMocapからtracking frameを受信できる。
- 入力側のprofile / calibration状態が分かる。
- Runtime Exportロード後、標準parameterへAuto Mappingされる。
- `Look Forward`で現在の正面をいつでも取り直せる。
- Stage上でモデルがLiveに動き、ユーザーが自然さを確認できる。
- 違和感がある箇所だけ、意味単位で調整できる。

Wave5/Wave6 source/test evidence:

- Control Window exposes `Overview` / `Input` / `Mapping` only.
- Input Profile persists to `<electron userData>/input-profiles/ifacialmocap/profiles.json`.
- `Look Forward` updates session neutral and does not overwrite persistent profile neutral.
- Guided calibration records range and learned signs.
- Auto Mapping creates semantic slots and filters direct output targets to external-input authored parameters.
- Main emits sanitized `runtime-player-live-parameter-frame-v1`; Stage evaluates it through runtime-core and remains model-only.
- Wave6 adds head position left/right calibration, missing-only recalibration, Body X/Z semantic slots, Body Follow controls, and Body Follow output through the same sanitized live parameter frame path.
- Manual real-device Stage body motion verification remains required for closeout confidence.

## 2. Concept Split

Tracking Setupは3層に分ける。

| Layer | Meaning | Model Required |
|---|---|---|
| Input Source | iFacialMocap接続そのもの。transport、port、remote、FPS、raw diagnostics | No |
| Input Profile | その人、端末、カメラ位置、iFacialMocapのキャリブレーション | No |
| Model Mapping State v0 | そのモデルをどのparameterでどう動かすか。現在はsession/local stateで、永続保存しない | Yes |

この分離は複数モデル・複数ユーザーに対応するために必要である。

## 3. Input Profile Lifecycle

Input Profileはモデル非依存の設定である。

含む情報:

- 顔回転のneutral / min / max。
- 目線のneutral / min / max。
- 口開閉のneutral / min / max。
- head positionの基準値、観測range、Body Z lateral component用のlearned signs。
- source種別とtransport。
- 入力値の補正に必要なmetadata。

含めない情報:

- Runtime Export固有のparameter名。
- モデルごとのstrength / invert。
- Stage上のモデル表示位置。

### 3.0 Storage

Input ProfileはRuntime Player側のPCローカル設定として保存する。

保存場所:

```text
<electron userData>/
  input-profiles/
    ifacialmocap/
      profiles.json
```

理由:

- Input ProfileはRuntime ExportにもEditor workspaceにも属さない。
- ユーザー、端末、カメラ位置、iFacialMocap sourceに属する。
- 複数モデルで使い回すべきである。
- PCローカルのRuntime Player設定なので、Electronの`userData`が自然である。

v0では1ファイル管理でよい。

```json
{
  "schemaVersion": "runtime-player-input-profiles-v1",
  "activeProfileId": "profile_remie_desk",
  "profiles": [
    {
      "profileId": "profile_remie_desk",
      "displayName": "Remie / desk",
      "source": "ifacialmocap",
      "transport": "udp",
      "createdAtIso": "2026-06-22T00:00:00.000Z",
      "updatedAtIso": "2026-06-22T00:00:00.000Z",
      "calibration": {
        "headRotationEulerDeg": {
          "neutral": { "x": 0, "y": 0, "z": 0 },
          "min": { "x": -20, "y": -30, "z": -15 },
          "max": { "x": 20, "y": 30, "z": 15 },
          "learnedSigns": {
            "faceLeft": { "axis": "y", "direction": 1 },
            "faceRight": { "axis": "y", "direction": -1 },
            "tiltLeft": { "axis": "z", "direction": 1 },
            "tiltRight": { "axis": "z", "direction": -1 }
          }
        },
        "eyes": {
          "neutral": {},
          "min": {},
          "max": {},
          "learnedSigns": {}
        },
        "mouth": {
          "jawOpenMin": 0,
          "jawOpenMax": 0.8,
          "smileMin": 0,
          "smileMax": 0.7
        }
      }
    }
  ]
}
```

`calibration.headRotationEulerDeg.neutral`はprofile作成時の基準値であり、毎回の`Look Forward`結果で即時上書きしない。毎回の`Look Forward`はsession neutral offsetとして別に保持する。

将来、明示操作として`Save current forward to profile default`を追加してもよい。

Wave6では、同じprofile documentに任意の`calibration.headPositionRaw` sectionを追加する。古いprofileにこのsectionがなくても読み込みは成功し、head position sectionだけが`Missing`として扱われる。

### 3.1 Existing Profile

既存profileがある場合、Connect後に前回使ったInput Profileを自動選択する。

```text
Input Calibration
Receiving: 59 fps
Profile: Remie / iPhone front camera
Status: Range calibrated
[ Look Forward ] [ Record Range ] [ Profile... ]
```

ユーザーは毎回フルキャリブレーションしない。

ただし、`Look Forward`は姿勢や座り位置で頻繁に必要になるため、常時押せる場所に置く。

保存済みprofileの読み込みに失敗した場合は、temporary defaultsへフォールバックし、Diagnosticsに警告を出す。

### 3.2 No Profile

profileがない場合、キャリブレーション機能を自動的に起動するのが望ましい。

```text
No input profile
Connect succeeded.

1. Look forward
2. Move your face, eyes, and mouth
3. Save input profile

[ Start Calibration ] [ Use temporary defaults ]
```

`Start Calibration`を主導線にする。

`Use temporary defaults`は開発・デモ・急ぎの確認用の逃げ道として残す。これを選んだ場合、profileは保存されず、default rangeとsession neutralだけでLive確認する。

### 3.3 Recalibration

既存profileを再調整したい場合:

- `Record Range`でrangeを再記録する。
- 変更は明示的に保存する。
- いきなり既存profileを上書きしない。
- Wave6では`Run Missing Only`で不足sectionだけを記録できる。
- Wave6では`Head position left/right`だけを個別にCalibrate/Recalibrateできる。

別ユーザーや別環境向けには、`New Profile`または`Duplicate Profile`を用意する。

```text
Input Profiles
- Remie / desk
- Remie / standing
- Guest

[ New Profile ] [ Duplicate ] [ Recalibrate ]
```

## 4. Look Forward

`Look Forward`は任意のタイミングで押せる必要がある。

意味:

- 現在の顔向きを、このセッションの正面として扱う。
- 入力値のsession neutral offsetを更新する。
- Input Profileの永続rangeをただちに汚さない。

配置:

- Control WindowのInput / Calibration領域に常時表示する。
- Runtime Export未ロードでも使える。
- Runtime Exportロード後もLive確認中に頻繁に使える。

将来拡張:

- `Save current forward to profile default` は別操作として検討する。

## 5. Auto Mapping

Auto MappingはRuntime Exportロード後に実行する。

理由:

- 出力先parameter一覧はRuntime Exportに含まれる。
- Editor側の標準parameter名があるため、多くは自動割り当てできる。
- 入力接続とは独立してよいが、モデルparameterなしでは最終mappingを確定できない。

### 5.1 Semantic Slots

Auto Mappingはraw fieldではなく、意味単位のslotとして扱う。

| Slot | Input Candidate | Default Target |
|---|---|---|
| Head Rotation X | head rotation yaw/pitch mapping decision | `Face Angle X` |
| Head Rotation Y | head rotation yaw/pitch mapping decision | `Face Angle Y` |
| Head Rotation Z | head rotation roll | `Face Angle Z` |
| Eye Blink Left | `eyeBlink_L` | `Eye Left Open` |
| Eye Blink Right | `eyeBlink_R` | `Eye Right Open` |
| Gaze X | eye Euler first | `Eyeball X` |
| Gaze Y | eye Euler first | `Eyeball Y` |
| Mouth Open | `jawOpen` | `Mouth Open` |
| Mouth Smile | `mouthSmile_L/R` | `Mouth Smile` |
| Body X | calibrated head horizontal with body lag/strength | `Body Angle X` |
| Body Z | calibrated head tilt + optional calibrated head positionX | `Body Angle Z` |

Future slots:

- Stage Motion from head position。
- Mouth vowel / expression blendshape mapping。

### 5.2 Mapping Result

Wave5/Wave6 v0では、Runtime Exportロード後にAuto Mappingで初期生成する。

Persistent Model Mapping Profile save/readは未実装である。slotごとの`enabled / invert / strength`はControlで編集できるが、編集状態はRuntime Playerの実行中状態であり、profile fileとして保存しない。

```text
Model Mapping
Profile: Auto mapping for kipfel-black
Status: Auto mapped 5 / 5
[ Edit Mapping ]
```

未対応parameterがある場合はwarningとして出すが、最初のLive体験を止めない。

Wave6ではBody X/Z targetがあるRuntime Exportでbody slotsを追加する。Body targetがない場合はmissing body slotsとして見せるが、既存のhead / eyes / mouth live mappingは止めない。

## 6. Future Model Mapping Profile

Model Mapping Profileはモデル依存の将来設定である。現在のv0では保存しない。

含む情報:

- semantic slot。
- target parameter。
- enabled / disabled。
- invert。
- strength。
- output range / limit。
- optional advanced source selection。

保存場所はInput Profileとは分ける。将来候補:

```text
<electron userData>/
  model-mapping-profiles/
    <runtime-export-fingerprint>.json
```

含めない情報:

- iPhone接続先。
- raw input range profile。
- session neutral。

将来は、Runtime Exportを開いた時に、そのモデルIDまたはexport fingerprintに紐づくModel Mapping Profileを探す。なければAuto Mappingする。

## 7. Mapping Edit UX

ユーザーが見るべきものはraw field名ではなく、「顔向き」「まばたき」「目線」「口」などの意味である。

```text
Model Mapping

Head Rotation
Face Angle X  <- Head horizontal     [strength] [invert]
Face Angle Y  <- Head vertical       [strength] [invert]
Face Angle Z  <- Head tilt           [strength] [invert]

Eyes
Eye Left Open   <- Left blink        [strength] [invert]
Eye Right Open  <- Right blink       [strength] [invert]
Eyeball X       <- Gaze horizontal   [strength] [invert]
Eyeball Y       <- Gaze vertical     [strength] [invert]

Mouth
Mouth Open      <- Jaw open          [strength]
Mouth Smile     <- Smile             [strength]

Body
Body X          <- Head horizontal    [strength] [lag] [invert]
Body Z          <- Head tilt + X      [rotation strength] [position strength] [lag]
```

Advancedに逃がす項目:

- raw source selection。
- deadzone。
- smoothing。
- response curve。
- per-side merge rules。

Wave6 Body Follow controls do not require users to tune raw head position tables.

## 8. Strength

Strengthは、入力変化をモデルparameterへどれくらい強く反映するかを表す。

概念式:

```text
normalized = (input - neutral) / calibratedRange
output = normalized * parameterRange * strength
```

例:

- 入力head yawが正面から20度。
- calibration上の最大yawが30度。
- `Face Angle X`のparameter範囲が `-30..30`。
- strengthが100%。

この場合、出力はおおよそ20になる。

strengthが50%なら10、130%なら26になる。

ユーザー向け意味:

- 動きが大きすぎる: strengthを下げる。
- 動きが小さすぎる: strengthを上げる。
- 逆に動く: invertを切り替える。
- 使いたくない: slotをdisableする。

Blinkは実装上 `Eye Open = 1 - blink` のような変換になるためsensitivityに近いが、UX上はまずStrengthで統一する。

## 9. Live Confirmation

Live ConfirmationはWave5/Wave6でsource/testレベル実装済みである。

Debug値だけでは、ユーザーは「モデルが使える状態になった」と判断できない。Stage上のモデルが実際に動くことが、Runtime Playerの中心体験である。

Live Confirmationで必要なこと:

- Tracking frameをruntime parameterへ反映する。
- Stage上のモデルがinputに追従して動く。
- Control Windowには小さく状態を出す。
- Stageにはdebug overlayを出さない。

Implementation facts:

- main receives UDP frames, updates input session state, and publishes latest mapped values at input frame receipt rather than only through throttled diagnostics.
- diagnostics remain Control UI/debug state and are not used as the Stage live-rate state path.
- Stage receives sanitized parameter values, coalesces latest frames on the render path, and evaluates runtime-core with authored parameter overrides.
- Stage does not receive raw tracking frames or render debug/setup UI.
- Wave6 Body Follow is also main-owned and emits only sanitized `parameterValues`. Stage receives no raw head position or debug body data.
- Existing profiles without head position calibration still drive face / eyes / mouth. Body Z's position component is skipped until head position calibration exists.

```text
Input receiving
Model loaded
Input profile ready
Mapping ready
Live active
```

## 10. Wave5 / Wave6 Implemented Scope

Wave名:

`Runtime Player Wave5: Tracking Setup & Live Mapping v0`

実装済み範囲:

- Runtime Export未ロードでもInput Checkできる現行UXを正としてdocs更新。
- Input Profileがない場合のCalibration導線。
- Input Profileの`userData/input-profiles/ifacialmocap/profiles.json`永続保存。
- `Look Forward`のsession neutral実装。
- Runtime Exportロード後のAuto Mapping。
- Head / blink / mouth / gazeの最低限のsemantic slot mapping。
- Slotごとのenabled / invert / strength。
- Tracking frameをruntime parameterへ反映し、StageでLive確認できる。
- Final integrationで、実装事実に合わせて関連screen docs / mapsを更新する。

Wave6実装済み範囲:

- 既存Input Profileへの任意`headPositionRaw` section追加。
- `Head position left/right` section readiness。
- `Run Missing Only`による不足sectionだけのキャリブレーション。
- head-position-only Calibrate/Recalibrate。
- Look Forward session neutralのhead position対応。
- Auto MappingのBody X/Z slots追加。既存9個のhead/eyes/mouth slotsは維持する。
- Body X: calibrated head horizontal由来の弱いlag付きfollow。
- Body Z: calibrated head tilt + optional calibrated head positionX合成。
- Body Follow controls: Body X strength/lag/invert、Body Z rotation strength/invert、position strength/invert、lag。
- Body outputs are emitted through sanitized live parameter frames and Stage remains model-only.

Future:

- Stage Motion。
- persistent profile management UIの完成版。
- persistent Model Mapping Profile save/read。
- curve / deadzone。
- TCP transport。
- multiple input sources。

## 11. Decided Items

- Input ProfileはElectron `userData`配下の`input-profiles/ifacialmocap/profiles.json`へ保存する。
- `Calibration range / learned signs`はInput Profileとして永続保存する。
- `Look Forward`はsession neutral offsetとして扱い、profileの永続neutralをただちに上書きしない。
- 次回Connect時は`activeProfileId`を読み、自動選択する。
- profileがない場合はCalibration導線を主導線にする。
- profile読み込み失敗時はtemporary defaultsへフォールバックし、Diagnosticsに警告を出す。
- `Use temporary defaults`はWave5 v0に含める。保存はしない。
- Gaze X/Yはv0ではeye Eulerを優先する。
- Model Mapping Profile永続保存はWave5 v0に含めない。
- Head position calibrationはInput Profileに含め、Runtime Export固有のModel Mapping Profileには含めない。
- Body Follow controlsはWave6ではsession-local mapping stateであり、まだ永続保存しない。
- Stage Motion、near/far distance response、Broadcast/OBS UX、Body Angle YはWave6に含めない。

## 12. Open Questions

- Model Mapping Profileの保存形式と保存場所。
- Runtime Export fingerprintを何で決めるか。
- Head rotationの軸符号は実機range dataで確定する。
- Dedicated Model / Stage / Diagnostics pagesをどのwaveで実体化するか。
- head-position Stage Motion、near/far distance response、Broadcast/OBS UXをどのwaveで扱うか。
