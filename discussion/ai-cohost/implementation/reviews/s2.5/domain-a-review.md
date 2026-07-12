# S2.5 Domain A 統合レビュー: コクピットサーバ + 結線

> 判定: **PASS（blocking ゼロ）**。2026-07-12, Orch-Sylph が 3 レーン（spec / design / test）の結果を統合。
> 対象: `apps/soul/agent/src/cockpit-server.mjs` / `cockpit-server.test.mjs`（Gnome 実装記録: [../../waves/s2.5/domain-a.md](../../waves/s2.5/domain-a.md)）。
> 判定基準: [../../orchestration/s2-5-wave-plan.md](../../orchestration/s2-5-wave-plan.md) §4 / [../../screens/soul-cockpit.md](../../screens/soul-cockpit.md)。
> レーン別詳細: [domain-a-review-spec.md](domain-a-review-spec.md) / [domain-a-review-design.md](domain-a-review-design.md) / [domain-a-review-test.md](domain-a-review-test.md)。

## 0. 総合判定

**PASS。全 3 レーン blocking ゼロ。** wave 契約 §4 の blocking 基準 1〜5 に抵触なし。

| レーン | 判定 | 独立裏取り |
| --- | --- | --- |
| spec（仕様適合） | PASS | エンドポイント/SSE イベントが soul-cockpit.md §2 の画面を過不足なく供給。「ないもの」尊重。 |
| design（実装品質・安全） | PASS | 127.0.0.1 固定・冪等 close・UI 切断で pipeline 生存・既存コード無変更を `git`/`node --test`/3 チェックで独立実測。 |
| test（テスト実在・機械ゲート） | PASS | `tests 217/217`・新規 21/21・soul-zone/deps 緑・lockfile 無差分を独立実行で再現。blocking 基準テストはホローでない。 |

## 1. blocking 基準（wave 契約 §4）の充足

1. **lockfile 不変・新規 npm 依存ゼロ**: 3 レーンが `git diff --stat pnpm-lock.yaml apps/soul/agent/package-lock.json` = 差分ゼロ、`package.json` 無変更を独立確認。import は node 組み込み + 自 zone 相対のみ（express 等の混入なし）。**適合**。
2. **3 チェック無退行**: `check:soul-zone` 緑・`check:deps` 緑。`check:source` は赤だが唯一の違反 `apps/runtime-player/src/main/physiology/index.ts`（器コード・コミット済み ed49b5d・作業ツリークリーン）は **S2.5 と無関係の pre-existing**（Orch が独立検証: 新規 untracked は cockpit 2 ファイル + docs のみ）。**新規 cockpit ファイルの check:source 違反はゼロ = Domain A は無退行**。器の既存違反は本ドメイン受け入れの対象外（§3 エスカレーション）。**適合**。
3. **127.0.0.1 限定バインド**: `assertLoopbackHost` が非 loopback を構築時 throw、`listen` は常に loopback host。テスト 3 件で固定。**適合**。
4. **実マイク音声・録音の非使用/非保存**: 全注入（fake pipeline / fake spawn / 合成 transcript）。実 ffmpeg/実 whisper/実 onnx 不使用。**適合**。
5. **終了処理明示 + UI を閉じても魂が生きる**: `close()` 冪等・全 SSE クローズ・`pipeline.dispose()`・タイマ unref。SSE 切断は購読解除のみで pipeline 非畳み。専用テストで固定、`node --test` が自然終了（ハングなし）。**適合**。

## 2. 非 blocking 事項（followup 台帳へ・wave 内で強制修正しない）

s2-followup 方式に倣い記録（wave 契約 §4 の blocking ではないため wave 内充足を強制しない）:

- **N1（spec/test/design 共通指摘）**: `POST /api/ears/start`・`/stop` の遷移中 409 パスに専用テストが無い。ロジックはコード読解で正しい（`transitioning` フラグを最初の await 前に同期セット＝JS シングルスレッドで安全）と 3 レーンが確認。回帰保険として 1 本足す価値はあるが blocking ではない。
- **N2（test）**: `GET /api/devices` の HTTP レベル列挙失敗ケース（200 + 空配列 + error 文字列）が未固定。unit の `enumerateDevices` は 3 件テスト済み。
- **N3（spec）**: Timeline 履歴復元時に転写レイテンシが欠落（`/api/state` の `transcripts[]` に `latencyMs` を載せない・SSE ライブ受信時のみ付与）。正本 transcript-buffer に latency フィールドが無いことに合わせた設計判断で妥当だが、soul-cockpit.md §2 モックは履歴/ライブを区別せず全行にレイテンシ表示。**Undine 確認事項**（正本を汚さない v0 非対称を許容するか）。
- **N4（design）**: SSE `write` 失敗時の即時除去なし（`close` イベント任せ）。TCP 切断は通常 `close` を発火させるため実害薄。v0 許容。
- **N5（test）**: domain-a.md §6 の新規 21 件内訳表記に軽微な数え間違い（合計 21 自体は正しい）。

## 3. Orch エスカレーション（Undine へ）

- **check:source の器側 pre-existing 違反**: `apps/runtime-player/src/main/physiology/index.ts` の barrel 違反は S2.5 発進前から HEAD に存在（コミット ed49b5d、S2.5 は 1 バイトも触れていない）。**「3 チェック無退行」は Domain A が新規違反を出さないこと＝満たしている**。ただし `pnpm run check` 全体が赤のままなので、S2.5 機械ゲートの解釈を「S2.5 による退行ゼロ」で確定するか、器側違反を別途修正するかは Undine/ユーザーの判断。器コードは S2.5 の変更禁止対象（鉄の規律 7）のため、**本 wave では修正しない**。
- Gnome 質問 1（ffmpeg transient 表現＝恒久死のみ赤）・質問 2（履歴 200 件上限）は spec/design レーンとも v0 許容と判定。S3 以降の拡張余地として followup 化。

## 4. 裏取りの生数字（3 レーン一致）

- `node --test`（`apps/soul/agent` 全体）→ `tests 217 / pass 217 / fail 0 / cancelled 0 / skipped 0`（S1/S2 の 196 無退行 + 新規 21）。
- `node --test src/cockpit-server.test.mjs` → `tests 21 / pass 21 / fail 0`。
- `check:soul-zone` 緑（1306 ファイル走査）/ `check:deps` 緑 / `check:source` 赤（器 pre-existing のみ・新規違反ゼロ）。
- lockfile 2 種 + package.json 差分ゼロ。既存 5 モジュール（ear-pipeline/transcript-buffer/whisper-server/ffmpeg-capture/ears-cli）無変更。
