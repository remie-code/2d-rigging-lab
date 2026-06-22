# Initial Runtime Player Screen

> Runtime Playerを起動した時点から、Runtime Export未ロード、入力接続、モデルロード、Live確認へ進む画面体験。

## 1. Position

Runtime PlayerはEditorではない。

Runtime Playerの主責務は、Editorが生成したRuntime Export directoryを読み込み、tracking inputを受け取り、Clean Stage上で完成モデルをライブ表示することである。

現在の実装事実として、tracking inputの接続とdiagnostics確認はRuntime Exportに依存しない。ユーザーはRuntime Exportを開く前でもiFacialMocapへ接続し、受信状態を確認できる。

Wave5実装後は、Runtime Exportロード、Input Profileまたはtemporary defaults、Auto Mappingが揃うと、mainがsanitized runtime parameter frameをStageへ送り、Stageがruntime-core評価を通してモデルをLive更新する。

Wave6実装後は、既存Input Profileへhead position left/right calibrationを追加できる。Auto Mappingは既存のhead / eyes / mouth slotsを保ったままBody X/Z slotsを追加し、Body Follow v0の値も同じsanitized runtime parameter frameとしてStageへ届く。

この画面仕様では、Runtime Playerの体験を次の3つに分けて扱う。

- `Input Setup`: 入力ソースと通信できるかを確認する。モデル不要。
- `Model Runtime`: Runtime Exportを読み、Stageにモデルを表示する。
- `Tracking Setup / Mapping`: 入力をモデルparameterへ結びつけ、StageでLive確認する。モデル必要。

## 2. Core UX Principle

Runtime Playerの通常画面にParameter一覧を出さない。

理由:

- Runtime Playerはparameter editorではなく、tracking input consumerである。
- 実利用時の入力はiFacialMocapなどのtracking sourceであり、ユーザーが個別parameter sliderを操作するものではない。
- Parameter一覧はEditor ViewerやDebug toolの発想であり、配信/ライブ表示アプリの主画面に置くと責務が濁る。

Raw tracking frame、parsed blendshape table、normalized tracking frame、mapped runtime parameter valuesはDebug / Diagnostics panelに閉じる。

## 3. Window Model

Runtime Playerは、Control WindowとStage Windowを分ける。

```text
Control Window
  Runtime Export load
  Input source setup
  Connect / Disconnect
  Input calibration
  Model mapping / calibration
  Display / Stage controls
  Debug / Diagnostics

Stage Window
  transparent
  frameless or capture-friendly
  model only
  OBS capture target
```

Stage Windowは常に完成モデル表示用であり、Editor由来のoverlay、Parameter一覧、Debug情報を載せない。

## 4. Startup State: No Runtime Export Loaded

アプリ起動直後、Runtime Exportが読み込まれていない状態。

現行実装ではControl WindowとStage Windowの両方が生成される。Stage Windowはtransparentで、Runtime Export未ロード時はモデルを描画しない。

Control WindowにはRuntime Export loadだけでなく、Input Source sectionも表示される。これは正しい体験として扱う。

```text
Control Window
┌────────────────────────────────────────────┐
│ Runtime Player                             │
├────────────────────────────────────────────┤
│ Open Runtime Export                        │
│ [ Open Runtime Export ]                    │
│                                            │
│ Runtime Export Status                      │
│ Loaded: No                                 │
│                                            │
│ Input Source                               │
│ Source: iFacialMocap                       │
│ Transport: UDP                             │
│ Receive Port: 49983                        │
│ Local IP: 192.168.x.x                      │
│ [ Connect ]                                │
│                                            │
│ Calibration                                │
│ Not available / placeholder until input    │
│                                            │
│ Debug / Diagnostics                        │
│ collapsed                                  │
└────────────────────────────────────────────┘

Stage Window
  transparent
  no model yet
```

Required UI:

- App title: `Runtime Player`。
- Primary model action: `Open Runtime Export`。
- Input Source section:
  - `iFacialMocap`。
  - `UDP`。
  - receive port。
  - local IP candidates。
  - optional iPhone IP。
  - `Connect` / `Disconnect`。
- Debug / Diagnostics panel:
  - collapsed by default。
  - receiving時にraw / parsed / normalized diagnosticsを確認できる。

Do not show:

- Runtime parameter sliders。
- Mesh / Deformer / Part tree。
- Editor validation details。
- Stage上のdebug overlay。

## 5. Input Connected Before Runtime Export

Runtime Export未ロードでも、Input Sourceは接続できる。

```text
Control Window
┌────────────────────────────────────────────┐
│ Runtime Export                             │
│ Loaded: No                                 │
│                                            │
│ Input Source                               │
│ iFacialMocap / UDP                         │
│ Receiving: 59 fps                          │
│ Last packet: 11 ms                         │
│ Remote: 192.168.x.x:xxxxx                  │
│ [ Disconnect ]                             │
│                                            │
│ Debug / Diagnostics                        │
│ raw frame / parsed frame / normalized      │
└────────────────────────────────────────────┘

Stage Window
  transparent
  no model yet
```

この状態でユーザーが得るべき体験は、「入力機器と通信できている」という確信である。モデルがまだ開かれていないため、Stage上のLive motionはない。

