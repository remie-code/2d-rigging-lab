# Wave81 Dynamics Time Progression Status

> 状態: Wave81 post-check / repository fact / 2026-06-18.
> 目的: Dynamics Tool preview が現在「driver変更ごとに1 stepだけ進む」実装であり、時間経過で揺れ続ける preview/playback は未実装であることを、画面仕様ではなく実装ステータスとして記録する。

## 1. 観測されたユーザー操作

1. PSDを読み込む。
2. 前髪のDrawableにメッシュを生成する。
3. 前髪にWarp Deformerを作成する。
4. 髪揺れParameterにkeyformを打ち、Warp Deformerの動きを設定する。
5. Dynamics Groupを作成する。
6. Inputに `Face Angle X` を設定する。
7. Outputに、手順4で設定した髪揺れParameterを選ぶ。
8. Dynamics Inspector内の `Face Angle X` preview sliderを動かす。
9. 髪揺れParameterにDynamics出力が反映され、Canvas preview上の前髪が動く。

このとき、sliderを動かした瞬間の反映は行われるが、その後に振り子のような時間経過の揺れや減衰は継続しない。

## 2. 現在の結論

この挙動はWave81実装の範囲では想定通りである。

Wave81は、Dynamics Groupのv2契約、複数Input、1 pendulum / 1 output、additive output、Editor Dynamics Toolでのsession-local preview、Canvasへのpreview parameter map注入を実装した。

一方で、次はWave81の範囲外だった。

- Editor Dynamics Tool previewを `requestAnimationFrame` 等で継続駆動するanimation loop。
- Viewer / Runtime Viewでの時間経過playback。
- Viewer側のreset simulation / pause / playback controls。
- frame stepping UI。

frame stepping UIは、現時点のUX判断では不要である。

## 3. 実装事実

Editor Dynamics Tool previewでは、driver値変更時に1回だけlocal solverを進める。

- `apps/editor/src/workspace/panels/dynamics-tool-inspector.tsx`
  - preview slider / number input の `onChange` が `setDynamicsToolPreviewDriverValue(...)` を呼ぶ。
- `apps/editor/src/features/editor-session/model/dynamics-tool-state.ts`
  - `setDynamicsToolPreviewDriverValue(...)` がdriver値を保存し、`stepDynamicsToolPreview(...)` を1回呼ぶ。
  - `DYNAMICS_TOOL_PREVIEW_STEP_MS = 16.6666667` を固定stepとして使う。
  - `stepDynamicsToolPreview(...)` はsource velocity / acceleration、pendulum reaction / sway / convergenceから次stateを計算する。
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
  - preview driver values / simulation statesをReact local stateとして保持する。
- `apps/editor/src/workspace/panels/canvas-preview-panel.tsx`
  - Dynamics modeでは通常のParameter Bar値ではなく、Dynamics preview evaluationのparameter mapをCanvas evaluationへ渡す。

このEditor preview経路には、driver変更後に継続してstateを進めるtimer / animation schedulerがない。

確認対象:

- `requestAnimationFrame`
- `setInterval`
- `setTimeout`

## 4. Runtime Core側の状態

`packages/runtime-core/src/dynamics-evaluation.ts` には `stepDynamics(...)` があり、runtime dynamicsのstep評価を行える。

`packages/runtime-core/src/runtime-core.ts` のruntime evaluationは `deltaTimeMs`、accumulator、fixed step、substepに基づいてstateを進める構造を持つ。

つまり、headless/runtime側には「呼び出し側が時間を渡せば進められる」契約がある。ただし、Wave81時点のEditor Dynamics Tool previewとViewer UIは、そのruntime progressionを継続駆動していない。

## 5. なぜ単発反映になるか

現在のEditor previewでは、driver sliderの変更イベントが1回発生すると、solverが固定step分だけ1回進む。

slider操作が止まると、次のstepを発火するclockが存在しない。そのため、angular velocity、restoring force、convergenceによる減衰tailが継続計算されない。

したがって「値を動かした瞬間に反映されるが、その後に揺れ続けない」という挙動になる。

## 6. 次に分けるべき実装境界

この状態から必要な実装は2つに分かれる。

1. Dynamics Tool preview animation loop
   - Dynamics Inspectorでdriver previewを動かした後、authoring previewとして揺れと減衰を継続表示する。
   - Dynamics Tool中のCanvasは通常Parameter Barから分離されたruntime-like previewとして扱う。
   - Preview stateは引き続きsession-localで、operation history / portable saveには入れない。

2. Viewer / Runtime View time progression
   - 完成品確認として、Viewer上でruntime frameを時間経過に沿って評価する。
   - reset simulation / pause はViewer v1以降のUIとして検討対象にする。
   - frame stepping UIは現時点では不要。

両方が揃って初めて、「Dynamics設定中に揺れを調整できる」体験と「完成モデルとして揺れを確認できる」体験が接続される。

## 7. 実装リスク

Wave81のEditor previewは、runtime-coreの進行契約とは別にEditor-localの `stepDynamicsToolPreview(...)` を持っている。

このため、次waveで継続previewを入れる場合は、Editor-local solverをそのままtimerで回すか、runtime-coreのstep/evaluationを再利用するかを決める必要がある。

推奨は、可能な範囲でruntime-core側の契約を使い、Editor previewとViewer playbackの挙動差を増やさないこと。ただし、Editor previewはsession-localであるべきなので、永続化やhistoryには接続しない。
