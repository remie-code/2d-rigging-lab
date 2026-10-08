# 配信間記憶 followup 台帳

> Status: Domain B 完了時点で記録（2026-07-19）。将来梯子(soul §5)と Domain A/B の申し送りをここに集約する。

## 1. 将来の梯子（soul §5・v0 外・議論クローズ済みの既定路線）

1. **ダイジェスト群の日記への合本・再圧縮**: `memories/*.md` が件数として溜まってきたら、古いものを
   要約しなおして 1 冊の「日記」へ合本する仕組みが要る（現状は N=3 件の単純な直近読みで、4 件目以降は
   注入されないだけで消えはしない=ファイルは残る）。件数が実際に溜まってから着手する後回し課題。
2. **起動時の個別選択 UI**: 「今日はこの配信の記憶だけ外す」のような個別選択はファイル削除/移動で
   代替できている間は作らない（`memories/` から該当 `.md` を移すだけで次回起動の自動搭載から外れる・
   ファイルシステムが正という設計思想と整合）。
3. **長回し対策（セッション内圧縮・候補 B）とは別問題として維持**——ただしチェックポイント機構
   （20 分間隔・`recordMemory`）は将来そちらの部品になり得る（縫い目だけ意識しておく・inventory §5）。

## 2. Domain A → Domain B 申し送りへの回答（domain-a.md §7 を参照）

1. **`loadRecentDigests().count` の定義**: Domain B は Domain A の定義（`parts.push` した=実際に
   文字が入った件数）をそのまま「実際に搭載した件数」として UI に使った（`memoryStatusLabel` の
   「記憶 N 件を搭載」）。「試みた件数」ではなく「実際に注入テキストへ入った件数」を見せる方が
   ユーザーの実感（プロンプトに実際に何件分の記憶が乗っているか）に一致するため、Domain A の定義を
   そのまま正とした。追加の調整は不要だった。
2. **`generateDigest` の `ask` への入力形（画像等の将来拡張）**: Domain B でも文字列のみで配線した
   （転写整形＝`formatTranscriptForDigest` の出力はテキストのみ）。将来「配信のスクリーンショットも
   記憶に含める」場合は `createMemoryRecorder` の `generateDigestImpl` 呼び出し（`cockpit.mjs`）と
   `generateDigest` 自体（`memory.mjs`）の両方にシグネチャ変更が要る。
3. **`maxChars` の具体値**: `MEMORY_INJECT_MAX_CHARS = 4500`（`scripts/cockpit.mjs`）。根拠 =
   `DIGEST_GENERATION_INSTRUCTION` の分量目安（≤1500 字/件・`memory.mjs`）× `DEFAULT_DIGEST_COUNT`
   （3 件）= 4500。仮面（FIRE_SYSTEM_PROMPT）+ 記憶 + 当日の Fire 注入窓（`FIRE_MAX_CHARS`=4000・
   `fire-injection.mjs`）を合算しても常識的なプロンプト長に収まる値として選んだ（人間ゲートの体感で
   要調整の可能性はあり・v0 コード内定数の流儀どおり）。
4. **ファイル名の UTC/ローカル変換**: `saveDigest` 内部のファイル名は Domain A の設計どおり UTC 由来
   のまま不変（Domain B は触っていない）。UI に出す「最新記録時刻」（`memoryStatusLabel` の
   「最新: HH:MM:SS」）は `lastRecordAtMs`（`Date.now()` の生の epoch ms・タイムゾーン中立）を
   `view-logic/format-time.mjs` の `formatClock`（既存のローカル時刻表示ヘルパー）で変換して描画する
   ——申し送りどおり表示変換のみ Domain B 側で行った。

## 3. Domain B 内の裁量判断・具体値の根拠（domain-b.md にも記載・ここに集約）

1. **`SHUTDOWN_MEMORY_TIMEOUT_MS = 15000`（15 秒）**: inventory §1 の実測「短命 ask ≈5s
   （初期化 1.9s + ask 3.2s・s1-first-light）」の 3 倍のマージン。digest 生成は通常 Fire よりも
   遥かに大きい入力（配信全体の転写）を ask に渡すため、通常の短命 ask より長くかかりうる一方、
   Ctrl+C からの体感待ち時間を無限に伸ばすわけにはいかないため、実測値の 3 倍という保守的だが
   有限のマージンを採用した。
2. **`MEMORY_CHECKPOINT_INTERVAL_MS = 20 * 60 * 1000`（20 分）**: inventory §2-4 の裁定どおり
   「15〜30 分の中庸」をそのまま採用（L0 設計判断で既に確定済みの値・Domain B での新規決定ではない）。
3. **`lastRecordAtMs` はプロセス内正本（前回起動を跨がない）**: `cockpit.mjs` main() スコープの
   `let lastRecordAtMs = null` は起動のたびにリセットされ、このプロセス内で記録が一度も成立して
   いなければ null のまま（前回起動の記録時刻をディスクから読み直して引き継ぐ実装にはしなかった）。
   理由: `loadRecentDigests` はダイジェスト「本文」しか返さず、ファイルの実際の記録時刻（mtime や
   ファイル名由来の startedAtMs）を持ち出す口を Domain A が用意していない。前回記録時刻の復元には
   Domain A 側の追加口（例えば `loadRecentDigests` にファイル一覧のメタ情報も返させる）が要るため、
   v0 では「このプロセスで記録するまでは null 表示（まだ記録なし）」という単純な仕様に留めた。
   UI 体感上「起動直後は最新記録時刻が空欄」になる点は許容範囲と判断したが、気になる場合は
   Domain A 側 API 拡張（ファイル一覧+mtime を返す口）とセットで再検討の余地あり。
4. **転写取得の継ぎ目（★重要な配管事実への対応）**: `cockpit-server.mjs` の返り値オブジェクトに
   `getTranscript: () => (pipeline ? pipeline.transcriptBuffer.all() : [])` を additive に追加した
   （HTTP/SSE のワイヤ契約ではなく内部 JS API）。`cockpit.mjs` 側は `let server;`（前方参照・
   `sessionProxy` が `session` を前方参照するのと同型）を main() 冒頭で宣言し、`recordMemory`/
   チェックポイントタイマー/shutdown がこれを通じてライブ転写を読む。shutdown は
   `server.close()` より前に `finalMemoryEntries` を確保してから close するため、pipeline が
   dispose されて null になった後に転写を取りに行く事故を構造的に避けている。

## 4. 開示文言（wave 計画 §6・wave 外・L0 直轄）

`pre-stream-checklist.md` §1 への追記は L0 が発進時に実施済み（wave 計画の記載どおり・Domain A/B
どちらも手を付けていない）。
