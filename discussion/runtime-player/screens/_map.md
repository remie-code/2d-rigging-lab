# Runtime Player Screens Map

> Runtime Player / Capture Host appの画面責務とUX設計メモ。

## Files

| Path | Status | Content |
|---|---|---|
| [initial-runtime-player-screen.md](initial-runtime-player-screen.md) | Updated / Wave6 current UX facts | Runtime Export未ロードでもInput Source接続できる現行画面体験、Control/Stage分離、Loaded/Live状態、Wave6 Body Follow v0 |
| [control-window-screen-structure.md](control-window-screen-structure.md) | Updated / Wave21 current UX facts | Header + `Overview` / `Live Controller` / `Input` / `Mapping` / `Dynamics Tune` / `Stage` / `Performance Diagnostics` の実装済みControl構成。Stage pageはStage Motion、Browser Source Output、Local Preview / Fallbackを扱う |
| [tracking-setup-live-mapping.md](tracking-setup-live-mapping.md) | Updated / Wave21 current UX facts | Input Profile、Look Forward、Guided Calibration v0、head position left/right + near/far calibration、Auto Mapping v0 + Body X/Z、Stage Live Confirmation、Model Mapping Profile auto-save/restore、Runtime Dynamics Tune Profile、separate Window State、Runtime Export startup restore、Stage Motion boundary |
| [dynamics-tune-profile.md](dynamics-tune-profile.md) | Implemented through Wave21 source/tests; real-device/OBS manual checks pending | Control Window `Dynamics Tune` page, per Runtime Export Dynamics Tune Profile storage, Runtime Export immutability, quick tune controls, Native Stage / Browser Source effective tuning parity |
| [broadcast-stage-setup-v0.md](broadcast-stage-setup-v0.md) | Updated / Wave13 frame pacing diagnostics baseline | Wave8 native Stage setup controlsはlocal preview/fallbackへ demoted。Wave10後のBrowser Source Outputはfixed primary broadcast pathで、Browser Source接続中はnative local preview live renderingだけをsuspendする。Wave11 Stage Motion composed transform、Wave12 active Variant selection、Wave13 renderer metricsもBrowser Source pathに届く |
| [browser-source-output-probe-v0.md](browser-source-output-probe-v0.md) | Implemented through Wave10 source/tests; manual OBS product-confidence checks pending | Browser Source Output screen, loopback URL, token/diagnostics boundaries, model-only Browser Source Stage client, Wave10 suspension/sampling/resync facts, and post-Wave10 manual OBS checklist |
| [stage-motion-head-position-follow.md](stage-motion-head-position-follow.md) | Implemented through Wave11 source/tests/review; manual tuning pending | Head position由来のStage-level horizontal offset / explicit near/far depth scale offset、dead zone、reaction、limit、Window State auto-save、Browser Source composed transform境界 |
| [live-controller-page.md](live-controller-page.md) | Implemented through Wave12 source/domain level; manual broadcast verification pending | 配信中の即時操作を集めるControl Window page。Variant切替、Reset to Model Default、Look Forward、Stage Motion quick toggle、Center Modelを扱い、native Stage / Browser Sourceへ同じsanitized active Variant selectionを反映する |
| [performance-diagnostics.md](performance-diagnostics.md) | Updated / Wave18–19 lightweight diagnostics and bounded cadence evidence; product-confidence gates pending | Native Stage / Browser Source / Both のtimed capture、source/input FPSとrender FPSの分離、renderer frame pacing metrics、Wave18 product deep-profile removal boundary、Wave19 OBS/Chrome/Edge cadence observation、Copy Report、privacy boundary、manual comparison guidance |

## Current Screen Principles

