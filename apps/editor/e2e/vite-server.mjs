import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const startOrReuseEditorServer = async ({ repoRoot }) => {
  const envUrl = process.env.EDITOR_E2E_BASE_URL;

  if (envUrl !== undefined && envUrl.trim().length > 0) {
    const baseUrl = normalizeBaseUrl(envUrl);
    await assertEditorServer(baseUrl);

    return {
      baseUrl,
      reused: true,
      close: async () => {}
    };
  }

  const defaultUrl = "http://127.0.0.1:5173/";
  if (await isEditorServer(defaultUrl)) {
    return {
      baseUrl: defaultUrl,
      reused: true,
      close: async () => {}
    };
  }

  const editorRoot = path.join(repoRoot, "apps", "editor");
  const vite = await importVite(editorRoot);
  const server = await vite.createServer({
    root: editorRoot,
    configFile: path.join(editorRoot, "vite.config.ts"),
    logLevel: "error",
    server: {
      host: "127.0.0.1",
      port: 0,
      strictPort: false
    }
  });

  await server.listen();

  const baseUrl = server.resolvedUrls?.local?.[0];
  if (baseUrl === undefined) {
    await server.close();
    throw new Error("Vite did not expose a local editor server URL.");
  }

  await assertEditorServer(baseUrl);

  return {
    baseUrl,
    reused: false,
    close: async () => {
      await server.close();
    }
  };
};

const importVite = async (editorRoot) => {
  const requireFromEditor = createRequire(pathToFileURL(path.join(editorRoot, "package.json")));
  const vitePath = requireFromEditor.resolve("vite");

  return import(pathToFileURL(vitePath));
};

const normalizeBaseUrl = (baseUrl) => (baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);

const assertEditorServer = async (baseUrl) => {
  if (!(await isEditorServer(baseUrl))) {
    throw new Error(`Editor e2e server did not look like apps/editor at ${baseUrl}`);
  }
};

const isEditorServer = async (baseUrl) => {
  try {
    const response = await fetch(baseUrl, {
      signal: AbortSignal.timeout(2_000)
    });

    if (!response.ok) {
      return false;
    }

    const text = await response.text();

    return text.includes("2D Rigging Editor") && text.includes("/src/main.ts");
  } catch {
    return false;
  }
};
