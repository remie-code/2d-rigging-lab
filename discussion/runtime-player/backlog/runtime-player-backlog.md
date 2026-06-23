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
- Wave8でStage Arrange、click-through、always-on-top、Capture Target checklistはsource/test上実装済みだが、Electron-native挙動とOBS capture挙動は未検証。

Trigger:

- Playerを配信・収録用途で使い始める。
- Stage Windowのposition / size / always-on-top / click-throughを配信・収録用途で実運用する。
- packaging/distribution前。

Desired outcome:

- 対象OSでStageが透明背景としてcaptureできる。
- captureに不要なUIが入らない。
- always-on-top / click-through / window placementが対象OS上で期待どおり動く。
- OBS Window Captureで`Runtime Player Stage`を選べ、alphaが期待どおり扱われる。

Source:

- [../architecture/technology-stack-decision.md](../architecture/technology-stack-decision.md)
- [../implementation/waves/wave2/runtime-player-wave2-final-integration-report.md](../implementation/waves/wave2/runtime-player-wave2-final-integration-report.md)
- [../implementation/waves/wave8/runtime-player-wave8-final-integration-report.md](../implementation/waves/wave8/runtime-player-wave8-final-integration-report.md)

Suggested next action:

- Wave8 final reportのmanual verification checklistを実行し、OS/OBS差分が出たらplatform-specific follow-up waveを切る。

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

### 3.7 Head-Position Stage Motion And Broadcast Follow-ups

- Status: Deferred
- Kind: Future UX / feature
- Priority: Medium after Broadcast Stage Setup v0 manual verification

Problem:

- Wave6 intentionally stops at authored Body Angle X/Z parameter output.
- Head position may also be useful for Stage scale, Stage translation, or near/far distance response, but those are separate from Runtime Export parameter mapping and separate from Wave8 capture-target ergonomics.
- Wave8 intentionally stopped at capture-target controls and did not add Stage Motion, Spout, or OBS automation.

Trigger:

- Body Follow v0 is manually verified with real iFacialMocap and a real Runtime Export.
- User wants the on-stage model to move/scale with head position, not only body angle parameters.
- User wants on-stage model translation/scale from head position, not only body angle parameters.
- OBS Window Capture manual smoke shows Window Capture is insufficient, or the user explicitly wants Spout/OBS automation.

Desired outcome:

- Decide whether head position should drive Stage translation, Stage scale, both, or neither.
- Keep Stage Motion separate from Body Follow parameter mapping.
- Preserve Wave8 capture-safe Stage controls without adding debug UI to Stage.
- Preserve the existing rule that Stage receives sanitized display/runtime data, not raw tracking diagnostics.
- Keep Spout as a separate feasibility track, because it is promising but heavier than the immediate Stage Window capture workflow.

Source:

- [../screens/initial-runtime-player-screen.md](../screens/initial-runtime-player-screen.md)
- [../screens/control-window-screen-structure.md](../screens/control-window-screen-structure.md)
- [../screens/tracking-setup-live-mapping.md](../screens/tracking-setup-live-mapping.md)
- [../architecture/tracking-input-mapping-baseline.md](../architecture/tracking-input-mapping-baseline.md)
- [../research/broadcast-capture-paths.md](../research/broadcast-capture-paths.md)
- [../implementation/waves/wave8/runtime-player-wave8-final-integration-report.md](../implementation/waves/wave8/runtime-player-wave8-final-integration-report.md)

Suggested next action:

- Complete Wave8 manual Electron/OBS-adjacent verification first.
- If Window Capture is insufficient, run a Spout feasibility planning gate.
- If user wants model translation/scale from head position, run a separate Stage Motion planning gate.

### 3.8 Model Mapping Profile Auto Save

- Status: Done
- Final integration report: pass ([../implementation/waves/wave7/runtime-player-wave7-final-integration-report.md](../implementation/waves/wave7/runtime-player-wave7-final-integration-report.md))
- Kind: Future UX / feature completed by Runtime Player Wave7
- Priority: N/A

Problem:

- Wave5/Wave6でMapping画面の`enabled / invert / strength`とBody Follow controlsを細かく調整できるようになった。
- 現在のModel Mapping Stateはsession/local stateであり、Runtime Playerを再起動したりRuntime Exportを開き直すと調整値が失われる。
- 特にBody Followは実機で自然に見える値へ詰めるため、保存されないことが強いUX欠落になる。

Decision:

- Model Mapping Profileは手動`Save`ではなく自動保存する。
- Mapping page上部の`Mapping Profile` cardで`Saved / Saving / Unsaved changes / Save failed / Stale export`を表示する。
- HeaderにはMapping保存ボタンを置かない。
- 保存失敗時だけ`Retry`を出す。
- 試行錯誤から戻る主導線は`Reset to Auto Map`にする。

