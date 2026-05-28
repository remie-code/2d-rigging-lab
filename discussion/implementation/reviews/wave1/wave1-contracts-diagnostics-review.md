# Wave 1 diagnostics contract review

> 対象 domain: `wave1-contracts-diagnostics`  
> 日付: 2026-05-29  
> Verdict: pass

## 1. レビュー範囲

### Repository facts

- 変更対象は `packages/contracts/src/check-id.ts`、`packages/contracts/src/target-ref.ts`、`packages/contracts/src/diagnostics.ts`、`packages/contracts/src/diagnostics.test.ts` に限定した。
- `packages/contracts/src/index.ts`、`packages/contracts/package.json`、`pnpm-lock.yaml`、`generated/dependencies/dependency-registry.json` はこの domain では編集していない。
- 既存の `brand.ts`、`ids.ts`、`primitives.ts`、`enums.ts` は `wave1-contracts-zod-and-core` からの入力として参照のみ行った。

### Basis

- `discussion/implementation/orchestration/wave1-plan.md`
- `discussion/design/module-contracts/module-boundaries.md`
- `discussion/design/module-contracts/typescript-contracts.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/development_convention/module-boundary-policy.md`

## 2. Design / Development Compliance Review

### 判定

pass

### 確認結果

- `CheckIdSchema` は `typescript-contracts.md` の dot-separated lower camelCase 形式に一致している。
- `TargetKindSchema`、`TargetRefSchema`、`DiagnosticSchema` は `typescript-contracts.md` の Shared Diagnostic Types に沿っている。
- `TargetRefDto.id` は current contract の generic `string` のまま維持し、typed discriminated union へ拡張していない。
- `DiagnosticSchema` は既存の `CheckStatusSchema`、`SeveritySchema`、新規の `CheckIdSchema`、`TargetRefSchema` を再利用している。
- `index.ts` は未変更で、barrel 統合は `wave1-contracts-integration` に残している。
- 新規 source は責務別に分割され、catch-all file は追加していない。
- Cubism SDK/Core、Cubism Viewer、既存モデル、runtime evidence は oracle として使っていない。

### 注意

- `schema-and-id-conventions.md` の一般則では DTO/schema 名に `DtoSchema` 形式を求めているが、この domain の明示要求と `typescript-contracts.md` の Shared Diagnostic Types は `DiagnosticSchema` / `TargetRefSchema` を source of truth としているため、その名前を採用した。

## 3. Test Adequacy Review

### 判定

pass

### 確認結果

- `CheckIdSchema` の valid / invalid ケースを追加した。
- `TargetKindSchema` と `TargetRefSchema` の valid target kind、optional `path`、invalid kind / missing id / non-string id を確認した。
- `DiagnosticSchema` の default array fields、明示的な related fields、invalid core fields を確認した。
- tests は diagnostics responsibility に閉じた `diagnostics.test.ts` に配置した。

### 残余リスク

- `index.ts` export 経由の public surface 確認は、この domain の forbidden scope のため未実施。後続の `wave1-contracts-integration` が担当する。

## 4. Verification

| Command | Outcome |
|---|---|
| `pnpm exec vitest run packages/contracts/src/diagnostics.test.ts` | pass。sandbox 内では `node_modules` 読み取り EPERM のため失敗し、sandbox 外再実行で 1 file / 30 tests pass。 |
| `pnpm typecheck` | pass |
| `pnpm test` | pass。sandbox 内では `node_modules` 読み取り EPERM のため失敗し、sandbox 外再実行で 4 files / 59 tests pass。 |
| `pnpm check:source` | pass |
| `pnpm check` | pass。sandbox 外再実行で typecheck / test / check:deps / check:source pass。 |

## 5. Remaining Issues

- domain 内の blocking issue はなし。
- user decision point はなし。
