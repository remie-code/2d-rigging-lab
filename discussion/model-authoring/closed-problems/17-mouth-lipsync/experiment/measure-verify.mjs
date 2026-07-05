// cp17 §4 tape-measure verification.
//   node measure-verify.mjs run    -> CLI inspectEvaluatedGeometry per case
//   node measure-verify.mjs report -> residual gates (§4-1 shape match,
//                                     §4-2 closed crush)
// Profiles are measured exactly as in gen-mouth-morph.mjs (mesh boundary,
// N-band column profile, 3-point smoothing); targets come from
// design-values.json (committed numeric source).
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = "C:/workspace/remie/rigging/llm-rigging";
const MOUTH_A = "draw_r463_780c04ef_dc637e24_mouth_a";

const DV = JSON.parse(readFileSync(join(HERE, "design-values.json"), "utf8"));
const N = DV.nBands;

const CASES = [
  { label: "open1", overrides: { param_mouth_open: 1 }, target: "B" },
  { label: "open0-rest", overrides: {}, target: "open0", crushCheck: true },
  { label: "open1-vowel_i", overrides: { param_mouth_open: 1, param_mouth_vowel_i: 1 }, target: "vowel_i" },
  { label: "open1-vowel_u", overrides: { param_mouth_open: 1, param_mouth_vowel_u: 1 }, target: "vowel_u" },
  { label: "open1-vowel_e", overrides: { param_mouth_open: 1, param_mouth_vowel_e: 1 }, target: "vowel_e" },
  { label: "open1-vowel_o", overrides: { param_mouth_open: 1, param_mouth_vowel_o: 1 }, target: "vowel_o" }
];

const mode = process.argv[2] ?? "run";

if (mode === "run") {
  for (const c of CASES) {
    const spec = {
      command: "inspectEvaluatedGeometry",
      payload: {
        ...(Object.keys(c.overrides).length ? { parameterOverrides: c.overrides } : {}),
        targets: [{ kind: "drawable", drawableId: MOUTH_A }],
        includeVertices: true
      }
    };
    const p = join(HERE, "commands", `verify-${c.label}.json`);
    writeFileSync(p, JSON.stringify(spec));
    console.log(`== verify-${c.label}`);
    execSync(`node "${join(HERE, "read-cmd.mjs")}" "${p}"`, { stdio: "inherit", cwd: HERE });
  }
  process.exit(0);
}

// ---- report: same profile machinery as gen script ----
const meshTopo = (() => {
  const meshes = JSON.parse(readFileSync(join(PKG, "model/meshes.json"), "utf8"));
  const arr = Object.values(meshes).find(Array.isArray);
  return arr.find((x) => x.drawableId === MOUTH_A);
})();

const boundarySamples = (vertices, triangles, step = 0.5) => {
  const count = new Map();
  const key = (a, b) => (a < b ? `${a}_${b}` : `${b}_${a}`);
  for (const t of triangles) {
    const idx = Array.isArray(t) ? t : [t.a, t.b, t.c];
    for (let i = 0; i < 3; i++) {
      const k = key(idx[i], idx[(i + 1) % 3]);
      count.set(k, (count.get(k) ?? 0) + 1);
    }
  }
  const samples = [];
  for (const [k, c] of count) {
    if (c !== 1) continue;
    const [a, b] = k.split("_").map(Number);
    const p = vertices[a], q = vertices[b];
    const len = Math.hypot(q.x - p.x, q.y - p.y);
    const n = Math.max(1, Math.ceil(len / step));
    for (let i = 0; i <= n; i++) {
      samples.push({ x: p.x + ((q.x - p.x) * i) / n, y: p.y + ((q.y - p.y) * i) / n });
    }
  }
  return samples;
};

const smooth3 = (arr) =>
  arr.map((_, i) => {
    const a = arr[Math.max(0, i - 1)], b = arr[i], c = arr[Math.min(arr.length - 1, i + 1)];
    return (a + b + c) / 3;
  });

const profileOf = (samples) => {
  const xs = samples.map((p) => p.x);
  const xL = Math.min(...xs), xR = Math.max(...xs);
  const yTop = Array(N).fill(Infinity), yBot = Array(N).fill(-Infinity);
  for (const p of samples) {
    let k = Math.floor(((p.x - xL) / (xR - xL)) * N);
    if (k === N) k = N - 1;
    if (p.y < yTop[k]) yTop[k] = p.y;
    if (p.y > yBot[k]) yBot[k] = p.y;
  }
  for (let k = 0; k < N; k++) {
    if (yTop[k] === Infinity) {
      let l = k - 1; while (l >= 0 && yTop[l] === Infinity) l--;
      let r = k + 1; while (r < N && yTop[r] === Infinity) r++;
      const src = l >= 0 ? l : r;
      yTop[k] = yTop[src]; yBot[k] = yBot[src];
    }
  }
  return { xL, xR, yTop: smooth3(yTop), yBot: smooth3(yBot), N };
};

const edgeAt = (prof, arr, u) => {
  const t = u * N - 0.5;
  if (t <= 0) return arr[0];
  if (t >= N - 1) return arr[N - 1];
  const k = Math.floor(t), f = t - k;
  return arr[k] * (1 - f) + arr[k + 1] * f;
};

let failures = 0;
const check = (label, ok, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"} ${label} ${detail}`);
  if (!ok) failures += 1;
};

for (const c of CASES) {
  const resp = JSON.parse(readFileSync(join(HERE, "commands", `verify-${c.label}.response.json`), "utf8"));
  const results = resp.aiCommandResponse.payload.results;
  const r = results.find((x) => (x.target?.drawableId ?? x.drawableId) === MOUTH_A);
  const verts = r.vertices ?? r.evaluatedVertices;
  const P = profileOf(boundarySamples(verts, meshTopo.triangles));
  const T = DV.profiles[c.target];

  // §4-1 shape match: column mean residual <=3px, max <=6px (top+bottom edges
  // on the shared u grid, plus corner x residuals)
  let sum = 0, max = 0, cnt = 0;
  for (let k = 0; k < N; k++) {
    const u = (k + 0.5) / N;
    const rTop = Math.abs(P.yTop[k] - edgeAt(T, T.yTop, u));
    const rBot = Math.abs(P.yBot[k] - edgeAt(T, T.yBot, u));
    sum += rTop + rBot; cnt += 2;
    max = Math.max(max, rTop, rBot);
  }
  const rXL = Math.abs(P.xL - T.xL), rXR = Math.abs(P.xR - T.xR);
  sum += rXL + rXR; cnt += 2;
  max = Math.max(max, rXL, rXR);
  const avg = sum / cnt;
  check(`${c.label}: profile matches ${c.target}`, avg <= 3 && max <= 6,
    `(avg ${avg.toFixed(2)}px, max ${max.toFixed(2)}px, corners L ${rXL.toFixed(2)} R ${rXR.toFixed(2)})`);

  // §4-2 crush: every column height <= closed height + 2px
  if (c.crushCheck) {
    let worst = -Infinity, worstK = -1;
    for (let k = 0; k < N; k++) {
      const u = (k + 0.5) / N;
      const h = P.yBot[k] - P.yTop[k];
      const hT = edgeAt(T, T.yBot, u) - edgeAt(T, T.yTop, u);
      if (h - hT > worst) { worst = h - hT; worstK = k; }
    }
    check(`${c.label}: crush height <= closed + 2px`, worst <= 2,
      `(worst excess ${worst.toFixed(2)}px @band ${worstK})`);
  }
}
console.log(failures === 0 ? "VERIFY: ALL PASS" : `VERIFY: ${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