Implemented outcome:

- Runtime Exportを開いた時、そのexportに対応するModel Mapping Profileが自動復元される。
- Profileがない場合はAuto Mappingへフォールバックする。
- Runtime Exportが古い/staleの場合は、状態を表示しつつ有効slotを復元し、stale targetはAuto Mappingへfallbackする。
- Mapping変更はStageへ即時反映され、debounce後に保存される。
- `Reset to Auto Map`はmappingを再生成し、Body Follow lag stateをresetし、profileを保存する。
- 保存場所は`<electron userData>/model-mapping-profiles/<safe-package-id>/<fingerprint>.json`。
- Runtime Export identityは`packageHash`優先、hashなしでは`packageId + packageRevision + parameterSignatureHash` fallback。

Remaining manual verification:

- Mapping / Body Follow tune -> restart/reopen same Runtime Export -> restore。
- Real iFacialMocap tracking after profile restore。

Original trigger:

- Body Followの実機調整が有効であると確認された。
- ユーザーが次回起動時にも同じmapping調整を復元したい。
- Persistent Model Mapping Profile auto-save/readを次wave候補にする。

Source:

- [../screens/control-window-screen-structure.md](../screens/control-window-screen-structure.md)
- [../screens/tracking-setup-live-mapping.md](../screens/tracking-setup-live-mapping.md)
- [../implementation/orchestration/player-wave7-plan.md](../implementation/orchestration/player-wave7-plan.md)
- [../implementation/waves/wave7/runtime-player-wave7-domain-a-model-mapping-profile-auto-save-report.md](../implementation/waves/wave7/runtime-player-wave7-domain-a-model-mapping-profile-auto-save-report.md)

### 3.9 Stage Page + Window/View State Auto Save

- Status: Done
- Final integration report: pass ([../implementation/waves/wave7/runtime-player-wave7-final-integration-report.md](../implementation/waves/wave7/runtime-player-wave7-final-integration-report.md))
- Kind: Future UX / feature completed by Runtime Player Wave7
- Priority: N/A

Problem:

- Wave3以降、Stageはpan/zoomできるが、その表示状態はまだ次回起動へ持ち越せない。
- Body FollowとMapping調整が自然になったことで、次に必要なのは「調整した動き」と「整えた表示位置」が次回も戻ってくる体験である。
- OverviewにStage操作を増やすとLive readiness確認画面が肥大化する。Stage操作は低頻度なので専用pageへ逃がす方がよい。

Decision:

- Stage page v0を実体pageとして追加する。
- Stage page v0はBroadcast/OBS設定ではなく、Stage Window boundsとStage view transformを扱う。
- Window State Persistenceは自動保存する。
- 保存場所はModel Mapping Profileとは分ける。

Implemented outcome:

- Stage page v0 is a real Control Window page.
- Stage Window bounds and Control Window bounds are auto-saved.
- Stage view transform stores pan/zoom with coordinate space `stage-viewport-px-v1`.
- Focus Stage, Reset View, and Center Model are real Stage view actions.
- Center Model preserves current zoom and recenters pan.
- Window State storage is separate from Model Mapping Profile storage.
- Storage path is `<electron userData>/window-state/runtime-player.json`.
- Stage remains model-only and receives no raw tracking frame/debug setup UI.

Remaining manual verification:

- Stage move/resize -> restart -> restore。
- Stage pan/zoom -> restart -> restore。
- Stage page Focus/Reset/Center。

Implemented scope:

- Stage Window bounds: `x / y / width / height`。
- Control Window bounds: `x / y / width / height`。同時に扱うかはplanningで最終確認する。
- Stage view transform: `panX / panY / zoom`。
- Stage page actions: `Focus Stage`, `Reset View`, `Center Model`。
- Save status: `Saved / Saving / Save failed` and optional `Retry`。

Out of scope:

- Runtime Export auto restore。
- Stage transparency。
- click-through。
- always-on-top。
- OBS/capture settings。
- head-position Stage Motion。
- near/far distance response。

Storage:

```text
<electron userData>/
  window-state/
    runtime-player.json
```

Rationale:

- Model Mapping Profile is per Runtime Export and describes how the model moves.
- Window State is per device/display environment and describes where/how the Stage is shown.
- The same PC should generally reuse Stage window placement across models.
- The same Runtime Export on another PC should not inherit window coordinates from a different display environment.

Original trigger:

- Model Mapping Profile auto-save is planned, and a parallel independent domain is desirable.
- User wants the next launch to restore both motion tuning and Stage placement.

