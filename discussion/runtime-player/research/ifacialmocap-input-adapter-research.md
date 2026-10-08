# iFacialMocap Input Adapter Research

> Runtime Player / Capture Host v0でiFacialMocapをtracking input adapterとして扱えるかの初期調査。

## 1. Position

Runtime Playerは、Editorが生成したRuntime Export directoryを読み込み、tracking inputを受け取ってモデルをライブ表示するEditor外の別アプリである。

この調査では、Runtime Playerが自前face trackingを実装する代わりに、iFacialMocapからtracking dataを受信できるかを確認する。

## 2. Conclusion

iFacialMocap連携はRuntime Player v0の入力ソースとして有力である。

ただし、browser-only appとして実装するのは適さない。iFacialMocapの主要な直接受信経路はUDP/TCPであり、任意portをbindして生UDP/TCPを受けるにはElectron/Node、Tauri/Rust、またはnative hostが必要になる。

推奨方針:

- Runtime Playerはdesktop host appとして検討する。
- v0はiFacialMocap独自UDP/TCP adapterを第一候補にする。
- 将来の入力ソース切り替えに備え、`TrackingInputAdapter`境界を設ける。
- iFacialMocap adapterは受信/parseまでを担当し、Runtime parameterへの割当は別のmapping/calibration層に分ける。

## 3. Confirmed Facts

### 3.1 Official iFacialMocap Protocol

iFacialMocapは、サードパーティ開発者が公式PC softwareを介さず、UDPまたはTCP/IPで顔データを受信できる仕様を公開している。

Source:

