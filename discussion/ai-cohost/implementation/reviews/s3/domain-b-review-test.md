# S3 Domain B レビュー（test レーン: テスト実在性・機械ゲート）

> Status: **PASS**（blocking 指摘なし・2026-07-12・Review-Sylph test レーン、委任元 Orch-Sylph）。
> 対象: [../../waves/s3/domain-b.md](../../waves/s3/domain-b.md) §3 の主張。
> 基準: [../../orchestration/s3-wave-plan.md](../../orchestration/s3-wave-plan.md) §1 機械ゲート・§4 blocking。
> 制約遵守: **measure-fire.mjs は実行していない**（実 SDK 消費・上限 5 ask は Gnome が消費済み。
> 数字の裏取りはコード読解 + 記録間の静的整合検査のみ。§5 に判定範囲の限界を明記）。

## 1. 判定サマリ

| 問い | 判定 |
|---|---|
| 全テスト無退行（node --test 2 回・決定的） | PASS — 269/269 × 2 回 |
| 新規テストのホロー検査（cockpit-page +6 / scripts/cockpit 6） | PASS — 実体挙動を固定 |
| 実 SDK / 実マイク / 実器 / 実再生への非接触 | PASS |
| preflight-fire / preflight-cockpit | PASS / PASS（EXIT=0） |
| lockfile / 依存差分ゼロ | PASS — 差分なし |
| 計測記録の静的整合（実行なし） | 整合 — 矛盾なし（§5 の限界つき） |
| 既存 cockpit-page.test.mjs の無変更（末尾追加のみ） | PASS — 単一 hunk・追加のみ |

## 2. 独立実行の生数字（Review-Sylph が実行・2026-07-12）

- `cd apps/soul/agent && node --test`（1 回目）: **tests 269 / pass 269 / fail 0 / cancelled 0 /
  skipped 0**（duration_ms 998.4・exit 0）。
- 同（2 回目）: **tests 269 / pass 269 / fail 0 / cancelled 0 / skipped 0**（duration_ms 1008.1・
  exit 0）。2 回同数 = **決定的**。269 = baseline 257（[domain-a-review.md](domain-a-review.md) が
  独立 2 回実行で確認済み）+ 12（cockpit-page +6・scripts/cockpit 6）で**主張と一致**。
- `node scripts/preflight-fire.mjs`: **RESULT: PASS / EXIT=0**（fire → ask → speak → soul 記録・
  SSE 観測・real SDK/TTS/mic なし・server closed no hang）。Domain A 成果の無退行を確認。
- `node scripts/preflight-cockpit.mjs`: **RESULT: PASS / EXIT=0**（page served・state/devices 応答・
  mic untouched。devices は ffmpeg ENOENT 環境のため 0 件だが preflight 自身が PASS 判定 = S2.5 の型
  どおり）。
- `git diff --stat pnpm-lock.yaml apps/soul/agent/package-lock.json apps/soul/agent/package.json`:
  **出力なし = 差分ゼロ**（新規依存ゼロ・scripts 行追加なし——主張と一致）。
- `git diff apps/soul/agent/src/cockpit/cockpit-page.test.mjs`: **単一 hunk `@@ -114,3 +114,63 @@`**
  = ファイル末尾への +6 テスト追加のみ。**既存 7 ケースは 1 行も変更されていない**（総 test 数 13 =
  7 + 6 を Select-String で確認）。

## 3. ホロー検査所見（新規 12 テスト）

### 3.1 `src/cockpit/cockpit-page.test.mjs` 追加 6 件 — ホローでない

既存の型（静的 DOM/コード検査 = readFileSync + assert.match）に忠実で、いずれも cockpit.html の
**実在コードに対応する**ことを実装側と突き合わせて確認した:

- **Fire ボタン/soul 状態/POST /api/fire**: `#btn-fire`(html L122)・`#soul-status`(L123)・
  `fetch("/api/fire", { method: "POST" … })`(L282) が実在。
- **SSE soul 購読 + busy disable**: `es.addEventListener("soul", …)`(L383) → `applySoulState`(L252)
  の本体を正規表現で切り出し、`btn-fire.disabled = st !== "idle"`(L257) を関数本体内で固定
  （存在チェック止まりでなく挙動の核を assert）。
- **SSE fire 購読**: リスナー本体を切り出し `accepted === true` 分岐・`addFireMarkerRow`・
  `setFireNote`（非受理 reason の控えめ表示）を固定（html L386-388 に実在）。
- **発火マーカー行**: `addFireMarkerRow` 本体内の `className = "row fire-marker"`・
  includedCount/injectedChars 使用・CSS `.row.fire-marker { … var(--speaking) }` を固定。
- **fire 失敗ゴースト行**: diagnostic リスナー本体内の `fireEmptyReply` / `fireError` 分岐を固定
  （html L378-379 で `addGhostRow("(fire: empty reply)")` / `"(fire error: …)"` に実在 =
  ゴースト行の型の再利用という主張どおり）。
- **soul 行**: `className = "row speaker-" + speaker`（speaker 駆動の行クラス）+
  `.row.speaker-soul .who` CSS の固定 = S2.5 受け口で soul 行が描けることの構造固定。

限界（既存型に内在・non-blocking）: 静的検査ゆえ「ブラウザで実際にボタンが disable される」ことは
実行検証していない（S2.5 からの既存方針 = 見た目は人間ゲート。preflight-fire が SSE 側の実配信を
実 HTTP で担保）。

