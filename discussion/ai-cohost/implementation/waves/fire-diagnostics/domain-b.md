# Passive Fire Diagnostics D1 — Domain B completion report

- Mechanical status: **PASS (Domain B; integrated review loop 3)**.
- Accepted User Gate: **PENDING**. This report does not claim to pass or substitute for the user observation gate.
- Integrated review: [final-review.md](../../reviews/fire-diagnostics/final-review.md) — PASS / blocking 0.

## Automatic Runtime Player diagnostic trace

Runtime Player creates the trace automatically when the autonomous Control Channel is composed. The exact per-slot app-data path is:

```text
{app.getPath("userData")}\\ai-cohost-fire-diagnostics\\runtime-player\\control-channel.jsonl
```

The file is JSON Lines, records an ISO wall timestamp (`atIso`) and a Runtime-process-local monotonic value (`monotonicMs`) separately, and is written incrementally without being awaited by channel operation. It is bounded by **overwrite-on-process-start**: exactly one current Runtime Player process trace is retained at this path. Directory/create/append failures are caught and leave Control Channel behavior operational; retrying later append operations remains best effort.

Records contain only connection ID/generation, request ID when parsed, byte counts, opcode/final flag, enumerated result/rejection/close metadata, and process-local connection duration. They do not record the token, raw JSON/request text, speech content, or binary frame body.

## Evidence and fixtures

- Checked-in Runtime sample: `apps/runtime-player/src/main/control-channel/fixtures/fire-diagnostics-runtime-sample.jsonl`
  - success reconstruction: `control-channel-1` / generation `1`, `req-speech-42`, 782-byte final text frame, accepted;
  - failure reconstruction: `control-channel-2` / generation `2`, `oversize` close before a request is dispatched.
- The sample uses wall time and request/connection ordering only; it deliberately invents no cross-process monotonic subtraction. A reviewer can align it with Domain A's sample using the visible request ID/wall-time neighborhood.

Transport observations distinguish the production-visible branches: `oversize`, `incomplete-overflow`, `decode-error`, `non-final-frame`, `peer-close`, `socket-end`, `socket-error`, and `intentional-server-close`. A terminal socket event is retained separately from a preceding close request.

## Changed files

- `apps/runtime-player/src/main/control-channel/fire-diagnostics.ts`
- `apps/runtime-player/src/main/control-channel/fire-diagnostics.test.ts`
- `apps/runtime-player/src/main/control-channel/channel-websocket-frame.ts`
- `apps/runtime-player/src/main/control-channel/channel-websocket-connection.ts`
- `apps/runtime-player/src/main/control-channel/channel-websocket-connection.test.ts`
- `apps/runtime-player/src/main/control-channel/channel-server.ts`
- `apps/runtime-player/src/main/control-channel/channel-server-events.test.ts`
- `apps/runtime-player/src/main/control-channel/fixtures/fire-diagnostics-runtime-sample.jsonl`
- `apps/runtime-player/src/main/runtime-player-main.ts` (only the app-data logger construction/wiring seam)
- `discussion/ai-cohost/implementation/waves/fire-diagnostics/domain-b.md`

## Targeted verification (raw commands and outcomes)

```text
pnpm.cmd --filter @private-2d-rigging-lab/runtime-player typecheck
→ exit 0
→ tsc --noEmit -p tsconfig.json

pnpm.cmd --filter @private-2d-rigging-lab/runtime-player exec vitest run src/main/control-channel/channel-websocket-connection.test.ts src/main/control-channel/fire-diagnostics.test.ts src/main/control-channel/channel-server-events.test.ts src/main/control-channel/channel-server.test.ts --pool=forks --maxWorkers=1 --no-file-parallelism
→ initial sandbox attempt: Vite config load failed before assertions with `Error: spawn EPERM` from esbuild.

same command with --reporter=verbose in the approved execution environment
→ 4 passed files / 20 passed tests
→ `channel-websocket-connection.test.ts`: exact 4096 frame remains accepted; 4097 is observed as `oversize`; incomplete overflow, decode error, non-final, peer close, socket end/error, and intentional server close each have targeted assertions.
→ `channel-server-events.test.ts`: normal accepted `req-ok`, rejected `req-bad` / `slotValueOutOfRange`, and disconnected observations retain connection ID/generation and duration.
→ `fire-diagnostics.test.ts`: deterministic path, overwrite-on-start bound, content-free JSONL shape, and nonfatal initialization failure are covered.
→ `channel-server.test.ts`: existing normal hello, accepted/rejected, disconnect, and lifecycle behavior remains green.

final repeat after adding the oversize frame's exact `framePayloadBytes`
→ `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player exec vitest run src/main/control-channel/channel-websocket-connection.test.ts src/main/control-channel/fire-diagnostics.test.ts src/main/control-channel/channel-server-events.test.ts src/main/control-channel/channel-server.test.ts --pool=forks --maxWorkers=1 --no-file-parallelism`
→ 4 passed files / 20 passed tests

git diff --check -- apps/runtime-player/src/main/control-channel apps/runtime-player/src/main/runtime-player-main.ts discussion/ai-cohost/implementation/waves/fire-diagnostics/domain-b.md
→ exit 0 (only repository CRLF conversion warnings).

git diff --name-only | rg '(^apps/runtime-player/src/(renderer|preload)/|channel-protocol|channel-intent|package\\.json$|pnpm-lock\\.yaml$|^pnpm-lock\\.yaml$)'
→ no matching changed tracked files.
```

## Scope evidence

The 4096 constant and transport/reply semantics were not changed. The diagnostic type only classifies an already-thrown decode failure; it does not preflight, chunk, retry, reconnect, or timeout. No renderer/preload/control UI, protocol contract/schema, intent validation/cap, dependency manifest, or lockfile changed in this Domain B scope.

## Nonblocking residuals

- The first sandboxed Vitest invocation could not spawn esbuild (`spawn EPERM`) before assertions; the established worker-free command passed in the approved environment and is the green evidence above.
- This is temporary local diagnostics. It does not prove a user-observed Fire cause, repair reconnect behavior, alter the 4096-byte cap, or measure physical speaker onset. Those remain outside D1 and the User Gate is pending.
