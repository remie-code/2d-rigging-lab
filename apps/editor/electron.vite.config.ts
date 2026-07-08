import { fileURLToPath } from "node:url";
import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "electron-vite";

const packageRoot = path.dirname(fileURLToPath(import.meta.url));
const sourceRoot = path.resolve(packageRoot, "src");

export default defineConfig({
  main: {
    build: {
      lib: {
        entry: path.resolve(sourceRoot, "main/main.ts")
      }
    }
  },
  preload: {
    build: {
      lib: {
        entry: {
          preload: path.resolve(sourceRoot, "preload/preload.ts")
        }
      }
    }
  },
  renderer: {
    root: packageRoot,
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
          index: path.resolve(packageRoot, "index.html")
        }
      }
    },
    plugins: [react(), tailwindcss()]
  }
});
