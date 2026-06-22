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
- [../architecture/tracking-input-mapping-baseline.md](../architecture/tracking-input-mapping-baseline.md)

Suggested next action:

- planning-gateで、最初に扱うinput subsetとparameter mapping UXを決める。

### 3.6 Body Follow v0 From Head Pose

- Status: Done
- Final clean integration review: pass ([../implementation/reviews/wave6/runtime-player-wave6-final-clean-integration-review.md](../implementation/reviews/wave6/runtime-player-wave6-final-clean-integration-review.md))
- Kind: Future UX / feature completed by Runtime Player Wave6
- Priority: N/A

Problem:

- iFacialMocapは主に顔周辺のtracking sourceであり、Body Angle X/Zに直接対応するbody tracking signalは期待しにくい。
- Wave5のユーザー実機確認では、顔・目・口のlive motionは自然に見える一方、首から上だけが動いて体が静止する違和感が大きかった。

Implemented outcome:

- Existing Input Profiles can remain usable without `headPositionRaw`.
- Saved profiles can add head position left/right calibration through missing-only or head-position-only recalibration.
- Auto Mapping preserves the existing nine Wave5 head/eyes/mouth slots and adds Body X/Z slots when matching body targets exist.
- `Body Angle X` uses calibrated head horizontal input with conservative strength and lag.
- `Body Angle Z` combines calibrated head tilt and optional calibrated head positionX.
- Body outputs are emitted through the existing sanitized live parameter frame path.
- Stage remains model-only and receives no raw tracking frame, raw head position, or debug body data.

Source:

- [../implementation/orchestration/player-wave6-plan.md](../implementation/orchestration/player-wave6-plan.md)
- [../implementation/waves/wave6/runtime-player-wave6-domain-a-input-profile-position-calibration-report.md](../implementation/waves/wave6/runtime-player-wave6-domain-a-input-profile-position-calibration-report.md)
- [../implementation/waves/wave6/runtime-player-wave6-domain-b-body-auto-mapping-live-follow-report.md](../implementation/waves/wave6/runtime-player-wave6-domain-b-body-auto-mapping-live-follow-report.md)
- [../implementation/waves/wave6/runtime-player-wave6-final-integration-report.md](../implementation/waves/wave6/runtime-player-wave6-final-integration-report.md)

Remaining manual verification:

- Run Electron Runtime Player with real iFacialMocap input and a Runtime Export with authored Body Angle X/Z keyforms.
- Tune default Body X/Z strengths and lag if real-device visual evidence shows the defaults feel wrong.

### 3.7 Head-Position Stage Motion And Broadcast-Ready Stage

- Status: Deferred
- Kind: Future UX / feature
- Priority: Medium after Body Follow visual verification, high before broadcast/capture workflows

Problem:

- Wave6 intentionally stops at authored Body Angle X/Z parameter output.
- Head position may also be useful for Stage scale, Stage translation, near/far distance response, or capture-friendly Stage controls, but those are separate from Runtime Export parameter mapping.
- Adding Stage Motion or Broadcast/OBS UX too early would mix model parameter follow, window/capture behavior, and display composition.

Trigger:

- Body Follow v0 is manually verified with real iFacialMocap and a real Runtime Export.
- User wants the on-stage model to move/scale with head position, not only body angle parameters.
- Stage Window position / size / always-on-top / click-through / OBS capture behavior becomes the next practical bottleneck.

Desired outcome:

- Decide whether head position should drive Stage translation, Stage scale, both, or neither.
- Keep Stage Motion separate from Body Follow parameter mapping.
- Define capture-safe Stage controls without adding debug UI to Stage.
- Preserve the existing rule that Stage receives sanitized display/runtime data, not raw tracking diagnostics.

Source:

- [../screens/initial-runtime-player-screen.md](../screens/initial-runtime-player-screen.md)
- [../screens/control-window-screen-structure.md](../screens/control-window-screen-structure.md)
- [../screens/tracking-setup-live-mapping.md](../screens/tracking-setup-live-mapping.md)
- [../architecture/tracking-input-mapping-baseline.md](../architecture/tracking-input-mapping-baseline.md)

Suggested next action:

- After manual body follow verification, run a planning gate for Stage Motion / Broadcast-ready Stage as a separate wave.
