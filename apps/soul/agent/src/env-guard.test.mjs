// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  assertSubscriptionAuthEnv,
  DEFAULT_ANTHROPIC_BASE_URL
} from "./env-guard.mjs";

test("env-guard: ガード対象が未設定なら pass（warnings 空）", () => {
  const { warnings } = assertSubscriptionAuthEnv({ PATH: "/usr/bin", HOME: "/home/x" });
  assert.deepEqual(warnings, []);
});

test("env-guard: ANTHROPIC_API_KEY 設定で起動拒否 throw（変数名を含む）", () => {
  assert.throws(
    () => assertSubscriptionAuthEnv({ ANTHROPIC_API_KEY: "sk-ant-xxx" }),
    /ANTHROPIC_API_KEY/
  );
});

test("env-guard: ANTHROPIC_AUTH_TOKEN 設定で起動拒否 throw", () => {
  assert.throws(
    () => assertSubscriptionAuthEnv({ ANTHROPIC_AUTH_TOKEN: "tok" }),
    /ANTHROPIC_AUTH_TOKEN/
  );
});

test("env-guard: CLAUDE_CODE_USE_* プレフィクス一致で起動拒否 throw", () => {
  assert.throws(
    () => assertSubscriptionAuthEnv({ CLAUDE_CODE_USE_BEDROCK: "1" }),
    /CLAUDE_CODE_USE_BEDROCK/
  );
  assert.throws(
    () => assertSubscriptionAuthEnv({ CLAUDE_CODE_USE_VERTEX: "true" }),
    /CLAUDE_CODE_USE_VERTEX/
  );
});

test("env-guard: 複数のガード対象は全て理由に列挙される", () => {
  assert.throws(
    () =>
      assertSubscriptionAuthEnv({
        ANTHROPIC_API_KEY: "k",
        CLAUDE_CODE_USE_BEDROCK: "1"
      }),
    (err) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /ANTHROPIC_API_KEY/);
      assert.match(err.message, /CLAUDE_CODE_USE_BEDROCK/);
      return true;
    }
  );
});

test("env-guard: 空文字は未設定と同義（throw しない）", () => {
  // 空の API キーでは認証も課金も起きない → 誤検知を避け空文字は許容。
  const { warnings } = assertSubscriptionAuthEnv({
    ANTHROPIC_API_KEY: "",
    ANTHROPIC_AUTH_TOKEN: "",
    CLAUDE_CODE_USE_BEDROCK: ""
  });
  assert.deepEqual(warnings, []);
});

test("env-guard: BASE_URL 既定値（末尾スラッシュ差含む）は無害＝warnings 空", () => {
  const a = assertSubscriptionAuthEnv({ ANTHROPIC_BASE_URL: DEFAULT_ANTHROPIC_BASE_URL });
  assert.deepEqual(a.warnings, []);
  const b = assertSubscriptionAuthEnv({ ANTHROPIC_BASE_URL: `${DEFAULT_ANTHROPIC_BASE_URL}/` });
  assert.deepEqual(b.warnings, []);
});

test("env-guard: BASE_URL 非既定値は throw せず warning を返す", () => {
  const { warnings } = assertSubscriptionAuthEnv({
    ANTHROPIC_BASE_URL: "https://proxy.internal:8080"
  });
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /ANTHROPIC_BASE_URL/);
  assert.match(warnings[0], /proxy\.internal/);
});

test("env-guard: env がオブジェクトでなければ TypeError", () => {
  assert.throws(() => assertSubscriptionAuthEnv(null), TypeError);
  assert.throws(() => assertSubscriptionAuthEnv("env"), TypeError);
});
