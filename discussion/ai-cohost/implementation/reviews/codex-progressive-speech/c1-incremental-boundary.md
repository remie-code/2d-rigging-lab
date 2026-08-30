# Wave 2 C1 independent review — incremental boundary integration

- Review loop: **1**
- Verdict: **PASS**
- Findings: **Blocker 0 / Major 0 / Minor 0**
- Reviewer role: independent Review-Sylph; source implementation was not changed by this review

## Basis and reviewed state

Reviewed directly against:

- `discussion/ai-cohost/implementation/orchestration/codex-progressive-speech-wave-plan.md` §2, §3, §7 C1, §8–§10
- `discussion/ai-cohost/implementation/waves/codex-progressive-speech/wave1a-app-server-transport.md`
- `discussion/ai-cohost/implementation/reviews/codex-progressive-speech/a1-stream-transport.md`
- `discussion/ai-cohost/implementation/reviews/codex-progressive-speech/a2-session-lifecycle.md`
- `discussion/ai-cohost/implementation/waves/codex-progressive-speech/wave1b-speech-delivery.md`
- `discussion/ai-cohost/implementation/reviews/codex-progressive-speech/b1-sentence-playback.md`
- `discussion/ai-cohost/implementation/reviews/codex-progressive-speech/b2-payload-failure-isolation.md`
- current complete source/tests and target diff for:
  - `apps/soul/agent/src/mind/fire-orchestrator.mjs`
  - `apps/soul/agent/src/mind/fire-orchestrator.test.mjs`
  - `apps/soul/agent/scripts/cockpit.mjs`
  - `apps/soul/agent/scripts/cockpit.test.mjs`
- reference implementations/tests: `incremental-sentence-tag-buffer.*`, `codex-session.*`, `ng-words.mjs`, and the existing final NG-gate tests

The shared worktree is substantially dirty. The tracked diff of the four target files is broader than C1 because it also contains pre-existing identity, diagnostics, and conversation-instruction work. C1 attribution was therefore limited to the current logical hunks: the pure-buffer import, one Fire-local progressive boundary, the shared normal/vision incremental ask seam, the lazy session-proxy second-argument pass-through, and the focused C1 tests. No unrelated hunk was attributed to C1, edited, reverted, staged, or committed.

`git diff --name-only -- <four target paths>` returned exactly the four target files. Searches found `onProgressiveSentence` in production source only at the optional orchestrator seam; Cockpit production does not inject a consumer yet. Thus C1 does not activate per-sentence TTS/playback or create duplicate production audio. Dependency/package/lockfile target diffs were empty. Wave 1, Runtime, scheduler, memory, and Claude files have pre-existing shared-worktree state, but no C1 import/wiring was found in them; their behavioral seams were checked through the related regression lane rather than claimed as clean worktree files.

## Acceptance inspection

### Delta ownership, immediate enqueue, and one final flush

PASS.

`createProgressiveBoundary()` creates one `createIncrementalSentenceTagBuffer()` per accepted normal or vision Fire. `askIncrementally()` passes one `onTextDelta` callback to the single `session.ask`; each callback invocation calls `incremental.append(delta)` exactly once. The enqueue callback is synchronous, so a completed sentence is handed off during the delta callback and before the final ask promise resolves. There is no length threshold or merger.

The successful terminal path calls `boundary.flush()` once. Its explicit `flushed` guard makes a second call a no-op. The focused test proves a two-character first sentence is enqueued before ask return, a tagged remainder is flushed once afterward, and the final one-shot fallback speaks the tag-free whole response exactly once.

### Tags and control syntax

PASS.

The C1 boundary reuses the passed Wave 1B pure buffer rather than reimplementing tag parsing. Valid fragmented tags are withheld, malformed brackets do not enter emitted sentences, and final unfinished tag syntax is discarded by flush. C1 only forwards `output.sentences`; `output.tags` never enter the speech enqueue seam. Focused C1 assertions reject `<` and `>` in delivered chunks, while the seven pure-buffer property/focused tests cover arbitrary two-way delta splits, short sentences, fragmented tags, malformed brackets, final remainder, and idempotent flush.

Expression scheduling relative to progressive playback is intentionally not claimed here. Existing final-result expression parsing/playback remains active until C2/C3 own the progressive queue and expression timing.

### NG boundary and existing final gate

PASS.

Each completed sentence is scanned with the existing NFKC/substring `containsNgWord` only after the pure buffer has assembled it. Therefore an NG word split across arbitrary transport deltas is tested as one sentence. On the first unsafe sentence the boundary records one content-free blocked trace, stops that sentence and every later sentence, and does not alter already handed-off safe entries. The focused test splits an actual configured NG word across two deltas, retains the earlier safe sentence, and proves unsafe/later chunks are not delivered.

The existing final response gate in `processAskedReply()` remains active and independently scans the final tag-free `speechText` before `speakImpl`. The same focused test proves no one-shot fallback speech occurs and the existing `ng-blocked`/`NG_BLOCKED_NOTE` path is preserved. The existing normal and vision NG tests remain green.

### One Fire, one ask/turn; preserved routes

PASS.

Normal, manual-vision, preferred-vision success, and preferred non-vision fallback all converge on exactly one `askIncrementally()` invocation per accepted Fire. Sentence units only call `onProgressiveSentence`; they never call `session.ask`. The Cockpit proxy forwards the original input and the same ask-options reference to the already-selected session. The App Server adapter lane continues to prove one ask equals one `turn/start`, same-thread multi-Fire reuse, fresh-thread failure recovery, and Sol `low` routing.

