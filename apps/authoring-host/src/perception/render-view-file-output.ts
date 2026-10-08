import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import type {
  RenderViewPayload,
  RenderViewResult
} from "@private-2d-rigging-lab/ai-interface";
import { RenderViewResultSchema } from "@private-2d-rigging-lab/ai-interface";

import { renderPerceptionView } from "./render-view-command.js";
import { serializeRenderViewSidecar } from "./render-view-sidecar.js";

/**
 * renderView file output (Wave104 Domain A).
 *
 * The only filesystem-touching layer of the perception stack. It runs the pure
 * {@link renderPerceptionView} pipeline, writes the PNG and its sidecar JSON
 * under `outDir`, and returns the {@link RenderViewResult} (file paths +
 * metadata). Paths in the returned result and sidecar use POSIX separators for
 * deterministic, platform-independent output.
 */

export interface WriteRenderViewInput {
  readonly session: AuthoringSession;
  readonly payload: RenderViewPayload;
  /** Absolute path to the loaded package directory (recorded in the sidecar). */
  readonly packagePath: string;
}

export const writeRenderView = async (
  input: WriteRenderViewInput
): Promise<RenderViewResult> => {
  const artifacts = renderPerceptionView({
    session: input.session,
    payload: input.payload
  });

  const pngRelativePath = `${input.payload.outputName}.png`;
  const sidecarRelativePath = `${input.payload.outputName}.render-view.json`;
  const pngAbsolutePath = joinPosix(input.payload.outDir, pngRelativePath);
  const sidecarAbsolutePath = joinPosix(input.payload.outDir, sidecarRelativePath);

  const sidecar = artifacts.sidecar({
    packagePath: toPosixPath(input.packagePath),
    pngPath: pngAbsolutePath
  });

  await mkdir(input.payload.outDir, { recursive: true });
  await writeFile(join(input.payload.outDir, pngRelativePath), artifacts.png);
  await writeFile(
    join(input.payload.outDir, sidecarRelativePath),
    serializeRenderViewSidecar(sidecar)
  );

  return RenderViewResultSchema.parse({
    schemaVersion: "render-view-result-v1",
    packageRevision: artifacts.packageRevision,
    pngPath: pngAbsolutePath,
    sidecarPath: sidecarAbsolutePath,
    outputWidth: artifacts.outputWidth,
    outputHeight: artifacts.outputHeight,
    sidecar
  });
};

const joinPosix = (dir: string, relative: string): string =>
  `${toPosixPath(dir).replace(/\/+$/, "")}/${relative}`;

const toPosixPath = (path: string): string => path.split("\\").join("/");
