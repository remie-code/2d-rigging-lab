# Wave35 Domain C Design / Development Compliance Review

Date: 2026-06-03

verdict: `pass`

## Review Lane

Design / Development Compliance Review for
`wave35-validator-persistent-storage-availability-diagnostics`.

This review used clean, repository-grounded context. I read the wave/policy/contract
basis documents, Domain A contract/evaluator source, Domain C source/test/doc files,
current status, diffs, and verification output directly.

## Findings

No blocking findings.

No design/development compliance issue was found in the Domain C changed files.

## Scope Attribution

Domain C allowed scope is validator-core source, focused validator tests,
`validator-contract.md` if directly required, and Wave35 reports/reviews
(`discussion/implementation/orchestration/wave35-plan.md:173`,
`:180-198`).

Domain C target path status showed only:

- `discussion/design/module-contracts/validator-contract.md`
- `packages/validator-core/src/check-catalog.ts`
- `packages/validator-core/src/validators/byte-intake-preflight.ts`
- `discussion/implementation/waves/wave35/wave35-domain-c-validator-persistent-storage-availability-diagnostics-completion-report.md`
- `packages/validator-core/src/persistent-byte-availability.test.ts`
- `packages/validator-core/src/validators/persistent-byte-availability-diagnostics.ts`

The broader current worktree also showed `apps/editor/**` and `packages/package-format/**`
movement. Per Orch-Sylph's attribution note, the `apps/editor/**` entries appeared after
the immediate post-Gnome Domain C status and are treated here as concurrent Domain B/editor
work, not Domain C. The `packages/package-format/**` entries are Domain A basis files.
The Domain C diff itself does not edit or import `apps/editor/**`, and it consumes the
Domain A package-format contract/evaluator read-only.

## Compliance Evidence

- Domain C uses the Domain A evaluator through package-format imports and calls
  `evaluatePackageBinaryPersistentByteAvailability` from the new validator adapter
  (`packages/validator-core/src/validators/persistent-byte-availability-diagnostics.ts:3`,
  `:68-84`). It does not change package-format.
- The Domain A contract/evaluator basis is stable and specific to same-origin
  browser-local storage: backend schema (`packages/package-format/src/persistent-binary-storage-contract.ts:14`),
  issue codes (`:82`), stored record DTO (`:128`), availability report DTO (`:147`),
  and evaluator flow (`packages/package-format/src/persistent-binary-storage.ts:76`,
  `:92-110`, `:465`).
- Persistent diagnostics run only when persistent evidence or an explicit expectation is
  supplied (`packages/validator-core/src/validators/persistent-byte-availability-diagnostics.ts:87-94`).
- The validator check evidence is deterministic and AI-readable: it maps each Domain A
  issue to `ValidationCheckResultDto` with stable check ID, status/severity, target,
  targetPath, package identity/revision, expected/actual metadata, and persistent issue
  source/path evidence (`packages/validator-core/src/validators/persistent-byte-availability-diagnostics.ts:96-145`).
- Byte-intake preflight integration is narrow: it extends the preflight asset input with
  persistent fields (`packages/validator-core/src/validators/byte-intake-preflight.ts:44`),
  runs the persistent adapter before existing current-session availability (`:123-130`),
  and avoids `binary.bytesMissing` when valid persistent availability evidence exists
  (`:141-160`).
- Check catalog registration uses dot-separated lower camelCase IDs consistent with the
  schema/ID convention (`discussion/development_convention/schema-and-id-conventions.md:126`,
  `:156`). The catalog entries are registered under `persistentByteStorage.*`
  (`packages/validator-core/src/check-catalog.ts:388-484`).
- Tests pin the required design cases: catalog registration (`packages/validator-core/src/persistent-byte-availability.test.ts:34`),
  valid verified browser-local persistent bytes without current-session bytes (`:50`),
  missing record (`:77`), missing stored bytes (`:116`), corrupt re-read bytes without
  parser/decode claims (`:157`), stale package revision/binary metadata (`:211`), and
  unavailable/unsupported backend states (`:268`).
