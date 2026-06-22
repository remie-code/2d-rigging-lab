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
- Runtime Player Wave6 final clean integration reviewは別Review-Sylph artifactとして未実施。
- Persistent Model Mapping Profile save、advanced mapping editor、head-position Stage Motion、near/far distance response、Broadcast/OBS UX、TCP transport、dedicated Model/Stage/Diagnostics pagesはfuture。

## 5. Next Navigation

次に作業候補を選ぶ時は、まず [backlog/](backlog/) で延期タスクと実行triggerを確認し、その後必要に応じて [screens/](screens/)、[architecture/](architecture/)、[research/](research/)、[implementation/](implementation/) の詳細へ進む。
