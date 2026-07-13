# S6 Domain A レビュー（design レーン）

> レビュアー: Review-Sylph（design レーン）。呼び出し元: Orch-Sylph。読み取り専任。
> 日付: 2026-07-13。対象: `apps/soul/agent`（S6 Domain A「声の器官刷新・MediaPlayer 化」実装）。
> 総合判定: **PASS-with-nonblocking**。blocking なし。

観点は inventory §3-1〜3-3・wave-plan §2/§3 Domain A/§4 blocking 基準に対する適合。器不変・依存ゼロ・魂ゾーン境界・常駐 1 プロセス設計の維持・依存方向（voice→eyes）の妥当性・停止経路の設計・終了処理・失敗の扱い、の 6 点を自分でファイルを読み・自分でコマンドを実行して確認した（Gnome の報告値を転記していない）。

---

## 0. 自分で再実行した機械ゲート・器不変確認

```
git diff --stat -- apps/runtime-player packages pnpm-lock.yaml apps/soul/agent/package.json
```
出力なし（器コード・lockfile・package.json 完全不変）。

```
git diff --stat -- '*channel-protocol-contract*'
```
出力なし（契約 JSON 不変）。

```
git diff --stat -- apps/soul/agent/package-lock.json
```
出力なし（独立 npm パッケージのロックファイルも不変＝新規依存ゼロを裏付け）。

```
node scripts/check-soul-zone-boundary.mjs
→ Soul zone boundary guard passed: 1337 source files scanned; no 器→魂 imports and no 魂→器 code imports.
EXIT=0
```

```
node scripts/check-dependencies.mjs
→ Dependency guard passed.
EXIT=0
```

```
node scripts/check-source-organization.mjs
→ Source organization violations found:
  - apps/runtime-player/src/main/physiology/index.ts: index.ts must remain a barrel-only entrypoint
EXIT=1
```
このファイルへの `git diff --stat` は空（本 Domain は 1 バイトも触っていない）。`git log --oneline -- apps/runtime-player/src/main/physiology/index.ts` で S4/C6 期の既存コミット（ed49b5d 等）由来と確認——本 Domain 導入の違反ではなく、スコープ外の器側 pre-existing 課題。**本 Domain の変更範囲内では check:source 無退行**（claim §6 と一致）。

```
git status --porcelain | grep -v '^?? .tmp/'
→  M apps/soul/agent/src/voice/audio-player.mjs
   M apps/soul/agent/src/voice/audio-player.test.mjs
   M apps/soul/agent/src/voice/speak.mjs
   M apps/soul/agent/src/voice/speak.test.mjs
  ?? apps/soul/agent/scripts/preflight-voice.mjs
  ?? apps/soul/agent/src/test-support/fake-media-player.mjs
  ?? discussion/ai-cohost/implementation/waves/s6/
```
claim（domain-a.md §6）の一覧と一致。`.tmp/facex-*` は未接触。

```
cd apps/soul/agent && node --test
# tests 425
# pass  425
# fail  0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1212.3601
```
claim（domain-a.md §8）の `425/425/0`・S6 前ベースライン 411 からの +14 と一致。1 回目の実行で安定（interrupted/空なし・再試行不要）。event loop リークなし（1.2 秒で正常終了・ハングなし）。

```
grep -c "test(" src/voice/audio-player.test.mjs → 20
grep -c "test(" src/voice/speak.test.mjs        → 5
```
claim の「7→20」「4→5」と一致。

---

## 1. 器不変・依存ゼロ — PASS（最重要 blocking 基準）

- `apps/runtime-player/**`・`packages/**`・`pnpm-lock.yaml`・`apps/soul/agent/package.json`・`apps/soul/agent/package-lock.json`・契約 JSON、いずれも diff 空を自分のコマンドで確認済み（§0）。
- 新規実装は WinRT（`Add-Type -AssemblyName System.Runtime.WindowsRuntime`）+ PowerShell 5.1 内蔵型 + Node 組み込みモジュール（`node:child_process`/`node:fs`/`node:os`/`node:path`）のみ。`import`/`require` を `audio-player.mjs`・`speak.mjs`・`fake-media-player.mjs` で確認したが、外部 npm パッケージへの新規 import は無い（`../eyes/powershell-exec.mjs` は soul-zone 内の相対 import であり外部依存ではない）。

## 2. 常駐 1 プロセス設計の維持 — PASS

