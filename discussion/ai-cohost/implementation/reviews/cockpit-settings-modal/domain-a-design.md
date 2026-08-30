# Domain A — Cockpit Settings modal design review

## Verdict

**PASS** — loop 1; blocking findings **0**.

The current Domain A implementation has one canonical conversation-instruction
profile resolver, additive version-tolerant persistence, a dedicated local API,
and a revision boundary that invalidates an existing Fire session only when the
next Fire asks. Durable-write failure does not advance the revision. The
instruction body is kept out of the normal state/SSE/transcript/memory/error
surfaces, and the existing brain, memory, voice, and modal-external operating
surfaces remain behaviorally separated.

## Basis and scope

- Orchestration rules: `.codex/skills/implementation-orchestration/SKILL.md`
- Conventions: `discussion/_conventions.md`
- Wave plan: `discussion/ai-cohost/implementation/orchestration/cockpit-settings-modal-wave-plan.md`
- Domain A completion: `discussion/ai-cohost/implementation/waves/cockpit-settings-modal/domain-a.md`
- Reviewed source/tests: `fire-orchestrator.mjs/.test.mjs`,
  `cockpit-settings-store.mjs/.test.mjs`, `cockpit-server.mjs/.test.mjs`, and
  `scripts/cockpit.mjs/.test.mjs`

The worktree was already substantially dirty, including concurrent model-
identity and Domain B UI changes. Those paths were preserved and were not
attributed to this Domain A review. This review wrote only this report; it did
not modify source, tests, or other reports.

## Design assessment

### 1. Single canonical profile authority — PASS

`apps/soul/agent/src/mind/fire-orchestrator.mjs:149–237` defines the legacy
conversation body, the exact four technical IDs, and
`resolveConversationInstructionProfile()`. Unknown IDs and malformed/empty
overrides return the Cody-compatible default profile; valid overrides remain
brain-local. `buildFireSystemPrompt()` places the generated registry identity
line before the effective editable body. The one-argument `FIRE_SYSTEM_PROMPT`
is reconstructed from the same builder and the focused test confirms byte
compatibility with the legacy default.

The Cockpit session path consumes the resolver-backed profile at session
creation (`apps/soul/agent/scripts/cockpit.mjs:785–825`). No second prompt
profile map or editable identity/memory path was found. CLI/measurement helpers
that import `FIRE_SYSTEM_PROMPT` retain the default behavior.

### 2. Additive persistence and validation — PASS

`apps/soul/agent/src/cockpit/cockpit-settings-store.mjs:138–182` uses a strict
read-modify-write path for the additive `conversationInstructions` key. Reads
accept both `{ version, overrides }` and the direct-map compatibility shape;
unknown IDs, malformed values, and trim-empty strings are ignored. Save/reset
validate the four IDs and reject empty bodies. The strict write returns only
after `writeFileSync` succeeds, allowing the runtime adapter to advance the
revision only after durable persistence (`cockpit.mjs:305–327`). Existing
settings keys retain their established failure-tolerant write path.

### 3. Fixed API and error style — PASS

`apps/soul/agent/src/cockpit/cockpit-server.mjs:897–955` implements exactly:

- `GET /api/conversation-instructions/:brainId`
- `PUT /api/conversation-instructions/:brainId` with `{ instruction: string }`
- `DELETE /api/conversation-instructions/:brainId`

The four IDs are checked before hook invocation. Malformed JSON, non-string
values, and trim-empty strings return JSON 400 errors. Successful operations
return `{ ok, brainId, instruction, isOverride, revision }`, where
`instruction` is the effective body. Durable save/reset failures return fixed
500 messages without echoing the request body. The route is served by the
existing loopback-only Cockpit server; no credential or provider path is
introduced.

### 4. Persistence-before-revision and next-Fire lifecycle — PASS

The adapter increments `createInstructionRevisionController()` only when the
store reports `true` after a strict write. A session records the revision used
to compose its system prompt (`cockpit.mjs:808–825`). Before a subsequent ask,
`ensureSessionCurrent()` disposes a stale session and clears it before
`ensureFireResources()` creates the replacement (`cockpit.mjs:835–851`).

The orchestrator's busy guard runs before the session proxy (`fire-orchestrator.mjs:880–915`), so saving while thinking/speaking does not dispose or
re-prompt the in-flight answer. Brain switching and memory toggling retain their
existing `dispose → null → next Fire` paths and now clear only the captured
instruction-revision marker (`cockpit.mjs:908–920, 975–997`). The player is not
reconstructed by an instruction refresh or brain switch.

### 5. Privacy and non-leak boundary — PASS

Instruction text is returned only by the dedicated route. The normal snapshot
continues to expose transcript/state/brain/memory data without an instruction
field (`cockpit-server.mjs:563–620`), and the route's fixed error handlers do
not include hook exception messages or request text. The server tests exercise
failed save/reset, state, transcript, and SSE non-leak cases. The system prompt
is composed only when a new session is created; no transcript, memory Markdown,
identity projection, usage payload, diagnostic, or log field is assigned the
editable body.

### 6. Identity, voice, memory, and operational-control boundaries — PASS

The generated identity comes from `resolveBrainIdentity()` at session creation,
while Whisper/scheduler/public identity projections use the same current
identity provider (`cockpit-server.mjs:727–739, 1524–1541`). No identity label
is derived from editable text. The scoped diff has no `src/voice/**`, package,
lockfile, Runtime Player, Editor, or contract changes. Fire, visual Fire,
self-fire, barge-in, verbosity, and KILL/revive remain outside the modal and
their existing server paths/tests remain intact. Memory prompt composition is
still the existing single `composeSystemPrompt()` call; instruction changes do
not rewrite history or memory.

## Verification evidence

Commands independently rerun in the shared worktree:

| Command | Result |
|---|---:|
| `node --check` on the 8 Domain A source/test files | exit 0 for all 8 |
| Worker-free Domain A tests (`--experimental-test-isolation=none`, one file at a time) | **310/310 passed**, 0 failed |
| Normal combined `node --test --test-concurrency=1` | exit 1; 4 files, 0 pass / 4 fail / 0 assertions, all pre-assertion `spawn EPERM` |
| `node scripts/check-soul-zone-boundary.mjs` | exit 0; 1,391 source files scanned, no boundary violations |
| `git diff --check` on the 8 reviewed paths | exit 0 (only existing LF→CRLF warnings) |

Worker-free file counts were 69/69 (`fire-orchestrator`), 44/44
(`cockpit-settings-store`), 73/73 (`scripts/cockpit`), and 124/124
(`cockpit-server`). The normal-runner result is an environment limitation,
not assertion evidence and not combined with the passing fallback counts.

Real provider/network/microphone/TTS/chat consumption and credential-content
reads: **0**.

## Residuals (non-blocking)

- The normal Node worker runner remains unavailable because child-worker spawn
  returns `EPERM`; the worker-free results are the valid mechanical evidence in
  this environment.
- The main `cockpit.mjs` process is exercised through pure/fake seams rather
  than a live provider session. The wave-level human gate still owns real
  save/reset → next-Fire and in-flight non-interruption observation.
- Concurrent model-identity and Domain B UI work remains dirty in the shared
  worktree; those domains retain their own ownership and review lanes.

No Gnome-targeted source fix is required from the design lane.
