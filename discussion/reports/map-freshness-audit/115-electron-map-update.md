# Electron migration map update report

> Map-update contract に従い、子 work-stream map を先に更新してから migration 親 map を更新した記録。基準点は `3c3669eefcc375c62d1ec6b4d77a000d7cbbb61c` / 2026-08-08 (Asia/Tokyo)。

## 1. 確認した範囲

次の5 mapを確認し、shell/persistence/cleanup/packaging の子 map → `editor-electron-migration/_map.md` の順に更新した。

- `discussion/editor-electron-migration/shell/_map.md`
- `discussion/editor-electron-migration/persistence/_map.md`
- `discussion/editor-electron-migration/cleanup/_map.md`
- `discussion/editor-electron-migration/packaging/_map.md`
- `discussion/editor-electron-migration/_map.md`

根拠は `43-editor-electron-migration.md`、`62-cross-topic-integration.md`、`90-root-map-integration.md`、`map-update-contract.md`、各 WS の plan/domain-report/review、`packaging-report.md` である。

## 2. 変更・未変更

- 変更: 上記5 map。WS1〜WS4 と packaging の完了、Web/portable の境界、残債を現行入口として索引した。
- 作成: なし（本レポート `115-electron-map-update.md` のみ新規作成）。
- 意図的に未変更: `00-agreement.md`、`01-decomposition.md`、各 plan/domain-report/review、`discussion/_map.md`、source/test/config。計画文書の `Draft` は map 側で「実装前の計画記録」として time-qualify した。

## 3. 置換した主張と監査根拠

1. shell/persistence の obsolete な「次: WS2」「WS3/WS4 が着手可能」を、後続 WS と packaging も完了済みという現行状態へ置換した（`43-editor-electron-migration.md` §2、§3）。
2. migration 親を WS1〜WS4 + packaging 完了として更新し、「WS1 first」「packaging next」を除去した。Web target は退役済み、現行 E2E は `_electron` harness である（`43-editor-electron-migration.md` §3、`62-cross-topic-integration.md` R07/R17/R21）。
3. portable 廃止の判断を editor feature 層限定として保持し、`authoring-core` / `package-format` の bundle は dormant なテスト土台として温存することを明記した（`43-editor-electron-migration.md` §3、`01-decomposition.md` §3）。
4. PSD import E2E は harness 起動・描画の実証に留まり、workspace 作成/開放と native picker 回避 hook が欠落する stale precondition を未クローズとして索引した。全ゲート緑とは扱っていない（`43-editor-electron-migration.md` §3-§4）。
5. editor typecheck 赤・unit test 4件失敗は移行外の独立 debt とし、`dist:win` が typecheck を含まないことも明記した（`43-editor-electron-migration.md` §4、`packaging/packaging-report.md` Residual/nit①）。
6. portable 廃止後に残る `workspace-storage-state.ts` の export 文言と `import-portable-json` reason/message を editor 側 dead branch として索引した。下層 bundle の dormant 温存とは別の残差である（`43-editor-electron-migration.md` §3）。
7. packaging の `description` / `author` 欠落 warning を非ブロッキングの未決事項として残した（`43-editor-electron-migration.md` §3-§4、`packaging/packaging-report.md` Residual）。

## 4. 保持した決定とゲート

- WS1 単窓 Electron 殻、WS2 node:fs/IPC、WS3 Web 退役、WS4 `_electron` 化、Windows portable packaging の完了判定を変更していない。
- portable feature 層除去と下層 bundle dormant 温存の境界を維持した。
- PSD E2E、独立 typecheck/unit、portable dead branch、metadata warning は未解決/残債として保持し、実機・外部ゲートを自動 pass に昇格していない。
- WS2 の symlink(realpath 非使用)、種別衝突丸め、任意テスト強化候補は accepted non-blocking residual のまま保持した。

## 5. 検証

- `git diff --check -- discussion/editor-electron-migration` — pass（空白エラーなし。Git の LF→CRLF warning のみ）。
- Markdown 相対リンク検査（5 map の `](...)` を解決する PowerShell check）— `BROKEN=0`。
- `git diff --stat -- discussion/editor-electron-migration` — 5 files changed, 34 insertions, 23 deletions。
- source/test/config や `discussion/_map.md` の変更は行っていない。stage/commit も行っていない。

## 6. 所有範囲外の残課題

- PSD import E2E の workspace/native-picker 修正実装。
- `task_c8fc5155` の typecheck 21件・unit 4件の解消または完了条件判断。
- portable dead branch の source cleanup。
- packaging metadata (`description` / `author`) の補完判断。
- root `discussion/_map.md` への反映と、後続の mechanical/semantic review はそれぞれの所有者に委ねる。