- `RESIDENT_POWERSHELL_SCRIPT`（audio-player.mjs:61-138）は起動 1 回・while ループ常駐。PLAY 受信ごとに `player.Source` を差し替えて `Play()`（:99-108）——同一 `MediaPlayer` インスタンスでの連続再生を実装で確認。
- stdin ループ生存の要点（inventory §3-2 の実機知見）を実装で裏付け: `Console.OpenStandardInput()` の生ストリームを `ReadAsync` + `Task.Wait(50)` でポーリング（:82-125）し、`TextReader.ReadLineAsync()` を使っていない——コメント（:56-59）が「2 回目以降が同期ブロックし得るため生ストリーム方式に確定」と明記し、実装が非ブロッキング読みを徹底している。この設計により **PLAY 再生中でも STOP 行がループに届く**（stdin 読み取りと再生状態ポーリングが同一 while イテレーション内で両立、:110-137）。
- 完了判定の Position 併用（:126-136）: `$sawPlaying && state∉{Playing,Opening,Buffering} && pos ≥ dur-80` の 4 条件 AND。`$sawPlaying` は PLAY 時に false へリセットされる（:105）ため、連続再生で「前の WAV の完了」を「新しい WAV の完了」と誤認しない設計になっている。STOP 経路は Handle-Line 内で即座に `$playing=$false`（:98）を設定するため、STOP 後の次ポーリングは `if ($playing)` ブロックへ進まず ENDED を誤発火しない——単一スレッド PowerShell ループなので STOP 処理とポーリング判定の間にレースは生じない。preflight §5 の実測（STOP 途中停止で誤 ENDED 無し）と実装の論理が整合している。

## 3. 依存方向（voice→eyes）の妥当性 — PASS（設計思想上の申し送りあり）

- `check:soul-zone` は自分で実行し pass（§0）——`voice`→`eyes` は同一魂ゾーン内 import であり、器↔魂境界チェックの対象外は正しい。
- `powershell-exec.mjs` のヘッダ（:3-8）は「S5 Domain A・目の器官の土台」と書きつつ、実装（`buildPowerShellInvocationArgs`/`withUtf8OutputPrelude`/`runPowerShellScript`）自体はドメイン非依存の「PowerShell 1 プロセス完結実行」の純粋な共通層——`listAudioDevices()`（単発起動・timeout・stdout/stderr 収集・kill→destroy→unref）は `window-list.mjs` と全く同型の要求（1 回起動→タイムアウト付き待機→終了）であり、`runPowerShellScript` の再利用は形が一致した DRY として妥当。独自 exec 実装を書けば同じ kill/destroy/unref/settled ガードのロジックを複製することになっていた。
- 一方、**常駐プレイヤー本体は `runPowerShellScript` を使わず自前 spawn**（audio-player.mjs:228-231）——Gnome の申し送り通り「1 回起動モデル」と「stdin 常駐+複数応答」は形が違うため無理に共通化していない。これは正しい判断で、無理な共通化による複雑さの増加を避けている。
- **non-blocking**: 汎用の exec 共通層が `src/eyes/` ディレクトリ配下（器官固有の場所）に置かれている点は、ディレクトリ命名の意味論と実際の汎用性が一致していない。今回は `voice` からの再利用にとどまるが、将来さらに別の器官（例: 発火スケジューラの何か）がこれを再利用したくなった場合、「目の器官のファイルを読みに行く」という発見しにくさが生じ得る。soul-zone-boundary チェックは通過しており blocking ではないが、Domain D 以降で3つ目の再利用が出るようなら `src/common/` 等への切り出しを検討する価値がある。

## 4. 停止経路の設計 — PASS

- `stop()`（PowerShell 側 Handle-Line:94-98）は `Pause()` + `Source = $null` の 2 段——barge-in で必要な「即座に音を止める」+「次の PLAY が古い状態を引きずらない」を両立。Node 側 `stop()`（audio-player.mjs:284-289）は送出のみで dispose 後のみ throw——設計として正しく「引数不正/dispose 後のみ throw」の失敗方針（§5 参照）に整合。
- `isPlaying()` は STARTED→true、ENDED/STOPPED/ERROR→false（:240-244,295-297）——barge-in の土台として「今喋っているかの粗いフラグ」を提供する設計は inventory §3-3 の要求（正確な切断点は Domain B が `playbackStartedAtMs`+タイムラインで算出）と整合しており、このドメインが過剰に踏み込んでいない（scope の節度が良い）。
- テスト `isPlaying は STARTED で true・ENDED で false`・`isPlaying は STOPPED でも false`（audio-player.test.mjs:115-138）で両経路とも実際に確認されている。
- Gnome の§質問1「isPlaying は状態応答フラグで切断点算出には粗い」・§質問2「STOP の完了確定は STOPPED 行を待つ設計にできる」は、design レーンとしても同意できる正直な申し送り——v0 でここまで（Position を Node へ返す口は作らない）にとどめた判断は、モーラタイムライン×経過時間で足りるという inventory の設計方針と整合しており、over-engineering を避けている。

