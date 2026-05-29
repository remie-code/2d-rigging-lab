# Wave 8 Domain C Completion

> Domain: `wave8-ai-operation-dry-run-approval-executor`
> Date: 2026-05-29
> Verdict: `pass`

## 実装結果

- transport-independent な `AiCommandExecutor` を追加した。
- mutating command は `dryRunOperation` と `commitOperation` に限定した。
- `dryRunOperation` は `dryRunEdit` capability を要求し、dry-run command ID / agent ID / operation ID を approval registry に記録する。
- `commitOperation` は `commitWithApproval` capability と、同一 agent / 同一 operation ID に紐づく承認済み dry-run command ID を要求する。
- approval なし commit は `needs_approval`、capability 不足は `permission_denied`、operation-core reject は `rejected` として返す。
- transcript は command event と approval event を構造化して保持する。command event は capabilities / basis / status / evidence refs / operation ID を含む。

## 変更ファイル

- `packages/ai-interface/src/ai-command-host.ts`
- `packages/ai-interface/src/ai-approval-policy.ts`
- `packages/ai-interface/src/ai-command-transcript.ts`
- `packages/ai-interface/src/ai-command-executor.ts`
- `packages/ai-interface/src/ai-operation-command.test.ts`
- `packages/ai-interface/src/index.ts`

## 検証

| Check | Result |
|---|---|
| `pnpm exec vitest run packages/ai-interface/src` | pass |
| `pnpm typecheck` | pass |
| `pnpm check:source` | pass |

## 残課題

なし。visible approval UI は Wave 8 の non-goal として扱い、in-memory approval policy で command semantics を固定した。
