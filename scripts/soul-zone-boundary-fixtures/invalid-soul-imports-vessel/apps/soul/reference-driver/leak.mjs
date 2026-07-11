// Fixture VIOLATION (ルール 2): the soul zone importing 器 CODE (a .ts/.mjs module,
// not a .json contract). The guard must flag this — 憲章 §6.2: 魂は契約だけを import できる。
import { RuntimePlayerControlChannelServer } from "../../runtime-player/src/main/control-channel/channel-server.ts";

export const server = RuntimePlayerControlChannelServer;
