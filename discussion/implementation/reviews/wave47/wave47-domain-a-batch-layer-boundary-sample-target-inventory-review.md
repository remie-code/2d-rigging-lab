# Wave47 Domain A Review: Batch Layer Boundary / Sample Target Inventory

> Target: `wave47-batch-layer-boundary-sample-target-inventory`
> Reviewed report: `discussion/implementation/waves/wave47/wave47-domain-a-batch-layer-boundary-sample-target-inventory-report.md`
> Role: Review-Sylph independent review
> Verdict: `pass`

## Verdict

`pass`

No blocking design, development-compliance, evidence, or traceability finding was found. The reviewed report is adequate as the Wave47 Domain A boundary gate for explicit user-selected PSD leaf-layer batch intake and downstream part scaffolding.

This review does not approve all-layer import, recursive group import, group import expansion, drag-drop, archive/filesystem access, Photoshop-style full compositing, renderer/pixel oracle behavior, texture sampling correctness, Cubism compatibility, public demo asset status, or repo-side repair/LLM behavior.

## Scope Reviewed

- Domain A report artifact: `discussion/implementation/waves/wave47/wave47-domain-a-batch-layer-boundary-sample-target-inventory-report.md`
- Wave47 plan and Domain A assignment/pass criteria.
- Current capability map and remaining backlog at Wave46 final pass.
- Wave46 final report, clean integration review, and Wave46 Domain A-F boundary reports/reviews for storage, materialization, package/operation bridge, Editor UX, validator diagnostics, and focused e2e evidence.
- Dependency, diagnostic, and schema/ID conventions.
- Fixture manifest and traceability matrix rows for Wave44-Wave46 PSD evidence.
- Existing Wave44 PSD smoke script and Wave44 headwear materialization evidence.
- Current worktree status and whitespace checks.

## Basis Documents Used

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave47-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/waves/wave46/wave46-domain-h-integration-review-and-final-report.md`
- `discussion/implementation/reviews/wave46/wave46-domain-h-clean-integration-review.md`
- `discussion/implementation/waves/wave46/wave46-domain-a-materialized-layer-asset-boundary-storage-policy-report.md`
- `discussion/implementation/waves/wave46/wave46-domain-b-browser-selected-layer-materialization-service-report.md`
- `discussion/implementation/waves/wave46/wave46-domain-c-package-operation-texture-intake-part-mapping-bridge-report.md`
- `discussion/implementation/waves/wave46/wave46-domain-d-editor-selected-layer-intake-part-mapping-ux-report.md`
- `discussion/implementation/waves/wave46/wave46-domain-e-validator-product-preflight-materialized-asset-diagnostics-orch-report.md`
- `discussion/implementation/waves/wave46/wave46-domain-f-psd-selected-layer-focused-e2e-persistence-regression-report.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/diagnostic-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/tests/fixtures/fixture-manifest.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `scripts/wave44-psd-parser-smoke.mjs`
- `test_data/derived/wave44/psd-layer-materialization/headwear.raw-rgba.materialization-evidence.json`

## Design / Development Compliance Findings

- Pass: The report covers Domain A required work from the Wave47 plan: explicit multi-layer batch target boundary, sample target inventory, caps, per-layer result semantics, part scaffold semantics, atomicity/truthfulness, unsupported/hidden/group/duplicate/collision handling, and downstream evidence requirements.
- Pass: The proposed scope stays inside explicit user-selected PSD leaf layers. Groups return unsupported/container results, all-layer import and recursive group import are explicitly forbidden, and the grouped `tie` target is treated as one leaf ref rather than a recursive group import.
- Pass: Wave46 materialized asset boundaries are preserved. The report keeps source PSD bytes and raw parser objects out of project persistence, keeps materialized bytes private/local, uses `publicDemoAsset=false`, and carries parser-free downstream evidence outside the approved Editor/browser adapter and Wave44 scripts boundary.
- Pass: Caps are defined and conservative for v0: existing `32 MiB` source PSD cap, existing `64 MiB` per-layer raw RGBA cap, `4` selected unique leaf refs per batch, and `32 MiB` total materialized raw RGBA cap. Repository search confirmed the existing source/parser and per-layer materialization caps in Editor code.
- Pass: Result semantics are truthful. The report requires per-layer outcomes, aggregate `success` / `partialFailure` / `failure` / `preflightBlocked`, and forbids silent partial success or unsupported rollback/transaction claims.
- Pass: Part scaffold semantics are adequate for Domains C/D. The report distinguishes Wave46 existing-part destination from Wave47 generated child part scaffold, requires deterministic generated IDs, reserves IDs before mutation, and blocks or explicitly reports collisions.
- Pass: The report does not edit source, dependencies, lockfiles, fixture bytes, public demo assets, or raw visual bytes. Current status shows no `apps/**`, `packages/**`, `scripts/**`, package manifest, or lockfile edits.

## Test / Evidence Adequacy Findings

