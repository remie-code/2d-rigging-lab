# Codex streaming sentence probe

## Protocol

- 実施日: 2026-08-30（Asia/Tokyo）
- 目的: installed `@openai/codex-sdk` が、GPT-5.6 Sol / reasoning effort `none` / 画像付きターンで、`item.completed` 前に `agent_message` を `item.started` または `item.updated` として露出するかを確認する。
- SDK: `@openai/codex-sdk` **0.144.5**（`apps/soul/agent/node_modules/@openai/codex-sdk/package.json`）。依存CLIも同パッケージの解決経路を使用。
- 実行条件: `model=gpt-5.6-sol`, `modelReasoningEffort=none`, `approvalPolicy=never`, `sandboxMode=read-only`, `webSearchEnabled=false`, `networkAccessEnabled=false`, `skipGitRepoCheck=true`。
- 作業場所: fresh な OS 一時ディレクトリ。実験後、自分が作成した一時ディレクトリと、実験 thread ID に完全一致する rollout だけを削除した。
- 画像: repository-owned の `apps/editor/build/icon-source.png` を `local_image` で1枚添付。ライブ画面・ゲーム画面は使用していない。
- 入力: 日本語で短い複数文を返すよう依頼し、各文の終端を `。` に限定、タグ・コード・ツール使用を禁止した。プロンプト本文は保存しない規則により本レポートには再掲しない。
- ターン数: **実ターン1回**。第2ターンは不要だった（曖昧さ解消ではなく、早期イベント欠如が明確だったため）。
- 時計: probe Node process 内の `performance.now()` による monotonic elapsed time。値はプローブ開始からの ms、wall clock ではない。

### Executed commands

SDK/package version discovery:

```powershell
Get-Content -Raw -Encoding UTF8 apps/soul/agent/node_modules/@openai/codex-sdk/package.json
Get-Content -Raw -Encoding UTF8 apps/soul/agent/node_modules/@openai/codex-sdk/README.md
Get-Content -Raw -Encoding UTF8 apps/soul/agent/node_modules/@openai/codex-sdk/dist/index.d.ts
```

Real probe (the standalone `node --input-type=module -e` script recorded only event structure, ids, elapsed times, and `agent_message` text lengths; the prompt literal is intentionally omitted here):

```powershell
node --input-type=module -e "<standalone probe: new Codex(); startThread({model:'gpt-5.6-sol', modelReasoningEffort:'none', approvalPolicy:'never', sandboxMode:'read-only', webSearchEnabled:false, networkAccessEnabled:false, workingDirectory:<fresh-temp>, skipGitRepoCheck:true}); runStreamed([{type:'text',text:<Japanese multi-sentence prompt>},{type:'local_image',path:'../../editor/build/icon-source.png'}]); sanitize each event; print JSON>"
```

The command above is represented with the prompt and generated temporary path elided to comply with the no-persistence rule. The executed parameters and fixture are the values listed in this protocol.

Cleanup command (exact self-owned targets):

```powershell
Remove-Item -LiteralPath 'C:\Users\remie\AppData\Local\Temp\codex-stream-sentence-probe-umxAsw' -Recurse -Force
# Separately removed only the rollout whose parsed filename thread-id equaled the probe thread id.
```

Cleanup result: `tempDeleted=true`, `rolloutDeleted=true`.

## Raw structural observations (content-free)

The SDK README advertises `runStreamed()` as an async generator of structured events. The installed type declaration defines `item.started`, `item.updated`, `item.completed`, `turn.completed`, and `AgentMessageItem { id, type: "agent_message", text }`.

Observed event sequence in the real image-bearing turn:

| Sequence | Event type | Item type | Item id | Event/item shape |
|---:|---|---|---|---|
| 1 | `thread.started` | — | — | event keys: `thread_id`, `type` |
| 2 | `turn.started` | — | — | event keys: `type` |
| 3 | `item.completed` | `agent_message` | `item_0` | event keys: `item`, `type`; item keys: `id`, `text`, `type` |
| 4 | `turn.completed` | — | — | event keys: `type`, `usage` |

