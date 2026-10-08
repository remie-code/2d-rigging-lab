// Installs the workspace source resolver hooks (see workspace-source-resolver.mjs)
// for a process launched with `node --import <this file>`. Kept separate from the
// hooks module because module.register must run on the main thread while the hooks
// run on a worker thread.
import { register } from "node:module";

register("./workspace-source-resolver.mjs", import.meta.url);
