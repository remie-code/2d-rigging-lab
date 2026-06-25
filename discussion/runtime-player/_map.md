# Runtime Player Map

> Editor外のRuntime Player / Capture Host appに関する外部記憶の入口地図。

## 1. Scope

Runtime Playerは、Editorが生成したRuntime Export directoryを読み込み、tracking inputを受け取り、モデルをライブ表示する別アプリである。

Editor本体のauthoring UX、Workspace Save、Portable JSON、Texture Atlas authoring、Runtime Export生成はこのトピックの責務ではない。

## 2. Directory Map

このmapは `discussion/runtime-player/` 直下のディレクトリだけを展開する。各ディレクトリ内の詳細ファイルは、そのディレクトリの `_map.md` を読む。

| Path | Role | Status |
|---|---|---|
| [research/](research/) | 外部入力ソース、通信仕様、成立性調査 | Created |
| [screens/](screens/) | Runtime Playerの画面責務、初期画面、Live/Setup UX | Created |
| [architecture/](architecture/) | Runtime Playerの技術スタック、process/window/package境界、runtime data flow | Created |
| [implementation/](implementation/) | Runtime Player専用の実装wave計画、domain report、review記録 | Created |
| [backlog/](backlog/) | 後から実行すべきタスク、延期されたリスク、将来wave候補 | Created |

## 3. Reading Routes

- Runtime Playerの技術判断やprocess/window/package境界を確認する場合は [architecture/](architecture/) を読む。
- Runtime Playerの画面UXを確認する場合は [screens/](screens/) を読む。
- iFacialMocapなど外部入力仕様を確認する場合は [research/](research/) を読む。
- 実装waveの計画・結果・review記録を確認する場合は [implementation/](implementation/) を読む。
- 後から実行すべきタスクや延期されたリスクを確認する場合は [backlog/](backlog/) を読む。

## 4. Current State Summary

