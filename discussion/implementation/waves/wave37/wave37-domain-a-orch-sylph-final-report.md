# Wave37 Domain A Orch-Sylph Final Report

Date: 2026-06-03
Domain: `wave37-archive-filesystem-capability-contract-foundation`
Verdict: `pass`

## Gnome Result

Gnome implemented an additive package transport capability contract and a thin package-format binding.

Changed implementation files:

- `packages/contracts/src/package-transport-capability.ts`
- `packages/contracts/src/package-transport-capability.test.ts`
- `packages/contracts/src/contracts-integration.test.ts`
- `packages/contracts/src/index.ts`
- `packages/package-format/src/package-transport-capabilities.ts`
- `packages/package-format/src/package-transport-capabilities.test.ts`
- `packages/package-format/src/index.ts`
- `discussion/implementation/waves/wave37/wave37-domain-a-gnome-implementation-report.md`

Summary:

- Added a shared transport capability DTO/schema/catalog in `contracts`.
- Recorded `projectDefinedJsonBundleV0` as the only supported transport and bound it to Wave36 `portable-package-bundle-v0` / `project-defined-json-bundle-v0`.
- Recorded ZIP/archive as `dependency-gated`.
- Recorded File System Access API, directory picker, and drag-drop as `future-gated`.
- Recorded native OS filesystem persistence as `unsupported`.
- Added a package-format binding that validates the supported portable bundle metadata against existing portable bundle schemas.
- Kept public `index.ts` changes barrel-only.
- Did not add archive/filesystem implementation, Editor UI, validator broad implementation, parser/image decode, dependency manifest, or lockfile changes.

Gnome report: [wave37-domain-a-gnome-implementation-report.md](wave37-domain-a-gnome-implementation-report.md)

## Review-Sylph Result

Review artifact: [../../reviews/wave37/wave37-domain-a-review-sylph.md](../../reviews/wave37/wave37-domain-a-review-sylph.md)

Verdict: `pass`

Findings:

- No blocking, warning, or needs-fix findings.
- Advisory only: a future hardening test could reject contradictory gated metadata such as a dependency-gated or future-gated capability with a `notRequired` gate. This is non-blocking because the current catalog uses deterministic `open` gates and tests pin the supported/gated/unsupported catalog shape.

Review lanes:

- Design / Development Compliance: `pass`
- Test Adequacy: `pass`
- Orchestration Compliance: `pass`

## Verification

- `pnpm.cmd exec vitest run packages/contracts/src/package-transport-capability.test.ts packages/contracts/src/contracts-integration.test.ts packages/package-format/src/package-transport-capabilities.test.ts packages/package-format/src/portable-package-bundle-contract.test.ts packages/package-format/src/portable-package-bundle.test.ts`: pass, 5 files / 24 tests.
- `pnpm.cmd typecheck`: pass.
- `git diff --check -- packages\contracts\src packages\package-format\src discussion\implementation\waves\wave37`: pass, LF-to-CRLF working-copy warnings only.
- `git diff -- package.json pnpm-lock.yaml pnpm-workspace.yaml packages\contracts\package.json packages\package-format\package.json`: pass, no output.
- Review-Sylph reran the focused tests/typecheck/diff checks and scanned changed Domain A files for forbidden API/dependency terms; no matches.
- Source organization check: `packages/contracts/src/index.ts` and `packages/package-format/src/index.ts` remain barrel-only; no broad catch-all source file was added.

## Pass Evidence

- Capability contract is additive and does not claim ZIP/archive/filesystem support.
- Wave36 portable JSON bundle v0 is represented as the only supported package transport.
- ZIP/archive, File System Access API, directory picker, and drag-drop are represented as gated or unsupported boundaries, not working implementations.
- Public `index.ts` changes are barrel-only.
- No dependency manifest or lockfile changes were made.
- Review-Sylph verdict is `pass`.

## Remaining Issues

No Domain A source fix is required.

Downstream Wave37 domains still need to consume this contract for package-format boundary guards, validator diagnostics, Editor UI truthfulness, and e2e/fixture guardrails.

Existing unrelated worktree entries were observed and not reverted:

- `discussion/implementation/orchestration/_map.md`
- `discussion/implementation/orchestration/wave37-plan.md`

## User Decision Points

None for Domain A.

Future decisions remain outside Domain A: ZIP/archive dependency approval, File System Access API or directory picker adoption, drag-drop UX, OS filesystem persistence, cloud/cross-profile persistence, and parser/image decode dependency scope.

## Orchestration Separation

Followed.

- Orch-Sylph inspected basis and target context, but did not implement source.
- Source implementation was delegated to Gnome in a separate context.
- Review was delegated to a separate clean Review-Sylph context.
- Review-Sylph reviewed basis documents, changed files/diff, and rerun tests, not only Gnome's summary.
- No fix loop was required.
