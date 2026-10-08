# S1 follow-up 記録: wave 内で対応しない持ち越し事項

> Status: 記録(2026-07-12, Orch-Sylph)。S1 の blocking ではない。各項目は発生源レビューへのリンクで根拠を辿れる。
> 出典: [../../reviews/s1/domain-b-review.md](../../reviews/s1/domain-b-review.md) non-blocking notes + Undine 裁定。

## 1. 一時 WAV の堆積(Domain B note 6 / Undine 裁定: S1 は記録で足りる)

`writeTempWav` は発話ごとに `mkdtempSync` で新規 temp ディレクトリ + WAV を OS temp に残す。speak は送出前に WAV を書くため rejected 時も孤児 WAV が残る。S1(一文単位)では実害軽微。**長時間常駐運用でのクリーンアップ方針は S6(会話が続く)の領分**で設計する。

## 2. 未踏フレーム長経路(Domain B note 4)

WS テストダブルの 64bit(127) length 経路(>65535 byte フレーム)と ws-double サーバ側 encode の 126 分岐は未踏(テストで到達しない・コードコメントに明記済み)。intent.speech は 512 モーラ上限で 16bit 経路に収まるため S1 スコープでは妥当。魂側に大フレーム送受信が生じる日に回収。

## 3. speak の TTS 失敗伝播テスト(Domain B note 3)

tts-client 単体の非 200 throw は検証済みだが、speak 経由の伝播は独立 assert がない(素の await 伝播で自明)。channel-client テスト増強(Domain C で回収)と同種の「写経コピーの独立固定」として、次に speak.mjs を触る wave で 1 本足すのが安い。

## 4. redactToken の未検証分岐(Domain B note 5)

no-token / unparseable URL の分岐(トリビアル)。次に channel-client を触る wave でついでに固定。

## 5. readyState 定数参照の非一貫性(Domain B note 7・cosmetic)

channel-client 内で close は static(`WebSocketImpl.CLOSED/CLOSING`)、waitForOpen は instance(`socket.OPEN`)と参照先が不統一。値は W3C 定数で同一・挙動差なし(Domain B レビュー特別依頼調査で undici の instance 定数公開を実地確認済み)。可読性のためどちらかに揃える軽微リファクタ候補。

## 6. undici WebSocket クライアント × 自作 WS サーバの相性問題(Domain B §3・Undine 裁定: 既知環境事項)

この環境の undici WebSocket クライアントは、RFC 6455 準拠の自作サーバのハンドシェイク応答を "Incorrect hash received in Sec-WebSocket-Accept header." で拒否する(accept 値は node crypto / openssl の二重検証で正しい・原因は undici バンドル内部で特定不可)。本番経路(undici↔実器 channel-server)は C6 で実証済みのため実害なし。**将来、魂側で WS サーバ機能を持つ・テストで undici クライアントを実配線したい場合に再燃し得る**。

## 7. check:source の既存赤(S1 と無関係・別タスク化済み)

`apps/runtime-player/src/main/physiology/index.ts` の barrel-only 違反(複数行 export 折り返しと検査正規表現の不整合)。S1 着手前から存在(HEAD 同一)。別タスクとしてチップ化済み(task_c46e0820)。

## 8. `node --test` 緑後ハングの残存監視(Domain C で調査・ハードニング済み・未再現)

Orch 経由でユーザー UI にて「`node --test` が 62/62 pass を吐いた後にプロセスが終了せず 30 分超走る」ハングが**3 件観測**された(不定期レース)。Domain C で調査した:

- **未再現**: この環境で `node --test`(全 84 テスト)を単発 20 回 + 疑わしい個別ファイル(audio-player / speak / channel-client)各 25 回 + **6 並列 × 5 ラウンド(高負荷下)** で走らせたが、全て exit 0・数百 ms で正常終了。ハングを再現できなかった(生出力は domain-c.md §ハング調査)。
- **ハードニング(発生源での予防・本体品質)**: 最有力候補は「kill したが OS が未 reap の子プロセス(echo-player)/未 destroy のソケットが event loop を生かし続ける」窓。→ (a) `audio-player.mjs` dispose で kill 後に stdio パイプ destroy + `child.unref()`、(b) `test-support/ws-double.mjs` の `server.unref()` + `closeAllConnections()`、(c) `test-support/ws-client.mjs`(MinimalWebSocket) の `socket.unref()` + close 時 `removeAllListeners()`+`destroy()` を入れた。これらは常駐する魂のクリーンシャットダウンとしても正しい。
- **残課題(未再現ゆえ「直った」と断定できない)**: 再現しないため、上記ハードニングが真因を潰した証明はない。**もし再燃したら**、`process.getActiveResourcesInfo()`/`process._getActiveHandles()` をテスト終端で dump し、残るハンドル種別(child pipe / tcp socket / timer)を特定するのが次の一手。特に Windows の `child.kill()`(TerminateProcess)後の reap 遅延と、`connectChannel.close()` の socket close 待ち timeout(4s・reject 経路)を疑う。
- **Undine 裁定(2026-07-12)**: 未再現+発生源ハードニング+本節の残存監視で **S1 機械ゲートとして足りる**と受理(「真因を潰した証明はできない」という正直な記録込み)。

## 9. llm-session の result エラー subtype 未分岐(Domain C レビュー指摘 1)

`SDKResultError`(error_max_turns 等)には `result` フィールドが無く、assistant テキストも空なら replyText が空文字で返る(CLI は `empty_reply` 表示)。S1 では実害なし。エラー result の明示ログ化で診断性が上がる。次に llm-session を触る wave で回収。

## 10. env-guard warn の二重出力(Domain C レビュー指摘 2・cosmetic)

CLI main() と createLlmSession の双方が env-guard を呼ぶ二重防波堤のため、ANTHROPIC_BASE_URL 非既定時に warn が 2 行出る。throw の fail-fast は意図どおり。表示重複のみ。
