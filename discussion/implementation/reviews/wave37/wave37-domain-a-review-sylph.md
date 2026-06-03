# Wave37 Domain A Review-Sylph

Date: 2026-06-03
Target: `wave37-archive-filesystem-capability-contract-foundation`
Verdict: `pass`

Clean-context review for Domain A. I reviewed source-of-truth docs, the scoped diff, untracked source files, focused tests, and independent verification output. I did not rely on Gnome's report as the sole basis and did not edit source implementation files.

## Findings

No blocking, warning, or needs-fix findings.

Advisory only:

- Future hardening could add negative schema tests for contradictory gated metadata, for example a `dependency-gated` or `future-gated` capability whose gate status is `notRequired`. The current catalog itself uses deterministic `open` gates, tests pin the supported/unsupported/gated catalog shape, and this is not blocking for Domain A.

## Review Lanes

### 1. Design / Development Compliance Review

Result: `pass`

- `packages/contracts/src/package-transport-capability.ts` defines an additive Zod DTO/schema/catalog boundary for package transport capability status.
- The catalog truthfully records `projectDefinedJsonBundleV0` as the only `supported` transport and binds it to Wave36 `portable-package-bundle-v0` / `project-defined-json-bundle-v0`.
- ZIP/archive is represented as `dependency-gated`; File System Access API, directory picker, and drag-drop are represented as `future-gated`; native OS filesystem persistence is represented as `unsupported`.
- `packages/package-format/src/package-transport-capabilities.ts` is a thin binding over the contracts catalog and existing portable bundle schemas. It does not add writer/importer behavior for archive/filesystem routes.
- `packages/contracts/src/index.ts` and `packages/package-format/src/index.ts` remain barrel-only exports.
- No broad catch-all source file, external dependency, manifest change, or lockfile change was introduced.
- Changed Domain A files contain no ZIP/compression implementation, File System Access API, directory picker, drag-drop implementation, PSD/PNG parser, image decode, Cubism compatibility implementation, full renderer, or pixel oracle.

### 2. Test Adequacy Review

Result: `pass`

- `packages/contracts/src/package-transport-capability.test.ts` covers catalog parsing, exactly one supported Wave36 portable transport, archive/filesystem exclusion from supported status, gated/unsupported issue requirements, and invalid portable bundle support/binding claims.
- `packages/contracts/src/contracts-integration.test.ts` covers public contracts export of the new catalog/schema.
- `packages/package-format/src/package-transport-capabilities.test.ts` covers package-format binding to portable bundle v0 and ensures archive/filesystem/directory picker/drag-drop/native filesystem entries are not exposed as supported.
- Existing Wave36 portable bundle tests were rerun with the Domain A focused tests to guard supported route compatibility.

### 3. Orchestration Compliance Review

Result: `pass`

- Based on the assignment process facts and artifact separation, Orch-Sylph inspected basis/source, delegated source edits to Gnome, reran focused verification, and delegated this independent Review-Sylph review.
- Gnome's implementation artifact is present at `discussion/implementation/waves/wave37/wave37-domain-a-gnome-implementation-report.md`.
- This Review-Sylph run wrote only this review artifact under `discussion/implementation/reviews/wave37/`.
- I found no evidence in the reviewed artifacts that Orch-Sylph implemented source itself.

## Verification Performed

Read / inspection:

- Read implementation orchestration skill and Wave37 plan.
- Read current capability map, remaining backlog, Wave36 final report, and Wave36 clean integration review.
- Read source organization, dependency, and schema/ID policies.
- Read package file format contract, fixture manifest, and traceability matrix.
- Inspected scoped git status/diff and untracked Domain A files.
- Inspected changed source/test files and package manifests.

Commands rerun in this review:

- `pnpm.cmd exec vitest run packages/contracts/src/package-transport-capability.test.ts packages/contracts/src/contracts-integration.test.ts packages/package-format/src/package-transport-capabilities.test.ts packages/package-format/src/portable-package-bundle-contract.test.ts packages/package-format/src/portable-package-bundle.test.ts`
  - Result: pass, 5 files / 24 tests.
- `pnpm.cmd typecheck`
  - Result: pass.
- `git diff --check -- packages\contracts\src packages\package-format\src discussion\implementation\waves\wave37`
  - Result: pass; LF-to-CRLF working-copy warnings only.
- `git diff -- package.json pnpm-lock.yaml pnpm-workspace.yaml packages\contracts\package.json packages\package-format\package.json`
  - Result: no output.
- Forbidden API/dependency scan on changed Domain A files for File System Access APIs, drag/drop APIs, archive dependencies, image decode dependencies, Cubism/Live2D terms, `.moc3`, and `.model3`.
  - Result: no matches.

Sandbox note: sandboxed PowerShell reads failed with `windows sandbox: spawn setup refresh`, so necessary read and verification commands were rerun through the approved escalated path.

## Files Reviewed

- `packages/contracts/src/package-transport-capability.ts`
- `packages/contracts/src/package-transport-capability.test.ts`
- `packages/contracts/src/contracts-integration.test.ts`
- `packages/contracts/src/index.ts`
- `packages/contracts/package.json`
- `packages/package-format/src/package-transport-capabilities.ts`
- `packages/package-format/src/package-transport-capabilities.test.ts`
- `packages/package-format/src/index.ts`
- `packages/package-format/package.json`
- `discussion/implementation/waves/wave37/wave37-domain-a-gnome-implementation-report.md`
- `discussion/implementation/orchestration/wave37-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/waves/wave36/wave36-final-report.md`
- `discussion/implementation/reviews/wave36/wave36-clean-integration-review-sylph.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/design/module-contracts/package-file-format-contract.md`
- `discussion/tests/fixtures/fixture-manifest.md`
- `discussion/tests/traceability/test-traceability-matrix.md`

## Remaining Issues

No Domain A source fix is required.

Downstream Wave37 domains still need to consume this capability contract for package-format boundary guards, validator diagnostics, Editor UI truthfulness, and e2e/fixture guardrails. Domain A intentionally does not implement those runtime/UI/validator behaviors.

## User-Decision Points

None for Domain A.

Future decisions remain outside this Domain A pass: ZIP/archive dependency approval, File System Access API or directory picker adoption, drag-drop UX, OS filesystem persistence, cloud/cross-profile persistence, and parser/image decode dependency scope.
