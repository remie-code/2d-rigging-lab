# Wave51 Domain F Docs / Traceability Screen-Design Refresh Review

- Role: clean Review-Sylph
- Target: `wave51-docs-traceability-screen-design-refresh`
- Verdict: `pass` after re-review
- Scope: documentation, maps, fixtures, and traceability only

## Re-Review Result

- Final verdict: `pass`
- Re-reviewed file: `discussion/design/screen-design/overview.md`
- Result: the stale unresolved `UX-FEAT-018` / `UX-FEAT-019` production `data-testid` coupling question was removed and replaced with post-Wave51 debt.
- Findings: none remaining.

The replacement text at `discussion/design/screen-design/overview.md:175-176` now treats the remaining items as post-Wave51 debt: moving PSD Import / structural scaffold visible DOM/text oracles toward structured observation, deterministic API, or evidence surfaces; deciding how to consume the added PSD Import Task structured observation projector from UI / E2E / Codex-facing read APIs; and deciding where to integrate the standalone production `data-testid` guard in package scripts or the standard verification path.

Targeted scans found no new unsupported claims. `overview.md:38-40` continues to state that full workspace layout, final visual redesign, full panel migration, final toolbox/modal/window framework, Diagnostics / Evidence View, Codex / Automation View, Mesh generation/tool, Texture Atlas Task, Parameter Manager, and Variant / Expression Manager UI remain unimplemented.

## Basis Documents Used

- `.agents/skills/implementation-orchestration/SKILL.md` was not present in the workspace basis path, so `C:/Users/remie/.codex/skills/implementation-orchestration/SKILL.md` was used.
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave51-plan.md`
- Wave51 Domain A-E reports under `discussion/implementation/waves/wave51/**`
- Wave51 Domain A-E reviews under `discussion/implementation/reviews/wave51/**`
- The requested changed docs and traceability files.

## Initial Finding Status

1. Resolved. The original finding was that `discussion/design/screen-design/overview.md:175` left a stale unresolved question for `UX-FEAT-018` / `UX-FEAT-019`: whether production `data-testid` coupling must be resolved before screen separation. That line has been replaced with post-Wave51 debt wording.

   The targeted production `data-testid` coupling removal remains recorded as completed at `discussion/design/screen-design/overview.md:31`, `discussion/design/screen-design/scope-and-principles.md:39`, `discussion/design/screen-design/screens/psd-import-task.md:187`, and `discussion/design/screen-design/inventories/codex-test-evidence-dependency.md:149`.

## Confirmed Correct

- Wave50 remains the latest final implementation-proven baseline until Wave51 final integration passes: `discussion/_map.md:38`, `discussion/_map.md:56`, `discussion/implementation/_map.md:310-312`, `discussion/implementation/orchestration/_map.md:66`.
- Wave51 Domains A-E are described as final-integration-pending screen-design foundation only: `discussion/design/screen-design/_map.md:27-28`, `discussion/design/screen-design/scope-and-principles.md:37-44`, `discussion/implementation/current-capability-map.md:144-154`, `discussion/implementation/remaining-work-backlog.md:21`.
- Remaining screen-design waves are left as future work, including Workspace Layout, PSD Import Task migration, Diagnostics / Evidence separation, and Codex / Automation separation: `discussion/design/screen-design/_map.md:43-46`, `discussion/design/screen-design/scope-and-principles.md:157`, `discussion/implementation/remaining-work-backlog.md:56`.
- The production `data-testid` guard is recorded as standalone, not wired into `package.json`, defaulting to `apps/editor/src`, and static regex/text based rather than AST/runtime analysis: `discussion/tests/traceability/test-traceability-matrix.md:66`, `discussion/tests/traceability/test-traceability-matrix.md:70-71`, `discussion/tests/traceability/test-traceability-matrix.md:126`, `discussion/tests/fixtures/fixture-manifest.md:71`, `discussion/tests/fixtures/fixture-manifest.md:116`.
- No unsupported Mesh / Atlas / Parameter / Variant UI progress, full visual redesign, structural-specific Codex execute/stale parity, external transport, renderer/pixel oracle, Cubism support, or public demo asset work is claimed in the Wave51 additions reviewed.

## Verification Commands / Results

- Re-review: `git diff --check -- discussion/design/screen-design/overview.md`
  - Passed. Git emitted LF/CRLF warning only.
- Re-review: `git diff -- discussion/design/screen-design/overview.md`
  - Confirmed the stale unresolved question was replaced with post-Wave51 debt wording at the unresolved-items section.
- Re-review: `rg -n "UX-FEAT-018|UX-FEAT-019|production `data-testid`|data-testid|DOM/text|structured observation|PSD Import Task|package script|guard|解消する必要があるか|未決事項|post-Wave51|後続wave" discussion/design/screen-design/overview.md`
  - Confirmed the old `解消する必要があるか` wording is gone and the new unresolved items cover DOM/text oracle migration, structured observation consumption, and package-script / standard verification integration for the guard.
- Re-review: `rg -n "Mesh|Atlas|Parameter|Variant|full visual|visual redesign|panel migration|実装済み|完了|implementation-proven|UI/e2e proven|structural-specific|Codex execute|stale|external transport|renderer|Cubism|public demo|proposal generation|semantic recognition|auto-fix" discussion/design/screen-design/overview.md`
  - Confirmed the relevant Wave51 implementation-status lines remain conservative and no unsupported capability claim was introduced.
- `git diff --check -- discussion`
  - Passed. Git emitted LF/CRLF warnings only.
- `git diff --name-only -- discussion`
  - Returned only the 16 requested tracked Domain F docs/traceability paths.
- `git status --short -uall -- discussion`
  - Before this review artifact, showed the 16 modified Domain F docs/traceability files plus untracked Wave51 plan/report/review basis artifacts.
- `git diff --name-only -- package.json pnpm-lock.yaml pnpm-workspace.yaml`
  - No output; package script/lock/workspace files are unchanged.
- Targeted `rg -n` scans for `Wave51`, `final baseline`, `data-testid`, `package.json`, `Mesh`, `Atlas`, `Parameter`, `Variant`, `full visual redesign`, `structural-specific`, `DOM/text`, `Product Preflight`, and `structured observation`.
  - Found the stale `overview.md:175` question above.
  - Otherwise confirmed conservative Wave51 status and residual-risk wording.

No unit, integration, e2e, or source guard commands were rerun for this Domain F docs review. Domain E's guard/e2e evidence was checked through the Domain E report/review and the docs/traceability registration.

## Residual Risks / Deferred Debt

- Wave51 final integration / clean review remains pending.
- The production `data-testid` guard is standalone, not package-script integrated, and can miss dynamic selector construction or indirect aliases.
- The guard's default production scan root is `apps/editor/src` unless future invocations add `--source-root`.
- PSD Import Task structured observation is prepared but not consumed by UI, E2E, or Codex-facing read APIs.
- Existing DOM/text oracles remain intentionally in place.
- Product Preflight current-state DOM-independent read, structural-specific Codex execute/stale parity, full Diagnostics / Evidence View, full Codex / Automation View, and full workspace visual migration remain future work.

## User-Decision Points

None for the current fix. Future planning still needs a priority decision among Workspace Layout Migration, PSD Import Task Migration, Diagnostics / Evidence View Separation, Codex / Automation View Separation, and standard package-script integration for the production `data-testid` guard.
