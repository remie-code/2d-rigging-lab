# Wave 2の受領記録

ソース・制御試験・配布物は[独立レビュー](../../reviews/performance-attention/wave2.md)で合格。通常版とportableを更新し、両方の隔離起動で再生を確認した。本人の実会話は[本人確認の手順](human-gate.md)に残る。

## 発話から演技と対象を選ぶ

一つのDecisionリクエストで演技と注意対象を独立に選ぶ。原意図タグと区間本文に、Fireが `askIncrementally` を始める時点の直前会話を添える。逐次経路は最初に確定した音声ジョブの本文、一括経路は確定した区間本文を使う。判定と記録の完了は音声経路の待機条件に含まれない。逐次経路の後続文は最終本文として記録する。

共有レジストリの6組から直接再生する。意味上の未対応3理由と、拒否・通信失敗・中断・モデル不一致を区別する。実WebSocketの制御試験は先行音声、判定順逆転、通常終了後の完走と遅着の無効化、割り込み・kill・世代交代・切断からの解除を通した。独立レビューでも同試験を再実行した。

## 実Decisionの合成例

現行の製品設定 `gpt-6-luna` で、非私的な合成入力を各1リクエストで確認した。短い安堵の3例は原タグと本文を固定し、直前会話だけを変えた。

| 演技 | 注意対象 | 組み合わせの判定 | Decision往復 |
|---|---|---|---:|
| `brief-relief` | `partner` | 制作済み | 1529ms |
| `brief-relief` | `game` | 制作済み | 321ms |
| `brief-relief` | `viewers` | 制作済み | 241ms |
| `none` | `viewers` | `unsupported-performance` | 250ms |
| `brief-relief` | `unknown` | `unknown-attention-target` | 258ms |
| `ask` | `viewers` | `unproduced-pair` | 226ms |

この6件の計測範囲は判定の往復。「ふぅ、ひとまず間に合った。」に同じ原意図タグを添え、相方からの呼びかけ、ゲーム画面のクリア表示、視聴者からの呼びかけの各文脈を渡した。[合成入力と判定結果](../../../../../tmp/performance-attention-package/decision-probe-observed.json)

判定を300ms保留した制御試験では、最初に安全に渡せる本文から模擬プレーヤーの `STARTED` まで逐次0.232–1.687ms、一括0.195–0.216ms。各3回で判定完了は302.120–312.924ms。実際の `SpeechStreamer` に模擬transport・TTS・プレーヤーを接続した計測。実会話での音声初動と通常環境での動き始めは未計測。[音声経路の計測](../../../../../tmp/performance-attention-package/audio-timing.json)

## 記録の互換性

`apps/soul/agent/tmp/speech-intent-none` の既存228ファイルを確認した。ファイル名でソートした各 `ファイル名 + 空白 + ファイルのSHA-256` をLFで連結したUTF-8のSHA-256は作業前後とも `22A599B6F8E80C9DEF5DEE8951A5CDD9F6ECE0F8124D20F81C822A0B96515696`。Reviewerも再計算した。新規のv3記録には原意図、判定時本文、最終本文、会話文脈、二回答、未対応理由、識別子、観測した音声再生範囲が入る。

合成例「みんなはどっちがいいと思う？北と南の二択だよ。」では、原タグは視聴者への問いかけ、判定時本文は最初の一文。`ask` と `viewers` が選ばれ、理由は `unproduced-pair`。プレーヤーが観測した2範囲はともに `completed` と記録された。[合成v3記録](../../../../../tmp/performance-attention-package/records/ab47786e3dab2270f751ac47c6ae2533fdd1d526d3ba51ceb77683da07c03148.json)

## 検査

| 検査 | 結果 |
|---|---|
| Runtime Player全体 | 155ファイル・1065件成功 |
| root packages | 標準 `test:unit` と同じ範囲で250ファイル・1552件成功 |
| Soul関連 | 164件成功。cockpitを含む集計は295件成功、重複あり |
| 型と境界 | rootとRuntimeの型検査、依存関係、Soul Zoneとfixtureの各検査に成功 |
| source organization | Wave 1で確認済みの `physiology/index.ts` のbarrel-only違反1件 |
| 独立再実行 | 実WebSocket統合1/1件とSoulの対象4ファイル成功 |

`preview-viewer-equivalence-fixture.test.ts` は既存の root `test:unit` の実行範囲に合わせて除外し、Wave 2 では単独実行していない。[標準コマンド](../../../../../package.json)・[試験集計とコマンド](../../../../../tmp/performance-attention-package/checks.json)

## 配布物

| 更新先 | バイト数 | SHA-256 |
|---|---:|---|
| `apps/runtime-player/dist/win-unpacked/Runtime Player.exe` | 232562176 | `e2c654585a9bc1f07db265007d48bbdb11ee4a57e4c08ff55aa20fc9f8406eac` |
| `apps/runtime-player/dist/Runtime Player 0.0.0.exe` | 93789349 | `a549b062495137c2728d6c86952ec11c857e787765b496050a17ae4ba453a777` |

通常版の `app.asar` とportableから展開した `app.asar` は同一SHA-256。通常版asarから直接取り出したメインバンドルは最新のビルド出力とバイト一致し、6組、3曲線とr804適用条件はソースJSONの全値と一致した。[配布物のハッシュ](../../../../../tmp/performance-attention-package/artifact-manifest.json)

両配布物を隔離環境で自律ホストとして開き、r804をロードしてStage Presence Offで6組を実WebSocket再生した。配布物の確認は直接指定と受信したフレーム値を用いた。通常版の相方向け短い安堵は早期の `end` 後にも胴X −5.80付近に達し、新3組はStage Yの基底34pxへ戻った。portableの初回は展開後の初期IPC観測が4秒の上限に達し、上限を15秒に変更した再試行で同じ6組を確認した。[通常版の隔離確認](../../../../../tmp/performance-attention-package/proof-TejEQd/report.json)・[portableの隔離確認](../../../../../tmp/performance-attention-package/proof-GwQzdy/report.json)
