# Wave52 Domain F Review: Documentation / Traceability / Screen Design Refresh

- verdict: `pass`
- reviewer role: independent clean Review-Sylph
- target: `wave52-docs-traceability-screen-design-refresh`

## Scope Reviewed

Reviewed Domain F Gnome-reported documentation files:

- `discussion/_map.md`
- `discussion/design/screen-design/_map.md`
- `discussion/design/screen-design/overview.md`
- `discussion/design/screen-design/scope-and-principles.md`
- `discussion/design/screen-design/screens/psd-import-task.md`
- `discussion/design/screen-design/inventories/codex-test-evidence-dependency.md`
- `discussion/design/screen-design/inventories/feature-inventory-and-classification.md`
- `discussion/implementation/_map.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/orchestration/_map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/tests/fixtures/fixture-manifest.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/implementation/waves/wave52/wave52-domain-f-docs-traceability-screen-design-refresh-report.md`

Basis used: Wave52 plan; Domain A-E reports and reviews; Domain F report; the changed documentation above; `.agents/skills/implementation-orchestration/SKILL.md`; `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`.

## Findings

Blocking findings: none.

- Domain D/E support the bounded PSD Import Task Migration statements. Domain D reports PSD Import is reachable as a Task Shell task and is no longer appended as an always-visible workspace panel by default (`discussion/implementation/waves/wave52/wave52-domain-d-psd-import-task-integration-observation-bridge-report.md:11`, `:58`). Domain D review independently confirms the launcher/task-shell routing and narrow observation consumption (`discussion/implementation/reviews/wave52/wave52-domain-d-psd-import-task-integration-observation-bridge-review.md:48`, `:51`).
- Domain E supports the focused regression and guard claims. It records all five required focused PSD IDs as passed and records `check:testids` in standard `check` while keeping `check:testids:fixtures` outside standard `check` (`discussion/implementation/waves/wave52/wave52-domain-e-focused-regression-and-guard-integration-report.md:47`, `:50`, `:93`-`:99`). The clean Domain E review repeats the same package-script boundary and focused-regression evidence (`discussion/implementation/reviews/wave52/wave52-domain-e-focused-regression-and-guard-integration-review.md:54`-`:58`, `:78`-`:90`).
- Domain F does not claim Wave52 as the final implementation-proven baseline before Domain G. Top-level and implementation maps keep Wave51 as the latest final baseline until Wave52 Domain G final integration passes (`discussion/_map.md:56`, `discussion/implementation/current-capability-map.md:3`, `discussion/implementation/remaining-work-backlog.md:142`).
- Screen-design completion remains explicitly incomplete. The refreshed screen-design docs state Wave52 is bounded to PSD Import task reachability/panel placement and leaves full workspace layout, full visual redesign, final toolbox, modal/task-window/dedicated-view policy, Diagnostics / Evidence final view, Codex / Automation final view, and Mesh / Atlas / Parameter / Variant UI unfinished (`discussion/design/screen-design/overview.md:40`-`:42`, `discussion/design/screen-design/scope-and-principles.md:55`, `discussion/design/screen-design/screens/psd-import-task.md:191`).
- Mesh / Atlas / Parameter / Variant progress is not newly claimed from Wave52. Current references are either existing historical capability rows, future/deferred design specs, or explicit non-goal / not-completed statements. Domain B/D/E reviews also reject forbidden product-scope drift (`discussion/implementation/waves/wave52/wave52-domain-b-generic-task-shell-task-chrome-component-report.md:47`, `discussion/implementation/reviews/wave52/wave52-domain-d-psd-import-task-integration-observation-bridge-review.md:56`, `discussion/implementation/reviews/wave52/wave52-domain-e-focused-regression-and-guard-integration-review.md:103`).
- Traceability and fixture docs no longer state as a current fact that the production `data-testid` guard is not wired into package scripts. Remaining "not wired" wording is historical and anchored to the Wave51 boundary, with Wave52 standard-check integration called out separately (`discussion/tests/traceability/test-traceability-matrix.md:66`, `:130`; `discussion/tests/fixtures/fixture-manifest.md:71`, `:118`; `discussion/implementation/current-capability-map.md:152`).
- Remaining screen-design migration waves are recorded as future/deferred work, including Workspace Layout Migration, Diagnostics / Evidence separation, Codex / Automation separation, PSD Import final placement/navigation polish, broader DOM/text oracle migration, and fixture-guard quality-gate placement (`discussion/design/screen-design/_map.md:43`-`:47`, `discussion/implementation/remaining-work-backlog.md:57`, `:81`, `:93`-`:94`).
- Domain F report contains the requested fields: verdict, documentation summary and changed files, verification commands/results, residual risks/deferred debt, Domain G start condition, and user-decision points (`discussion/implementation/waves/wave52/wave52-domain-f-docs-traceability-screen-design-refresh-report.md:7`-`:21`, `:23`-`:57`, `:59`-`:70`).
- Domain F stayed within its reported documentation scope. The Domain F report lists only discussion documentation/report files (`discussion/implementation/waves/wave52/wave52-domain-f-docs-traceability-screen-design-refresh-report.md:23`-`:38`). The full worktree still contains A-E source/test/package changes, including `package.json`, so this review does not infer those were made by Domain F; it treats them as prior-domain dirty state.

