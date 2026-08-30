# Cockpit Settings modal — Domain A test review

## Verdict

**PASS (loop 2).** The two loop-1 blocking findings are closed by targeted
fake-only tests: a production-shaped `createFireOrchestrator` + session
revision lifecycle test, and a successful-save privacy test covering all
listed observability surfaces. No new blocking test issue was found.

No source or test implementation was changed by this review. The only file
written is this review report.

## Basis and scope

- Plan: `discussion/ai-cohost/implementation/orchestration/cockpit-settings-modal-wave-plan.md`
  §§2–4, §7, §8.
- Completion: `discussion/ai-cohost/implementation/waves/cockpit-settings-modal/domain-a.md`.
- Reviewed source/tests: `apps/soul/agent/src/mind/fire-orchestrator.mjs` and
  test; `apps/soul/agent/src/cockpit/cockpit-settings-store.mjs` and test;
  `apps/soul/agent/src/cockpit/cockpit-server.mjs` and test;
  `apps/soul/agent/scripts/cockpit.mjs` and test.
- Review responsibility: positive/negative test adequacy, fake-only proof,
  raw current counts, EPERM classification, privacy and regression evidence.
- Other dirty worktree paths are concurrent work and were preserved.

## Raw verification evidence

All commands below were run fresh in the current worktree on 2026-08-20.

### Worker-free assertion runs

| Command | Result |
|---|---|
| `node --test --experimental-test-isolation=none --test-concurrency=1 apps/soul/agent/src/mind/fire-orchestrator.test.mjs` | **69/69 passed**, 0 failed/skipped/cancelled |
| `node --test --experimental-test-isolation=none --test-concurrency=1 apps/soul/agent/src/cockpit/cockpit-settings-store.test.mjs` | **45/45 passed**, 0 failed/skipped/cancelled |
| `node --test --experimental-test-isolation=none --test-concurrency=1 apps/soul/agent/scripts/cockpit.test.mjs` | **74/74 passed**, 0 failed/skipped/cancelled |
| `node --test --experimental-test-isolation=none --test-concurrency=1 apps/soul/agent/src/cockpit/cockpit-server.test.mjs` | **126/126 passed**, 0 failed/skipped/cancelled |
| **Domain A focused total** | **314/314 passed** |

Additional relevant regression checks were also green: `brains.test.mjs`
14/14, `model-identity.test.mjs` 4/4, `memory.test.mjs` 27/27, and
`fire-scheduler.test.mjs` 63/63 (**108/108 total**). These counts are kept
separate from the 314 focused tests.

### Normal worker runner (separate environment limitation)

Command:

```text
node --test --test-concurrency=1 apps/soul/agent/src/mind/fire-orchestrator.test.mjs apps/soul/agent/src/cockpit/cockpit-settings-store.test.mjs apps/soul/agent/scripts/cockpit.test.mjs apps/soul/agent/src/cockpit/cockpit-server.test.mjs
```

Raw result: exit **1**; **4 files, 0 pass, 4 fail, 0 assertions**. Every file
failed before assertions with `ChildProcess.spawn -> spawn EPERM` from
Node's test worker creation. This is not assertion-failure evidence and is
kept separate from the 314/314 worker-free result.

### Syntax, guards, and scope checks

- `node --check` on all 8 Domain A source/test files: **8/8 exit 0**.
- `node scripts/check-soul-zone-boundary.mjs`: **exit 0**, 1,391 source files
  scanned, no boundary violations.
- `git diff --check` on the 8 owned source/test paths: **exit 0**.
- No status entries under `apps/soul/agent/src/voice/**`; no diff in
  `package.json`, `pnpm-lock.yaml`, `apps/soul/agent/package.json`, or
  `apps/soul/agent/package-lock.json`.
- Independent inline comparison against the pre-wave `HEAD` prompt literal:
  `byte-compatible FIRE_SYSTEM_PROMPT` (exit 0).

## Coverage assessment

