# AI Cohost Model Identity Wave Plan: Claude=コーディ / GPT=チャッピー

> Status: **Ready to launch（2026-08-09）**。実装未着手。機械ゲートと人間ゲートは未実施。
> Positioning: brain swap の上に「現在の頭に対応する魂名」を載せる小さな追撃 wave。provider/model、persona、voice、履歴 attribution の再設計は行わない。
> Orchestration: **L0 Undine / L1 single Orch-Sylph / L2 Gnome / L2 Review-Sylph**。Domain A → (Domain B ∥ Domain D) → Domain C の3段階。

## 1. Basis

実装・レビュー・最終判定は次を basis とする。inventory は実装前の repo facts と当時の未決事項を保存する証拠であり、**2026-08-09 にユーザーとの認識合わせで閉じた §2 が、この wave における決定の正本**である。inventory 時点の未決表示は §2 により解消されており、別の決定artifactや計画レビューを起動条件にしない。

- inventory contract: `discussion/reports/ai-cohost-model-identity-inventory/inventory-contract.md`
- primary inventory: `discussion/reports/ai-cohost-model-identity-inventory/01-fixed-name-and-identity-flow.md` から `04-ui-contracts-and-tests.md`
- integrated inventory: `discussion/reports/ai-cohost-model-identity-inventory/10-inventory-integration.md`
- inventory final review: `discussion/reports/ai-cohost-model-identity-inventory/20-final-review.md`（PASS、blocking 0 / nonblocking 0）
- existing lifecycle: `discussion/ai-cohost/implementation/orchestration/brain-swap-wave-plan.md`
- orchestration precedent: `discussion/ai-cohost/implementation/orchestration/c1-wave-plan.md`
- orchestration rules: `.codex/skills/implementation-orchestration/SKILL.md`

Repository facts used by this plan:

- current fixed name is split across Fire prompt, Whisper lexical bias, voice/comment call matching, Cockpit title/header, operational disclosure, and their tests;
- `BRAINS` has four entries and no soul identity field;
- swap is persist selection → `dispose()` → `session=null` → lazy creation on next Fire;
- transcript/history speaker remains `soul`; memory is plain Markdown; neither stores soul-name provenance;
- normal `node --test` may fail before assertions with environment-origin `spawn EPERM`, while worker-free selected imports previously passed 360/360;
- current direct soul-zone guard passed on 1,389 files, but this is only an import-direction result.

## 2. Accepted decisions

> Decision authority: 2026-08-09 のユーザー決定を Undine が本計画へ記録したもの。以下は planning hypothesis ではなく、この wave の accepted decision である。

1. Identity granularity is **model family**:
   - Claude family = `コーディ` / `Cody`
   - GPT family = `チャッピー` / `Chappy`
2. Identity is a **registry-defined fixed default**. There is no user-editable alias or settings migration.
3. Brain swap keeps the existing lifecycle. The selected identity becomes the self-name of the **new session created for the next Fire**. An old/in-flight response is not re-attributed or rewritten.
4. Transcript, SSE transcript history, memory, and persisted history schemas are unchanged. No historical text or file is rewritten.
5. Only current surfaces that presently treat the soul as Cody become family-aware: self-name prompt, Whisper prompt, voice/comment call matching, Cockpit title/header, current operational disclosure, and their fixtures/tests.
6. Persona, TTS speaker/voice, viewer `displayName`, technical brain labels/raw IDs, per-model override, in-flight attribution, and identity persistence are independent and out of scope.

The UI state carries a **current, non-historical, additive public identity view** needed by title/header. Its exact wire shape is `state.brain.identity = { id: "cody" | "chappy", displayName: "こーでぃー" | "チャッピー" }`. The server always derives it from the same registry resolver used by the selected brain; UI code must not derive family/name independently. Missing or malformed identity data renders the neutral fallback `Soul Cockpit`, never a stale Cody/GPT claim. It must not be added to transcript entries, usage entries, memory files, or settings. Selection acknowledgement may update title/header immediately because it displays the newly selected current brain; behavioral self-name is fixed when the next Fire creates its session.

