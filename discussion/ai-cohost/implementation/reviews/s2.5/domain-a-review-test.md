# S2.5 Domain A レビュー（testレーン）: コクピットサーバ+結線

> Status: レビュー完了（2026-07-12, Review-Sylph / testレーン）。
> 対象: [../../waves/s2.5/domain-a.md](../../waves/s2.5/domain-a.md)（Gnome実装記録）。
> 判定基準: [../../orchestration/s2-5-wave-plan.md](../../orchestration/s2-5-wave-plan.md) §4 blocking基準。

## 総合判定: **PASS**（blockingゼロ）

## 1. 実行して裏取りした生の数字

| 実行コマンド | 結果 |
| --- | --- |
| `cd apps/soul/agent; node --test`（全スイート） | `tests 217 / pass 217 / fail 0 / cancelled 0 / skipped 0`（`duration_ms 912.0597`） |
| `node --test src/cockpit-server.test.mjs`（新規のみ） | `tests 21 / pass 21 / fail 0 / cancelled 0 / skipped 0`（`duration_ms 243.439`） |
| `pnpm run check:soul-zone`（リポジトリルート） | 緑: `Soul zone boundary guard passed: 1306 source files scanned; no 器→魂 imports and no 魂→器 code imports.` |
| `pnpm run check:deps`（リポジトリルート） | 緑: `Dependency guard passed.` |
| `pnpm run check:source`（リポジトリルート） | **赤・exit 1**。出力は違反1件のみ: `apps/runtime-player/src/main/physiology/index.ts: index.ts must remain a barrel-only entrypoint`。新規cockpitファイル（`cockpit-server.mjs`/`cockpit-server.test.mjs`）に起因する違反は**出力にゼロ件**。Orch事前確定どおりpre-existing・本ドメイン無関係と確認。 |
| `git status --porcelain`（リポジトリルート） | untracked 3件のみ: `apps/soul/agent/src/cockpit-server.mjs`・`apps/soul/agent/src/cockpit-server.test.mjs`・`discussion/ai-cohost/implementation/waves/s2.5/`（docs）。M（modified）行なし。 |
| `git diff --stat -- pnpm-lock.yaml apps/soul/agent/package-lock.json` | 出力なし（差分ゼロ＝両lockfile不変）。 |
| `git diff --stat -- apps/soul/agent/package.json package.json` + `git status --porcelain -- 同3ファイル` | 出力なし（package.json類も無変更＝新規npm依存ゼロを裏付け）。 |

計217件中196件がS1/S2既存分の無退行、21件が新規（197+... ではなく196+21=217で一致、Gnome主張と符合）。lockfile・package.jsonとも無変更を独立確認。新規untrackedはcockpitの2ファイル+docsのみで、Gnome主張（既存コード非接触）と符合。

## 2. blocking基準（wave-plan §4）との照合

1. **lockfile・器・S1/S2既存挙動不変（196テスト無退行）**: 満たす。lockfile差分ゼロ、196件緑を実行確認。
2. **check:soul-zone/deps/source 無退行**: 満たす。soul-zone/deps緑。sourceは唯一の違反が器側pre-existing（cockpitファイルは違反リストに一切出現しない）。
3. **127.0.0.1限定バインドの構造的固定**: 満たす（§3参照）。
4. **実マイク音声・録音データ非使用/非保存**: 満たす（§3参照）。
5. **子プロセス・サーバの終了処理明示 + UIを閉じても魂が生存**: 満たす（§3参照）。

## 3. テスト品質の評価