Claude remains on `createLlmSession`; JavaScript ignores the additive unused second argument, and the non-streaming focused test proves zero progressive enqueues plus one unchanged final fallback speech. Vision remains image-first. All three Codex registry routes, Sol `low`, session replacement/settings behavior, memory composition, and ordinary later-Fire operation passed the related lane.

### C1/C2 responsibility boundary

PASS.

C1 exposes a synchronous enqueue seam but intentionally does not wire `tts-playback-coordinator`, queue terminal state, Control Channel chunk playback, or partial transcript policy. With no production `onProgressiveSentence` consumer, the existing final one-shot `speakImpl` path remains the only production audio path. This preserves current behavior and avoids duplicate audio while C2 is incomplete.

The already-handed-off safe prefix is observable and unretracted through the callback/trace even if a later delta is unsafe or the ask later fails. A reviewer probe emitted one safe sentence, then threw the first ask, then fired again: the first result was `reason:"error"`, the first safe callback entry remained present, the orchestrator returned to `idle`, and the second Fire succeeded with a new index-0 safe sentence. Assigning queue generation/playback identity and terminal state remains C2 responsibility; projecting a played prefix into history/next-turn correction remains C3 responsibility.

## Reviewer-executed verification

### Repository-standard isolated runner attempt

```powershell
cd apps/soul/agent
node --test --test-concurrency=1 src/mind/fire-orchestrator.test.mjs scripts/cockpit.test.mjs
```

The sandbox denied test-worker creation before either module was collected:

```text
tests 2
pass 0
fail 2
Error: spawn EPERM
duration_ms 21.6333
```

This is environment evidence only and is not counted as a source/test failure or as green evidence.

### Worker-free C1 and related regression lane

```powershell
cd apps/soul/agent
node --test --test-isolation=none --test-concurrency=1 \
  src/mind/codex-session.test.mjs \
  src/mind/brains.test.mjs \
  src/mind/incremental-sentence-tag-buffer.test.mjs \
  src/mind/fire-orchestrator.test.mjs \
  src/mind/memory.test.mjs \
  scripts/cockpit.test.mjs
```

```text
tests 213
pass 213
fail 0
cancelled 0
skipped 0
todo 0
duration_ms 5271.2909
```

This includes the four orchestrator C1 tests, Cockpit ask-option pass-through and end-to-end production-seam test, seven pure-buffer tests, App Server/session lifecycle tests, three-Codex routing/Sol-low tests, Claude final fallback coverage, vision regressions, existing NG gates, memory/session revision behavior, and later-Fire recovery coverage.

### Independent failure/later-Fire probe

A worker-free reviewer probe used one orchestrator. Fire 1 emitted `先行。` through the progressive callback and then threw; Fire 2 emitted and completed `復帰。`.

```json
{"first":{"fired":false,"reason":"error","message":"late fail"},"second":{"fired":true,"replyText":"復帰。"},"asks":2,"chunks":[{"text":"先行。","index":0,"final":false,"fire":1},{"text":"復帰。","index":0,"final":false,"fire":2}],"spoken":["復帰。"],"state":"idle"}
```

The failed Fire did not trigger final fallback audio, did not retract the handed-off prefix, did not strand busy state, and did not prevent a later Fire.

### Syntax and diff hygiene

```powershell
node --check apps/soul/agent/src/mind/fire-orchestrator.mjs
node --check apps/soul/agent/src/mind/fire-orchestrator.test.mjs
node --check apps/soul/agent/scripts/cockpit.mjs
node --check apps/soul/agent/scripts/cockpit.test.mjs
git diff --check -- apps/soul/agent/src/mind/fire-orchestrator.mjs apps/soul/agent/src/mind/fire-orchestrator.test.mjs apps/soul/agent/scripts/cockpit.mjs apps/soul/agent/scripts/cockpit.test.mjs
```

Exit 0. Node syntax errors and whitespace errors: none. Git printed only the repository's LF-to-CRLF working-copy warnings.

## Findings

### Blocker

None.

### Major

None.

### Minor

None.

## Residuals / open verification

- C1 does not claim actual progressive TTS/playback. C2 must connect the enqueue seam to the passed generation-qualified FIFO coordinator, distinguish LLM completion from queue completion, and enforce kill/barge-in/dispose/settings/channel ownership.
- C2 must add chunk/job/playback correlation and terminal timing; C3 must preserve the actually played prefix in Cockpit history, add one restrained interruption note, and inform the next turn without replaying the prefix.
- Progressive expression timing is not yet implemented. C1 only ensures tag/control syntax cannot become speech; the existing final-result expression path remains unchanged.
- The final NG gate currently produces the established full-result `ng-blocked` outcome. Reconciling that terminal outcome with an actually played safe prefix belongs to C2/C3 once progressive playback is active.
- The failure probe establishes that a handed-off prefix survives a later ask error and that a later Fire remains possible. Formal generation-qualified queue ownership and stale-terminal suppression remain covered by the Wave 1B primitive and must be integrated/tested in C2.
- No real App Server/model/audio/Runtime run was performed in C1 review. Automated evidence is fake/probe-shaped and consumes no model quota; real first-audible timing remains the later human gate.
- Because the repository was already dirty, `git status` alone cannot prove historical edit ownership of pre-existing Wave 1/Runtime/scheduler files. The C1 verdict relies on the bounded logical target diff, absence of C1 wiring outside the four target files, and green cross-seam regressions.

## Verdict

**PASS (loop 1).** C1 has zero Blocker/Major findings, its focused and related worker-free lane is green, and the current integration satisfies the accepted incremental boundary behavior without enabling duplicate production audio. Queue/playback terminal state and partial-conversation truth are explicitly left to C2/C3 rather than falsely claimed complete.
