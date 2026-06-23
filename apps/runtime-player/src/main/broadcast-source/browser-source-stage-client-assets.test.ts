import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  readBrowserSourceStageDevAsset,
  readBrowserSourceStageClientAssets,
  readBrowserSourceStageStaticAsset,
  type BrowserSourceStageDevAssetFetch
} from "./browser-source-stage-client-assets";

const testRequire = createRequire(import.meta.url);
const tempDirectories: string[] = [];

afterEach(() => {
  for (const directoryPath of tempDirectories.splice(0)) {
    rmSync(directoryPath, { recursive: true, force: true });
  }
});

describe("Browser Source Stage client assets", () => {
  it("extracts built client asset routes from the Browser Source Stage html", () => {
    const rendererDirectoryPath = createRendererFixture();

    expect(readBrowserSourceStageClientAssets({
      rendererDirectoryPath,
      tokenQuery: "?token=test"
    })).toStrictEqual({
      modulePreloadHrefs: [
        "/browser-source-assets/global-fixture.js?token=test"
      ],
      stylesheetHrefs: [
        "/browser-source-assets/global-fixture.css?token=test"
      ],
      reactRefreshPreambleSrc: null,
      scriptSrcs: [
        "/browser-source-assets/browser-source-stage-fixture.js?token=test"
      ]
    });
  });

  it("uses same-origin Browser Source server routes for dev client assets", () => {
    expect(readBrowserSourceStageClientAssets({
      rendererServerUrl: "http://127.0.0.1:5173/",
      tokenQuery: "?token=test"
    })).toStrictEqual({
      modulePreloadHrefs: [],
      stylesheetHrefs: [],
      reactRefreshPreambleSrc: "/browser-source-dev-assets/@react-refresh",
      scriptSrcs: [
        "/browser-source-dev-assets/stage/browser-source/browser-source-stage-entry.tsx"
      ]
    });
  });

  it("proxies allowlisted Vite dev assets and rewrites absolute dev imports", async () => {
    const requestedUrls: string[] = [];
    const runtimePlayerViteDepPath = toPosixPath(path.resolve(
      resolveWorkspaceRootPath(),
      "apps/runtime-player/node_modules/.vite/deps/react.js"
    ));
    const asset = await readBrowserSourceStageDevAsset({
      requestPath:
        "/browser-source-dev-assets/stage/browser-source/browser-source-stage-entry.tsx",
      requestSearch: "?v=fixture",
      rendererServerUrl: "http://127.0.0.1:5173/",
      fetcher: async (url) => {
        requestedUrls.push(url);
        return createFetchResponse(
          200,
          "text/javascript; charset=utf-8",
          [
            'import "/@vite/client";',
            'import "/@fs/C:/workspace/remie/code/ai-native-live2d-editor/packages/render-core/src/index.ts";',
            `import "/@fs/${runtimePlayerViteDepPath}?v=fixture";`,
            'import "/stage/browser-source/browser-source-stage-app.tsx";',
            'import "/node_modules/.vite/deps/react.js?v=fixture";',
            'import "/node_modules/react-dom/client.js?v=fixture";',
            'import "/styles/global.css";'
          ].join("\n")
        );
      }
    });

    expect(requestedUrls).toEqual([
      "http://127.0.0.1:5173/stage/browser-source/browser-source-stage-entry.tsx?v=fixture"
    ]);
    expect(asset).toMatchObject({
      statusCode: 200,
      contentType: "text/javascript; charset=utf-8"
    });
    expect(asset?.bytes.toString("utf8")).toContain(
      'import "/browser-source-dev-assets/@vite/client";'
    );
    expect(asset?.bytes.toString("utf8")).toContain(
      'import "/browser-source-dev-assets/@fs/C:/workspace/remie/code/ai-native-live2d-editor/packages/render-core/src/index.ts";'
    );
    expect(asset?.bytes.toString("utf8")).toContain(
      `import "/browser-source-dev-assets/@fs/${runtimePlayerViteDepPath}?v=fixture";`
    );
    expect(asset?.bytes.toString("utf8")).toContain(
      'import "/browser-source-dev-assets/stage/browser-source/browser-source-stage-app.tsx";'
    );
    expect(asset?.bytes.toString("utf8")).toContain(
      'import "/browser-source-dev-assets/node_modules/.vite/deps/react.js?v=fixture";'
    );
    expect(asset?.bytes.toString("utf8")).toContain(
      'import "/browser-source-dev-assets/node_modules/react-dom/client.js?v=fixture";'
    );
    expect(asset?.bytes.toString("utf8")).toContain(
      'import "/browser-source-dev-assets/styles/global.css";'
    );
  });

  it("rewrites nested CSS url() references to same-origin dev proxy paths", async () => {
    const asset = await readBrowserSourceStageDevAsset({
      requestPath: "/browser-source-dev-assets/styles/global.css",
      requestSearch: "",
      rendererServerUrl: "http://127.0.0.1:5173/",
      fetcher: async () =>
        createFetchResponse(
          200,
          "text/css; charset=utf-8",
          [
            '@import "/@vite/client";',
            ".stage {",
            "  background-image: url(/styles/checker.css);",
            "  mask-image: url(/node_modules/react/index.js);",
            "}"
          ].join("\n")
        )
    });

    const css = asset?.bytes.toString("utf8");
    expect(css).toContain('@import "/browser-source-dev-assets/@vite/client";');
    expect(css).toContain(
      "url(/browser-source-dev-assets/styles/checker.css)"
    );
    expect(css).toContain(
      "url(/browser-source-dev-assets/node_modules/react/index.js)"
    );
  });

  it("rejects non-allowlisted Vite dev proxy paths", async () => {
    await expect(readBrowserSourceStageDevAsset({
      requestPath: "/browser-source-dev-assets/main/main.ts",
      requestSearch: "",
      rendererServerUrl: "http://127.0.0.1:5173/",
      fetcher: async () => {
        throw new Error("Unexpected fetch.");
      }
    })).resolves.toBeNull();
    await expect(readBrowserSourceStageDevAsset({
      requestPath: "/browser-source-dev-assets/node_modules/left-pad/index.js",
      requestSearch: "",
      rendererServerUrl: "http://127.0.0.1:5173/",
      fetcher: async () => {
        throw new Error("Unexpected fetch.");
      }
    })).resolves.toBeNull();
  });

  it("proxies selected non-optimized node_modules dev assets", async () => {
    const requestedUrls: string[] = [];
    const asset = await readBrowserSourceStageDevAsset({
      requestPath: "/browser-source-dev-assets/node_modules/react-dom/client.js",
      requestSearch: "?v=fixture",
      rendererServerUrl: "http://127.0.0.1:5173/",
      fetcher: async (url) => {
        requestedUrls.push(url);
        return createFetchResponse(
          200,
          "text/javascript; charset=utf-8",
          "export {};"
        );
      }
    });

    expect(asset?.statusCode).toBe(200);
    expect(requestedUrls).toEqual([
      "http://127.0.0.1:5173/node_modules/react-dom/client.js?v=fixture"
    ]);
  });

  it("allows Vite fs proxy paths only for known workspace package sources and app prebundle deps", async () => {
    const requestedUrls: string[] = [];
    const workspaceRootPath = resolveWorkspaceRootPath();
    const renderCoreSourcePath = toPosixPath(path.resolve(
      workspaceRootPath,
      "packages/render-core/src/index.ts"
    ));
    const runtimePlayerViteDepPath = toPosixPath(path.resolve(
      workspaceRootPath,
      "apps/runtime-player/node_modules/.vite/deps/react.js"
    ));
    const arbitraryRuntimePlayerNodeModulePath = toPosixPath(path.resolve(
      workspaceRootPath,
      "apps/runtime-player/node_modules/react/index.js"
    ));
    const unrelatedViteDepPath = toPosixPath(path.resolve(
      workspaceRootPath,
      "node_modules/.vite/deps/react.js"
    ));
    const rootPackageJsonPath = toPosixPath(path.resolve(
      workspaceRootPath,
      "package.json"
    ));

    const asset = await readBrowserSourceStageDevAsset({
      requestPath: `/browser-source-dev-assets/@fs/${renderCoreSourcePath}`,
      requestSearch: "",
      rendererServerUrl: "http://127.0.0.1:5173/",
      fetcher: async (url) => {
        requestedUrls.push(url);
        return createFetchResponse(
          200,
          "text/javascript; charset=utf-8",
          "export {};"
        );
      }
    });

    expect(asset?.statusCode).toBe(200);
    expect(requestedUrls).toEqual([
      `http://127.0.0.1:5173/@fs/${renderCoreSourcePath}`
    ]);

    const viteDepAsset = await readBrowserSourceStageDevAsset({
      requestPath: `/browser-source-dev-assets/@fs/${runtimePlayerViteDepPath}`,
      requestSearch: "?v=fixture",
      rendererServerUrl: "http://127.0.0.1:5173/",
      fetcher: async (url) => {
        requestedUrls.push(url);
        return createFetchResponse(
          200,
          "text/javascript; charset=utf-8",
          "export {};"
        );
      }
    });

    expect(viteDepAsset?.statusCode).toBe(200);
    expect(requestedUrls).toEqual([
      `http://127.0.0.1:5173/@fs/${renderCoreSourcePath}`,
      `http://127.0.0.1:5173/@fs/${runtimePlayerViteDepPath}?v=fixture`
    ]);
    await expect(readBrowserSourceStageDevAsset({
      requestPath:
        `/browser-source-dev-assets/@fs/${arbitraryRuntimePlayerNodeModulePath}`,
      requestSearch: "",
      rendererServerUrl: "http://127.0.0.1:5173/",
      fetcher: async () => {
        throw new Error("Unexpected fetch.");
      }
    })).resolves.toBeNull();
    await expect(readBrowserSourceStageDevAsset({
      requestPath: `/browser-source-dev-assets/@fs/${unrelatedViteDepPath}`,
      requestSearch: "",
      rendererServerUrl: "http://127.0.0.1:5173/",
      fetcher: async () => {
        throw new Error("Unexpected fetch.");
      }
    })).resolves.toBeNull();
    await expect(readBrowserSourceStageDevAsset({
      requestPath: `/browser-source-dev-assets/@fs/${rootPackageJsonPath}`,
      requestSearch: "",
      rendererServerUrl: "http://127.0.0.1:5173/",
      fetcher: async () => {
        throw new Error("Unexpected fetch.");
      }
    })).resolves.toBeNull();
  });

  it("fetches rewritten app Vite prebundle deps through the Browser Source dev proxy route", async () => {
    const requestedUrls: string[] = [];
    const runtimePlayerViteDepPath = toPosixPath(path.resolve(
      resolveWorkspaceRootPath(),
      "apps/runtime-player/node_modules/.vite/deps/react.js"
    ));

    const asset = await readBrowserSourceStageDevAsset({
      requestPath: `/browser-source-dev-assets/@fs/${runtimePlayerViteDepPath}`,
      requestSearch: "?v=a70dff3e",
      rendererServerUrl: "http://127.0.0.1:5173/",
      fetcher: async (url) => {
        requestedUrls.push(url);
        return createFetchResponse(
          200,
          "text/javascript; charset=utf-8",
          "export const React = {};"
        );
      }
    });

    expect(asset?.statusCode).toBe(200);
    expect(asset?.bytes.toString("utf8")).toContain("export const React");
    expect(requestedUrls).toEqual([
      `http://127.0.0.1:5173/@fs/${runtimePlayerViteDepPath}?v=a70dff3e`
    ]);
  });

  it("proxies Browser Source dev graph imports for Vite env and the runtime player bridge contract", async () => {
    const requestedUrls: string[] = [];
    const viteClientEnvPath = resolveViteClientEnvPath();
    const asset = await readBrowserSourceStageDevAsset({
      requestPath:
        "/browser-source-dev-assets/stage/stage-renderer/stage-view-transform.ts",
      requestSearch: "",
      rendererServerUrl: "http://127.0.0.1:5173/",
      fetcher: async (url) => {
        requestedUrls.push(url);
        return createFetchResponse(
          200,
          "text/javascript; charset=utf-8",
          [
            `import "/@fs/${viteClientEnvPath}";`,
            'import { runtimePlayerStageViewCoordinateSpace } from "/preload/runtime-player-bridge-contract.ts";'
          ].join("\n")
        );
      }
    });

    const rewrittenSource = asset?.bytes.toString("utf8");
    expect(rewrittenSource).toContain(
      `import "/browser-source-dev-assets/@fs/${viteClientEnvPath}";`
    );
    expect(rewrittenSource).toContain(
      'from "/browser-source-dev-assets/preload/runtime-player-bridge-contract.ts";'
    );

    const viteEnvAsset = await readBrowserSourceStageDevAsset({
      requestPath: `/browser-source-dev-assets/@fs/${viteClientEnvPath}`,
      requestSearch: "",
      rendererServerUrl: "http://127.0.0.1:5173/",
      fetcher: async (url) => {
        requestedUrls.push(url);
        return createFetchResponse(
          200,
          "text/javascript; charset=utf-8",
          "export {};"
        );
      }
    });
    const bridgeContractAsset = await readBrowserSourceStageDevAsset({
      requestPath:
        "/browser-source-dev-assets/preload/runtime-player-bridge-contract.ts",
      requestSearch: "",
      rendererServerUrl: "http://127.0.0.1:5173/",
      fetcher: async (url) => {
        requestedUrls.push(url);
        return createFetchResponse(
          200,
          "text/javascript; charset=utf-8",
          "export const runtimePlayerStageViewCoordinateSpace = 'stage-viewport-px-v1';"
        );
      }
    });

    expect(viteEnvAsset?.statusCode).toBe(200);
    expect(bridgeContractAsset?.statusCode).toBe(200);
    expect(requestedUrls).toEqual([
      "http://127.0.0.1:5173/stage/stage-renderer/stage-view-transform.ts",
      `http://127.0.0.1:5173/@fs/${viteClientEnvPath}`,
      "http://127.0.0.1:5173/preload/runtime-player-bridge-contract.ts"
    ]);
  });

  it("keeps unrelated preload files and arbitrary pnpm Vite fs paths rejected", async () => {
    const workspaceRootPath = resolveWorkspaceRootPath();
    const viteClientEnvPath = resolveViteClientEnvPath();
    const vitePackageJsonPath = viteClientEnvPath.replace(
      "/dist/client/env.mjs",
      "/package.json"
    );
    const arbitraryPnpmViteEnvPath = toPosixPath(path.resolve(
      workspaceRootPath,
      "node_modules/.pnpm/vite@0.0.0_fixture/node_modules/vite/dist/client/env.mjs"
    ));
    const rootNodeModulesViteEnvPath = toPosixPath(path.resolve(
      workspaceRootPath,
      "node_modules/vite/dist/client/env.mjs"
    ));
    const rejectedPaths = [
      "/browser-source-dev-assets/preload/runtime-player-bridge.ts",
      "/browser-source-dev-assets/preload/model-mapping-bridge-contract.ts",
      `/browser-source-dev-assets/@fs/${vitePackageJsonPath}`,
      `/browser-source-dev-assets/@fs/${arbitraryPnpmViteEnvPath}`,
      `/browser-source-dev-assets/@fs/${rootNodeModulesViteEnvPath}`
    ];

    for (const requestPath of rejectedPaths) {
      await expect(readBrowserSourceStageDevAsset({
        requestPath,
        requestSearch: "",
        rendererServerUrl: "http://127.0.0.1:5173/",
        fetcher: async () => {
          throw new Error("Unexpected fetch.");
        }
      })).resolves.toBeNull();
    }
  });

  it("serves only js and css files from the renderer assets directory", () => {
    const rendererDirectoryPath = createRendererFixture();

    expect(readBrowserSourceStageStaticAsset({
      rendererDirectoryPath,
      requestPath: "/browser-source-assets/browser-source-stage-fixture.js"
    })).toMatchObject({
      contentType: "text/javascript; charset=utf-8"
    });
    expect(readBrowserSourceStageStaticAsset({
      rendererDirectoryPath,
      requestPath: "/browser-source-assets/global-fixture.css"
    })).toMatchObject({
      contentType: "text/css; charset=utf-8"
    });
    expect(readBrowserSourceStageStaticAsset({
      rendererDirectoryPath,
      requestPath: "/browser-source-assets/../package.json"
    })).toBeNull();
    expect(readBrowserSourceStageStaticAsset({
      rendererDirectoryPath,
      requestPath: "/browser-source-assets/model.wasm"
    })).toBeNull();
  });
});

