/**
 * Deterministic hash-seeded unit-interval derivation for the physiology layer
 * (C2 Domain B). This mirrors the repository's established seeded-noise flavor
 * used by the mesh-outline generators
 * (packages/authoring-core/src/mesh-outline-v3-envelope-generation.ts:964-989
 * `hashString` / `hashUnit`): an integer seed and a few integer coordinates are
 * mixed with `Math.imul`/xor/`>>> 0` into a value in [0, 1].
 *
 * Purity contract (blocking review observation for physiology/):
 *  - No Electron imports.
 *  - No wall clock (`Date.now`/`performance.now`/`new Date`).
 *  - No non-seeded randomness (`Math.random`, `crypto`). Every value here is a
 *    pure function of its integer arguments.
 *
 * A stateful PRNG class is deliberately avoided: the generator must be a pure
 * function of (seed, config, logical time), so all "randomness" is re-derivable
 * from the seed plus a small set of integer coordinates (event index, channel).
 */

/**
 * FNV-1a style string hash → 32-bit unsigned integer. Used to fold a behavior
 * id (or any string discriminator) into the numeric seed space so distinct
 * behavior classes draw decorrelated streams from one session seed.
 */
export function hashStringToSeed(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

/**
 * Mix two 32-bit seeds into one (avalanche via imul/xor). Deterministic and
 * order-sensitive; used to derive a sub-seed for each behavior class from the
 * session seed.
 */
export function mixSeeds(seedA: number, seedB: number): number {
  let hash = (seedA ^ Math.imul(seedB + 0x9e3779b9, 0x85ebca6b)) >>> 0;
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

/**
 * Derive a behavior's decorrelated sub-seed from the session seed + its stable
 * behavior id. This is THE single derivation the generator uses to seed each
 * behavior, extracted so a COUPLED behavior can recompute a SIBLING's exact
 * sub-seed from the shared coupling seed (= session seed) and reference the
 * sibling's deterministic schedule (C3 Domain B, design §3 結合). Because both
 * the generator and any coupling call this same function, the seeds agree by
 * construction — no state is shared, only the pure derivation.
 */
export function deriveBehaviorSeed(sessionSeed: number, behaviorId: string): number {
  return mixSeeds(sessionSeed >>> 0, hashStringToSeed(behaviorId));
}

/**
 * Deterministic value in [0, 1] from an integer seed plus two integer
 * coordinates (typically an event index and a channel discriminator). Identical
 * construction to the mesh-outline `hashUnit` precedent.
 */
export function hashUnit(seed: number, index: number, channel: number): number {
  let hash = seed ^ Math.imul(index + 0x9e3779b9, 0x85ebca6b);
  hash ^= Math.imul(channel + 0xc2b2ae35, 0x27d4eb2d);
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b);
  hash ^= hash >>> 16;
  return (hash >>> 0) / 0xffffffff;
}
