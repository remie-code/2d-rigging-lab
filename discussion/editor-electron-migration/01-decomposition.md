# 分解: editor Electron 移行の継ぎ目と第一手

> 北極星: **低結合の切り込み線(継ぎ目)を特定する**こと。ファイル一覧ではなく結合構造。
> 本分解は3系統の並行コード調査(2026-07-08、Sylph/Opus)から産まれた。継ぎ目を先験的に切らず、調査結果から導いた。

## 調査で確定した三つのピボット(リポジトリ事実)

| 問い | 答え | 根拠(file:line) |
|---|---|---|
| 永続化は単一チョークポイントか散在か | **チョークポイント**。File System Access 生 API は 1 ファイルに封じ込め済み。`WorkspaceDirectoryHandleLike` 等のポート型で抽象化され、picker/global object は Provider から注入可能 | `apps/editor/src/features/workspace-storage/model/workspace-directory-io.ts:89,104,121`(生 API)/ `editor-session-context.tsx:578-605`(DI 注入口)。他ファイル・`packages/` に生 API ヒット 0 |
| runtime-player に fs-IPC 雛形があるか | **あり**。IPC 5層(channels→contract→contextBridge→ipcMain.handle+手書き型ガード→fs store)+ digest 照合 + ダイアログ + electron-vite/builder。main は node:fs で read/write を実施 | runtime-player `src/main/model-mapping-profiles/model-mapping-profile-store.ts:145`(write)、`runtime-export-directory-loader.ts:281-315`(digest)、`electron.vite.config.ts` |
| renderer は素で Electron に載るか | **載る**。起動経路に FS/network 結合ゼロ、`import.meta.env` 使用ゼロ、SW/public/deploy 設定なし。空セッション + FS 権限ゼロ起動は E2E で実証済み | `apps/editor/src/main.tsx`(17行)、`src/app/editor-app.tsx`(13行)、`e2e/` |

## 綜合(この移行の性格)

- **Electron の Chromium は File System Access API を実装している** → `showDirectoryPicker` 等は Electron renderer でも動き続ける。
  - 帰結1: **第一手(殻を立て renderer を無改造で載せる)だけで、保存を含む"動く editor" が得られる**。
  - 帰結2: **永続化の node:fs 化(WS2)は時間軸で分離可能・非ブロッカー**。各ステップが壊れず動く(非破壊・段階的移行)。
- ただし **殻の移行だけでは元の責務違和は解消しない**(Web 殻×FS Access でローカル所有 → Electron 殻×FS Access でローカル所有、に変わるだけ)。谷を実際に埋めるのは WS2。殻移行は前提整備 + de-risk であり、**WS2 が本丸**。

## work-stream(継ぎ目)

| WS | ドメイン | スコープ | 写経元 / 新規 | 依存 |
|---|---|---|---|---|
| WS1 | Electron 殻 & build | `electron.vite.config`、`main.ts`、最小 preload、`package.json`(scripts/main/devDeps)、electron-builder | runtime-player を単一窓・単一エントリに単純化して**写経** | 土台(唯一のゲート) |
| WS2 | 永続化の IPC 化(谷埋め) | `workspace-directory-io` に node:fs アダプタ、**ユーザー任意ディレクトリへの多ファイル双方向 write(唯一の新規設計)**、digest(写経)、ネイティブダイアログ。既存 Provider 注入口に刺す | IPC/store/digest/dialog=写経。書き戻し統合=新規 | WS1 |
| WS3 | Web 退役 | dev/preview の vite scripts、playwright webServer/baseURL の除去。**portable-JSON の廃止**(下記)を吸収 | 掃除 | WS1 後 |
| WS4 | E2E `_electron` 化 | webServer→`_electron.launch`、download 検証の配線変更(`setInputFiles` は素で通る見込み) | 参考実装なし・**新規** | WS1 |

**依存背骨: WS1 が唯一のゲート。通過後 WS2/WS3/WS4 は並行可能。**

## 第一手 = WS1

runtime-player を最小複製し「空ウィンドウで EditorApp が起動する」まで。成立条件は全て充足済み(リポジトリ事実):

- (a) FS 権限ゼロ・空セッションで起動しフル機能 → E2E で実証済み
- (b) 本番 `file://` の asset base → electron-vite が自動相対化(UI 改造不要)
- (c) Tailwind v4 → runtime-player で同一プラグイン構成が稼働中

**実機ゲート**: WS1 は Gnome が実装し、実機で「UI が Electron に載った」を観測してから WS2 設計に降りる(最小増分→実機観測→次を決める)。

## 未決・park(設計判断保留)

| 項目 | 扱い |
|---|---|
| portable-JSON 経路の廃止 | **廃止方針(暫定・要確認)**。単一ファイル可搬は「ワークスペースを zip」で代替。下記「portable-JSON について」参照 |
| ワークスペース zip 可搬 | 将来の小機能。portable-JSON 廃止とセット。余裕があるとき |
| 再起動後のワークスペース自動復帰 | 現状未実装。node:fs ならパス保存で軽い。**park(余裕があるとき)**。「移行」でなく「新機能」 |
| save-plan の atomicity 契約 | authoring-core が `createWritable` のトランザクション性にどこまで依存するか未検証。**WS2 着手時に確認** |
| sandbox true/false | runtime-player 慣行(`sandbox:false`)を踏襲。厳格化は後で判断 |
| implementation/ の背骨(単一 spine か自己完結サブトピックか) | **WS1 通過後に判断**(現時点で決めない) |

## portable-JSON について(要確認)

- 現状 editor は同一 PackageDocument を2形式で保存する:
  - **(B) ディレクトリワークスペース** — フォルダ(複数 JSON + 実バイナリ)。FS Access ディレクトリハンドル。
  - **(A) portable プロジェクト** — 単一 JSON `<slug>-rev<n>.portable-project.json`。バイナリを base64 で inline 埋め込み(`portable-package-bundle-v0`)。
- portable の入出力は現状ブラウザ依存: 出力=Blob+`<a download>`(`browser-portable-project-transfer.ts:6-40`)、入力=`<input type=file>`(`project-storage-screen.tsx`)。E2E 1 本が使用(`e2e/portable-project-save-load.e2e.spec.ts`)。
- **方針(暫定・設計判断)**: portable-JSON を**廃止**し、可搬は「ワークスペースディレクトリを zip」で代替。理由: 直列化面を 2→1 に畳める / base64 は +33% 肥大 + 独自スキーマ保守が消える / ディレクトリワークスペースは既に LLM-Readable な JSON 群で zip 解凍しても可読性を失わない。
- 影響: WS2b(portable の node:fs 移植)は**不要化** → WS3 の廃止対象に吸収。E2E `portable-project-save-load` は zip 機能実装時に置換/削除。
- **未確認(要最終確認)**: portable 形式に依存する他の消費者がいないか。現状の把握では authoring-host=ディレクトリパッケージ、runtime-player=runtime-export を消費し、portable は人間の単一ファイル共有用途と見られる。
