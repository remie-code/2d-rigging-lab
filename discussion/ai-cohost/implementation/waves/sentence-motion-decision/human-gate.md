# チャッピーの返事と仕草を実会話で確かめる

配信者による実会話確認は未実施。開発用の場と記憶を使い、一度の会話で声のテンポ、文に合わせた切替、同じ仕草の繰り返し、気になった台詞の記録を確認する。

1. 開発用の自律ホストでモデルを開き、場を始める前に Channel URL をコピーする。リポジトリ直下の `start-cockpit.cmd` から操縦席を起動し、開発用ロールの体を有効にして ElevenLabs を選び、Player を接続する。[起動と接続](../intent-motion/human-gate.md#起動)
2. ゲーム画面を共有できる開発用の場で、普段どおり数往復する。声がすぐ返るか、同じ返事の途中で納得から驚きに移るような箇所で仕草が文に沿うか、続けて納得したとき同じうなずきが最初から繰り返されないかを見る。読み返したい台詞の一部を控える。
3. 場を終えて、PowerShell で記録を開く。台詞が複数の場にあれば `sceneId` と `recordedAt` で今回の文を選ぶ。

   ```powershell
   $phrase = '控えた台詞の一部'
   Get-ChildItem 'apps/soul/agent/tmp/speech-intent-motion' -Filter '*.json' |
       Sort-Object LastWriteTime -Descending |
       ForEach-Object { Get-Content -LiteralPath $_.FullName -Raw -Encoding utf8 | ConvertFrom-Json } |
       Where-Object { $_.kind -eq 'sentence' -and $_.text.Contains($phrase) } |
       Select-Object -First 5 |
       ConvertTo-Json -Depth 12
   ```

`text` はその一文、`decisionInput` は判定に使った直前の会話と同じ返事の先行文。`decision` で生の選択と補完後の対象、`definition` で選択時の演技版、`audioPlayback` と `motionPlayback` で再生時の観測を読む。Player の要求受付と画面で見えた動きは別の観測になる。定義を開くときは同じ `definition` を使って SHA-256 を照合する。[保存した演技版の開き方](../all-motion-recording/human-gate.md)
