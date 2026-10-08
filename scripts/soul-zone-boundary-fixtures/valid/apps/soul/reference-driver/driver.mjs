// Fixture: a valid soul-zone resident. It reads the contract JSON (契約=fixture,
// allowed by 憲章 §6.2) and uses only node builtins — it never imports 器 CODE.
// Importing a `.json` contract even via an import statement is allowed by ルール 2.
import { readFileSync } from "node:fs";
import schema from "../../runtime-player/src/main/control-channel/contract/channel-intent-set-payload-schema.json" with { type: "json" };

export function slotIds() {
  void readFileSync;
  return schema?.properties?.slotId?.enum ?? [];
}
