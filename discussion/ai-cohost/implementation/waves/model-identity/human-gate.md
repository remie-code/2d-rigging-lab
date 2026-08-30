# Model identity human gate — PENDING

> Status: **PENDING.** This is a user/operator execution template, not a
> mechanical-test result. It is separate from, and required after, the final
> mechanical gate. Do not mark this gate PASS or close out the wave until a
> conscious user/operator has performed the real-world checks below and
> attached evidence.

Plan: [model-identity wave plan](../../orchestration/model-identity-wave-plan.md)

Existing implementation reports: [Domain A](domain-a.md), [Domain B](domain-b.md),
[Domain C](domain-c.md), [Domain D](domain-d.md). The operational wording to
check is [pre-stream-checklist.md](../../operations/pre-stream-checklist.md).

## Record

- Date (local): `[YYYY-MM-DD]`
- Operator: `[name / handle]`
- Environment (browser, cockpit revision, devices): `[fill in]`
- Mechanical gate result and evidence reference: `[PASS report path + date]`
- Human-gate execution start/end: `[timestamps]`
- Overall human-gate result: `PENDING` until this record is completed (`PASS` / `FAIL` / `PENDING`)

Every row must be recorded as `PASS`, `FAIL`, or `NOT RUN`, with an evidence
reference (screenshot, visible transcript/feed observation, audio note, or
operator log). Automated tests cannot substitute for these checks.

## Preconditions

- [ ] The final mechanical gate is already `PASS` (record its evidence above).
- [ ] A conscious user/operator, not an unattended agent or fake, is running
      the cockpit and making the selections, Fires, microphone calls, and
      observations.
- [ ] The operator understands that real provider, microphone, and TTS use is
      intentional for this gate and will be reported separately below.

## Required real-world checks

### 1. Claude / Cody

Select the Claude brain (`claude`) and record each result.

| Check | Result | Evidence |
|---|---|---|
| Current Cockpit header and document title show `こーでぃー` (technical Claude label remains correct) | `[PASS / FAIL / NOT RUN]` | `[ref]` |
| After selection, the **next Fire** creates a session whose self-name is `コーディ (Cody)`; do not infer this from an old/in-flight response | `[PASS / FAIL / NOT RUN]` | `[ref]` |

### 2. GPT / Chappy — every GPT brain

For each row, select that brain separately, verify the current UI, then make a
new Fire and verify the newly created session self-identifies as
`チャッピー (Chappy)`.

| GPT brain | Current UI shows `チャッピー` | Next Fire self-name is Chappy | Technical label/raw badge unchanged | Evidence |
|---|---|---|---|---|
| `codex` — Codex (GPT-5.6 Terra) | `[PASS / FAIL / NOT RUN]` | `[PASS / FAIL / NOT RUN]` | `[PASS / FAIL / NOT RUN]` | `[ref]` |
| `codex-55` — Codex (GPT-5.5) | `[PASS / FAIL / NOT RUN]` | `[PASS / FAIL / NOT RUN]` | `[PASS / FAIL / NOT RUN]` | `[ref]` |
| `codex-56-sol` — Codex (GPT-5.6 Sol) | `[PASS / FAIL / NOT RUN]` | `[PASS / FAIL / NOT RUN]` | `[PASS / FAIL / NOT RUN]` | `[ref]` |

### 3. Microphone name switching under GPT

Use a real microphone with one selected GPT brain (record the brain ID). The
positive and negative calls must be made in separate attempts while that GPT
identity is active.

- Selected GPT brain: `[codex / codex-55 / codex-56-sol]`
- [ ] Saying a Chappy variant (for example `チャッピー` or `Chappy`) is
      recognized as the active self-call and can cause the next Fire. Result:
      `[PASS / FAIL / NOT RUN]`; evidence: `[ref]`
- [ ] Saying a Cody variant (for example `コーディ` or `Cody`) does **not**
      trigger the GPT self-call. Result: `[PASS / FAIL / NOT RUN]`; evidence:
      `[ref]`
- [ ] Record any recurring ASR misrecognition verbatim as a follow-up alias
      proposal; do not add an alias during this gate. Result/evidence: `[ref]`

### 4. GPT → Claude return

Switch from the selected GPT brain back to Claude and perform a new Fire.

- [ ] Current header/title return to `こーでぃー` and the technical Claude
      label remains correct. Result: `[PASS / FAIL / NOT RUN]`; evidence: `[ref]`
- [ ] The **next Fire** self-name is Cody again. Result: `[PASS / FAIL / NOT RUN]`;
      evidence: `[ref]`

### 5. Output and history invariants

- [ ] TTS sound, configured speaker/output device, and apparent voice remain
      unchanged across Claude/GPT selection; the brain switch does not claim or
      cause a persona/speaker change. Result: `[PASS / FAIL / NOT RUN]`;
      before/after evidence: `[refs]`
- [ ] Existing past transcript text is unchanged; no transcript row is renamed
      or re-attributed. Result: `[PASS / FAIL / NOT RUN]`; evidence: `[ref]`
- [ ] Existing/in-flight SSE transcript text is unchanged; no response is
      rewritten after a brain switch. Result: `[PASS / FAIL / NOT RUN]`;
      evidence: `[ref]`
- [ ] Memory Markdown and persisted history remain unchanged; no identity field
      or past-text rewrite appears. Result: `[PASS / FAIL / NOT RUN]`;
      evidence: `[ref]`

### 6. Operational disclosure

- [ ] The pre-stream disclosure/checklist matches the selected family: the
      Claude selection uses Cody wording and the GPT selection uses Chappy
      wording. Result: `[PASS / FAIL / NOT RUN]`; evidence: `[ref]`
- [ ] The disclosure retains AI-generation, comment use, and local-summary /
      privacy wording and does **not** imply that TTS voice or persona changes
      with the brain. Result: `[PASS / FAIL / NOT RUN]`; evidence: `[ref]`

## Separate provider and real-world consumption report

Report consumption independently from the pass/fail observations. Use `0` or
`none` explicitly where applicable; do not fold these counts into mechanical
test counts.

| Resource / action | Count or duration | Evidence / notes |
|---|---|---|
| Real Claude provider calls | `[ ]` | `[ ]` |
| Real GPT provider calls (identify brain IDs) | `[ ]` | `[ ]` |
| External network calls beyond required provider path | `[ ]` | `[ ]` |
| Credential-content reads | `[ ]` | `[ ]` |
| Real microphone sessions / utterances | `[ ]` | `[ ]` |
| Real TTS playback checks | `[ ]` | `[ ]` |
| Other real device/runtime consumption | `[ ]` | `[ ]` |

Operator summary: `[what was actually consumed, by whom, and when]`

## Adjudication

- Passed checks: `[N / total]`
- Failed checks and reproduction notes: `[list or none]`
- Not-run checks and reason: `[list or none]`
- Follow-up alias proposals (if any): `[list or none]`
- Human-gate status: `PENDING` until an operator fills this section and a
  responsible maintainer records `PASS` or `FAIL` with the evidence above.