- Runtime PlayerはEditor外のElectron desktop appとして進めている。
- Control Windowとtransparent Stage Windowを分ける。
- Runtime Playerはface tracking engineではなくtracking input consumerである。
- v0候補の入力ソースはiFacialMocap。
- Runtime Export load、runtime-core evaluated default pose Stage render、Stage pan/zoom、iFacialMocap UDP receive / parse / normalize / Control diagnosticsは実装済み。
- Runtime Export loadとInput Source connectionは独立しており、Runtime Export未ロードでもiFacialMocap接続とdiagnostics確認ができる。
- Runtime Player Wave5でInput Profile永続保存、Look Forward session neutral、Guided Calibration v0、Auto Mapping v0、slot controls、sanitized live parameter frame、Stage runtime-core Live Evaluationが実装済み。
- ユーザー実機確認でWave5のlive motionは動作し、顔・目・口は自然に見える。ただし体が静止する違和感が大きいことが確認された。
- Runtime Player Wave6はDomain A/B実装・review・Domain C docs/report integrationが完了。既存Input Profileへhead position left/right calibrationを追加でき、Auto Mappingは既存9個のhead/eyes/mouth slotsを保ったまま`body-x` / `body-z` slotsを追加する。
- Wave6 Body Follow v0は、`Body Angle X`をhead horizontal由来、`Body Angle Z`をhead tilt + head positionX由来としてmain-owned sanitized runtime parameter frameへ出力する。
- Control Window Wave5 v0は `Overview` / `Input` / `Mapping` のみを公開する。Stage Windowはmodel-onlyを維持する。
- Wave6後もStage Windowはmodel-onlyで、raw tracking frame / raw head position / debug body dataを受け取らない。
- Runtime Player Wave6 final clean integration reviewはpass済み。
- Runtime Player Wave7 Domain A/Bは実装・review `pass`。Domain C final integration docs/report alignmentは [implementation/waves/wave7/runtime-player-wave7-final-integration-report.md](implementation/waves/wave7/runtime-player-wave7-final-integration-report.md) に記録する。
- Wave7でModel Mapping Profile auto-save/restoreを実装済み。Mapping調整はHeaderではなくMapping page上部の`Mapping Profile` cardで保存状態を表示し、手動Saveではなく自動保存する。
- Model Mapping Profileは`<electron userData>/model-mapping-profiles/<safe-package-id>/<fingerprint>.json`へ保存する。Runtime Export identityは`packageHash`優先、hashなしでは`packageId + packageRevision + parameterSignatureHash` fallback。
- Wave7でStage page v0を実体pageとして追加済み。Stage Window bounds、Stage view transform、Focus Stage、Reset View、Center Model、window-state保存状態を扱う。
- Window StateはModel Mapping Profileとは別に`<electron userData>/window-state/runtime-player.json`へ自動保存する。Stage Window bounds、Control Window bounds、Stage view pan/zoomを含む。
- Wave7後もStage Windowはmodel-onlyで、Runtime Export payloadとsanitized `parameterValues` live frameだけを受け取る。raw tracking frame / raw head position / debug body dataは受け取らない。
- Wave7のElectron手動確認はユーザー確認済み: Mapping/Body Follow tune後のrestart/reopen restore、Stage move/resize restore、Stage pan/zoom restore、Stage page Focus/Reset/Center、profile restore後のreal iFacialMocap trackingが期待通りに動作した。
- Runtime Player Wave8 final integration is `pass`: [implementation/waves/wave8/runtime-player-wave8-final-integration-report.md](implementation/waves/wave8/runtime-player-wave8-final-integration-report.md)。
- Wave8でBroadcast Stage Setup v0を実装済み。Runtime Export startup restore、Control Window recovery、Stage Arrange mode、click-through、always-on-top、Capture Target checklist、stable Stage title / Copy Window Titleを追加した。
- Runtime Export startup restoreはInput Source auto-connectをしない。Input Source connectionは引き続き手動Control actionである。
- click-throughは起動時Offで、永続保存しない。tray/application menuのDisable Click-throughがrecovery pathになる。
- always-on-topはdefault Offで、Window State `stageEnvironment.alwaysOnTop`として保存する。
- Runtime Player Wave9 final integration is `pass`: [implementation/waves/wave9/runtime-player-wave9-final-integration-report.md](implementation/waves/wave9/runtime-player-wave9-final-integration-report.md)。
- Wave9でOBS Browser Source probeを実装済み。Runtime Playerは`127.0.0.1` loopback HTTP/WebSocket server、tokenized Browser Source URL、token-gated Runtime Export/live parameter transport、transparent model-only Browser Source Stage client、Control Browser Source diagnosticsを持つ。
- Wave10後、Browser Source Outputがfixed primary broadcast pathであり、native Stage Windowは`Local Preview / Fallback`として残る。Window/Game Captureはprimary setup pathではない。
- Browser Source client receives Runtime Export payload plus sanitized live parameter frames only. Raw tracking frames、raw iFacialMocap diagnostics、debug calibration data、private paths、Control-only status fieldsはBrowser Sourceへ渡さない。
- Runtime Player Wave10 Domain A source/test/reviewは`pass`、Domain B final integration docs/report alignmentは [implementation/waves/wave10/runtime-player-wave10-final-integration-report.md](implementation/waves/wave10/runtime-player-wave10-final-integration-report.md) に記録済み。final integration reviewはReview-Sylphが別途担当する。
- Wave10後もBrowser Sourceがfixed primary broadcast pathであり、native Stage Windowはlocal preview/fallbackである。Browser Source client接続中はnative local preview live renderingだけをsuspendし、Browser Source rendering、input processing、mapping、body follow、dynamics、Runtime Export state、Stage transform syncは止めない。
- Controlはlocal preview suspension statusを表示し、Browser Source live-frame status/repeated renderer diagnosticsを約500msでsampleする。server/client/export/renderの重要transitionは即時反映する。
- Browser Source startup/resyncは同一Runtime Export payload適用をde-duplicateし、reload/reconnectとreplacement payload適用は維持する。
- Spout2 sender、obs-websocket、automatic OBS source creation、automatic OBS capture verificationは引き続きout of scope / future。
- Runtime Player Wave11 final integration documentation pass is `pass`, pending clean review: [implementation/waves/wave11/runtime-player-wave11-final-integration-report.md](implementation/waves/wave11/runtime-player-wave11-final-integration-report.md)。
- Wave11でInput Profile near/far calibrationを追加済み。既存profile without near/farは読み込み可能で、near/far missingはInput calibrationから回復できる。
- Wave11でStage Motion / Head Position FollowをStage pageへ実装済み: [screens/stage-motion-head-position-follow.md](screens/stage-motion-head-position-follow.md)。manual Stage pan/zoomをbase transformにし、calibrated head positionから一時的なhorizontal offset / depth scale offsetを合成する。
- Stage Motion settings are Window State / local display settings and auto-save. Current live offsets and smoothed runtime state are not saved.
- Browser Source receives the composed Stage transform for Stage Motion and no raw tracking frame、raw head position、calibration internals、debug diagnostics。
- Wave10 native local preview suspension remains effective: Browser Source rendering、input processing、mapping、body follow、dynamics、Runtime Export state、Stage transform sync、Stage Motionはactiveのまま維持する。
- Wave12でLive Controller pageを追加済み。Runtime Export Variant Groupsのsession-only active Variant switching、`Reset to Model Default`、native Stage / Browser Source active Variant parityを扱う。
- Wave12後もBrowser Sourceへ渡るVariant情報はsanitized active Variant selectionのみで、raw tracking frames、iFacialMocap diagnostics、calibration internals、private file pathsは渡さない。
- Runtime Player Wave13 final integration is `pass`: [implementation/waves/wave13/wave13-final-integration-report.md](implementation/waves/wave13/wave13-final-integration-report.md)。
- Wave13のshared Stage renderer frame pacingによりlive framesとStage view/display transform invalidationが可能な範囲でscheduled rAF renderingへ合流し、duplicate unchanged Stage view/display transformsはskip/countされる。
- Wave13でControl Windowに低優先度 `Performance Diagnostics` pageを追加する: [screens/performance-diagnostics.md](screens/performance-diagnostics.md)。target Native Stage / Browser Source / Both、duration 10s / 30s、Start/Stop Capture、Copy Report、Clear Report、report preview、target availability、comparison guidanceを持つ。
- Wave13 metricsはrender count、scheduled/immediate render count、live frame message count、Stage view/display transform counts、duplicate transform skip count、coalesced live frame count、rAF delta、render duration、canvas size、devicePixelRatioを含む。Native StageはStage view IPC、Browser Sourceはsanitized diagnostics pathで報告する。
- Performance Diagnostics reports separate input/source indicators from render metrics and exclude raw tracking frames、calibration internals、Browser Source token、private file paths、full Runtime Export payload。
- Runtime Player Wave14 Domain A/B implementation and clean reviews are `pass`; Domain C docs/maps final integration and final clean integration review by Review-Sylph are `pass`: [implementation/waves/wave14/wave14-final-integration-report.md](implementation/waves/wave14/wave14-final-integration-report.md), [implementation/reviews/wave14/wave14-final-clean-integration-review.md](implementation/reviews/wave14/wave14-final-clean-integration-review.md)。
- Wave14 adds a renderer-owned runtime evaluation cache for invariant Runtime Export graph/scaffold/texture/template/clipping data keyed by Runtime Export identity and semantic active Variant selection. It does not cache snapshots, runtime state, dynamics state, authored/live values, evaluated vertices, opacity, draw order, visibility, or keyform samples.
- Wave14 Performance Diagnostics terms now separate `inputReceiveFpsLatest`, `inputPacketCount`, `liveFrameMessageFps`, `liveFrameMessageCount`, `appliedLiveFrameFps`, `appliedLiveFrameCount`, `renderFps`, and `renderCount`.
- Browser Source source timestamp interval diagnostics are named `liveFrameSourceTimestampFpsLatest`; this value is not raw input receive FPS.
- Wave14 preserves Browser Source/report sanitization plus Wave10 native local preview suspension, Wave11 Stage Motion, and Wave12 Variant switching boundaries.
- Wave9/Wave10/Wave11/Wave12/Wave13/Wave14のmanual OBS Browser Source verificationは未完了: URL load、alpha preservation、WebGL2/model rendering、Control client/heartbeat diagnostics、local preview suspension/resume、real iFacialMocap live motion、body follow/dynamics、Stage Motion left/right/depth scale、Variant switching parity、Performance Diagnostics target `Both` capture/report with `inputReceiveFpsLatest` / `liveFrameMessageFps` / `appliedLiveFrameFps` / `renderFps` / `liveRenderInputEvaluationDurationMs` / `scheduledFrameDurationMs` comparison、hide/show/manual refresh reconnect/resync、perceived CPU/GPU/render smoothness improvement、unintended audio meter check。
- Native Stage WindowのElectron manual verificationはlocal preview/fallback観点で未完了: Control close-hide/reopen、Explicit Quit flush/exit、Runtime Export valid/invalid startup restore、Arrange drag、click-through tray recovery、always-on-top persistence、fallback controls。
- advanced mapping editor、Spout Output、TCP transport、dedicated Model page、dedicated raw/input Diagnostics pageはfuture。Performance Diagnostics pageはWave13で別枠として実体化済み。