There were **zero** `item.started` events and **zero** `item.updated` events for the `agent_message`. Therefore no delta-vs-accumulated distinction can be established from a sequence of updates in this run. The sole `agent_message` value was an initial/completed snapshot, not an observed delta.

No tool item, web-search item, file-change item, command-execution item, or error event was observed. This is a structural observation only; the response body is intentionally not included.

## Measured timestamps and lengths

All times are process-local elapsed ms from probe start.

| Measurement | Value |
|---|---:|
| `thread.started` | 942.52 ms |
| `turn.started` | 971.19 ms |
| first `agent_message` event | 9173.57 ms |
| first safe Japanese sentence terminator (`。！？`, outside incomplete `<...>`) | 9173.57 ms |
| `agent_message` `item.completed` | 9173.57 ms |
| `turn.completed` | 9274.42 ms |
| sole `agent_message.text` length | 27 UTF-16 code units |
| safe-boundary prefix length | 10 UTF-16 code units |
| `item.started` count | 0 |
| `item.updated` count | 0 |
| `agent_message` event count | 1 |
| real turn count | 1 |
| incomplete-tag observations | 0 |

The first safe sentence was detectable only in the completed snapshot, so its measured lead over `item.completed` is 0 ms. `turn.completed` followed 100.85 ms later.

## In-memory sentence-boundary replay

The probe included a minimal content-free accounting detector over the in-memory `text` value. It scans a snapshot/buffer for `。`, `！`, or `？`; while inside an incomplete angle-bracket tag (after `<` and before `>`), it defers the boundary. For a cumulative replacement it replaces the buffer; for a non-prefix update it would append and mark the stream interpretation ambiguous.

In this run the detector saw one completed snapshot, no incomplete tag, and found a safe boundary at that same completed-event timestamp. This demonstrates that sentence detection is possible **after** receiving the final `agent_message`, but does not demonstrate pre-completion queueing.

Failure cases for a future replay attempt:

- no `item.started`/`item.updated`: there is no earlier text to queue;
- cumulative replacement snapshots require replacing the buffer, while true deltas require appending; a single event cannot distinguish the two;
- an incomplete tag must prevent emitting a terminator that occurs inside it;
- even a safe boundary cannot be treated as authoritative until the stream contract guarantees that the event is not a replacement that may later revise earlier text;
- this run has no update sequence, so the detector cannot validate behavior under actual deltas or partial tags.

## Facts

1. The installed SDK exposes streaming event types in its TypeScript declaration, including `item.updated`.
2. The SDK runtime wraps `codex exec --experimental-json` and yields each JSONL line as a parsed event.
3. Under the requested real-service settings and one local-image turn, the observed stream emitted only one `agent_message`, at `item.completed`.
4. No early agent text was available; the first safe Japanese sentence terminator arrived with the completed item.
5. The actual real turn completed successfully and emitted `turn.completed`.

## Inference

- The installed SDK/type surface is structurally capable of representing `item.updated`, but this observed GPT-5.6 Sol image-bearing execution path did not provide incremental `agent_message` events.
- A sentence/audio candidate queue cannot safely begin from this observed path before `item.completed`; it would have no input to consume.
- The result does not prove that Codex never emits agent-message updates in every prompt/model/path. It proves only that this requested path exposed none in the one real turn.

## Unknowns

- Whether another Codex CLI/API mode, model, response length, or non-image turn emits `agent_message` updates.
- Whether any future `item.updated` values, if emitted, are cumulative replacements or deltas; this run contained no update pair.
- Whether the upstream service intentionally buffers vision turns or short final responses before emitting the agent message.
- Whether a different Codex API (outside installed SDK 0.144.5 + `--experimental-json`) provides token/text deltas suitable for safe sentence extraction.
- Tag buffering was implemented and exercised only on a no-tag result; incomplete-tag behavior was not observed in the real response.

## Verdict

**not supported by observed SDK path**

For the installed `@openai/codex-sdk` 0.144.5, GPT-5.6 Sol, effort `none`, and one image-bearing real turn, an `agent_message` was exposed only at `item.completed`; no `item.started` or `item.updated` arrived early enough to identify a sentence before completion. A different Codex API or a separately verified event path would be required before treating sentence extraction as feasible.
