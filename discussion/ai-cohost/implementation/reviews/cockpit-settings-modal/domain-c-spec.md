# Domain C spec review — conversation-instruction editor and UI integration

## Verdict

**PASS — loop 3 targeted re-review.** The loop-1 keyboard dirty-guard finding
and the loop-2 identity-authority finding are both closed. The current C
implementation keeps exactly four technical brains/API profiles, uses one
single modal pane-swap surface, and does not introduce a handwritten
brain-to-identity map. No source or test file was changed by this review; this
report is the only written artifact.

## Basis and scope

Reviewed independently:

- `.agents/skills/implementation-orchestration/SKILL.md`;
- `discussion/_conventions.md` and `discussion/_map.md`;
- `discussion/ai-cohost/implementation/orchestration/cockpit-settings-modal-wave-plan.md`;
- `discussion/ai-cohost/implementation/orchestration/model-identity-wave-plan.md`
  (the inherited single identity authority / no-second-mapping contract);
- Domain A/B completion reports and all available Domain A/B review lanes;
- `discussion/ai-cohost/implementation/waves/cockpit-settings-modal/domain-c.md`;
- the current Domain C UI/view-logic source, tests, and dirty-worktree diff.

The review preserves the shared dirty worktree and attributes unrelated
model-identity, Domain A, and Domain B paths to their existing owners.

## Acceptance review

### AC-01 — Modal migration and operational boundary

**PASS by source inspection and accepted Domain B evidence.** Domain C renders
the editor as a pane inside the existing single `role="dialog"
aria-modal="true"` surface (`settings-drawer.mjs:716–721`) and does not add a
nested dialog. The editor opens from the brain-conversation pane and exposes a
back affordance. Existing immediate settings controls and the external
ControlBar remain outside the C controller and are not reimplemented.

### AC-02 — Exact four-brain editable body and isolation

**PASS.** `conversation-instruction.mjs:14–19` defines exactly
`claude`, `codex`, `codex-55`, and `codex-56-sol`; the controller validates
responses against the requested ID and uses the dedicated encoded
`/api/conversation-instructions/:brainId` path. The controller keeps one
draft/baseline per technical ID, so editing or loading one profile does not
reuse another profile's body. Save/reset status explicitly says changes apply
from the next Fire. The editor exposes only the body textarea as editable;
identity and memory structure are read-only (`conversation-instruction-editor.mjs:46–81`).

### AC-03 — Canonical identity boundary, memory structure, and privacy

**PASS.** The former UI-owned `CONVERSATION_BRAIN_IDENTITY_PROJECTIONS` table
is gone. `conversationBrainIdentity()` (`conversation-instruction.mjs:26–47`)
passes through the runtime-provided identity only when
`brainId === activeBrainId` and the supplied identity has the canonical
`id`/`displayName` shape. It does not derive identity from `BRAIN_LABELS`, a
technical ID, or a Cody/Chappy table. For a non-active selected profile it
returns `null`; the editor renders the honest readonly text
`非アクティブ（identity は表示しません）` (`conversation-instruction-editor.mjs:12–17,46–80`).
Thus a Codex profile cannot falsely display the currently active Claude
identity, and the four-profile UI has no second identity authority.

The editor consumes only memory status/structure through
`memoryStatusLabel`; it does not render memory body, transcript, credentials,
or usage. The static UI contract rejects `memoryBody`/transcript terms in the
editor source (`cockpit-ui.test.mjs:667` onward). Domain A remains the owner
of persistence/API validation and the canonical server/registry identity
fact.

### AC-04 — Next-Fire behavior and unchanged immediate controls

**PASS by ownership/source inspection.** C calls only the dedicated save/reset
API and displays default/saved/next-Fire status. Session revision, stale
response disposal, in-flight preservation, and prompt ordering remain
Domain-A-owned. C does not dispose or re-prompt a Fire session. Existing
immediate settings and external controls remain on their existing paths.

### AC-05 — Accessibility and dirty-draft behavior

**PASS for the targeted C behavior, with mounted-DOM observations still a
human-gate residual.** The single dialog retains focus entry/containment,
return, Escape, backdrop, and inline-warning wiring. The keyboard handler
(`settings-drawer.mjs:407–421`) delegates Arrow/Home/End navigation through
`requestCategory(..., "category-keyboard")` (`:331–342`), which routes through
`runGuardedNavigation`; focus is deferred until clean acceptance or explicit
discard. The executable fake seam covers click/back/brain/header/Escape/
backdrop plus keyboard category routes (`cockpit-ui.test.mjs:572–648`).