## 5. Next Navigation

Wave14の実装事実を確認する時は [implementation/waves/wave14/wave14-final-integration-report.md](implementation/waves/wave14/wave14-final-integration-report.md)、[implementation/waves/wave14/_map.md](implementation/waves/wave14/_map.md)、[implementation/reviews/wave14/_map.md](implementation/reviews/wave14/_map.md)、[implementation/reviews/wave14/wave14-final-clean-integration-review.md](implementation/reviews/wave14/wave14-final-clean-integration-review.md)、[screens/performance-diagnostics.md](screens/performance-diagnostics.md) を読む。Wave14はfinal pass baselineであり、real-model manual Electron/OBS diagnostics confirmation は未完了。Stage Motion UX確認では [screens/stage-motion-head-position-follow.md](screens/stage-motion-head-position-follow.md)、Live Controller / Variant switchingは [screens/live-controller-page.md](screens/live-controller-page.md)、Stage page / Browser Source関係は [screens/broadcast-stage-setup-v0.md](screens/broadcast-stage-setup-v0.md) と [screens/browser-source-output-probe-v0.md](screens/browser-source-output-probe-v0.md)、Tracking/Input boundaryは [screens/tracking-setup-live-mapping.md](screens/tracking-setup-live-mapping.md) を読む。さらに次候補を再検討する時は、まず [backlog/](backlog/) で延期タスクと実行triggerを確認する。
