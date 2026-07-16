# 頭脳の差し替え: ChatGPT サブスク(Codex)経由 GPT-5.6 Terra

> Status: 議論中(2026-07-17)。前提討議①([llm-access-path.md](llm-access-path.md) = Max 20x + Agent SDK 一本)の**多頭化拡張**。
> 動機(ユーザー): GPT-5.6 Terra の応答速度を試したい。運用想定=**配信前に頭を選ぶ**(配信中の差し替えは運用外)。
> 調査: Sylph(opus)による Web + リポジトリ事実調査(2026-07-17)。

## 1. 視座(議論で確立)

- 差し替わるのは魂やなく**頭脳**(mind/llm-session.mjs の向こう側の借り物エンジン)だけ。耳・声・発火・転写・演出・操縦席・安全弁は全部うちらの資産で不変。
- 「転写バッファが正、SDKセッションは使い捨てキャッシュ」(討議②)により、頭が替わっても会話の連続性は正本から再注入されて保たれる。**こーでぃー ≠ Claude の証明**になる実験。
- **S8 の安全弁(TTS 直前検問所・キル)は頭の外側**——どの頭でも全発話が同じ弁を通る。頭の差し替えは安全網を弱めない。

## 2. UX 裁定(2026-07-16 ユーザー)

- **正のフロー**: 「魂を起動し、LLM を選び、動作確認をして、配信を開始する」——配信前選択が本線。
- ライブ差し替えは「タダなら対応」(一級 UX にはしない)。
- v0 の選択肢は**フラット 2 項目**(Claude (Opus 4.8) / Codex (GPT-5.6 Terra))。provider×model 行列は将来の梯子。
- 設定層に「頭脳」区画(資格情報の健康表示つき・操縦席は資格情報そのものを扱わない)・観測層に発話ごとの頭の名前+応答レイテンシ。

## 3. 調査結果の要点(詳細は調査 Sylph 報告・2026-07-17)

**経路は実在し、機材は既に揃っている**:

- `@openai/codex-sdk`(npm・Node18+)実在。CLI を spawn して JSONL 往復する設計。`codex.startThread({model})` → `thread.run(input)` → `finalResponse`。`runStreamed` あり。
- 認証 = `codex login`(ChatGPT サブスク OAuth)→ `~/.codex/auth.json`。**ローカルは codex CLI 0.141.0 導入済み・ログイン済み・Node v22.14.0**(SDK 要件充足)。
- **GPT-5.6 Terra 実在**(2026-07-09 GA): Codex で `-m gpt-5.6-terra` 選択可・**画像入力対応**・1.05M context・出力 137.6 tok/s。ただし **reasoning モデルで TTFT が長い可能性**(要実測)——`model_reasoning_effort`(minimal〜xhigh)が体感速度のダイヤル。
- サブスク固定ガード(env-guard 相当)= `forced_login_method = "chatgpt"`(API キー従量課金への化けを防ぐ公式スイッチ)。
- レート枠 = 5h ローリング窓+週次キャップの二段。
- Windows ネイティブ対応(WSL 不要・experimental ラベル)。

## 4. 現行契約との段差(スパイクで潰す未知)

| # | 段差 | 中身 | 扱い |
|---|---|---|---|
| ① | **常駐性と速度(最優先)** | SDK が温かいプロセスを保つか run() 毎 spawn か不明。Anthropic 側で観測した「毎回 spawn ≈12s」が出るか。reasoning_effort minimal/low での TTFT 実測 | スパイクの本丸。「速い」動機がここで立つか崩れる |
| ② | **素チャット化** | Codex は本質コーディングエージェント。`sandbox_mode=read-only`+`approval_policy=never`+`shell_tool=false`+`web_search=disabled` でツール封じ→日本語一問一答が安定するか | スパイク実測 |
| ③ | **画像の渡し方** | 現行= base64 インメモリ(ディスク非書き込みが S5 の流儀)。Codex= `local_image`(ファイルパス)のみ | 製品裁定(下記問い 1) |
| ④ | **systemPrompt 注入** | per-ask 動的注入の口が無い(config/AGENTS.md/入力埋め込み)。**ただし現行契約もセッション生成時固定**(createLlmSession({systemPrompt}))なので実質段差なし | 起動時固定で整合。スパイクで注入方式だけ確定 |
| ⑤ | **セッションのディスク永続**(L0 追加発見) | Codex は Thread を `~/.codex/sessions` に自動永続。現行は persistSession:false(転写の写しをディスクに残さない)。**視聴者コメント込みの注入文が Codex 側でディスクに残る**流儀差 | スパイクで無効化可否を確認。不可なら受容裁定が要る |

## 5. ユーザーに開いている問い

1. **画像契約**: (a) 一時ファイル書出+即削除を許容 (b) v0 は視覚= Claude 経路専用(Terra では視覚発火を正直に中止・capability 宣言で吸収)。→ L0 推奨 = (b) で開始、(a) は欲しくなったら梯子。
2. **規約グレー**: ChatGPT サブスクで Codex を非コーディング用途(会話生成)に使う可否は公式記述から確証を得られず(明示禁止も未発見)。innertube と同型の「グレー開示の上の裁定」で受容するか、約款精読タスクを別途切るか。
3. **速度の合格ライン**: スパイクで現行 Opus 常駐(warm ask ≈3.2s・TTFT 計器あり)と並記して、君の体感で裁定——でよいか(事前の数値ラインは切らない)。

## 6. 次の段取り(合意済みの範囲)

1. ユーザー install: `apps/soul/agent` で `npm install @openai/codex-sdk`(魂は独立 npm・root lockfile 不変)。
2. スパイク: `experiments/` 流儀の縦貫通一発(startThread→run→finalResponse・レイテンシ/TTFT・reasoning_effort 別・素チャット安定性・セッション永続の挙動)。実測が出てから知性契約+操縦席 UX の wave 計画へ。