- Pass: The PSD inspection path is existing and approved enough for Domain A. `package.json` maps `pnpm.cmd smoke:wave44:psd-parser` to `node scripts/wave44-psd-parser-smoke.mjs --psd test_data/sample_model.psd`, and Wave44-Wave46 fixture/traceability records use the same private/local sample boundary.
- Pass: I reran the existing Wave44 smoke command in read-only mode with in-memory JSON filtering. It confirmed parser `@webtoon/psd` `0.4.0`, source byteLength `22406225`, SHA-256 `44AB43238CD2B2AF2FB0CE6A7B5073A60E332D03DA7666EA274C02E0462294B5`, document `2048x3072`, `20` groups, `126` layers, `121` visible, `5` hidden, `publicDemoAsset=false`.
- Pass: The three selected targets are stable visible leaf targets and match the report:
  - `headwear`, `psd:root/layer[0]`, bounds `400x288`, visible leaf.
  - `eyewear`, `psd:root/layer[3]`, bounds `265x110`, visible leaf.
  - `tie`, `psd:root/group[6]/layer[0]`, bounds `104x560`, visible leaf under group `psd:root/group[6]`.
- Pass: The selected set is multi-layer and exercises both root leaf and grouped leaf path handling while staying below the proposed batch total cap: `460800 + 116600 + 232960 = 810360` raw RGBA bytes.
- Pass: The report records the exact Gnome verification commands and results for `pnpm.cmd smoke:wave44:psd-parser` and `git diff --check -- discussion/implementation/waves/wave47/wave47-domain-a-batch-layer-boundary-sample-target-inventory-report.md`.
- Pass with caveat: Domain A does not compute actual materialized digests for `eyewear` or `tie`; the report states this explicitly and hands that requirement to Domains B/F. That is acceptable because Domain A is the boundary/sample inventory gate, not the batch materialization implementation.

## Handoff Facts For Domains B/C/D/E/F

- Domains B/F must materialize `eyewear` and `tie` and record actual per-layer digests before claiming execution coverage beyond target metadata.
- Domains B/C/D/E/F should treat missing source/layer/parser/extraction/materialized/storage/destination evidence as blocking, stale, missing, unsupported, or diagnostic evidence rather than ignoring it.
- Domains C/D should use full layer path/ref in generated ID/collision preflight; final display name alone is insufficient for same-name leaves.
- Domains D/E/F must surface `partialFailure` and committed/failed entry details truthfully if implementation commits per layer.
- Parser direct imports must remain limited to the approved Editor/browser adapter and Wave44 scripts; packages and validator must remain parser-free.

## Files Changed By Reviewer

- `discussion/implementation/reviews/wave47/wave47-domain-a-batch-layer-boundary-sample-target-inventory-review.md`

No source implementation, dependency manifest, lockfile, fixture byte, raw visual byte, or public demo asset file was edited.

## Verification Performed

- `git status --short -uall`: before review writing, only `discussion/implementation/orchestration/_map.md`, `discussion/implementation/orchestration/wave47-plan.md`, and the Domain A report were changed/untracked.
- `pnpm.cmd --silent smoke:wave44:psd-parser` with in-memory JSON filtering for the three target refs: pass; summarized above.
- `rg` searches for target refs, cap constants, parser/dependency boundary terms, ID/collision helpers, and fixture/traceability PSD rows.
- `git diff --check -- discussion/implementation/waves/wave47/wave47-domain-a-batch-layer-boundary-sample-target-inventory-report.md discussion/implementation/reviews/wave47/wave47-domain-a-batch-layer-boundary-sample-target-inventory-review.md`: pass, no whitespace findings.
- `git diff --no-index --check -- NUL discussion/implementation/waves/wave47/wave47-domain-a-batch-layer-boundary-sample-target-inventory-report.md`: no whitespace findings; exit `1` was expected for no-index file difference, with LF/CRLF warning only.
- `git diff --no-index --check -- NUL discussion/implementation/reviews/wave47/wave47-domain-a-batch-layer-boundary-sample-target-inventory-review.md`: no whitespace findings; exit `1` was expected for no-index file difference, with LF/CRLF warning only.
- `git status --short -uall`: after writing, only `discussion/implementation/orchestration/_map.md`, `discussion/implementation/orchestration/wave47-plan.md`, this review artifact, and the Domain A report were changed/untracked. No forbidden source/dependency files were edited.

## Remaining Issues

No blocking issues.

Residual downstream verification items:

- Domains B/F need actual materialized digests and byte evidence for `eyewear` and `tie`.
- Domains C/D need exact generated ID outputs and collision behavior under existing helpers.
- Domains D/E need UX/diagnostic coverage for partial failure, missing/stale bytes, duplicate selection, group unsupported, cap exceeded, and collision states.

## User-Decision Points

None required for Domain A pass.

Future decisions remain outside this Domain A gate: raising batch caps, supporting hidden leaf materialization, requiring all-or-nothing transaction semantics, or changing direction toward all-layer import, recursive group import, drag-drop/filesystem, renderer/pixel oracle, or public sample/demo asset distribution.
