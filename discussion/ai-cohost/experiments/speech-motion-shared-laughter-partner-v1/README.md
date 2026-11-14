# 一緒に笑う — 相方向け v1

Astraによる演技試作。採用済みの笑いv2を土台に、正面から相方（キャラ右・画面左）へ向きながら笑いを共有する。採用済みモデルr824を読み取り専用で使用した。今回の動き自体の本人評価はこれから。

## 成果物

- `partner.mp4`: 大きな顔/上体と配信内小サイズを同時表示。6.25秒、20fps、125フレーム、無音。
- `contact-sheet.png`: 主要12姿勢。
- `definition.json`: 時刻付きモデル曲線、Stage Y、画角、仮口パク。
- `evidence.json`: 全125フレームの入力値、実Stage変位、PNGハッシュ。
- `provenance.json` / `verification.json`: source識別・非変更と限定検証。

口は既存口パクによる小さな仮演技で、実音声とは同期していない。瞳XYは全区間0、通常blinkは重ねず両EyeOpenを1固定した。笑顔は既存 `param_shared_laughter` で動く。新しい顔・口・眉は作っていない。

## 演出

笑いv2の笑顔曲線、Stageの大小二拍、仮口パクの時刻/強さはそのまま保持した。顔X・上体X・頭/上体Z・顔Yを相方へ向く流れとして新しく作った。

顔が0.23秒から画面左へ向き始め、上体が少し後を追う。その途中で笑みがこぼれ、1.25秒頃に顔X約-17°へ落ち着く。閉眼笑顔と一拍目の弾みをつなぎ、頭は上体/Stageに少し遅れてつく。二拍目は小さく、揺れが収まってから目を開く。終端では顔X-14.5°・上体X-4°を残して、相方との共有を切らない。

向きの負符号は採用済み相方安堵の定義と照合し、描画でも画面左を向くことを確認した。最大横向きは約17.8°で、±24°以内。制作担当とrootは主要姿勢シートを目視し、向き始め・笑顔・二拍・相方へ姿勢を残す流れを確認した。実時間でのテンポや楽しさの最終判断はユーザーが動画で行う。

## モデル・描画・確認

source: `C:/workspace/remie/rigging/astra-chan/workspace-notes/shared-laughter-closed-eyes-v1/saved-r824`。

既存authoring → runtime-coreのcompiled render frame → software描画を使用。Stage Yは既存 `SpeechMotionState` と `RuntimePlayerStageMotionRuntime`、Presence Off、入口180ms・自然解除を含む。Stageの出力panをviewportへ同じ画素数で換算した。624×660の大表示で一拍目約-12px、二拍目約-6px（負は上）。小サイズは同じ描画を220×233へ縮小した仮の配信内表示で、実OBS配置ではない。

確認済み:

- 開始・一拍目・終端の3姿勢は通常Host描画とPNGバイト一致。
- saved-r824全ファイルの前後ハッシュ一致。
- 全125frameで瞳XY0、通常blinkなし、横向き上限内、非有限頂点なし。
- Stageは収束/自然解除後0。解除後と目を開いた後も動画内に含む。
- v2の笑顔曲線・Stage定義・仮口パク定義が一致。
- MP4全フレームをデコード確認。

モデル本体、現用r804 Export、atlas、エンジン、製品登録は変更していない。commit/pushなし。物理はdeltaTime0/resetで固定しており、今回見るのは作者が与えた顔/上体/Stageの動き。現在の別姿勢からの接続、音声同期、製品での頭/視線解除、通常blinkとの合成は未確認。採用笑顔にある既知の交換窓の線の差は今回作り直していない。

## 再現

repo rootで実行。出力は `tmp/speech-motion/shared-laughter-partner-v1-reproduction`。`SHARED_LAUGHTER_OUT`でrender/verifyの出力先を変更でき、その場合assemble.pyにも同じパスを第一引数で渡す。

```powershell
node --import file:///C:/workspace/remie/rigging/astra-chan/workspace-notes/tools/player-ts-loader.mjs --import ./discussion/ai-cohost/experiments/speech-motion-shared-laughter-partner-v1/json-loader.mjs ./discussion/ai-cohost/experiments/speech-motion-shared-laughter-partner-v1/render.mjs
node --import file:///C:/workspace/remie/rigging/astra-chan/workspace-notes/tools/player-ts-loader.mjs ./discussion/ai-cohost/experiments/speech-motion-shared-laughter-partner-v1/verify.mjs
python ./discussion/ai-cohost/experiments/speech-motion-shared-laughter-partner-v1/assemble.py
```

Node、Python Pillow、ffmpegを使用。JSON loaderはNodeから既存runtime-playerのJSON importを読む試作用補助で、製品コードを変えない。
