# Domain D completion report: Cockpit current identity / operational disclosure

## Scope and ownership

Implemented the Domain D assignment from
`discussion/ai-cohost/implementation/orchestration/model-identity-wave-plan.md`
§§2, 8, 10–15. Before editing, `git status --short -uall` was captured; the
existing Domain A/B, orchestration, inventory, `.codex`, archive, and unrelated
worktree changes were preserved. No staging, commit, reset, revert, dependency
installation, network/provider operation, or credential-content read was done.

Owned diff is limited to the six assigned files below (106 insertions, 16
deletions by `git diff --stat`):

- `apps/soul/agent/src/cockpit/cockpit.html`
- `apps/soul/agent/src/cockpit/ui/header.mjs`
- `apps/soul/agent/src/cockpit/ui/app.mjs`
- `apps/soul/agent/src/cockpit/cockpit-ui.test.mjs`
- `apps/soul/README.md`
- `discussion/ai-cohost/operations/pre-stream-checklist.md`

No Cockpit server, `scripts/cockpit.mjs`, ears/mind runtime, transcript/history,
memory, settings schema, or `src/voice/**` file was edited.

## Implemented behavior

- The static HTML title is now the neutral `<title>Soul Cockpit</title>`.
  Before state arrives, no Cody/Chappy/GPT claim is shown.
- `Header` consumes the server-provided `state.brain.identity` projection
  (`{ id: "cody" | "chappy", displayName: "こーでぃー" | "チャッピー" }`)
  and renders the supplied `displayName` in the current header.
- Missing, malformed, or unknown public identity is rendered as neutral
  `Soul Cockpit`; a prior identity is never retained as a fallback.
- Identity validation now requires one of the exact paired contracts
  (`cody` + `こーでぃー` or `chappy` + `チャッピー`); cross-paired values and
  wrong field types are neutral rather than independently accepted.
- `App` passes the identity through unchanged and updates `document.title` only
  from that current public projection (`こーでぃー — Soul Cockpit`,
  `チャッピー — Soul Cockpit`, or neutral `Soul Cockpit`). The effect is
  guarded for Node/no-document imports.
- Existing technical brain labels/select values, raw transcript/usage IDs,
  feed/history rendering, settings interaction, and accessibility attributes
  remain untouched.
- UI tests cover both identities, missing/unknown identity, deterministic title
  helper output, and the neutral static title. The operational checklist now
  has copy-ready Claude/Cody and GPT/Chappy disclosure text, a selection-aware
  short form, and voice/kill guidance that does not claim brain-dependent TTS
  persona or speaker changes. `apps/soul/README.md` records the same current
  family behavior and TTS independence.

## No UI mapping proof

The implementation consumes `identity.id` and `identity.displayName`; it does
not inspect technical brain IDs or provider/model labels and contains no
brain-to-family/name conversion table. Guard command:

```text
rg -n -i "claude|codex|gpt|provider|model" \
  apps/soul/agent/src/cockpit/ui/header.mjs \
  apps/soul/agent/src/cockpit/ui/app.mjs \
  apps/soul/agent/src/cockpit/cockpit.html
```

Result: **NO_MATCH**. The only identity vocabulary in the UI source is the
public wire contract validation and direct display; the existing technical
brain fixtures remain in tests solely to prove their raw labels are unchanged.

## Verification evidence

### Normal Node runner (environment limitation, recorded separately)

Command:

```text
node --test apps/soul/agent/src/cockpit/cockpit-ui.test.mjs
```

Exit code: **1**. Node discovered one file but failed before assertions while
creating the runner child worker:

```text
TAP version 13
# Subtest: apps\\soul\\agent\\src\\cockpit\\cockpit-ui.test.mjs
not ok 1 - apps\\soul\\agent\\src\\cockpit\\cockpit-ui.test.mjs
failureType: testCodeFailure
error: spawn EPERM
1..1
# tests 1
# suites 0
# pass 0
# fail 1
# cancelled 0
# skipped 0
```

This is the known environment-origin `spawn EPERM`, not an assertion failure
and not green runner evidence.

### Worker-free selected-import fallback

Command:

```text
node --input-type=module -e "await import('./apps/soul/agent/src/cockpit/cockpit-ui.test.mjs'); await import('./apps/soul/agent/src/cockpit/cockpit-static-assets.test.mjs');"
```

Exit code: **0**. The selected files ran in one process without worker spawn:

- `cockpit-ui.test.mjs`: **41/41 passed**, 0 failed, 0 skipped, 0 cancelled.
- `cockpit-static-assets.test.mjs`: **10/10 passed**, 0 failed, 0 skipped,
  0 cancelled.
- Combined TAP summary: **51 tests, 51 passed, 0 failed, 0 skipped, 0
  cancelled**.

