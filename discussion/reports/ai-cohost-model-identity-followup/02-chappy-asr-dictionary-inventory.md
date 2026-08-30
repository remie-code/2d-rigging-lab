# Chappy ASR / call-dictionary inventory

> Scope: repository facts only. This is a follow-up to the accepted model-identity wave. It inventories the current Chappy registration and activation paths for Whisper lexical bias, voice-call matching, and comment-call matching. It does not change source, tests, maps, or scope.

## Evidence basis and status

- The accepted contract is [model-identity-wave-plan.md](../../ai-cohost/implementation/orchestration/model-identity-wave-plan.md), §2–§4. Its identity granularity is model family: Claude → Cody and GPT → Chappy. The wave closeout is mechanically `PASS` but the human gate remains `PENDING` ([final-closeout.md](../../ai-cohost/implementation/waves/model-identity/final-closeout.md), lines 1–17; [human-gate.md](../../ai-cohost/implementation/waves/model-identity/human-gate.md), lines 1–8).
- The single current identity authority is `apps/soul/agent/src/mind/model-identity.mjs:3-8,22-70`. Chappy's exact values are `canonicalName=チャッピー`, `latinName=Chappy`, `whisperPrompt=ちゃっぴー、チャッピー。`, voice variants `[チャッピー, ちゃっぴー]`, and comment variants `[Chappy, chappy, CHAPPY, チャッピー, ちゃっぴー]` (`:62-70`). Cody's corresponding values, including the legacy four voice variants and eight comment variants, are `:22-35,52-61`.
- The registry binds `claude` to Cody and all three GPT entries (`codex`, `codex-55`, `codex-56-sol`) to Chappy at `apps/soul/agent/src/mind/brains.mjs:49-89`; `resolveBrainIdentity` preserves the Cody fallback for unknown/absent IDs at `:98-108`.

## Exact path inventory

| Surface | Current registration and activation | Wave delta versus the pre-wave repository | Current qualification |
|---|---|---|---|
| Whisper lexical bias / initial prompt | The literal default remains Cody: `DEFAULT_WHISPER_PROMPT = "こーでぃー、コーディ。"` at `apps/soul/agent/src/ears/whisper-inference.mjs:40-49`. `createWhisperInference` accepts an optional `promptProvider` (`:74-78,92-95`) and reads it once per `transcribe()` (`:116-130`), appending only the multipart `prompt` field. Production `cockpit-server` injects a provider from the current registry identity at `:717-728`; `ear-pipeline` carries `prompt` and `promptProvider` into the inference object at `apps/soul/agent/src/ears/ear-pipeline.mjs:88-91,388-394`. `cockpit.mjs` supplies the same current-identity closure at `apps/soul/agent/scripts/cockpit.mjs:660-664,963-972`. | **Altered.** Before the wave, Whisper only resolved the literal/default Cody prompt (`git diff` for `whisper-inference.mjs` shows the new provider option, request-time resolution, and form append). Chappy was not a Whisper prompt value in the old path. The wave adds Chappy through the frozen identity contract and production request-time provider while preserving the direct-constructor Cody default. | Chappy is registered and active in the production cockpit when a GPT-family brain is current. A direct `createWhisperInference()` or `createEarPipeline()` caller that does not provide the current-identity provider still intentionally falls back to the Cody literal; this is compatibility behavior, not a second Chappy dictionary. |
| Voice-call matcher (ASR transcript → `call`) | The legacy scheduler export `NAME_VARIANTS_V0` remains Cody-only (`apps/soul/agent/src/mind/fire-scheduler.mjs:204-218`). The scheduler now accepts `nameVariantsProvider` and resolves it at handling time (`:397-399,466-482`), then applies it only to the `you` transcript call check (`:729-739`). Production `cockpit-server` supplies `identity.voiceCallVariants` through that provider (`:1430-1448`), so a running scheduler follows the current registry identity without recreation. | **Altered at the seam/wiring, not by rewriting the legacy default list.** The pre-wave scheduler built one static Cody needle set at construction (`git diff` for `fire-scheduler.mjs`). The wave adds a handling-time provider and production wiring; the old literal `NAME_VARIANTS_V0` remains unchanged for compatibility/direct callers. | Chappy's two accepted voice forms are active for GPT-family current identity; Cody forms are inactive after the provider switches. This is call matching, not Whisper prompt injection. |
| Comment-call matcher (comment text → `comment-call`) | The legacy `NAME_VARIANTS_TEXT_V0` remains Cody-only, with eight Cody/Japanese forms at `apps/soul/agent/src/mind/fire-scheduler.mjs:183-202`. A separate `commentNameVariantsProvider` is accepted and read at handling time (`:403-406,471-482`), and only `handleChatMessage` uses it (`:753-780`). Production wiring supplies `identity.commentCallVariants` at `apps/soul/agent/src/cockpit/cockpit-server.mjs:1430-1448`. | **Altered at the seam/wiring, not by merging Chappy into `NAME_VARIANTS_TEXT_V0`.** Before the wave, comment needles were a static Cody text set at scheduler construction (`git diff` for `fire-scheduler.mjs`). The wave adds a distinct provider and registry-backed production wiring. | Chappy's five accepted comment forms are active for GPT-family current identity; Cody forms are inactive after the provider switches. This is text-comment matching, not ASR/Whisper recognition. |

The current `cockpit-server` code deliberately keeps these surfaces distinct: the Whisper provider returns only `identity.whisperPrompt` (`:717-728`), while the scheduler receives separate `voiceCallVariants` and `commentCallVariants` providers (`:1430-1448`). No source path uses the comment variants as an ASR prompt or the Whisper prompt as a matcher needle.

