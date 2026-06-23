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
- Wave9以降、Browser Source Outputがprimary broadcast candidateであり、native Stage Windowは`Local Preview / Fallback`として残る。Window/Game Captureはprimary setup pathではない。
- Browser Source client receives Runtime Export payload plus sanitized live parameter frames only. Raw tracking frames、raw iFacialMocap diagnostics、debug calibration data、private paths、Control-only status fieldsはBrowser Sourceへ渡さない。
- Spout2 sender、obs-websocket、automatic OBS source creation、automatic OBS capture verification、head-position Stage Motion、near/far distance responseは引き続きout of scope / future。
- Wave9のmanual OBS Browser Source verificationは未完了: URL load、alpha preservation、WebGL2/model rendering、Control client/heartbeat diagnostics、real iFacialMocap live motion、hide/show/manual refresh reconnect/resync、unintended audio meter check。
- Native Stage WindowのElectron manual verificationはlocal preview/fallback観点で未完了: Control close-hide/reopen、Explicit Quit flush/exit、Runtime Export valid/invalid startup restore、Arrange drag、click-through tray recovery、always-on-top persistence、fallback controls。
- advanced mapping editor、head-position Stage Motion、near/far distance response、Spout Output、TCP transport、dedicated Model/Diagnostics pagesはfuture。

## 5. Next Navigation

Wave9の実装事実を確認する時は [implementation/waves/wave9/runtime-player-wave9-final-integration-report.md](implementation/waves/wave9/runtime-player-wave9-final-integration-report.md)、Domain別詳細は [implementation/waves/wave9/_map.md](implementation/waves/wave9/_map.md)、review詳細は [implementation/reviews/wave9/_map.md](implementation/reviews/wave9/_map.md) を読む。Browser Source UX確認では [screens/browser-source-output-probe-v0.md](screens/browser-source-output-probe-v0.md)、fallback Stage controlsは [screens/broadcast-stage-setup-v0.md](screens/broadcast-stage-setup-v0.md)、経路判断は [research/broadcast-capture-paths.md](research/broadcast-capture-paths.md) を読む。さらに次候補を再検討する時は、まず [backlog/](backlog/) で延期タスクと実行triggerを確認する。
