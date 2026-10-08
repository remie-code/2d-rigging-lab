# GPT-6 Astra model choice — bounded implementation

Status: BOUNDED MACHINE PASS / HUMAN AUDIO ACCEPTANCE PASS (2026-09-08). Root/Undine owns this plan. User approved CLI compatibility probe, dependency update, and adding Astra to the existing model choice; subsequently confirmed operation/natural conversation and requested commit.

Result: [completion](../waves/gpt-6-astra-completion.md), [implementation evidence](../waves/gpt-6-astra-implementation.md), [independent review](../reviews/gpt-6-astra-review.md). One review pass, no blocking findings. Focused 461/461 independently reproduced, installed Astra two turns + Sol one turn completed. Human acceptance is recorded in completion. Broad 1063/1084 with 21 incompletely classified failures is not an overall pass; cleanup DB residuals remain unverified. Dependency installed; normal Cockpit restart, no build required.

## Desired experience and boundaries

- Cockpit's existing model selector offers GPT-6 Astra. Selecting it uses `gpt-6-astra` with reasoning `low`, GPT identity `チャッピー`, existing vision input and progressive speech.
- Existing selected/default brain and saved instructions are not migrated or overwritten. Astra has the same model-specific instruction editing/save/reset behavior as other entries, with the existing default instruction body.
- Apply selection/settings using the existing next-accepted-Fire boundary. Normal consecutive Fires keep the same session/thread; do not redesign session memory, speech queue, diagnostics, or audio.
- User's acceptance action is ordinary Cockpit restart, select Astra, and converse. They judge voice/conversation experience. Agents verify wiring and report machine evidence; no diagnostic UI or new user checklist surface.
- No Editor/Runtime changes, no global Codex/App update, no automatic commit, no unrelated dependency refresh, no personal settings edits.

## Evidence

- [Integration inventory](../../research/gpt-6-astra-integration-inventory.md): exact registry, API allowlist, labels, instruction-ID arrays and tests.
- [CLI compatibility probe](../../research/gpt-6-astra-cli-compatibility-probe.md): bundled 0.144.5 rejects Astra requiring newer Codex; isolated CLI 0.153.4 completes an image turn and same-thread continuation through the existing adapter. This is a working candidate, not a claim of minimum supported version or semantic vision/memory quality.
- [Official reasoning inventory](../../research/gpt-6-astra-reasoning-inventory.md): model ID/low and API modality baseline, distinct from subscription runtime evidence.

## One implementation wave / one domain

Dependency update and model-choice wiring are related and small enough for one Gnome context. No parallel source owners.

1. Resolve the Soul agent's existing `@openai/codex-sdk` dependency to the verified 0.153.4 family and update its local package lock/install. Confirm the resulting bundled executable version. Keep unrelated dependencies unchanged; do not substitute an unverified newer version.
2. Add technical brain ID `codex-astra`, label `GPT-6 Astra`, model `gpt-6-astra`, effort `low`, shared Chappy identity. Add the necessary API/UI/instruction IDs and existing fixed-list test expectations. Keep defaults and existing IDs unchanged.
3. Run focused checks and installed-binary smoke; then one independent review and fixes only for concrete task failures.

## Ownership and orchestration

- L0 Undine: plan, dispatch, report integration, maps. No source implementation/deep review.
- L1 Orch-Sylph: one domain, work coordination and completion report; source edits delegated to Gnome.
- L2 Gnome: `apps/soul/agent/` relevant package/lock/source/test changes and implementation evidence only. Others are working in the repository: preserve all unrelated changes; do not revert others' edits.
- L2 Review-Sylph: independent targeted diff/source/evidence review, no source edits; write verdict file.
- Use inherited model settings for Orch-Sylph/Gnome/Review-Sylph; Luna remains the bounded inventory role. Do not override models or expand review lanes.
- Every child call includes `[subagent-call] 呼び出し元: Undine` or `Sylph` as appropriate. Parents wait with `wait_agent`; timeout is not failure. Do not interrupt normal child work.
- Orch-Sylph自身は実装担当ではない。source implementation は必ず別コンテキストの Gnome に委譲し、レビューは必ず別コンテキストの Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。

## Proportional verification and review

One review unit is the visible selection → saved choice/instruction → next Fire → correct model/identity/session route. Review actual inputs, state changes and outputs, not hypothetical future features.

- Focused tests: registry exact model/effort/identity; all labels and API choice acceptance; instructions save/load/reset for Astra and preservation of existing entries; existing next-Fire lifecycle tests; App Server adapter/subscription env tests after dependency update.
- Existing broad Soul worker-free suite may run once if practical. No whole-monorepo builds, mutation campaign, multi-platform matrix, exhaustive malformed-wire tests, or new generalized validation for this change.
- Installed-binary bounded smoke: Astra low image turn plus same-thread second turn (short synthetic nonce, record only expected-match boolean if checked, not conversation content), delta counts/final consistency; one short Sol low turn as shared-CLI regression. At most three successful turns, plus a bounded retry for a concrete transient failure. Keep subscription auth and read-only settings; use self-made image, isolated cwd/ledger, never user screen or personal settings. No actual audio playback required from agents.
- Do not use `model/list` absence as a gate if a direct known model turn works. Do not claim semantic image/memory quality merely from protocol completion.
- Blocking findings: Astra cannot be selected/persisted/routed, wrong identity/effort, existing selection/instructions broken, CLI not installed/resolved as intended, actual adapter regression, unauthorized scope changes. Style preferences and speculative hardening are nonblocking notes.
- Target one review pass, normally 1–2 correction cycles, reconsider at 3; 5 is emergency ceiling only, not a quota. Escalate meaningful product/scope choices or new transport architecture requirements without implementing them.

## Durable outputs

Orch owns `../waves/gpt-6-astra-completion.md`; Gnome owns `../waves/gpt-6-astra-implementation.md`; reviewer owns `../reviews/gpt-6-astra-review.md`. Include changed files, exact commands/counts, candidate/installed versions, real-turn observations versus unknowns, cleanup/residuals, and verdict. Root links completion/review from this plan and registers the plan in the orchestration map. Historical reports are unchanged.

## Completion

Machine completion requires scoped implementation, passing relevant tests and independent review, installed CLI evidence. Human audio/quality acceptance is separate and remains for ordinary use. Final handoff states restart/build requirements from the actual setup; do not restart the user's running Cockpit or claim a rebuild is needed without evidence.
