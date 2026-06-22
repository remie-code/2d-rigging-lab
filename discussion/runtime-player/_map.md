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
- Runtime Export loadとstatic Stage renderは実装済みだが、実物Runtime Exportでの視覚確認と後続input adapter作業が残っている。

## 5. Next Navigation

次に作業候補を選ぶ時は、まず [backlog/](backlog/) で延期タスクと実行triggerを確認し、その後必要に応じて [architecture/](architecture/)、[research/](research/)、[implementation/](implementation/) の詳細へ進む。
