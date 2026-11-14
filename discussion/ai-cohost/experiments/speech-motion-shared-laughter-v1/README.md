# 一緒に笑う — 視聴者向け v1

Astraによる無音の動き試作。採用済み閉眼笑顔 **r824** を読み取り専用で使用する。笑顔差分の採用を、この演技の採用とは扱わない。

「面白さに乗る → 笑いがこぼれる → 共有したまま収まる」を狙った。基準の言葉は「『こいつ倒して終わろう』が、もう一戦増える合言葉になってきたね。」。ただし実音声は使っておらず、発話との同期を実証したものではない。

## 見るもの

- `viewers.mp4`: 6.25秒、20fps、125フレーム、無音。大きな顔/上体と小サイズを同時表示。
- `contact-sheet.png`: 主な12姿勢。
- `curves.png`: 笑顔入力、顔Y、頭/上体Z、実際のStage Y。
- `definition.json`: 曲線、対象、画角、Stage入力、仮口パクの定義。
- `evidence.json`: 全フレームの時刻、モデル入力、Stage要求/出力、PNGハッシュ。
- `provenance.json`: 読んだr824パッケージの全ファイルハッシュ。
- `verification.json`: 読取元不変、通常blinkなし、Hostとの一致、Stage解除の確認。

## 今回の動き

正面ニュートラルから、目線が少し上の視聴者へ向かう間に笑みが立ち上がる。顔が後を追い、閉眼付近で一拍目が弾む。Stageは1.51秒に上へ約12px、1.98秒に小さい二拍目として上へ約6px。頭の上下/傾きは上体とStageから約0.1秒遅らせ、同時に全身が止まる動きを避けた。数字は今回の演出記録であり、笑いの一般処方ではない。

2.7秒頃までに弾みを収め、笑顔の保持を挟んで目を開く。Stageは3.2秒で0となり、その後の自然解除まで映している。目の笑みが0へ戻った後も、視線Y0.34・顔Y3.5°・頭Z0.5°・上体Z0.4°を残し、上の相手への注意を保つ。全入力を一斉に初期値へ戻す演出にはしていない。

通常のblinkは重ねず、両EyeOpenは全125フレームで1。`param_shared_laughter` が採用済み笑顔を閉じる。口は既存のMouth Openと母音変形を使う小さな仮口パクのみ。新しい笑い口は作っていない。

## 描画とStage

使用モデル: `C:/workspace/remie/rigging/astra-chan/workspace-notes/shared-laughter-closed-eyes-v1/saved-r824`。

authoringパッケージを既存の `evaluatePerceptionSnapshot` でruntime graphへ変換し、既存 `compileRuntimeModel` / `evaluateRenderFrame` でフレームを評価した。UV・texture・mask・draw orderはHostの描画sceneを利用し、software rendererで描画している。新しいエンジン機能は作っていない。動的物理はdeltaTime0/resetで固定し、今回は作者が与えた頭・上体・視線の動きを見る。

Stage Yは製品の `SpeechMotionState` と `RuntimePlayerStageMotionRuntime` を使用。Presence Off、入口180ms、自然解除を含む。定義のStage時刻はこの180ms後を原点とする。返されたpan.yを、描画viewportのminYへ同じ画素数になるよう換算した。画像を後から切って上下させた近似ではないが、GUIやWebSocket、実配信での表示確認ではない。

Stageのpxは624×660の大きいプレビュー画角基準。右の220×233表示は同じ描画全体を縮小した仮の配信内表示例で、実OBS配置ではない。

## 確認と残る判断

開始・一拍目・終端（frame0/30/124）は通常Hostの `renderPerceptionView` とPNGバイト一致。source全ファイルの前後ハッシュ一致。モデル変更、製品登録、現用r804 Export更新、atlas更新、commit/pushは行っていない。

全フレームでEyeOpen1、横向き0°（上限±24°以内）、非有限頂点なし。Stageの最小値はサンプリング上約-11.989px、最大5px、終端0。MP4全フレームのデコード成功。制作担当が主要姿勢/小サイズを目視した。

静止画では閉眼笑顔が読みやすく、一拍目と二拍目の姿勢差も見える。実時間での弾みの強さ・テンポが「つられて笑う」と感じられるかは、ユーザーが動画で判断する対象。通常瞬きを重ねた場合、他の現在姿勢からの接続、実音声同期、製品の演技終了時の頭/視線解除は未検証。笑顔素材自体に既知の交換窓の細線/毛先残差と既存前髪境界があり、今回修正していない。

## 再現

repo rootで実行する。標準出力先は `tmp/speech-motion/shared-laughter-v1-reproduction`。モデルは読み取りのみ。Nodeの既存TS resolverと、この試作用のJSON loaderを使う。JSON loaderは既存runtime-playerのJSON importをNodeから読むためだけの補助で、製品コードを変更しない。

```powershell
node --import file:///C:/workspace/remie/rigging/astra-chan/workspace-notes/tools/player-ts-loader.mjs --import ./discussion/ai-cohost/experiments/speech-motion-shared-laughter-v1/json-loader.mjs ./discussion/ai-cohost/experiments/speech-motion-shared-laughter-v1/render.mjs
node --import file:///C:/workspace/remie/rigging/astra-chan/workspace-notes/tools/player-ts-loader.mjs ./discussion/ai-cohost/experiments/speech-motion-shared-laughter-v1/verify.mjs
python ./discussion/ai-cohost/experiments/speech-motion-shared-laughter-v1/assemble.py
```

`SHARED_LAUGHTER_OUT`で描画・検証の出力先を変更できる。assemble.pyには同じ出力先を第一引数で渡す。Python Pillowとffmpegが必要。

最終整理時、既存r804の記録済みハッシュと現用Export全4ファイルを照合して一致した。rootも主要姿勢シートを目視し、この候補をユーザーへ提示する方向で受領した。連続した動画の印象についての本人評価はこれから。

