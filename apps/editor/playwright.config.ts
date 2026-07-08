import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 90000,
  expect: {
    timeout: 30000
  },
  use: {
    screenshot: "off",
    video: "off"
  }
});
