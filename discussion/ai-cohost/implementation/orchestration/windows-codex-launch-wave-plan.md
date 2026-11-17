# WindowsでCockpitからCodexを起動する際の環境継承

2026-11-18。ブランチ `codex/discord-companion-inputs`。製品の小タスク経路でWindows実機確認に合格。Soul全2,574件成功。[完了記録](../waves/windows-codex-launch/completion.md)・[独立レビュー](../reviews/windows-codex-launch/review.md)。

Desktopから継承した `CODEX_WINDOWS_REGISTERED_CORE=1` があると、Soulのnpm依存のCodex 0.163.0は初期化に成功してもシェルの起動時にパッケージIDを要求して失敗する。事前の実機比較では、サービス名の探索に使う `CODEX_WINDOWS_SANDBOX_PACKAGE_FAMILY` を保持してCOREの指定だけを子から外すと、担当先への書き込みと原本の読み取りが成功した。前段の[小タスク実験](../waves/local-task-sessions/local-task-experiment.md)も参照。

## 1 Waveの実装と合格条件

- 共通のCodex起動処理で、Windows・既定npm実行ファイル・自動継承のときに限り、子へ渡す環境のコピーから登録済みCoreの指定を除く。親環境、FAMILYを含む他の変数、実行ファイルまたは環境の明示指定を尊重する。
- 登録情報を持つ親から製品の共通処理で起動する。テスト側で子の環境を補正せず、合成資料を読み、担当の作業先へ書き戻せること、原本と別担当領域への書き込みが拒否されることをWindowsで確認する。書き込み範囲・ネットワーク・承認の設定は既存の小タスク条件を使う。
- 変更を拾える回帰テストと実機の結果を独立レビューする。実Discordでの参加者との会話は[既存の本人確認](../waves/local-task-sessions/human-gate.md)が受け持つ。`index.ts` の規約チェックは別件。

## 体制

単一Orch → 実装ノーム → 独立レビューシルフの簡易構成。全員GPT-6.2 Sol。Orchが実装結果とレビューを照合し、必要なら修正と再レビューを行う。レビューは `reviews/windows-codex-launch/review.md`、実機検証は `waves/windows-codex-launch/completion.md` に記録する。rootが結果を受領して計画と地図を更新する。
