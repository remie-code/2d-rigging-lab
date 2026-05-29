# Wave 8 Domain B Completion

> Domain: `wave8-ai-command-schema-foundation`
> Date: 2026-05-29
> Verdict: `pass`

## 実装結果

- `AiCapabilitySchema` と `AiCommandNameSchema` を追加した。
- command catalog は Wave 8 の最小縦切りである `getEditorState` / `dryRunOperation` / `commitOperation` / `getOperationLog` に限定した。
- `AiCommandRequestSchema` は `schemaVersion`、`commandId`、`session`、`basis` と command payload を検証する。
- `dryRunOperation` は `OperationRequestSchema` かつ `dryRun: true`、`commitOperation` は `dryRun: false` を要求する。
- `AiCommandResponseSchema` は status、diagnostics、diff、operation result、evidence refs、command-specific payload を扱う。
- schema regression test で valid/invalid request と barrel-only export を固定した。

## 変更ファイル

- `packages/ai-interface/src/ai-capability.ts`
- `packages/ai-interface/src/ai-command-name.ts`
- `packages/ai-interface/src/ai-command-payload.ts`
- `packages/ai-interface/src/ai-command-request.ts`
- `packages/ai-interface/src/ai-command-response-payload.ts`
- `packages/ai-interface/src/ai-command-response.ts`
- `packages/ai-interface/src/ai-command-schema.test.ts`
- `packages/ai-interface/src/index.ts`

## 検証

| Check | Result |
|---|---|
| `pnpm exec vitest run packages/ai-interface/src` | pass |
| `pnpm typecheck` | pass |
| `pnpm check:source` | pass |

## 残課題

なし。
