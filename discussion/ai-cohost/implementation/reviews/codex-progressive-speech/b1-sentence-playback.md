# Wave 1B B1 independent review — safe sentence / playback primitives

- Current review loop: **2**
- Current verdict: **PASS**
- Current findings: **Blocker 0 / Major 0 / Minor 0**
- PASS gate: met. Loop 1 corrections are verified and reviewer-executed focused/related tests are green.

Historical loop 1 result (preserved below): **REVISE — Blocker 1 / Major 2 / Minor 0**.

## Basis and reviewed diff

Reviewed against:

- `discussion/ai-cohost/implementation/orchestration/codex-progressive-speech-wave-plan.md` §2, §6 B1, §8–9
- `discussion/ai-cohost/research/streaming-speech-pipeline-inventory.md`
- `discussion/ai-cohost/implementation/orchestration/fire-diagnostics-wave-plan.md`
- existing `expression-parser.mjs`, `audio-player.mjs`, `speak.mjs`, and the Runtime Player Control Channel speech-timeline implementation/tests for responsibility-boundary comparison

The four claimed B1 files are all new/untracked (`git status --short -- <four paths>` returned `??` for each), so ordinary `git diff` has no tracked hunk. I read the complete contents of all four files and treated each whole file as the reviewed addition:

- `apps/soul/agent/src/mind/incremental-sentence-tag-buffer.mjs`
- `apps/soul/agent/src/mind/incremental-sentence-tag-buffer.test.mjs`
- `apps/soul/agent/src/voice/tts-playback-coordinator.mjs`
- `apps/soul/agent/src/voice/tts-playback-coordinator.test.mjs`

`rg` found these primitives referenced only by their focused tests. The additions do not integrate with or edit `fire-orchestrator`, Cockpit UI/history, scheduler, Runtime Player, dependencies, or lockfiles. The shared worktree contains many unrelated pre-existing modifications; none are attributed to B1 or reviewed as B1 implementation.

## Findings

### Blocker B1-1 — playback identity is reused across coordinator generations, so a stale terminal can complete a new job

`tts-playback-coordinator.mjs:28` initializes `nextPlayback = 0` per coordinator, and `:84` produces `playback-1`, `playback-2`, ... without a queue/fire generation. `handleTerminal` at `:142-143` authenticates a terminal only by this locally reused `playbackId`.

A reviewer probe created an old coordinator, recorded its `playback-1`, killed it, then created a new coordinator whose first job was also `playback-1`. Passing the old ENDED to the new coordinator returned `true` and terminalized the new job as `completed`:

```text
{"staleId":"playback-1","newId":"playback-1","result":true,
 "snapshot":{"activePlaybackId":null,"queuedJobIds":[],"closed":false},
 "events":[{"jobId":"new","cause":"completed"}]}
```

This is the exact stale-callback commit class identified as Blocker in plan §8. The current focused test at `tts-playback-coordinator.test.mjs:43-58` verifies only an older playback within the same coordinator; it does not exercise a killed/disposed generation followed by a new coordinator generation.

Required correction: make terminal correlation generation-qualified or otherwise globally unique across coordinator lifetimes, and add a two-generation lifecycle test covering late ENDED, ERROR, STOPPED, timer, rejected `play()` promise, and late preparation from the old generation while the new generation is active.

### Major B1-2 — incremental tag handling regresses the established broken-angle safety contract and can omit non-tag speech

The established parser contract at `expression-parser.mjs:23-28,91-96` strips stray angle brackets while preserving non-tag text and guarantees that spoken text contains neither `<` nor `>`. The new scanner instead treats every `<...>` pair as a completed tag (`incremental-sentence-tag-buffer.mjs:73-96`) and never handles a standalone `>`.

Reviewer probes produced:

```text
input="応答>です。"       sentences=["応答>です。"]
input="前< これは >後。" sentences=["前後。"] diagnostics=[brokenTag]
input="前<未閉じ"        flush sentences=["前"]
```

Thus broken control syntax can reach spoken text (`>`), while text that cannot be a valid expression tag under the established ASCII-word grammar can be silently omitted. This conflicts with the inventory's broken-tag safety and the accepted no-control-syntax/no-omission behavior. The focused tests cover valid/unknown well-formed tags and one unfinished valid tag, but not stray `>`, invalid-start/malformed tags, nested brackets, or preservation of non-tag content.

Required correction: use the established tag grammar when deciding what is control syntax, preserve the established broken-input behavior, and add fragmentation cases proving no angle bracket reaches speech and non-tag text is neither duplicated nor omitted. The test named “arbitrary delta fragmentation” currently enumerates only one two-way split; add representative multi-fragment/property coverage, including tags and surrogate pairs.

### Major B1-3 — focused lifecycle tests do not establish temp-resource cleanup for the required terminal paths

The coordinator has cleanup logic (`tts-playback-coordinator.mjs:33-43`) and the reviewer found no listener or timer allocation in this primitive. However, the only cleanup assertion is a preparation that resolves after `dispose` (`tts-playback-coordinator.test.mjs:117-131`). There is no cleanup assertion for:

- natural ENDED and duplicate terminal delivery;
- a ready queued artifact cleared by kill/barge/dispose;
- ERROR/STOPPED;
- prepare failure while another job is active;
- synchronous throw or asynchronous rejection from `play`.

Plan §6 B1 makes leak-free focused lifecycle tests part of PASS, and §8 classifies an untested critical failure path as Major. Add exactly-once cleanup assertions for these terminal/clear races. Tests should also prove late artifact cleanup does not affect a newer generation after B1-1 is corrected.

## Behavioral assessment

- **Completed sentences / flush / minimum length:** the covered two-fragment cases pass, completed punctuation emits immediately, and repeated flush is idempotent. Persistent arbitrary multi-fragment coverage remains incomplete under Major B1-2.
- **Completed valid tags:** covered valid/unknown tags are excluded from speech and emitted in stream order with source positions. Broken-angle behavior fails Major B1-2.
- **FIFO / active <= 1 / same-instance terminal once:** implementation and focused tests pass for reverse preparation order, one active playback, natural ENDED, duplicate same-instance ENDED, ERROR/STOPPED clear, kill/barge/dispose, and late preparation. Cross-generation safety fails Blocker B1-1.
- **Resources:** no listener/timer is created here; late-preparation cleanup after dispose passes. Required cleanup terminal matrix is not fixed by tests (Major B1-3).
- **Soul/Runtime boundary:** preserved by this addition. Existing Soul `audio-player.mjs` remains the WAV playback owner; Runtime Player remains the Control Channel mouth-timeline consumer. B1 adds no Runtime or protocol integration.
- **Wave 2 boundary:** preserved. No B1 primitive is wired into Fire orchestration, UI/history, or scheduler.

## Reviewer-executed tests and probes

### New tests plus directly related pure/current speech tests — PASS

```powershell
cd apps/soul/agent
node --input-type=module -e "await import('./src/mind/incremental-sentence-tag-buffer.test.mjs'); await import('./src/voice/tts-playback-coordinator.test.mjs'); await import('./src/mind/expression-parser.test.mjs'); await import('./src/voice/speak.test.mjs');"
```

Raw summary: exit 0; **31 tests, 31 pass, 0 fail, 0 skipped/cancelled/todo**; duration 66.5308 ms. This includes all 12 new tests plus 13 expression-parser and 6 speak tests.

### Existing Soul AudioPlayer boundary — sandbox environment failure, then PASS outside sandbox

```powershell
cd apps/soul/agent
node --input-type=module -e "await import('./src/voice/audio-player.test.mjs');"
```

Sandbox raw summary: exit 1; **20 tests, 11 pass, 9 fail**. All nine failures reported `Error: spawn EPERM` at `node:child_process.spawn` while starting the injected silent fake player; assertions requiring that child could not run. Classified as an environment/process-spawn restriction, not a source red.

The identical worker-free import command was rerun outside the sandbox with approved process-spawn permission. Raw summary: exit 0; **20 tests, 20 pass, 0 fail, 0 skipped/cancelled/todo**; duration 409.765 ms. No real speaker or WinRT device was used.

### Reviewer behavioral probes — findings reproduced

- Two-coordinator stale-terminal probe: exit 0; reproduced Blocker B1-1 with both generations using `playback-1` and the stale ENDED completing the new job.
- Broken-angle sentence probe: exit 0; reproduced standalone `>` in spoken output and malformed/non-tag content omission described in Major B1-2.

## Verdict

**REVISE (loop 1).** Focused executions are green after separating the known spawn restriction, and scope/responsibility boundaries are preserved. B1 cannot PASS while the cross-generation stale-terminal Blocker and the two accepted-behavior/test-evidence Majors remain.

---

## Review loop 2 — correction verification

- Verdict: **PASS**
- Findings: **Blocker 0 / Major 0 / Minor 0**
- Prior findings closed: **B1-1 / B1-2 / B1-3**

### Reviewed correction diff / files

The four B1 additions remain new/untracked, so ordinary `git diff -- <four paths>` has no tracked hunk. I reread each complete file and treated the current whole-file content as the loop 2 correction diff:

- `apps/soul/agent/src/mind/incremental-sentence-tag-buffer.mjs`
- `apps/soul/agent/src/mind/incremental-sentence-tag-buffer.test.mjs`
- `apps/soul/agent/src/voice/tts-playback-coordinator.mjs`
- `apps/soul/agent/src/voice/tts-playback-coordinator.test.mjs`

`git status --short -uall -- <four paths>` reports `??` for all four. `rg` finds the two primitives referenced only by their focused tests. No B1 addition imports or edits `fire-orchestrator`, Cockpit/history/scheduler, Runtime Player, Control Channel protocol, dependencies, or lockfiles. Unrelated shared-worktree changes remain outside this review and were not reverted, staged, committed, or attributed to B1.

### Loop 1 correction verification

#### B1-1 closed — playback identity is generation-qualified across coordinator lifetimes

