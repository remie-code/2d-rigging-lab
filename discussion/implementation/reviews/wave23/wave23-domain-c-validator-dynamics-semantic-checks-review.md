# Wave 23 Domain C Review: Validator Dynamics Semantic Checks

Verdict: `pass`

Orch-Sylph自身は実装担当ではない。source implementation は必ず別コンテキストの Gnome に委譲し、レビューは必ず別コンテキストの Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。

## Scope Reviewed

- Domain C source scope:
  - `packages/validator-core/src/validators/dynamics-semantic.ts`
  - `packages/validator-core/src/dynamics-semantic.test.ts`
  - `packages/validator-core/src/check-catalog.ts`
  - `packages/validator-core/src/validators/package-runtime.ts`
  - `packages/validator-core/src/validator-core.test.ts`
  - `packages/validator-core/src/index.ts`
  - `discussion/design/module-contracts/validator-contract.md`
- Parallel Wave 23 changes under `packages/authoring-core`, `packages/operation-core`, and `packages/runtime-core` are present in the working tree. They were treated as Domain A/B context, not Domain C implementation, except where runtime snapshot DTO shape was needed to review validator evidence.

## Findings

No blocking, high, medium, or low findings.

## Review Evidence

- Minimum Open Dynamics v1 semantics are in Domain C scope: package schema defines `authoredInput` / `computedDynamics` parameters, `scalarDampedFollowV1` dynamics groups, drivers, output, settings, and reset policy (`packages/package-format/src/model-files.ts:49`, `packages/package-format/src/model-files.ts:120`, `packages/package-format/src/model-files.ts:129`, `packages/package-format/src/model-files.ts:148`).
- The new validator covers computed dynamics producer gaps, missing driver/output parameters, wrong driver/output parameter source, output-as-driver dependency, duplicate output targets, output range gaps, unsafe settings, and runtime evidence gaps (`packages/validator-core/src/validators/dynamics-semantic.ts:95`, `packages/validator-core/src/validators/dynamics-semantic.ts:118`, `packages/validator-core/src/validators/dynamics-semantic.ts:167`, `packages/validator-core/src/validators/dynamics-semantic.ts:208`, `packages/validator-core/src/validators/dynamics-semantic.ts:242`, `packages/validator-core/src/validators/dynamics-semantic.ts:249`).
- Runtime evidence gap is visible without implementing evaluator behavior: the validator consumes already-supplied `RuntimeSnapshotDto` evidence and emits `dynamics.runtimeEvidenceMissing` when no parsed snapshot exists, a snapshot omits an enabled group, or computed output parameter evidence is absent (`packages/validator-core/src/validators/package-runtime.ts:33`, `packages/validator-core/src/validators/package-runtime.ts:86`, `packages/validator-core/src/validators/dynamics-semantic.ts:258`, `packages/validator-core/src/validators/dynamics-semantic.ts:282`, `packages/validator-core/src/validators/dynamics-semantic.ts:309`).
- Diagnostics are deterministic and AI-readable: groups are sorted by `dynamicsGroupId`, drivers by driver/source/index, producers by parameter ID, and each check includes stable `checkId`, `target`, `targetPath`, message, evidence, impact, and snapshot IDs where applicable (`packages/validator-core/src/validators/dynamics-semantic.ts:33`, `packages/validator-core/src/validators/dynamics-semantic.ts:158`, `packages/validator-core/src/validators/dynamics-semantic.ts:656`, `packages/validator-core/src/validators/dynamics-semantic.ts:683`, `packages/validator-core/src/validators/dynamics-semantic.ts:692`).
- Check catalog alignment is scoped and direct: Domain C adds dynamics phases and definitions for the implemented IDs (`packages/validator-core/src/check-catalog.ts:13`, `packages/validator-core/src/check-catalog.ts:320`). The validator contract doc edit is small and tied to `dynamics.runtimeEvidenceMissing` (`discussion/design/module-contracts/validator-contract.md:112`, `discussion/design/module-contracts/validator-contract.md:134`).
- Source organization is acceptable: `dynamics-semantic.ts` owns one validator concern, `package-runtime.ts` only wires it into the existing validation pipeline, and `index.ts` remains a barrel export (`packages/validator-core/src/validators/dynamics-semantic.ts:28`, `packages/validator-core/src/validators/package-runtime.ts:86`, `packages/validator-core/src/index.ts:15`).
- Non-goals were respected for Domain C: no operation handler implementation, no runtime evaluator implementation, no editor UI, no asset I/O/file picker/parser, no dependency manifest or lockfile changes, and no Cubism Physics compatibility implementation or claim. A forbidden-scope scan over changed Domain C files only found pre-existing catalog descriptions for PSD compatibility and demo unsafe dependency diagnostics.

## Test Adequacy

- Valid minimal dynamics package with runtime evidence is covered (`packages/validator-core/src/dynamics-semantic.test.ts:19`).
- Invalid relation deterministic diagnostics are covered for missing driver and missing output with stable check IDs, target IDs, target paths, and evidence order (`packages/validator-core/src/dynamics-semantic.test.ts:34`).
- Runtime evidence gap without a snapshot is covered (`packages/validator-core/src/dynamics-semantic.test.ts:94`).
- Unsafe output/settings diagnostics are covered (`packages/validator-core/src/dynamics-semantic.test.ts:115`).
- Existing source, binary, PSD, minimal fixture, and report artifact validators remained green in the full `packages/validator-core/src` test run.

## Verification

- `pnpm.cmd exec vitest run packages/validator-core/src/dynamics-semantic.test.ts packages/validator-core/src/validator-core.test.ts`: pass, 2 files / 9 tests.
- `pnpm.cmd exec vitest run packages/validator-core/src`: pass, 9 files / 53 tests.
- `pnpm.cmd typecheck`: pass.
- `git diff --check -- packages/validator-core discussion/implementation/waves/wave23 discussion/implementation/reviews/wave23 discussion/design/module-contracts/validator-contract.md`: pass; Git emitted LF-to-CRLF working-copy warnings only.
- `git diff --name-only -- package.json pnpm-lock.yaml pnpm-workspace.yaml apps/editor/package.json packages/*/package.json`: pass; no dependency manifest or lockfile changes.
- `rg -n "[ \t]+$" packages/validator-core/src/dynamics-semantic.test.ts packages/validator-core/src/validators/dynamics-semantic.ts`: pass; no trailing whitespace in untracked Domain C files.

## Residual Risks

- Some implemented edge diagnostics are code-reviewed but not individually pinned by focused tests in this domain: duplicate output target, wrong source type, output used as driver, runtime snapshot group/parameter mismatch, runtime output out of range, and output clamped. This is acceptable for the Domain C gate because the requested core cases and the full validator-core compatibility suite pass, but Wave 23 fixture/evidence work should pin representative outputs for those IDs.
- Domain B runtime-core changes are parallel and unreviewed here. This review only confirmed that Domain C consumes `RuntimeSnapshotDto` evidence without implementing runtime evaluator behavior.

## Fix Loop / Decisions

- Gnome fix loop required: no.
- User-decision points: none.
