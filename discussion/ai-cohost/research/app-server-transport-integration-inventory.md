# Codex App Server transport integration inventory

- 調査日: 2026-08-30（Asia/Tokyo）
- 対象: `apps/soul/agent` の Codex 経路だけ
- 性格: 設計前の bounded repository inventory。採用案・wave・実装方針は決定しない
- 情報区分: **Repository fact / Official fact / Experiment result / Inference / Unknown / Accepted decision** を明記する

## Executive summary

1. **Repository fact**: 現行の差し替え中心は `apps/soul/agent/src/mind/codex-session.mjs` である。上位は Claude/Codex 共通の `{ ask(content), dispose() }` と `{ replyText, usage, ttftMs, elapsedMs }` だけを見る。Codex registry の `create` を App Server client backed session に置換しても、完了時snapshotだけを返す範囲なら Claude 実装を触らずに閉じられる（`brains.mjs:15-24,49-89`; `cockpit.mjs:793-832`; `fire-orchestrator.mjs:247-253`）。これは**候補seam**であり設計決定ではない。
2. **Repository fact**: ただし「安全な第一文が確定したら即発話」は現契約の外である。現行は `await session.ask(...)` 後に全文をparse/NG検査し、その後 `speakImpl` を一度呼ぶ（`fire-orchestrator.mjs:430-492,730-768,806-821`）。App Server deltaを生かすには、Codex transportから上位へ「append-only text delta / item completion / turn completion / failure・interrupt」を伝えるadditive contract seamも必要になる。
3. **Experiment result**: SDK 0.144.5 `runStreamed()` の画像付きSol/none実測はagent textを`item.completed`でしか返さなかった。一方、同じ同梱CLI 0.144.5のApp ServerはSol/low画像付きTurnで450 deltaをcompleted前に発行し、lossless collectorではconcatが完成本文と一致、安全な文境界がitem completionより9,109 ms先行した（`experiments/codex-streaming-sentence-probe.md`; `experiments/codex-app-server-streaming-probe.md:69-95`）。
4. **Repository fact**: 通常の複数Fireは同一のsession objectを再利用し、Codex sessionは同一SDK `Thread` objectを保持する。初回だけsystem promptをinput先頭へ注入し、以後は同じthread idの会話を継続する（`cockpit.mjs:793-832`; `codex-session.mjs:230-273,374-386,394-429`）。
5. **Repository fact / risk**: conversation instruction変更はrevisionを進め、次Fireの`ask`直前に古いsessionをdisposeして作り直すため、進行中応答を直接変えない（`cockpit.mjs:255-299,714-720,850-867`）。一方brain/memory変更はhandler内で現sessionを即disposeする（`:911-936,979-1013`）。「設定変更は進行中応答を変えず次Fireから」というaccepted constraintを全設定へ一般化する場合、現状の差異を設計で解消する必要がある。
6. **Local schema fact / inference**: `C:\Users\remie\.codex\state_5.sqlite` はmigration 14/15で`agent_jobs`を作り、migration 42でdrop済みで、現在のschemaに同tableはない。同梱0.144.5 `codex.exe` binaryには`INSERT/UPDATE/FROM agent_jobs`文字列が残る。probeの`thread/delete`が返した`no such table: agent_jobs`とは整合するが、delete内の正確な呼出経路や製品環境一般への再現性は未確定である。
7. **Verification fact**: fake-only関連テスト211件はpassした。実Codex/App Server turnは本inventoryでは実行していない。

## Accepted constraints

以下は本inventoryで再判断しない **Accepted decision**。

- 対応はCodex経路のみ。Claude経路は変更対象外。
- visionはゲーム配信運用上必須で、外せない。
- App Server採用時のGPT-5.6 Sol effort `low`を許容する。
- 通常の複数Fireは同じLLM sessionを継続する。
- 設定変更は進行中応答を変えず、次Fireから反映する。
- 安全な第一文が確定したら短さ判定なしで即発話する。本inventoryではtransportが供給すべきstream contractとして扱う。

## Repository facts

### 共通interfaceとCodex固有部分

