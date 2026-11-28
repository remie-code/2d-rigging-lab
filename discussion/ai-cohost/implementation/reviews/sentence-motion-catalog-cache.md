# 発話モーションの演技一覧キャッシュのレビュー

判定は合格。第1回レビューで、[Wave計画](../orchestration/sentence-motion-catalog-cache-wave-plan.md)の実装と検証条件を満たしたことを確認した。

## 設計と回帰テスト

- Runtime Playerが起動時に演技定義を読み込み、Soulが接続に対応するカタログを使う。毎文の判定では演技ID順に候補と説明を並べ、最後に `none` を置く。一覧を先頭の入力として送り、末尾に30分の明示キャッシュ境界を置く。キャッシュキーは先頭入力のSHA-256から生成する。送信ボディのテストでは別の文と候補の列挙順を変えても先頭入力とキーが一致し、候補の追加・削除・説明変更で両方が変わることを確認した。Cockpitの回帰テストでは再接続後の新しいカタログが判定に使われ、古い接続の判定結果による再生が抑止される。
- 対象文、直前会話、同じ応答の先行文は境界の後に入る。全演技IDと `none` が質問の選択肢に入り、注意先も同じリクエストで判定する。既存の演技と注意先の組み合わせ解決、ゲーム共有時の注意先補完、音声開始と終了に応じたモーション再生制御を差分と関連テストで確認した。判定は音声のキュー投入や開始を待たせない。
- 発話可否、コメント判定、従来の意図モーション判定には文字列入力の送信形式が適用される。既存のリクエストと応答解析の回帰テストを確認した。
- 実装担当の関連6ファイルの最終回帰テストは309件成功し、失敗・スキップともに0件。レビュー担当は `speech-sentence-motion`、`speak-now-decisions`、`speech-intent-motion`、`fire-orchestrator`、`comment-guard` の5テストファイルを独立して再実行し、168件すべて成功した。

## 公式Decisions APIでの確認

実装担当の実行証跡とスモークスクリプト `tmp/sentence-motion-catalog-cache-live-20261128.mjs` を照合した。Runtime Playerの `loadSpeechMotionSnapshot` が配布中の定義を読み込み、演技35候補と対象別54ペアを構築した。Soulの `createSpeechSentenceDelivery` から `createSpeechIntentMotion`、`decideSpeechSentenceMotion`、`createDecisionsQuestionsJudge` と共通送信を通した。既定の `gpt-6-luna`、タイムアウト3,000 msを使用した。HTTP送信のラッパーはリクエストのキャッシュキーと応答のusageを観測した。

| 架空の台詞 | HTTP / 判定時間 | 入力 / キャッシュ書き込み / 読み取りトークン | 演技 / 注意先 | 再生判断 |
| --- | --- | --- | --- | --- |
| うわっ、画面の宝箱から突然ドラゴンが飛び出した！ | 200 / 1,405 ms | 4,738 / 3,938 / 0 | `startled-recoil` / `game` | `startled-recoil-game-v1` を要求、`accepted` |
| ふう、相方さん、無事でよかった。 | 200 / 240 ms | 4,752 / 0 / 3,938 | `smile-nuances--relief` / `partner` | `05-relief` を要求、`accepted` |

実装上、説明はJSON文字列にして1候補1行で表現し、演技の質問にはIDのみを入れる。実API試験後、リクエスト構築を既存の例外処理内へ移し、正常時の送信内容が同じことを差分で確認した。スモーク試験のControl Channelはテストダブルを使い、対象別クリップの選択と再生要求まで観測した。画面上の演技と長時間配信での請求額は運用での観察事項となる。
