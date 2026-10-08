# Cockpit Settings Modal / Model Conversation Instructions Wave Plan

> Status: **Mechanically complete / human gate pending (2026-08-20)**. Domain implementation and reviews are complete, the mechanical gate is PASS, and the human gate remains PENDING.
> Positioning: replace the overgrown Settings Drawer with one Cockpit Settings modal, and add per-brain editable conversation-instruction bodies. This is a Cockpit setting; it is not a persona, identity, TTS, memory, transcript, provider, or model-registry redesign.
> Orchestration: **L0 Undine / L1 single Orch-Sylph / L2 Gnome + independent Review-Sylph**. Domain A ∥ Domain B → Domain C → final mechanical gate → separate human gate.

## 1. Basis

This plan records the user decisions reached on 2026-08-09. The inventory records repository facts; it does not itself make product decisions.

- current control/persistence inventory: [01-current-settings-inventory.md](../../../reports/cockpit-settings-modal-inventory/01-current-settings-inventory.md)
- model-identity inventory and final review: [10-inventory-integration.md](../../../reports/ai-cohost-model-identity-inventory/10-inventory-integration.md), [20-final-review.md](../../../reports/ai-cohost-model-identity-inventory/20-final-review.md)
- model-identity implementation closeout: [final-closeout.md](../waves/model-identity/final-closeout.md)
- existing Cockpit redesign record: [cockpit-redesign-wave-plan.md](cockpit-redesign-wave-plan.md)
- orchestration rules: `.codex/skills/implementation-orchestration/SKILL.md`

Repository facts relied on here:

- the current drawer is a single scrollable, always-mounted panel with four sections and no internal navigation;
- current configuration is file-backed by ten existing keys, while Fire, visual Fire, self-fire, barge-in, verbosity, and KILL are separate runtime/safety surfaces;
- Fire sessions are long-lived across normal Fire calls; their system prompt is composed when the session is created;
- the selected brain already persists and switches through `dispose() → session = null → next Fire creates a session`;
- current model identity is a frozen resolver; public `brain.identity` exposes only the current `{ id, displayName }` pair;
- normal Node worker test runs can fail before assertions with `spawn EPERM`; worker-free evidence must be kept separate.

## 2. Accepted decisions

1. The current Settings Drawer is replaced by one **Cockpit Settings** modal. It is one dialog, not a drawer and not nested dialogs.
2. Modal navigation is internal tab/page switching, with four top-level categories: **接続**, **入出力**, **頭脳・会話**, and **記憶**.
3. The existing modal-external operating surface remains external: Fire, Fire+視覚, self-fire, barge-in, verbosity, and KILL/revive. No part of this wave moves, renames, or changes their existing API/semantics.
4. Existing settings retain their current individual behavior: each action/toggle saves and takes effect immediately. The modal does not introduce a global Save/Cancel transaction.
5. Conversation instruction is the sole drafting exception. It is editable **per technical brain ID** (`claude`, `codex`, `codex-55`, `codex-56-sol`), saved explicitly, and affects the new session used by the next Fire.
6. The editable text is the conversation-instruction body only. The generated Cody/Chappy identity line and optional memory injection are visible as system-managed structure and cannot be edited in this UI.
7. A save never changes an in-flight answer. It records a new instruction revision; before the next Fire creates or reuses a session, a stale session is disposed and a new session is created with the saved instruction. The current answer completes under its original prompt.
8. Each brain starts with the existing default conversation body. A brain-specific custom body replaces that default for that brain only. **既定へ戻す** removes the override and returns to the exact current default body.
9. The editable instruction and its text are not added to transcript entries, transcript/usage SSE payloads, memory Markdown, `brain.identity`, or the normal `/api/state` snapshot. A dedicated local Cockpit API supplies it to the editor.
10. This wave is scoped to Cockpit-run Fire sessions. Existing CLI/measurement helpers that directly import the default prompt retain their current default behavior unless a later, explicit wave expands the setting boundary.