- **loopbackバインド固定（基準3）**: `assertLoopbackHost: 非loopback hostはthrowする`（`0.0.0.0`・`192.168.1.10`を実際にthrow検証、`127.0.0.1`は通す）・`createCockpitServer: 非loopback hostを渡すと構築時点でthrow`・`cockpit: listenは127.0.0.1にバインドする（urlがloopback）`の3件。いずれも実際に例外送出/URL形式を正規表現で検証しており、ホロー（存在チェックのみ）ではない。
- **UI切断でpipeline生存（基準5）**: `cockpit: SSE接続が切れてもpipelineは生き続ける`。SSEクライアントを`close()`した後60ms待ち、`fake.record.disposed === false`かつ`/api/state`が`listening`のままであることを実アサーションで確認。意味のある検証。
- **クリーンシャットダウン（基準5・ハング教訓）**: `cockpit close(): pipelineをdisposeし・冪等・ハンドルを残さない`。SSE接続を開いたままclose→`disposed===true`・`isListening()===false`・2回目のclose無害・close後リクエストが`reject`されることを確認。加えて、全217件のスイート実行が追加フラグなしで自然終了（`node --test`がハングせず`duration_ms`を出力して終了）していることを本レビューで実行確認済み——ハンドルリークがないことの状況証拠として機能する。
- **実マイク・実ffmpeg・実whisper・実録音の非使用**: 確認済み。`fakeSpawn`（`EventEmitter`+合成`Readable`）を`spawnImpl`注入で全面使用し、実`child_process.spawn`は呼ばれない。`makeFakePipeline`は`createEarPipeline`を一度も呼ばず、`createTranscriptBuffer`のみを使う純粋fake。設定永続化も`createInMemorySettingsStore`でディスクI/Oなし。ファイル読み込み(`indexHtmlPath`)を使うテストも無く、filesystem接触ゼロ。
- **SSE/HTTP疎通テストの中身**: 素通しではない。`transcript`イベントの`text`/`speaker`/`latencyMs`/`audioCtx`個別値、`discard`イベントの`reason`/`discarded`件数、`state`イベントの`health.whisper.reason`正規表現マッチなど、配信されたペイロードの具体値を検証しており、単なるステータスコード確認に留まらない。

## 4. 欠けているケース（非blocking・改善提案）

wave-plan §4のblocking基準はすべて実在テストで固定されているため**総合判定に影響しない**が、テスト網羅の観点で以下の空白を指摘する:

1. **`POST /api/ears/start`/`stop`の409（遷移中の多重リクエスト拒否）が未テスト**: `cockpit-server.mjs`の`transitioning`フラグによる409応答は実装済みの分岐ロジックだが、`cockpit-server.test.mjs`に409を踏むテストが存在しない（`grep 409`で該当テストなし）。将来のリグレッション検出網が薄い箇所。
2. **`GET /api/devices`のHTTPレベルでの列挙失敗ケースが未テスト**: `enumerateDevices`単体では失敗系（spawn error・spawnImpl throw）を3件テスト済みだが、`/api/devices`エンドポイントに失敗する`enumerateDevicesImpl`を注入し「`200`+`devices: []`+`error`文字列」を返すことを検証するHTTPレベルのテストがない（wave-plan本文§3.2で明記された契約: 失敗でも200で返す、という挙動そのものがHTTP経由では未固定）。
3. （軽微・非機能）domain-a.md §6のテスト内訳表で「HTTPエンドポイント8」の括弧内列挙が実際には9項目（404を含む）になっており、見出し数と内訳の記述に軽微な不一致がある。実行結果の合計21件自体は本レビューで独立に一致確認済みであり、判定に影響しない。

## 5. 質問

- 上記4-1（409未テスト）・4-2（`/api/devices`失敗時のHTTPレベル固定）は、Domain Bのpreflight/エラー表示実装に依存しうる契約（wave-plan §3.2の「失敗でも200」）。Domain Bのレビューで拾うか、Domain Aへの追補テストとして別途起票するか、Orchの判断を仰ぎたい（blockingではないため本レーンではPASS判定を維持）。

## 6. 結論

Gnome報告の数字（217/217・21/21・check:soul-zone/deps緑・check:source赤=pre-existing1件のみ・lockfile不変）はすべて独立実行で再現・確認できた。blocking基準5項目はいずれも実在する意味のあるテストで固定されており、ホロー検査は見当たらない。実マイク/実ffmpeg/実whisper/実録音の使用・保存はゼロ。§4で指摘した2件の欠落ケースは非blockingの改善提案として記録する。

**testレーン判定: PASS**
