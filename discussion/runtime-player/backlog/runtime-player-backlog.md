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

### 3.4 Native Stage Window Platform Behavior

- Status: Deferred
- Kind: Platform risk
- Priority: Medium

Problem:

- Wave9以降、native Stage Windowはprimary broadcast pathではなくlocal preview / fallbackである。
- それでもStage Windowはtransparent/capture-friendly fallbackとして有用である。
- Electronのtransparent/frameless windowやOBS capture behaviorはOSやGPU環境の差分を受ける。
- Wave8でStage Arrange、click-through、always-on-top、stable Stage title / Copy Window Titleはsource/test上実装済みだが、Electron-native挙動は未検証。

Trigger:

- Native Stage Windowをlocal preview / fallback captureとして実運用する。
- Stage Windowのposition / size / always-on-top / click-throughを配信準備で実運用する。
- packaging/distribution前。

Desired outcome:

- 対象OSでStageが透明背景のlocal preview / fallbackとして使える。
- captureに不要なUIが入らない。
- always-on-top / click-through / window placementが対象OS上で期待どおり動く。
- 必要ならOBS Window Capture fallbackで`Runtime Player Stage`を選べるか確認する。ただしPrimary probeはBrowser Sourceである。

Source:

- [../architecture/technology-stack-decision.md](../architecture/technology-stack-decision.md)
- [../implementation/waves/wave2/runtime-player-wave2-final-integration-report.md](../implementation/waves/wave2/runtime-player-wave2-final-integration-report.md)
- [../implementation/waves/wave8/runtime-player-wave8-final-integration-report.md](../implementation/waves/wave8/runtime-player-wave8-final-integration-report.md)
- [../implementation/waves/wave9/runtime-player-wave9-final-integration-report.md](../implementation/waves/wave9/runtime-player-wave9-final-integration-report.md)

Suggested next action:

- Browser Source manual OBS probeを優先する。
- Native Stage Windowのmanual Electron checksを実行し、fallback/local previewで差分が出たらplatform-specific follow-up waveを切る。

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
- Wave8 intentionally stopped at native capture-target controls and did not add Stage Motion, Spout, or OBS automation.
- Wave9 added Browser Source Output as the primary broadcast candidate and kept Spout2 deferred.
- Wave10 kept Browser Source as the fixed primary broadcast path and added duplicate native local preview live render suspension, sampled Control diagnostics, and Browser Source resync de-duplication.

Trigger:

- Body Follow v0 is manually verified with real iFacialMocap and a real Runtime Export.
- User wants the on-stage model to move/scale with head position, not only body angle parameters.
- User wants on-stage model translation/scale from head position, not only body angle parameters.
- Browser Source manual OBS probe fails a critical condition, or the user explicitly wants Spout2/OBS automation.

Desired outcome:

- Decide whether head position should drive Stage translation, Stage scale, both, or neither.
- Keep Stage Motion separate from Body Follow parameter mapping.
- Preserve Wave8 capture-safe Stage controls without adding debug UI to Stage.
- Preserve the existing rule that Stage receives sanitized display/runtime data, not raw tracking diagnostics.
- Keep Spout2 as a separate feasibility track unless Browser Source fails a critical probe condition.

Source:

- [../screens/initial-runtime-player-screen.md](../screens/initial-runtime-player-screen.md)
- [../screens/control-window-screen-structure.md](../screens/control-window-screen-structure.md)
- [../screens/tracking-setup-live-mapping.md](../screens/tracking-setup-live-mapping.md)
- [../architecture/tracking-input-mapping-baseline.md](../architecture/tracking-input-mapping-baseline.md)
- [../research/broadcast-capture-paths.md](../research/broadcast-capture-paths.md)
- [../implementation/waves/wave8/runtime-player-wave8-final-integration-report.md](../implementation/waves/wave8/runtime-player-wave8-final-integration-report.md)
- [../implementation/waves/wave9/runtime-player-wave9-final-integration-report.md](../implementation/waves/wave9/runtime-player-wave9-final-integration-report.md)

Suggested next action:

- Complete Wave9 Browser Source manual OBS probe first.
- If Browser Source fails a critical condition, run a Spout2 feasibility planning gate or a narrow Browser Source follow-up, depending on the observed failure.
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
- Wave9 later demoted this native capture-target surface to `Local Preview / Fallback`; it is no longer the primary broadcast setup path.

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
- [../implementation/waves/wave9/runtime-player-wave9-final-integration-report.md](../implementation/waves/wave9/runtime-player-wave9-final-integration-report.md)

Remaining manual verification:

- Control close hides/reopens from tray/menu.
- Explicit Quit flushes and exits.
- Runtime Export valid/invalid startup restore.
- Stage Arrange drag handle moves the native Stage Window.
- Click-through toggle and tray recovery.
- Always-on-top toggle and persistence.
- Local Preview / Fallback controls and Copy Window Title.
- OBS Window Capture title/alpha fallback smoke check, only if fallback capture remains needed.

### 3.12 OBS Browser Source Probe

