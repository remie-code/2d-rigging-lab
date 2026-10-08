# Passive Fire Diagnostics Wave Plan

> Status: **MECHANICAL PASS / USER GATE PENDING (2026-08-30)**. Domain A/B implementation and independent integrated review loop 3 are complete; ordinary-use user observation has not yet been performed.
> Positioning: temporary, passive observability for diagnosing Fire-to-audio latency and long-speech Control Channel failure. This wave does not fix the 4096-byte limit, reconnect behavior, latency, or Cockpit UX.
> Orchestration: **L0 Undine / L1 single Orch-Sylph / L2 Soul Gnome + Runtime Gnome / one independent Review-Sylph**. Domain A ∥ Domain B → integrated review → mechanical closeout → separate user observation gate.

## 1. Basis

- inventory map: [../../../../reports/ai-cohost-fire-diagnostics/_map.md](../../../../reports/ai-cohost-fire-diagnostics/_map.md)
- Control Channel and payload report: [../../../../reports/ai-cohost-fire-diagnostics/control-channel-and-payload-limit.md](../../../../reports/ai-cohost-fire-diagnostics/control-channel-and-payload-limit.md)
- Fire-to-audio latency report: [../../../../reports/ai-cohost-fire-diagnostics/fire-to-audio-latency.md](../../../../reports/ai-cohost-fire-diagnostics/fire-to-audio-latency.md)
- current Cockpit settings wave: [cockpit-settings-modal-wave-plan.md](cockpit-settings-modal-wave-plan.md)
- orchestration rules: `.agents/skills/implementation-orchestration/SKILL.md`

Repository facts used as planning premises:

- accepted Fires are single-flight; a new accepted Fire does not run concurrently with another accepted Fire;
- expression sends and speech work can overlap within one Fire, so Control Channel request identity still matters;
- current code exposes several local measurements but does not persist them as one diagnosable Fire observation;
- `4096` is an application boundary copied from Browser Source, not a WebSocket protocol limit;
- valid speech timelines can exceed the transport boundary; a production-shaped bounded experiment crossed it at 110 timeline entries;
- a remotely closed successful lazy channel is not automatically invalidated/reconnected;
- current worktree contains user-owned, uncommitted Cockpit settings, identity, documentation, agent-profile, and unrelated Expo changes. All agents must preserve them.

## 2. Accepted User Gate

### あなたが受け取るもの／行うこと

- これまでどおりRuntime Player、AivisSpeech、Cockpitを起動し、普段どおり対話する。
- 診断モード、追加画面、ログ保存、コピー、terminal操作は要求されない。
- 遅延やエラーが起きたら、「この発話」「このあたり」とうちらへ伝えるだけでよい。
- うちらが既知の場所に自動保存されたログを直接読み、解析結果を説明する。

### あなたが判断すること

- 解析された遅延内訳が体感と整合しているか。
- エラー原因と連鎖の説明が、実際に見た順序と整合しているか。
- 「どこに時間がかかったか」「なぜ失敗したか」へ十分に答えているか。

### あなたが判断しないこと

- 生ログの形式・保存場所・読み方。
- FireやControl Channel requestの内部相関方法。
- 診断UIの使いやすさ。診断UIは今回作らない。
- 4096-byte上限の最終値、再接続修正、遅延改善そのもの。
- 自動テストやログschemaの品質。

### 合格条件

- 通常操作だけでログが自動的に残る。
- うちらがユーザーの転送作業なしに直接参照できる。
- 成功・失敗のどちらでも、直前までの区間時間と必要な数量が残る。
- うちらが遅延の支配区間と失敗地点を、事実・推測・不明に分けて説明できる。
- 通常の対話画面と操作を変えない。
- 一時的な診断機能で構わず、恒久的な製品品質・洗練されたUX・安定した公開schemaは求めない。

### 違和感や不足があった場合のフィードバック

- あなたは生ログではなく、解析説明と体験の食い違いだけを返す。
- 例：「もっと前から待っていた」「音声はエラー前に聞こえた」「エラー順序が違う」「説明していない空白時間がある」。

This block is immutable for downstream agents. It is not a test oracle they may pass on the user's behalf. If an agent believes it must change, it stops and escalates to L0.

## 3. Scope and non-goals

The wave adds a temporary diagnostic trace that is automatic, locally persistent, bounded, and readable by a later Codex agent. It may be rough internally. It must not add a diagnostic UI or a user workflow.

The trace must distinguish, where the production path reaches them:

```text
Fire accepted / visible-marker server anchor
→ vision target/capture
→ resource/session initialization
→ LLM ask start / TTFT if available / full result
→ response parse and expression work
→ AivisSpeech audio_query
→ AivisSpeech synthesis
→ WAV/timeline preparation
→ Control Channel connect/hello/send/reply/close
→ parent player.play enqueue
→ resident player STARTED or closest available child proxy
```

It also records counts without recording content: model output characters, read-aloud characters, raw mora count, timeline count, WAV duration/bytes where already available, serialized `intent.speech` UTF-8 bytes, request identity, connection generation/state, failure stage/code, and transport close reason where observable.

Explicit non-goals:

- changing the 4096-byte value or turning it into an unlimited input;
- adding client preflight rejection, protocol chunking, reconnect, retry, or timeout changes;
- streaming TTS, reducing LLM latency, or changing model/prompt/session behavior;
- adding a Cockpit screen, setting, toggle, export, or normal-feed diagnostics;
- exact physical speaker onset or human visual reaction measurement;
- a stable public telemetry schema, remote telemetry, elaborate search, dashboards, or long-term retention;
- recording API keys, credential contents, system prompts, conversation text, transcript text, image/audio bodies, or WAV payload bytes.

## 4. Diagnostic boundary

- A global user-visible Fire ID is not required. Soul may use the currently accepted Fire's active diagnostic context because accepted Fires are single-flight.
- Parallel expression and speech requests must still be distinguishable with the existing request identity or an equivalent internal correlation.
- Cross-process elapsed time must not subtract unrelated monotonic clock origins. Each process uses process-local monotonic durations and a wall timestamp for later ordering.
- Logs may be separate per process. They must have deterministic, documented locations readable by a later local Codex task without user copying.
- A later agent must be able to identify the current/recent run and correlate Soul and Runtime records using wall time, request/connection information, and event order.
- Persistence must occur incrementally enough that an ordinary Fire error preserves observations emitted before the error. Product-process hard-crash durability is not required beyond a proportionate flush strategy.
- Automatic logging must be bounded. A simple overwrite-on-start, bounded recent-run set, or small rotation is acceptable; a production-grade log service is not required.
- Diagnostic write failures must not fail or materially delay Fire.

## 5. Dependency graph and ownership

```text
Wave D1 (parallel ownership under one Orch-Sylph)
  Domain A — Soul Fire diagnostics and local persistence
  Domain B — Runtime Player transport/lifecycle diagnostics
                 │                         │
                 └──────── both done ──────┘
                              │
                              ▼
                 one independent integrated review
                              │
                              ▼
                 mechanical closeout / user gate pending
```

The domains do not share source ownership. The plan supplies the minimum shared event meaning; they do not need to create a reusable cross-package logging framework.

## 6. Domain assignments

### Domain A — Soul Fire diagnostics

Owner: one Gnome using `gpt-5.6-terra`, effort `high`.

Owned scope:

- `apps/soul/agent/**` source and tests needed for passive diagnostic capture;
- Soul-side deterministic log path and bounded persistence;
- completion report: `discussion/ai-cohost/implementation/waves/fire-diagnostics/domain-a.md`.

Required evidence:

- one successful fake/injected Fire trace reaches parent playback proxy, and child `STARTED` where production wiring can expose it proportionately;
- one failure trace preserves stage/count data and identifies the failure boundary;
- serialized speech payload bytes are measured from the actual envelope shape using UTF-8 byte length;
- parallel expression and speech request events are not conflated;
- no UI, prompt/session behavior, cap, reconnect, timeout, dependency, or lockfile change;
- exact log location and bounding behavior are written into the completion report.

Domain A must preserve all current uncommitted Soul changes and edit only the minimum overlapping hunks. It must not revert, reformat, or rewrite the Cockpit settings/modal/identity work.

### Domain B — Runtime Player transport diagnostics

Owner: one Gnome using `gpt-5.6-terra`, effort `high`.

Owned scope:

- `apps/runtime-player/src/main/control-channel/**` and the minimum existing app-data/lifecycle seam needed for local diagnostics;
- Runtime-side deterministic log path and bounded persistence;
- completion report: `discussion/ai-cohost/implementation/waves/fire-diagnostics/domain-b.md`.

Required evidence:

- frame payload size and close branch can distinguish oversize, incomplete overflow, decode error, non-final frame, peer close, socket end/error, and intentional server close to the degree the existing transport exposes them;
- accepted/rejected/disconnected observations retain useful wall time, connection identity/generation, and request information when available;
- a 4097+ payload is observed as an oversize close without changing the 4096 behavior;
- normal accepted/rejected behavior remains unchanged;
- no UI, protocol response, cap, reconnect, dependency, or lockfile change;
- exact log location and bounding behavior are written into the completion report.

Domain B must not edit Soul or unrelated Runtime Player changes.

## 7. Verification matrix

| Concern | Mechanical evidence | User decides |
|---|---|---:|
| Passive operation | Cockpit UI/API surface unchanged; logging starts without a toggle | No extra action was required |
| Successful Fire | staged trace reaches playback proxy; counts/durations present | analysis matches perceived delay |
| Failed Fire | pre-failure data remains; stage/code/close/timeout separated | explanation matches observed sequence |
| Payload | timeline count and actual serialized UTF-8 envelope bytes verified | none |
| Transport close | current 4096 behavior retained; close branch is recorded | later diagnosis is convincing |
| Correlation | single-flight Fire context plus request/connection data reconstructs order | none |
| Safety | no secrets/content/binary bodies; bounded local persistence; log failure nonfatal | none |
| Regression | targeted Soul/Runtime tests and repository-established relevant guards | none |

Real provider, microphone, vision capture, AivisSpeech, or speaker consumption is not required for the mechanical gate. The user gate performs the real ordinary-use observation later.