- [iFacialMocap communication specifications](https://www.ifacialmocap.com/for-developer/)

公式仕様に基づく要点:

- UDP receive:
  - PC側からiOS側port `49983` へ開始文字列を送る。
  - iFacialMocapはUDPでPC側port `49983` へおおむね60 FPSで文字列frameを返す。
- TCP/IP receive:
  - PC側からiOS側port `49983` へTCP開始要求をUDP送信する。
  - iOS側からPC側port `49986` へTCPでframeが送られる。
  - TCP frame末尾にはframe delimiterとして `___iFacialMocap` が付く。
- `sendDataVersion=v2` を指定すると、BlendShape名と値のdelimiterを `-` ではなく `&` にできる。

### 3.2 Frame Content

公式developer pageの例では、1 frameは概ね次のような内容を持つ。

```text
BlendShapeName-value|BlendShapeName-value|...|=head#rotX,rotY,rotZ,posX,posY,posZ|rightEye#rotX,rotY,rotZ|leftEye#rotX,rotY,rotZ|
```

確認できた仕様:

- BlendShape parameterは `0..100`。
- angle-related dataはdegree。
- headにはEuler anglesとposition valuesが含まれる。
- rightEye / leftEyeにはEuler anglesが含まれる。

### 3.3 App Store / Product Position

App Store説明では、iFacialMocapはiOS appで顔表情をcaptureし、PC上の3DCG softwareへreal time communicationするものとして説明されている。

Source:

- [iFacialMocap - App Store](https://apps.apple.com/us/app/ifacialmocap/id1489470545)
- [iFacialMocap official site](https://www.ifacialmocap.com/)

確認できた要点:

- iOS appでfacial expressionsをcaptureする。
- Maya、Unity、Blender、3dsMax、Unreal Engineなどとのreal time連携を想定している。
- FaceID搭載または対応条件を満たすiOS deviceが必要になる。
- App Storeのversion historyではport変更、長時間streaming、Bluetooth fallbackなど接続周りの更新履歴がある。

### 3.4 VMC Protocol

iFacialMocap公式は、Microsoft Store版iFacialMocapがVMC Protocolの送受信をサポートすると説明している。

Source:

- [iFacialMocap VMC Protocol](https://www.ifacialmocap.com/tutorial/vmc-protocol/)
- [VirtualMotionCaptureProtocol Reference](https://protocol.vmc.info/Reference.html)

確認できた要点:

- VMC Protocolは、Virtual Motion Capture由来のOSC-based protocolとして広く利用されている。
- iFacialMocapは顔周辺の表情・動きに特化しており、VMCの全身bone用途とは異なる。
- 公式iFacialMocap文書は、desktop版のVMC送信ではbone positionがconstant zeroになる可能性に触れている。

設計上の扱い:

- VMC/OSCは将来adapter候補として有用。
- v0の最短経路は、公式developer pageにあるiFacialMocap独自UDP/TCP frameを直接受けるadapterでよい。

### 3.5 Warudo Integration Evidence

Warudo documentationは、iFacialMocap / FaceMotion3DをARKit-based face tracking sourceとして扱っている。

Source:

- [Warudo Handbook: iFacialMocap / FaceMotion3D](https://docs.warudo.app/docs/mocap/ifacialmocap)
- [Warudo Handbook: Motion Capture Overview](https://docs.warudo.app/docs/mocap/overview)

確認できた要点:

- WarudoはiFacialMocap / FaceMotion3Dについて、52 ARKit blendshapes、head rotation、head translationをtrackすると説明している。
- SetupではiFacialMocap app側にPCのDestination IP addressを入れる。
- Calibrationは、ユーザーが正面を向いて頭を静止した状態で行う。
- 接続トラブルとして、port、IP、same Wi-Fi、firewall、private network、iOS permission、camera occupationなどが挙げられている。

## 4. Browser vs Desktop Host

### 4.1 Browser-only Is Not Enough

Runtime Playerを通常browser appとして作る場合、iFacialMocap独自UDP/TCPを直接受信するのは難しい。

理由:

- browser Web APIは任意UDP portをbindしてdatagramを受信する用途に向いていない。
- WebTransportはHTTP/3 serverとの通信APIであり、iFacialMocapの生UDP/TCP frame受信とは別物である。

Source:

- [MDN WebTransport API](https://developer.mozilla.org/en-US/docs/Web/API/WebTransport_API)

### 4.2 Electron / Node Is Viable

Electron/Node構成なら、NodeのUDP/TCP socketを使ってiFacialMocap frameを受信できる。

Source:

- [Node.js dgram](https://nodejs.org/api/dgram.html)

設計イメージ:

```text
Node main process
  UDP/TCP socket receive
  parse iFacialMocap frame
  normalize TrackingFrame
  IPC
Renderer process
  parameter mapping
  runtime render
```

### 4.3 Tauri / Native Host Is Also Viable

Tauri/Rustまたはnative hostでも、native sideでUDP/TCPを受信し、WebViewへIPCで渡す構成が取れる。

この場合の評価軸:

- UDP/TCP実装の安定性。
- transparent window / OBS captureとの相性。
- packaging負荷。
- existing repo stackとの相性。

## 5. Suggested Runtime Player Architecture

Runtime Playerの入力境界は、特定アプリ名ではなくtracking input adapterとして設計する。

```text
iFacialMocap UDP/TCP
  -> iFacialMocapInputAdapter
  -> Normalized TrackingFrame
  -> Parameter Mapping / Calibration
  -> Runtime Parameters
  -> Runtime Player render + dynamics
```

### 5.1 TrackingInputAdapter Contract

最初の抽象としては、次の責務を持てばよい。

- `configure(config)`
- `start()`
- `stop()`
- `calibrate()` または `lookForward()`
- `onFrame(frame)`
- `onStatus(status)`
- `onError(error)`

### 5.2 Normalized TrackingFrame

推奨するnormalized frame:

```ts
type TrackingFrame = {
  source: "ifacialmocap";
  timestampMs: number;
  sequence?: number;
  blendshapes: Record<string, number>; // normalized 0..1
  head: {
    rotationEulerDeg: { x: number; y: number; z: number };
    positionRaw?: { x: number; y: number; z: number };
  };
  eyes?: {
    leftEulerDeg?: { x: number; y: number; z: number };
    rightEulerDeg?: { x: number; y: number; z: number };
  };
  status: {
    connected: boolean;
    faceTracked?: boolean;
    fps?: number;
    lastPacketAgeMs?: number;
  };
  debug?: {
    rawFrame?: string;
    transport?: "udp" | "tcp";
  };
};
```

注意:

- `blendshapes` はadapterではARKit名を保持し、model parameterへの変換はmapping層へ渡す。
- `head.positionRaw` は単位・座標系が未確認なので、v0ではraw扱いにする。
- `rawFrame` はDebug表示用で、通常UXでは見せない。

### 5.3 Mapping Layer

iFacialMocapの入力値を直接Runtime parameterに書き込むのではなく、mapping layerを挟む。

理由:

- Runtime Exportのparameter名はEditor側presetとユーザー定義に依存する。
- iFacialMocapはARKit系blendshape名とhead/eye transformを送る。
- calibration、反転、scale、dead zone、smoothing、lost tracking時の挙動をadapterから分離できる。

## 6. Runtime Player UX Implications

### 6.1 Main UX

Runtime Playerの主画面はparameter editorではない。

主役:

- Runtime Exportを読み込む。
- tracking inputへ接続する。
- calibrationする。
- Clean Stageでライブ表示する。
- UIを隠してstage-only表示できる。

### 6.2 Setup UI

iFacialMocap v0で必要になるSetup項目:

- input source selector: `iFacialMocap`
- transport: `UDP` / `TCP`
- receive port: default `49983`
- TCP receive port: default `49986`
- PC/local IP display
- iPhone/app setup instructions
- connect / disconnect
- connection status
- FPS / last packet age
- calibrate / look forward
- reset simulation
- hidden debug:
  - raw frame
  - parsed blendshape table
  - head / eye values

### 6.3 Normal UI Should Not Show Parameters

Runtime Playerはライブ表示アプリであり、通常画面にparameter一覧を並べるべきではない。

parameterやraw inputはDebug / Developer panelに閉じる。

## 7. Design Decisions To Carry Forward

- Runtime PlayerはEditor外の追加アプリである。
- Runtime Playerはface tracking engineではなくtracking input consumerである。
- v0の入力候補はiFacialMocap。
- 将来の入力ソース切り替えに備え、adapter boundaryを初期から設計する。
- iFacialMocap adapterは公式独自UDP/TCP protocolを本命にする。
- VMC/OSCは将来adapter候補として扱う。
- browser-only implementationは避け、desktop host appを前提にする。

## 8. Unknowns / Experiment Targets

実機確認が必要な項目:

- 現行iOS版iFacialMocapで、PCからのhandshakeが必須か、Destination IP設定だけで送信開始するか。
- `head` position valuesの単位。
- head/eye Euler axisの向きと符号。
- BlendShape値の実レンジ、欠損時の表現、face lost時のframe内容。
- UDPとTCPの遅延・drop・安定性差。
- 長時間運用時のFPS、発熱、connection recovery。
- iFacialMocapのLook Forward commandが現行版で期待通り効くか。
- Runtime Export側にARKit 52 blendshapeからproject parameterへのmapping情報をどこまで持たせるべきか。

## 9. Source Links

- [iFacialMocap official site](https://www.ifacialmocap.com/)
- [iFacialMocap communication specifications](https://www.ifacialmocap.com/for-developer/)
- [iFacialMocap App Store](https://apps.apple.com/us/app/ifacialmocap/id1489470545)
- [iFacialMocap Download](https://www.ifacialmocap.com/download/)
- [iFacialMocap VMC Protocol](https://www.ifacialmocap.com/tutorial/vmc-protocol/)
- [VirtualMotionCaptureProtocol Reference](https://protocol.vmc.info/Reference.html)
- [Warudo Handbook: iFacialMocap / FaceMotion3D](https://docs.warudo.app/docs/mocap/ifacialmocap)
- [Warudo Handbook: Motion Capture Overview](https://docs.warudo.app/docs/mocap/overview)
- [MDN WebTransport API](https://developer.mozilla.org/en-US/docs/Web/API/WebTransport_API)
- [Node.js dgram](https://nodejs.org/api/dgram.html)