## 3. Exact identity contract and four-brain mapping

The implementation may choose exact symbol/file names, but it must expose one frozen identity contract/resolver with these values and no second handwritten mapping.

| Identity | Canonical name | Latin name | Cockpit display | Whisper prompt | Voice-call variants | Comment-call variants |
|---|---|---|---|---|---|---|
| Cody | `コーディ` | `Cody` | `こーでぃー` | `こーでぃー、コーディ。` | existing four: `コーディ`, `コーディー`, `コーティ`, `コーティー` | existing eight: `Cody`, `cody`, `CODY`, the four voice forms, `こーでぃー` |
| Chappy | `チャッピー` | `Chappy` | `チャッピー` | `ちゃっぴー、チャッピー。` | `チャッピー`, `ちゃっぴー` | `Chappy`, `chappy`, `CHAPPY`, `チャッピー`, `ちゃっぴー` |

Chappy の variant set は、この wave で採用する Undine technical default である。Misrecognition aliases must not be invented without observed evidence. Adding an alias beyond the table is a reviewed follow-up change and must be escalated. Existing generic normalization remains; `CoDy`/`ChApPy`-style unlisted mixed-case spellings need not become accepted.

| Brain ID | Existing technical label | Family | Soul identity |
|---|---|---|---|
| `claude` | `Claude (Opus 4.8)` | Claude | Cody |
| `codex` | `Codex (GPT-5.6 Terra)` | GPT | Chappy |
| `codex-55` | `Codex (GPT-5.5)` | GPT | Chappy |
| `codex-56-sol` | `Codex (GPT-5.6 Sol)` | GPT | Chappy |

Unknown/absent persisted brain values continue the existing Claude fallback and therefore resolve to Cody. API unknown-value rejection remains unchanged.

## 4. Acceptance criteria

### AC-01 — Single identity authority

- One frozen contract/resolver owns the values in §3.
- Each of the four `BRAINS` entries resolves to exactly the identity in §3.
- UI, prompt, Whisper, and scheduler receive values through this contract/current-brain wiring; they do not introduce a second four-brain-to-name table.
- Existing brain IDs, technical labels, model/effort, credential paths, selection persistence, and API validation are unchanged.

### AC-02 — Prompt and next-Fire lifecycle

- Default/Claude `FIRE_SYSTEM_PROMPT` remains behaviorally equal except that its Cody line is now produced by the identity-aware prompt builder.
- All three GPT brains receive `あなたの名前はチャッピー（Chappy）です。` in the session prompt.
- On `claude → GPT` and `GPT → claude`, the current session is disposed and nulled as today; only the session lazily created by the next Fire receives the new identity.
- No in-flight response, transcript row, memory file, or old session is renamed or re-attributed.

### AC-03 — Input name seams

- Every Whisper request resolves the prompt from the current identity at request time; changing brain does not require process or ear restart.
- Scheduler voice and comment matching resolve the current identity at handling time; changing brain does not require scheduler recreation.
- Under Claude, Cody variants match and Chappy variants do not. Under GPT, Chappy variants match and Cody variants do not.
- Existing OFF/busy/refractory, soul-self-call exclusion, comment handling, normalization, and false-positive behavior remain unchanged.

### AC-04 — Current Cockpit identity

- The public wire shape is exactly `state.brain.identity = { id: "cody" | "chappy", displayName: "こーでぃー" | "チャッピー" }`, additive to the current snapshot and derived server-side from the single registry resolver.
- Claude snapshot/selection renders `こーでぃー`; each GPT snapshot/selection renders `チャッピー` in the header and document title.
- Before state is known, or when identity is missing/malformed, header and document title use the neutral fallback `Soul Cockpit`; they do not show a stale fixed GPT/Cody claim.
- Domain D consumes this exact fake shape while Domain C owns its real server wiring. Domain D must not keep an independent brain/name table.
- Existing technical brain select labels and latency/usage raw IDs remain visible and unchanged.
- Current identity state is additive and public-display-only. No credential content/path or provider-private metadata is exposed.

