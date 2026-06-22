# Runtime Player Backlog

> Runtime Playerで後から実行すべきタスク、延期されたリスク、将来wave候補の一覧。

## 1. Purpose

この文書は、Runtime Playerの実装中に発見されたが、現在waveでは扱わないと決めた作業を失わないためのbacklogである。

各項目は、次のplanning-gateでそのまま判断材料にできる粒度で書く。

## 2. Status Values

| Status | Meaning |
|---|---|
| Deferred | 意図的に後回しにしている |
| Planned | 次waveまたは近いwaveで扱う予定 |
| In progress | 現在実装中 |
| Done | 完了済み |
| Superseded | 別方針に置き換わった |

## 3. Backlog Items

### 3.1 Package Build Artifact Exports Migration

- Status: Deferred
- Kind: Architecture debt
- Priority: Medium before packaging, high before distribution

Problem:

- 現在のworkspace packagesは、開発中monorepoとしてTypeScript sourceを直接exportsしている。
- Runtime Player Wave2では、短期対応としてElectron main/preloadで使うworkspace packagesをbundleに含める方針にした。
- これは開発中の短期対応として妥当だが、長期的には配布アプリや外部consumerがNode/Electron runtimeで直接使えるpackage形態ではない。

Trigger:

- Runtime Player packaging/distribution workを始める。
- Runtime Playerのworkspace package bundling例外が増える。
- Runtime Player以外の外部app/CLIが `packages/**` をruntime dependencyとして使い始める。
- CIでsource workspace linkではなくbuild artifactからRuntime Playerを検証したくなる。

Desired outcome:

- `packages/package-format`, `packages/contracts`, `packages/runtime-core`, `packages/render-core`, `packages/render-webgl2` などが `dist/index.js` と `dist/index.d.ts` を生成する。
- package exportsがbuild済みJSと型定義を指す。
- Electron appがworkspace packagesをexternalizeしても、Nodeがbuild済みJSを解決できる。

Source:

- [../architecture/workspace-package-bundling-decision.md](../architecture/workspace-package-bundling-decision.md)

Suggested next action:

- 専用のpackage build/export migration waveとしてplanning-gateにかける。
- Runtime Player app側のbundling exceptionを増やす前に、build pipelineとexports方針を検討する。

### 3.2 Real Runtime Export Visual Verification

- Status: Deferred
- Kind: Runtime verification
- Priority: High before input adapter work depends on visual confidence

Problem:

- Runtime Player Wave2はstatic Stage renderを実装したが、実物Runtime ExportでのGUI screenshot/pixel smokeは未実施。
- 子エージェント側のunit/typecheckは通っているが、透明Stage上での見え方、alpha edge、clipping/masksの実視覚確認はユーザー操作に依存している。

Trigger:

- Wave2実装後に実物Runtime ExportをPlayerで開く。
- 次のinput adapter / parameter mapping / dynamics runtimeへ進む前。

Desired outcome:

- Stageにモデルだけが表示される。
- 背景がtransparent/capture-friendlyである。
- alpha edgeが不自然でない。
- clipping/masksがEditor/Viewerに近い見え方をする。
- invalid directoryを開いた時、Controlにerrorが出てStageが安全状態になる。

Source:

- [../implementation/waves/wave2/runtime-player-wave2-final-integration-report.md](../implementation/waves/wave2/runtime-player-wave2-final-integration-report.md)

Suggested next action:

- ユーザーの実物Runtime Exportでmanual checklistを実行する。
- 問題が出たら、Runtime Player Wave2 follow-upとして狭い修正waveを切る。

### 3.3 Large Raw RGBA IPC Payload Measurement

- Status: Deferred
- Kind: Runtime verification
- Priority: Medium

Problem:

- Runtime Export textureはraw RGBA8で、single page atlasでも大きなbyte payloadになり得る。
- Wave2ではmain processからStageへloaded payloadを渡すが、大きなRuntime ExportでIPC転送負荷をまだ計測していない。

Trigger:

- 実物モデルでloadが重い、Stage表示までに長い停止がある、または将来複数texture pageを扱う必要が出る。
- Runtime Playerのruntime loopやinput adapterを入れる前に、load時のUXを安定させたい。

Desired outcome:

- 代表的なRuntime Exportでload時間、IPC payload size、Stage表示開始までの時間を記録する。
- 必要ならraw bytesの転送方法を見直す。

Source:

- [../implementation/waves/wave2/runtime-player-wave2-final-integration-report.md](../implementation/waves/wave2/runtime-player-wave2-final-integration-report.md)

Suggested next action:

- 実物Runtime Exportでload timing logを追加するか、manual measurementを行う。
- 問題がある場合は、main/Stage間のtexture bytes delivery設計を再検討する。

### 3.4 Stage Window Platform Behavior

- Status: Deferred
- Kind: Platform risk
- Priority: Medium

Problem:

- Stage Windowはtransparent/capture-friendlyである必要がある。
- Electronのtransparent/frameless windowやOBS capture behaviorはOSやGPU環境の差分を受ける。
- Wave1/Wave2では実window表示の基本確認はできたが、OBS連携やOS差分は未検証。

Trigger:

- Playerを配信・収録用途で使い始める。
- Stage Windowのposition / size / always-on-top / click-throughを実装する。
- packaging/distribution前。

Desired outcome:

- 対象OSでStageが透明背景としてcaptureできる。
- captureに不要なUIが入らない。
- always-on-top / click-through / window placementの仕様を決める。

Source:

- [../architecture/technology-stack-decision.md](../architecture/technology-stack-decision.md)
- [../implementation/waves/wave2/runtime-player-wave2-final-integration-report.md](../implementation/waves/wave2/runtime-player-wave2-final-integration-report.md)

Suggested next action:

- Stage Window behavior waveを切る前に、対象OSとOBS capture要件を整理する。

### 3.5 iFacialMocap Input Adapter And Parameter Mapping

- Status: Deferred
- Kind: Future UX / feature
- Priority: High after static render is visually accepted

Problem:

- Runtime Playerの主目的は、Editorが出したRuntime Exportをtracking inputで動かすこと。
- Wave2はstatic renderまでで、iFacialMocap受信、normalized tracking frame、parameter mapping、calibrationは未実装。

Trigger:

- Runtime Export static renderが実物確認で許容できる。
- 次に「顔・頭・目・口の入力でモデルが動く」UXへ進む。

Desired outcome:

- iFacialMocapからtracking frameを受信する。
- adapter境界でnormalized frameへ変換する。
- normalized frameをRuntime Export内parameterへmappingする。
- Control Windowで接続状態とcalibrationを扱う。

Source:

- [../research/ifacialmocap-input-adapter-research.md](../research/ifacialmocap-input-adapter-research.md)
- [../architecture/runtime-player-development-policy.md](../architecture/runtime-player-development-policy.md)

Suggested next action:

- planning-gateで、最初に扱うinput subsetとparameter mapping UXを決める。

