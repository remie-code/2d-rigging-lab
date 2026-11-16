// @ts-check
import assert from "node:assert/strict";
import { test } from "node:test";
import { createTaskSessionScope } from "./task-session.mjs";

test("a closed scope finishes accepted execution and disposal while a new scope can run", async () => {
  const oldScope = createTaskSessionScope();
  const newScope = createTaskSessionScope();
  const reply = Promise.withResolvers();
  const disposing = Promise.withResolvers();
  const disposed = Promise.withResolvers();
  const events = [];
  const oldTask = oldScope.run({
    create(options) {
      assert.deepEqual(options, {
        cwd: "C:/old", sandbox: "read-only", finalAnswerOnly: true, ephemeral: true
      });
      return {
        ask(content) {
          events.push(content);
          return reply.promise;
        },
        async dispose() {
          disposing.resolve();
          await disposed.promise;
        }
      };
    },
    sessionOptions: { cwd: "C:/old", sandbox: "read-only" },
    content: "old request"
  });
  oldScope.stopAccepting();
  const idle = oldScope.waitForIdle().then(() => events.push("idle"));
  const newRequest = {
    create: () => ({
      async ask() { return { replyText: "I could only read part of it." }; },
      async dispose() { events.push("new disposed"); }
    }),
    sessionOptions: { cwd: "C:/new", sandbox: "workspace-write" },
    content: "new request"
  };
  assert.equal(oldScope.isOpen(), false);
  await assert.rejects(oldScope.run(newRequest), /scope is closed/);
  assert.equal(await newScope.run(newRequest), "I could only read part of it.");

  reply.resolve({ replyText: "old answer" });
  await disposing.promise;
  assert.deepEqual(events, ["old request", "new disposed"]);
  disposed.resolve();
  assert.equal(await oldTask, "old answer");
  await idle;
  assert.deepEqual(events, ["old request", "new disposed", "idle"]);
});

test("factory and ask failures reject, and a created session is disposed", async () => {
  const scope = createTaskSessionScope();
  const options = { sessionOptions: {}, content: "request" };
  const failure = new Error("failed");
  await assert.rejects(scope.run({ ...options, create() { throw failure; } }), failure);
  let disposed = false;
  await assert.rejects(scope.run({
    ...options,
    create: () => ({
      async ask() { throw failure; },
      async dispose() { disposed = true; }
    })
  }), failure);
  assert.equal(disposed, true);
  await scope.waitForIdle();
});

test("disposal failure is retained separately from a reply or ask failure", async () => {
  const scope = createTaskSessionScope();
  const cleanupError = new Error("worker exit could not be confirmed");
  const askError = new Error("turn failed");
  /** @type {import("./task-session.mjs").TaskSessionRequest} */
  const request = {
    sessionOptions: {},
    content: "request",
    create: () => ({
      async ask() { return { replyText: "completed" }; },
      async dispose() { throw cleanupError; }
    })
  };
  assert.equal(await scope.run(request), "completed");
  await assert.rejects(scope.run({
    ...request,
    create: () => ({
      ...request.create({}),
      async ask() { throw askError; }
    })
  }), askError);
  scope.stopAccepting();
  await scope.waitForIdle();
  assert.deepEqual(scope.getCleanupFailures(), [cleanupError, cleanupError]);
});