### AC-05 — Operational disclosure

- `pre-stream-checklist.md` provides explicit copy-ready disclosure/checklist wording for both Cody/Claude and Chappy/GPT, or a single unambiguous selection-dependent template.
- It must not claim that TTS voice/persona changes with the brain. Existing AI-generated voice and memory/privacy disclosure remains semantically intact.
- Historical wave reports, experiment records, and ordinary source comments are not mechanically rewritten.

### AC-06 — Compatibility and non-goals

- Transcript entry, transcript SSE event, usage event, memory Markdown, settings schema, viewer `displayName`, TTS speaker, persona, technical brain IDs/labels, and provider adapters do not gain identity fields or behavioral changes.
- `src/voice/**` remains unchanged. A fake-only regression proves that Claude/GPT selection does not reconstruct, replace, or mutate the configured TTS dependency/speaker.
- `apps/soul` special-zone boundaries remain valid; no vessel/Runtime Player/Editor import is added.
- No dependency or lockfile change, install, stage, commit, live provider call, credential read, or networked machine test is performed by this wave.

## 5. Dependency graph and launch gates

```text
Wave 1
  Domain A — Identity contract/resolver + four registry bindings
      |
      +-------------------+
      v                   v
Wave 2
  Domain B — Input seams  Domain D — UI/current disclosure
  (Whisper/scheduler)     (fake current identity contract)
      +-------------------+
                  |
                  v
Wave 3
  Domain C — currentBrain wiring, prompt lifecycle, cross-surface integration
                  |
                  v
  Final mechanical gate → separate human gate
```

Domain B and D may run concurrently only after Domain A has **all three review lanes PASS**. Their owned files do not overlap. Domain C starts only after B and D both pass all three lanes and owns the shared composition/server integration. No later domain may silently repair an earlier domain outside its ownership; it sends the finding back to that domain for a targeted fix and re-review.

## 6. Domain A — Identity contract/resolver

Suggested assignment: `model-identity-domain-a`.

### Candidate owned files

- new `apps/soul/agent/src/mind/model-identity.mjs`
- new `apps/soul/agent/src/mind/model-identity.test.mjs`
- `apps/soul/agent/src/mind/brains.mjs`
- `apps/soul/agent/src/mind/brains.test.mjs`
- completion report: `discussion/ai-cohost/implementation/waves/model-identity/domain-a.md`

Names may change only if the Gnome reports the reason before expanding ownership. Domain A must not edit prompt, ears, scheduler, Cockpit UI/server, operations docs, memory, TTS, or maps.

### Deliverables

- frozen Cody/Chappy definitions with the exact values in §3;
- resolver/binding for all four brain IDs, retaining Claude fallback behavior;
- no duplication of technical brain labels or provider/model logic;
- focused unit tests for exact mapping, freeze/immutability, exact variants, and unknown/absent fallback;
- Gnome completion report with changed files, commands, raw counts, consumption evidence, and deviations.

### Persistent reviews

- spec: `discussion/ai-cohost/implementation/reviews/model-identity/domain-a-spec.md`
- design: `discussion/ai-cohost/implementation/reviews/model-identity/domain-a-design.md`
- test: `discussion/ai-cohost/implementation/reviews/model-identity/domain-a-test.md`

## 7. Domain B — Dynamic input seams

Suggested assignment: `model-identity-domain-b`.

### Candidate owned files

- `apps/soul/agent/src/ears/whisper-inference.mjs`
- `apps/soul/agent/src/ears/whisper-inference.test.mjs`
- `apps/soul/agent/src/ears/ear-pipeline.mjs`
- `apps/soul/agent/src/ears/ear-pipeline.test.mjs`
- `apps/soul/agent/src/mind/fire-scheduler.mjs`
- `apps/soul/agent/src/mind/fire-scheduler.test.mjs`
- completion report: `discussion/ai-cohost/implementation/waves/model-identity/domain-b.md`

