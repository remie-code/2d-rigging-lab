# WS2 設計: 永続化の node:fs/IPC 化

> 「Web 殻 × FS Access でローカル所有」の谷を埋める本丸。既存の永続化ポートの裏に node:fs-backed アダプタを実装し、IPC 越しに main の fs を叩く。
> 上位: [../01-decomposition.md](../01-decomposition.md)(WS2)。設計入力は 3系統目のコード調査(2026-07-08、契約レベル)。
> 情報分離: 「契約」節は**リポジトリ事実**(file:line 根拠)、「設計判断」節はユーザー合意済みの**設計判断**。

## 1. 目的 / スコープ

- **In**: `apps/editor/src/features/workspace-storage/model/workspace-directory-io.ts` の FS Access 依存を、**node:fs を型付き IPC ブリッジ越しに**呼ぶ実装へ差し替える。既存の Provider 注入口 `workspaceDirectoryPicker`(`editor-session-context.tsx:580,604`)に Electron 版 picker を注入。runtime-export(`runtime-export-directory.ts`)も同アダプタで賄う(判断2)。
- **Out**: 保存形式の変更、renderer アプリコードの改変、再起動後のワークスペース自動復帰(パス永続化)、portable-JSON(WS3 で廃止)。
- **温存**: 保存フローの上位ロジック(save-plan / digest / 検証)、ポートの消費側。

## 2. アーキテクチャ(ドロップイン方針)

```
renderer                                     preload            main
─────────────────────────────────────────   ──────────────     ──────────────
workspace-session-storage / runtime-export
  │ (既存・無改造)
  ▼ WorkspaceDirectoryHandleLike ポート
NodeFsBackedDirectoryHandle  ← 新規(WS2本体)  contextBridge      ipcMain.handle
  │ (root絶対パス + 相対パスを保持、          型付きIPC  ──────▶  node:fs 実体
  │  各操作を IPC 呼び出しへ写す)                                (readdir/readFile/
  ▼                                                              writeFile+mkdir+
digest(Web Crypto)は renderer 側に残る                          temp-rename / dialog)
```

- **ポート抽象はそのまま**。消費側(`workspace-session-storage.ts` 等)は `WorkspaceDirectoryHandleLike` にしか依存しておらず、無改造。
- **picker 注入で入口を差し替え**: Electron 版 `WorkspaceDirectoryPicker.pickDirectory()` が IPC でディレクトリダイアログを開き、選択パスを root にした `NodeFsBackedDirectoryHandle` を返す。`showDirectoryPicker` は呼ばれない(`resolvePickedDirectory` が picker を優先、`workspace-session-storage.ts:245-247`)。
- **digest は renderer 側(Web Crypto)に残す**。fs/IPC 層は bytes を運ぶだけ(digest 計算・照合は save-plan / package-format の既存位置、`workspace-save-plan.ts:191-259`)。
- **fake が挙動リファレンス**: `fake-workspace-directory.ts` が満たすべき最小実装例。

## 3. ポート契約(アダプタが実装すべき surface / リポジトリ事実)

`workspace-directory-io.ts` 定義。node:fs-backed アダプタは以下を満たす:

| インターフェース | メンバ | node:fs 写像 |
|---|---|---|
| `WorkspaceDirectoryHandleLike` | `kind="directory"` / `name` | name = ディレクトリ basename(`workspaceName` に使用) |
| | `getFileHandle(name,{create?})` | create:false で不在時 **`NotFoundError` 相当を throw**(read 側が `isMissingHandleError` で握る, :404-407)。create:true で作成 |
| | `getDirectoryHandle(name,{create?})` | write パスは親を create:true で辿る → `fs.mkdir({recursive})` 相当 |
| | `values()` | **1階層**列挙(dir/file 混在)。再帰は呼び出し側 → `fs.readdir(withFileTypes)` 相当。順序不問(呼び出し側が localeCompare ソート) |
| | `queryPermission?`/`requestPermission?` | **省略**(両省略で permission チェックが no-op 化, `ensureWorkspaceDirectoryPermission:144-146`) |
| `WorkspaceFileHandleLike` | `getFile()` / `createWritable()` | 読み/書きハンドル取得 |
| `WorkspaceFileLike` | `text()` / `arrayBuffer()` | `fs.readFile("utf8")` / `fs.readFile`→ArrayBuffer |
| `WorkspaceWritableFileLike` | `write(data)` / `close()` | **1回のみフル内容**(position 無し)。close で確定(temp+rename ならここで rename) |

