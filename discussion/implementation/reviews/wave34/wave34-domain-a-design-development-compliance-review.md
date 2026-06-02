# Wave34 Domain A Design / Development Compliance Review

verdict: pass

Review target: `wave34-byte-availability-direct-call-contract-foundation`

Review lane: Design / Development Compliance Review only.

Review mode: clean, repository-grounded. I did not rely on implementer summary as the only basis and did not edit source files.

## Findings

No blocking design/development compliance findings.

Non-blocking ownership note: `git status --short -uall` shows Wave34 orchestration prep changes in `discussion/implementation/orchestration/_map.md` and untracked `discussion/implementation/orchestration/wave34-plan.md`. Those paths are outside Domain A's implementation allowed write scope in `discussion/implementation/orchestration/wave34-plan.md:123` and are treated here as parent/orchestration basis changes, not Domain A source implementation. Orch-Sylph should keep that ownership explicit before final Domain A close-out. No Domain A source fix is required.

## Evidence Checked

Basis documents read:

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave34-plan.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/design/module-contracts/package-file-format-contract.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/waves/wave31/wave31-final-report.md`
- `discussion/implementation/reviews/wave31/wave31-clean-integration-review.md`
- `discussion/implementation/waves/wave33/wave33-final-report.md`
- `discussion/implementation/reviews/wave33/wave33-clean-integration-review.md`

Repository evidence inspected:

- `git status --short -uall` before this artifact showed:
  - `M discussion/implementation/orchestration/_map.md`
  - `M packages/package-format/src/index.ts`
  - `?? discussion/implementation/orchestration/wave34-plan.md`
  - `?? discussion/implementation/waves/wave34/wave34-domain-a-byte-availability-contract-foundation-completion-report.md`
  - `?? packages/package-format/src/byte-availability-contract.ts`
  - `?? packages/package-format/src/byte-availability.test.ts`
  - `?? packages/package-format/src/byte-availability.ts`
- `git diff --stat` for tracked files showed only two insertions in `packages/package-format/src/index.ts` and two insertions in `discussion/implementation/orchestration/_map.md`; new files were inspected directly.
- `packages/package-format/src/index.ts:7` and `packages/package-format/src/index.ts:8` are re-export-only barrel additions.
- New Domain A source/test files inspected directly:
  - `packages/package-format/src/byte-availability-contract.ts`
  - `packages/package-format/src/byte-availability.ts`
  - `packages/package-format/src/byte-availability.test.ts`
  - `discussion/implementation/waves/wave34/wave34-domain-a-byte-availability-contract-foundation-completion-report.md`

Verification run independently:

- `pnpm.cmd exec vitest run packages/package-format/src/byte-availability.test.ts packages/package-format/src/byte-intake.test.ts packages/package-format/src/package-binary-file-set.test.ts`: pass, 3 files / 16 tests.
- `pnpm.cmd typecheck`: pass.
- `git diff --check -- packages/package-format/src/index.ts discussion/implementation/orchestration/_map.md`: no whitespace errors; LF-to-CRLF warnings only.
- `rg -n "[ \t]+$"` over new Domain A files and Wave34 plan/report: no trailing whitespace matches.
- Dependency manifest/lockfile status check over root/workspace/editor/contracts/package-format manifests and `pnpm-lock.yaml`: no output.

## Contract Semantics

The Domain A contract foundation covers the required direct-call byte availability semantics:

- Current-session available bytes and missing bytes are explicit states in `packages/package-format/src/byte-availability-contract.ts:16` and `packages/package-format/src/byte-availability-contract.ts:17`.
- Direct-call availability distinguishes current bytes, metadata mismatch, missing bytes, requires reupload, stale verified summary, and unsupported verification in `packages/package-format/src/byte-availability-contract.ts:26` through `packages/package-format/src/byte-availability-contract.ts:31`.
- Required issue codes include missing current-session bytes, requires reupload, stale summary, package revision mismatch, binary ref mismatch, digest mismatch, and byteLength mismatch in `packages/package-format/src/byte-availability-contract.ts:74` through `packages/package-format/src/byte-availability-contract.ts:81`.
- The public evaluator is `evaluatePackageBinaryCurrentSessionByteAvailability` at `packages/package-format/src/byte-availability.ts:41`.
- Missing current-session bytes are derived when no report is supplied or the report contains `binary.bytes.missing` at `packages/package-format/src/byte-availability.ts:105` through `packages/package-format/src/byte-availability.ts:114`.
- `requiresReupload` is derived without implementing storage persistence at `packages/package-format/src/byte-availability.ts:123` through `packages/package-format/src/byte-availability.ts:130`.
- Current-session report identity, digest, byteLength, and media type mismatches are checked at `packages/package-format/src/byte-availability.ts:179`, `packages/package-format/src/byte-availability.ts:193`, `packages/package-format/src/byte-availability.ts:206`, and `packages/package-format/src/byte-availability.ts:217`.
- Verified summary package ID, package revision, binary ref, digest, byteLength, and stale-summary checks are implemented at `packages/package-format/src/byte-availability.ts:306`, `packages/package-format/src/byte-availability.ts:317`, `packages/package-format/src/byte-availability.ts:329`, `packages/package-format/src/byte-availability.ts:343`, `packages/package-format/src/byte-availability.ts:356`, and `packages/package-format/src/byte-availability.ts:372`.
- Availability derivation returns `requires-reupload-v1`, `stale-verified-summary-v1`, `missing-current-session-bytes-v1`, `verification-unsupported-v1`, metadata mismatch, or available bytes deterministically at `packages/package-format/src/byte-availability.ts:423` through `packages/package-format/src/byte-availability.ts:445`.
- Tests cover available current-session bytes, missing vs requires-reupload, stale verified summary, package revision/binary ref/digest/byteLength mismatches, and current-session digest/byteLength mismatch at `packages/package-format/src/byte-availability.test.ts:23`, `packages/package-format/src/byte-availability.test.ts:63`, `packages/package-format/src/byte-availability.test.ts:100`, `packages/package-format/src/byte-availability.test.ts:133`, and `packages/package-format/src/byte-availability.test.ts:155`.

## Scope And Policy Confirmations

- Domain A allowed source/test paths include `packages/package-format/src/**`, focused package-format tests, `discussion/implementation/waves/wave34/**`, and `discussion/implementation/reviews/wave34/**` per `discussion/implementation/orchestration/wave34-plan.md:123`.
- Domain A forbids editor UI, broad validator implementation, archive/persistent storage/parser/image decode implementation, external dependency/manifest/lockfile changes, and `index.ts` implementation logic per `discussion/implementation/orchestration/wave34-plan.md:132`, `discussion/implementation/orchestration/wave34-plan.md:137`, and `discussion/implementation/orchestration/wave34-plan.md:138`.
- Public `index.ts` is barrel-only: `packages/package-format/src/index.ts:7` and `packages/package-format/src/index.ts:8` add only `export * from ...` statements.
- No giant catch-all source file found. New files have named responsibilities and manageable line counts:
  - `byte-availability-contract.ts`: 137 lines, DTO schemas/issue registry/report schema.
  - `byte-availability.ts`: 439 lines, evaluator and helpers for one byte availability concern.
  - `byte-availability.test.ts`: 228 lines, focused contract tests.
- No dependency manifest or lockfile changes were found.
- Import review found only existing dependencies/internal modules: `zod`, `@private-2d-rigging-lab/contracts`, package-format internals, and `vitest` in tests at `packages/package-format/src/byte-availability-contract.ts:1`, `packages/package-format/src/byte-availability-contract.ts:3`, `packages/package-format/src/byte-availability.ts:1`, and `packages/package-format/src/byte-availability.test.ts:1`.
- Forbidden-scope scan over Domain A files found only non-goal prose in the completion report and one negative test title/assertion at `packages/package-format/src/byte-availability.test.ts:155` and `packages/package-format/src/byte-availability.test.ts:195`.
- No validator/editor/persistent storage/archive/parser/image decode/File System Access API/drag-drop/external dependency/Cubism/full renderer/pixel oracle implementation was found in Domain A source changes.

## User-Decision Points

None for Domain A design/development compliance.

Orch-Sylph ownership note: keep the out-of-Domain-A orchestration plan/map changes parent-owned; do not attribute them to Domain A implementation output.
