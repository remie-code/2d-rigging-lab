import type {
  RuntimeModelInitialStateRequestInput,
  RuntimeModelInstance
} from "@private-2d-rigging-lab/runtime-core";

import type {
  RuntimeExportEvaluationScaffold
} from "./runtime-export-evaluation-cache";

export interface RuntimeExportRuntimeModelInstanceCacheOptions {
  readonly initialStateRequest: RuntimeModelInitialStateRequestInput;
}

export interface RuntimeExportRuntimeModelInstanceCacheMetricsSnapshot {
  readonly runtimeModelInstanceCacheHitCount: number;
  readonly runtimeModelInstanceCacheMissCount: number;
  readonly runtimeModelInstanceCacheInvalidationCount: number;
}

export class RuntimeExportRuntimeModelInstanceCache {
  #entry: {
    readonly cacheKey: string;
    readonly instance: RuntimeModelInstance;
  } | null = null;
  #hitCount = 0;
  #missCount = 0;
  #invalidationCount = 0;

  getOrCreate(
    scaffold: RuntimeExportEvaluationScaffold,
    options: RuntimeExportRuntimeModelInstanceCacheOptions
  ): RuntimeModelInstance {
    if (this.#entry?.cacheKey === scaffold.cacheKey) {
      this.#hitCount += 1;
      return this.#entry.instance;
    }

    if (this.#entry !== null) {
      this.#invalidationCount += 1;
    }

    const instance = scaffold.compiledRuntimeModel.createInstance({
      initialStateRequest: options.initialStateRequest
    });
    this.#missCount += 1;
    this.#entry = {
      cacheKey: scaffold.cacheKey,
      instance
    };

    return instance;
  }

  clear(): void {
    if (this.#entry !== null) {
      this.#invalidationCount += 1;
    }
    this.#entry = null;
  }

  getMetricsSnapshot(): RuntimeExportRuntimeModelInstanceCacheMetricsSnapshot {
    return {
      runtimeModelInstanceCacheHitCount: this.#hitCount,
      runtimeModelInstanceCacheMissCount: this.#missCount,
      runtimeModelInstanceCacheInvalidationCount: this.#invalidationCount
    };
  }
}