| Required area | Current evidence | Assessment |
|---|---|---|
| Four technical IDs | Store round-trip loops over `claude`, `codex`, `codex-55`, `codex-56-sol` (`cockpit-settings-store.test.mjs:86-103`); API GET defaults loops over all four (`cockpit-server.test.mjs:519-534`) | Positive coverage present |
| Default / override / reset / fallback | Resolver covers default, override, unknown ID, and trim-empty fallback (`fire-orchestrator.test.mjs:84-102`); store reset now loops all four IDs and preserves remaining overrides (`cockpit-settings-store.test.mjs:177-197`); API save/reset is exercised for `codex-55` (`cockpit-server.test.mjs:536-559`) | PASS |
| Malformed and compatibility values | Direct-map, versioned-map, corrupt-shape, corrupt-JSON, unknown, whitespace, and non-string values are covered (`cockpit-settings-store.test.mjs:109-175`); API malformed JSON, unknown ID, non-string and trim-empty requests (`cockpit-server.test.mjs:565-598`) | PASS |
| Exact GET/PUT/DELETE contract | Success response shape/revision and unknown IDs are checked; unavailable hooks return 503, unsupported methods 404, and malformed encoded IDs 400 (`cockpit-server.test.mjs:600-629`) | PASS |
| Persistence failure / revision unchanged | Store unwritable write throws; API save failure and reset failure retain effective body and revision 0 (`cockpit-server.test.mjs:600-655`); hook revision false result is checked (`scripts/cockpit.test.mjs:1164-1187`) | Pass for persistence/API seams |
| Repeated Fire and idle/busy next-Fire behavior | New production-shaped integration test (`scripts/cockpit.test.mjs:1140-1297`) uses the real `createFireOrchestrator` and `createSessionProxy`, records factory-created prompts, covers repeated reuse, idle save, pending save/reset, busy rejection, and exactly-one replacement on the following accepted Fire | PASS |
| Brain and memory unchanged | The same integration test fixes selected `codex-55`, asserts Chappy identity, keeps memory text in every replacement prompt, keeps the unrelated Codex override out, and verifies one stable fake TTS player; independent brain/memory suites also pass | PASS (production-shaped fake seam; live provider remains human gate) |
| Privacy: state/SSE/transcript/usage/memory/identity/diagnostics/logs | Successful secret save test (`cockpit-server.test.mjs:688-757`) proves the secret occurs only in dedicated PUT/GET responses and is absent from state, SSE transcript/usage/diagnostic, memory status/record, identity projection, transcript, and captured stdout/stderr | PASS |
| Existing endpoint regressions | Full current `cockpit-server` 126/126 and settings store 45/45; script/orchestrator focused suites also green | PASS for current focused regression surface |

## Loop-2 closure of prior blocking findings

### A-TEST-01 — CLOSED

`cockpit.test.mjs:1140-1297` now drives the real `createFireOrchestrator`
busy state machine through the production `createSessionProxy` and a
production-shaped `ensureFireResources`/`ensureSessionCurrent` seam. It records
each factory-created session and system prompt, then verifies: unchanged
revision reuse; save while the first ask is pending; busy rejection; next
accepted Fire replacement with the custom body; reset while the replacement is
pending; next replacement with the default body; idle save replacement; and a
final unchanged-revision reuse. It also checks in-flight answers complete,
memory text survives every prompt, the selected Chappy-family identity remains
stable, the unrelated-brain override is absent, and the fake TTS player is
created once. This is adequate fake-only evidence for AC-04 and the runtime
integration row; live-provider behavior remains assigned to the human gate.

### A-TEST-02 — CLOSED

`cockpit-server.test.mjs:688-757` successfully persists a unique secret through
the fake API hook and confirms it appears only in the dedicated PUT/GET
responses. It then drives ordinary fake state, transcript, usage, diagnostic,
identity, memory-status/record, and SSE paths, queries `/api/state` and the
server transcript, and captures stdout/stderr; all non-dedicated surfaces are
asserted secret-free. The test uses ordinary payloads for those surfaces, so it
proves the server projection boundary without sending any provider or
credential data.

## Nonblocking observations

1. The runtime integration is production-shaped rather than invoking `main()`
   itself, because the real launcher would read process settings and create
   provider/audio resources. The completion report's human gate remains the
   proper place for one live Cockpit save/reset→next-Fire observation.
2. The successful privacy test drives server observability seams with ordinary
   fake payloads; it does not materialize a memory Markdown file or exercise a
   live LLM result. Source inspection confirms the instruction body has no
   memory-file, usage, or log projection, and those real-consumption paths are
   explicitly outside machine verification.
3. The exact default-byte assertion in the committed test remains relational
   (`buildFireSystemPrompt(cody) === FIRE_SYSTEM_PROMPT`). Independent review
   comparison against the pre-wave `HEAD` literal passed; a committed golden
   fixture would make this invariant more self-contained, but it is not a
   blocking gap.

## Fake-only, scope, and consumption audit

The focused tests use in-memory hooks, OS temporary settings paths, fake
sessions/schedulers/pipelines, and `server.listen(0)` loopback HTTP only. No
live provider, external network, microphone, TTS, chat, credential-content
read, or real settings-file read occurred. Observed external/credential
consumption: **0**.

The source grep/review found instruction text reaching only the dedicated API
response and newly-created session system prompt; no direct state/SSE,
transcript, usage, memory, identity, diagnostic, or log projection was found.
The successful-save privacy test now independently exercises the server-side
projection boundary.

## Disposition

Both loop-1 blocking findings are closed. Domain A test lane is **PASS** for
loop 2. Review-Sylph did not fix source or tests and wrote only this persistent
report. Retain the normal-run `spawn EPERM` record separately from the
worker-free 314/314 evidence; the remaining live-provider/session behavior is
the wave's human gate, not a machine test blocker.