Domain B must not edit `cockpit-server.mjs`, `scripts/cockpit.mjs`, prompt builder, UI, disclosure, registry, memory, or TTS. It prepares generic injectable runtime seams; Domain C supplies `currentBrain`-backed providers.

### Deliverables

- an explicit request-time Whisper prompt provider while preserving literal `options.prompt` and default behavior;
- explicit handling-time voice/comment variant providers while preserving current literal-array options and defaults;
- mutable-fake tests proving provider changes take effect without recreating inference/scheduler;
- negative tests proving old-family names do not match the newly active family;
- unchanged Whisper response authority: prompt text never becomes transcript text unless returned by the server;
- completion report at the path above.

### Persistent reviews

- spec: `discussion/ai-cohost/implementation/reviews/model-identity/domain-b-spec.md`
- design: `discussion/ai-cohost/implementation/reviews/model-identity/domain-b-design.md`
- test: `discussion/ai-cohost/implementation/reviews/model-identity/domain-b-test.md`

## 8. Domain D — UI and current disclosure

Suggested assignment: `model-identity-domain-d`.

### Candidate owned files

- `apps/soul/agent/src/cockpit/cockpit.html`
- `apps/soul/agent/src/cockpit/ui/header.mjs`
- `apps/soul/agent/src/cockpit/ui/app.mjs`
- `apps/soul/agent/src/cockpit/cockpit-ui.test.mjs`
- `discussion/ai-cohost/operations/pre-stream-checklist.md`
- completion report: `discussion/ai-cohost/implementation/waves/model-identity/domain-d.md`

If a small pure UI view-logic module/test is needed, Domain D may add it under `src/cockpit/view-logic/` and must list it in its completion report. It must not add a duplicate brain-family mapping; tests use the exact fake `state.brain.identity` shape from AC-04. It must not edit server, registry, input seams, prompt, history, memory, or TTS.

### Deliverables

- header prop/current-state rendering for Cody and Chappy;
- document title update with deterministic pre-state behavior;
- preservation of brain settings labels, feed raw IDs, settings interaction, and accessibility label/id behavior;
- dual or selection-dependent operational disclosure with no persona/voice coupling claim;
- UI unit/smoke fixtures for both identities, missing/unknown public identity fallback, and unchanged technical brain display;
- completion report at the path above.

### Persistent reviews

- spec: `discussion/ai-cohost/implementation/reviews/model-identity/domain-d-spec.md`
- design: `discussion/ai-cohost/implementation/reviews/model-identity/domain-d-design.md`
- test: `discussion/ai-cohost/implementation/reviews/model-identity/domain-d-test.md`

## 9. Domain C — currentBrain wiring and final integration

Suggested assignment: `model-identity-domain-c`.

### Candidate owned files

- `apps/soul/agent/src/mind/fire-orchestrator.mjs`
- `apps/soul/agent/src/mind/fire-orchestrator.test.mjs`
- `apps/soul/agent/scripts/cockpit.mjs`
- `apps/soul/agent/scripts/cockpit.test.mjs`
- `apps/soul/agent/src/cockpit/cockpit-server.mjs`
- `apps/soul/agent/src/cockpit/cockpit-server.test.mjs`
- completion report: `discussion/ai-cohost/implementation/waves/model-identity/domain-c.md`

Domain C is the only domain allowed to connect `currentBrain` to prompt creation, dynamic input providers, and current public identity state. It must consume A/B/D contracts rather than reimplement them. If it discovers a seam defect in A/B/D, it reports it to the Orch-Sylph; the owning Gnome fixes it and affected review lanes re-review it.

### Deliverables

