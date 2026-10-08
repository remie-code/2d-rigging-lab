# Domain A — Prompt profile, persistence, API, and session revision

> Status: **COMPLETE — loop-2 blocking test evidence closed; fake-only mechanical verification passed** (2026-08-20)

## Scope and implementation

Domain A now owns the editable conversation-instruction body, its additive persistence, the dedicated local API, and the next-Fire session revision boundary:

- [fire-orchestrator.mjs](../../../../../apps/soul/agent/src/mind/fire-orchestrator.mjs) and its tests own the canonical conversation-instruction profile resolver. It accepts exactly `claude`, `codex`, `codex-55`, and `codex-56-sol`; unknown or malformed values fall back to the legacy default body. The legacy one-argument Fire prompt remains byte-compatible, and the generated identity line remains outside the editable body.
- [cockpit-settings-store.mjs](../../../../../apps/soul/agent/src/cockpit/cockpit-settings-store.mjs) and its tests add the version-tolerant `conversationInstructions` key. Reads accept the versioned `{ version, overrides }` shape and a direct-map compatibility shape; malformed, empty, or unknown entries are ignored. Save/reset validate IDs and use a strict write path so the runtime revision advances only after the write succeeds. Reset removes only the selected override.
- [cockpit.mjs](../../../../../apps/soul/agent/scripts/cockpit.mjs) and its tests add the in-process effective-instruction revision controller, store hooks, stale-session check, and production wiring into the server. A saved/reset instruction leaves an existing session in place until the next Fire; that next Fire disposes/recreates only when the session revision is stale. Repeated Fire reuses the current session, in-flight answers are not interrupted, and existing brain/memory disposal paths retain their lifecycle.
- [cockpit-server.mjs](../../../../../apps/soul/agent/src/cockpit/cockpit-server.mjs) and its tests expose the fixed dedicated API:
  - `GET /api/conversation-instructions/:brainId`
  - `PUT /api/conversation-instructions/:brainId` with `{ "instruction": string }`
  - `DELETE /api/conversation-instructions/:brainId`
  - Success is `{ ok: true, brainId, instruction, isOverride, revision }`, where `instruction` is the effective body after the operation.
  - The four technical brain IDs are validated; unknown IDs, malformed JSON, non-string values, and trim-empty strings return existing-style JSON 400 errors. Durable save/reset failure returns a fixed JSON 500 error without instruction text, and the hook controls revision advancement only after a successful write.

## Loop-2 test closure

- A-TEST-01 now drives the real `createFireOrchestrator` busy state machine through the production `createSessionProxy` and production-shaped `ensureSessionCurrent` seam. It proves unchanged-revision repeated Fire reuses one session; save/reset during pending asks leave those answers intact; busy Fires are rejected; the following accepted Fire performs exactly one replacement with the selected brain's custom/default effective body; idle save/reset also wait for the next Fire; memory text, selected brain identity, and the fake TTS player remain unchanged.
- A-TEST-02 saves a unique secret successfully through the API, then exercises fake state/SSE, transcript, usage, diagnostic, identity, memory status/recording, and captured stdout/stderr sinks. The secret appears only in the dedicated PUT/GET responses and is absent from every other observed surface.
- Nonblocking evidence gaps were also closed with versioned/corrupt `conversationInstructions` fixtures, four-ID reset coverage, unavailable-hook 503 coverage, unsupported-method 404 coverage, and malformed encoded-path validation.

## Privacy and lifecycle invariants

- Instruction text is composed only at newly-created Cockpit Fire sessions, after the generated identity line and before optional memory text.
- The instruction body is returned only by the dedicated API. It is absent from `/api/state`, initial and subsequent SSE state/transcript/usage/diagnostic payloads, transcript entries, memory status, identity projections, and error responses/log paths.
- API and runtime tests use fake hooks, fake sessions, fake orchestrator/pipeline, OS temporary settings paths, and fake SSE/state surfaces only. No provider, network, microphone, TTS, chat, credential-content, or real settings-file read was performed; consumption is **zero**.

## Verification evidence

Syntax guards (all exited `0`):

```text
node --check apps/soul/agent/src/mind/fire-orchestrator.mjs
node --check apps/soul/agent/src/mind/fire-orchestrator.test.mjs
node --check apps/soul/agent/src/cockpit/cockpit-settings-store.mjs
node --check apps/soul/agent/src/cockpit/cockpit-settings-store.test.mjs
node --check apps/soul/agent/src/cockpit/cockpit-server.mjs
node --check apps/soul/agent/src/cockpit/cockpit-server.test.mjs
node --check apps/soul/agent/scripts/cockpit.mjs
node --check apps/soul/agent/scripts/cockpit.test.mjs
```

Loop-2 targeted syntax additions (`apps/soul/agent/scripts/cockpit.test.mjs`, `apps/soul/agent/src/cockpit/cockpit-server.test.mjs`, and `apps/soul/agent/src/cockpit/cockpit-settings-store.test.mjs`) also exited `0`.

Normal worker runner (recorded separately as an environment limitation; it failed before assertions):

```text
node --test --test-concurrency=1 apps/soul/agent/src/mind/fire-orchestrator.test.mjs apps/soul/agent/src/cockpit/cockpit-settings-store.test.mjs apps/soul/agent/scripts/cockpit.test.mjs apps/soul/agent/src/cockpit/cockpit-server.test.mjs
exit 1 — node:test worker spawn EPERM; 4 files, 0 pass, 4 fail, 0 assertions ran.
```

Worker-free fallback (all assertions passed):

```text
node --test --experimental-test-isolation=none --test-concurrency=1 apps/soul/agent/src/mind/fire-orchestrator.test.mjs
69/69 passed
node --test --experimental-test-isolation=none --test-concurrency=1 apps/soul/agent/src/cockpit/cockpit-settings-store.test.mjs
45/45 passed
node --test --experimental-test-isolation=none --test-concurrency=1 apps/soul/agent/scripts/cockpit.test.mjs
74/74 passed
node --test --experimental-test-isolation=none --test-concurrency=1 apps/soul/agent/src/cockpit/cockpit-server.test.mjs
126/126 passed
```

Current worker-free Domain A total: **314/314 tests passed**. Relevant regressions also passed worker-free: brains 14/14, model-identity 4/4, memory 27/27, and fire-scheduler 63/63 (**108/108**). No real external consumption occurred.

Scope and guard checks:

```text
node scripts/check-soul-zone-boundary.mjs
exit 0 — 1,391 source files scanned; no boundary violations.
```

The scoped Domain A diff is limited to the owned source/tests, the strictly required production wiring, and this completion report. No UI/modal, Domain B report/source, review, map, plan, final-gate, identity/memory/voice/persona, Runtime Player/Editor, contract, dependency, or lockfile paths were edited by this task. The shared worktree contains unrelated pre-existing dirty paths; they were preserved. No files were staged, committed, reset, restored, or deleted.

## Residuals

- The normal node:test worker runner remains unavailable in this environment because child-worker spawn returns `EPERM`; worker-free execution provides the passing mechanical evidence above.
- Human verification remains the wave-level gate for real Cockpit use (save/reset and next-Fire behavior with a live session). No live provider or credential was used here.
