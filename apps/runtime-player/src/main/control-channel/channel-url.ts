/**
 * Control Channel connection endpoint (C4 §3.1):
 * `ws://127.0.0.1:<slot-numbered port>/channel?token=<slot token>`.
 * Loopback-only, token in the URL — the same one-line作法 any language's soul
 * can use. Kept self-contained (its own bind address + token query key) so the
 * channel does not couple to the Browser Source URL module.
 */

export const runtimePlayerControlChannelBindAddress = "127.0.0.1" as const;

export const runtimePlayerControlChannelPath = "/channel" as const;

export const runtimePlayerControlChannelTokenQueryKey = "token" as const;

export function createControlChannelWebSocketUrl(input: {
  readonly port: number;
  readonly token: string;
}): string {
  const url = new URL(
    `ws://${runtimePlayerControlChannelBindAddress}:${input.port}${
      runtimePlayerControlChannelPath
    }`
  );
  url.searchParams.set(
    runtimePlayerControlChannelTokenQueryKey,
    input.token
  );
  return url.toString();
}