Evidence includes static asset serving, UI import/structure guards, unchanged
13-event SSE list, existing feed/history fixtures, current technical brain
labels, Cody/Chappy header rendering, malformed identity fallback, and neutral
initial title.

### Syntax and diff checks

```text
node --check apps/soul/agent/src/cockpit/ui/header.mjs
node --check apps/soul/agent/src/cockpit/ui/app.mjs
node --check apps/soul/agent/src/cockpit/cockpit-ui.test.mjs
git diff --check -- apps/soul/agent/src/cockpit/cockpit.html \
  apps/soul/agent/src/cockpit/ui/header.mjs \
  apps/soul/agent/src/cockpit/ui/app.mjs \
  apps/soul/agent/src/cockpit/cockpit-ui.test.mjs \
  apps/soul/README.md \
  discussion/ai-cohost/operations/pre-stream-checklist.md
```

All commands exited **0**. `git diff --check` emitted only Git's existing
LF→CRLF normalization warnings.

### Forbidden-path and consumption guards

```text
git status --short -- apps/soul/agent/src/voice
git diff --name-only -- apps/soul/agent/src/voice
```

Both returned no paths: `src/voice/**` change count is **0**. Real Claude,
Codex/Terra/Sol calls: **0**. External network calls: **0**. Credential
content reads: **0**. Tests used only local imports, static fixtures, and fake
data; no browser, microphone, TTS, or provider runtime was started.

## Domain C handoff

Domain C should supply the exact additive `state.brain.identity` projection
from the canonical resolver and let this UI consume it unchanged. The
technical `state.brain.brain` label remains independently displayed by the
existing settings drawer. C should preserve the current selection lifecycle,
history/transcript/usage/memory schemas, and TTS dependency/speaker while
updating the current identity snapshot. The real server wiring and selection
acknowledgement remain C ownership; this report provides the fake-only UI
contract and neutral-state behavior needed for that integration.

## Loop 2 targeted fix evidence

Independent Domain D reviews identified one blocking issue: the first
implementation accepted `id` and `displayName` independently. The fix replaces
those sets with an immutable exact-pair contract and tests both cross-pairs,
wrong types, unknown values, and missing values. Header and document-title paths
share this validator, so malformed current state cannot claim either family.

Normal runner (same environment limitation, no assertions started):

```text
node --test apps/soul/agent/src/cockpit/cockpit-ui.test.mjs
exit 1; tests 1; pass 0; fail 1; cancelled 0; skipped 0; error spawn EPERM
```

Worker-free re-run after the targeted fix:

```text
node --input-type=module -e "await import('./apps/soul/agent/src/cockpit/cockpit-ui.test.mjs'); await import('./apps/soul/agent/src/cockpit/cockpit-static-assets.test.mjs');"
exit 0; combined 51/51 pass; 0 fail; 0 skipped; 0 cancelled
```

The UI portion is 41/41 and static-assets is 10/10. `node --check` for
`header.mjs`, `app.mjs`, and `cockpit-ui.test.mjs` plus scoped `git diff --check`
all exit 0 (only existing LF→CRLF warnings). README wording was reviewed in
the same loop: it describes current family selection, identity behavior from
the next Fire, and unchanged TTS/persona/history; it explicitly says prior or
in-flight transcript/SSE/history/memory/usage/settings are not re-attributed or
rewritten and retains the existing four-brain technical reality.

## Loop 3 targeted documentation evidence

The spec-lane follow-up requested an explicit operator-facing identity-scope
invariant. The README and pre-stream checklist now state that switching the
family changes only the current name and the next-Fire self-introduction; it
does not add identity attribution to transcript, SSE transcript, usage records,
memory, or persisted history, and performs no past-text rewrite or in-flight
attribution. The same wording preserves the existing TTS/output-speaker,
persona, privacy, and memory disclosure semantics.

The exact technical brain picker in the touched README section now names all
four existing choices (`claude`, `codex`, `codex-55`, `codex-56-sol` labels), so
the family guidance does not leave stale two-choice prose. No historical wave
report or unrelated documentation was rewritten.

Documentation-only loop-3 checks:

```text
git diff --check -- apps/soul/README.md \
  discussion/ai-cohost/operations/pre-stream-checklist.md \
  discussion/ai-cohost/implementation/waves/model-identity/domain-d.md
exit 0 (only existing LF→CRLF normalization warnings)
```

The loop-2 source fix remains covered by the worker-free selected-import result
of **51/51 pass** (UI 41/41, static assets 10/10); no source/test runtime was
changed in this documentation-only loop.

## Residuals / status

- Review-Sylph spec/design/test lanes and the human gate remain pending.
- The normal worker-based runner is still blocked by environment `spawn EPERM`;
  the separate 51/51 worker-free focused result is the valid machine evidence
  for this domain and must not be combined with the failed runner count.
- No UI-side brain mapping, voice changes, historical rewrite, provider use, or
  credential exposure was introduced.
