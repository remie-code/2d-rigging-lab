# Review A2: session continuity / lifecycle

- ループ番号: 1
- 判定: PASS
- レビュー役: independent Review-Sylph

## Target diff / files

- `apps/soul/agent/src/mind/codex-session.mjs`
- `apps/soul/agent/src/mind/codex-session.test.mjs`
- `apps/soul/agent/src/mind/brains.mjs`
  - A2 帰属として確認したのは Codex 3 頭の共通 session factory route と Sol `effort: "low"` hunk のみ。
  - identity import/property/resolver は並行作業の既存差分であり、A2 に誤帰属していない。
- `apps/soul/agent/src/mind/brains.test.mjs`
  - A2 帰属として確認したのは Codex 3 頭の共通 App Server route/model/effort test hunk のみ。
  - identity tests は並行作業の既存差分であり、A2 に誤帰属していない。
- surrounding read-only context:
  - `apps/soul/agent/scripts/cockpit.mjs` の lazy session、brain/memory disposal、conversation-instruction revision seam
  - `apps/soul/agent/scripts/cockpit.test.mjs` の session reuse/replacement tests
- completion context: `discussion/ai-cohost/implementation/waves/codex-progressive-speech/wave1a-app-server-transport.md`

`apps/soul/agent/src/mind/llm-session.mjs` の diff は空で、Claude factory は `createLlmSession(options)` のまま。Wave 1A は Cockpit、Fire orchestrator、dependency manifest、lockfile を変更していない。

## Basis inspected

- `discussion/ai-cohost/implementation/orchestration/codex-progressive-speech-wave-plan.md` §2, §5 A2, §8, §9
- `discussion/ai-cohost/research/app-server-transport-integration-inventory.md`
- `discussion/ai-cohost/research/codex-text-streaming-official-options-2026-08.md`
- `discussion/ai-cohost/experiments/codex-app-server-streaming-probe.md`
- current target source/tests、target diff、A1 final review、Wave 1A completion context

## Acceptance inspection

### Same-thread continuity / one Fire = one turn

- 1 `createCodexSession` instance は 1 persistent App Server connection と 1 `threadId` を保持する。
- `ensureThread()` は healthy な `connection && threadId` を再利用し、ordinary ask ごとに同じ `threadId` で 1 回だけ `turn/start` を送る。
- `askInProgress` guard は concurrent ask を拒否するため、accepted product path は single-flight のまま。
- focused test は 1 process / 1 `thread/start` / 2 `turn/start`、同一 thread ID、first-turn prompt 1 回だけを固定する。公式 App Server thread semantics 上、同じ thread の後続 turn は prior conversation を継続する。

### Settings/session replacement and stale leakage

- `systemPrompt`、`model`、`effort` は session 作成時に primitive value として capture される。caller が元 options object を後から変更しても live session の設定は変わらない。
- caller content は最初の await 前に text copy / image bytes の local file 化を完了し、callback reference も accepted ask ごとに capture される。
- healthy thread では `threadHasSuccessfulTurn` により prompt は初回成功 turn だけへ注入される。failure/death invalidation は同 flag と thread ID を reset し、fresh thread の first turn に prompt を再注入する。
- focused test は新 adapter が別 process/thread を生成し、`SETTINGS-A` と `SETTINGS-B` が各自の first turn だけへ入ることを確認する。
- surrounding Cockpit seam は同じ session を ordinary Fire で再利用し、brain/memory change 後は current session を dispose/null、conversation-instruction revision 後は次 accepted Fire の直前に stale session を dispose/null してから `ensureFireResources()` で新 session を作る。既存 regression tests は新 brain/prompt、memory/instruction保持、unchanged revision reuse を固定する。

### Failure recovery / prompt semantics

- turn failure、malformed protocol、delta/final mismatch、callback failure、process error/exit は connection/thread を invalidation し、exact old child の close/reap barrier を ask と次 spawn が待つ。
- recoverable failure では next ask が fresh process/thread を作る。failed first attempt は成功扱いにならないため、fresh first turn に system prompt が再度入る。
- in-flight process exit、failed first turn、delta/final mismatch、malformed JSON の各 focused test は次 ask の回復を確認する。reap 不能時は replacement を起動せず、同じ error を後続 ask/dispose に返すため、false recovery や orphan-aware success を作らない。
- 独立 A2 probe でも ordinary 2 asks が `thread-0`、idle child death 後の ask が `thread-1` となり、prompt は first ask と recovery ask にだけ入った。