If a repository-standard Node worker run fails before assertions with `spawn EPERM`, record it separately and use the established worker-free path. Environment failure is neither product failure nor green evidence.

## 8. Review policy

One independent Review-Sylph uses `gpt-5.6-sol`, effort `high`, after both Gnomes finish. It writes:

`discussion/ai-cohost/implementation/reviews/fire-diagnostics/final-review.md`

It reviews only the proportional criteria required to make a temporary diagnostic candidate safe to hand to the user:

1. **Passivity and scope** — no user operation/UI, no cap/reconnect/latency behavior change, and diagnostic failure cannot break Fire.
2. **Measurement meaning** — real stage boundaries, valid clock arithmetic, no misleading sum/overlap, correct UTF-8 envelope byte calculation.
3. **Failure preservation** — TTS/timeline/channel close/reply timeout retain the observations available before failure and are not collapsed into one label.
4. **Later-agent readability** — without relying on Gnome prose or implementation explanations, the reviewer uses produced fixture/sample logs alone to reconstruct one success and one failure, identifying dominant duration and failure boundary. Failure to do so is blocking.
5. **Minimal safety** — no secrets/content/binary payloads and no unbounded disk growth.
6. **Regression evidence** — focused tests are green and existing dirty work is preserved.

It does not review UI aesthetics, long-term schema compatibility, dashboards, sophisticated rotation, physical audio timing, latency improvement, cap redesign, or reconnect design.

Blocking findings return to the owning Gnome through Orch-Sylph. Only affected review areas need targeted re-review. Loop cap is five; non-decreasing findings or a new user/product decision escalate immediately.

## 9. Orchestration contract and models

- **L0 Undine**: current frontier model; owns this plan, Accepted User Gate, wave boundary, and user report. It does not implement, inspect the large diff, or substitute for live children.
- **L1 Orch-Sylph**: `gpt-5.6-sol`, effort `high`; owns context collection, two Gnome assignments, wait/review/fix loop, reports, and closeout. It does not implement source.
- **L2 Soul Gnome**: `gpt-5.6-terra`, effort `high`.
- **L2 Runtime Gnome**: `gpt-5.6-terra`, effort `high`.
- **L2 Review-Sylph**: `gpt-5.6-sol`, effort `high`.
- **Post-user-run log analysis**: a fresh `gpt-5.6-luna`, effort `high`, reads bounded logs; L0 integrates its report for the user. This is not part of the mechanical implementation wave.

Every assignment says that agents are not alone in the dirty worktree, must preserve others' edits, must edit only owned paths, and must neither stage nor commit.

Every L1 assignment includes this exact rule:

> Orch-Sylph自身は実装担当ではない。source implementation は必ず別コンテキストの Gnome に委譲し、レビューは必ず別コンテキストの Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。

Call prefixes are mandatory:

- Undine → Orch-Sylph: `[subagent-call] 呼び出し元: Undine`
- Orch-Sylph → Gnome / Review-Sylph: `[subagent-call] 呼び出し元: Sylph`

Parents wait with `wait_agent`. A wait timeout is polling only and never authorizes interruption, replacement, or parent-side implementation.

## 10. Persistent outputs

- plan: `discussion/ai-cohost/implementation/orchestration/fire-diagnostics-wave-plan.md`
- Domain A: `discussion/ai-cohost/implementation/waves/fire-diagnostics/domain-a.md`
- Domain B: `discussion/ai-cohost/implementation/waves/fire-diagnostics/domain-b.md`
- integrated review: `discussion/ai-cohost/implementation/reviews/fire-diagnostics/final-review.md`
- mechanical closeout: `discussion/ai-cohost/implementation/waves/fire-diagnostics/final-closeout.md`
- user observation gate: `discussion/ai-cohost/implementation/waves/fire-diagnostics/human-gate.md`

The closeout records exact log paths, bounding/retention behavior, changed files, raw test results, review loop count, blocking/nonblocking residuals, mechanical `PASS|FAIL|BLOCKED`, and user gate `PENDING|PASS|FAIL`.

## 11. Mechanical and user gates

Mechanical PASS requires:

- Domain A and B completion reports;
- the independent integrated review is PASS with zero blocking findings;
- sample/fixture logs allow the reviewer to reconstruct one success and one failure;
- targeted tests and relevant guards are green or environment failures are honestly separated;
- no UI/cap/reconnect/latency semantics/dependency/lockfile change;
- exact automatic log paths are documented for a later Codex task.

The wave may become **mechanically complete / user gate pending**. Only the user performs the Accepted User Gate by using Cockpit normally. After the user identifies a delayed/failed run, a fresh Luna reads the logs, and L0 explains the result. Mechanical tests and review never pass this gate for the user.

## 12. Downstream boundary

No D2 or D3 implementation is launched from this plan.

- D2 candidate: finite payload-bound change and post-close reconnect, only after baseline evidence is captured.
- D3 candidate: only the measured dominant latency segment, after the user-run trace is analyzed.

Both require a new context-check and plan. Agents may record evidence but may not implement either candidate in D1.
