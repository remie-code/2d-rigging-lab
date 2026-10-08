# AI Cohost の text delta 経路：OpenAI公式資料調査

- 調査基準日: 2026-08-30（Asia/Tokyo）
- 対象: `@openai/codex-sdk` 0.144.5 で画像付きターンの `agent_message` が `item.completed` でのみ届いた場合に、別のCodex/OpenAI公式経路でvision付き応答のテキストを逐次取得できるか。
- 情報源: OpenAI公式ページのみ（`developers.openai.com`、`platform.openai.com`、`learn.chatgpt.com`）。ページ本文を開いて確認したものだけを記載し、検索結果snippetは根拠にしていない。
- 本稿は経路比較であり、別APIへ移行すべきという設計判断ではない。

## 先に結論（候補の位置付け）

1. **Responses API** は、`stream: true` 時の `response.output_text.delta` を公式スキーマとして明記しており、`input_image` と同じ入力で使える。GPT-5.6 Sol のモデルページにも Responses、画像入力、streaming が明記されている。
2. **Codex App Server** は、Codex固有の会話・ツール実行を保ったまま、`item/agentMessage/delta` を公式イベントとして明記している。`model/list` の公式例には `gpt-5.6-sol` と `inputModalities: ["text", "image"]` もある。ChatGPT managed OAuth と ChatGPT rate limit を持つ点がPlatform APIとは異なる。
3. **Codex SDK** の公式ガイドは、スレッド開始・継続・再開と `finalResponse` を説明するが、`runStreamed()`のdelta粒度・早期text公開を契約として説明していない。したがって、SDKの公開ガイドだけからは、今回の実測を覆す「保証あり」とは言えない。
4. **Agents SDK** は `stream: true` で `output_text_delta` を逐次受け取る公式例がある。これはAgents SDKのイベント表現であり、Codex SDK/App Serverの `agent_message` と同一契約ではない。
5. **Realtime API** はWebSocketイベントでtext deltaを扱えるが、Realtimeセッション／モデル／認証の経路であり、Codex App ServerやResponses SSEと同一視できない。GPT-5.6 SolをRealtimeセッションで使えることは、確認した資料からは確定できない。
6. ChatGPT/Codexサブスクリプション認証とChatGPT側のrate limitはApp Serverには公式に存在する。一方、Platform APIの公式リファレンスはAPI key/Bearer credentialsを要求している。ChatGPT OAuthまたはweekly limitをPlatform APIへそのまま流用できるという公式記載は確認できない。

## Official facts（公式事実）

### 1. Codex SDK / CLI / App Server のstreaming契約

#### Codex SDK

