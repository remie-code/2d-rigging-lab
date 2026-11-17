# Real-world Companion Map

> チャッピーと外出先・家で過ごすためのデバイス、視界、音声会話の議論。2026-11-16 に新トピックとして記録。Discord 専用・スマートグラス専用にはしない。

## 入口

現在の実装: [小タスクセッション共通基盤の3 Wave](../implementation/orchestration/local-task-sessions-wave-plan.md)は実装・独立レビュー合格。記憶参照と共通の基盤から毎依頼新規sessionを起動し、PDF後半をローカル小タスクで調べられる。仕事の進め方は担当LLM、Cockpitは実行・配送・場の寿命管理。資料は記憶保存・必要整理後に片付ける。2026-11-16、本人確認待ち。[本人確認手順](../implementation/waves/local-task-sessions/human-gate.md)へ。

前段: [Discordチャット資料・モバイルVC操作の2 Wave計画](../implementation/orchestration/discord-companion-inputs-wave-plan.md)。読むチャットの設定とDiscordからの参加／退出を追加。初版のPDF先頭3ページ方式は上記小タスク方式へ置換。Botの設定・コマンドは[Discord初期手順](../implementation/waves/discord-companion-inputs/human-gate.md)を参照し、PDFの古い上限説明は現行仕様として読まない。

| File | 内容 | 状態 |
|---|---|---|
| [scope-and-decisions.md](scope-and-decisions.md) | 二つの体験、安全に使えるデバイスの条件、共通にしたい境界、未決事項 | 体験の方向を合意。機器・方式・実装は未決 |
| [vision-and-chat-input.md](vision-and-chat-input.md) | 視界の取得許可、最小構成の写真共有案、ユーザーには見えないチャットを読む将来条件 | 指定チャットのテキスト・画像・PDFを当面の対象とした。書き込みは別途検討 |
| [mobile-vc-control.md](mobile-vc-control.md) | Discord側からチャッピーのVC参加・退出を操作する要求 | PCで場を開く既存の流れは維持。遠隔起動・場の遠隔作成は要求外。UI・実装は未決 |
| [repository-inventory-2026-11-16.md](repository-inventory-2026-11-16.md) | 既存 Discord 音声・視覚・操縦席の限定的な棚卸し | コード読解のみ。外出時の実機検証なし |
| [discord-private-handout-history-2026-11-16.md](discord-private-handout-history-2026-11-16.md) | 秘匿ハンドアウトの直接受領、Discordの個別テキスト、VC付属チャットの過去議論 | 原記録を確認。いずれも当時は将来候補。秘匿資料の受け渡し先は未特定 |

## 次の議論

- その際、家の固定カメラ＋PCでも成立する共通部分を、外出側の条件で狭めない。
- Discordチャットの新規テキスト・画像・PDFを取り込み、VCで「今チャットに貼った、見れる？」と話せる体験を作る。読む先はCockpitで指定・変更。ライブ映像配信は今回の対象外。
- 開いているDiscordの場に対するVC参加・退出をDiscord側から操作する。権限はDiscord標準に準拠。具体手順・実証結果は上記計画から辿る。

## 関連

個人向けのデバイス選定記録は同階層の `audio-devices-*.md` にローカル保存し、Gitでは追跡しない。clone先にこの記録がなくても、本トピックの要求・合意を辿れるようにする。

- [AI Cohost](../_map.md)
- [Discord VC](../discord-vc/_map.md)：既存の通話体験の議論。現行コードの入口は今回の棚卸しを参照。
