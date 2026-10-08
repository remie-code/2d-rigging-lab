import { fileURLToPath } from "node:url";
import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "electron-vite";

const packageRoot = path.dirname(fileURLToPath(import.meta.url));
const sourceRoot = path.resolve(packageRoot, "src");
const workspacePackagesToBundleInElectron = [
  "@private-2d-rigging-lab/package-format",
  "@private-2d-rigging-lab/contracts"
];

export default defineConfig({
  main: {
    build: {
      externalizeDeps: {
        exclude: workspacePackagesToBundleInElectron
      },
      lib: {
        entry: path.resolve(sourceRoot, "main/main.ts")
      }
    }
  },
  preload: {
    build: {
      externalizeDeps: {
        exclude: workspacePackagesToBundleInElectron
      },
      lib: {
        entry: {
          preload: path.resolve(sourceRoot, "preload/preload.ts"),
          "stage-preload": path.resolve(sourceRoot, "preload/stage-preload.ts")
        }
      }
    }
  },
  renderer: {
    root: sourceRoot,
    define: {
      global: "globalThis"
    },
    optimizeDeps: {
      esbuildOptions: {
        define: {
          global: "globalThis"
        }
      }
    },
    server: {
      host: "127.0.0.1"
    },
    build: {
      rollupOptions: {
        input: {
          control: path.resolve(sourceRoot, "control/index.html"),
          stage: path.resolve(sourceRoot, "stage/index.html"),
          "browser-source-stage": path.resolve(
            sourceRoot,
            "stage/browser-source/index.html"
          )
        }
      }
    },
    plugins: [react(), tailwindcss()]
  }
});