## 3. Target UX and exact state boundaries

### 3.1 One modal, no nesting

The header gear opens a labelled dialog. The dialog contains its own category tabs; choosing **頭脳・会話** and then **会話指示を編集** swaps the content pane within the same dialog, with a back affordance. It never opens a second modal.

```text
Cockpit Settings
  [接続] [入出力] [頭脳・会話] [記憶]

頭脳・会話
  頭脳: GPT-5.6 Terra       [会話指示を編集]

会話指示
  ← 頭脳・会話
  GPT-5.6 Terra / チャッピー
  system-managed: identity + memory (read-only)
  [ model-specific conversation instruction editor ]
  [既定へ戻す] [保存して次のFireから反映]
```

### 3.2 Modal interaction contract

- Header gear is the trigger and accurately exposes expanded state.
- The dialog has a programmatic label, `role="dialog"`, `aria-modal="true"`, focus entry, focus containment, and focus return to the trigger on close.
- Escape and backdrop close the modal only when no instruction draft is dirty. A dirty prompt presents an inline discard/continue choice within the same dialog; it does not open a nested confirmation dialog.
- The current first-run auto-open predicate remains semantically equivalent, but opens the modal rather than a drawer.
- Existing select/input local state must not be lost merely by changing a modal tab or closing/reopening an otherwise unmodified modal.
- Immediate existing controls keep their present POST/save semantics and status/error feedback. Only the instruction editor owns a draft/Save/reset state.

### 3.3 Prompt profile contract

One canonical prompt-profile resolver owns:

```text
technical brain ID
  → default conversation instruction body
  → optional saved override
  → effective conversation instruction body
```

- File-backed persistence is one additive, version-tolerant key holding overrides by valid brain ID. Missing/corrupt/unknown entries fall back to the existing default body; no existing key changes meaning.
- The saved value is a plain instruction string. Empty or malformed values must not silently erase the default; reset removes the per-brain override explicitly.
- The effective Fire prompt remains ordered as: **generated identity line → effective conversation instruction body → optional memory section**.
- A dedicated loopback Cockpit API reads/writes/resets selected-brain instructions. It validates the existing four IDs and does not return instruction text in `/api/state` or SSE.
- The profile editor shows the selected brain's technical label and current Cody/Chappy identity, but it never derives either from the label; both come from existing server/registry state.
- A preview may show fixed structure and the editable body, but never reveals memory-body content. It may show memory enabled/count status only.

### 3.4 Session revision contract

- Saving/resetting an instruction increments an in-process effective-instruction revision after durable persistence succeeds.
- Every newly started Fire compares the revision used to create its current session with the effective revision. If stale, it disposes that stale session and creates a new one before asking.
- Saving/resetting during thinking/speaking only marks the revision stale; it never disposes, relabels, or re-prompts the in-flight request. The next Fire sees the new session.
- Existing brain selection and memory-toggle lifecycle behavior is not weakened or rewritten by this revision path.

## 4. Acceptance criteria

### AC-01 — Modal migration without operational regression

- There is no Settings Drawer UI. Header gear opens one accessible Cockpit Settings modal.
- Connection, input/output, brain, and memory controls are present in the four named internal categories and retain their current endpoints, validation, persistence, defaults, status, and immediate effect.
- The first-run auto-open condition remains behaviorally equivalent.
- Fire, visual Fire, self-fire, barge-in, verbosity, KILL/revive, and all adjacent observation remain modal-external and behaviorally unchanged.

### AC-02 — Per-brain editable conversation body

- Each of the four valid brain IDs has an independently resolvable instruction body.
- A default/no-override resolution is byte-compatible with the current default body for the current Cockpit Fire path.
- Saving a custom body affects only the selected brain; reset returns only that brain to default.
- Identity and memory text are read-only system layers. No user path edits names, `brain.identity`, memory content, provider/model settings, TTS, or persona through this feature.

