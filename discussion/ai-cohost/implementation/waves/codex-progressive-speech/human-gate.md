# Codex Progressive Speech human gate

- Status: **PENDING — agent has not passed this gate**
- Real-device/App Server run: **not performed**
- Required first-run brain: **GPT-5.6 Sol, reasoning effort low**
- Vision: **mandatory**

This gate is completed by the user operating the normal Runtime Player, Soul, and Cockpit. The user does not open diagnostics, copy raw logs, inspect internal IDs, JSON-RPC, byte calculations, queue state, or test output. Agents collect and analyze passive logs after the normal run.

## Before starting

The agent/operator prepares the existing normal configuration without changing source or limits:

- GPT-5.6 Sol is the selected brain and its reasoning effort remains `low`.
- A normal vision target is selected and remains available for every tested Fire.
- Runtime Player, Soul audio output, Control Channel, and Cockpit are launched through their usual entry points.
- Barge-in remains on if the normal setup uses it.
- No network teardown, process kill, NG content, oversized payload, or other destructive/fault-injection operation is used to manufacture an interruption.

## User procedure

### 1. Ordinary multi-sentence Fire

1. Start the normal applications and open Cockpit.
2. Speak a natural request that requires looking at the selected screen and answering in several sentences. For example, ask for a short description followed by a brief reaction.
3. Trigger one normal Fire.
4. Listen until the response completes. Observe:
   - delay from Cockpit's visible Fire indication to the first audible sentence;
   - whether the first sentence begins promptly rather than waiting for the whole answer;
   - sentence order and whether gaps are natural;
   - at most one voice playing at a time;
   - mouth/lip synchronization for every sentence;
   - no expression tag, angle-bracket syntax, or other control text spoken aloud;
   - no sentence duplicated, replayed, unexpectedly overlapped, or audibly omitted;
   - no interruption note on an ordinary complete answer.

### 2. Same-conversation multi-Fire continuity

1. Continue the same conversation without restarting Soul or changing brain/thread settings.
2. Make two or more normal Fires whose questions refer to the earlier screen observation or answer.
3. Confirm that later answers remember the earlier exchange, remain vision-aware, and preserve the same ordering/lip-sync/no-duplicate behavior.

### 3. Safe later-chunk interruption

1. Start another normal Fire that is expected to answer in several sentences.
2. Let at least the first sentence finish audibly.
3. During a later sentence or the natural gap before it, begin speaking normally so the existing barge-in path interrupts the answer. Do not force a crash, disconnect, oversize request, NG hit, or process kill.
4. Confirm that:
   - already heard speech is not replayed;
   - future/unheard sentences do not start after the interruption;
   - Cockpit shows only the heard prefix plus one restrained interruption note;
   - the note appears once and exposes no diagnostic detail.
5. Make the next normal Fire with a natural follow-up about the interrupted answer.
6. Confirm that the conversation continues without pretending the full answer was heard, without displaying an internal correction as user text, and without unnecessarily repeating the audible prefix.

If an equivalent later-chunk interruption occurs naturally during the ordinary run, it may be used instead of step 3. Do not manufacture an unsafe failure merely to obtain a partial response.

## User verdict criteria

Pass only if all of the following are true:

- first audible latency is materially improved and acceptable to the user;
- multi-sentence playback is FIFO, single-active, naturally spaced, and lip-synchronized;
- control syntax is never spoken;
- complete delivery has no duplicate or omitted audible sentence;
- partial delivery preserves only the heard prefix and one restrained note, with no replay;
- the next Fire and ordinary multi-Fire conversation remain coherent and vision-aware.

Record **FAIL** if a duplicate/replay, audible omission, wrong order, overlapping voices, stale continuation, spoken control syntax, false full-answer history, missing/duplicated partial note, broken next Fire, or unacceptable latency/gap/lip sync is observed. Record **DEFER** when the normal applications, selected vision target, audio device, Control Channel, or real App Server cannot be exercised reliably enough to judge the behavior.

## Agent-only passive analysis after the run

The user does not supply raw logs. Agents read the existing passive records and produce a content-free report. Correlation may use internal IDs privately, but the user-facing report identifies chunks only by Fire/chunk order and reports no response text.

For every chunk, report:

- character count, mora count, and timeline count;
- exact serialized JSON UTF-8 bytes;
- first-delta, first-safe-sentence, TTS start/end, playback start/end timings;
- queue wait, playback duration, and terminal result/cause;
- whether active audio ever exceeded one or FIFO order was violated.

### Measurement record — blank until the run

| Fire / chunk | Chars | Mora | Timeline | Serialized bytes | First delta | First safe sentence | TTS start/end | Playback start/end | Queue wait | Terminal |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| — | — | — | — | — | — | — | — | — | — | — |

| Summary | Result |
|---|---|
| Fire indication → first audible latency | — |
| Observed maximum serialized chunk bytes | — |
| Active-audio maximum | — |
| FIFO/order violations | — |
| Duplicate/replay/omission observations | — |
| Complete-answer interruption metadata | — |
| Partial note and next-Fire continuity | — |

## Gate record — leave pending until observed

- Date/time: —
- Environment/device notes: —
- User observation: —
- Agent content-free measurement summary: —
- Outcome: [ ] PASS  [ ] FAIL  [ ] DEFER
- Failure/defer reason and next action: —

Current recorded outcome remains **PENDING — no human/device/App Server live run has occurred**.

## 4096-byte decision boundary

The configured 4096-byte value remains unchanged for this observation. This gate only records the real serialized-byte distribution and observed maximum. Retain, raise, remove, or subdivide is a separate user decision after the measurements are reported; this procedure authorizes no value change.
