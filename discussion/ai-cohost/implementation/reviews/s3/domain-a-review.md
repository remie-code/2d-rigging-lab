# S3 Domain A 統合レビュー: 会話ログ + 発火オーケストレーション（魂の胴体）

> 判定: **PASS（blocking ゼロ）**。2026-07-12, Orch-Sylph が 3 レーン（spec / design / test）を統合。
> 対象: `apps/soul/agent/src/ears/transcript-buffer.mjs`・`src/mind/fire-injection.mjs`・`src/mind/fire-orchestrator.mjs`・`src/cockpit/cockpit-server.mjs`・`scripts/preflight-fire.mjs`（+ テスト 4 本）。Gnome 実装記録: [../../waves/s3/domain-a.md](../../waves/s3/domain-a.md)。
> 判定基準: [../../orchestration/s3-wave-plan.md](../../orchestration/s3-wave-plan.md) §2 裁定 5 件・§4 blocking 基準。
> レーン別詳細: [domain-a-review-spec.md](domain-a-review-spec.md) / [domain-a-review-design.md](domain-a-review-design.md) / [domain-a-review-test.md](domain-a-review-test.md)。

## 0. 総合判定

**PASS。全 3 レーン blocking ゼロ。** Orch も機械ゲートを独立に再実行し一致を確認（レビュー委任前に実測済み）。

| レーン | 判定 | 独立裏取り |
| --- | --- | --- |
| spec（契約適合） | PASS | 裁定 5 件 + 問い 8 件すべて適合。soul 記録 = 実際に TTS へ渡す最終テキストと厳密一致（speak は text を無変換で audioQuery へ渡す）。ワイヤ契約は cockpit.html の拡張予約と齟齬なく接合。 |
| design（品質・自己完結・安全） | PASS | llm-session/speak/ear-pipeline 完全不変（git 実測）・loopback 限定・新規依存ゼロ・失敗の握り（finally idle 復帰）・クリーンシャットダウンを preflight 実測で確認。 |
| test（テスト実在・機械ゲート） | PASS | 257/257 を独立 2 回実行（決定的）・新規 26 テストはホローでなく具体値固定・既存テストは末尾追記のみ（diff で実証）・preflight PASS/EXIT=0・lockfile 差分ゼロ。 |

## 1. blocking 基準（wave 契約 §4）の充足

1. **lockfile・器コード・C4 契約・既存挙動不変 + 新規依存ゼロ**: lockfile 2 種差分ゼロ・package.json 不変（3 レーン + Orch 一致）。変更は魂ゾーン 4 ファイル（追加的）+ 新規 5 ファイルのみ。speaker 追加は既定 "you" で S2 挙動不変（既存 11+21 テスト無変更全通過）。**適合**。
2. **3 チェック無退行・実マイク非使用**: check:soul-zone 緑（1318）・check:deps 緑・check:source は器 pre-existing 1 件のみ（.ts 限定スキャン・新規違反ゼロ = S2.5 と同一状態）。テスト・preflight とも実 SDK/実 TTS/実器/実マイク不使用（fake 注入・design レーンがコードパスで確認）。**適合**。
3. **注入整形は純関数 + fixture テスト・SDK 実消費最小**: fire-injection.mjs は import ゼロ・時計は nowMs 引数のみ（決定的）・fixture 8 件。Domain A では実 ask ゼロ回（fake queryImpl のみ）。**適合**。
4. **発火口が 127.0.0.1 限定の内側**: POST /api/fire は既存 assertLoopbackHost バインドの同一サーバ内。新規リスナ・別 host なし。**適合**。
5. **終了処理・テストのタイムアウト**: orchestrator は純状態機械（ハンドル非所有）・close() で dispose・preflight は no hang / EXIT=0。全テストタイムアウト付き。**適合**。

## 2. 裏取りの生数字（3 レーン + Orch 一致）

- `node --test`（apps/soul/agent）→ `tests 257 / pass 257 / fail 0 / cancelled 0 / skipped 0`（baseline 231 + 新規 26。test レーンは 2 回実行で同数 = 決定的）。
- 新規内訳: fire-injection 8 / fire-orchestrator 9 / transcript-buffer +3 / cockpit-server +6。
- `node scripts/preflight-fire.mjs` → `RESULT: PASS` / `EXIT=0` / 127.0.0.1 バインド / server closed no hang（Orch・design・test・spec の 4 実行者全再現）。
- lockfile 2 種差分ゼロ・package.json 差分ゼロ。llm-session.mjs / speak.mjs / ear-pipeline.mjs は git status 空（完全不変）。

## 3. 非 blocking 事項と引き継ぎ（Domain B へ）

1. **【Undine 裁定 2026-07-12・Domain B 設計注記】** s2-followup §4-1（watchdog 遅延解決が正本に積まれ得る）の残り波紋: (a) 遅延 append した古い発話が注入テキスト上「最も新しい行」として並ぶ意味順の捻れ（seq 昇順整形ゆえ）、(b) appendedAtMs 窓の遅延感度（design 所見 1）。恒久回収は whisper-inference/client 統合時へ先送り済み（S3 スコープ外）。**Domain B は `experiments/s3-summon.md` の観測項目に「遅延 append の発生頻度」を含めること**。
2. **Gnome 質問 3 件は Domain B 裁量で処理**: (Q1) preflight-fire の npm script 登録は任意（既存 preflight 型踏襲で未登録も可）。(Q2) GET /api/fire の 405 明示化は UX 裁量（状態機械が冪等保護済み・機能欠陥ではない）。(Q3) SSE `fire` の accepted:false 集合に empty-reply/error を足すかは操縦席 UX 次第（現状 diagnostic イベントで観測可能）。
3. **窓幅/文字上限（windowMs/maxChars）の実設定結線は Domain B の本番結線の責務**（orchestrator は options で受けるだけ・spec レーン non-blocking 1）。
4. **cockpit.html は soul/fire SSE を未購読**（意図どおり・Domain B の守備範囲）。受け口（speaker-soul クラス・.marker span・diagnostic 購読口）は S2.5 実装済みで、ワイヤ契約（domain-a.md §2）は消費可能。