## Verification Performed

- `git diff --check -- discussion`
  - Result: pass; LF/CRLF working-copy warnings only.
- `git status --short -uall discussion`
  - Result: discussion changes are the Domain F changed docs plus Wave52 plan/reports/reviews; before writing this review, no non-discussion file appeared in the scoped `discussion` status.
- `git diff --stat -- discussion`
  - Result: 13 tracked discussion files changed, `118 insertions(+), 63 deletions(-)`, with LF/CRLF warnings.
- Targeted stale guard search:
  - Command searched `not wired`, `未統合`, `not integrated`, package-script integration wording, and standard verification path wording across the changed docs and Wave52 artifacts.
  - Result: remaining hits are historical Wave51-boundary statements or Domain F's own verification text; current Wave52 status says `check:testids` is in standard `check`, while `check:testids:fixtures` remains outside standard `check`.
- Targeted unsupported-completion / forbidden-scope search:
  - Command searched full screen-design completion, full visual redesign completion, PSD Import Task Migration completion/final wording, and Mesh / Atlas / Parameter / Variant done/progress/pass wording across changed docs and Wave52 artifacts.
  - Result: hits are bounded Wave52 PSD Import statements, explicit non-goal/deferred-debt statements, historical plan/review wording, or pre-existing unrelated historical capability references. No unsupported current Wave52 completion claim found.
- `git diff -- package.json`
  - Result: confirms `check:testids` and `check:testids:fixtures` script entries exist, and standard `check` appends only `pnpm run check:testids`.

## Residual Risks / Deferred Debt

- This review did not rerun source, unit, or E2E tests. It relies on Domain D/E reports and clean reviews for source/test verification.
- Wave52 is still not a final implementation-proven baseline until Domain G final integration and clean review pass.
- The production `data-testid` guard remains static text/regex protection and can miss dynamic selector construction or indirect aliases.
- `check:testids:fixtures` remains available but outside standard `check`; broader CI or quality-gate placement is still deferred.
- Full screen-design migration remains incomplete: final Toolbox placement, final modal/task-window/dedicated-view policy, full visual redesign, Diagnostics / Evidence final view, Codex / Automation final view, broad DOM/text oracle migration, and Mesh / Atlas / Parameter / Variant UI waves remain future work.

## Domain G Start Condition

Domain G may start after this Domain F clean review is accepted by the parent orchestration context. Domain G must still perform final integration review/reporting and must not treat Wave52 as final baseline until that gate passes.

## User-Decision Points

- No immediate user decision is required for Domain F.
- Future user decisions remain: next screen-design migration boundary, PSD Import final placement/navigation policy, final toolbox/modal/task-window/dedicated-view policy, and whether `check:testids:fixtures` belongs in a broader standard quality gate or CI-only path.