Input接続はRuntime Exportロードと独立して継続する。

## 6. Runtime Export Loaded

Runtime Exportを開いた後の状態。

```text
Control Window
┌────────────────────────────────────────────┐
│ Runtime Export                             │
│ Loaded: sample.runtime-export              │
│ [ Open Different Export ]                  │
│                                            │
│ Input Source                               │
│ Connected or ready                         │
│                                            │
│ Tracking Setup / Mapping                   │
│ Auto mapping status                        │
│ Look Forward                               │
│ Live readiness                             │
└────────────────────────────────────────────┘

Stage Window
┌────────────────────────────────────────────┐
│                                            │
│             evaluated default pose         │
│          transparent background            │
│                                            │
└────────────────────────────────────────────┘
```

Runtime Exportロード後、Stageはruntime-coreで評価されたdefault poseを表示する。

Input Profileまたはtemporary defaultsとAuto Mappingが揃うと、tracking frameはruntime parameter valuesへ変換され、Stage上のモデルへLive適用される。

## 7. Live State: Tracking Applied To Model

Tracking mappingが有効になった後のWave6実装状態。

```text
Control Window
┌────────────────────────────────────────────┐
│ Input                                      │
│ Receiving: 59 fps                          │
│ [ Look Forward ] [ Disconnect ]            │
│                                            │
│ Model Mapping                              │
│ Auto mapped semantic slots                 │
│ Body Follow                                │
│ Ready when Body X/Z targets exist          │
│ Live active                                │
│ [ Edit Mapping ]                           │
│                                            │
│ Stage                                      │
│ Transparent: On                            │
│ [ Focus Stage ] [ Reset Stage View ]       │
└────────────────────────────────────────────┘

Stage Window
  live tracked model
  transparent background
  no setup/debug UI
```

Source/test evidence:

- Main owns input session, profile/calibration, model mapping, and sanitized live parameter frame production.
- Stage receives only Runtime Export identity and `parameterValues`; raw tracking frame、blendshapes、diagnosticsは受け取らない。
- Stage evaluates the loaded Runtime Export through runtime-core with authored parameter overrides and renders only the canvas.
- Wave6 adds Body X/Z output to the same sanitized live parameter frame path. Stage still receives no raw head position or debug body data.
- Existing profiles without head position calibration remain usable for face / eyes / mouth live mapping; Body Z's position component is skipped until head position calibration exists.

Manual verification remaining:

- Real iFacialMocap inputが、実Runtime Exportモデルをclean Stage上で動かすこと。
- Body Angle X/Z keyformsを持つ実Runtime Exportで、Body Follow v0がclean Stage上で自然に見えること。
- Runtime Export reload/clear後にstale live poseが残らないこと。

Live stateでユーザーが頻繁に使う操作:

- `Look Forward`。
- Connect / Disconnect。
- Reset simulation / Reset physics。
- Focus Stage。
- Reset Stage View。
- Hide Control Window。

Live stateで表示してよいstatus:

- Connected / Connecting / Disconnected。
- Receiving / stale / no packet。
- FPS。
- Last packet age。
- Mapping ready / Live active。

ただしstatusはControl Windowで小さく扱う。主役は常にStage Windowのモデル表示である。

## 8. Resolved Decisions

- Runtime Export loadとInput Source connectionは独立した機能として扱う。
- Runtime Export未ロードでもiFacialMocapへConnectできる。
- Input接続前後のdiagnosticsはControl Windowで確認できる。
- Stage WindowはRuntime Export未ロード時には空のtransparent stageとして扱う。
- Stage Windowにはsetup/debug UIを載せない。
- Model motion確認はStageで行い、Parameter slidersはRuntime Playerの通常UXに出さない。
- Debug / DiagnosticsはControl Window内の補助層として残す。
- Control WindowのWave5 navは `Overview` / `Input` / `Mapping` のみ。
- Input ProfileはElectron `userData`配下へ保存する。
- `Look Forward`はsession neutralであり、profile永続neutralを即時上書きしない。
- Auto Mapping v0は標準parameter名とinput manifestを使い、computed/dynamics-owned/hidden/internal targetを直接出力先にしない。
- Persistent Model Mapping Profile saveはWave5では未実装。
- Wave6ではInput Profileにhead position left/right calibration sectionを追加し、missing-only / head-position-only recalibrationを実装済み。
- Wave6ではAuto MappingにBody X/Z slotsを追加し、Body Follow v0をmain-owned sanitized runtime parameter frameとしてStageへ反映する。
- Stage Motion、near/far distance response、Broadcast/OBS UX、Body Angle Y、persistent Model Mapping Profile saveはWave6では未実装。

## 9. Remaining Open Questions

- 前回Runtime Export自動復元をいつ実装するか。
- Model Mapping Profileの保存場所とRuntime Export fingerprintの扱い。
- Stage Windowの位置・サイズ・always-on-top・クリック透過をどこまでv0で扱うか。
- head position由来のStage Motion、near/far distance response、Broadcast/OBS UXをどのwaveで扱うか。
- Dedicated Model / Stage / Diagnostics pagesをどのwaveで実体化するか。
