# Wave37 Domain E Review-Sylph

Date: 2026-06-03
Target: `wave37-transport-capability-fixture-e2e`
Verdict: `needs_fix`

Clean-context review for Domain E. I reviewed the orchestration/context-hygiene basis, Wave37 plan, prior Domain A-D pass artifacts, current capability/backlog context, fixture/traceability docs, and the Domain E changed files. I did not edit source implementation files.

## Findings

1. Needs-fix: Wave37 の transport capability negative oracle が fixture / traceability registration に反映されていません。
   - `apps/editor/e2e/portable-bundle-roundtrip-smoke.mjs:459` 以降で `assertProjectTransportCapabilityOracle` が追加され、supported portable row、ZIP/File System Access/directory picker/drag-drop/native filesystem の unavailable rows、disabled unavailable button、禁止成功文言の不在を検証しています。
   - しかし `discussion/tests/fixtures/fixture-manifest.md:95` は既存 `wave36-portable-bundle-roundtrip-e2e` の説明のままで、Wave37 の transport capability unavailable/gated UI guard を登録していません。
   - `discussion/tests/traceability/test-traceability-matrix.md:68` も negative oracle を `portableBundle.digest.mismatch` のみとしており、Wave37 の capability status / disabled unavailable action guard を追跡していません。
   - Source fix は不要ですが、warning-gated e2e guard として pass する前に、既存 Wave36 行を狭く拡張するか Wave37 guard 行を追加する登録更新が必要です。

## Review Lanes

- Design / Development Compliance Review: source scope は `pass`。Domain E の対象 diff は `apps/editor/e2e/portable-bundle-roundtrip-smoke.mjs` と `apps/editor/e2e/test-ids.mjs` に収まり、`packages/**`、manifest、lockfile、dependency、parser/decode、renderer/pixel、Cubism compatibility の変更は見つかりませんでした。
- Test Adequacy Review: `needs_fix`。E2E coverage 自体は十分ですが、新しい Wave37 negative oracle の fixture / traceability 登録が不足しています。
- E2E Truthfulness Review: `pass`。desktop/mobile の portable JSON bundle export/import は維持され、negative oracle は unsupported routes を成功経路として実行せず DOM state と disabled control を確認しています。
- Orchestration Compliance Review: `pass`。Gnome 実装報告と独立 Review-Sylph レビューが分離され、Review-Sylph はこの artifact 以外のファイルを編集していません。

## Specific Questions

- portable JSON bundle export/import は desktop/mobile で引き続き cover されています。viewport 定義は `portable-bundle-roundtrip-smoke.mjs:19`、round-trip は `:85`-`:123`、digest mismatch 後の再確認は `:129`-`:150`、main loop は `:700`-`:713`。
- negative oracle は non-supported ZIP/archive/filesystem/directory-picker/drag-drop/native filesystem routes を unavailable/gated/unsupported として観測し、disabled unavailable button を確認しています。該当箇所は `:42`-`:68` と `:459`-`:618`。
- assertion weakening は見つかりません。旧い広い unsupported-claim regex は、行ごとの capability status、enabled/disabled action、禁止成功文言チェックへ強化されています。
- E2E test-id mirror は `apps/editor/src/editor-state/editor-test-ids.ts` と整合しています。`projectPersistenceTransportCapabilityList` は両方 `projectPersistence.transportCapability.list`、row/unavailable helper も同一形式です。
- Domain E changed files からは `packages/**`、manifest、lockfile、dependency、parser/decode、renderer/pixel、Cubism compatibility、File System Access API、directory picker、drag-drop 実装の導入は確認されませんでした。
- documentation / fixture / traceability registration は現状不十分です。狭い登録更新が必要です。

## Verification Performed

- Read required orchestration and subagent-context-hygiene skills.
- Read Wave37 plan, Domain A-D final/review reports, current capability/backlog excerpts, Wave36 final/review excerpts, source organization and dependency policy excerpts.
- Inspected Domain E changed files with line numbers and diff.
- Inspected Domain D UI/source test-id definitions for E2E mirror alignment.
- Inspected fixture manifest and traceability matrix entries for portable bundle / transport coverage.
- Ran `node --check apps/editor/e2e/portable-bundle-roundtrip-smoke.mjs`: pass.
- Ran `node --check apps/editor/e2e/test-ids.mjs`: pass.
- Ran `node apps/editor/e2e/portable-bundle-roundtrip-smoke.mjs`: pass; desktop and mobile roundtrip smoke passed.
- Ran `pnpm.cmd typecheck`: pass.
- Ran `git diff --check -- apps/editor/e2e/portable-bundle-roundtrip-smoke.mjs apps/editor/e2e/test-ids.mjs discussion/implementation/waves/wave37/wave37-domain-e-gnome-implementation-report.md`: pass; LF-to-CRLF warnings only.
- Ran manifest/lockfile/registration diff check over package manifests, lockfile, fixture manifest, and traceability matrix: no output.
- Ran forbidden-scope scan over Domain E E2E files. Hits were limited to capability labels and negative-oracle strings.

## Remaining Issues

- Narrowly update `discussion/tests/fixtures/fixture-manifest.md` and `discussion/tests/traceability/test-traceability-matrix.md` so the Wave37 transport capability unavailable/gated/disabled e2e guard is registered.

## User-Decision Points

None. This is a documentation/traceability fix, not a product decision.

## Files Changed By This Review

- `discussion/implementation/reviews/wave37/wave37-domain-e-review-sylph.md`
