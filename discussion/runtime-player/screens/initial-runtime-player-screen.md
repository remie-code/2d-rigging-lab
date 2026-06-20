# Initial Runtime Player Screen

> Runtime Playerをユーザーが起動したときに最初に目にする画面と、モデルロード直後の基本画面。

## 1. Position

Runtime PlayerはEditorではない。

Runtime Playerの主責務は、Editorが生成したRuntime Export directoryを読み込み、tracking inputを受け取り、Clean Stage上で完成モデルをライブ表示することである。

したがって、ユーザーが最初に見るべきものはauthoring controlsではなく、次の2つである。

- モデルを開くための最小導線。
- モデルが開かれた後、ライブ表示を開始するためのSetup導線。

## 2. Core UX Principle

Runtime Playerの通常画面にParameter一覧を出さない。

理由:

- Runtime Playerはparameter editorではなく、tracking input consumerである。
- 実利用時の入力はiFacialMocapなどのtracking sourceであり、ユーザーが個別parameter sliderを操作するものではない。
- Parameter一覧はEditor ViewerやDebug toolの発想であり、配信/ライブ表示アプリの主画面に置くと責務が濁る。

Parameter、raw tracking frame、parsed blendshape tableはDebug / Developer panelに閉じる。

## 3. Window Model

Runtime Playerは、Control WindowとStage Windowを分ける。

```text
Control Window
  Open Runtime Export
  Input source setup
  Connect / Disconnect
  Calibration
  Display / Stage controls
  Debug drawer

Stage Window
  transparent
  frameless or capture-friendly
  model only
  OBS capture target
```

この分離をv0の基本UXにする。

理由:

- 配信時にSetup UIが映り込む事故を避けられる。
- ユーザーにとって「OBSにはStage Windowを取らせる」が明確になる。
- Runtime Playerの主責務であるライブ表示と、設定・接続・調整の操作を分離できる。
- Stage-onlyは同一windowの一時modeではなく、Stage Windowそのものの責務として扱える。

Stage Windowは常に完成モデル表示用であり、Editor由来のoverlay、Parameter一覧、Debug情報を載せない。

## 4. Startup State: No Runtime Export Loaded

アプリ起動直後、Runtime Exportが読み込まれていない場合の画面。

この状態ではControl Windowだけでよい。Stage WindowはRuntime Exportが読み込まれるまで開かない、または空のtransparent stageとして目立たない状態にする。

```text
Control Window
┌────────────────────────────────────────────┐
│ Runtime Player                    Settings │
├────────────────────────────────────────────┤
│                                            │
│              Open Runtime Export           │
│       Select a .runtime-export directory   │
│                                            │
│             [ Open Runtime Export ]        │
│                                            │
│ Previous export will restore automatically │
│ when available.                            │
│                                            │
└────────────────────────────────────────────┘
```

Required UI:

- App title: `Runtime Player`。
- Primary action: `Open Runtime Export`。
- Runtime Export directoryを読むことが分かる短い補助文。
- Settings entry。v0では空または最小でもよいが、将来のinput source / display設定の入口として席を持つ。
- 前回Runtime Exportがあれば自動復元する。ユーザーが毎回directoryを選び直すUXにはしない。

Optional / future:

- Recent Runtime Exports。
- Drag-and-drop directory open。

Do not show:

- Parameter list。
- iFacialMocap connection controls。
- Texture Atlas details。
- Mesh / Deformer / Diagnostics。

理由:

- モデルがない状態でtracking setupを見せても、ユーザーは何を接続してよいか判断しにくい。
- 初回画面は「何を開くアプリなのか」を明確にするだけでよい。
- Recent exportsは「最近開いたRuntime Export directoryの履歴一覧」を意味する。v0では履歴一覧より前回Runtime Exportの自動復元を優先し、recent listは将来拡張に留める。

## 5. Startup State: Previous Runtime Export Restored

前回Runtime Exportが存在する場合、起動時に自動復元する。