## 5. 終了処理 — PASS

- `dispose()`（audio-player.mjs:306-328）は `disposed` フラグで冪等——2 回目以降は即 return。`stdin.end()` → `kill()` → `stdin/stdout/stderr.destroy()` → `unref()` の順序は `powershell-exec.mjs` の `cleanupChild()` および S1 の作法（コメント:301-304 で明記）と一致。
- `node --test` が 1.2 秒で正常終了（§0）——常駐子プロセスが event loop に残ってテストランナーをハングさせていないことを実行で確認。

## 6. 失敗の扱い — PASS

- `play()`: 空文字/非文字列で TypeError（audio-player.mjs:275-277・テスト:185-193）。dispose 後は Error（:272-274・テスト:194-198）。それ以外（再生失敗）は throw させず PS 側が `ERROR\t<message>` 行を返して常駐継続（プロトコル定義:24,28・PLAY の catch:107）——「常駐を落とさない」設計が徹底されている。
- `listAudioDevices()`/`parseListDevicesStdout()` は `{devices}|{error}` の判別可能戻り値（`window-list.mjs` と同型・Gnome 申告通り）。「0 件は失敗ではない」（:389-390・テスト:223-227）、「id/name 欠落エントリは黙って除外」（:411・テスト:234-237「成功を捏造しない側に倒す」というコメント通りの挙動）をテストで確認——**成功の捏造をしない**という規律が実装・コメント・テストの三点で一致している。

---

## blocking / non-blocking

### blocking
- なし。器コード・契約 JSON・lockfile・package.json は完全不変（自分で確認）。新規依存ゼロ。`check:soul-zone` pass。voice→eyes は魂ゾーン内 import として健全。`node --test` 425/425/0、event loop リークなし。

### non-blocking（申し送り・提案）
1. **§3 の申し送り再掲**: `powershell-exec.mjs` はドメイン非依存の共通層だが `src/eyes/` 配下にあり、ディレクトリ命名の意味論と実際の汎用性が乖離している。今回の再利用（voice→eyes）自体は妥当だが、3 つ目の利用者が出るなら `src/common/`（や同等の場所）への切り出しを検討する価値がある。
2. **Gnome §質問1・2（isPlaying の粒度・STOP 完了通知タイミング）は design レーンとしても妥当な v0 の節度**であり、Domain B の裁定に委ねるのが正しい。Position を Node へ返す口を今追加していないのは over-engineering 回避として支持できる。
3. **STOP が PLAY 前（`$currentPath` が `$null`）に届いた場合**、PowerShell 側は `STOPPED\t`（空引数）を返す実装になっている（Handle-Line:94-98）。この経路は専用テストが無い。barge-in は通常「再生中と判断した上で stop() を呼ぶ」設計のため実害は薄いが、Domain B が STOPPED 行のパス突合をする設計にする場合は空文字ケースを踏まえてほしい。
4. **§質問4（check:source の既存違反）** は Orch 判断事項として Gnome の申し送り通り妥当（本 Domain のスコープ外・pre-existing）。design レーンとしても blocking 扱いにしない。

---

## §質問（Orch-Sylph への確認事項）

- 特になし。Gnome の §7 の申し送り（isPlaying 粒度・STOP 完了タイミング・デバイス名完全一致・check:source 既存違反・preflight は既定デバイスのみ実測・WinRT ロードのオーバーヘッド）はいずれも design レーンの判断基準（器不変・依存ゼロ・常駐設計・依存方向・停止経路・終了処理・失敗の扱い）に対して blocking 材料を含まない。すべて Domain B/C/D または人間ゲートへの適切な先送りと判断した。

---

## 総合判定

**PASS-with-nonblocking**。器不変・契約 JSON 不変・lockfile 不変・新規依存ゼロを自分のコマンド実行で確認した（`git diff --stat` 空・`package-lock.json` も空）。`check:soul-zone` pass（voice→eyes は同一魂ゾーン内 import として健全）。常駐 1 プロセス設計は Source 差し替え＋非ブロッキング stdin 読みの実装で維持されており、Position 併用の完了判定ロジックも `$sawPlaying`/`$playing` フラグの単一スレッド制御下でレースなく組まれている（実装読解で確認・preflight 実測とも整合）。依存方向（voice→eyes の `runPowerShellScript` 再利用）は形の一致した DRY として妥当だが、共通層の置き場所がディレクトリ命名と乖離している点を non-blocking で申し送る。停止経路・終了処理・失敗の扱い（成功を捏造しない設計）はいずれもコード・コメント・テストが一致しており健全。`node --test` 425/425/0（自分で再実行・claim と一致・event loop リークなし）。blocking 指摘なし。
