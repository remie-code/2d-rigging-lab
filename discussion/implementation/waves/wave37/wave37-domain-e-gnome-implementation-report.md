# Wave37 Domain E Gnome Implementation Report

verdict: `pass`

Target: `wave37-transport-capability-fixture-e2e`
Date: 2026-06-03

## Summary

既存の portable bundle round-trip smoke に desktop/mobile の transport capability negative oracle を追加しました。

Portable JSON bundle (`projectDefinedJsonBundleV0`) は supported / available かつ export/import action が有効であることを検証します。ZIP/archive、File System Access API、directory picker、drag-drop、native filesystem persistence はそれぞれ dependency-gated / future-gated / unsupported として表示され、disabled な `Unavailable` control しか持たないことを検証します。禁止 API は呼び出していません。

既存 smoke の portable bundle status 期待値も現行 UI の `Portable JSON exported/imported/import failed` に合わせました。round-trip、digest mismatch、transport capability oracle は同じ E2E entrypoint で確認されています。

## Files Changed

- `apps/editor/e2e/test-ids.mjs`
- `apps/editor/e2e/portable-bundle-roundtrip-smoke.mjs`
- `discussion/tests/fixtures/fixture-manifest.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/implementation/waves/wave37/wave37-domain-e-gnome-implementation-report.md`

## Implementation Notes

- Domain D で追加された transport capability test IDs を E2E test-id mirror に追加しました。
- `portable-bundle-roundtrip-smoke.mjs` に supported row と unavailable rows の DOM oracle を追加しました。
- Negative oracle は DOM の `data-capability-status`、row text、disabled button/input state、成功主張文字列の不在だけを検証します。
- ZIP/archive、filesystem、directory picker、drag-drop、native filesystem persistence の実装やイベント発火は追加していません。

## Verification Performed

- `node --check apps/editor/e2e/portable-bundle-roundtrip-smoke.mjs`
  - pass.
- `node --check apps/editor/e2e/test-ids.mjs`
  - pass.
- `node apps/editor/e2e/portable-bundle-roundtrip-smoke.mjs`
  - pass: desktop roundtrip smoke passed.
  - pass: mobile roundtrip smoke passed.
  - pass: portable bundle roundtrip, digest mismatch, and transport capability oracle covered.
- `pnpm.cmd typecheck`
  - pass: root `tsc --noEmit` and editor `tsc --noEmit -p tsconfig.json`.
- `git diff --check -- apps/editor/e2e/portable-bundle-roundtrip-smoke.mjs apps/editor/e2e/test-ids.mjs`
  - pass: no whitespace errors; git reported LF-to-CRLF working-copy warnings only.
- Forbidden API / claim scan over changed E2E files:
  - pass for forbidden API names and dependency additions.
  - hits were limited to negative oracle strings that reject success claims such as `parsed from bytes`, `decoded from bytes`, `full renderer`, `pixel oracle`, and `Cubism compatibility`.

## Scope Guard

- No `packages/**` edits were made by Domain E.
- No package manifest or lockfile edits were made.
- Existing `packages/**` worktree changes are present from Wave37 Domain A-D and were not reverted or modified.
- No ZIP/archive implementation, File System Access API, directory picker, drag-drop intake, native filesystem persistence, PSD/PNG decode, renderer, pixel oracle, Cubism compatibility, external dependency, manifest, or lockfile change was added.

## Remaining Issues

- None for Domain E.

## User-Decision Points

- None.

## Needs Fix Loop 1

Review-Sylph finding: fixture/traceability registration did not yet record the Wave37 transport capability unavailable/gated UI guard.

Fix applied:

- Extended existing warning-gated `wave36-portable-bundle-roundtrip-e2e` fixture row because the same E2E entrypoint now covers both Wave36 portable bundle round-trip and Wave37 transport capability truthfulness.
- Updated `TC-WAVE36-PORTABLE-BUNDLE-ROUNDTRIP-E2E-001` to include `assertProjectTransportCapabilityOracle` in operation flow and expected oracle coverage.
- Registered `projectDefinedJsonBundleV0` as supported/enabled, `standardArchiveZipV0` as dependency-gated, File System Access API / directory picker / drag-drop as future-gated, native filesystem as unsupported, and non-supported controls as disabled/unavailable.
- Did not edit JSON mirrors; this is consistent with existing warning-gated markdown-only registration policy in the traceability matrix.

Additional verification:

- `git diff --check -- discussion/tests/fixtures/fixture-manifest.md discussion/tests/traceability/test-traceability-matrix.md discussion/implementation/waves/wave37/wave37-domain-e-gnome-implementation-report.md`
  - pass: no whitespace errors.
- No source, package manifest, lockfile, or `packages/**` edits were made in this fix loop.
