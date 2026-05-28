# Wave 3 Domain A Review: authoring-core session foundation

> Review role: Review-Sylph  
> 対象 domain: `wave3-authoring-core-session-foundation`  
> Review date: 2026-05-29  
> Verdict: `pass`

## 1. Scope Reviewed

対象:

- `packages/authoring-core/package.json`
- `packages/authoring-core/src/**`

レビュー報告のみ作成し、production source は編集していない。

## 2. Basis Used

- `discussion/implementation/orchestration/wave3-plan.md`
- `discussion/implementation/waves/wave2/wave2-final-report.md`
- `discussion/design/module-contracts/module-boundaries.md`
- `discussion/design/module-contracts/package-file-format-contract.md`
- `discussion/design/mvp-authoring-runtime/00-mvp-vertical-slice-architecture.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/implementation/waves/wave3/wave3-authoring-core-session-foundation-completion.md`

補助的に `discussion/_conventions.md` と `discussion/_map.md` を確認し、review artifact の配置が `discussion/implementation/reviews/` 配下で妥当であることを確認した。

## 3. Findings

### Blocking

なし。

### Warnings

なし。

### Evidence Notes

- `authoring-core` package は存在し、workspace dependency は `contracts` と `package-format` のみである。`runtime-core`、`operation-core`、`validator-core` は manifest dependency に含まれていない。根拠: `packages/authoring-core/package.json:1`
- `AuthoringSession` は package identity、package revision、authoring revision、dirty flag、authoring graph を保持しており、dirty authoring session foundation として Wave 3 Domain A の期待形に合う。根拠: `packages/authoring-core/src/authoring-session.ts:13`
- package DTO から authoring graph/session を作る処理は `PackageDocumentDto` を入力にし、package-format の DTO を clone して内部 graph に移すだけで、package-format の schema / parse ownership を奪っていない。根拠: `packages/authoring-core/src/from-package-document.ts:13`, `packages/authoring-core/src/authoring-graph.ts:37`
- editor-only DOM / viewport / selection / lock / active tool state は `authoring-core` production source には導入されていない。`model/editor-state.json` 相当の editor-only state も `AuthoringGraph` に保持していない。根拠: `packages/authoring-core/src/authoring-graph.ts:18`
- `index.ts` は re-export のみで、implementation logic を持たない。根拠: `packages/authoring-core/src/index.ts:1`
- source files は `authoring-graph.ts`、`authoring-session.ts`、`from-package-document.ts`、`graph-selectors.ts`、`authoring-mutations.ts` など責務別に分割され、catch-all `types.ts` / `schemas.ts` / `utils.ts` / `helpers.ts` は存在しない。
- `createParameter` は重複 parameter を拒否し、成功時に parameter を clone して graph へ追加し、stable order、authoring revision、dirty flag を更新する。根拠: `packages/authoring-core/src/authoring-mutations.ts:26`
- test は session creation、dry-run clone non-mutation、create-parameter dirty/revision update、dependency boundary を直接カバーしている。根拠: `packages/authoring-core/src/authoring-session.test.ts:19`, `packages/authoring-core/src/authoring-session.test.ts:29`, `packages/authoring-core/src/authoring-session.test.ts:44`, `packages/authoring-core/src/dependency-boundary.test.ts:7`

## 4. Verification Performed

1. Command:

   ```powershell
   rg --files packages/authoring-core/src packages/authoring-core/package.json discussion/implementation/reviews/wave3
   ```

   Outcome: exit 1。`packages/authoring-core` 対象ファイルは列挙された。`discussion/implementation/reviews/wave3` は未作成だったため os error 2。

2. Command:

   ```powershell
   rg -n '@private-2d-rigging-lab/(runtime-core|operation-core|validator-core)' packages/authoring-core/src
   ```

   Outcome: exit 1。match なし。禁止 package import は見つからなかった。

3. Command:

   ```powershell
   rg -n '@private-2d-rigging-lab/' packages/authoring-core/src packages/authoring-core/package.json
   ```

   Outcome: exit 0。production source / manifest の dependency は `contracts`、`package-format`、自 package 名のみ。test も同範囲。

4. Command:

   ```powershell
   rg --files packages/authoring-core/src | rg "(^|/|\\)(types|schemas|utils|helpers)\.ts$"
   ```

   Outcome: exit 1。catch-all 禁止名の source file は見つからなかった。

5. Command:

   ```powershell
   pnpm.cmd exec vitest run packages/authoring-core/src
   ```

   Outcome: 初回 exit 1。sandbox EPERM で `node_modules/.../vitest.mjs` を open できず。

6. Command:

   ```powershell
   pnpm.cmd exec vitest run packages/authoring-core/src
   ```

   Outcome: 外部権限で再実行し exit 0。2 files / 4 tests passed。

7. Command:

   ```powershell
   pnpm.cmd typecheck
   ```

   Outcome: 初回 exit 1。sandbox EPERM で `node_modules/.../typescript/bin/tsc` を open できず。

8. Command:

   ```powershell
   pnpm.cmd typecheck
   ```

   Outcome: 外部権限で再実行し exit 0。`tsc --noEmit` pass。

9. Command:

   ```powershell
   pnpm.cmd check:source
   ```

   Outcome: exit 0。Source organization guard passed。

10. Command:

    ```powershell
    pnpm.cmd check:deps
    ```

    Outcome: exit 0。Dependency guard passed。

11. Command:

    ```powershell
    git diff --check -- packages/authoring-core
    ```

    Outcome: exit 0。whitespace error なし。

12. Command:

    ```powershell
    New-Item -ItemType Directory -Force discussion\implementation\reviews\wave3
    ```

    Outcome: exit 0。review report 配置用ディレクトリを作成。

## 5. Test Adequacy Judgment

Verdict: `pass`

- session creation from package document: `authoring-session.test.ts` が `minimal-valid-package` fixture を `parsePackageDocument` で package DTO 化し、`createAuthoringSessionFromPackageDocument` の package identity / revision / graph 初期状態を検証している。
- clone / dry-run copy non-mutation: cloned dry-run session に `createParameter` を適用し、original session の parameter、revision、dirty flag が変わらないことを検証している。
- create-parameter mutation revision / dirty: `createParameter` 成功後に `authoringRevision === 1`、`dirty === true`、stable order 追加を検証している。
- boundary guard: `dependency-boundary.test.ts` が forbidden package import を検査し、追加で `rg` による実ファイル検索と `pnpm check:deps` も pass した。

## 6. Remaining Risks

- `createParameter` は Wave 3 Domain A の最小 mutation helper として十分だが、Domain C の operation lifecycle payload / precondition 具体化により、狭い API 調整が必要になる可能性は残る。これは completion report の non-blocking note と一致し、現 domain の pass を妨げない。
- production `toRuntimeGraph` / runtime adapter は未実装。Wave 3 plan が Domain A では runtime-core import を避ける方針を明示しているため、これは意図された未実装であり blocking ではない。

## 7. User-Decision Points

なし。
