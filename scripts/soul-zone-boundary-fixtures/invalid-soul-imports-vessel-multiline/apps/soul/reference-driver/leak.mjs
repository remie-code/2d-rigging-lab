// Fixture VIOLATION (ルール 2, 多行 import): the soul zone importing 器 CODE across
// multiple lines (prettier-style). The guard must catch this DESPITE the line breaks
// between the import clause and `from` — 憲章 §6.2: 魂は契約だけを import できる。
import {
  RuntimePlayerControlChannelServer,
  runtimePlayerControlChannelDefaultWindowMs
} from "../../runtime-player/src/main/control-channel/channel-server.ts";

export const server = RuntimePlayerControlChannelServer;
export const win = runtimePlayerControlChannelDefaultWindowMs;