### AC-03 — Persistence and privacy boundary

- Overrides survive Cockpit restart through an additive file-settings key; missing/corrupt/unknown values safely fall back without breaking existing settings.
- Dedicated instruction API validates brain IDs and rejects malformed requests.
- Instructions never appear in `/api/state`, SSE state/transcript/usage payloads, transcript/history, memory files, diagnostics, or logs.
- No credentials or credential contents are read or exposed.

### AC-04 — Next-Fire behavior

- Repeated normal Fires retain the same session and prompt revision until a brain/memory/instruction boundary changes it.
- Saving/resetting at idle preserves the existing session until the next Fire, then the next Fire uses a newly created session with the new effective instruction.
- Saving/resetting during thinking/speaking leaves that answer intact; the following Fire, not the in-flight answer, uses the new instruction.
- Existing brain switch remains `dispose → null → next Fire`; transcript/history/memory entries are never rewritten or re-attributed.

### AC-05 — Accessibility and interaction

- Tab navigation, focus entry/containment/return, Escape, backdrop behavior, close control, and dirty-draft behavior are tested.
- Existing immediate setting controls do not acquire accidental global Save/Cancel semantics.
- Instruction editor errors, saved/default status, reset, and `次のFireから反映` state are clear without relying on color alone.

### AC-06 — Boundaries and consumption

- No dependency, lockfile, package, Runtime Player, Editor, contract, `src/voice/**`, identity vocabulary, matcher, or ASR change is introduced.
- No live provider, network, microphone, TTS, chat, credential-content, or user settings-file read is used for machine verification.

## 5. Dependency graph and ownership

```text
Wave 1 (parallel, disjoint ownership)
  Domain A — prompt profile persistence/API/revision runtime
  Domain B — settings modal shell and existing-control migration
                 │                  │
                 └──── both PASS ───┘
                           │
Wave 2                    ▼
  Domain C — profile editor, server/UI integration, end-to-end fake tests
                           │
                           ▼
  Final mechanical review → separate human gate
```

Domain A and B start only with disjoint ownership. Domain C starts only after both domains have spec/design/test PASS. It is the sole owner of the editor integration and may not reimplement A's profile resolver or B's modal shell.

## 6. Domain assignments

### Domain A — Prompt profile, persistence, API, and session revision

Candidate owned files:

- `apps/soul/agent/src/mind/fire-orchestrator.mjs` and test
- `apps/soul/agent/src/cockpit/cockpit-settings-store.mjs` and test
- `apps/soul/agent/src/cockpit/cockpit-server.mjs` and test
- `apps/soul/agent/scripts/cockpit.mjs` and test
- completion: `discussion/ai-cohost/implementation/waves/cockpit-settings-modal/domain-a.md`

It creates the single prompt-profile resolver, additive persistence/API, and next-Fire revision lifecycle. It does not edit UI/modal files, operational controls, identity definitions, memory implementation, or voice.

Persistent reviews:

- `discussion/ai-cohost/implementation/reviews/cockpit-settings-modal/domain-a-spec.md`
- `discussion/ai-cohost/implementation/reviews/cockpit-settings-modal/domain-a-design.md`
- `discussion/ai-cohost/implementation/reviews/cockpit-settings-modal/domain-a-test.md`

### Domain B — Accessible Cockpit Settings modal

Candidate owned files:

- `apps/soul/agent/src/cockpit/ui/settings-drawer.mjs` (replace/remove only through a scoped migration)
- new modal UI module(s) under `apps/soul/agent/src/cockpit/ui/`
- `apps/soul/agent/src/cockpit/ui/app.mjs`
- `apps/soul/agent/src/cockpit/ui/header.mjs`
- `apps/soul/agent/src/cockpit/ui/styles.mjs`
- `apps/soul/agent/src/cockpit/view-logic/settings.mjs` and test
- `apps/soul/agent/src/cockpit/cockpit-ui.test.mjs`
- `apps/soul/agent/src/cockpit/cockpit-page.test.mjs`
- `apps/soul/agent/src/cockpit/cockpit-static-assets.test.mjs` only if module assets change
- completion: `discussion/ai-cohost/implementation/waves/cockpit-settings-modal/domain-b.md`

