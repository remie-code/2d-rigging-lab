# S2.5 Domain B レビュー（testレーン）: ページ本体 + 仕上げ

> レビュアー: Review-Sylph（testレーン）。判定基準: [../../orchestration/s2-5-wave-plan.md](../../orchestration/s2-5-wave-plan.md) §4。
> 対象: [../../waves/s2.5/domain-b.md](../../waves/s2.5/domain-b.md)。
> 実行日: 2026-07-12。全数字は本レビューで実際にコマンドを実行して裏取りしたもの（Gnome報告の転記ではない）。

## 総合判定: **PASS**（blockingゼロ）

## 1. 実行して裏取りした生の数字

### 1-1. `apps/soul/agent` で `node --test`（全件）
```
1..226
# tests 226
# suites 0
# pass 226
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1363.066
```
→ **226/226 緑**。domain-b.mdの主張（217無退行 + Domain B新規9 = 226）と一致。全件緑を実測で確認。

### 1-2. 新規2ファイルのみ
```
node --test src/cockpit-page.test.mjs src/cockpit-settings-store.test.mjs
1..9
# tests 9
# pass 9
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 147.9534
```
→ 想定通り9件（cockpit-page.test.mjs 4 + cockpit-settings-store.test.mjs 5）、全緑。

### 1-3. `node apps/soul/agent/scripts/preflight-cockpit.mjs`
```
[preflight-cockpit] server listening at http://127.0.0.1:12663 (loopback)
[preflight-cockpit] GET /            → 200 html=true hasTimeline=true
[preflight-cockpit] GET /api/state   → 200 ears=stopped health=true
[preflight-cockpit] GET /api/devices → 200 deviceCount=0 error=ffmpeg spawn failed: spawn ffmpeg ENOENT
[preflight-cockpit] RESULT: PASS (page served, state + devices respond; mic untouched)
[preflight-cockpit] server closed (no hang)
EXIT=0
```
→ PASS・exit 0・ハングなし（プロセスは即座に終了しシェルへ制御が返った）。127.0.0.1バインドも確認。

### 1-4. モノレポ3チェック（リポジトリルート）
- `pnpm run check:soul-zone` → `Soul zone boundary guard passed: 1312 source files scanned; no 器→魂 imports and no 魂→器 code imports.`（緑）
- `pnpm run check:deps` → `Dependency guard passed.`（緑）
- `pnpm run check:source` → exit 1・唯一の違反:
  ```
  Source organization violations found:
  - apps/runtime-player/src/main/physiology/index.ts: index.ts must remain a barrel-only entrypoint
  ```
  → 前提（Orch確定）どおり器コード・pre-existing・S2.5無関係の1件のみ。Domain Bの新規ファイル（.mjs/.html）による新規違反はゼロ（このチェックは`.ts`のみ走査対象であり、そもそも対象外）。**無退行として合格**。

### 1-5. lockfile不変・git status
```
$ git diff --stat -- pnpm-lock.yaml apps/soul/agent/package-lock.json
(出力なし＝差分ゼロ)

$ git status --porcelain
 M apps/soul/README.md
 M apps/soul/agent/.gitignore
 M apps/soul/agent/package.json
?? apps/soul/agent/scripts/cockpit.mjs
?? apps/soul/agent/scripts/preflight-cockpit.mjs
?? apps/soul/agent/src/cockpit-page.mjs
?? apps/soul/agent/src/cockpit-page.test.mjs
?? apps/soul/agent/src/cockpit-server.mjs
?? apps/soul/agent/src/cockpit-server.test.mjs
?? apps/soul/agent/src/cockpit-settings-store.mjs
?? apps/soul/agent/src/cockpit-settings-store.test.mjs
?? apps/soul/agent/src/cockpit.html
?? discussion/ai-cohost/implementation/reviews/s2.5/
?? discussion/ai-cohost/implementation/waves/s2.5/
```
→ lockfile差分ゼロを実測確認。変更ファイルはREADME.md/.gitignore/package.jsonのみで許容範囲内。
Domain A由来の `cockpit-server.mjs`・`cockpit-server.test.mjs` はuntrackedで並ぶが、mtimeを実測（`ls -la --time-style=full-iso`）すると `cockpit-server.mjs`/`.test.mjs` は17:32〜17:35、Domain B新規ファイル（`cockpit-page.mjs`/`cockpit.html`/`cockpit-settings-store.mjs`）は17:56〜17:57で、Domain A成果物のタイムスタンプがDomain B着手より前かつ以後更新されていないことと整合する。「読むだけで変更していない」というGnomeの主張と矛盾しない。

### 1-6. 実設定ファイルの非汚染
```
$ ls apps/soul/agent/cockpit-settings.local.json
No such file or directory
```
→ 全テスト+preflight実行後も既定の実設定ファイルは作成されていない。汚染ゼロを実測確認。

## 2. テスト品質の評価

