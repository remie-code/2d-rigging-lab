# Domain C design review — currentBrain wiring / final integration

## Verdict

**PASS — loop 2 targeted re-review.** The loop-1 blocking finding was fixed;
blocking findings **0**, nonblocking findings **3** (environment runner,
pre-existing in-flight raw-brain approximation, and documented provider-error
policy). Human-gate status is tracked separately, not counted as a finding.

## Basis and independent evidence

Reviewed the accepted plan, inventory/final review, Domain A/B/D reports and
design reviews, Domain C report, current C source/tests, and the live diff.

Independent commands/results:

- Worker-free selected imports after the targeted fix:
  `fire-orchestrator.test.mjs` **68/68**, `scripts/cockpit.test.mjs`
  **70/70**, and `cockpit-server.test.mjs` **120/120** passed (exit 0; counts
  kept separate).
- Normal combined `node --test` for those three files: exit **1**, 3 files /
  0 assertions passed / 3 pre-assertion failures, each `spawn EPERM`; this is
  the documented environment limitation, not an assertion result.
- `node --check` on all six owned source/test files: exit **0**.
- `git diff --check` on all six: exit **0** (only LF/CRLF warnings).
- Soul boundary guard: exit **0**, **1,391** source files scanned, no violations.
- `src/voice/**` status/diff: **0 paths / 0 rows**. Package/lockfile diff:
  **0 paths**. Real provider/network/credential-content reads: **0/0/0**.

The live Domain C diff is confined to the six owned paths:

- `apps/soul/agent/scripts/cockpit.mjs`
- `apps/soul/agent/scripts/cockpit.test.mjs`
- `apps/soul/agent/src/cockpit/cockpit-server.mjs`
- `apps/soul/agent/src/cockpit/cockpit-server.test.mjs`
- `apps/soul/agent/src/mind/fire-orchestrator.mjs`
- `apps/soul/agent/src/mind/fire-orchestrator.test.mjs`

Current six-file diff scope: **268 insertions / 17 deletions** (plus the
Domain C completion report). No Domain A/B/D implementation path was changed
by C.

## Loop-1 finding and targeted resolution — snapshot authority

Loop 1 found that `currentBrainIdentity` was only used for input seams while
`snapshot()` independently resolved `brainStatus().brain`. This contradicted
the JSDoc contract (`apps/soul/agent/src/cockpit/cockpit-server.mjs:389-390`)
and allowed the state wire to be absent or disagree with active input seams.
The mismatch was reproduced with worker-free local fake servers:

```text
currentBrainIdentity: () => MODEL_IDENTITIES.chappy
brainStatus: omitted
GET /api/state -> brain: null

currentBrainIdentity: () => chappy
brainStatus: () => ({ brain: "claude", credentialHealth: true })
GET /api/state -> identity: { id: "cody", displayName: "こーでぃー" }
```

The Gnome fix now resolves the canonical identity from
`currentBrainIdentityImpl` for every snapshot, derives only `{id, displayName}`,
and retains the no-provider compatibility path through
`resolveBrainIdentity(brainStatus().brain)`. Technical `brain` and
`credentialHealth` remain additive fields; provider-only and deliberate
provider/technical-status mismatch tests now pass (**120/120**).

## Passing architecture checks / residuals

- `currentBrain` is captured by a dynamic resolver closure in
  `scripts/cockpit.mjs:660-663`; session creation resolves identity once in
  `ensureFireResources()` and composes the identity prompt plus memory once.
  Swap remains dispose → `session = null` → next-Fire lazy creation; the fake
  reverse-direction test preserves prompt/history behavior and one TTS player.
- Domain B seams are consumed without recreation: Whisper prompt is read per
  request; voice/comment variants are read per handling event. No second
  brain-to-name table was added in C, and UI remains a consumer of the exact
  public pair.
- Unknown brain IDs resolve Cody server-side; malformed UI identity handling is
  owned by Domain D. Transcript/history/memory/settings schemas and persona/TTS
  speaker remain unchanged, and `src/voice/**` is untouched.
- Existing in-flight raw technical `brain` labels are still read at broadcast
  time (the known brain-swap approximation documented in the inventory); this
  wave adds no identity attribution and does not worsen that out-of-scope
  behavior.
- Provider getter exceptions still propagate by Domain B contract; the
  production resolver closure is total/frozen, so no new exception path was
  observed. Keep that policy explicit in the targeted fix.

The normal worker runner remains environment-blocked (3 files, **0/3**
assertions, pre-assertion `spawn EPERM`); the worker-free counts above are the
current focused evidence. Human visible UI/ASR/provider behavior remains the
separate human gate.