- The validator contract doc update is narrow and consistent with the new behavior:
  it says `persistentByteStorage.*` checks are limited to browser-local persistent
  storage evidence/expectation, valid verified same-origin bytes produce no check,
  bad evidence emits deterministic diagnostics, and no archive/File System Access API/
  parser/image decode support is claimed
  (`discussion/design/module-contracts/validator-contract.md:240`).
- Source organization is compliant. No Domain C `index.ts` was edited. The package-format
  `index.ts` basis file remains barrel-only exports (`packages/package-format/src/index.ts:1-19`),
  consistent with the source-file organization policy
  (`discussion/development_convention/source-file-organization-policy.md:26-46`).
- Dependency policy is satisfied: no dependency manifest/lockfile changes were present
  in the checked manifest paths, and Domain C source imports only existing workspace
  packages/local modules. The policy requires approval evidence before manifest/lockfile
  dependency changes (`discussion/development_convention/dependency-policy.md:76`,
  `:311-313`).

## Forbidden Scope Check

The Domain C touched-file scan for archive, File System Access API, drag-drop, parser,
image decode, external dependency, Cubism, full renderer, pixel oracle, localStorage,
base64, and zip terms found only:

- existing byte-intake unsupported-claim wording,
- explicit non-goal documentation,
- the IndexedDB backend evidence string,
- negative test assertions.

No Editor IndexedDB adapter, e2e implementation, archive implementation, File System
Access API use, parser/image decode implementation, external dependency, Cubism/full
renderer/pixel-oracle implementation, or positive unsupported claim was found in the
Domain C changed files.

## Verification Performed

- `git diff -- packages/validator-core/src/validators/persistent-byte-availability-diagnostics.ts packages/validator-core/src/validators/byte-intake-preflight.ts packages/validator-core/src/check-catalog.ts packages/validator-core/src/persistent-byte-availability.test.ts discussion/design/module-contracts/validator-contract.md discussion/implementation/waves/wave35/wave35-domain-c-validator-persistent-storage-availability-diagnostics-completion-report.md`
  - inspected together with direct reads of untracked Domain C files.
- `git status --short -uall` and focused status checks for Domain C target paths,
  dependency manifests/lockfiles, and forbidden-scope paths.
- `git diff --check -- packages/validator-core/src/check-catalog.ts packages/validator-core/src/validators/byte-intake-preflight.ts discussion/design/module-contracts/validator-contract.md discussion/implementation/waves/wave35/wave35-domain-c-validator-persistent-storage-availability-diagnostics-completion-report.md`
  - exit 0; Git emitted LF-to-CRLF working-copy warnings for tracked files.
- `rg -n "[ \t]$|^<<<<<<<|^=======|^>>>>>>>" packages/validator-core/src/validators/persistent-byte-availability-diagnostics.ts packages/validator-core/src/persistent-byte-availability.test.ts`
  - no matches; `rg` exited 1 because nothing matched.
- `pnpm.cmd exec vitest run packages/validator-core/src/persistent-byte-availability.test.ts packages/validator-core/src/byte-intake-availability.test.ts packages/validator-core/src/binary-asset-validator.test.ts`
  - pass, 3 files / 22 tests.
- `pnpm.cmd typecheck`
  - pass.

Environment note: sandboxed shell startup failed with `windows sandbox: spawn setup
refresh`, so read-only inspection and verification commands were run through the
approved escalated command path.

## Remaining Issues

No remaining Domain C design/development compliance issues.

Non-blocking scope notes:

- Domain B still needs to supply real editor persistent-storage evidence from its
  IndexedDB adapter; Domain C only consumes evidence and maps diagnostics.
- `persistentByteStorage.backend.mismatch` is registered because Domain A exposes the
  issue code. With the current one-value backend enum, it remains defensive/unreachable
  for valid DTOs until a future contract adds another backend.

## User-Decision Points

None for Domain C.

Escalation would be needed only if later work requires archive persistence, File System
Access API, cloud/cross-origin guarantees, parser/image decode dependencies, Cubism
compatibility, full renderer behavior, or pixel oracle claims.

## Reviewer Conduct

I did not edit source implementation files, package manifests, lockfiles, fixtures,
editor files, package-format files, or e2e files. The only file written by this review is
`discussion/implementation/reviews/wave35/wave35-domain-c-design-development-compliance-review.md`.