```json
{"replies":["reply-1","reply-2","reply-3"],"childCount":2,"threadIds":["thread-0","thread-0","thread-1"],"inputs":[["SNAPSHOT-A\n\none"],["two"],["SNAPSHOT-A\n\nthree"]]}
```

### Disposal / late work

- active dispose は active ask を reject して callback を null にし、bounded `turn/interrupt`、best-effort exact `thread/delete`、TERM/KILL reap、exact rollout/ledger cleanup、scratch removal を行う。
- generation、thread ID、turn ID、item lifetime、`active.settled` の gates により stale connection notification と dispose 後 delta は commit されない。
- fatal invalidation と dispose が競合しても `AppServerConnection.closePromise` は idempotent で、session `resetPromise` は exact stale child の reap を共有する。
- delayed-exit / never-exit focused tests は replacement-before-reap、unhandled rejection、reap failure 後の成功報告がないことを固定する。

### Preserved routes

- vision は image-first `localImage` のまま。
- Codex 3 頭は共通 adapter を通り、Sol は `low`。Terra/GPT-5.5 は既存 `none`。
- Claude implementation/factory は untouched。

## Test commands and raw summaries

### Repository-standard isolated runner attempt

```powershell
node --test --test-concurrency=1 src/mind/codex-session.test.mjs src/mind/brains.test.mjs
```

Test module 読み込み前に sandbox が worker spawn を拒否した既知環境制約。

```text
tests 2
pass 0
fail 2
Error: spawn EPERM
duration_ms 12.0505
```

### Focused worker-free lane

```powershell
node --test --test-isolation=none --test-concurrency=1 src/mind/codex-session.test.mjs src/mind/brains.test.mjs
```

```text
tests 29
pass 29
fail 0
cancelled 0
skipped 0
todo 0
duration_ms 312.5668
```

### Relevant worker-free regression lane

```powershell
node --test --test-isolation=none --test-concurrency=1 src/mind/codex-session.test.mjs src/mind/brains.test.mjs src/mind/fire-orchestrator.test.mjs src/mind/memory.test.mjs scripts/cockpit.test.mjs
```

```text
tests 200
pass 200
fail 0
cancelled 0
skipped 0
todo 0
duration_ms 5250.0745
```

### Syntax / diff hygiene

```powershell
node --check src/mind/codex-session.mjs
node --check src/mind/codex-session.test.mjs
node --check src/mind/brains.mjs
node --check src/mind/brains.test.mjs
git diff --check -- apps/soul/agent/src/mind/codex-session.mjs apps/soul/agent/src/mind/codex-session.test.mjs apps/soul/agent/src/mind/brains.mjs apps/soul/agent/src/mind/brains.test.mjs
```

Exit 0。syntax / whitespace error なし。

## Findings

### Blocker

なし。

### Major

なし。

### Minor

なし。

## Residual risks / open verifications

- 実 App Server multi-turn はこの implementation/review で実行していない。同じ thread ID による request continuity は fake で固定したが、prior natural-language context が実 model の後続回答に見えることは human/runtime gate 待ち。既存 bounded real probe は Sol/low/vision の単一成功 turn だけである。
- surrounding Cockpit の conversation-instruction revision は accepted Fire を残して次 Fire で replacement する。一方、brain/memory hook は現在の session をその場で dispose する既存 seam である。assignment 指示どおり非所有 Cockpit 実装の変更は A2 finding にしていないが、brain/memory change が active Fire をどう扱うかは Wave 2 integration で immutable settings-snapshot decision と再照合が必要。
- App Server process が正常に生きたまま terminal notification を停止した場合の独立 turn timeout はない。timeout policy は A2 acceptance に明記されていないため finding にはしていない。
- App Server 0.144.5 の `thread/delete` `agent_jobs` DB error により metadata deletion 成功は保証されず、exact rollout cleanup は best-effort のまま。
- unreapable child は安全側に replacement を永久阻止する。この状態は明示 error となり false success/orphan-aware continuationはしないが、同 session 内の自動復旧は行わない。
- automated tests は fake/probe-shaped で、実 account、network、実 `~/.codex`、model quota を使用していない。

## Verdict

PASS

A2 acceptance に対し zero Blocker/Major で、focused 29/29 と relevant regression 200/200 が green。same-thread continuity、settings capture/new-session seam、failure recovery、reap barrier、late callback suppressionを source・tests・独立 probe で確認したため PASS とする。
