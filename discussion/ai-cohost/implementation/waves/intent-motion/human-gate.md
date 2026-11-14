# チャッピーとの実会話で確かめる

実会話は未実施。会話の中で動きを見たあと、未対応の意図を一件一緒に読み返す。Runtime のビルドと実モデルの隔離描画は確認済み。portable 版は自律ホストとして隔離起動し、Control Window と Stage Window の生成を確認した。モデルを開いて操縦席をつなぐ操作は実会話で確認する。

## 起動

1. 以前の自律ホストを閉じ、リポジトリ直下の PowerShell から Windows x64 portable 版の Runtime Player を自律ホストとして開く。

   ```powershell
   & '.\apps\runtime-player\dist\Runtime Player 0.0.0.exe' --role=autonomousHost
   ```

2. Control Window でモデルを確認する。必要なら **Open Export** で `C:\workspace\remie\rigging\astra-chan\exports\astra-chan-runtime` を開く。Stage Window にモデルを表示し、**Channel → Open Channel → Copy Channel URL** を選ぶ。
3. AivisSpeech を起動する。ElevenLabs の口パクも読みの取得に使う。旧版の操縦席を開いている場合は場を終えてから終了し、いつもの権限でこのブランチの `start-cockpit.cmd` を起動する。
4. 操縦席の **準備・設定** で、体を使うチャッピーのロールを選ぶ。**ロール** タブの **声** が **ElevenLabs** でなければ変更して **ロールを保存**。普段の声 ID はそのまま使う。**配信の準備 → 器（Channel）** にコピーした URL を設定し、接続を確認する。
5. 操縦席から新しい場を開始する。この起動で読み込んだ指示と、体あり・ElevenLabs の設定で自由意図の教示が有効になる。ローカルで会話する場合は **配信を始める** でマイクを開き、チャット URL と Discord の接続は入れずに進める。

## 会話と読み返し

いつもどおり何往復か会話する。受け取ったときの小さな頷き、関心や問いかけで画面左に注意を向ける動き、問いの後に返事を待つ短い姿勢を見る。発話の内容とともに口が動き、音声が先に始まっても後から姿勢が自然につながるかを確かめる。

場を終えたら、リポジトリ直下の PowerShell で未対応の最新記録を開く。更新時刻と場の識別子で今回の会話の記録か確認する。

```powershell
$entry = Get-ChildItem apps/soul/agent/tmp/speech-intent-none -Filter *.json -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
if ($entry) {
    $entry | Select-Object Name, LastWriteTime
    Get-Content -LiteralPath $entry.FullName -Raw -Encoding utf8
}
```

`intent`、`text`、`context` を読み合わせ、どんな動きならその意図が伝わるか話す。 `text` は取得済みの生成本文。 `audioPlayback.ranges` はその本文中の位置とプレーヤーの観測状態を示す。 `completed` は開始と終了を両方確認した範囲。 `started-incomplete` は開始後に終端を確認できず、実際に聞こえた文字数は不明。 `unknown`、`not-started`、`not-enqueued` も区別して読む。 `playbackState` は判定が返った時点のモーション制御状態。

今回の会話で未対応が出なければ、その時点では読み返しゲートは未達のまま、会話を続けて新しい記録が出た時に開く。
