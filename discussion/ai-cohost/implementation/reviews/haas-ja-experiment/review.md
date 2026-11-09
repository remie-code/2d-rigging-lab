# Haas-ja 比較実験 Domain A レビュー

- 判定は **実装合格・人間ゲート待ち**。独立Review-Sylph一人が初回を確認し、二つの指摘を限定再確認した。
- 対象は [wave計画](../../orchestration/haas-ja-experiment-wave-plan.md)、`apps/soul/agent/scripts/haas-experiment*.mjs` 4ファイル、`apps/soul/agent/.gitignore`。

## 設計と測定条件

マイクから一度取り込んだPCMをメモリに保持し、方式ごとに同じ音声を実時間で再生する。共通VADの区間・推定起点・認識器に渡すWAVのSHA-256が一致する場合だけ、対応する結果として扱う。区間なし・複数区間・空転写・認識失敗を区別する。両認識器は常駐し、比較時の推論は順次実行する。

- 実発話末尾からの厳密な実測は欠測。`replayEndEstimateToFinalMs` はVADで無音判定が始まった時点から確定までの再生内の推定で、区切りの待ちを含む。録音機器の取り込み遅延は含まない。両方式に同じ起点を使うため、共通の区切りを通した相対的な待ち時間を比較できる。実音声での末尾推定誤差は未測定。
- Zipformerは操縦席の共通設定のみを反映し、ロールによる語彙の上書きは適用しない。Haasは語彙補助なし。この条件での固有名詞は参考として扱う。両条件を端末表示とJSONに明記した。
- 音声はメモリ内のみ。比較の転写・計測はGit対象外のローカルJSONに書く。Haasのワーカーとは標準入出力で通信する。本番の耳のコードには差分がない。

## 検証結果

- GnomeがWindows上で配布SHA-256を照合した `speech.cpp` v0.10.1 x64 Vulkan、Haas-ja-v1.0 Q8_0、RTX 4070 SUPER、既定CPUデコーダーで確認。同じ常駐ワーカーで公開JSUT試験音声を3回続けて転写できた。修正後の比較CLIも、実Haas・実Zipformerへ同じJSUT音声を渡し、両方の転写が返ることを確認した。試験は動作証拠として扱う。
- 独立レビューで対象テスト3件合格。合成音声末尾480ms、VAD確定928ms、認識時間60ms／20msの例で、共通起点を使い待ち時間を508ms／468msと分けて算出できることを確認。
- 修正後の `node --test --test-reporter=spec` は2518件全件合格。 `pnpm.cmd --config.manage-package-manager-versions=false run check:soul-zone`（1652ファイル）と `git diff --check` は合格。

## 人間ゲート

リポジトリルートで `node apps/soul/agent/scripts/haas-experiment.mjs` を実行する。操縦席に記憶されたマイクと異なるものを使うなら `--device "マイク名"` を指定する。各案内でEnterを押し、「どうぞ」のあとに短く一度だけ発話し、次の案内まで待つ。4種類で約1分半。結果は `apps/soul/agent/haas-experiments/<UTC時刻>.json`。ここまでの実動作と独立レビューはユーザー音声を使わず実施した。