It migrates all existing drawer controls into the four-category accessible shell and preserves immediate behavior. It must leave the prompt-editor content as an explicitly bounded placeholder/slot; it does not add profile APIs, persistence, or session logic.

Persistent reviews:

- `discussion/ai-cohost/implementation/reviews/cockpit-settings-modal/domain-b-spec.md`
- `discussion/ai-cohost/implementation/reviews/cockpit-settings-modal/domain-b-design.md`
- `discussion/ai-cohost/implementation/reviews/cockpit-settings-modal/domain-b-test.md`

### Domain C — Model conversation-instruction editor and final UI integration

Candidate owned files:

- Domain B's modal module(s) and their UI tests, after Domain B passes
- `apps/soul/agent/src/cockpit/ui/app.mjs` only as needed for editor requests/state
- new pure view logic/test modules under `src/cockpit/view-logic/` as needed
- `apps/soul/agent/src/cockpit/cockpit-ui.test.mjs`
- completion: `discussion/ai-cohost/implementation/waves/cockpit-settings-modal/domain-c.md`

It consumes Domain A's dedicated API and Domain B's shell. It supplies per-brain selection, draft/save/reset, readonly identity/memory structure preview, next-Fire status, and dirty close behavior. It must not introduce a second prompt resolver, change existing immediate-setting behavior, or change server/runtime/profile files without returning the finding to Domain A.

Persistent reviews:

- `discussion/ai-cohost/implementation/reviews/cockpit-settings-modal/domain-c-spec.md`
- `discussion/ai-cohost/implementation/reviews/cockpit-settings-modal/domain-c-design.md`
- `discussion/ai-cohost/implementation/reviews/cockpit-settings-modal/domain-c-test.md`

## 7. Verification matrix

| Class | Required evidence | Real consumption |
|---|---|---:|
| Profile unit | four-ID default/override/reset/fallback, malformed rejection, persistence compatibility | 0 |
| Runtime integration | repeated Fire shares session; saved idle/busy instruction affects only next Fire; memory/brain behavior unchanged | 0 |
| Server | instruction API validation; no prompt body in snapshot/SSE/transcript/usage; existing endpoints unchanged | 0 |
| Modal UI | tab/page switching, retained immediate settings behavior, editor draft/save/reset, dirty close, focus and keyboard behavior | 0 |
| Regression | existing store/server/cockpit/UI/view-logic suites; external control bar unchanged | 0 |
| Guard | `check:soul-zone`, diff scope, `src/voice/**` unchanged, package/lockfile unchanged, zero provider/network/credential content | 0 |
| Human | real Cockpit settings use, prompt save→next Fire behavior, in-flight non-interruption, reset and modal keyboard/focus | user-run |

If a normal Node test command fails before assertions with `spawn EPERM`, record the raw command, exit and file counts as an environment limitation. It is neither an assertion failure nor green evidence. Run the repository-established worker-free fallback where applicable, keep runner counts separate, and do not add historical counts to current results.

Machine work uses fakes/injection only. It makes zero real provider/network/microphone/TTS/chat calls and zero credential-content reads.

## 8. Review policy and orchestration contract

Each domain receives three independent Review-Sylph lanes:

1. **Spec** — accepted decisions, ACs, scope and non-goals.
2. **Design** — single profile authority, lifecycle, privacy, accessibility, owned-file boundaries, and no operational-control regression.
3. **Test** — positive/negative coverage, fake-only proof, raw results, EPERM classification, and regression adequacy.

Every review writes its assigned persistent report. Blocking findings return only to the owning Gnome, then trigger targeted re-review of affected lanes. A domain cannot pass until all three lanes pass. Loop cap: five; a new product choice or unresolved cross-owner dependency escalates to L0 immediately.

