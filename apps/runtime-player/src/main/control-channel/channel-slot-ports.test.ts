import { describe, expect, it } from "vitest";

import {
  runtimePlayerDefaultSlotNames,
  runtimePlayerDefaultSlotPreferredPorts
} from "../profile-slots/host-role";
import {
  runtimePlayerControlChannelDefaultPort,
  runtimePlayerDefaultSlotChannelPorts
} from "./channel-slot-ports";

describe("Control Channel slot port numbering", () => {
  it("assigns the autonomous-default slot a fixed channel port of 17310", () => {
    expect(runtimePlayerControlChannelDefaultPort).toBe(17310);
    expect(
      runtimePlayerDefaultSlotChannelPorts[
        runtimePlayerDefaultSlotNames.autonomousHost
      ]
    ).toBe(17310);
  });

  it("does not give the tracking-default slot a channel port (channel is autonomous-exclusive)", () => {
    expect(
      runtimePlayerDefaultSlotChannelPorts[
        runtimePlayerDefaultSlotNames.trackingHost
      ]
    ).toBeUndefined();
  });

  it("keeps the channel port independent from the Browser Source port record", () => {
    const autonomousSlot = runtimePlayerDefaultSlotNames.autonomousHost;

    // Browser Source numbers autonomous-default at 17309; the channel at 17310.
    expect(runtimePlayerDefaultSlotChannelPorts[autonomousSlot]).not.toBe(
      runtimePlayerDefaultSlotPreferredPorts[autonomousSlot]
    );
    // No collision with any Browser Source default port either.
    expect(Object.values(runtimePlayerDefaultSlotPreferredPorts)).not.toContain(
      runtimePlayerControlChannelDefaultPort
    );
  });
});