**意味論ギャップ(要対応)**:
- **エラー正規化**: node の `ENOENT` → `error.name="NotFoundError"` 相当へ変換(既存 `isMissingHandleError`/`isPermissionError` が握れる形。fake の `createDomLikeError` 同手法)。`getFileHandle(create:false)` は不在で throw する契約なので、存在判定(stat 相当 IPC、または read 時エラーを前倒しで正規化)が要る。
- **permission**: 省略で no-op。Electron では権限概念不要(パス選択＝権限付与)。

## 4. IPC 契約(runtime-player 5層を写経)

renderer 非 node 接触・preload 経由・fs は main の前提。ステートレス(**root 絶対パス + 相対パス**でハンドルを表現、ハンドル識別子＝選択済み root)。

| IPC メソッド | 方向 | main 側 fs 実体 |
|---|---|---|
| `pickWorkspaceDirectory` | renderer→main invoke | `dialog.showOpenDialog({properties:["openDirectory","createDirectory"]})` → {rootPath, name} \| null |
| `listDirectory(root, rel)` | invoke | `fs.readdir(withFileTypes)` → [{name, kind}] |
| `readFile(root, rel, mode)` | invoke | `fs.readFile`(utf8 / buffer) |
| `writeFile(root, rel, data)` | invoke | `fs.mkdir(recursive)` + **temp+rename**(判断1) |
| `statFile(root, rel)`(任意) | invoke | 存在判定(`getFileHandle(create:false)` の throw 契約用。read エラー正規化で代替可) |

- **digest / permission の IPC は不要**。
- **main 側パス境界(判断3)**: 全 IPC で `root + rel` を結合後、**正規化パスが root prefix 配下**であることを検証(traversal 脱出防止)。renderer 側の既存 `assertSafeWorkspacePackagePath`(:240-251,414-438)と二重化。

## 5. write / read プロトコル(リポジトリ事実)

**保存(on-disk 構造・ルート直下)**:
- `workspace.json`(メタデータ, `workspace-metadata.ts:8`)
- パッケージ文書ファイルセット(`manifest.json` + manifest が指す model/asset/atlas/provenance/rights の決定的 JSON。パスに `/` 可 → 中間 dir を mkdir recursive)
- バイナリ実ファイル(各 `binaryAssetRef.packageRelativePath`)
- **書き込み順**: ①text 全エントリ(全 upsert)→ ②binary decisions(digest 一致は skip)。
- **stale 削除なし**(upsert-merge。参照されなくなったファイルは消さない)。
- **保存前に全エラー確定**: save-plan が `action:"error"` を含めば 1バイトも書く前に throw(`workspace-session-storage.ts:170-180`)= 擬似トランザクションの実体。

**読込(`openEditorWorkspace`)**:
1. `values()` で**再帰走査** → `.json` のみ収集・path 昇順。
2. package 復元 → binary registration targets 抽出。
3. **ref 駆動**で binary を明示パス読み(走査でなく)。
4. 検証: required について 存在 → byteLength → SHA-256 digest 一致(不一致で throw, :288-333)。

## 6. 確定した設計判断(ユーザー合意 2026-07-08)

1. **per-file temp+rename を採用**。`.tmp` に全内容を書いてから `rename()` で被せる(同一 FS の rename は不可分)。FS Access `createWritable` が提供していた per-file crash-safety(close まで旧内容が生存)を維持するため。クロスファイル全体のアトミック性は元設計も要求しておらず**不要**(temp+rename が保証するのは「各ファイルは旧か新のどちらか、ゴミにならない」まで)。
2. **runtime-export も同アダプタで賄う**。同じポートを使うため picker/handle 実装を共有。runtime-export は save-plan を通さず全 upsert(skip なし)という差のみ。
3. **main 側パス境界を厳格化**(root prefix 検証を main で二重化)。

## 7. 写経 vs 新規の線引き

- **写経(runtime-player)**: dialog / readFile / writeFile / mkdir / readdir の IPC ハンドラ + preload 型付きブリッジ + main パス境界。
- **新規(WS2 本体)**: node:fs-backed の `WorkspaceDirectoryHandleLike` ツリーアダプタ(renderer 側、内部が IPC を叩く)+ temp+rename + エラー正規化。fake が挙動リファレンス。

## 8. 次

本設計を basis に **WS2 wave-plan** を起こす(scope / oracle / 検証 / review / orchestration)。WS1 と違い実ロジックがあるため:
- テスト: アダプタの単体テスト(fake と同じ契約テストを node アダプタに当てる)、round-trip(save→open で同一 PackageDocument)、temp+rename の crash 中断シミュレーション、パス境界(traversal 拒否)。
- レビューは WS1 より厚め(実ロジック検証)。
- 実機ゲート: Electron で新規/既存ワークスペースの保存・ロードが node:fs 経由で回る(WS1 の FS Access 経路を置換したことの実証)。
