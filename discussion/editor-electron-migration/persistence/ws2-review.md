# WS2 persistence レビュー

> 判定: **pass**(Lane A / Lane B とも独立 clean-context で pass、Undine L0 裁定、2026-07-08)。

## 経緯(プロセス注記)

WS2 実装は Gnome が完了。最初の Orch-Sylph はレビュー2本を放った直後にターンが尽きて裁定前に終了したが、**その2レビュー子は生き残り、独立に pass/pass を返した**。Undine が起こした recovery Orch は冗長のため停止し、Undine(L0)が両判定を裁定 + 自動ゲートを再確認して確定した。

## Lane A: 契約・正しさ → pass

- **ポート意味論一致**: `getFileHandle/getDirectoryHandle(create:false)` は `statPath` の boolean で不在判定し `NotFoundError` 相当を throw(消費側 `isMissingHandleError` が握る)。`create:true` は mkdir を write 時に遅延。`values()` は `readdir(withFileTypes)` の1階層列挙(順序は消費側ソートで吸収)。
- **エラー正規化(握りつぶし無し)**: main `statPath` は **ENOENT のみ** `exists:false` へ、非 ENOENT(EACCES 等)は rethrow。→ permission が missing に化けない(構造的に不可能)。
- **temp+rename**: `.{uuid}.tmp` へフル内容 → `rename` で確定、失敗時 temp 掃除して rethrow。destination の変異は rename 1点 =「旧か新、ゴミにならない」を構造保証。
- **round-trip 同一性**: **無改造の実消費側**(`createEditorWorkspace`/`openEditorWorkspace`)を通した save→open で PackageDocument 同一。digest 検証チェーン(存在→byteLength→SHA-256)を実通過。
- **stale 非削除 / 全 upsert / データ整合(utf8・binary offset)**: 踏襲確認。
- **消費側・Forbidden 無改造**: git diff で `workspace-session-storage.ts` / `runtime-export-directory.ts` / ポート定義 / fake / save-plan / package-format 変更ゼロ。

## Lane B: IPC・セキュリティ境界 → pass

- **パス境界(traversal 拒否)**: `resolveWorkspaceMemberPath` が非絶対 root 拒否 + 絶対 relPath 拒否 + `path.resolve` 正規化 + `root+sep` prefix 比較。**prefix 共有兄弟脱出**(`/foo/bar` vs `/foo/bar-evil`)を正しく塞ぐ。main が renderer 検証に依存せず**独立拒否**(全 fs メソッドが操作前に境界を通す)。
- **preload 最小露出**: `editorWorkspaceFs` 5メソッド(pick/list/stat/read/write)のみ。任意チャンネルの抜け道なし。
- **contextIsolation:true / nodeIntegration:false 維持**、renderer は node/electron 非接触(boundary guard 緑、preload contract は `import type` のみ)。
- **main request 検証**: 各 handler が `unknown` 受け → 型ガード(string/mode/payload kind + bytes を Uint8Array/ArrayBuffer 限定)。dialog options は `["openDirectory","createDirectory"]`。

## Undine ゲート再確認(2026-07-08)

- `electron:build` → 緑(main 10 / preload 1.24kB / renderer 2317 modules)。
- `test:unit` → WS2 新規テスト全緑、失敗は既知の先在4件(`task_c8fc5155`)のみ。
- `typecheck` → **WS2 新規ファイルにエラーゼロ**(先在の赤は不変)。

## 非ブロッキング残差(pass を妨げない・記録)

**設計残差(2件、accepted)**:
1. **symlink(Lane B)**: パス境界は `path.resolve`(文字列正規化)で `realpath` はしない。root 内に外部を指す symlink が事前に仕込まれていれば実体は root 外に届きうる。現契約(renderer 側も同粒度)に忠実で、「攻撃者が事前に symlink を設置」する別脅威モデル。**accepted 残差**、将来 realpath ハードニング候補。
2. **種別衝突(Lane A)**: `getFileHandle(create:false)` は同名ディレクトリ存在時に `NotFoundError`(FS Access の `TypeMismatchError` を missing に丸める)。整形済みパッケージ構造では発生せず影響極小。**accepted 残差**。

**テスト強化候補(非ブロッカー・任意フォロー)**:
- 非 ENOENT reject が missing に化けないことの反証テスト(回帰ガード価値・高)。
- rename 直前クラッシュで原本が旧内容を保つことの直接注入テスト。
- 実 Electron IPC 越しの Uint8Array structured-clone 往復(現状は手動 smoke のみ)。
- Windows UNC 絶対 relPath / drive-relative(`C:foo`)の境界テスト固定。

## 判定

**pass。** ブロッカー・needs_fix なし。残差はいずれも accepted / 任意フォロー。