## Tests and fixtures

### Contract and four-brain registration

- `apps/soul/agent/src/mind/model-identity.test.mjs:12-70` asserts the exact frozen Cody and Chappy objects, including the Chappy prompt and both variant sets, deep freezing, and Cody fallback.
- `apps/soul/agent/src/mind/brains.test.mjs:31-47` asserts the four registry bindings and fallback resolver.

### Whisper / ear path

- `apps/soul/agent/src/ears/whisper-inference.test.mjs:99-110` asserts the direct default is Cody; `:141-167` changes a mutable fake from Cody prompt to Chappy prompt without recreating inference; `:170-200` covers provider fallback; `:202-218` proves prompt text is not copied into the server-derived transcript result.
- `apps/soul/agent/src/ears/ear-pipeline.test.mjs:154-218` exercises the default prompt through the production inference path with a fake loopback server; `:225-286` switches the fake request-time prompt from Cody to Chappy without restarting the ear pipeline.

### Voice and comment matcher paths

- `apps/soul/agent/src/mind/fire-scheduler.test.mjs:194-240` verifies handling-time voice provider switching, accepts exactly Chappy's two voice values, and rejects the old Cody family plus an unlisted mixed-case `ChApPy`.
- `apps/soul/agent/src/mind/fire-scheduler.test.mjs:244-294` verifies handling-time comment provider switching, accepts exactly Chappy's five comment values, and rejects old Cody plus unlisted `ChApPy`.
- The matcher implementation keeps the paths separate: ASR transcript call matching is `handleTranscript` at `:701-739`; comment-call matching is `handleChatMessage` at `:753-780`. `speaker === "soul"` and `speaker === "viewer"` exclusions remain in `:715-727`.
- `apps/soul/agent/src/cockpit/cockpit-server.test.mjs:2363-2391` uses a fake pipeline/scheduler and mutates one current identity to prove Whisper, voice, and comment providers all switch without ear/scheduler recreation. The same suite checks Chappy/Cody public identity projections at `:2232-2321`.

## Fresh safe verification

I ran the repository's worker-free selected-import fallback (no provider, microphone, TTS, credential, or external network use):

```text
node --input-type=module -e "await import('./apps/soul/agent/src/mind/model-identity.test.mjs'); await import('./apps/soul/agent/src/mind/brains.test.mjs'); await import('./apps/soul/agent/src/ears/whisper-inference.test.mjs'); await import('./apps/soul/agent/src/ears/ear-pipeline.test.mjs'); await import('./apps/soul/agent/src/mind/fire-scheduler.test.mjs');"
```

Observed result: exit `0`, **104/104 assertions passed**, 0 failed/skipped/cancelled. This is worker-free assertion evidence only; it is not a real ASR/microphone run.

I also ran the normal worker-based command over the three ASR/matcher files:

```text
node --test apps/soul/agent/src/ears/whisper-inference.test.mjs apps/soul/agent/src/ears/ear-pipeline.test.mjs apps/soul/agent/src/mind/fire-scheduler.test.mjs
```

Observed result: exit `1`, 3 file subtests, 0 pass / 3 fail; every file failed before assertions with `ChildProcess.spawn -> spawn EPERM`. Per the accepted wave plan's classification, this is an environment-origin worker-spawn limitation, not an assertion failure and not green evidence. The wave closeout records the same limitation for its broader run ([final-closeout.md](../../ai-cohost/implementation/waves/model-identity/final-closeout.md), lines 24–67).

## Active gaps and risks

- The human gate is still `PENDING`. No real microphone/Whisper recognition sweep has established that Chappy's two voice forms are sufficient in an actual device path, and no practical inactive-Cody negative has been observed by an operator ([human-gate.md](../../ai-cohost/implementation/waves/model-identity/human-gate.md), lines 53–78).
- The accepted Chappy tables intentionally reject unlisted mixed-case spellings such as `ChApPy`; the tests make that boundary explicit (`fire-scheduler.test.mjs:217-240,269-294`). If real ASR produces a recurring unlisted form, the wave plan says to record it as a follow-up alias proposal rather than silently adding it (§14 human gate; [human-gate.md](../../ai-cohost/implementation/waves/model-identity/human-gate.md), lines 74–78). Whether to pursue such a follow-up would require a reviewed/user decision; no such decision or alias is present here.
- The compatibility defaults are Cody-only when the dynamic providers are not supplied: `DEFAULT_WHISPER_PROMPT` (`whisper-inference.mjs:49`) and `NAME_VARIANTS_V0` / `NAME_VARIANTS_TEXT_V0` (`fire-scheduler.mjs:193-218`). This is an active integration boundary for direct consumers, while the production cockpit wiring is registry-backed (`cockpit-server.mjs:717-728,1430-1448`). No evidence here authorizes changing those defaults.
- Normal `node --test` remains environment-limited by pre-assertion `spawn EPERM`; the 104/104 result above must not be represented as a worker-runner pass. Real provider/device consumption was intentionally zero in the mechanical verification.

## Verdict and evidence limits

**Verdict:** Chappy is registered in one frozen model-family contract and bound to all GPT brains. In the production cockpit, its Whisper lexical prompt, voice-call variants, and comment-call variants are all active through separate current-identity providers; Cody remains the compatibility literal/default. The model-identity wave changed the dynamic seams/wiring for all three paths, but did not merge Chappy into the legacy Cody constants or conflate lexical bias with either matcher.

Evidence is repository source/tests plus fake/loopback worker-free execution. It does not establish real microphone ASR accuracy, recurring alias needs, visible next-Fire identity, or human-gate acceptance; those remain operator evidence, not repository facts.