| 層 | Repository fact | Evidence |
|---|---|---|
| 共通brain registry | `BrainEntry.create(options)` が`MindSession`を返し、共通外形は`ask(content)` / `dispose()`。戻り値は全文、usage、TTFT、elapsed | `apps/soul/agent/src/mind/brains.mjs:15-33,49-89` |
| Claude | `BRAINS.claude.create`だけが`createLlmSession`を呼ぶ。Claude資格情報とenv guardは別 | `brains.mjs:50-56`; `apps/soul/agent/src/mind/llm-session.mjs` |
| Codex | `codex`, `codex-55`, `codex-56-sol`だけが`createCodexSession`を呼ぶ。3頭は同じ`~/.codex/auth.json` health path | `brains.mjs:57-89` |
| 上位consumer | orchestratorはsessionの生成・provider分岐を持たず、`ask`だけを使う | `apps/soul/agent/src/mind/fire-orchestrator.mjs:247-253` |
| cockpit配線 | `currentBrain`→registry→遅延session生成。Claudeのenv guardだけ明示分岐し、Codex guardはadapter内部 | `apps/soul/agent/scripts/cockpit.mjs:728-741,793-832` |
| proxy | string / content block arrayを分岐せずsessionへ透過 | `cockpit.mjs:255-279,847-867` |

### session生成・prompt・memory・settings

- sessionは最初のFireまで生成しない。生成後は`session != null`の間再利用する（`cockpit.mjs:785-832`）。
- session生成時system promptは `identity + per-brain conversation instruction + optional recent memory` の順で合成される（`cockpit.mjs:816-825`; `fire-orchestrator.mjs:150-156,218-238`; `memory.mjs:237-263`）。
- Codexにはsession-level system prompt口がないため、adapterは初回Turnのinput先頭だけにsystem promptを前置する。stringは同じtextへ結合、block arrayは先頭text blockとして追加する（`codex-session.mjs:230-273`）。
- instruction revisionは永続化成功後だけ進み、次の`sessionProxy.ask`で古いsessionをdisposeしてから再生成する（`cockpit.mjs:282-299,301-327,850-867`）。
- brain/memory変更は現sessionをその場でdispose/null化する（`cockpit.mjs:911-936,979-1013`）。この即時disposeが進行中SDK Turnへ何をするかはadapter実装依存で、現行テストは「次askで新頭」を確認するが、実CLI turn cancelを確認していない。

### vision input

- vision成功時は `[image(base64 JPEG), text]` の**画像先行**content blocksを`session.ask`へ渡す（`fire-orchestrator.mjs:730-768`）。
- Codex adapterはbase64 imageをsession scratch cwdの一時ファイルへ書き、`{type:"local_image",path}`へ変換し、Turn成否に関わらずfinallyで画像だけを即削除する（`codex-session.mjs:28-34,249-272,409-438`）。
- 手動visionは対象未設定/capture失敗時にaskしない。preferred visionは対象未設定/失敗時に画像なし通常Fireへ劣化する（`fire-orchestrator.mjs:840-899,901-958`）。「vision必須」はApp Server adapterでも`localImage`または同等の画像inputを欠落させない、という境界になる。

### 現行SDK transport settings

`createCodexSession`は次を固定/既定化する（`codex-session.mjs:321-382`）。

| concern | current value / behavior |
|---|---|
| SDK | `@openai/codex-sdk` 0.144.5（package lock / installed package） |
| auth | `OPENAI_API_KEY` / `CODEX_API_KEY`をenv guardで拒否。SDK config `forced_login_method:"chatgpt"`。env/apiKey/baseUrlは明示で渡さない |
| model | default `gpt-5.6-terra`; Sol registry override `gpt-5.6-sol` |
| effort | default/registry override `none`; Solも`none` |
| cwd | `os.tmpdir()`配下にsession専用scratch dir。repo外 |
| git check | `skipGitRepoCheck:true` |
| sandbox | `read-only` |
| approval | `never` |
| web | `webSearchEnabled:false` |
| network | **未指定**。SDK optionは存在するが製品adapterは渡していない |
| tools | SDK/CLIのagent eventは受け得るが、製品はtool itemを消費しない。read-only/never/web off/repo外cwdで行動を狭める |

Installed SDK source facts:

- `Thread.runStreamed(input, {signal?})`はAbortSignalを受けられるが、製品`runTurn`はturn optionsを渡さない（`node_modules/@openai/codex-sdk/dist/index.d.ts:164-206`; `codex-session.mjs:283-318`）。
- SDK runtimeは各Turnで`codex exec --experimental-json`をspawnし、thread id確定後は`resume <id>`を付ける。sandbox/model/effort/network/web/approval/cwd/configをCLI argsへ写す（`node_modules/@openai/codex-sdk/dist/index.js:35-96,136-225`）。
- child非zero exit/signalはstderrを含むErrorとしてthrowし、finallyでreader/childを畳む（同`dist/index.js`の`CodexExec.run`）。製品側には独自timeout/retry/cancelがない。

