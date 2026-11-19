// @ts-check
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { createTaskSessionScope } from "../../mind/task-session.mjs";

/** @typedef {{ id: string; name: string; path: string; kind?: "pdf" | "image" }} VenueMaterial */
/** @typedef {{ kind: string; request: string; reply: string; workdir?: string }} VenueTaskReply */
/** @typedef {{ documents: ReadonlyArray<VenueMaterial>; replies: ReadonlyArray<VenueTaskReply>; workdirs: ReadonlyArray<string> }} VenueWriterMaterials */

/** The only deletion target is the directory this venue creates. */
export function createVenueTaskResources() {
  const sessions = createTaskSessionScope();
  /** @type {string | null} */
  let root = null;
  let retain = false;
  /** @type {Map<string, Readonly<VenueMaterial>>} */
  const documents = new Map();
  /** @type {Map<string, Readonly<VenueMaterial>>} */
  const bySource = new Map();
  /** @type {Readonly<VenueTaskReply>[]} */
  const replies = [];
  /** @type {string[]} */
  const workdirs = [];

  const requireOpen = () => {
    if (!sessions.isOpen()) throw new Error("venue task intake is closed");
  };
  const directory = () => root ??= mkdtempSync(resolve(tmpdir(), "soul-venue-"));

  const access = Object.freeze({
    /** @param {{ name: string; bytes: Uint8Array; kind?: "pdf" | "image"; source?: string }} input */
    storeDocument({ name, bytes, kind, source }) {
      requireOpen();
      const existing = source ? bySource.get(source) : undefined;
      if (existing) return existing;
      const id = randomUUID();
      const extension = extname(name);
      const path = join(directory(), id + (/^\.[a-z\d]{1,12}$/i.test(extension) ? extension : ""));
      writeFileSync(path, bytes, { flag: "wx" });
      const document = Object.freeze({ id, name, path, ...(kind ? { kind } : {}) });
      documents.set(id, document);
      if (source) bySource.set(source, document);
      return document;
    },
    /** @param {string} id */
    getDocument: (id) => documents.get(id),
    listDocuments: () => [...documents.values()],
    listWorkdirs: () => [...workdirs],
    /** @param {Uint8Array} png */
    storePageImage(png) {
      // The tools for an accepted task may finish while the venue is closing.
      // Its workdir already exists, so the venue root stays alive until they finish.
      if (!root) throw new Error("venue task workdir has not been allocated");
      const path = join(root, randomUUID() + ".png");
      writeFileSync(path, png, { flag: "wx" });
      return path;
    },
    /** @param {import("../../mind/task-session.mjs").TaskSessionRequest & { kind: string; request: string }} task */
    async runTask({ kind, request, create, sessionOptions, content, timeout }) {
      requireOpen();
      const workdir = join(directory(), randomUUID());
      mkdirSync(workdir);
      workdirs.push(workdir);
      const reply = await sessions.run({ create, sessionOptions: { ...sessionOptions, cwd: workdir }, content, timeout });
      if (typeof reply === "string") replies.push(Object.freeze({ kind, request, reply, workdir }));
      return reply;
    }
  });

  return {
    access,
    /** @param {VenueTaskReply} result */
    noteReply(result) {
      replies.push(Object.freeze({ ...result }));
    },
    /** @returns {VenueWriterMaterials} */
    writerMaterials: () => ({ documents: [...documents.values()], replies: [...replies], workdirs: [...workdirs] }),
    stopAccepting: sessions.stopAccepting,
    waitForIdle: sessions.waitForIdle,
    retainedPath: () => root,
    retainOnUnconfirmedExit() {
      retain = true;
    },
    async release() {
      sessions.stopAccepting();
      await sessions.waitForIdle();
      documents.clear();
      bySource.clear();
      replies.length = 0;
      workdirs.length = 0;
      if (retain || sessions.getCleanupFailures().length > 0) return { retained: root };
      if (root) rmSync(root, { recursive: true, force: true });
      root = null;
      return { retained: null };
    }
  };
}

/** @typedef {ReturnType<typeof createVenueTaskResources>["access"]} VenueTaskAccess */
