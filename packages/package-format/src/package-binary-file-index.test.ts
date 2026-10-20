import { describe, expect, it } from "vitest";

import {
  indexPackageInMemoryFileSet,
  readIndexedPackageBinaryFileEntry
} from "./package-binary-file-index.js";

const BINARY_PATH = "assets/sources/generated-fixture.bin";

describe("package binary file index", () => {
  it("checks the set once and shares Uint8Array bytes instead of copying them", () => {
    const sourceBytes = new Uint8Array([1, 2, 3]);
    const index = indexPackageInMemoryFileSet([
      { path: "manifest.json", text: "{}" },
      { path: BINARY_PATH, bytes: sourceBytes, mediaType: "application/octet-stream" }
    ]);

    expect(index.entries.map((entry) => entry.path)).toEqual(["manifest.json", BINARY_PATH]);
    expect(index.binaryEntriesByPath.get(BINARY_PATH)?.bytes).toBe(sourceBytes);
    expect(index.binaryEntriesByPath.has("manifest.json")).toBe(false);
  });

  it("copies only the entry that is read out of the index", () => {
    const sourceBytes = new Uint8Array([1, 2, 3]);
    const index = indexPackageInMemoryFileSet([
      { path: BINARY_PATH, bytes: sourceBytes, mediaType: "application/octet-stream", binaryAssetId: "bin_fixture" }
    ]);
    const entry = readIndexedPackageBinaryFileEntry(index, BINARY_PATH);

    expect(entry).toEqual({
      path: BINARY_PATH,
      bytes: new Uint8Array([1, 2, 3]),
      mediaType: "application/octet-stream",
      binaryAssetId: "bin_fixture"
    });
    expect(entry?.bytes).not.toBe(sourceBytes);
    expect(readIndexedPackageBinaryFileEntry(index, "assets/sources/missing.bin")).toBeUndefined();
  });

  it("rejects unsafe and duplicate paths like createPackageInMemoryFileSet", () => {
    expect(() => indexPackageInMemoryFileSet([
      { path: BINARY_PATH, bytes: new Uint8Array([1]), mediaType: "application/octet-stream" },
      { path: BINARY_PATH, text: "dup" }
    ])).toThrow(/Duplicate package file path/);
    expect(() => indexPackageInMemoryFileSet([
      { path: "../escape.json", text: "{}" }
    ])).toThrow(/Unsafe package file path/);
    expect(() => indexPackageInMemoryFileSet([
      { path: "model/not-an-asset.bin", bytes: new Uint8Array([1]), mediaType: "application/octet-stream" }
    ])).toThrow(/assets\/sources/);
  });
});
