import type { RuntimePlayerBrowserSourceBindAddress } from "../../preload/browser-source-status-contract";

export const runtimePlayerBrowserSourceBindAddress =
  "127.0.0.1" satisfies RuntimePlayerBrowserSourceBindAddress;

export const runtimePlayerBrowserSourceDefaultPort = 17308 as const;

export const runtimePlayerBrowserSourceTokenQueryKey = "token" as const;

export function createBrowserSourceStageUrl(input: {
  readonly port: number;
  readonly token: string;
}): string {
  const url = new URL(
    `http://${runtimePlayerBrowserSourceBindAddress}:${input.port}/stage`
  );
  url.searchParams.set(runtimePlayerBrowserSourceTokenQueryKey, input.token);
  return url.toString();
}

export function createBrowserSourceWebSocketUrl(input: {
  readonly port: number;
  readonly token: string;
}): string {
  const url = new URL(
    `ws://${runtimePlayerBrowserSourceBindAddress}:${input.port}/ws`
  );
  url.searchParams.set(runtimePlayerBrowserSourceTokenQueryKey, input.token);
  return url.toString();
}