### AC-06 — Scope, privacy, and zero consumption

**PASS.** The C-owned editor/controller paths add no package or lockfile
change and no `src/voice/**`, Runtime Player, Editor, provider, credential
content, or memory implementation change. Tests use injected fake fetch and
pure fixtures. Bounded fake-only observation recorded zero provider/network,
microphone, TTS, chat, credential-content, or real-settings-file reads.

## Loop history and finding closure

### C-SPEC-01 — Roving keyboard navigation bypassed dirty-close guard

**Closed in loop 2 and remains closed in loop 3.** The key handler now calls
`settingsModalKeyboardCategoryAction()` with an `onNavigate` callback that
invokes guarded `requestCategory()`. The fake seam verifies ArrowRight,
ArrowLeft, Home, and End and verifies a dirty keyboard category event prompts
before the pending action runs. No direct key-handler category mutation
remains.

### C-SPEC-02 — UI reintroduced a second handwritten brain→identity map

**Closed in loop 3.** The former projection constant and all four hardcoded
brain→Cody/Chappy values are absent from current source. The active selected
brain receives the existing `settings.brain.identity` fact from the current
snapshot; the helper passes it through only when the selected technical brain
matches the active brain. Any non-active selection returns `null` and displays
an explicit identity-suppression message. `BRAIN_LABELS` remains only the
pre-existing technical-label registry; it is not used as an identity source.
The focused source tests assert absence of the projection and hardcoded
mapping patterns and cover active/non-active behavior for all four IDs
(`conversation-instruction.test.mjs:32–49`,
`cockpit-ui.test.mjs:650–665`).

## Nonblocking residuals

1. No mounted browser DOM is available in this bounded review. Real focus
   return, Escape/backdrop rendering, and dirty-prompt visual behavior remain
   human-gate observations; the fake controller/event seams are not presented
   as a browser-mount substitute.
2. Non-active profiles intentionally show identity-unavailable text. The
   human gate should confirm that this Japanese wording is acceptable as an
   honest readonly system-managed structure.
3. Normal Node worker mode is unavailable in this managed environment; the
   raw `spawn EPERM` result is kept separate from worker-free assertions.

## Verification evidence

### Worker-free fake-only run

Fresh commands:

```text
node --test --experimental-test-isolation=none --test-concurrency=1 \
  apps/soul/agent/src/cockpit/view-logic/conversation-instruction.test.mjs \
  apps/soul/agent/src/cockpit/cockpit-ui.test.mjs \
  apps/soul/agent/src/cockpit/cockpit-page.test.mjs \
  apps/soul/agent/src/cockpit/cockpit-static-assets.test.mjs \
  apps/soul/agent/src/cockpit/view-logic/settings.test.mjs
```

Result: **exit 0, 88/88 passed, 0 failed/skipped/cancelled**. The focused
editor/UI rerun is **57/57 passed**, and the separate
control/status/health regression run is **34/34 passed**. These are
worker-free fake-only results and include the identity-authority and guarded
keyboard seams.

### Normal runner (separate environment limitation)

```text
node --test --test-concurrency=1 \
  apps/soul/agent/src/cockpit/view-logic/conversation-instruction.test.mjs \
  apps/soul/agent/src/cockpit/cockpit-ui.test.mjs \
  apps/soul/agent/src/cockpit/cockpit-page.test.mjs \
  apps/soul/agent/src/cockpit/cockpit-static-assets.test.mjs \
  apps/soul/agent/src/cockpit/view-logic/settings.test.mjs
```

Result: **exit 1; 5 file subtests, 0 pass / 5 fail / 0 assertions**. Every
file failed before assertions with `ChildProcess.spawn -> spawn EPERM`. This
is not assertion-level product failure and is not counted as green evidence.

### Guards

- `node --check` on the six C UI/view-logic source/test modules: **6/6 exit 0**.
- `git diff --check` on the C/UI target paths: **exit 0**, with only the
  existing LF→CRLF normalization warnings.
- `node scripts/check-soul-zone-boundary.mjs`: **exit 0**, 1,394 source files
  scanned, no boundary violations.
- Fake-only observed external/credential consumption: **0** provider,
  network, microphone, TTS, chat, credential-content, or real settings-file
  reads.

## Disposition

Domain C is **PASS for loop 3 targeted SPEC re-review**. C-SPEC-01 and
C-SPEC-02 are closed; AC-01..06 have no remaining C-owned specification
blocker. The lane is ready for the final mechanical/human gate, with the
worker `spawn EPERM` environment limitation and the non-mounted-DOM wording
check retained as residuals.
