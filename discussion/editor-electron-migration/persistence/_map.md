# persistence/ (WS2: 永続化の node:fs/IPC 化)

> 「Web 殻×FS Access でローカル所有」の谷を実際に埋める本丸。WS1 通過後に着手。

状態: **未着手**(WS1 依存)。

スコープ: `workspace-directory-io.ts` の FS Access を node:fs/IPC アダプタへ差し替え、既存 Provider 注入口(`editor-session-context.tsx:578-605`)に刺す。IPC 5層 / digest / dialog は runtime-player から写経、**ユーザー任意ディレクトリへの多ファイル双方向 write** のみ新規設計。詳細は [../01-decomposition.md](../01-decomposition.md) の WS2。

着手前の確認: save-plan の atomicity 契約(authoring-core が `createWritable` に依存する範囲)。
