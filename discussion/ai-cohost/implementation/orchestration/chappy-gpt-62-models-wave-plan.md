# チャッピーの会話モデルにGPT-6.2 AstraとSolを追加する

2026-11-18。作業ブランチは `codex/chappy-gpt-62-models`。実装・両モデルのCockpit実機確認とWindows小タスク確認が完了。[完了記録](../waves/chappy-gpt-62-models/completion.md)・[独立レビュー](../reviews/chappy-gpt-62-models/review.md)。

## 目的と事前実験

Cockpitの「準備・設定 → ロール → 動かすモデル」でチャッピーにGPT-6.2 AstraまたはGPT-6.2 Solを選び、保存して次の会話から使えるようにする。既存の選択を維持する。選んだCodexを記憶の参照・保存・整理とローカル小タスクにも引き継ぐことは意図した仕様。

Soulの会話処理から通常の購読認証で短いテキストを送り、現行0.163.0では両IDとも model_not_found、隔離した0.169.1では両IDとも low で完了。後者では thread/start のモデルIDが一致し、切替通知はなかった。製品の依存からの起動とCockpitの選択・保存はこのWaveで検証する。

## 1 Waveの作業と合格条件

1. Soulの直接依存 @openai/codex-sdk とlockfileを0.169.1へ更新。製品が既定で解決するCodex 0.169.1を使い、[Windows小タスクの合格条件](../waves/windows-codex-launch/completion.md)を代表1モデルで再確認する。親の環境は製品経路で処理し、担当先の読み書き・原本読取の成功、原本と別担当先への書込拒否を観測する。
2. 両候補の実行定義と表示を追加し、モデルIDを gpt-6.2-astra / gpt-6.2-sol、effortをlowとする。既存候補・ロールの既定値と保存値・担当の引継ぎを回帰確認する。
3. 隔離したCockpitで各モデルを選び、保存して再起動し、選択が残ることと実際の短い返答を確かめる。製品の設定保存・再読込・会話処理を通し、実行ファイルを差し替えず、開始時のモデルIDと応答完了を照合する。実際に操作した範囲と観測手段を記録する。試験用のロールと記憶は隔離した環境に置く。

## 簡易オーケストレーション

単一のOrchシルフが実装ノームと独立レビューシルフを順に起動する。全員GPT-6.2 Sol。レビューは差分、関連回帰、製品経路での両モデルの完了とWindowsの権限確認を照合する。実機記録は `waves/chappy-gpt-62-models/completion.md`、最終判定は `reviews/chappy-gpt-62-models/review.md` に残す。rootが完了報告を受け計画と地図を更新する。