### eventの使用・無視・エラー

`runTurn()`（`codex-session.mjs:275-319`）:

| SDK event | current handling |
|---|---|
| `item.completed` + `agent_message` | `finalResponse = item.text`。複数なら最後のcompleted agent messageが勝つ |
| `turn.completed` | `usage`を保存 |
| `turn.failed` | messageを保存し、stream終了後throw |
| `error` | messageを保存し、stream終了後throw |
| `thread.started` / `turn.started` | 無視 |
| `item.started` / `item.updated` | 無視 |
| command/file/tool/web/reasoning items | 無視 |

追加の意味論:

- stream中にerrorを見ても即break/interruptせずgenerator終端まで読む。
- completion event欠如でもerrorがなければ空`replyText`を返し、上位が`fireEmptyReply`にする。
- timeoutなし、retryなし、AbortSignal配線なし。S8 killはin-flight askをcancelせず、ask完了後に結果を捨てる（`fire-orchestrator.mjs:452-457`; test `fire-orchestrator.test.mjs:1658`）。
- 上位はask/speak errorを`fireError`診断へ落とし、processを継続し、finallyでidleへ戻す（`fire-orchestrator.mjs:824-837,887-898`）。

### rollout cleanup

- SDK thread会話は`~/.codex/sessions/.../rollout-...-<thread_id>.jsonl`へ永続するという現行前提（`codex-session.mjs:36-45`）。
- adapterは自分のthread idだけをsidecar ledgerへ完全一致で記録し、起動sweepまたはdisposeでrollout filenameを再帰探索して削除する。ファイル本文は読まない（`:98-228,362-366,417-421,441-459`）。
- rolloutが見つからなくてもledgerからidを外す。削除失敗はbest-effortであり、成功保証やdiagnostic返却はない。
- disposeは冪等だが、App Server processのような常駐childは現行存在しない。scratch directoryもdisposeで削除する。

## Current call flow

```text
POST /api/fire or scheduler
  -> cockpit-server's fire orchestrator
  -> fire-orchestrator.fire()
      -> buffer/window + optional capture
      -> sessionProxy.ask(string | [image,text])
          -> instruction revision check
          -> ensureFireResources()
              -> BRAINS[currentBrain].create({ composed systemPrompt, hooks }) [first Fire only]
              -> createCodexSession()
                  -> startup ledger sweep
                  -> scratch cwd create
                  -> new Codex({ forced_login_method:"chatgpt" })
                  -> codex.startThread(options) [once per session object]
          -> codexSession.ask()
              -> first turn? prepend systemPrompt
              -> base64 image -> scratch local_image temp file
              -> thread.runStreamed(input)
                  -> SDK spawns `codex exec --experimental-json`
                  -> first turn creates thread id; later turns resume same id
              -> consume completed snapshot / usage / failures
              -> ledger append after first attempted turn
              -> image temp delete in finally
              -> return {replyText,usage,ttftMs:null,elapsedMs}
      -> parse tags + killed/NG/empty gates
      -> speak whole speechText
      -> append soul transcript after playback completion
```

Turn count is incremented **before** `runTurn` (`codex-session.mjs:406-415`). Therefore a failed first Turn means a retry on the same session does **not** prepend system prompt again. Whether the SDK-created thread is usable after such failure is untested.

Shutdown is `server.close()` → optional memory digest via a separate disposable brain session → live session dispose → player dispose → channel close（`cockpit.mjs:1175-1213`; `memory.mjs:103-140`）。Codex memory digest also creates a separate thread/rollout and immediately disposes it.

## Candidate adapter seam

### Candidate A: provider-internal transport replacement

**Candidate, not decision**: keep `BRAINS[*].create` and `MindSession` completion contract unchanged, replace only `createCodexSession` internals with an App Server client session.

- Claude files need not change.
- `cockpit.mjs` can continue to lazily create/reuse/dispose sessions.
- string/block vision input and completion result remain stable.
- This candidate alone cannot satisfy early sentence speech because it hides deltas until`ask()` completion.

### Candidate B: additive streaming seam at MindSession boundary