- Status: Done at source/test level through Wave10 performance foundation; manual OBS verification pending
- Final integration reports: Wave9 pass ([../implementation/waves/wave9/runtime-player-wave9-final-integration-report.md](../implementation/waves/wave9/runtime-player-wave9-final-integration-report.md)); Wave10 final integration pass ([../implementation/waves/wave10/runtime-player-wave10-final-integration-report.md](../implementation/waves/wave10/runtime-player-wave10-final-integration-report.md))
- Kind: Broadcast output probe completed by Runtime Player Wave9
- Priority: Manual verification is high before treating Browser Source as product-ready

Problem:

- OBS Game Capture was not reliable for Chromium/Electron transparency in the target environment.
- Runtime Player needed a broadcast path that does not depend on capturing the native Electron Stage Window.
- Browser Source can load a Runtime Player-served web page, but OBS CEF/WebGL2/alpha/lifecycle behavior must be verified manually.

Implemented outcome:

- Runtime Player starts a loopback Browser Source HTTP/WebSocket server bound to `127.0.0.1`.
- Control shows a tokenized Browser Source URL and `Copy URL`.
- Missing/invalid token is rejected for protected HTTP routes and WebSocket upgrades.
- `/stage`, Runtime Export status/payload, and WebSocket live transport are implemented.
- Generated Browser Source JS/CSS assets are tokenless by accepted design, with `.js` / `.css` allowlist and path containment.
- Browser Source Stage client is transparent, model-only, and independent of Electron preload APIs.
- Browser Source receives Runtime Export payload plus sanitized live parameter frames only.
- Raw tracking frames, raw iFacialMocap diagnostics, debug calibration data, private paths, and Control-only status fields do not cross into Browser Source.
- Control shows connected client count, heartbeat, WebGL2, renderer status, Browser Source Runtime Export status, frame age, and FPS.
- Native Stage Window controls remain available under `Local Preview / Fallback`.
- Wave10 suspends only native Stage local live rendering while Browser Source client count is greater than zero; Browser Source rendering, live parameter frame production, input processing, mapping, body follow, dynamics, Runtime Export state, and Stage transform sync stay active.
- Native Stage local live rendering resumes after the zero-client grace period, and reconnect during grace avoids preview bounce.
- Control reports local preview suspension and samples repeated Browser Source live-frame/renderer diagnostics without hiding important server/client/export/render transitions.
- Browser Source resync de-duplicates identical Runtime Export payload application while preserving reload/reconnect and replacement payload behavior.
- Spout2, obs-websocket, automatic OBS source creation, and automatic OBS capture verification remain out of scope.

Source:

- [../screens/browser-source-output-probe-v0.md](../screens/browser-source-output-probe-v0.md)
- [../screens/broadcast-stage-setup-v0.md](../screens/broadcast-stage-setup-v0.md)
- [../research/broadcast-capture-paths.md](../research/broadcast-capture-paths.md)
- [../implementation/orchestration/player-wave9-plan.md](../implementation/orchestration/player-wave9-plan.md)
- [../implementation/orchestration/player-wave10-plan.md](../implementation/orchestration/player-wave10-plan.md)
- [../implementation/waves/wave9/runtime-player-wave9-final-integration-report.md](../implementation/waves/wave9/runtime-player-wave9-final-integration-report.md)
- [../implementation/waves/wave10/runtime-player-wave10-final-integration-report.md](../implementation/waves/wave10/runtime-player-wave10-final-integration-report.md)
- [../implementation/reviews/wave9/runtime-player-wave9-final-clean-integration-review.md](../implementation/reviews/wave9/runtime-player-wave9-final-clean-integration-review.md)

Remaining manual verification:

- Add OBS Browser Source.
- Paste Runtime Player Browser Source URL.
- Set width/height.
- Set custom FPS to 30 or 60 for test.
- Keep transparent background/custom CSS behavior enabled.
- Initially leave `Shutdown source when not visible` off.
- Initially leave `Refresh browser source when scene becomes active` off.
- Confirm transparent areas show lower OBS layers.
- Confirm model renders without black/white fill.
- Confirm WebGL2 status appears in Control.
- Confirm connected client and heartbeat appear in Control.
- Confirm Control reports local preview live rendering suspension while Browser Source is connected.
- Move face/head with iFacialMocap and confirm model motion.
- Confirm body follow/dynamics remain visible in Browser Source while native local preview live rendering is suspended.
- Hide/show scene and manually refresh Browser Source, then confirm reconnect/resync.
- Disconnect/close OBS Browser Source and confirm native Stage local preview resumes after the grace period.
- Compare CPU/GPU usage or perceived smoothness against the Wave9 duplicate-render baseline.
- Confirm OBS audio meter does not receive unintended audio.

Suggested next action:

- Run the manual OBS Browser Source probe with a real Runtime Export and iFacialMocap input after Wave10.
- If it passes, keep Browser Source as the primary broadcast path.
- If it fails, record the exact failure and decide between a narrow Browser Source follow-up and Spout2 feasibility.