- identity-aware Fire prompt builder with a Cody-compatible default export/behavior;
- `ensureFireResources()` resolves current identity once for each newly created session and composes prompt + memory exactly once;
- server construction receives request/handling-time identity providers for Whisper and scheduler;
- current snapshot carries exactly `state.brain.identity = { id, displayName }` as frozen in AC-04, derived from the same current registry identity; missing/malformed UI input falls back to `Soul Cockpit`;
- two-direction swap integration tests (`claude↔each GPT family representative`, plus table-driven all-four mapping) covering dispose/null/next-Fire prompt, input name switch, UI state, and no historical rewrite;
- regression tests proving transcript/usage/memory/settings shapes and technical labels remain unchanged;
- a fake-only TTS regression proving brain selection/swap leaves the configured TTS dependency and speaker unchanged and does not reconstruct the TTS path;
- completion report at the path above.

### Persistent reviews

- spec: `discussion/ai-cohost/implementation/reviews/model-identity/domain-c-spec.md`
- design: `discussion/ai-cohost/implementation/reviews/model-identity/domain-c-design.md`
- test: `discussion/ai-cohost/implementation/reviews/model-identity/domain-c-test.md`

## 10. Test and verification matrix

| Class | Required evidence | Real consumption |
|---|---|---:|
| Unit | exact identity values/freeze/four mapping/fallback; prompt builder; dynamic Whisper provider; dynamic scheduler providers; header/title rendering | 0 |
| Integration | startup remembered brain; four brain current identity; Claude↔GPT dispose/null/next-Fire prompt; no ear/scheduler restart; current snapshot→UI | 0 |
| Negative | Chappy inactive on Claude; Cody inactive on GPT; unknown API still 400; missing state safe fallback; prompt not copied into transcript; no historical rewrite | 0 |
| Regression | existing brain registry, scheduler, Whisper, orchestrator, cockpit server/UI/settings, memory, transcript/usage focused suites; TTS dependency/speaker identical across Claude/GPT selections | 0 |
| Guards | soul-zone direct check; forbidden-path diff audit including `src/voice/**` unchanged; package/lockfile unchanged; no provider/network/credential use | 0 |
| Human | actual visible name, actual next Fire self-name, practical call recognition, swap-back, disclosure selection | user-run and reported separately |

Preferred focused command scope is `apps/soul/agent` and uses injected fake sessions/fetch/pipelines. The Gnome/Orch-Sylph records exact commands and raw output; this plan does not freeze a stale baseline number.

### `spawn EPERM` classification

- If `node --test` fails **before test assertions** because worker/child creation returns `spawn EPERM`, record command, exit code, affected file count, pass/fail/skipped counts, and the pre-assertion evidence. Classify it as an environment limitation, not an assertion failure and not a green run.
- Run the repository-established worker-free selected-import fallback for the same focused files when available. Report its raw counts separately; never add counts from different runners.
- Syntax errors, import errors caused by the patch, started assertions that fail, timeouts in application code, or different errors are implementation failures and remain blocking.
- A historical `360/360` or `835/835` is context only; it is not current acceptance evidence.

### Actual-consumption zero

Automated work must make **zero** real Claude/Codex/Terra/Sol requests and zero external network calls. It must not inspect credential contents. Sessions, fetch, Whisper, and server behavior use fakes/injection. Every domain report and final closeout records `real provider calls: 0` and the evidence used. The later human gate is separate and may perform deliberate user-run Fire calls.

## 11. Review policy

Every domain gets three independent Review-Sylph contexts; they must not be merged into one reviewer.

1. **Spec lane**: §2–4 and domain deliverables; exact mapping and non-goals.
2. **Design lane**: single authority, dependency direction, lifecycle, compatibility, privacy/boundary, owned-file discipline.
3. **Test lane**: test adequacy, negatives, fake-only proof, raw results, EPERM classification, guard coverage.

Each report includes verdict, loop number, evidence files/commands, blocking findings, nonblocking findings, and residual risk. Review-Sylph reads basis, target files, diff, tests, and evidence directly; a Gnome’s prose is not sufficient evidence.

### Severity and fix loop