**Candidate, not decision**: preserve current `ask()` for Claude and legacy consumers, while adding an optional Codex-only stream callback/iterator or optional capability object. The exact API is unresolved. The minimum event semantics needed above transport are:

1. `agentTextDelta` is append-only, ordered, item-scoped, and never a replacement.
2. final agent-message snapshot and turn terminal status are distinct.
3. a safe sentence is emitted only from confirmed append sequence; no length gate.
4. `item/completed` validates final concat; mismatch is diagnostic/error, not silent rewrite after speech.
5. turn failure/interruption before/after first spoken sentence is distinguishable.
6. usage is terminal metadata; first-delta/first-safe-boundary elapsed can feed diagnostics.

This seam intersects `fire-orchestrator.mjs` because current NG/expression parsing and `speakImpl` operate on the final whole reply. First-sentence immediate speech also needs a policy for incomplete expression tags, NG words spanning deltas/sentence boundaries, later failure, multiple sentences, transcript append timing, and barge-in/kill. Those are not transport-only repository facts and remain design unknowns.

## App Server mapping

Official facts below come from [official OpenAI Codex App Server documentation](https://learn.chatgpt.com/docs/app-server) and the existing official-source synthesis `research/codex-text-streaming-official-options-2026-08.md`. Repository facts are kept in the right column.

| App Server official lifecycle | Official fact | Current session analogue / gap |
|---|---|---|
| process start | `codex app-server` over stdio JSONL or WebSocket; rich clients use auth/history/approvals/streamed events | Current SDK spawns one `codex exec` per Turn; no persistent child owner |
| `initialize` → `initialized` | exactly once per transport connection before other methods | no analogue; must be part of App Server process/client readiness |
| `account/read` | reads auth state; ChatGPT-managed mode owns OAuth persistence/refresh | current env guard + `forced_login_method:"chatgpt"`; no runtime account RPC |
| `model/list` | available models, supported efforts, modalities; official example Sol/low/text+image | current model/effort statically registry-coded; no capability validation |
| `thread/start` | creates/subscribes a new thread | `codex.startThread()` at session creation, thread id populated on first run |
| `thread/resume` | reopens existing thread so later `turn/start` appends | SDK hides resume under repeated runs of same Thread object; normal Fire should preserve one App Server thread |
| `turn/start` | user input; can override cwd/model/effort/approval/sandbox | current `thread.runStreamed(input)` with thread-level options |
| `item/agentMessage/delta` | append streamed agent text | no current upper contract; SDK product path ignored updates and observed none |
| `item/completed` | final item | current completed agent snapshot source |
| `turn/completed` | terminal status/usage; interrupt also ends here | current usage source; current wrapper only maps completed/failed/error |
| `turn/interrupt` | cancel in-flight Turn; terminal status `interrupted` | current S8 kill only discards after ask; no transport interrupt |
| `thread/delete` | permanently removes rollout/metadata/descendants; `{}` + `thread/deleted` on success | current manual exact rollout unlink + ledger; no metadata deletion, and probe hit DB error |
| process exit | not a thread deletion primitive | current dispose has no process; App Server adapter would need bounded shutdown/reap and pending request rejection |

Official `turn/start` accepts `localImage`, model, effort, approvalPolicy, sandboxPolicy/cwd overrides. Mapping must preserve current read-only/never/web-disabled/repo-external-cwd/network-off intent. The probe explicitly used read-only + `networkAccess:false` + `approvalPolicy:"never"` and observed no tools/web/file change (`experiments/codex-app-server-streaming-probe.md:20-26,69-88`).

## Effort-low impact

Accepted decision: Sol/App Serverでは`low`を許容する。Repository impact inventoryは次のとおり。

| path | current dependency on `none` | likely impact boundary (not decision) |
|---|---|---|
| `apps/soul/agent/src/mind/brains.mjs:80-87` | Sol create wrapper hardcodes`effort:"none"`; comment alsonone前提 | value/comment update or App Server-specific mapping |
| `apps/soul/agent/src/mind/brains.test.mjs:132-147` | Sol registry wiring asserts`modelReasoningEffort === "none"` | expected value / protocol field assertion changes |
| `apps/soul/agent/src/mind/codex-session.mjs:71-79,321-381` | default `DEFAULT_EFFORT="none"`; SDK field name `modelReasoningEffort` | if adapter remains model-generic, default vs registry override must be explicit; App Server field is`effort` |
| `apps/soul/agent/src/mind/codex-session.test.mjs:375-393` | default ThreadOptions snapshot assertsnone | SDK adapter test may be replaced/split; App Server request should assertlow for Sol |
| `apps/soul/agent/src/cockpit/*` | UI/state persists onlybrain id, not effort | no current settings schema or UI effort field to migrate; state/snapshots should remain stable unless product chooses to expose effort |
| implementation/review docs | multiple historicalnone statements | historical evidence must not be rewritten; new design/report should state transport/version distinction |

The actual App Server 0.144.5 `model/list` observed Sol efforts `low..ultra`, excluding`none` (`experiments/codex-app-server-streaming-probe.md:20-24`). Official docs example also gives Sol default/supported low and text+image modalities. No persisted local setting contains effort today, so there is no repository migration fact requiring settings-file rewrite.

## Thread lifecycle & cleanup

### Probe observation

- Both successful low probe runs sent official`thread/delete` for their exact thread id and received`no such table: agent_jobs`（`experiments/codex-app-server-streaming-probe.md:97-109`）。
- Run 1 rollout path disappeared and no exact thread id match was found in checked index/cache/history; metadata deletion success was not confirmed.
- Run 2 lacked a recoverable rollout path/exact id for later verification; no guessed deletion or DB mutation was performed.

### Read-only local evidence

Commands:

```powershell
Get-ChildItem -LiteralPath C:\Users\remie\.codex -Recurse -Force -File |
  Where-Object { $_.Extension -in '.db','.sqlite','.sqlite3' -or $_.Name -match 'log|schema|migration' }

node --input-type=module -e '<node:sqlite DatabaseSync readOnly; list sqlite_master and _sqlx_migrations>'

rg -a -o -m 10 ".{0,120}agent_jobs.{0,180}" \
  apps/soul/agent/node_modules/@openai/codex-win32-x64/vendor/x86_64-pc-windows-msvc/bin/codex.exe
```

Facts:

- `C:\Users\remie\.codex\state_5.sqlite` の`_sqlx_migrations`はversion 14 `agent jobs`, 15 `agent jobs max runtime seconds`, 42 `drop agent jobs`がすべてsuccess=1。
- current `sqlite_master`には`agent_jobs` tableがない。`threads`, `thread_artifacts`, `thread_dynamic_tools`等はある。
- 同梱0.144.5 `codex.exe`には`UPDATE agent_jobs`, `FROM agent_jobs`, `INSERT INTO agent_jobs`とRust source path `state/src/runtime/agent_jobs.rs`文字列が残る。
- `C:\Users\remie\.codex\sqlite\codex-dev.db`は別schema（user_version 33）であり、そこにも`agent_jobs`はない。

Inference:

- 実行binaryのあるcleanup/job coordinationコードが、migration 42適用後schemaに対して旧`agent_jobs` SQLを実行した可能性が高い。probe errorとschema/binary evidenceは整合する。
- `thread/delete`はrollout deletionの一部を先に実施し、その後のmetadata/descendant/job cleanupで失敗した可能性がある。Run 1のrollout消失とRPC errorの併存からの推論で、順序は未確認。
- 製品がApp Serverの`thread/delete`だけをprivacy cleanup成功条件にすると、0.144.5環境ではfalse failureまたはpartial cleanupを扱う必要がある。

Unknown:

- 0.144.5 upstream sourceのどのdelete call pathが`agent_jobs`へ触れるか。
- fresh`CODEX_HOME`/CLI-only環境でも同じmigration 42状態になるか、desktop appが共有DBへ与えた影響か。
- RPC error後に残るmetadataの正確なtable/recordと、thread/list/readからの可視性。
- newer/older App Serverで修正済みか（本inventoryはversion変更調査・実ターンをしていない）。
- `thread/delete`失敗時に安全なmanual rollout unlinkを併用してよいか、またApp Server processがloaded threadを保持中のunlink安全性。

## Test inventory

### Existing fake seams

- `codex-session.test.mjs:23-64`: fake SDK constructor/Thread/runStreamed injection。実CLI/network/real`~/.codex`不使用。
- `codex-session.test.mjs:117-519`: first-turn prompt、multi-turn input、vision temp bridge/finally、usage/error、env guard、dispose、ThreadOptions、exact-id ledger cleanupを固定。
- `brains.test.mjs:76-147`: fake SDKでregistry model/effort wiringを固定。
- `cockpit.test.mjs:257-318`: sessionProxyのstring/block透過。`:928-932` registry ids。後段にbrain in-flight swapとinstruction revision next-Fire replacementのharness。
- `fire-orchestrator.test.mjs`: whole-reply ask、vision block order、busy/error/kill-discard、NG/expression、barge-inを全fakeで固定。`1658`付近はin-flight killがunderlying askをcancelしない現意味論。
- `memory.test.mjs:76-169`: disposable digest sessionのcreate→ask→dispose、live session非汚染。
- `fire-diagnostics.test.mjs`: current LLM ask/TTS/control-channel stage sequenceとbounded writer。

### Verification executed

Initial sandbox run failed before loading tests because Node test runner child spawn was denied (`spawn EPERM`). Same fake-only command was rerun with test-runner spawn permission:

```powershell
cd apps/soul/agent
node --test src/mind/codex-session.test.mjs src/mind/brains.test.mjs \
  scripts/cockpit.test.mjs src/mind/fire-orchestrator.test.mjs \
  src/mind/memory.test.mjs src/mind/fire-diagnostics.test.mjs
```

Result: **211 pass, 0 fail, 0 skipped**, duration 5.35 s。実LLM/App Server/CLI turnは不使用。

### Additional contract tests likely required

These are inventory candidates, not an implementation plan.

1. fake JSON-RPC stdio client: request id correlation, interleaved notifications, malformed JSON, stderr noise, child early exit, pending request rejection, initialize once.
2. process lifecycle: spawn once/session, ready timeout, clean dispose, forced termination fallback, idempotent dispose, no orphan.
3. model/auth readiness: account mode isChatGPT managed, Sol present, image modality present, low supported; secrets never logged.
4. thread continuity: one thread/start, N turn/start, same thread id, optional resume after process restart, first prompt exactly once.
5. vision mapping: base64 temp localImage exists duringTurn and is deleted on completed/failed/interrupted/process exit.
6. delta contract: ordered append by item id, no duplicate/replacement, final concat equality, multiple agent items, delta before item.started/after completed rejection, Unicode split boundaries, incomplete angle tags.
7. sentence handoff: first safe`。！？`emitted once without length threshold; expression/NG boundary cases; no speech from reasoning/tool/user items.
8. completion/error: completed/failed/interrupted statuses, JSON-RPC errors, server error notification, missing terminal event, timeout→turn/interrupt, interrupt timeout→process policy.
9. setting concurrency: instruction/brain/memory change during active Turn does not interrupt/mutate it; exactly next accepted Fire creates/uses new session config.
10. cleanup: delete success, missing rollout, partial delete error, exact-id isolation, ledger recovery, App Server 0.144.5`agent_jobs`error fixture.
11. diagnostics: first delta/safe sentence/item completed/turn completed timings without response body persistence; failure stage parity with existing fire diagnostics.

## Risks

| risk | type | evidence / consequence |
|---|---|---|
| early speech bypasses final whole-reply safety gates | Design risk | current NG/expression/kill gates run after full ask (`fire-orchestrator.mjs:430-478`) |
| App Server process becomes new owned resource | Migration risk | current Codex session owns no persistent child; dispose semantics expand |
| config mutation races active Turn | Existing + migration risk | instruction revision is next-Fire safe; brain/memory immediate dispose differs |
| partial thread deletion | Observed risk | two`thread/delete`RPC errors; Run 1 rollout vanished but metadata success unknown |
| session continuity vs cleanup | Migration risk | normal Fire must retain thread; settings swap must end old one only after active Turn boundary |
| system prompt retry | Existing risk | failed first ask increments turnCount, so next ask omits prompt |
| network isolation mismatch | Existing/migration risk | current SDK does not explicitly set`networkAccessEnabled:false`; probe did. Desired exact policy must be fixed in adapter tests |
| event ordering/multiple message items | Unknown | current code keeps last completed agent message; streaming concatenation scoping needs explicit contract |
| response body privacy | Migration risk | delta diagnostics must not persist raw model text; current probe/report follows content-free rule |
| dependency coupling | Migration risk | App Server executable comes from installed optional platform package; packaging/path resolution is currently hidden by SDK |

### File ownership / dependency boundary

Likely source dependency surface (no files changed by this inventory):

- primary: `src/mind/codex-session.mjs` and its test;
- registry/effort: `src/mind/brains.mjs` and its test;
- early-stream consumer: `src/mind/fire-orchestrator.mjs`, tests, possibly diagnostics;
- lifecycle/config timing: `scripts/cockpit.mjs`, `scripts/cockpit.test.mjs`;
- unchanged target: `src/mind/llm-session.mjs` Claude implementation;
- package dependency/path: `apps/soul/agent/package.json` / lock only if SDK dependency no longer supplies a stable executable/client interface;
- settings/UI snapshots: no effort field today; brain ids/labels remain independent of effort.

Rollback possibility:

- Provider-internal adapter can remain rollbackable if the current `MindSession` completion contract and registry ids are preserved and transport selection stays Codex-internal.
- Once fire-orchestrator consumes pre-completion speech, rollback is broader because observable speech/transcript/safety timing changes. A compatibility whole-reply path would need explicit tests; whether to keep one is a design/user decision.
- App Server-created persisted threads may outlive rollback unless cleanup ownership is versioned and auditable.

## Unknowns

- App Server delta stability under long replies, multiple images, tool attempts, reconnect, turn steer, and process restart.
- Whether completed agent text always equals concatenated deltas outside the one Run 2 sample.
- Exact definition and implementation location of “safe first sentence”, especially tags/NG words split across chunks and failure after speech begins.
- Whether normal session should use one App Server process per soul process, per Codex brain session, or a shared process with multiple threads.
- Whether settings swaps should delete old thread immediately, defer deletion until process shutdown, or record cleanup debt.
- How to classify/telemetry-map `turn/completed.status=interrupted` versus RPC/child exit/timeout.
- Whether to use`thread/resume` after App Server process restart within the same soul session, and how to prove no unintended previous-stream restoration.
- App Server 0.144.5 cleanup bug cause/fix version and a safe supported workaround.

## Questions only user can decide

Accepted constraints already close model/vision/session-continuation/next-Fire/first-sentence direction. Remaining product/policy choices that repository facts cannot settle:

1. If App Server `thread/delete` returns an error after rollout disappearance, is the session allowed to close with an explicit cleanup warning/debt, or must the product fail closed and refuse continued operation?
2. Is a transport-level cancel required for S8 kill while the model is thinking, or is current “let Turn finish, discard output” behavior intentionally retained? (`turn/interrupt` exists, but using it changes observable lifecycle.)
3. After the first safe sentence has been spoken, what should the user hear/see if the remainder of the Turn later fails, is interrupted, or violates a safety gate spanning the sentence boundary?
4. Is a whole-reply compatibility fallback required for rollback/runtime degradation, or may Codex Fire become App-Server-stream-only once accepted?

## Evidence commands

```powershell
# repository and discussion discovery
rg --files apps/soul discussion/ai-cohost
rg -n "codex-session|runStreamed|brainChoice|systemPrompt|vision|dispose|effort|rollout" apps/soul discussion/ai-cohost

# numbered source reads
Get-Content -Encoding UTF8 apps/soul/agent/src/mind/codex-session.mjs
Get-Content -Encoding UTF8 apps/soul/agent/src/mind/brains.mjs
Get-Content -Encoding UTF8 apps/soul/agent/src/mind/fire-orchestrator.mjs
Get-Content -Encoding UTF8 apps/soul/agent/scripts/cockpit.mjs

# installed SDK source/type inventory
rg -n "runStreamed|AbortSignal|experimental-json|sandboxMode|approvalPolicy|networkAccessEnabled" \
  apps/soul/agent/node_modules/@openai/codex-sdk/dist

# read-only local schema/migration inventory
node --input-type=module -e '<DatabaseSync(path,{readOnly:true}); query sqlite_master/_sqlx_migrations>'
rg -a -o -m 10 ".{0,120}agent_jobs.{0,180}" \
  apps/soul/agent/node_modules/@openai/codex-win32-x64/vendor/x86_64-pc-windows-msvc/bin/codex.exe

# fake-only test verification
cd apps/soul/agent
node --test src/mind/codex-session.test.mjs src/mind/brains.test.mjs scripts/cockpit.test.mjs \
  src/mind/fire-orchestrator.test.mjs src/mind/memory.test.mjs src/mind/fire-diagnostics.test.mjs
```

No external-service Turn, file deletion, DB write, config change, package install, or production rollout cleanup was performed by this inventory.