[Codex SDK公式ガイド](https://learn.chatgpt.com/docs/codex-sdk) は、ローカルCodexエージェントをプログラムから制御するSDKとして、TypeScriptで `thread.run()` を呼び、`finalResponse` を得る例を示している。同じThreadに対して再度runすること、Thread IDから再開することも説明されている。しかし、同ページには `runStreamed()` のイベントスキーマ、assistant textのtoken/delta、`item.updated`または`agent_message`の早期公開を保証する記載は確認できない。よって、**公式ガイドに基づくCodex SDK streaming契約は「final response/continuationは明記、text deltaは未明記」**である。

#### Codex CLI

[Codex CLI公式ガイド](https://learn.chatgpt.com/docs/codex/cli) は、対話ループと `codex exec` の利用、CLIでのサインイン（ChatGPTまたは別の利用可能な認証方式）を説明している。確認したCLIガイド本文には、JSONLイベントの型、`agent_message`のdelta、`item.updated`の意味は記載されていない。従って、CLIの存在や非対話実行から、text delta契約を推論してはいけない。

#### Codex App Server

[Codex App Server公式仕様](https://learn.chatgpt.com/docs/app-server) は、stdioの改行区切りJSON（JSONL）またはWebSocketのJSON-RPCを使い、Thread内のTurnをイベントで流す経路としている。Lifecycleには、`item/started`、`item/completed`、`item/agentMessage/delta`等を読むことが明記されている。`item/agentMessage/delta`は「streamed textをappendする」イベントで、`agentMessage`は蓄積されたreplyである。全Itemについて`item/completed`が終端・確定イベントである、と定義されている。

同仕様のItem定義では、ユーザー入力にtextだけでなく`image`/`localImage`を含められる。ThreadはTurnを含み、`thread/resume`で既存会話を継続し、`thread/fork`で分岐できる。したがって、**App ServerにはCodex固有のtext delta・画像入力・会話継続が、別々の概念として公式に公開されている**。

同じApp Server仕様の`model/list`例には、正確なID `gpt-5.6-sol`、表示名`GPT-5.6-Sol`、`inputModalities: ["text", "image"]`が記載されている。これはApp Server側でモデルを列挙・能力表示する公式例であり、SDK 0.144.5の実行結果を保証する記載ではない。

確認したApp Server仕様には`item.updated`というイベント名は見当たらない。公式に明記されるagent textの逐次イベント名は`item/agentMessage/delta`であり、`item/started`/`item/completed`とは役割が異なる。SDKの型に`item.updated`が存在することや、特定バージョンがそのイベントを実際に出すことは、別途のSDK/リポジトリ事実として扱う。

### 2. Responses APIの `stream: true`、`response.output_text.delta`、画像入力

[Responses APIのCreateリファレンス](https://developers.openai.com/api/reference/typescript/resources/beta/subresources/responses/methods/create) は、`responses.create({ ..., stream: true })` を示し、生成中に `response.output_text.delta` が来て、最後に`response.output_text.done`、`response.completed`が来る例を掲載している。[Streaming Eventsリファレンス](https://developers.openai.com/api/reference/resources/responses/streaming-events) の `response.output_text.delta` は「追加のtext deltaがあるときに発行」と定義され、`delta`文字列、`item_id`、`output_index`、`content_index`等を持つ。これは**逐次text片を取得できる公開イベント契約**だが、1イベント=1 tokenや、一定の時間間隔で届くことまでは保証していない。

同じCreateリファレンスには、`input`のcontentに`{ type: "input_text", ... }`と`{ type: "input_image", image_url: ... }`を同居させる画像入力例がある。従って、画像入力はResponsesのstreamingと両立する。

### 3. Responses APIの複数Turn継続とinstructions差し替え

[Conversation state公式ガイド](https://developers.openai.com/api/docs/guides/conversation-state) は2つの状態管理方法を説明する。

- `previous_response_id`: 直前Response IDを次のResponseに渡して、Responseをチェーンする。過去の入力を再送せずに継続できる。
- Conversations API: Conversation IDを持つ長寿命オブジェクトにMessages、tool calls、tool outputs等を保存し、後続Responseに`conversation`を渡して、セッション・端末・Jobをまたいで再利用できる。

Createリファレンスは、`previous_response_id`を使用する場合、前Responseの`instructions`は次のResponseへ自動継承されないと明記している。従って、**次Fireごとにモデルごとのinstructionsを渡し直す現行UXとは、少なくとも`previous_response_id`経路では両立可能な仕様になっている**。Conversations APIを使う場合に、保存済み状態とそのTurnのinstructionsをどの順序・優先度で組み合わせるかは、実装前にリクエスト単位で確認すべき未確定事項である。なお、Createリファレンスでは`conversation`と`previous_response_id`は同時に使う方式ではない。

### 4. GPT-5.6 Solの公式記載

[GPT-5.6 Solモデルページ](https://developers.openai.com/api/docs/models/gpt-5.6-sol) は、正確なモデルIDを`gpt-5.6-sol`、表示名を**GPT-5.6 Sol**とし、`gpt-5.6` aliasが同モデルへrouteされると記載している。同ページの能力表には、Text input/output、**Image input**、Audio/Video unsupported、Endpointsに`v1/responses`、Streaming supportedがある。よって、**Responses APIでのGPT-5.6 Sol + image input + streamingは公式記載がある**。

これはCodex App Serverの`model/list`例（上記）とも整合する。一方、Codex SDKの公式ガイドがGPT-5.6 Solを`runStreamed()`の保証対象としているわけではない。

### 5. 認証、ChatGPT/Codexサブスクリプション、weekly limit、Platform API

[Codex App ServerのAuthentication modes](https://learn.chatgpt.com/docs/app-server) は、次を明記している。

- `apiKey`: OpenAI API keyをcallerが供給する。
- `chatgpt`: App ServerがChatGPT OAuth flowを管理し、tokenを保存・refreshする。
- `chatgptAuthTokens`: host appがChatGPT token lifecycleを管理する実験的方式。
- `account/updated`には利用可能ならChatGPT `planType`が含まれ、`account/rateLimits/read`はChatGPT rate limitsを返す。仕様例には`limitId: "codex"`のrate limitがある。

一方、[OpenAI API Reference overview](https://developers.openai.com/api/reference/overview) は、Platform APIのリクエストにstandard API keyを使い、`Authorization: Bearer`で認証し、usageは指定Projectに計上すると説明している。Realtimeのサーバー側呼び出し例もAPI keyを既定にしている（[Realtime calls create](https://developers.openai.com/api/reference/typescript/resources/realtime/subresources/calls/methods/create)）。

したがって、**ChatGPT OAuth / Codex managed token / ChatGPT側のweeklyまたはrate-limit windowがPlatform APIへそのまま移る**という公式根拠はない。App ServerのChatGPT認証とPlatform APIのAPI-key認証は、公式資料上も別の認証モードである。さらに[APIモデルカタログ](https://developers.openai.com/api/docs/models) はGPT-5.6 SolについてInput/Outputの`per MTok`価格を掲げ、Platform APIのrate limitはusage tierごとに表示している。これはAPI側の従量価格・tier制限が存在することの根拠だが、ChatGPT subscriptionとの請求統合／相殺を意味しない。今回許可された公式ドメイン範囲では「ChatGPT subscriptionをそのままAPI利用料へ充当できる」とは確認できなかったため、別料金・別請求の細部はUnknownとして残す。

### 6. 関連経路（似た名前のAPIを同一視しない）

#### Agents SDK

[Agents SDKのRunning agents](https://developers.openai.com/api/docs/guides/agents/running-agents) は、JavaScriptで`run(..., { stream: true })`を呼び、`raw_model_stream_event`のうち`event.data.type === "output_text_delta"`を調べて`event.data.delta`を使う例を公開している。Pythonにも`run_streamed()`と`ResponseTextDeltaEvent`の例がある。従って、Agents SDKはtext deltaを受ける公式経路である。

ただし、これはAgents SDKのRunner/event adapterの契約であり、Codex SDKの`runStreamed()`やApp Serverの`item/agentMessage/delta`と同一のイベントではない。画像は下位のResponses入力（`input_image`）で渡せる構成が考えられるが、Agentsガイドの当該stream例そのものはtext入力中心であるため、「任意のAgents SDK providerで画像が必ず同様に通る」とまでは断定しない。Codex SDK公式ガイドはCodex CLIをMCP serverとしてAgents SDKから組み合わせられると説明しているが、これはCodex App Serverのdelta契約をAgents SDKのdelta契約へ変換することを意味しない。

#### Realtime API

[GPT-Realtimeモデルページ](https://developers.openai.com/api/docs/models/gpt-realtime) は、text/audio input-outputとimage inputを持つRealtimeモデルを説明している。[公式Realtime APIリファレンス（PythonのSIP accept例）](https://developers.openai.com/api/reference/python/resources/realtime/subresources/calls/methods/accept) は、Realtimeセッションの`output_modalities`を`text`または`audio`とし、`text`だけの応答を選べると記載する。[OpenAI公式SDKリファレンス](https://developers.openai.com/api/reference/ruby) にはRealtime WebSocketで`ResponseTextDeltaEvent`の`event.delta`を読む例がある。

RealtimeはWebSocket/WebRTCのセッションイベントであり、ResponsesのSSE `response.output_text.delta`とは別プロトコルである。外部TTSへtextを渡す構成ならtextイベントの候補にはなるが、Realtimeモデルの音声入出力・セッション管理が追加される。確認したGPT-5.6 Solのモデルページには`v1/realtime`のendpoint表記がある一方、Audio unsupportedとも記載され、RealtimeセッションでGPT-5.6 Solを使う具体例・能力保証は確認できなかった。`gpt-realtime`をGPT-5.6 Solと同一視しない。

## Repository experiment facts（公式事実とは分離）

[既知の実測レポート](../experiments/codex-streaming-sentence-probe.md) に記録された、2026-08-30のrepository experiment factは次のとおり。

- installed `@openai/codex-sdk` 0.144.5、`model=gpt-5.6-sol`、reasoning effort `none`、`local_image` 1枚の実Turnで、観測イベントは`thread.started`、`turn.started`、`item.completed`（item type `agent_message`）、`turn.completed`だった。
- `agent_message`について`item.started`と`item.updated`は0件で、textは`item.completed`の単一snapshotとして観測された。
- 最初の安全な日本語文末も`item.completed`と同時で、完了前の文単位入力は得られなかった。
- この1回の実測は「このSDK・設定・画像Turnで起きた事実」であり、Codex全経路・全モデルでdeltaがないこと、または公式契約の欠如を証明するものではない。

この実測と、App Server公式仕様の`item/agentMessage/delta`は矛盾と断定しない。前者はSDK 0.144.5の具体的runtime観測、後者はApp Server protocolの公開仕様であり、同じ経路・同じversion・同じtransportであることは実測レポートからは確定しない。

## Inference（資料からの推論）

- 画像Turnのassistant textを「完了前に文単位で外部TTSへ渡したい」という要件に対し、Responses APIのSSE delta、App Serverのagent-message delta、Agents SDKのoutput-text-deltaは、少なくとも公開イベントを購読できる候補である。ただし、文境界・タグ境界・取り消し／再送・tool call中断は各adapter側で扱う必要がある。
- App Serverは、Codex固有のthread/turn/tool/input imageとChatGPT subscription/rate limitを同じプロトコルに持つため、現行Codex体験を保つ観点では確認対象が少ない可能性がある。一方、App Server仕様のdelta名・SDK 0.144.5のSDKイベント名・実行時の認証経路は別物なので、実装前に同一transportでの適合テストが必要である。
- Responses APIは、モデル・画像入力・SSE text delta・`previous_response_id`/Conversationsを個別に明示しているため、要件をAPI primitiveへ分解して検証しやすい。これは移行を推奨する結論ではなく、検証単位が明確という意味の比較である。
- 外部TTSを前提とするなら、音声をOpenAI Realtimeから受けるか、text deltaを外部TTSへ送るかで必要な同期・再試行・課金・切断処理が変わる。経路の名前だけでは互換性を判断できない。

## Unknowns（現時点で公式資料だけでは確定しない点）

- `@openai/codex-sdk` 0.144.5の`runStreamed()`が、どのCodex backend・transport・モデル・入力条件で`item.updated`またはdelta相当を発行するか。
- `item.updated`に入る値が累積replacementか純粋deltaか。App Server公式仕様で公開される名前は`item/agentMessage/delta`であり、SDK event shapeへの写像は別確認が必要。
- App Serverの`gpt-5.6-sol` `model/list`例が、各ChatGPT plan/API-key modeで実際に選択可能か、またruntime rerouteが起きる条件。
- GPT-5.6 SolをRealtime APIの具体的なtext/image sessionで使用できるか。モデルページのendpoint一覧だけから確定しない。
- ChatGPT/Codex subscriptionのOAuth tokenまたはweekly limitを、Responses/Agents/Realtime等のPlatform API credentialとして使えるか。今回確認した公式APIリファレンスには、その交換・共有手順はない。
- Responses/Agentsのdelta到着時刻、chunk境界、tool callや安全フィルタによる中断が、AI Cohostの文境界/TTSポリシーにどう影響するか。

## Candidate matrix（設計判断ではなく比較表）

評価語: **明記**=確認した公式ページに直接記載、**部分明記**=近接する公式能力はあるが経路そのものの保証が不足、**Unknown**=確認した公式資料からは確定不可。Migration impactは実装上の差分の大きさを相対的に示すだけで、推奨順位ではない。

| 経路 | text delta | vision | conversation continuation | GPT-5.6 Sol | subscription auth | migration impact | official evidence confidence |
|---|---|---|---|---|---|---|---|
| Codex SDK `runStreamed()` 0.144.5 | **Unknown**（公式SDKガイドはfinal response中心。`runStreamed()`のdelta保証なし） | **Unknown**（SDKガイドから画像入力の同一契約を確認できず） | **明記**（同Thread再run／Thread ID resume） | **部分明記**（Codex/CLI/App Server側には明記、SDK `runStreamed()`対象としては未明記） | **部分明記**（CLI/App ServerのChatGPT loginは明記、Platform APIではない） | 中〜大：SDKイベント・実測差分・backend依存を検証 | continuationは高、delta/visionは低 |
| Codex App Server JSONL / WebSocket | **明記**：`item/agentMessage/delta`（`item/completed`は確定） | **明記**：input itemにimage/localImage、model/listのSol image modality | **明記**：thread/resume/fork、turn events | **明記**：`model/list`例に`gpt-5.6-sol` | **明記**：ChatGPT managed OAuth、external tokens、ChatGPT rate limit。API key modeも別途明記 | 中：JSON-RPC client・通知購読・Codex lifecycle対応 | 高（delta/vision/continuation/authを同一仕様で確認） |
| Codex CLI JSONL / `codex exec` | **Unknown**（確認したCLIガイドにJSONL/delta schemaなし） | **Unknown**（CLIガイドだけでは本要件のイベント契約なし） | **部分明記**（CLI対話・execは明記、プログラム的state契約は別経路） | **部分明記**（CLI UIのモデル記載はあるが、delta経路とは別） | **明記**：CLI sign-in with ChatGPT等 | 中〜大：CLI process/JSONL schemaと終了・再接続を検証 | CLI存在/authは中、delta/visionは低 |
| Responses API SSE (`stream:true`) | **明記**：`response.output_text.delta`、done、completed | **明記**：`input_image` + text input、GPT-5.6 Sol image input | **明記**：`previous_response_id` または Conversations | **明記**：GPT-5.6 Sol、`v1/responses`、streaming | **API key/Bearer明記**。ChatGPT subscription/weekly limit流用はUnknown | 大：Platform API credential、Responses state/tool/error処理を導入 | 高（各要素を個別の公式ページで確認） |
| Agents SDK（Responses provider） | **明記**：`output_text_delta`（JS/Python例） | **部分明記**：下位Responsesの画像能力は明記、Agents stream例の画像経路は要確認 | **明記**：`previousResponseId` / `conversationId` | **部分明記**：モデルを設定するSDKだが、AgentsガイドにSolの具体例なし。下位Responses model pageは明記 | Platform API key系。ChatGPT subscription流用はUnknown | 中〜大：Runner/state/event adapterを採用し、Codex固有機能を別途接続 | text delta高、vision/model/authは中〜低 |
| Realtime API WebSocket/WebRTC | **明記**：Realtime `ResponseTextDeltaEvent`、text output modality | **明記**：GPT-Realtimeのimage input | **明記**：Realtime session conversation（セッション内）。Responsesの`previous_response_id`とは別 | **Unknown**：`gpt-realtime`とSolは別。SolのRealtime session適合性未確定 | API key / client secret系のPlatform認証。ChatGPT subscription流用はUnknown | 大：Realtime session、WS/WebRTC、切断・音声/外部TTS境界を実装 | Realtime delta/visionは高、Sol/auth適合は低 |

## Candidate implications（候補ごとの含意、決定ではない）

- **最も直接にtext deltaを文抽出へ渡せる公式primitive**は、Responsesの`response.output_text.delta`、App Serverの`item/agentMessage/delta`、Agents SDKの`output_text_delta`である。それぞれのevent namespaceと完了イベントを混ぜない。
- **Codex体験・ChatGPT quotaを保持する観点の確認対象**はApp Server。公式仕様上、画像、Sol、Codex rate limit、thread resume、agent message deltaが同じプロトコルにある。ただし、現行SDK 0.144.5の実測と同じ出力挙動になるとはまだ言えない。
- **Platform API primitiveを直接検証する対象**はResponses。GPT-5.6 Solのimage inputとstreaming、`previous_response_id`/Conversations、API keyがそれぞれ公式に確認できる。ただしChatGPT/Codex subscription authは引き継ぐ前提にできない。
- **外部TTSとの接続**は、text deltaを受ける経路（Responses/App Server/Agents）ならTTS adapterを別に置く形、Realtimeならtext-only outputまたはtranscript/audioイベントを購読する形になる。どちらを採るかは本稿の設計範囲外。

## 参照ページ一覧

- [Codex SDK](https://learn.chatgpt.com/docs/codex-sdk)
- [Codex CLI](https://learn.chatgpt.com/docs/codex/cli)
- [Codex App Server](https://learn.chatgpt.com/docs/app-server)
- [Responses Create API Reference](https://developers.openai.com/api/reference/typescript/resources/beta/subresources/responses/methods/create)
- [Responses Streaming Events](https://developers.openai.com/api/reference/resources/responses/streaming-events)
- [Conversation state](https://developers.openai.com/api/docs/guides/conversation-state)
- [GPT-5.6 Sol](https://developers.openai.com/api/docs/models/gpt-5.6-sol)
- [API Reference overview](https://developers.openai.com/api/reference/overview)
- [Agents SDK: Running agents](https://developers.openai.com/api/docs/guides/agents/running-agents)
- [GPT-Realtime](https://developers.openai.com/api/docs/models/gpt-realtime)
- [Realtime calls create](https://developers.openai.com/api/reference/typescript/resources/realtime/subresources/calls/methods/create)
- [Realtime calls accept](https://developers.openai.com/api/reference/python/resources/realtime/subresources/calls/methods/accept)
- [OpenAI Ruby API reference（Realtime WebSocket text delta例）](https://developers.openai.com/api/reference/ruby)
