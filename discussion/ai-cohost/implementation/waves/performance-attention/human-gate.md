# チャッピーとの実会話で確かめる

本人確認は未実施。チャッピーとの実会話で、対象に合う動きと自然な終わりを見て、未対応が出たら記録から次に作る動きを相談する。

## 起動

普段の Runtime Player を自律ホストとして開く。リポジトリ直下の PowerShell から起動できる。

```powershell
& '.\apps\runtime-player\dist\win-unpacked\Runtime Player.exe' --role=autonomousHost
```

portable を使う場合は `apps/runtime-player/dist/Runtime Player 0.0.0.exe` を同じ引数で開く。Control Window に r804 のモデルが表示されていることを確認する。必要なら **Open Export** から `C:\workspace\remie\rigging\astra-chan\exports\astra-chan-runtime` を開く。チャッピーの操縦席との接続は[従来の起動手順](../intent-motion/human-gate.md#起動)に沿って行う。

## 会話と記録

- 普段どおり会話し、相方へ向く画面左、ゲームを見る正面、視聴者へ向ける上の動きを見る。音声が先に始まった場面で、後から動きが自然につながるかを見る。
- 短い発話が通常終了したあと、始まっている動きが自然に戻るかを見る。別の発話に移ったり割り込んだりした場面では、前の動きが残り続けないかを見る。
- 場を終えたら、未対応の新しい記録を場の識別子と更新時刻で探す。原意図、区間本文、文脈、演技と対象の選択、未対応理由を照らし合わせ、次に作る動きを考える。音声範囲はプレーヤーが観測した開始・終了を示す。

リポジトリ直下の PowerShell から最新記録を開ける。

```powershell
$entry = Get-ChildItem -LiteralPath 'apps/soul/agent/tmp/speech-intent-none' -Filter *.json -File |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
if ($entry) {
    $entry | Select-Object Name, LastWriteTime
    Get-Content -LiteralPath $entry.FullName -Raw -Encoding utf8
}
```

新しい形式は `version: 3`。`rawIntentTag`、`text`、`decisionInput.text`、`context`、`performanceId`、`attentionTargetId`、`reason`、`audioPlayback.ranges` が読み返す入口。今回の場で未対応の記録が出たときに開く。
