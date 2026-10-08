# Domain B spec review — dynamic Whisper and voice/comment matching seams

## Verdict

**PASS — blocking findings: 0; nonblocking findings: 0.**

This review independently checked the accepted wave plan, Domain A contract and
reviews, inventory/final review, Domain B completion report, current source/tests,
and the live worktree diff. Scope is limited to request-time Whisper prompt
resolution and handling-time voice/comment call matching.

## Basis and raw evidence

- Plan: `discussion/ai-cohost/implementation/orchestration/model-identity-wave-plan.md`
  §§2–4, 7, and 10.
- Domain A contract/reviews: `discussion/ai-cohost/implementation/reviews/model-identity/domain-a-{spec,design,test}.md`;
  frozen values are supplied by `apps/soul/agent/src/mind/model-identity.mjs`.
- Domain B report: `discussion/ai-cohost/implementation/waves/model-identity/domain-b.md`.
- Inventory evidence: `discussion/reports/ai-cohost-model-identity-inventory/01-fixed-name-and-identity-flow.md`
  through `04-ui-contracts-and-tests.md`, `10-inventory-integration.md`, and
  `20-final-review.md` (inventory PASS, blocking 0/nonblocking 0).

Commands run during this review:

| Command | Raw result |
|---|---|
| `git status --short -uall` (pre-review snapshot) | Dirty worktree with concurrent A/D edits; Domain B files are the six assigned paths. Changes were preserved. |
| `node --test apps/soul/agent/src/ears/whisper-inference.test.mjs apps/soul/agent/src/ears/ear-pipeline.test.mjs apps/soul/agent/src/mind/fire-scheduler.test.mjs` | Exit **1**; 3 file subtests, **0 pass / 3 fail**. All failed before assertions with `ChildProcess.spawn -> spawn EPERM`; classified as the documented environment limitation, not an implementation assertion failure and not a green run. |
| `node --input-type=module -e "await import('./apps/soul/agent/src/ears/whisper-inference.test.mjs'); await import('./apps/soul/agent/src/ears/ear-pipeline.test.mjs'); await import('./apps/soul/agent/src/mind/fire-scheduler.test.mjs');"` | Exit **0**; **83/83 passed**, 0 failed/skipped/cancelled (11 Whisper, 12 ear-pipeline, 60 scheduler assertions). Counts are worker-free evidence only and are not combined with the failed runner count. |
| `node --check` on all six owned source/test files | Exit **0** for every file. |
| `git diff --check --` six owned files | Exit **0** (Git only emitted existing LF→CRLF warnings). |
| `git diff --name-only -- apps/soul/agent/src/voice`; `git diff --numstat -- apps/soul/agent/src/voice` | **0 paths / 0 rows**; `src/voice/**` unchanged. |

Real provider calls, external network calls, and credential-content reads: **0**.

## Spec/design assessment

### Whisper request seam — PASS

- `whisper-inference.mjs:76,95,117–130` stores only the provider function at
  construction and invokes it once at the start of every `transcribe()` call;
  the returned string is the request's `prompt` field. There is no construction-
  time prompt snapshot.
- Literal compatibility is preserved: a string `options.prompt`, including `""`,
  remains authoritative when no provider exists; a non-function provider or
  non-string provider result falls back to that literal, then the existing
  `DEFAULT_WHISPER_PROMPT` (`こーでぃー、コーディ。`). Existing response parsing
  still returns server text only, so prompt text cannot become transcript text by
  itself.
- `ear-pipeline.mjs:389–394` forwards `prompt` and `promptProvider` when the
  inference client is lazily created. The provider remains dynamic across
  utterances without ear/server restart. The mutable fake test at
  `ear-pipeline.test.mjs:225–286` proves two successive requests carry Cody then
  Chappy prompts through one pipeline.

### Voice call matching — PASS

- `fire-scheduler.mjs:397–405,466–482,712–741` adds a generic
  `nameVariantsProvider`; it is invoked during each `handleTranscript` matching
  decision, not scheduler construction. Needles are rebuilt from that event's
  current array, so changing the current brain does not require scheduler
  recreation.
- The provider is evaluated only after the existing disposed/speaker/OFF/busy/
  text guards, preserving self-call exclusion (`speaker: "soul"`), OFF/busy
  silence, normalization, and call immediacy. Literal `nameVariants` and the
  existing four Cody defaults still build static needles exactly as before when
  no provider is passed.
- `fire-scheduler.test.mjs:194–215` mutates a fake from the four Cody voice
  forms to the exact two accepted Chappy voice forms and proves old Cody text is
  rejected while Chappy text fires, without recreating the scheduler.

### Comment call matching — PASS

- `fire-scheduler.mjs:403–405,472–482,763–779` mirrors the same handling-time
  provider seam for comment text. Existing `handleChatMessage` busy/OFF,
  viewer/no-op, probability/budget/refractory, and comment-call priority remain
  in their original order; only the current match needles are supplied
  dynamically.
- `fire-scheduler.test.mjs:217–239` mutates the fake from Cody's exact eight
  comment forms to Chappy's exact five forms and proves old Cody text does not
  match while Chappy text fires. No additional Chappy aliases or second mapping
  is introduced in Domain B; canonical frozen lists remain Domain A's authority.

## Diff scope / forbidden paths

The Domain B diff is exactly these six assigned files:

- `apps/soul/agent/src/ears/whisper-inference.mjs`
- `apps/soul/agent/src/ears/whisper-inference.test.mjs`
- `apps/soul/agent/src/ears/ear-pipeline.mjs`
- `apps/soul/agent/src/ears/ear-pipeline.test.mjs`
- `apps/soul/agent/src/mind/fire-scheduler.mjs`
- `apps/soul/agent/src/mind/fire-scheduler.test.mjs`

No lifecycle/session prompt builder, UI/Cockpit, wire/history/schema, registry,
memory, operations disclosure, TTS, or `src/voice/**` file was changed by this
domain. No package/lockfile or dependency mutation is present. The scheduler
remains import-free, so no LLM/provider path was added.

## Residuals and actionable handoff

No Domain B fix is required. Domain C must pass a stable getter closure under the
exact handoff names `promptProvider`, `nameVariantsProvider`, and
`commentNameVariantsProvider`, resolving the current brain through Domain A's
frozen contract at invocation time. It must pass only the accepted Chappy prompt,
two voice variants, and five comment variants; B intentionally does not enforce a
brain-to-name mapping. Provider exceptions currently propagate, while malformed
provider values safely fall back to the existing literals; any different error
policy would require an explicit follow-up decision.

The normal Node runner remains environment-blocked by pre-assertion `spawn EPERM`;
the 83/83 worker-free run is valid focused evidence but not a full worker-runner
acceptance or human ASR recognition gate.