### 2-1. `cockpit-page.test.mjs`（ホローでないか）
- **① GET / 実配信テスト**: `createCockpitServer({ indexHtmlPath: cockpitHtmlPath })` で実サーバを起動し、実HTTPリクエストで実`cockpit.html`を取得・パース。9つの必須DOM識別子（ears-status/health-whisper/health-ffmpeg/device-select/btn-start/btn-stop/timeline/footer-discarded/footer-uptime）を`assert.match`で検証。実際に`cockpit.html`を読んで照合した結果、9識別子は全て実在し一致。**意味のあるE2E級assert**。
- **② ワイヤ契約消費テスト**: `EventSource("/api/events")`・4種のSSE `addEventListener`（state/vad/transcript/discard）・4種の制御API文字列の存在を正規表現で検証。`readFileSync`による静的検査だが、`cockpit.html`の実コードを読んだ限り、これらは単なる文字列存在チェックではなく実際に該当箇所で使用されているコードそのものにマッチしており、ホローではない。
- **③ 自己完結性**: 外部`<script src>`・外部stylesheet・`http(s):`のsrc/href・`@import`の不在を検証。`cockpit.html`を確認した限り該当パターンは実際に存在しない。
- **④ 履歴レイテンシ非対称**: `latencyMs != null` という条件分岐コードの存在を正規表現で検証。これは**静的コード検査であり、動的な統合テストではない**（サーバ経由で実際に履歴行にレイテンシが付かないことをHTTP越しに確認しているわけではない）。契約準拠の軽量な回帰止めとしては妥当だが、動作保証としてはやや弱い。**non-blocking指摘**（実装コード自体（`cockpit.html` L200-205）を読んで確認した限り、`d.latencyMs != null` のときのみ`.lat`要素を追加する分岐になっており、テストの意図とコードは一致している）。

### 2-2. `cockpit-settings-store.test.mjs`（ホローでないか）
- ① set→get ラウンドトリップ + 別インスタンス再読込での永続確認 → 実ファイルI/Oを通した意味のあるテスト。
- ② `null`クリア → 実装（`setLastDevice(device ?? null)`）と整合。
- ③ 未作成/壊れJSON/想定外shape(`lastDevice: 123`) → 3ケースとも`null`を検証。実装の`try/catch`＋型チェック（`typeof value === "string"`）と一致。
- ④ 書けないパス（親をファイルにしてENOTDIR強制）→ `assert.doesNotThrow` + 書き込み失敗後の`getLastDevice`が`null`であることを確認。実装の`try/catch`で握って続行する挙動と一致。
- ⑤ `DEFAULT_SETTINGS_PATH`が`apps/soul/agent/cockpit-settings.local.json`であることを検証。
- 全テストは`mkdtempSync(tmpdir())`を使い、実設定ファイルには一切触れない。§1-6の実測（テスト実行後も実ファイル不在）と整合。**ホローではない、意味のあるテスト**。

## 3. 欠けている重要ケース（non-blocking）

1. `cockpit-page.test.mjs`④のレイテンシ非対称テストは静的検査に留まる（§2-1参照）。動的にサーバ経由で検証する統合テストを追加する余地はあるが、blockingではない。
2. `scripts/cockpit.mjs`（本番起動エントリ、SIGINT/EOFでclean close）自体を検証する機械テストが存在しない。wave-plan §4-5「UI(ブラウザ)を閉じても魂が生き続けることのテスト」はDomain A（`cockpit-server.mjs`）側の責務と解釈できるが、`scripts/cockpit.mjs`固有の起動導線（URL表示・clean close配線）は未テスト。domain-b.mdのfollowup台帳（`s2-5-followup.md`）にもこの項目の記載は見当たらない。**non-blocking**だが、followupへの追記を推奨。
3. 409（衝突: 既にlistening中にstart）・devices失敗時のHTTPステータスの回帰固定はDomain Aテスト側の欠落としてGnomeがdomain-b.md §9で質問として明記済み（Domain Bスコープ外の判断で合っているかをOrchへ確認要求）。testレーンとしても、この点はDomain Aの契約対象であり、Domain Bが自らのテストで補う必要はないと判断する（Domain Bのpage/settings-storeテストのスコープを超える）。

## 4. 質問（Orchへ）

- Gnomeがdomain-b.md §9で提起した2件（409/devices失敗HTTPの回帰固定をDomain Aテストに追加すべきか／uptimeのクライアント側ローカル刻みで v0 として十分か）は、testレーンの裏取り結果と矛盾しない設計判断であり、reviewをblockする理由にはならないと判断した。ただし最終的な合意はOrch側で行うべき事項として申し送る。
- 上記§3-2（`scripts/cockpit.mjs`起動導線の機械テスト欠落）をfollowupに追記するかどうかはOrch判断を仰ぎたい（blocking化は不要と考えるが、記録漏れの可能性があるため確認）。

## 5. 結論

テスト226/226緑（新規9/9含む）、preflight PASS（exit 0・ハングなし）、3チェック無退行（唯一の`check:source`違反は既知pre-existing・器コード）、lockfile差分ゼロ、実設定ファイル非汚染を全て実行して裏取りした。テストはページ構造・ワイヤ契約消費・自己完結性・settings storeの失敗寛容/非汚染を意味のあるassertで検証しており、ホローな箇所は軽微（§2-1④の静的検査のみ、non-blocking）。**blockingなし、PASS**。