function createRendererFixture(): string {
  const root = mkdtempSync(path.join(
    tmpdir(),
    "runtime-player-browser-source-assets-"
  ));
  tempDirectories.push(root);
  mkdirSync(path.join(root, "stage", "browser-source"), { recursive: true });
  mkdirSync(path.join(root, "assets"), { recursive: true });
  writeFileSync(
    path.join(root, "stage", "browser-source", "index.html"),
    [
      '<script type="module" crossorigin src="../assets/browser-source-stage-fixture.js"></script>',
      '<link rel="modulepreload" crossorigin href="../assets/global-fixture.js">',
      '<link rel="stylesheet" crossorigin href="../assets/global-fixture.css">'
    ].join("\n"),
    "utf8"
  );
  writeFileSync(
    path.join(root, "assets", "browser-source-stage-fixture.js"),
    "export {};",
    "utf8"
  );
  writeFileSync(
    path.join(root, "assets", "global-fixture.js"),
    "export {};",
    "utf8"
  );
  writeFileSync(
    path.join(root, "assets", "global-fixture.css"),
    "body { background: transparent; }",
    "utf8"
  );
  return root;
}

function createFetchResponse(
  status: number,
  contentType: string,
  body: string
): Awaited<ReturnType<BrowserSourceStageDevAssetFetch>> {
  return {
    status,
    headers: {
      get: (name) => name.toLowerCase() === "content-type"
        ? contentType
        : null
    },
    arrayBuffer: async () => {
      const bytes = Buffer.from(body, "utf8");
      return bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength
      ) as ArrayBuffer;
    }
  };
}

function resolveWorkspaceRootPath(): string {
  let currentPath = path.resolve(process.cwd());

  while (true) {
    if (existsSync(path.join(currentPath, "pnpm-workspace.yaml"))) {
      return currentPath;
    }

    const parentPath = path.dirname(currentPath);
    if (parentPath === currentPath) {
      throw new Error("Unable to find workspace root for Browser Source tests.");
    }
    currentPath = parentPath;
  }
}

function resolveViteClientEnvPath(): string {
  return toPosixPath(testRequire.resolve("vite/dist/client/env.mjs"));
}

function toPosixPath(filePath: string): string {
  return filePath.replaceAll("\\", "/");
}
