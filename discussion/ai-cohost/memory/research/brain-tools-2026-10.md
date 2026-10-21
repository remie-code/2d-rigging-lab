# 頭のツール制限と、独自ツールを足す手段(棚卸し 2026-10-21)

> Sylph による棚卸し(コード変更なし・本物の頭は起動していない)。Codex の型は、同梱 codex.exe の `app-server generate-ts` で出したスキーマを読んだ。
> 目的: 記憶を「頭が自分で取りに行く(オンデマンド)」形にする前に、今の頭がどこまでツールを止めているかを確かめる。

## 1. 頭ごとの現状

**Codex の頭**(`apps/soul/agent/src/mind/codex-session.mjs`)

| 項目 | 状態 | 根拠 |
|---|---|---|
| sandbox / approval | thread は read-only + never。turn は readOnly(networkAccess:false) + never | :750-752, :844-846 |
| web 検索 | 起動引数と thread の設定の両方で無効 | :722, :752 |
| cwd | OS の一時フォルダの使い捨てディレクトリ(リポジトリ外)。dispose で削除 | :490, :1038 |
| developerInstructions | 使っていない。人格は最初の user 入力の先頭に連結。圧縮後は thread/inject_items で入れ直す | :165-169, :223, :826, :832 |
| MCP / dynamicTools / shell | 何も設定していない。initialize は experimentalApi:false | :305-307 |
| サーバーからの要求(承認・ツール呼び出し) | 全部 JSON-RPC -32601 で断って続ける | :357-359 |
| 返ってくる item | agentMessage 以外は無視 | :652, :672 |

- 頭がファイルを読めるかは【推測】。read-only は書き込みとネットだけを塞ぎ、読み取りはできるという Codex の一般仕様からの推測で、実測はない。ただし approval=never なので、承認が要る操作は失敗する。過去の実測 15 回で、ツールが混ざったことは 0 回(`../../soul/` 系の brain-swap-terra の記録 :170)。

**Claude の頭**(`apps/soul/agent/src/mind/llm-session.mjs`)

| 項目 | 状態 | 根拠 |
|---|---|---|
| 組み込みツール | `tools: []` で全部無効(実測で init.tools=[]) | :194、`../../implementation/waves/s1/domain-c.md` |
| allowedTools / permissionMode / mcpServers / cwd | どれも指定なし | :186-197 |
| その他 | settingSources:[]、persistSession:false、maxTurns:1 | :191-193 |

- maxTurns:1 なので、ツールを足しても「ツールを呼んだあとに返事を書く 2 往復目」が今は成り立たない【推測】。

**配信間記憶の生成**(`memory.mjs`): 専用の制限はない。頭の登録(brains registry)の create を呼ぶだけなので、上と同じ制限になる。読み込み側は、まとめをシステムの指示に連結して渡す。

## 2. なぜ止めたか

- 主な目的は「素チャット化」で、安全対策が主ではない。
  - brain-swap.md :36「Codex は本質コーディングエージェント…ツール封じ→日本語一問一答が安定するか」
  - brain-swap-terra の記録 :170「sandbox=read-only + approval=never + persona 注入で完全に抑えられた」
- Claude 側は速度が理由。ツールを無効にしシステムの指示を最小にすると、最初の文字までが速い(conversation-pipeline-direction.md :59、llm-access-path.md :45)。
- 安全面の記述は別の所にある。
  - LLM に与える能力を最小にする(aituber-landscape-2026-07.md :60)。
  - 視聴者コメントは信頼できない入力として扱い、プロンプトインジェクションを推論に乗せない(comment-guard/_map.md :8)。
  - 魂の特区の憲章には、ツール制限の理由は書かれていない。
- 「文字起こしの帳面が正本で、セッションに記憶を預けない」設計(conversation-pipeline-direction.md §2.7)。

## 3. 独自ツールを足す手段

- **Claude Agent SDK 0.3.207: ある。**
  - `createSdkMcpServer` と `tool()` で、同じプロセス内の独自ツールを定義できる(sdk.d.ts :467, 6745)。
  - `mcpServers` に `type:'sdk'` で渡す(:1668, :1020)。
  - `tools:[]` は組み込みツールだけを消す設定で、MCP のツールは別扱いのはず【推測】。
  - リポジトリ内に使っている箇所はない。
- **Codex app-server 0.163.0: 2 つある。** どちらも使っている箇所はない。
  - **dynamicTools**:
    - thread/start に name・description・inputSchema を渡す。頭が呼ぶとサーバーから `item/tool/call` の要求が届くので、魂が `{contentItems, success}` で返す。
    - experimental で、`experimentalApi:true` が要る。
    - 今の魂は `item/tool/call` も -32601 で断っている。
  - **MCP**: thread の config や `-c` で mcp_servers を設定する方法。キーの形式は未確認。

## 4. 未確認

- read-only の sandbox で、実際にファイルが読めるか。
- dynamicTools の実機での動きと、`experimentalApi:true` の副作用。
- Codex の MCP の設定形式。
- Claude で `tools:[]` のまま、MCP のツールだけが有効になるか。maxTurns:1 とツールの往復は両立するか。
- 常駐の Claude セッションで、mcpServers を後から差し替えられるか。
