# 普段の Runtime Player でステージの上下動を確かめる

本人確認は未実施。この手順は上下動の確認用。安堵の演技はこの確認のあとに制作する。

1. 既に Runtime Player を開いている場合は、普段の終了操作で閉じる。リポジトリ直下の PowerShell から更新版を開く。

   ```powershell
   & '.\apps\runtime-player\dist\win-unpacked\Runtime Player.exe' --role=autonomousHost
   ```

2. Control Window の **Open Export** で、必要なら `C:\workspace\remie\rigging\astra-chan\exports\astra-chan-runtime` を開く。Stage Window にモデルを出し、**Physiology → Stage Presence** をオフにする。位置は普段の手動配置のままでよい。今回の確認入力は大きめに動くので、頭や足まで見たい場合はあらかじめ上下に余白を取る。
3. **Channel → Open Channel → Copy Channel URL**。保存した確認用演技を以下の手順で送る。声やマイクを用意する必要はない。

   既存の操縦席などから Channel を使用中の場合は、確認が終わるまでその場を停止しておく。リポジトリ直下の PowerShell で以下を実行する（Node.js 24）。URL はクリップボードから読み、画面には表示しない。

   ```powershell
   $env:RUNTIME_PLAYER_CHANNEL_URL = Get-Clipboard
   $motion = 'discussion/ai-cohost/implementation/waves/stage-vertical-motion/evidence/stage-y-motion.json'
   node apps/runtime-player/scripts/replay-stage-y.mjs $motion --without-stage-y
   node apps/runtime-player/scripts/replay-stage-y.mjs $motion
   Remove-Item Env:RUNTIME_PLAYER_CHANNEL_URL
   ```

4. まず Native Stage で、上下指定なしの動きと上下指定ありの動きを比べる。最初は軽くうなずくだけ。2回目はうなずきとともにモデル全体が上へ90px、次に基準より下へ65px動き、最後に元の配置へ戻る。左右移動と拡縮の設定はそのままでよい。
5. Browser Source でも確認するなら、**Stage → Browser Source Output → Copy URL** でコピーし、ブラウザーまたは OBS の Browser Source に開く。手順3をもう一度実行する。表示の大きさが異なっても移動量は論理pxで同じで、画面に占める割合は異なる。Browser Source に接続すると Native のライブプレビューが一時停止するため、順番に確かめればよい。

見たいポイントは、上下がモデル全体の動きに見えること、頭・姿勢の動きが残ること、終了後の戻りが自然に見えること。本人の見え方は機械検証と別に記録する。