Roles:

- **L0 Undine** owns this plan, accepted decisions, dependency gates, user discussion, and final status. L0 does not implement source or substitute for delayed children.
- **L1 single Orch-Sylph** runs A ∥ B → C, owns orchestration evidence and final closeout, and never implements source.
- **L2 Gnome** owns only its assigned source/tests and completion report.
- **L2 Review-Sylph** owns exactly one independent review report and never fixes source.

Every L1 assignment includes this exact rule:

> Orch-Sylph自身は実装担当ではない。source implementation は必ず別コンテキストの Gnome に委譲し、レビューは必ず別コンテキストの Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。

Call prefixes are mandatory:

- Undine → Orch-Sylph: `[subagent-call] 呼び出し元: Undine`
- Orch-Sylph → Gnome / Review-Sylph: `[subagent-call] 呼び出し元: Sylph`

Wait timeouts are polling only. No parent may interrupt or replace a live child because it is slow. All agents preserve the shared dirty worktree, edit only assigned paths, never revert other work, and neither stage nor commit.

## 9. Mechanical and human gates

### Mechanical gate

Persistent report:

`discussion/ai-cohost/implementation/reviews/cockpit-settings-modal/final-mechanical.md`

PASS requires 3/3 completion reports, 9/9 review-lane PASS, zero blocking findings, raw verification results, all ACs machine-checked where possible, and diff/consumption/forbidden-path evidence. It records every nonblocking residual with owner.

### Human gate

Persistent checklist/result:

`discussion/ai-cohost/implementation/waves/cockpit-settings-modal/human-gate.md`

The user separately verifies:

1. Header gear opens an accessible, usable modal; tabs, close, Escape, backdrop, focus return, and dirty-prompt behavior feel correct.
2. Connection, input/output, brain, and memory controls remain usable and retain their immediate behavior.
3. Fire/visual Fire/self-fire/barge-in/verbosity/KILL remain visible outside the modal and operate as before.
4. For one Claude and one GPT brain, edit/save a distinct instruction, complete any current answer, then verify the next Fire reflects only the selected brain's saved body.
5. Reset returns the selected brain to default; other brains remain untouched; identity/memory remain system-managed and historical transcript/memory are unchanged.

Real microphone Chappy pronunciation/alias tuning is not a requirement of this wave; it remains a separate deferred human observation.

## 10. Final closeout

Persistent closeout:

`discussion/ai-cohost/implementation/waves/cockpit-settings-modal/final-closeout.md`

It links all three completion reports, nine lane reports, final mechanical report, and human gate. It records domains/reviews/loops, changed files, raw test/guard counts, EPERM separately, API/privacy/diff invariants, zero-consumption evidence, mechanical `PASS|FAIL|BLOCKED`, and human `PENDING|PASS|FAIL`.

The wave may be **mechanically complete / human gate pending**. It is fully closed only after the human gate passes.

## 11. Launch packet

The L0 launch supplied this plan, its basis artifacts, the accepted decisions, A ∥ B → C dependency, ownership lists, three review lanes per domain, loop/wait rules, zero-consumption rule, and persistent report paths; L1 completed the bounded preflight and orchestration without re-inventorying or redesigning the accepted UX.

## 12. Current status

- Plan: mechanically complete; human gate pending.
- Domain A/B/C: implementation complete/PASS — A loop 2; B targeted review history final PASS (Spec/Test loop 3, Design loop 2); C loop 3.
- Completion reports: **3/3**.
- Review lanes: **9/9 PASS**.
- Mechanical gate: **PASS** — [final-mechanical.md](../reviews/cockpit-settings-modal/final-mechanical.md).
- Human gate: **PENDING** — separate user-run verification remains.
- Loop history: A=2; B targeted review history final PASS (Spec/Test=3, Design=2); C=3.
- Blockers: **0**.
- Planning blockers: none under §2.
