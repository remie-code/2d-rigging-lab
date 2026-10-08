# S2.5 Domain B レビュー(designレーン): ページ本体+仕上げ

> レビュアー: Review-Sylph(designレーン)。Orch-Sylphからのサブエージェント委任。
> 対象: [../../waves/s2.5/domain-b.md](../../waves/s2.5/domain-b.md)(Gnome実装記録)。
> 判定基準: [../../orchestration/s2-5-wave-plan.md](../../orchestration/s2-5-wave-plan.md) §2/§4、[../../waves/s2.5/domain-a.md](../../waves/s2.5/domain-a.md) §5(settings store IF)。
> 観点: 実装品質・自己完結性・安全・クリーンシャットダウン・非接触。

## 総合判定: **PASS**(blockingゼロ)

## 検証方法

- 対象ファイルを実読(`cockpit.html`・`cockpit-page.mjs`・`cockpit-settings-store.mjs`・`scripts/cockpit.mjs`・`scripts/preflight-cockpit.mjs`・`cockpit-page.test.mjs`・`cockpit-settings-store.test.mjs`)。
- `apps/soul/agent` で `node --test` を実行 → **226/226 緑**(実測、Gnome報告と一致)。
- `node apps/soul/agent/scripts/preflight-cockpit.mjs` を実行 → **PASS・exit 0・ハングなし**(実測)。
- リポジトリルートで `pnpm run check:soul-zone` / `check:deps` / `check:source` を実行(実測)。
- `git diff` / `git status` で package.json・.gitignore の差分、Domain A ファイルの非接触、lockfile不変を確認(実測)。

## 観点ごとの判定

### 1. ページの自己完結性 — 適合

`cockpit.html` を全文確認。`<head>` 内は inline `<style>` のみ(`<link>` なし)。`<body>` 末尾の `<script>` は inline IIFE のみ(`<script src=...>` なし)。使用しているブラウザ組み込みは `EventSource`/`fetch`/`document.*`/`Date` のみ。CDN・外部フォント・`@import`・`http(s)://` を指す `src`/`href` は無い。
`cockpit-page.test.mjs` の自己完結性テスト(3件目)がこれを正規表現で固定しており、実行して緑を確認した。CSPは不要(外部リソース依存ゼロ)。

### 2. file-backed settings store の失敗寛容 — 適合

`cockpit-settings-store.mjs` を確認。
- `getLastDevice()`: `try { JSON.parse(readFileSync(...)) } catch { return null; }`。未作成/読めない/壊れたJSON全て捕捉。加えて shape チェック(`typeof value === "string" && value.length > 0`)で想定外 shape(数値等)も `null` に落とす。throw する経路は無い。
- `setLastDevice()`: `mkdirSync`+`writeFileSync` を `try/catch` で包み、失敗時は握って続行(コメントに契約§5への参照あり)。throw しない。
- パス注入: `options.path` で差し替え可能。既定は `DEFAULT_SETTINGS_PATH = apps/soul/agent/cockpit-settings.local.json`(`.gitignore` 対象)。
- テスト非汚染: `cockpit-settings-store.test.mjs` の5件全てが `mkdtempSync(tmpdir())` を使用し、実ファイルに触れない。`preflight-cockpit.mjs` も同様に temp パスを注入している。
- 実行結果: 5件とも緑(set→get roundtrip / null クリア / 未作成・壊れJSON・想定外shape→null / 書けないパス→ throw しない / 既定パスの位置)。

### 3. 起動エントリのクリーン終了 — 適合

`scripts/cockpit.mjs` を確認。`SIGINT` ハンドラと `readline` の `close`(stdin EOF)の両方から同一の `shutdown()` を呼び、`closing` フラグで多重実行を防止。`shutdown()` は `await server.close()` → `process.exit(0)`(`finally` で必ず exit)。`server.close()` は Domain A 契約により耳 dispose + HTTP close + ハンドル解放を行う(Domain A レビュー済み事項)。`host` オプションは渡していないため `DEFAULT_COCKPIT_HOST = "127.0.0.1"` が適用される(`cockpit-server.mjs` 確認済み)。実マイクが無くてもサーバ起動・ページ表示は可能(Start ボタンを押すまで `enumerateDevices`/`ears/start` は呼ばれない)。
なお `scripts/cockpit.mjs` 自体の SIGINT/EOF 配線を直接叩く機械テストは無い(`ears-cli.mjs` の型を踏襲、という設計コメントに留まる)。close 本体のロジックは Domain A 側で機械テスト済みのため blocking ではないが、起動スクリプト自体の shutdown 配線は preflight でも経由しない(`preflight-cockpit.mjs` は `server.close()` を直接呼ぶ薄いラッパーであり `scripts/cockpit.mjs` の `shutdown()` は経由しない)。**裁量許容**として扱うが、下記「質問」に記録する。

### 4. preflight-cockpit の正しさ — 適合

`preflight-cockpit.mjs` を実行し実測: `server listening at http://127.0.0.1:<port> (loopback)` → `GET /` 200(html=true, hasTimeline=true) → `GET /api/state` 200(ears=stopped) → `GET /api/devices` 200(この開発機は ffmpeg 不在のため devices=0, error 文字列)→ `RESULT: PASS` → `server closed (no hang)` → `EXIT=0`。settings store は `mkdtempSync` 注入で実ファイルを汚さない(コード上確認)。耳の `start` を呼ぶコードパスは存在しない(GET系3本のみ)。実マイク不使用の要件を満たす。

