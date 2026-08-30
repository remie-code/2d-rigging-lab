# Model identity wave — Domain B: dynamic input seams

Status: implemented; ready for three review lanes. Scope is limited to the Whisper request seam, ear-pipeline forwarding, and Fire scheduler matching seams. Existing concurrent work in the shared worktree was preserved.

## Owned diff

Only these six source/test files were changed by this domain:

- `apps/soul/agent/src/ears/whisper-inference.mjs`
- `apps/soul/agent/src/ears/whisper-inference.test.mjs`
- `apps/soul/agent/src/ears/ear-pipeline.mjs`
- `apps/soul/agent/src/ears/ear-pipeline.test.mjs`
- `apps/soul/agent/src/mind/fire-scheduler.mjs`
- `apps/soul/agent/src/mind/fire-scheduler.test.mjs`

Completion artifact: this file. No registry, prompt-builder, cockpit/server/UI, memory, transcript schema, operations, `src/voice/**`, package, or lockfile file was edited.

## Implemented contracts / B→C handoff

- `createWhisperInference({ promptProvider })` accepts a function and calls it once at the start of every `transcribe()` request. The value is not captured at inference creation. A string result is sent as the multipart `prompt`; a non-function provider or non-string result falls back to the existing literal `options.prompt`, then `DEFAULT_WHISPER_PROMPT` (`こーでぃー、コーディ。`). Existing literal `options.prompt`, including `""`, remains compatible.
- `createEarPipeline({ whisper: { promptProvider } })` forwards that getter when it lazily creates the inference client. Thus C can pass a current-identity resolver without ear restart. Existing `transcribeImpl` injection and audio/ASR behavior are unchanged.
- `createFireScheduler({ nameVariantsProvider, commentNameVariantsProvider })` reads each provider at handling time (`handleTranscript` / `handleChatMessage`) and builds match needles for that event. Literal `nameVariants` / `commentNameVariants` remain the fallback and existing defaults. Providers are not invoked at scheduler creation, so a current-brain getter can switch families without scheduler recreation. OFF, busy, self-call exclusion, normalization, probability, budgets, refractory, turn-end, and verbosity paths remain unchanged.
- C handoff: use the exact provider names above. Pass current identity Whisper text through `whisper.promptProvider`; pass exact identity voice variants through `nameVariantsProvider`; pass exact comment variants through `commentNameVariantsProvider`. Providers should return arrays/strings from the canonical resolver at invocation time; do not add a second brain mapping in B or C.

## Tests and raw results

Normal runner (environment limitation; no assertions started):

```text
node --test apps/soul/agent/src/ears/whisper-inference.test.mjs apps/soul/agent/src/ears/ear-pipeline.test.mjs apps/soul/agent/src/mind/fire-scheduler.test.mjs
exit 1
TAP: 3 file subtests, pass 0, fail 3; each failed before assertions with ChildProcess.spawn -> spawn EPERM.
```

Per the wave plan this is classified as pre-assertion worker-spawn EPERM, not an assertion failure and not a green run. Worker-free selected-import fallback (each command runs one test module in-process) produced:

```text
node --input-type=module -e "await import('./apps/soul/agent/src/ears/whisper-inference.test.mjs')"
exit 0; tests 11; pass 11; fail 0; skipped 0; cancelled 0

node --input-type=module -e "await import('./apps/soul/agent/src/ears/ear-pipeline.test.mjs')"
exit 0; tests 12; pass 12; fail 0; skipped 0; cancelled 0

node --input-type=module -e "await import('./apps/soul/agent/src/mind/fire-scheduler.test.mjs')"
exit 0; tests 60; pass 60; fail 0; skipped 0; cancelled 0
```

The added focused cases prove mutable fake prompt changes across two requests without recreating inference/ears, mutable voice variants switching Cody→Chappy with old-family negative matching, and mutable comment variants with the same negative guarantee. Existing tests cover prompt authority (prompt never becomes transcript text), literal/default prompt behavior, scheduler OFF/busy/self-call/normalization/turn-end/comment/refractory/verbosity behavior, and ear lifecycle.

Syntax/static checks:

```text
node --check apps/soul/agent/src/ears/whisper-inference.mjs
node --check apps/soul/agent/src/ears/ear-pipeline.mjs
node --check apps/soul/agent/src/mind/fire-scheduler.mjs
exit 0

git diff --check -- <six owned files>
exit 0 (only Git's existing LF→CRLF warnings)
```

`fire-scheduler.mjs` remains import-free (existing LLM non-dependency test passes). No identity mapping was duplicated; no Chappy aliases beyond the accepted provider input were invented.

## Guards / forbidden paths / consumption

- `git diff --name-only -- apps/soul/agent/src/voice` returned no paths; `git diff --numstat -- apps/soul/agent/src/voice` returned no rows. `src/voice/**` change count is **0**. The pre-existing `ear-pipeline.mjs` import of `../voice/wav-encode.mjs` remains untouched.
- No provider SDK, networked machine, or credential-content read was used. Tests inject fake `fetch`, fake Whisper server, fake VAD/capture, fake scheduler clock/RNG, and fake transcripts. Real Claude/Codex/Terra/Sol provider calls: **0**. External network calls: **0**. Credential-content reads: **0**.
- No dependency/install, package or lockfile mutation, staging, commit, reset, revert, or bulk rewrite was performed.

## Residuals

- Domain C must wire the getters to the canonical `resolveBrainIdentity` values and preserve the exact Chappy variant table; B intentionally does not import or map brain IDs.
- The normal `node --test` command remains unusable in this environment because Node's worker spawn returns EPERM before assertions. The three worker-free counts above are the legitimate focused evidence; they must not be combined with the normal-run count.
- Provider getter exceptions are allowed to propagate as application errors; non-function providers and non-string prompt results safely fall back to the existing literal/default behavior. If C needs a different error policy, escalate as a targeted design decision rather than silently changing B.

## Loop 2 targeted test evidence (test-review follow-up)

The independent test review requested stronger scheduler evidence. Only `fire-scheduler.test.mjs` was extended; source behavior and all other owned files remain unchanged.

- Voice provider test now exercises both frozen Chappy voice variants exactly: `チャッピー`, `ちゃっぴー`.
- Comment provider test now exercises all five frozen Chappy comment variants exactly: `Chappy`, `chappy`, `CHAPPY`, `チャッピー`, `ちゃっぴー`.
- Both tests reject unlisted mixed-case `ChApPy` and the old Cody family after switching.
- Both tests assert provider call count is zero at scheduler construction and positive only on handling; the voice path expects 4 handling reads and the comment path 7 handling reads.
- A compatibility test retains literal custom arrays and verifies non-function providers and non-array provider results safely fall back to those literal arrays.

Updated worker-free command:

```text
node --input-type=module -e "await import('./apps/soul/agent/src/mind/fire-scheduler.test.mjs')"
exit 0; tests 63; pass 63; fail 0; skipped 0; cancelled 0
```

The prior Whisper 11/11 and Ear 12/12 worker-free results remain unchanged; no normal-run retry was needed because the known `node --test` worker-spawn EPERM is pre-assertion and unchanged. Loop-2 source/test ownership remains within Domain B; real provider calls, external network calls, and credential-content reads remain 0.