### 3.2 `scripts/cockpit.test.mjs` 新規 6 件 — ホローでない

- **parseCockpitArgs**: (a) 無フラグ → port/channel/ttsBaseUrl/speaker/fireWindowMin/fireMaxChars
  全 undefined + help false（S2.5 挙動不変の入口を固定）、(b) 既存 `--port`/`--help`/`-h` 不変、
  (c) **S3 フラグ 5 種**（--channel/--tts-base-url/--speaker/--fire-window-min/--fire-max-chars）の
  具体値パース。実装（cockpit.mjs L44-65）と 1:1 対応。
- **createLazyChannel**（fake connectImpl のみ・実 WS なし）: 構築時 connects=0（lazy）→ 初回
  sendSpeech で接続 → 2 回目は connects=1 のまま（再利用）/ 接続失敗 throw → **非キャッシュで次回
  再試行成功（connects=2）** / close の 3 相（未接続 no-op・接続済み close=1・冪等 close=1 のまま）。
  実装（cockpit.mjs L76-108: 失敗時 `channelPromise = null` で非キャッシュ）の設計判断を正確に固定。
- main() の実配線は非テスト——**cockpit.mjs L242 の `invokedDirectly` ガード**により import 時に
  main は走らない（テストが import しても実 SDK spawn なし）ことをコードで確認。担保は実起動 +
  人間ゲートへ移譲（s3-followup §2-2 に台帳化済み・妥当）。

### 3.3 非接触・タイムアウト

- **実 SDK/実マイク/実器/実再生への接触なし**: scripts/cockpit.test.mjs は fake connectImpl のみ・
  createLlmSession/createAudioPlayer は一切呼ばない。cockpit-page.test.mjs は readFileSync +
  ループバック HTTP（factory 非注入 = fire 経路なし）のみ。
- タイムアウト: scripts/cockpit.test.mjs は **6 件全部 `{ timeout: 5000 }` 付き**。cockpit-page の
  追加 6 件は timeout オプションなしだが、**全て同期の静的検査**（readFileSync + match・await なし）
  でハング面がなく、既存 7 件の型（静的検査は timeout なし）と同一。wave 計画 §4-5「従来どおり」に
  適合 = non-blocking。

## 4. 計測記録の静的整合（measure-fire.mjs は**実行していない**）

コード読解 + 記録突き合わせのみで検査した:

- **(a) ハードガード実在**: `MAX_ASKS = 5`（measure-fire.mjs L37）+ measuringSession.ask 内の
  `if (askCount >= MAX_ASKS) throw`（L85-87・6 回目拒否）+ ループ自体も `i < MAX_ASKS` の 5 周
  （L114）= 構造的に 5 ask 上限。orchestrator へは measuringSession のみ渡る。speak/channel/player
  は fake（L97-107）・env ガード `assertSubscriptionAuthEnv` を起動冒頭で通す（L56）。
- **(b) s3-summon.md §1 の表 ↔ スクリプト出力の対応**: 表の列（注入 lines/chars・TTFT・ask・
  fire 全体・input_tok・output_tok・応答 chars）は record フィールド（includedCount/injectedChars・
  ttft_ms・ask_ms・fire_elapsed_ms・usage・replyChars、L122-134）と全列対応。
  **内部整合も検算**: usage 合計 input 254+432+652+933+2 = **2,273 tok**・output 53+31+34+34+37 =
  **189 tok**・cache_creation 1,273（#5）——domain-b.md §3 の合計主張と一致。注入の累積
  （1/36 → 3/127 → 5/193 → 7/253 → 9/318 行/字）は「fire 毎に you+soul が +2 行」の実運用形の主張と
  構造的に整合。domain-b.md §3 の TTFT/ask 5 点も s3-summon §1 の表と全数一致（転記ミスなし）。
- **(c) §2 再計測手順**: コマンド（`node apps/soul/agent/scripts/measure-fire.mjs`）・前提
  （/login 済みサブスク OAuth・ガード対象 env 未設定 → env-guard が起動拒否）・「5 回固定・6 回目
  throw」の注意書き、いずれもスクリプト実体（L22-26 ヘッダ・L56・L85-87）と一致。

**判定範囲の限界（正直な明記)**: 上記は「記録がスクリプトの出力形と矛盾なく、内部で検算が合う」
ことの確認であり、**数字そのものの再現確認はしていない**（再実行禁止の規律を優先）。TTFT ≈3.2〜3.9s
等の値の真正性は Gnome の実行記録を信頼する範囲。

## 5. blocking / non-blocking

- **blocking: なし**。
- **non-blocking**:
  1. cockpit-page.test.mjs 追加 6 件に timeout オプションなし（全て同期静的検査・既存型どおり。
     §3.3）。
  2. 既存テスト名「diagnostic asrFailure adds a ghost row; **other diagnostic types do not**」と
     S3 実装（fireEmptyReply/fireError もゴースト行を出す）の含意ズレ——Gnome 自身が
     domain-b.md §4-1 で申告済み。assert 本体は asrFailure 分岐の存在確認のみで**テストは正当に
     通過**しており、既存テスト変更禁止の規律優先は妥当。次に同ファイルを触る wave で名前更新を推奨
     （s3-followup へ台帳化されているかは docs レーンの領分）。
  3. preflight-cockpit の deviceCount=0（ffmpeg ENOENT）はレビュー環境の PATH 事情で、preflight
     自身が PASS 判定を返す設計（S2.5 の型）。無退行判定に影響なし。