```text
Control Window
┌────────────────────────────────────────────┐
│ Runtime Player          sample.runtime     │
├────────────────────────────────────────────┤
│ Runtime Export                             │
│ Loaded: sample.runtime-export              │
│ [ Open Different Export ]                  │
│                                            │
│ Input Source                               │
│ iFacialMocap                               │
│ [ Connect ]                                │
└────────────────────────────────────────────┘

Stage Window
┌────────────────────────────────────────────┐
│                                            │
│             model neutral pose             │
│          transparent background            │
│                                            │
└────────────────────────────────────────────┘
```

Required:

- 前回Runtime Exportを自動loadする。
- Stage Windowをtransparentで開き、neutral poseを表示する。
- Control Windowにはload statusとinput setupを表示する。
- `Open Different Export` で別Runtime Exportへ切り替えられる。

Do not:

- 自動復元に失敗した場合にfatalにしない。Control WindowでOpen Runtime Exportへ戻す。
- recent listを主導線にしない。

## 6. Loaded State: Model Loaded, Input Not Connected

Runtime Exportを開いた直後の画面。

```text
Control Window
┌────────────────────────────────────────────┐
│ Runtime Player          sample.runtime     │
├────────────────────────────────────────────┤
│ Runtime Export                             │
│ Loaded                                     │
│ [ Open Different Export ]                  │
│                                            │
│ Input Source                               │
│ [ iFacialMocap v ]                         │
│ Transport: [ UDP v ]                       │
│ Receive Port: [ 49983 ]                    │
│ Local IP: 192.168.x.x                      │
│ [ Connect ]                                │
│                                            │
│ Calibration                                │
│ [ Look Forward ]                           │
│                                            │
│ Stage                                      │
│ Transparent: On                            │
│ [ Focus Stage ] [ Reset Stage Position ]   │
└────────────────────────────────────────────┘

Stage Window
┌────────────────────────────────────────────┐
│                                            │
│              model neutral pose            │
│            transparent background          │
│                                            │
└────────────────────────────────────────────┘
```

主役はStage Windowである。

Control Windowは、モデルロード後に「入力ソースに接続する」「calibrationする」「表示状態を整える」操作を行う場所である。

Required UI:

- Stage Window:
  - model neutral poseを表示する。
  - tracking未接続でもモデルが読み込めたことを視覚的に示す。
  - transparent backgroundをv0必須にする。
  - OBS capture targetとして使えるよう、モデル以外のUIを出さない。
- Control Window:
  - Runtime Export status。
  - Input source selector。
  - iFacialMocap connection settings。
  - Connect / Disconnect。
  - Calibration / Look Forward。
  - Display settings。
  - Stage Window focus / position reset。

Do not show by default:

- Runtime parameter sliders。
- Mesh overlay。
- Deformer handles。
- Part tree。
- Atlas placement details。
- Validation details。
- Raw tracking frame。

## 7. Live State: Tracking Connected

iFacialMocapなどのtracking inputからframeを受け取っている状態。

```text
Control Window
┌────────────────────────────────────────────┐
│ Runtime Player       Live   60 fps         │
├────────────────────────────────────────────┤
│ Input                                      │
│ Connected                                  │
│ Last packet: 12 ms                         │
│ [ Disconnect ]                             │
│                                            │
│ [ Calibrate ] [ Reset Physics ]            │
│                                            │
│ Stage                                      │
│ Transparent: On                            │
│ [ Focus Stage ] [ Hide Control Window ]    │
└────────────────────────────────────────────┘

Stage Window
┌────────────────────────────────────────────┐
│                                            │
│            live tracked model              │
│           transparent background           │
│                                            │
└────────────────────────────────────────────┘
```

Live stateでユーザーが頻繁に使う操作:

- Calibrate / Look Forward。
- Reset simulation / Reset physics。
- Pause / Resume tracking。
- Focus Stage。
- Hide Control Window。
- Background preview切替。

Live stateで表示してよいstatus:

- Connected / Connecting / Disconnected。
- Face tracked / Tracking lost。
- FPS。
- Last packet age。

ただしstatusはControl Windowで小さく扱う。主役は常にStage Windowのモデル表示である。

## 8. Stage Window / OBS-oriented Display

Runtime Playerは、将来的にOBSなどでStageだけを取り込む利用を想定する。

v0から次を必須とする。

