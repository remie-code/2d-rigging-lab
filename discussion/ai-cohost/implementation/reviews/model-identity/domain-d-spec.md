# Domain D spec review — current Cockpit identity and disclosure (loop 3)

## Verdict

**PASS — 0 blocking findings, 0 residual scope violations.** The validator,
tests, identity disclosures, four-brain picker text, and forbidden-path audit
now satisfy the frozen Domain D scope.

## Basis and re-review scope

Re-read the accepted model-identity plan §§2–4, 8, and 10; Domain A's frozen
contract/report; Domain D's completion report; current UI source/tests; README,
pre-stream checklist, and current diff. The shared dirty worktree was preserved;
only this assigned report was overwritten.

## Evidence / raw results

| Check | Result |
|---|---|
| `node --test apps/soul/agent/src/cockpit/cockpit-ui.test.mjs` | Exit 1; one file, 0 assertions; known pre-assertion worker `spawn EPERM` (environment limitation). |
| Worker-free selected imports of `cockpit-ui.test.mjs` + `cockpit-static-assets.test.mjs` | Exit 0; **51/51 passed**, 0 failed/skipped/cancelled. |
| `node --check` on `header.mjs`, `app.mjs`, `cockpit-ui.test.mjs` | Exit 0 for all. |
| `git diff --check` on Domain D paths | Exit 0 (only existing LF/CRLF warnings). |
| UI technical-mapping guard (`rg -i "claude|codex|gpt|provider|model"` over UI header/app/static HTML) | `NO_MATCH`; no technical brain-ID/model mapping. |
| Forbidden-path diff (`src/voice/**`, server/scripts, prompt/input runtime, `mind/memory.mjs`) | No paths; no provider/network/credential operations. |
| Direct identity/title probe | Canonical Cody/Chappy pairs render names; missing/null, unknown, malformed, and both cross-pairs return `Soul Cockpit` for header/title. |

## Contract and implementation assessment

- `header.mjs` validates the exact frozen public pairs
  `{id:"cody",displayName:"こーでぃー"}` and
  `{id:"chappy",displayName:"チャッピー"}`. Cross-pairs are neutral, so no
  malformed state can display the wrong family or retain a stale title.
- `App` forwards `state.brain.identity` unchanged and derives the current
  header/title only from that public projection. Static HTML starts with
  `<title>Soul Cockpit</title>`. It does not inspect technical brain IDs,
  providers, or models.
- Existing technical labels/options, raw transcript/usage brain IDs, settings
  interaction, feed/history rendering, and accessibility attributes remain
  intact. No identity field is added to transcript, usage, memory, history, or
  settings in the UI.

## Disclosure/documentation assessment

`apps/soul/README.md` and `pre-stream-checklist.md` now explicitly document:

- fixed family defaults: Claude → Cody (`こーでぃー`), all GPT heads → Chappy
  (`チャッピー`);
- current family-aware call/comment naming and the existing selection timing;
- behavioral self-name change from the next Fire/new session;
- TTS output device/speaker and persona invariance;
- transcript, SSE transcript, usage records, memory, persisted-history body and
  settings invariance, with no identity attribution, rename, re-attribution, or
  rewrite of past/in-flight material;
- all four technical brain choices (`Claude (Opus 4.8)`, `Codex (GPT-5.6
  Terra)`, `Codex (GPT-5.5)`, `Codex (GPT-5.6 Sol)`).

The added wording is disclosure-only and does not introduce persistence or a
schema change. Existing AI-generation and memory/privacy disclosure remains.

## Diff/scope and residuals

The Domain D diff is limited to the six reported paths: cockpit HTML, UI
header/app/tests, `apps/soul/README.md`, and the pre-stream checklist. No server,
orchestrator, prompt, ears, scheduler, transcript/history implementation,
memory, settings schema, TTS/provider adapter, package, or lockfile path was
modified by this domain. No browser/human visual or live provider/ASR/TTS run
was performed; those remain separate gates. Domain C still owns real server
projection and selection-acknowledgement/next-Fire integration.

The prior stale README “flat 2択” wording is corrected to the four technical
brain choices; no documentation residual remains in this scope.