### 5. 新規npm依存ゼロ・ビルドチェーン非導入 — 適合

- `package.json` diff: `scripts` に `"cockpit": "node scripts/cockpit.mjs"` の1行追加のみ。`dependencies` は無変更。
- import 確認: `scripts/cockpit.mjs`(`node:readline`/`node:url`+自zone相対3本)、`scripts/preflight-cockpit.mjs`(`node:http`/`node:os`/`node:path`/`node:fs`+自zone相対3本)、`cockpit-page.mjs`(`node:url`/`node:path`)、`cockpit-settings-store.mjs`(`node:fs`/`node:path`/`node:url`)。全て node 組み込み+自zone相対のみ。CDN・バンドラ・トランスパイラ不使用。
- `.gitignore` diff: `cockpit-settings.local.json` の無視追加のみ(コメント含め設定ファイル無視の趣旨に一致)。
- lockfile: `git diff --stat -- pnpm-lock.yaml apps/soul/agent/package-lock.json` → 出力なし(差分ゼロ、実測)。

### 6. 既存コード非接触 — 適合

- `cockpit-server.mjs`/`cockpit-server.test.mjs`(Domain A成果物)は共に untracked(baseline無しのため `git diff` 不可)だが、Domain B側の3ファイル(`scripts/cockpit.mjs`・`scripts/preflight-cockpit.mjs`・`cockpit-page.test.mjs`)の import 文はいずれも `createCockpitServer`/`DEFAULT_COCKPIT_PORT`/`cockpitHtmlPath` の**呼び出しのみ**で、書き換えを行うコードは存在しない。mtime も傍証: `cockpit-server.mjs`(17:32)・`cockpit-server.test.mjs`(17:35)が `cockpit.html`/`cockpit-page.mjs`(17:56台、Domain B作業時刻)より前で、以降更新されていない。
- `git status apps/soul/` → 変更は `apps/soul/README.md`(M)・`apps/soul/agent/.gitignore`(M)・`apps/soul/agent/package.json`(M)+新規ファイル群のみ。ear-pipeline.mjs 等の魂zoneコードや器コード(apps/soul外)への変更は無い。
- リポジトリ全体の `git status`(セッション冒頭のスナップショット)には canvas/mesh-generation 系の変更が別途あるが、これは本タスク(S2.5 Domain B)と無関係な既存の並行作業であり、Domain B の成果物ではない。

### 7. 127.0.0.1限定を崩していない — 適合

`cockpit.mjs`・`preflight-cockpit.mjs` ともに `host` オプションを渡さず、`cockpit-server.mjs` の `DEFAULT_COCKPIT_HOST = "127.0.0.1"` がそのまま適用される(`assertLoopbackHost` が非loopbackを構築時 throw する構造、Domain A実装)。preflight実行時の実測 URL も `http://127.0.0.1:<port>` であることを確認した。

## 3モノレポチェック(実測)

- `check:soul-zone` → 緑(`1312 source files scanned`)。
- `check:deps` → 緑。
- `check:source` → 赤だが、唯一の違反は `apps/runtime-player/src/main/physiology/index.ts`(器ファイル、Domain A/B とも1バイトも触れていない、pre-existing・本ドメイン外)。Domain B 新規ファイル(`.mjs`/`.html`)は対象外(`.ts` のみ走査)のため違反ゼロ。→ Domain A レビュー時と同じくOrch確定済み事項として容認、本レビューでもblockingにしない。

## テスト実測サマリ

- `node --test`(`apps/soul/agent`) → `tests 226 / pass 226 / fail 0 / cancelled 0 / skipped 0`(実測、Gnome報告と一致)。
- `preflight-cockpit.mjs` → PASS・exit 0・ハングなし(実測)。

## 裁量許容(blockingではない)

- ページ配信をファイルパス経由(`indexHtmlPath`)にした設計判断(テンプレートリテラルのエスケープ問題回避) — 妥当。
- uptime のクライアント側ローカル刻み — v0の診断面として妥当、followupに記録済み。
- デバイス列挙失敗を赤字でsurfaceする裁量 — UX定義の趣旨に沿う。

## 質問(Orchへ)

1. `scripts/cockpit.mjs` の SIGINT/stdin EOF ハンドラ配線自体(`shutdown()` → `server.close()` → `process.exit(0)`)を直接検証する機械テストが無い(`server.close()` 本体のロジックは Domain A 側でテスト済みだが、起動スクリプトの signal 配線そのものは未カバー)。`ears-cli.mjs` の既存型を踏襲しているため実質的なリスクは低いと判断し blocking にはしていないが、S3以降でこの配線を機械テストに固定する価値があるかは Orch/Undine の裁量に委ねたい。
2. Domain A レビュー(reviews/s2.5/domain-a-review.md、未読)側で `check:source` の pre-existing 違反(runtime-player)がどう扱われたかは本レビューでは前提としてそのまま踏襲した。Orch側の最終確定と齟齬が無いか確認されたい。

## 結論

Domain B の実装は、UX定義§2の画面構造・Domain A ワイヤ契約(§3-5)・wave計画の設計の枠(§2)・blockingレビュー基準(§4)に適合している。自己完結性・失敗寛容・クリーンシャットダウン・新規依存ゼロ・既存コード非接触・127.0.0.1限定のいずれも実測で裏取りできた。blocking事項は無し。**PASS**。
