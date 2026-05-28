# Wave 2 Runtime Core Foundation Review

> Domain: `wave2-runtime-core-foundation`  
> Reviewer: Review-Sylph  
> Review date: 2026-05-29  
> Verdict: `pass`

## 1. Reviewed Files / Basis

### Basis documents

- `discussion/implementation/orchestration/wave2-plan.md`
- `discussion/design/module-contracts/runtime-core-contract.md`
- `discussion/design/module-contracts/module-boundaries.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/implementation/waves/wave2/wave2-runtime-core-foundation-completion.md`

### Reviewed source

- `packages/runtime-core/package.json`
- `packages/runtime-core/src/index.ts`
- `packages/runtime-core/src/normalized-runtime-graph.ts`
- `packages/runtime-core/src/runtime-input.ts`
- `packages/runtime-core/src/runtime-options.ts`
- `packages/runtime-core/src/initial-state.ts`
- `packages/runtime-core/src/state-compatibility.ts`
- `packages/runtime-core/src/diagnostics.ts`
- `packages/runtime-core/src/runtime-core.ts`
- `packages/runtime-core/src/snapshot.ts`
- `packages/runtime-core/src/snapshot-comparison.ts`
- `packages/runtime-core/src/*.test.ts`
- `packages/contracts/src/runtime-state.ts`
- `packages/contracts/src/runtime-sequence.ts`
- `packages/contracts/src/runtime-diff.ts`
- `packages/contracts/src/diagnostics.ts`
- `packages/contracts/src/ids.ts`

## 2. Findings

### Blocking / Major

- なし。

### Minor / Follow-up

1. `RuntimeSnapshotSchema` の一部 ID 検証が設計契約より緩い。
   - Evidence: `discussion/design/module-contracts/runtime-core-contract.md:619-620` は `dynamicsGroupId: DynamicsGroupIdSchema`、同 `:654-659` は `packageId: PackageIdSchema` を示している。一方、実装は `packages/runtime-core/src/snapshot.ts:57-59` で `dynamicsGroupId: z.string()`、同 `:84-90` で `packageId: z.string()` を使っている。
   - Impact: public snapshot DTO が invalid な `pkg_` / `dyn_` prefix を検出できない余地がある。
   - Severity: minor。現行テスト入力は contracts schema 由来の branded ID を使い、Wave 2 の必須条件である RuntimeState source-of-truth には抵触していない。Integration または次 runtime loop で `PackageIdSchema` / `DynamicsGroupIdSchema` へ寄せ、invalid ID テストを追加するのがよい。

2. 自動 dependency boundary test は `package-format` のみを検査している。
   - Evidence: `packages/runtime-core/src/dependency-boundary.test.ts:8-12` は `@private-2d-rigging-lab/package-format` の direct import だけを forbidden pattern にしている。Wave 2 plan は `packages/runtime-core/**` から `package-format` / `validator-core` / `operation-core` への依存を禁止している (`discussion/implementation/orchestration/wave2-plan.md:186-188`)。
   - Impact: 将来 `validator-core` または `operation-core` import が入った場合、現行テストだけでは検出できない。
   - Severity: minor。今回の手動境界検索では production source に forbidden import はなかった。後続で forbidden package 配列化して永続テストを広げるとよい。

## 3. Test Adequacy Assessment

Adequacy: pass。

- `pnpm.cmd exec vitest run packages/runtime-core/src`
  - 初回は sandbox 内で `node_modules/.../vitest.mjs` の `EPERM` により失敗。
  - 外部権限で再実行し pass。3 files / 6 tests pass。
- `pnpm.cmd check:source`
  - pass。Source organization guard passed。
- `pnpm.cmd check:deps`
  - pass。Dependency guard passed。
- `pnpm.cmd typecheck`
  - 初回は sandbox 内で TypeScript 実体の `EPERM` により失敗。
  - 外部権限で再実行し pass。
- `rg -n "package-format|validator-core|operation-core" packages/runtime-core/src`
  - production import はなし。検出は `dependency-boundary.test.ts` の説明文字列と pattern のみ。
- `git diff --check -- packages/runtime-core discussion/implementation/waves/wave2/wave2-runtime-core-foundation-completion.md`
  - exit 0。CRLF warning のみで whitespace error はなし。

Required coverage との対応:

- initial state: `packages/runtime-core/src/initial-state.test.ts:12-31`
- active dynamics group state: `packages/runtime-core/src/initial-state.test.ts:33-116`
- non-empty draw list snapshot: `packages/runtime-core/src/runtime-core.test.ts:15-62`
- package mismatch / hash unavailable diagnostics: `packages/runtime-core/src/runtime-core.test.ts:64-131`
- sequence public shape: `packages/runtime-core/src/runtime-core.test.ts:133-161`
- dependency boundary: `packages/runtime-core/src/dependency-boundary.test.ts:7-15` と手動 boundary search

## 4. Source Organization Assessment

Assessment: pass。

- `packages/runtime-core/src/index.ts:1-8` は re-export のみで barrel-only。
- `NormalizedRuntimeGraph`、runtime input、options、initial state、state compatibility、diagnostics、snapshot、comparison、facade が責務別ファイルに分かれている。
- `snapshot.ts` は現時点で snapshot schema / assembly の cohesive file と判断する。ただし今後 full vertices、keyform samples、dynamics debug、mask diagnostics が増える場合は分割候補。
- renderer、package IO、operation mutation、validator policy、WebGL / DOM 実装は含まれていない。

## 5. Design / Development Compliance

Assessment: pass。

- `runtime-core` の direct package import は `@private-2d-rigging-lab/contracts` と `zod` のみ。`package-format` / `validator-core` / `operation-core` への production import は確認されなかった。
- `RuntimeStateDto` は `packages/contracts/src/runtime-state.ts:13-21` の `RuntimeStateDtoSchema` を source of truth とし、`packages/runtime-core/src/initial-state.ts:29-38` と `packages/runtime-core/src/runtime-core.ts:55-58,83` で parse している。
- Wave 2 scope は runtime API shape、normalized graph、initial state、minimal snapshot / sequence foundation に留まっている。full mesh deformation、full rig hierarchy、complete dynamics solver、renderer integration、package file IO は実装していない。
- Dependency follow-up は completion report に記録されている。今回の独立確認では `pnpm.cmd check:deps` が pass しており、integration 側で lockfile / registry 整合を再確認すればよい。

## 6. Remaining Risks

- `RuntimeSnapshotSchema` は Wave 2 foundation の最小実装であり、full snapshot contract への拡張時に ID schema、keyform samples、mask diagnostics、dynamics debug fields の strictness を再確認する必要がある。
- Dynamics は state shape / reset / carry-forward foundation まで。`scalarDampedFollowV1` の完全な物理ステップ、profile strictness に応じた fail 判定、deterministic replay evidence は後続 wave の範囲。
- `packages/runtime-core/src/diagnostics.ts:14` は non-info severity を一律 `status: "warning"` にしている。`runtime.statePackageMismatch` は severity `error` (`packages/runtime-core/src/state-compatibility.ts:92-99`) なので、validator integration 時に strict / acceptance profile の fail mapping を明示する必要がある。

## 7. User-decision Points

- なし。