- Stage WindowとControl Windowを分ける。
- Stage Windowはtransparent backgroundを扱う。
- Stage WindowにはEditor由来のoverlayを載せない。
- Stage WindowにはSetup UI、Debug UI、Parameter一覧を載せない。
- Control WindowからStage Windowをfocus / resetできる。

checker / solid backgroundは確認用previewとして持ってよい。ただし配信/OBS取り込みの本命はtransparent Stage Windowである。

同一windowでUIを隠すだけのStage-only modeはv0の主方針にしない。必要になれば将来のfallbackとして検討する。

## 9. Input Source Setup

v0の本命input sourceはiFacialMocapである。

Control Windowで扱う項目:

- Input source: `iFacialMocap`。
- Transport: `UDP` / `TCP`。
- Receive port:
  - UDP default: `49983`。
  - TCP default: `49986`。
- Local PC IP display。
- iPhone側Destination IP設定の短い案内。
- Connect / Disconnect。
- Calibration / Look Forward。
- Status:
  - receiving / no packet / stale。
  - fps。
  - last packet age。
- Debug drawer:
  - raw frame。
  - parsed blendshape table。
  - mapped parameter values。

将来input sourceが増えても、Control Window内のInput Source sectionは同じ構造を維持する。

```text
Input Source
  [ iFacialMocap v ]
  Transport: [ UDP v ]
  Receive Port: [ 49983 ]
  Local IP: 192.168.x.x
  [ Connect ]
```

### 9.1 Connect Behavior

ユーザーにiFacialMocap handshakeを意識させない。

`Connect`ボタンの責務:

1. PC側の受信portを開く。
2. passive listenを開始する。
3. iPhone IPが設定済みなら、iOS側へ開始handshakeを送る。
4. Control WindowにPC/local IPとiPhone側Destination IP設定手順を表示する。
5. packetを受信したらConnectedにする。

方針:

- ユーザー操作はできるだけ`Connect`に集約する。
- iPhone IPが未設定でもpassive listenは開始する。
- iPhone側Destination IP設定が必要な場合は、Control Windowで分かるように案内する。
- handshake送信を自動実行するか、どのタイミングで送るかは実機確認で詰める。
- 前回のiFacialMocap設定は復元する。

## 10. Debug Panel

Debug panelは通常閉じる。

Debugに入れてよいもの:

- raw iFacialMocap frame。
- parsed blendshape list。
- head / eye raw values。
- normalized tracking frame。
- mapped runtime parameter values。
- packet log。

Debugに入れる理由:

- 接続トラブルやmapping調整には必要。
- ただし通常ユーザーのLive表示体験には不要で、常時表示するとRuntime Playerの責務がぶれる。

## 11. What The First Screen Must Communicate

起動直後の画面が伝えるべきこと:

- このアプリはRuntime Exportを開く。
- このアプリはモデルをライブ表示する。
- このアプリはEditorではない。

モデルロード後の画面が伝えるべきこと:

- モデルは読み込めている。
- 次にinput sourceへ接続すればライブ表示できる。
- calibrationとdisplay調整だけ行えばよい。
- 配信/OBSにはStage Windowを使えばよい。

## 12. Resolved Decisions

- Recent exportsは最近開いたRuntime Export directoryの履歴一覧を指す。v0では履歴一覧より前回Runtime Exportの自動復元を優先し、recent listはfuture扱いにする。
- Startup時は前回Runtime Exportを自動復元する。
- Setup UIは右固定panel / drawer / modalではなく、Control Windowに置く。
- 配信用の表示は別Stage Windowに分離する。
- Stage Windowはtransparent backgroundをv0で扱う。
- Stage-onlyは同一windowのUI非表示modeではなく、Stage Windowの責務として扱う。
- iFacialMocap connection setupでは、ユーザーにhandshakeを意識させず、Connect操作に受信開始・可能ならhandshake送信・接続状態判定を集約する。

## 13. Remaining Open Questions

- Stage Windowを常時別windowとして開くか、モデルload後に開くか。
- Stage Windowの位置・サイズ・always-on-top・クリック透過をv0でどこまで扱うか。
- iFacialMocap handshake送信に必要なiPhone IP入力を必須にするか、passive listen中心にするか。
- 前回Runtime Export復元失敗時のUI文言。
- Transparent Window実装のapp stack制約。
