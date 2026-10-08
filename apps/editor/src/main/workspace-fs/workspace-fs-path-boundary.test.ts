import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  resolveWorkspaceMemberPath,
  WorkspaceFsPathBoundaryError
} from "./workspace-fs-path-boundary";

const ROOT = path.resolve(path.sep === "\\" ? "C:\\workspace-root" : "/workspace-root");

describe("resolveWorkspaceMemberPath", () => {
  it("resolves the root itself for an empty relative path", () => {
    expect(resolveWorkspaceMemberPath(ROOT, "")).toBe(ROOT);
  });

  it("resolves a nested member path inside the root", () => {
    const resolved = resolveWorkspaceMemberPath(ROOT, "package/model/model.json");
    expect(resolved).toBe(path.join(ROOT, "package", "model", "model.json"));
  });

  it("rejects parent traversal that escapes the root", () => {
    expect(() => resolveWorkspaceMemberPath(ROOT, "../outside.json")).toThrow(
      WorkspaceFsPathBoundaryError
    );
  });

  it("rejects deep traversal that climbs above the root", () => {
    expect(() =>
      resolveWorkspaceMemberPath(ROOT, "package/../../escape.json")
    ).toThrow(WorkspaceFsPathBoundaryError);
  });

  it("rejects an absolute member path", () => {
    const absoluteMember = path.sep === "\\" ? "C:\\etc\\passwd" : "/etc/passwd";
    expect(() => resolveWorkspaceMemberPath(ROOT, absoluteMember)).toThrow(
      WorkspaceFsPathBoundaryError
    );
  });

  it("rejects a relative root path", () => {
    expect(() => resolveWorkspaceMemberPath("relative-root", "a.json")).toThrow(
      WorkspaceFsPathBoundaryError
    );
  });

  it("does not treat a sibling directory with a shared prefix as inside", () => {
    // `${ROOT}-sibling` shares the string prefix but is not under the root.
    expect(() =>
      resolveWorkspaceMemberPath(ROOT, `..${path.sep}${path.basename(ROOT)}-sibling${path.sep}a.json`)
    ).toThrow(WorkspaceFsPathBoundaryError);
  });
});
