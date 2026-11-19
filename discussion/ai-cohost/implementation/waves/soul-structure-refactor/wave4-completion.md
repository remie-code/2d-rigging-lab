# Wave 4 起動・操作・表示

[計画](../../orchestration/soul-structure-refactor-wave-plan.md)・[Wave 3](wave3-completion.md)

## 配置

パスは `apps/soul/agent/` 起点。

- `scripts/cockpit.mjs` が引数受付、直接起動、既存公開名を扱う。本番設定、役・場・器官・サーバー組み立ては `src/cockpit/startup/run-cockpit.mjs`。起動時の警告、ブラウザー起動、診断、終了を `startup/` の各モジュールに置き、役ごとの場の接続は `src/cockpit/venue/role-hooks.mjs` に置いた。既存のソース結線検査は本番の新しい参照先を確認する。
- `src/cockpit/http/cockpit-http-server.mjs` が HTTP 受付、ルート選択、遠隔操作の制限を担当。`http-messages.mjs` が JSON 入出力、`cockpit-assets.mjs` が画面と静的資産、`cockpit-sse.mjs` が状態配信を扱う。`cockpit-server.mjs` の指名された操作ハンドラは場と各器官へつなぐ。UI と `view-logic/` は既存の領域にある。
- ルート追加は `http/cockpit-http-server.mjs` の method/path 表に置き、server の操作名と対応させる。`cockpit-server.mjs` の約 5,400 行には場と器官の接続、デバイス、操作ハンドラ、状態・警告・計測の結線が残る。操作ハンドラで入力の読み取りと場・設定更新が近く、`snapshot` と `refreshStateWarnings` には複数の器官の状態が集まる。残る物理配置は Wave 5 の初見調査で評価する。`run-cockpit.mjs` の約 1,200 行は本番の依存の組み立てを保持する。

## 実行記録

- HTTP 側の対象回帰は loopback 許可の 4 並列で 753/753 件成功。画面と資産、状態・警告・計測、遠隔 CLI、配信・Discord の通常閉場と隔離保存を含む。
- 起動側の対象回帰は loopback 許可の 4 並列で 272/272 件成功し、Node と npm の CLI help も成功した。移動に合わせて既存 9 ファイルの本番結線検査が参照する箇所を変更し、実 CLI 子プロセスで通常起動を確認する `scripts/cockpit-startup.test.mjs` を追加した。
- 実 CLI 試験はコードと SDK の一時副本を使う。副本に記憶・設定・資格情報・台帳をコピーせず、子のホーム参照とファイル権限を副本に限定し、外向きの fetch を遮断した。`GET /`、`/api/state` の閉場中状態・隔離記憶ルート・資格情報なし、`/api/events` の初期状態、EOF 後の終了コード 0 を確認した。遠隔は既存の別プロセス合成 fixture。
- 独立対象 236/236 件成功。公開 CLI の help、隔離副本の通常起動と EOF、画面と状態 API・SSE、遠隔 CLI の再試行と結果不明時の保留に加え、警告、判定・残量・遅延・圧縮の表示経路を確認した。実サービスや本番既定データは使用していない。
- 統合全回帰は loopback 許可の `node --test --test-concurrency=4` で 2594/2594 件成功。本人記憶の HEAD と全未追跡込みの空の状態は前後で一致した。Node/npm の公開 help、Cockpit 66・遠隔 CLI 4・server 23 の公開名の一致、Soul の構成と境界 1745 ファイル・fixture 5/5、変更 44 ファイルの未定義名等の追加診断 0 を確認した。
