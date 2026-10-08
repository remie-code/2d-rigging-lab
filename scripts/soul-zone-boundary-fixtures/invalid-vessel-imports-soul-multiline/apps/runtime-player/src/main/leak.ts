// Fixture VIOLATION (ルール 1, 多行 import): a prettier-style multi-line named
// import reaching INTO the soul zone. The guard must catch this DESPITE the line
// breaks between the import clause and `from` — 憲章 §6.3: 器側の何ものも魂を import しない。
import {
  slotIds,
  scenario
} from "../../../soul/reference-driver/driver.mjs";

export const ids = slotIds();
export const s = scenario;
