# Domain A spec review — model identity contract/resolver

## Verdict

**PASS** — loop 1; blocking findings: **0**; nonblocking findings: **0**.

The implementation matches the accepted Domain A contract in
`discussion/ai-cohost/implementation/orchestration/model-identity-wave-plan.md`
§§2–4 and §6. This review independently inspected the plan, inventory evidence,
source/tests, current diff, and the Gnome completion report.

## Evidence and commands

Basis inspected:

- `discussion/ai-cohost/implementation/orchestration/model-identity-wave-plan.md`
- `discussion/reports/ai-cohost-model-identity-inventory/01-fixed-name-and-identity-flow.md`
  through `04-ui-contracts-and-tests.md`, `10-inventory-integration.md`, and
  `20-final-review.md` (inventory final review: PASS, blocking 0/nonblocking 0)
- `discussion/ai-cohost/implementation/waves/model-identity/domain-a.md`
- `apps/soul/agent/src/mind/model-identity.mjs`
- `apps/soul/agent/src/mind/model-identity.test.mjs`
- `apps/soul/agent/src/mind/brains.mjs`
- `apps/soul/agent/src/mind/brains.test.mjs`

Commands and raw results:

| Command | Result |
|---|---|
| `git status --short` (pre-review snapshot) | Existing worktree changes were preserved; Domain A source consisted of `brains.mjs`/`brains.test.mjs` edits plus untracked `model-identity.mjs`/`model-identity.test.mjs`; no review file existed before this review. |
| `node --test apps/soul/agent/src/mind/model-identity.test.mjs apps/soul/agent/src/mind/brains.test.mjs` | Exit **1**; 2 files discovered, **0 pass / 2 fail**, 0 skipped/cancelled. Both failed before assertions with `spawn EPERM`; classified as the known environment limitation, not a green run. |
| `node --input-type=module -e "await import('./apps/soul/agent/src/mind/model-identity.test.mjs'); await import('./apps/soul/agent/src/mind/brains.test.mjs');"` | Exit **0**; **18/18 passed**, 0 failed, skipped, or cancelled (worker-free selected-import fallback). |
| Four `node --check` commands for Domain A source/tests | Exit **0** for all files. |
| `git diff --check --` Domain A paths | Exit **0**. |
| `node scripts/check-soul-zone-boundary.mjs` | Exit **0**; **1,391 source files scanned**, no boundary violations. |
| `git diff --name-only -- apps/soul/agent/src/voice` | **0 paths**; `src/voice/**` unchanged. |

Real provider calls: **0**. Network calls: **0**. Credential-content reads: **0**.

## Spec findings

- `model-identity.mjs:22–71` is the sole frozen identity declaration. Cody is
  exactly `コーディ`/`Cody`, display `こーでぃー`, Whisper
  `こーでぃー、コーディ。`, four voice variants, and the exact eight comment
  variants. Chappy is exactly `チャッピー`/`Chappy`, display `チャッピー`,
  Whisper `ちゃっぴー、チャッピー。`, two voice variants, and the exact five
  comment variants from plan §3. Nested arrays, identities, and the registry are
  frozen; there are no editable aliases or unapproved variants.
- `model-identity.mjs:73–88` provides the Cody default and rejects unknown,
  absent, or malformed identity IDs to that fallback.
- `brains.mjs:49–90` binds the four existing entries exactly once: `claude` →
  Cody, and `codex`, `codex-55`, `codex-56-sol` → Chappy. The exported
  `resolveBrainIdentity()` (`brains.mjs:98–108`) resolves through those registry
  bindings and falls back to Cody; no second handwritten four-brain/name table
  was found.
- `brains.mjs` retains existing technical IDs/labels, factories, model/effort
  wrappers, credential paths, and selection lifecycle. The added identity field
  does not alter session creation, disposal, persistence, or API behavior.
- Focused tests assert exact values/variant counts, deep immutability, all four
  bindings, and unknown/absent fallback (`model-identity.test.mjs:12–64`,
  `brains.test.mjs:31–48`). Worker-free execution confirms all 18 assertions.

## Scope and diff findings

The inspected code diff is limited to the Domain A owned files:

- new `model-identity.mjs` and `model-identity.test.mjs`;
- identity imports/bindings/resolver in `brains.mjs`;
- corresponding registry and contract tests in `brains.test.mjs`.

No prompt builder, Whisper/ears, scheduler, Cockpit UI/server, operational
disclosure, transcript/history, memory, persona, TTS, provider adapter,
settings schema, package/lockfile, or lifecycle files were changed. The Gnome
report's scope and zero-consumption claims agree with the diff and independent
checks. Domain B/C/D integration and the human gate remain intentionally
pending and are not required for this Domain A spec PASS.

## Residual risks

1. The normal Node runner remains unavailable in this environment because of
   pre-assertion worker `spawn EPERM`; 18/18 worker-free assertions are focused
   evidence, not full runner acceptance.
2. Downstream domains must consume `resolveBrainIdentity()`/the frozen contract
   rather than recreate mappings, and must preserve next-Fire semantics and the
   out-of-scope history/TTS/UI boundaries. Those integration properties are
   intentionally unverified in Domain A.
3. No live provider, microphone/ASR, TTS, or human identity check was run, as
   required by the zero-real-consumption and separate human-gate rules.
