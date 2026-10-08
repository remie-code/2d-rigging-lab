import { runtimePlayerDefaultSlotNames } from "../profile-slots/host-role";

/**
 * Control Channel port numbering (C4 §3.1, 裁定3). The channel is autonomous-host
 * EXCLUSIVE (裁定2: トラッキングホスト合成にチャネルサブシステムは存在しない), so
 * only the `autonomous-default` slot carries a fixed channel port; the
 * `tracking-default` slot has NONE. Any custom (non-default) autonomous slot
 * auto-assigns a free loopback port on first creation via `findFreeLoopbackPort`
 * (手動ポート設定なしの規律維持), exactly as Browser Source does.
 *
 * The channel port is its OWN record — deliberately independent from the Browser
 * Source port record (`runtimePlayerDefaultSlotPreferredPorts`), so the two
 * subsystems number ports per-slot without colliding. 17310 is chosen distinct
 * from Browser Source's 17308 (tracking-default) / 17309 (autonomous-default);
 * it is a standalone constant, not derived from the Browser Source offset scheme.
 */
export const runtimePlayerControlChannelDefaultPort = 17310 as const;

export const runtimePlayerDefaultSlotChannelPorts: Readonly<
  Record<string, number>
> = {
  [runtimePlayerDefaultSlotNames.autonomousHost]:
    runtimePlayerControlChannelDefaultPort
};
