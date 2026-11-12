// Core maths for the DG-ABM PCA explorer - no libraries, runs in the browser and in node.
// Mirrors what the R app does: standardize (sample sd) -> weight by sqrt(w) -> PCA ->
// Ward.D2 on the first PCs reaching 70 % of the variance -> cutree -> silhouette.
(function (root) {
  'use strict';

  // ---- standardize + weight ------------------------------------------------
  // X: array of rows, cols: column indices, weights: array (same length as cols) or null
  function standardize(X, cols, weights) {
    const n = X.length, p = cols.length, Z = Array.from({ length: n }, () => new Float64Array(p));
    const constant = [];
    for (let j = 0; j < p; j++) {
      let m = 0; for (let i = 0; i < n; i++) m += X[i][cols[j]]; m /= n;
      let ss = 0; for (let i = 0; i < n; i++) { const d = X[i][cols[j]] - m; ss += d * d; }
      const sd = Math.sqrt(ss / (n - 1));
      if (sd < 1e-12) { constant.push(j); continue; }
      const w = Math.sqrt(weights ? weights[j] : 1);
      for (let i = 0; i < n; i++) Z[i][j] = ((X[i][cols[j]] - m) / sd) * w;
    }
    return { Z, constant };
  }

  // ---- symmetric eigen decomposition (cyclic Jacobi) ----------------------
  function jacobiEigen(S) {
    const n = S.length, A = S.map(r => Float64Array.from(r));
    const V = Array.from({ length: n }, (_, i) => { const r = new Float64Array(n); r[i] = 1; return r; });
    for (let sweep = 0; sweep < 100; sweep++) {
      let off = 0; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += A[i][j] * A[i][j];
      if (off < 1e-24) break;
      for (let p = 0; p < n - 1; p++) for (let q = p + 1; q < n; q++) {
        if (Math.abs(A[p][q]) < 1e-300) continue;
        const theta = (A[q][q] - A[p][p]) / (2 * A[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < n; k++) { const a = A[k][p], b = A[k][q]; A[k][p] = c * a - s * b; A[k][q] = s * a + c * b; }
        for (let k = 0; k < n; k++) { const a = A[p][k], b = A[q][k]; A[p][k] = c * a - s * b; A[q][k] = s * a + c * b; }
        for (let k = 0; k < n; k++) { const a = V[k][p], b = V[k][q]; V[k][p] = c * a - s * b; V[k][q] = s * a + c * b; }
      }
    }
    const values = Array.from({ length: n }, (_, i) => A[i][i]);
    return { values, vectors: V }; // eigenvector j = column j of V
  }

  function pca(Z) {
    const n = Z.length, p = Z[0].length;
    const C = Array.from({ length: p }, () => new Float64Array(p));
    for (let i = 0; i < n; i++) for (let a = 0; a < p; a++) { const za = Z[i][a]; if (za === 0) continue; for (let b = a; b < p; b++) C[a][b] += za * Z[i][b]; }
    for (let a = 0; a < p; a++) for (let b = a; b < p; b++) { C[a][b] /= (n - 1); C[b][a] = C[a][b]; }
    const { values, vectors } = jacobiEigen(C);
    const order = values.map((v, i) => i).sort((a, b) => values[b] - values[a]);
    const total = values.reduce((s, v) => s + Math.max(v, 0), 0);
    const sdev2 = order.map(i => Math.max(values[i], 0));
    const loadings = order.map(i => { const col = new Float64Array(p); for (let k = 0; k < p; k++) col[k] = vectors[k][i]; return col; });
    // sign convention: largest |loading| positive (R's sign is arbitrary, this makes ours stable)
    loadings.forEach(col => { let m = 0; for (let k = 0; k < p; k++) if (Math.abs(col[k]) > Math.abs(col[m])) m = k; if (col[m] < 0) for (let k = 0; k < p; k++) col[k] = -col[k]; });
    const scores = Array.from({ length: n }, (_, i) => loadings.map(col => { let s = 0; for (let k = 0; k < p; k++) s += Z[i][k] * col[k]; return s; }));
    const explained = sdev2.map(v => 100 * v / total);
    const cumulative = []; explained.reduce((s, v, i) => (cumulative[i] = s + v), 0);
    let nPc = cumulative.findIndex(c => c >= 70 - 1e-9) + 1; nPc = Math.max(2, Math.min(nPc || p, p));
    return { scores, loadings, sdev2, explained, cumulative, nPc };
  }

  // ---- Ward.D2 hierarchical clustering ------------------------------------
  function euclid(rows, dim) {
    const n = rows.length, D = new Float64Array(n * n);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      let s = 0; for (let k = 0; k < dim; k++) { const d = rows[i][k] - rows[j][k]; s += d * d; }
      D[i * n + j] = D[j * n + i] = Math.sqrt(s);
    }
    return D;
  }

  // Lance-Williams on squared distances; height = sqrt(merge criterion) (= R's "ward.D2")
  function wardD2(D, n) {
    const d2 = new Float64Array(n * n); for (let i = 0; i < n * n; i++) d2[i] = D[i] * D[i];
    const size = new Float64Array(2 * n - 1).fill(1), alive = [], id = new Int32Array(n);
    for (let i = 0; i < n; i++) { alive.push(i); id[i] = i; }
    const nodes = []; for (let i = 0; i < n; i++) nodes.push({ leaf: i, size: 1 });
    // work matrix indexed by slot (0..n-1); slot holds the current node id
    const slotNode = Array.from({ length: n }, (_, i) => i);
    const merges = [];
    let live = Array.from({ length: n }, (_, i) => i);
    for (let step = 0; step < n - 1; step++) {
      let best = Infinity, bi = -1, bj = -1;
      for (let a = 0; a < live.length; a++) for (let b = a + 1; b < live.length; b++) {
        const v = d2[live[a] * n + live[b]]; if (v < best) { best = v; bi = live[a]; bj = live[b]; }
      }
      const ni = size[slotNode[bi]], nj = size[slotNode[bj]], newId = n + step;
      size[newId] = ni + nj;
      for (const k of live) { if (k === bi || k === bj) continue;
        const nk = size[slotNode[k]];
        const v = ((ni + nk) * d2[bi * n + k] + (nj + nk) * d2[bj * n + k] - nk * best) / (ni + nj + nk);
        d2[bi * n + k] = d2[k * n + bi] = v;
      }
      merges.push({ a: slotNode[bi], b: slotNode[bj], height: Math.sqrt(Math.max(best, 0)), size: ni + nj, id: newId });
      slotNode[bi] = newId; live = live.filter(k => k !== bj);
    }
    return merges; // node ids: 0..n-1 leaves, n+step internal
  }

  // cut into k clusters; labels numbered by first appearance (same as R's cutree)
  function cutree(merges, n, k) {
    const parent = Array.from({ length: 2 * n - 1 }, (_, i) => i);
    const find = x => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
    for (let s = 0; s < n - k; s++) { const m = merges[s]; parent[find(m.a)] = m.id; parent[find(m.b)] = m.id; }
    const lab = new Int32Array(n), map = new Map(); let next = 1;
    for (let i = 0; i < n; i++) { const r = find(i); if (!map.has(r)) map.set(r, next++); lab[i] = map.get(r); }
    return lab;
  }

  function silhouette(labels, D, n) {
    const ks = [...new Set(labels)]; const sum = new Float64Array(n);
    let total = 0;
    for (let i = 0; i < n; i++) {
      const acc = {}; const cnt = {};
      for (const c of ks) { acc[c] = 0; cnt[c] = 0; }
      for (let j = 0; j < n; j++) if (j !== i) { acc[labels[j]] += D[i * n + j]; cnt[labels[j]]++; }
      const own = labels[i];
      if (cnt[own] === 0) { sum[i] = 0; continue; }
      const a = acc[own] / cnt[own]; let b = Infinity;
      for (const c of ks) if (c !== own && cnt[c] > 0) b = Math.min(b, acc[c] / cnt[c]);
      sum[i] = (b - a) / Math.max(a, b); total += sum[i];
    }
    return { mean: total / n, perArticle: sum };
  }

  // leaf order (depth-first) for drawing the tree
  function leafOrder(merges, n) {
    const byId = new Map(merges.map(m => [m.id, m])); const root = merges[merges.length - 1].id;
    const out = [], stack = [root];
    while (stack.length) { const x = stack.pop(); if (x < n) out.push(x); else { const m = byId.get(x); stack.push(m.b); stack.push(m.a); } }
    return out;
  }

  // full pipeline for one feature selection
  function analyse(X, cols, weights, kRange) {
    const { Z, constant } = standardize(X, cols, weights);
    if (constant.length) return { error: 'constant', constant };
    const P = pca(Z), n = X.length;
    const D = euclid(P.scores, P.nPc), merges = wardD2(D, n);
    const ks = []; for (let k = kRange[0]; k <= kRange[1]; k++) ks.push(k);
    const sil = ks.map(k => silhouette(cutree(merges, n, k), D, n).mean);
    const best = ks[sil.indexOf(Math.max(...sil))];
    return { P, D, merges, n, ks, sil, bestK: best };
  }


  // average linkage (UPGMA) on a distance matrix - same merge format as wardD2 (R: hclust(method = "average"))
  function upgma(D, n) {
    const d = Float64Array.from(D), size = new Float64Array(2 * n - 1).fill(1), slotNode = Array.from({ length: n }, (_, i) => i);
    let live = Array.from({ length: n }, (_, i) => i); const merges = [];
    for (let step = 0; step < n - 1; step++) {
      let best = Infinity, bi = -1, bj = -1;
      for (let a = 0; a < live.length; a++) for (let b = a + 1; b < live.length; b++) { const v = d[live[a] * n + live[b]]; if (v < best) { best = v; bi = live[a]; bj = live[b]; } }
      const ni = size[slotNode[bi]], nj = size[slotNode[bj]], newId = n + step; size[newId] = ni + nj;
      for (const k of live) { if (k === bi || k === bj) continue; const v = (ni * d[bi * n + k] + nj * d[bj * n + k]) / (ni + nj); d[bi * n + k] = d[k * n + bi] = v; }
      merges.push({ a: slotNode[bi], b: slotNode[bj], height: best, size: ni + nj, id: newId }); slotNode[bi] = newId; live = live.filter(k => k !== bj);
    }
    return merges;
  }

  root.AmaiaCore = { upgma, standardize, jacobiEigen, pca, euclid, wardD2, cutree, silhouette, leafOrder, analyse };
  if (typeof module !== 'undefined') module.exports = root.AmaiaCore;
})(typeof window !== 'undefined' ? window : globalThis);
