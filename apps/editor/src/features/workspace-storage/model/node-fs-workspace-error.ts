// Error helpers that keep the node:fs-backed adapter compatible with the port
// contract in `workspace-directory-io.ts`. That module recognises a missing
// handle purely by `error.name === "NotFoundError"` (see `isMissingHandleError`),
// so the adapter must raise DOM-like errors with the right `name` rather than
// leaking node's `ENOENT` shape across the IPC boundary.

export function createDomLikeError(name: string, message: string): Error {
  const error = new Error(message);
  Object.defineProperty(error, "name", {
    value: name
  });
  return error;
}

export function createNotFoundError(message: string): Error {
  return createDomLikeError("NotFoundError", message);
}

export function createAbortError(message: string): Error {
  return createDomLikeError("AbortError", message);
}
