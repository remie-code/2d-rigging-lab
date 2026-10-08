export interface V7ConstrainautorDelaunatorLike {
  readonly coords: ArrayLike<number>;
  readonly triangles: ArrayLike<number>;
  readonly halfedges: ArrayLike<number>;
  readonly hull: ArrayLike<number>;
}

export default class V7ConstrainautorRuntime {
  constructor(del: V7ConstrainautorDelaunatorLike, edges?: readonly [number, number][]);
  readonly del: V7ConstrainautorDelaunatorLike;
  constrainOne(segP1: number, segP2: number): number;
  constrainAll(edges: readonly [number, number][]): this;
  findEdge(p1: number, p2: number): number;
  untriangulatedPoints(): number[];
}
