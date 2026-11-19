# Wave 5 初見探索と全体回帰

[計画](../../orchestration/soul-structure-refactor-wave-plan.md)・[Wave 4](wave4-completion.md)

## 改善前に初見で読んだ順

前の Wave に参加していない担当が、計画・実装記録を読む前に、README と実際の入口から調べた。

| 問いと最初の検索 | 読んだ順と迷った箇所 | 守る既存の回帰 |
|---|---|---|
| 配信の発話中に届いた YouTube コメント。`YouTube`、`commentBusy` | README の S7 → `mind/fire-scheduler.mjs` → server の `handleCommentBusy` と `commitComment` → `mind/comment-react.mjs`。S7 が従来モードを案内するため speak-now の保持・破棄も scheduler に見えた。Discord の判定前後の拒否と資料チャットの入口を別に追った。 | `comment-react.test.mjs`、`cockpit-server.test.mjs` の busy 設定と実結線、`cockpit-server-discord-final.test.mjs` の Discord と次の配信の分離。 |
| VC だけを抜けて再参加。`leave`、`rejoin` | README から手掛かりを得られず、`scripts/discord-venue.mjs` → 通常 UI → HTTP routes → `handleDiscordVc` → `discord/discord-experience.mjs` へ。退出では音声接続、各人の受信、再生先を畳み、場の正本・頭・判定・目を保つ。閉場は `venue/lifecycle.mjs` または遠隔 `venue/remote-close.mjs` へ分かれる。 | `discord-experience-discord-i.test.mjs`、`cockpit-server-discord-i.test.mjs`、`cockpit-discord-final-2.test.mjs`。 |
| 資料を読んでいる途中の閉場。`閉場`、`material` | `cockpit-stream.test.mjs` → `venue/lifecycle.mjs` → server の drain/save 結線 → 場の資料台帳 → `venue/role-hooks.mjs` → `mind/venue-memory-recorder.mjs`。通常と遠隔は見つかったが、場の資料台帳だけ `venue/` の外にあった。 | `cockpit-stream.test.mjs` の閉場、資料・返答が writer に届くまでの待機、整理後の解放、終了未確認時の保持。`discord-venue.test.mjs` の段ごとの再試行と保留。 |

新しい HTTP 操作は `http/cockpit-http-server.mjs` のルート表から server の指名操作へ辿れた。診断は端末向けの整形、Fire の構造化記録、SSE の発生元・表示を順に追えた。`run-cockpit.mjs` に頭の世代・再作成と Fire の資源確保が残る。今回の三つの変更先には直接影響しないため、場の発見性に関わる箇所を優先した。

## 改善後の配置

- [Soul の現在構造](../../../../../apps/soul/README.md#現在の構造)から、典型的な変更先を入口ごとに読める。
- `src/chat/youtube-comments.mjs` に接続、場の世代、guard、転写と発話経路の選択を揃え、speak-now の busy 方針は `src/mind/comment-react.mjs`、従来モードの機械発火は `src/mind/fire-scheduler.mjs` にある。Discord の資料チャットは `src/discord/discord-chat-materials.mjs`。
- `src/cockpit/venue/task-resources.mjs` とテストが場の通常・遠隔閉場と同じ `venue/` にある。公開転写は `src/cockpit/cockpit-public-transcript.mjs` に移し、状態スナップショットの器官横断の読み出しは `cockpit-server.mjs` に保持した。
- 対象 7 ファイルで 284/284 件成功。両モードの隔離実 Git、通常・遠隔閉場、コメントの順序と遅延判定、Discord の経路の分離、資料を含む。Soul の構成チェック、境界 1747 ファイル、構文、差分チェックに成功した。

## 改善後の初見再探索

もう一人の未参加担当が README「現在の構造」から読み始め、計画なしで三つの変更先と守る回帰へ辿った。

- 配信は `chat/youtube-comments.mjs` → `mind/comment-react.mjs` または `mind/fire-scheduler.mjs`。Discord への影響は `discord/discord-chat-materials.mjs` と server の場の結線で確認した。README の busy の表現を確認し、相方の発話の受付・応答と、会話者の発話検知の違いを明示した。
- VC は `discord-experience.mjs` の `foldLink` → server の VC 操作と `venue/{lifecycle,remote-close}.mjs`。同じ場で再参加する場合に、会話の正本・頭・判定・視覚・資料・受付済み仕事が残ることを確認した。
- 資料は `venue/{lifecycle,remote-close}.mjs` → `venue/task-resources.mjs` → `venue/role-hooks.mjs` と server の閉場結線。`cockpit-stream.test.mjs` と `discord-venue.test.mjs` で、受付済み仕事の後に writer、整理後に解放、不明時は保持、遠隔再試行で writer は重複しないことを特定した。

新しい HTTP 操作は既存のルート表と指名ハンドラから、端末診断は `startup/cockpit-diagnostics.mjs` から追えた。起動と server の組み立てに残る処理は三つの変更先への障害とならなかった。従来の回帰ファイルの名前には suffix があり、試験内容はシナリオ名から検索した。

## 最終検証

- Windows / Node v24.19.0、loopback 許可。`apps/soul/agent` の `node --test --test-concurrency=4` は 2594/2594 件成功、失敗・キャンセル・skip 0、109.802 秒。通常 CLI の隔離起動、配信・Discord の会話から通常閉場までと専用ロールの Git 保存、合成の遠隔閉場を含む。
- `apps/runtime-player` の `node ../../node_modules/vitest/vitest.mjs run -c vitest.config.ts` は 156/156 ファイル、1095/1095 件、11.56 秒。器から起動する reference-driver の sustained-drive、perceptual-timeline、speech-timeline 各 1 件を含む。器と Soul の実行は順番に行った。
- Node と npm の公開 help は成功。既存の公開名は Cockpit 66、遠隔 CLI 4、server 23 で起点と一致。変更 55 `.mjs` の未宣言名・初期化順・不明 export に絞った追加診断は 0、`git diff --check` は成功。Soul 構成と境界 1747 ファイル、fixture 5/5 件を確認。全体の構成チェックは Wave 1 時点からある器の `src/main/physiology/index.ts` の barrel-only 違反を引き続き報告した。
- 本人記憶の HEAD は前後とも `1efb907b9b6f8da3d84fcc9dc69f5e39e40c8ece`、全未追跡を含む作業状態は空。実サービスと実 VC は使用せず、試験の合成境界は Wave 1・4 と共通。普段の配信と Discord 通話による本人確認はこの後の一回に残した。

## 本人確認

本人が普段の配信とDiscord通話の両方でチャッピーを使用し、問題なく動いたと報告した。発話判定で一時発生したDecisions APIの401はキーの再取得で解消した。
