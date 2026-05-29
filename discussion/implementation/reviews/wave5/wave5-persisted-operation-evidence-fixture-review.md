# Wave 5 Domain F Review: persisted operation evidence fixture

> Review target: `wave5-persisted-operation-evidence-fixture`
> Completion report: `discussion/implementation/waves/wave5/wave5-persisted-operation-evidence-fixture-completion.md`
> Review lanes: Design / Development Compliance Review, Test Adequacy Review
> Reviewer: Review-Sylph / clean context
> Review date: 2026-05-29
> Verdict: `pass`

## Findings

- Blocking: なし。
- High: なし。
- Medium: なし。
- Low / Note: なし。

## Design / Development Compliance Review

- Fixture は text-only / summary-sized の範囲に収まっている。`fixtures/contracts/minimal-operation-persisted-package/` 配下は `.json` 8 files のみで、最大 file は `fixture-manifest.json` の 2,152 bytes。巨大な runtime / validation artifact 本体、binary asset、proprietary asset は追加されていない。
- 禁止語・禁止資産の確認では、fixture と対象 test に `.moc3` / `.cmo3` / `.model3.json` / `.physics3.json` / `.motion3.json` / `.pose3.json` / SDK/Core / wasm 等の利用は見つからなかった。唯一の `Cubism` match は completion report の「追加していない」という説明文のみ。
- 統合 test は createParameter commit から、operation log JSONL、`toPackageDocument`、package file set serialize/reload、runtime artifact materialization、validation artifact materialization まで接続している。根拠: `packages/operation-core/src/persisted-operation-evidence-fixture.test.ts:80`-`92`, `packages/operation-core/src/persisted-operation-evidence-fixture.test.ts:228`-`298`。
- Reload 後 package document は `packageRevision=1` と `param_persisted_smile` を確認している。根拠: `packages/operation-core/src/persisted-operation-evidence-fixture.test.ts:100`-`102`, `fixtures/contracts/minimal-operation-persisted-package/expected/reload-summary.json:4`, `fixtures/contracts/minimal-operation-persisted-package/expected/reload-summary.json:8`。
- Operation log JSONL は serialize / parse roundtrip 後に in-memory log と一致し、log entry 側の runtime snapshot IDs / validation report IDs が operation result 側の generated IDs と一致することを確認している。根拠: `packages/operation-core/src/persisted-operation-evidence-fixture.test.ts:82`-`83`, `packages/operation-core/src/persisted-operation-evidence-fixture.test.ts:98`, `packages/operation-core/src/persisted-operation-evidence-fixture.test.ts:103`-`104`。
- Runtime / validation artifact content は owner module schema で parse されている。根拠: `packages/operation-core/src/persisted-operation-evidence-fixture.test.ts:424`-`449`。
- Generated runtime / validation artifact paths は package file set の generated entries として固定され、expected summary で 6 paths / 6 unique paths を確認している。根拠: `packages/operation-core/src/persisted-operation-evidence-fixture.test.ts:87`-`91`, `packages/operation-core/src/persisted-operation-evidence-fixture.test.ts:111`-`118`, `packages/operation-core/src/persisted-operation-evidence-fixture.test.ts:330`-`347`, `fixtures/contracts/minimal-operation-persisted-package/expected/package-file-set-summary.json:8`, `fixtures/contracts/minimal-operation-persisted-package/expected/package-file-set-summary.json:16`。
- Domain C review の unsafe path note は test で補強されている。Traversal、backslash、Unix absolute path、Windows drive absolute path、parse-time duplicate、serialize-time generated duplicate を明示的に拒否している。根拠: `packages/package-format/src/package-file-set.test.ts:67`-`124`。
- Domain F 対象 scope では production source 変更は見つからない。対象 path の `git status --short -uall` は fixture、test file、completion report の untracked file のみを示した。worktree 全体には Domain A-E 由来の production source 変更が残っているが、Domain F の直接変更対象ではない。

## Test Adequacy Review

- `pnpm.cmd exec vitest run packages/operation-core/src/persisted-operation-evidence-fixture.test.ts packages/package-format/src/package-file-set.test.ts`: pass。2 files / 7 tests。
- `pnpm.cmd typecheck`: pass。
- `git diff --check -- fixtures/contracts/minimal-operation-persisted-package packages/operation-core/src/persisted-operation-evidence-fixture.test.ts packages/package-format/src/package-file-set.test.ts discussion/implementation/waves/wave5/wave5-persisted-operation-evidence-fixture-completion.md`: pass。
- `git diff --check` は untracked file の内容を検査しないため、追加で `rg -n "[ \t]+$" ...` を実行し、対象 fixture / test / completion report に末尾 whitespace がないことを確認した。
- sandbox 内では Vitest / TypeScript binary の `node_modules` read が `EPERM` になったため、対象 test と typecheck は権限外実行で確認した。

## Source Organization Notes

- `index.ts` や production implementation file は Domain F では変更されていない。
- `packages/operation-core/src/persisted-operation-evidence-fixture.test.ts` は 1 本の統合 fixture test として A-E public API を束ねている。production logic は含まないが、今後 persisted fixture の case が増える場合は fixture loading / summary helper を分ける余地がある。
- `packages/package-format/src/package-file-set.test.ts` の追加 coverage は Domain C の path policy regression test に限定されている。

## Residual Risks

- Fixture は `createParameter` の最小 happy path を固定する。複数 operation append、rollback、migration、filesystem / archive writer は Domain F の範囲外。
- `packageHash` は既存 minimal fixture の `sha256:minimal-valid-package-v1` を流用している。mutated package body hash を再計算する方針に変える場合は fixture summary 更新が必要。
- Domain D review で残った snapshot ID/path collision の一般問題は、この happy path fixtureでは再現しない。今回の fixture は generated path の presence / uniqueness を固定するが、任意の重複 snapshot ID collision を網羅するものではない。