- Runtime PlayerはEditorではなく、完成モデルをtracking inputでライブ表示するアプリである。
- 主画面はClean Stageであり、Parameter一覧、Mesh、Deformer、Editor treeは通常表示しない。
- Stage WindowとControl Windowを分離する。Stage Windowはtransparentでmodel only、Control WindowはRuntime Export、tracking input、calibration、mapping、display setupを扱う。
- Control Windowは1枚の縦積み設定画面ではなく、Header + left navigation + responsibility pagesで構成する。
- 現在のControl Window navigationは `Overview` / `Live Controller` / `Input` / `Mapping` / `Dynamics Tune` / `Stage` / `Performance Diagnostics`。Stage pageは空のplaceholderではなく、Stage Window bounds / Stage view transformを扱う実体pageである。
- Runtime Export loadとInput Source connectionは独立しており、Runtime Export未ロードでもiFacialMocap接続・diagnostics確認は可能。
- raw/input diagnostics debug panelは必要だが、通常UXでは折りたたむ。Wave13の`Performance Diagnostics` pageはこれとは別で、render pacing evidenceを安全に採取する低優先度pageである。
- Stage Live Mappingはmain-owned sanitized parameter frameとStage runtime-core evaluationで実装済み。Stageはmodel-onlyを維持する。
- Wave6 Body Follow v0はmain-owned sanitized parameter frameとしてBody X/Zを出力する。Stageはraw tracking/head-position/debug body dataを受け取らない。
- Wave7 Model Mapping Profileは手動Saveではなく自動保存する。保存状態はMapping page上部の`Mapping Profile` cardに出し、Headerには保存ボタンを置かない。保存先は`<electron userData>/model-mapping-profiles/<safe-package-id>/<fingerprint>.json`。
- Wave21 Runtime Dynamics Tune Profileは手動Saveではなく自動保存する。保存状態は`Dynamics Tune` pageに出し、保存先は`<electron userData>/dynamics-tuning-profiles/<safe-package-id>/<fingerprint>.json`。Runtime Export artifactは変更しない。
- Wave7 Stage page v0はStage Window bounds、Stage view pan/zoom、Focus Stage、Reset View、Center Model、window-state自動保存状態を扱う。Wave8 Stage pageはさらにnative Stage setup controls、Runtime Export startup restore statusを扱う。
- Wave10後のStage pageでは`Browser Source Output`がfixed primary broadcast pathであり、Wave8のnative Stage Window capture controlsは`Local Preview / Fallback`として残る。
- Wave11 Stage pageはStage Motion panelを持つ。Stage MotionはMapping pageではなく、Stage-level display transformである。
- Browser Source client接続中はnative local preview live renderingだけをsuspendする。Browser Source rendering、input processing、mapping、body follow、dynamics、Runtime Export state、Stage transform sync、Stage Motionはactiveのまま維持する。
- Browser Source OutputはRuntime Playerのloopback URL、server/client/renderer diagnostics、WebGL2 status、heartbeat、sampled live frame state、local preview suspension statusを表示する。ただしOBS capture/streaming readyは主張しない。
- Control-facing live-frame statusとrepeated renderer diagnosticsはsampleされるが、server/client/export/renderの重要transitionは即時に見える。
- Browser Source Runtime Export resyncは同一payload適用をde-duplicateし、replacement payload、reload、reconnectを維持する。
- Stage Motion / Head Position Follow is implemented: manual Stage pan/zoom remains the base transform, calibrated head position adds transient horizontal/scale offsets, settings auto-save in Window State, and current live offsets are not saved.
- Browser Source receives the sanitized composed Stage transform for Stage Motion and no raw tracking/debug/calibration data.
- Live Controller is implemented as a Control Window page for broadcast-time quick operations, not a separate window and not an overloaded Overview. Runtime Export Variant switching remains session-only and Browser Source receives sanitized active Variant selection only.
- Dynamics Tune is implemented as a Control Window page for Player-side runtime dynamics tuning. Native Stage and Browser Source use the same effective tuning profile, and Browser Source receives only sanitized effective tuning data.
- Wave13 shared Stage renderer frame pacing converges live frames and Stage view/display transform invalidation on scheduled rAF rendering where practical, skips/counts duplicate unchanged transforms, and exposes aggregate renderer metrics.
- Performance Diagnostics reports must separate source/input FPS from render FPS and exclude raw tracking frames, calibration internals, Browser Source token, private file paths, full Runtime Export payload, Runtime Export textures, and Runtime Export mesh data.
- Wave15 keeps normal live Runtime Player evaluation on the hot-path defaults: snapshot validation is skipped for Stage / Browser Source pose evaluation. Wave18 supersedes the old product deep-capture behavior: product Start Capture is lightweight and does not request runtime-core deep profiling; internal deep profiling remains developer/test-only.
- Wave19's tracked OBS/Chrome/Edge cadence comparison is bounded objective evidence. It does not establish alpha/WebGL2/model visual parity, subjective smoothness, or a universal 60 FPS guarantee; Browser Source rAF/coalescing remains an environment/product-confidence gate.
- Wave16 connects Runtime Player to runtime-core's compiled evaluator. In copied reports, compare `runtimeCoreSnapshotCreationDurationMs`, `runtimeCoreDrawableSnapshotCreationDurationMs`, `runtimeCoreDeformerHierarchyEvaluationDurationMs`, and `runtimeCoreWarpDeformerVertexTransformDurationMs` as compiled-path frame costs; `runtimeModelCompileDurationMs` is internal scaffold profiling and is not currently a copied report line.
- Spout2、obs-websocket、automatic OBS source creation、automatic OBS capture verificationはout of scope: [../research/broadcast-capture-paths.md](../research/broadcast-capture-paths.md)。
- Startup時の前回Runtime Export自動復元はWave8で実装済み。Input Source auto-connectはしない。
- click-throughは起動時Offで、永続保存しない。always-on-topはdefault OffでWindow Stateへ保存する。
- `initial-runtime-player-screen.md` contains some pre-Wave7/8 close-hide and navigation prose retained as historical context; current lifecycle/navigation truth is this map plus `control-window-screen-structure.md` and `broadcast-stage-setup-v0.md`.

## Next Questions

1. Real Runtime Export + iFacialMocapで`Dynamics Tune`を開き、`Strength` / `Reaction` / `Convergence` / `Sway`の変更がNative Stageへ即時反映されるか確認する。
2. Runtime Player restart / same Runtime Export reopenでRuntime Dynamics Tune Profileが復元されるか確認する。
3. 別Runtime Exportへ切り替えてstale tuningが適用されないことを確認する。
4. OBS Browser SourceでNative Stageと同じeffective dynamics tuningが使われるか確認する。
5. Reset groupでexported defaultsへ戻ること、Runtime Export artifactが更新されないことを確認する。
6. Performance Diagnostics / Browser Source manual checksでは、Dynamics Tune parity、Stage Motion、Variant switching、Wave10 local preview suspension/resumeも同時に確認する。
7. Native Stage Windowのmanual Electron verificationをlocal preview/fallback観点で実行する。
8. Real iFacialMocap + vowel-rig checks for Wave22/23 (closed-vowel coupling, transition form, “e” parasitism, “u” jitter, unsmoothed-step acceptability) remain pending; see [../implementation/waves/wave22/_map.md](../implementation/waves/wave22/_map.md) and [../implementation/waves/wave23/_map.md](../implementation/waves/wave23/_map.md)。
9. Dedicated Model / raw-input Diagnostics pagesをどのwaveで実体化するか。Performance DiagnosticsはWave13で別pageとして扱う。
