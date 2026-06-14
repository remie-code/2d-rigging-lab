export interface V6BConstrainautorDelaunatorLike {
  readonly coords: ArrayLike<number>;
  readonly triangles: ArrayLike<number>;
  readonly halfedges: ArrayLike<number>;
  readonly hull: ArrayLike<number>;
}

export default class V6BConstrainautorRuntime {
  constructor(del: V6BConstrainautorDelaunatorLike, edges?: readonly [number, number][]);
  readonly del: V6BConstrainautorDelaunatorLike;
  constrainOne(segP1: number, segP2: number): number;
  constrainAll(edges: readonly [number, number][]): this;
  findEdge(p1: number, p2: number): number;
  untriangulatedPoints(): number[];
}