- **Blocking**: wrong four-brain mapping; duplicated authority; wrong next-Fire semantics; fixed Cody left on a current runtime surface; old-family name active after switch; history/settings/persona/TTS/viewer schema change; technical label/API regression; soul-zone violation; credential/network/real-provider use; unclassified or assertion-level test failure; owned-file breach that can affect another agent.
- **Nonblocking**: an explicitly out-of-scope historical comment/report still says Cody; optional additional observed ASR aliases not yet collected; a documented future a11y/e2e enhancement that does not violate an AC. Nonblocking findings are recorded with owner/follow-up and raw count but do not silently expand this wave.
- Any blocking finding prevents domain PASS and downstream launch. Orch-Sylph sends the concrete finding to the owning Gnome, then launches a **targeted re-review by the affected lane(s)**. Cross-cutting fixes re-run every affected lane.
- Review/fix loops are capped at **5 per domain**. If findings do not shrink, ownership becomes ambiguous, or a new product/design choice appears, escalate early to L0; do not consume all five loops mechanically.

## 12. Orchestration contract

### Roles

- **L0 Undine**: owns this plan, accepted decisions, dependency gates, user questions, mechanical-vs-human status, and final user report. Does not implement source/tests, perform large diff inventory, or substitute for a delayed child.
- **L1 single Orch-Sylph**: reads the plan and bounded current files; executes A → (B ∥ D) → C; assigns exclusive ownership; launches Gnome and three Review-Sylph lanes per domain; waits; routes fixes; maintains raw evidence; writes final orchestration closeout. It does not implement source.
- **L2 Gnome**: edits only assigned owned files, adds/runs focused tests, uses fakes, and writes its domain completion report under `waves/model-identity/`.
- **L2 Review-Sylph**: independently reviews exactly one lane, writes its persistent review file, and does not implement fixes.

### Mandatory nesting separation

Every Orch-Sylph assignment must contain this exact text:

> Orch-Sylph自身は実装担当ではない。source implementation は必ず別コンテキストの Gnome に委譲し、レビューは必ず別コンテキストの Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。

This separation is mandatory: Undine does not implement domains; Orch-Sylph does not implement source; each implementation is a separate Gnome context; each spec/design/test review is a separate Review-Sylph context. A result produced without this separation is untrusted and cannot count as PASS.

### Mandatory call prefixes

Every subagent prompt begins on its first line with:

- Undine → Orch-Sylph: `[subagent-call] 呼び出し元: Undine`
- Orch-Sylph → Gnome: `[subagent-call] 呼び出し元: Sylph`
- Orch-Sylph → Review-Sylph: `[subagent-call] 呼び出し元: Sylph`

This prefix is required for initial calls, targeted fixes, re-reviews, final mechanical review, and any replacement agent.

### Wait and early escalation

- `wait_agent` timeout is a polling timeout, not failure, cancellation, or evidence of inactivity.
- A parent must not interrupt/close a child merely because a wait timed out, another child is still running, or a validation takes time. Wait until explicit completed/blocked/escalate status.
- Until final status, the parent must not perform the same implementation/review itself or launch a duplicate owner.
- Interruption is allowed only on explicit user cancellation or after the child returns a terminal status that is recorded. An accidentally interrupted domain is not PASS and must be re-established with fresh separated contexts.
- Escalate before implementation when exact identity vocabulary, ownership, wire/history boundary, or another user/product decision is missing. Do not guess, broaden scope, or hide the ambiguity in a nonblocking note.

## 13. Shared-worktree and ownership discipline

- All agents share one dirty worktree. Before each assignment, capture `git status --short -uall` and distinguish pre-existing/user/other-agent changes from owned changes.
- Never revert, overwrite, stage, commit, clean, or reformat another agent’s changes. `git reset --hard`, checkout-based reversion, bulk cleanup, and broad mechanical name replacement are forbidden.
- Edit only the assigned owned files and assigned report path. If an unowned file is necessary, stop and ask Orch-Sylph to transfer/serialize ownership before editing.
- Parallel Domain B/D is permitted only because their owned files are disjoint. Domain C waits for both and may not absorb their files without an explicit targeted return to the original owner.
- No maps are modified in this wave unless a later explicit assignment expands scope; this plan itself does not authorize map edits.

