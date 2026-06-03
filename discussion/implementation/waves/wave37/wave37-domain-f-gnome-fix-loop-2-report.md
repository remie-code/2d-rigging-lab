# Wave37 Domain F Gnome Fix Loop 2 Report

verdict: `done`

## 対象

Clean integration review の blocking finding:
非 canonical な archive/filesystem/browser intake/native filesystem capability evidence が `status: "supported"` を名乗ると silent pass できる問題。

## 変更ファイル

- `packages/contracts/src/package-transport-capability.ts`
- `packages/contracts/src/package-transport-capability.test.ts`
- `packages/validator-core/src/package-transport-capability-diagnostics.test.ts`
- `discussion/implementation/waves/wave37/wave37-domain-f-gnome-fix-loop-2-report.md`

`packages/validator-core/src/validators/package-transport-capability-diagnostics.ts` は schema-only fix で足りたため未変更。

## 修正内容

- `PackageTransportCapabilityDtoSchema` の `superRefine` に truthfulness guard を追加し、`projectDefinedJsonBundleV0` 以外の capability ID が `status: "supported"` を claim した場合は `path: ["status"]` の custom schema issue として拒否するようにした。
- contract test に、`standardArchiveZipV0` / `fileSystemAccessApiV0` / `directoryPickerV0` / `dragDropFileIntakeV0` / `nativeFilesystemPersistenceV0` の supported 偽装が単体 capability schema で reject される compact test を追加した。
- contract test に、catalog evidence 内の `standardArchiveZipV0` supported 偽装が catalog schema で reject される test を追加した。
- validator diagnostics test に、同じ supported 偽装が `transportCapability.schemaInvalid` として deterministic に報告される compact test を追加した。
- canonical catalog の status、package-format boundary semantics、validator implementation は変更していない。

## 検証

- `pnpm.cmd exec vitest run packages/contracts/src/package-transport-capability.test.ts packages/validator-core/src/package-transport-capability-diagnostics.test.ts packages/package-format/src/package-transport-capabilities.test.ts packages/package-format/src/package-transport-boundary.test.ts`
  - pass: 4 files / 24 tests
- `pnpm.cmd typecheck`
  - pass
- `git diff --check -- packages/contracts/src/package-transport-capability.ts packages/contracts/src/package-transport-capability.test.ts packages/validator-core/src/package-transport-capability-diagnostics.test.ts packages/validator-core/src/validators/package-transport-capability-diagnostics.ts discussion/implementation/waves/wave37`
  - pass
- dependency manifest diff:
  - `git diff -- package.json pnpm-lock.yaml pnpm-workspace.yaml apps/editor/package.json packages/contracts/package.json packages/validator-core/package.json packages/package-format/package.json`
  - no output

## 残リスク / 判断点

- この fix は Wave37 の truthfulness guard に限定した。将来 `projectDefinedJsonBundleV0` 以外を supported に昇格する場合は、この contract version または guard を意図的に更新する必要がある。
- worktree には Wave37 由来の untracked/modified file が多数あるため、今回の実装では allowed scope 以外を触っていない。
