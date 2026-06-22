# Workspace Package Bundling Decision

> Status: Accepted short-term direction / long-term migration required.  
> Topic: Runtime Playerがmonorepo内workspace packageをElectron main/preloadで利用する時の実行形態。

## 1. Context

Runtime Player Wave2で、Electron main processが `@private-2d-rigging-lab/package-format` を使ってRuntime Exportを検証・読み込みするようになった。

このrepositoryのworkspace packagesは、開発中monorepoとして多くがTypeScript sourceを直接exportsしている。

例:

```json
{
  "exports": {
    ".": "./src/index.ts"
  }
}
```

一方、`package-format/src/index.ts` はNodeNext向けに `.js` extension付きspecifierを持つ。

```ts
export { packageFormatPackageInfo } from "./package-info.js";
```

Electron main bundleがworkspace packageをexternal dependencyとして残すと、起動時にNode/Electronが `./src/index.ts` を直接読み、実ファイルとして存在しない `package-info.js` を解決しようとして `ERR_MODULE_NOT_FOUND` になる。

## 2. Accepted Short-Term Direction

Runtime Player開発中は、Electron main/preloadから実行時に使うworkspace packageをexternalizeせず、Electron app bundleへ含める。

Reason:

- Runtime Playerを先に動かすための局所修正で済む。
- `package-format` や `contracts` などのworkspace package全体を今すぐbuild artifact export化するより影響範囲が小さい。
- Runtime Playerは最終的に配布アプリになるため、実行時にuser環境でmonorepo source packageをNode解決する形は避けたい。
- Renderer側にNode/file accessを漏らさず、main/preload/stage boundaryを保ったまま修正できる。

Implementation guidance:

- `apps/runtime-player/electron.vite.config.ts` の `main.build.externalizeDeps` で、Runtime Player mainが実行時に使うworkspace packageをbundle対象にする。
- 少なくとも `@private-2d-rigging-lab/package-format` と、そのruntime dependencyである `@private-2d-rigging-lab/contracts` はbundle対象にする。
- 同じ問題がpreloadで発生する場合も、preload側で必要なworkspace packageをbundle対象にする。
- `apps/editor/**` をRuntime Playerへimportすることは引き続き禁止。

## 3. Long-Term Direction

長期的には、workspace packagesはRuntime Playerや他のexternal appからNode/Electron runtime dependencyとして利用できるよう、build済みJavaScript artifactをexportsする形へ移行する。

Desired shape:

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  }
}
```

The long-term target is:

- `packages/package-format` が `dist/index.js` と `dist/index.d.ts` を生成する。
- `packages/contracts`, `packages/runtime-core`, `packages/render-core`, `packages/render-webgl2` など、Runtime Playerからruntime importされるpackageも同様にbuild artifact exportへ寄せる。
- TypeScript source-only exportsは、test/build toolingの中だけで成立する開発時便宜に留める。
- Electron appがworkspace packageをexternalizeしても、Nodeがbuild済みJSを解決できる。

## 4. Rejected Fixes

Do not:

- `package-format/src/index.ts` のimport specifierを `.ts` に変えてNode実行へ寄せる。
- 手で `package-info.js` のような生成物もどきを `src/` に置く。
- Runtime Player main processでTypeScript source packageをNodeに直接解決させる前提にする。
- `apps/runtime-player` から `apps/editor/**` を参照して既存Editor runtime viewを流用する。

These fixes hide the boundary problem and make packaged Runtime Player behavior harder to reason about.

## 5. Migration Trigger

This decision should be revisited when one of these becomes true:

- Runtime Player packaging/distribution work starts.
- Runtime Player depends on multiple workspace packages in main/preload and bundling exceptions become broad.
- Another external app or CLI needs to consume `packages/**` as runtime dependencies.
- CI needs to verify Runtime Player from build artifacts rather than source workspace links.

At that point, create a dedicated package build/export migration wave instead of accumulating more app-local bundling exceptions.