Source:

- [../screens/control-window-screen-structure.md](../screens/control-window-screen-structure.md)
- [../screens/tracking-setup-live-mapping.md](../screens/tracking-setup-live-mapping.md)
- [../implementation/orchestration/player-wave7-plan.md](../implementation/orchestration/player-wave7-plan.md)
- [../implementation/waves/wave7/runtime-player-wave7-domain-b-stage-window-state-auto-save-report.md](../implementation/waves/wave7/runtime-player-wave7-domain-b-stage-window-state-auto-save-report.md)

### 3.10 Wave7 Manual Electron Persistence Verification

- Status: Done
- Kind: Runtime verification
- Priority: N/A

Problem:

- Wave7 source checks, focused tests, typecheck, and review reports support a pass verdict, but Electron restart/reopen flows were not manually executed in Domain C.
- These checks need a real Runtime Player session, real Runtime Export, and real iFacialMocap input for final product confidence.

Verified checks:

- Mapping/Body Follow tune -> restart/reopen same Runtime Export -> restore。
- Stage move/resize -> restart -> restore。
- Stage pan/zoom -> restart -> restore。
- Stage page Focus/Reset/Center。
- Real iFacialMocap tracking after profile restore。

Result:

- User manually confirmed all checks behaved as expected after Wave7.

Source:

- [../implementation/waves/wave7/runtime-player-wave7-final-integration-report.md](../implementation/waves/wave7/runtime-player-wave7-final-integration-report.md)

### 3.11 Broadcast Stage Setup v0

- Status: Done
- Final integration report: pass ([../implementation/waves/wave8/runtime-player-wave8-final-integration-report.md](../implementation/waves/wave8/runtime-player-wave8-final-integration-report.md))
- Kind: Next UX / feature completed by Runtime Player Wave8
- Priority: N/A

Problem:

- Before Wave8, Runtime Player could move the model naturally and persist mapping/stage state, but the Stage was not yet comfortable as a broadcast capture target.
- Stage Window is frameless, so it needs an explicit arrangement path.
- If Control Window is closed, the user needed a reliable way to recover it.
- Click-through is useful for broadcast but dangerous without a recovery path.
- OBS integration should not be overclaimed; Runtime Player can prepare the Stage as a capture target but cannot know whether OBS is actually capturing it.

Implemented outcome:

- Runtime Export startup restore stores the last successful Runtime Export path under `<electron userData>/startup-state/runtime-player-startup.json`.
- Startup restore runs from Control after initial renderer effect/status setup and uses the same load workflow as manual open.
- Missing/invalid saved Runtime Export paths show a non-crashing restore failure and remain available for Retry/Open New behavior.
- Input Source auto-connect remains out of scope; iFacialMocap connect stays manual.
- Control Window close hides the window; tray/application menu can show Control, focus Stage, disable click-through, and explicitly quit.
- Explicit Quit flushes input disconnect, Model Mapping Profile, and Window State through the quit controller.
- Stage Arrange mode shows a temporary native drag handle/overlay and disables normal Stage pan/zoom while active.
- Normal Stage mode remains model-only.
- Click-through can be toggled from Control, starts Off on startup, is not persisted, and can be disabled from tray/application menu.
- Always-on-top can be toggled from Control, defaults Off, and is persisted in Window State as `stageEnvironment.alwaysOnTop`.
- Capture Target checklist is local Runtime Player readiness only and does not claim OBS integration/readiness.
- Stable Stage native title remains `Runtime Player Stage`, with Copy Window Title.

Out of scope:

- Spout sender implementation.
- obs-websocket integration.
- automatic OBS source creation.
- Input Source auto-connect.
- head-position Stage Motion.
- near/far distance response.

Source:

- [../screens/broadcast-stage-setup-v0.md](../screens/broadcast-stage-setup-v0.md)
- [../research/broadcast-capture-paths.md](../research/broadcast-capture-paths.md)
- [../implementation/orchestration/player-wave8-plan.md](../implementation/orchestration/player-wave8-plan.md)
- [../implementation/waves/wave8/runtime-player-wave8-final-integration-report.md](../implementation/waves/wave8/runtime-player-wave8-final-integration-report.md)

Remaining manual verification:

- Control close hides/reopens from tray/menu.
- Explicit Quit flushes and exits.
- Runtime Export valid/invalid startup restore.
- Stage Arrange drag handle moves the native Stage Window.
- Click-through toggle and tray recovery.
- Always-on-top toggle and persistence.
- Capture Target checklist and Copy Window Title.
- OBS Window Capture title/alpha smoke check.