## 14. Mechanical gate and human gate

### Mechanical gate

After Domain C’s three lanes pass, L1 launches a fresh Review-Sylph for cross-domain mechanical review. Persistent report:

`discussion/ai-cohost/implementation/reviews/model-identity/final-mechanical.md`

It verifies all ACs that are machine-observable, cross-domain diff/ownership, exact raw counts, all persistent reports, zero real consumption, forbidden paths, and soul-zone boundary. Mechanical PASS requires:

- Domain reviews: **12/12 lane verdicts PASS** (A/B/D/C × spec/design/test);
- final mechanical review: PASS;
- blocking findings: 0;
- every nonblocking finding explicitly listed with owner;
- current focused tests/guards reported with raw status, including any EPERM limitation;
- no required child left running/unresolved.

Mechanical PASS means implementation-ready for human check; it does **not** close the feature’s human gate.

### Human gate

Persistent checklist/result:

`discussion/ai-cohost/implementation/waves/model-identity/human-gate.md`

The user performs and records separately:

1. Claude selected: title/header show `こーでぃー`; calling Cody can cause the next Fire; the response treats its name as Cody.
2. Select one GPT brain: title/header show `チャッピー`; calling Chappy can cause the next Fire; the newly created session treats its name as Chappy.
3. Old Cody call does not act as the GPT identity; prior transcript/memory text is visibly unchanged.
4. Switch back to Claude: the next Fire again treats its name as Cody; technical brain label/raw badge still behaves as before.
5. The chosen pre-stream disclosure matches the selected family and does not imply a different TTS persona/voice.

If actual ASR produces a recurring Chappy misrecognition, record the utterance/output as a proposed follow-up alias. Do not add it during the gate without a new reviewed change.

## 15. Final closeout artifacts and status format

L1 writes:

`discussion/ai-cohost/implementation/waves/model-identity/final-closeout.md`

The closeout links all four Gnome reports, twelve lane reports, final mechanical report, and human-gate report/template. It records **raw numbers**, not only “green”:

- domains completed / total;
- review lanes PASS / total; loops per domain;
- blocking and nonblocking finding counts, with unresolved list;
- files created/modified, plus forbidden-path changes count and explicit `src/voice/**` change count (`0` required);
- for every test command: runner, test files discovered/started, pass/fail/skipped, exit code, and EPERM classification if any;
- guard command exit code, files scanned, violations found;
- TTS invariance regression result, proving the configured dependency/speaker is identical across Claude/GPT selections;
- real provider calls, external network calls, credential-content reads;
- mechanical gate `PASS|FAIL|BLOCKED`;
- human gate `PENDING|PASS|FAIL`, passed items / total, and user evidence reference.

Wave status may be **mechanically complete / human gate pending**. It becomes fully closed only when the human gate is PASS. A near-green result, loop-cap exhaustion, unreviewed fix, or unresolved child must be reported honestly and cannot be rounded up to completion.

## 16. Launch packet for the single Orch-Sylph

The L0 assignment must include: this plan path; all basis paths from §1; the mandatory nesting sentence; call-prefix rules; shared-worktree warning; A → (B ∥ D) → C gates; owned file/report paths; three-lane review paths; loop cap 5; wait-timeout rule; early-escalation rule; zero-consumption rule; and the required final artifacts.

The Orch-Sylph begins with a bounded preflight only: verify basis paths, target file existence, current dirty status, and that no proposed owned file is already owned by a running agent. It must not repeat the full inventory or redesign identity. If repository drift invalidates an ownership/dependency assumption, it escalates with the exact conflict before launching the affected Gnome.

## 17. Current status

- Plan: ready to launch.
- Domain A/B/C/D: not started.
- Persistent implementation/review/closeout artifacts: not yet created.
- Mechanical gate: pending.
- Human gate: pending.
- Known planning blockers: none under the accepted decisions in §2.