`tts-playback-coordinator.mjs:28,85-88,176-179` now allocates a module-lifetime monotonically increasing `coordinatorId` and emits `playback-<coordinatorId>-<sequence>`. The old and fresh coordinator therefore cannot reuse the same playback identity within the running process. `handleTerminal` still accepts only the exact current active identity; timer completion remains an explicit no-op.

The new two-coordinator test (`tts-playback-coordinator.test.mjs:133-172`) covers an old coordinator's late ENDED, ERROR, STOPPED, timer, rejected `play()` promise, and late preparation after a new generation has become active. The fresh active job and FIFO depth do not advance, while old late artifacts clean up in the old coordinator.

Reviewer probe raw result:

```text
stale="playback-1-1" current="playback-2-1" distinct=true
late ENDED/ERROR/STOPPED/timer results=[false,false,false,false]
fresh active="playback-2-1" fresh play count=1
```

#### B1-2 closed — malformed angle syntax preserves prose without speaking brackets/control syntax

`incremental-sentence-tag-buffer.mjs:71-119,149-174` classifies a possible tag using the established `[A-Za-z][\w-]*` grammar. Valid/incomplete tag syntax is withheld from speech; stray `>` and malformed `<` are stripped one bracket at a time while their non-tag body remains plain text. Completed tags are emitted in source order with source positions preserved.

The new tests (`incremental-sentence-tag-buffer.test.mjs:62-87`) cover one-chunk, multi-fragment, every-JS-code-unit fragmentation including a surrogate pair, stray `>`, malformed `< これは >`, unclosed non-tag text, and a valid unfinished tag flushed without speech. Every output assertion rejects both angle brackets.

The reviewer independently enumerated every three-piece partition for four representative strings. Raw result: all partitions passed for `応答>です。`, `前< これは >後。`, `前<未閉じ`, and `<smile>短い。<nod>終わり`; no emitted sentence contained `<` or `>`.

#### B1-3 closed — terminal/clear/failure cleanup matrix is covered

The added lifecycle tests (`tts-playback-coordinator.test.mjs:174-233`) establish exactly-once cleanup for natural ENDED plus duplicate marker, active ERROR/STOPPED, ready artifact clearing, barge-in clearing, prepare failure while another job is active, and synchronous/asynchronous `play()` failure. The earlier late-preparation-after-dispose test remains. The primitive allocates no listener or timer; `handleTimer()` is an explicit no-op after failures and stale timer signals cannot advance playback.

### Behavioral re-assessment

- **FIFO / active <= 1:** reverse preparation completion cannot overtake the head; only one `play` starts before the matching natural ENDED; duplicate and stale signals are ignored.
- **Sentence/flush:** completed punctuation emits immediately, repeated flush is idempotent, the final unterminated remainder emits once, and there is no minimum-length merger.
- **Tags:** valid fragmented tags are withheld until complete, never enter speech, and completed tags/events retain stream order and original positions. Malformed angle syntax retains non-tag text without exposing brackets.
- **Clear/failure/resources:** ERROR, STOPPED, kill, barge-in, dispose, prepare failure, and play failure close/clear without resurrection; artifacts clean exactly once, including late artifacts. No timer/listener is allocated by this primitive.
- **Responsibility boundary:** Soul's existing `audio-player.mjs` remains WAV playback owner. Runtime Player remains the synchronized mouth-timeline consumer through the Control Channel. B1 does not implement the Runtime seam or Wave 2 Fire/history/partial-delivery behavior.

### Reviewer-executed tests and raw summaries

Focused B1 plus directly related parser/speech tests:

```powershell
cd apps/soul/agent
node --input-type=module -e "await import('./src/mind/incremental-sentence-tag-buffer.test.mjs'); await import('./src/voice/tts-playback-coordinator.test.mjs'); await import('./src/mind/expression-parser.test.mjs'); await import('./src/voice/speak.test.mjs');"
```

Raw summary: exit 0; **36 tests, 36 pass, 0 fail, 0 skipped/cancelled/todo**; duration 68.1151 ms. This includes 17 focused B1 tests, 13 expression-parser tests, and 6 speak tests.

Existing Soul AudioPlayer responsibility-boundary test:

```powershell
cd apps/soul/agent
node --input-type=module -e "await import('./src/voice/audio-player.test.mjs');"
```

Sandbox raw summary: exit 1; **20 tests, 11 pass, 9 fail**. All nine failures are the known environment restriction `Error: spawn EPERM` at `node:child_process.spawn` while starting the injected silent fake player; no B1 assertion failed.

The identical worker-free command was rerun with process-spawn permission. Raw summary: exit 0; **20 tests, 20 pass, 0 fail, 0 skipped/cancelled/todo**; duration 412.9967 ms. No real speaker or WinRT device was used.

Independent loop 1 reproduction/correction probe: exit 0; all malformed-angle partition checks and cross-coordinator late-signal checks passed, as detailed above.

## Current verdict

**PASS (loop 2).** All loop 1 Blocker/Major findings are closed, no new Blocker/Major/Minor finding remains, focused and related reviewer executions are green after separating the known sandbox spawn restriction, and B1 preserves both the Soul/Runtime responsibility boundary and the Wave 2 ownership boundary.
