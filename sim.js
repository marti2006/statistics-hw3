/*
 * sim.js — Simulation core (no DOM). Works in the browser and in Node.
 *
 * Model: n systems, m attackers. Attacker j attacks systems 1..n in sequence;
 * X_i^(j) is the score on system i (i.i.d. increments). S_k^(j) = sum_{i<=k} X_i^(j).
 * The m attackers are m independent trajectories (Monte Carlo sample).
 */
(function (global) {
  "use strict";

  // ---------------------------------------------------------------- RNG
  // mulberry32: fast seedable 32-bit PRNG -> reproducible results
  function makeRng(seed) {
    let a = seed >>> 0;
    function u32() { // 32 random bits
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return (t ^ (t >>> 14)) >>> 0;
    }
    const rng = () => u32() / 4294967296; // uniform in [0, 1)
    rng.u32 = u32;
    return rng;
  }

  // number of 1-bits in a 32-bit word
  function popcount(x) {
    x = x - ((x >>> 1) & 0x55555555);
    x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
    return Math.imul((x + (x >>> 4)) & 0x0f0f0f0f, 0x01010101) >>> 24;
  }

  // ---------------------------------------------------------------- models
  function models(p) {
    return {
      Bernoulli: { mu: p, var: p * (1 - p), label: "Bernoulli(p=" + p + ")" },
      Rademacher: { mu: 0, var: 1, label: "Rademacher" },
    };
  }

  // one increment X_i
  function increment(model, p, rng) {
    if (model === "Bernoulli") return rng() < p ? 1 : 0;
    return rng() < 0.5 ? 1 : -1;
  }

  // final values S_n for m attackers
  function simulateSn(model, p, m, n, rng) {
    const out = new Float64Array(m);
    for (let j = 0; j < m; j++) {
      let s = 0;
      if (model === "Bernoulli") {
        for (let i = 0; i < n; i++) if (rng() < p) s++;
      } else {
        // Rademacher: each random bit is a fair coin (+1 if 1, -1 if 0).
        // One 32-bit word gives 32 increments: S_n = 2·(number of 1-bits) − n.
        let ones = 0;
        const full = n >>> 5, rem = n & 31;
        for (let w = 0; w < full; w++) ones += popcount(rng.u32());
        if (rem) ones += popcount(rng.u32() & ((1 << rem) - 1));
        s = 2 * ones - n;
      }
      out[j] = s;
    }
    return out;
  }

  // full trajectories, sampled at the given k values (sorted, 1-based)
  function trajectories(model, p, m, n, ks, rng) {
    const res = [];
    for (let j = 0; j < m; j++) {
      const path = new Float64Array(ks.length);
      let s = 0, idx = 0;
      for (let k = 1; k <= n && idx < ks.length; k++) {
        s += increment(model, p, rng);
        while (idx < ks.length && ks[idx] === k) path[idx++] = s;
      }
      res.push(path);
    }
    return res;
  }

  // ---------------------------------------------------------------- statistics
  function mean(a) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return s / a.length; }
  function variance(a) {
    const mu = mean(a); let s = 0;
    for (let i = 0; i < a.length; i++) { const d = a[i] - mu; s += d * d; }
    return s / (a.length - 1);
  }
  function moments(a) {
    const mu = mean(a), n = a.length; let m2 = 0, m3 = 0, m4 = 0;
    for (let i = 0; i < n; i++) { const d = a[i] - mu, d2 = d * d; m2 += d2; m3 += d2 * d; m4 += d2 * d2; }
    m2 /= n; m3 /= n; m4 /= n;
    return { mean: mu, var: variance(a), skew: m3 / Math.pow(m2, 1.5), exkurt: m4 / (m2 * m2) - 3 };
  }
  function sorted(a) { return Float64Array.from(a).sort(); }
  function quantile(s, q) { // s sorted, linear interpolation
    const h = (s.length - 1) * q, lo = Math.floor(h), hi = Math.ceil(h);
    return s[lo] + (s[hi] - s[lo]) * (h - lo);
  }
  function scale(a, c) { const b = new Float64Array(a.length); for (let i = 0; i < a.length; i++) b[i] = a[i] * c; return b; }
  function fracWhere(a, f) { let c = 0; for (let i = 0; i < a.length; i++) if (f(a[i])) c++; return c / a.length; }
  function linfit(x, y) { // least squares slope/intercept
    const mx = mean(x), my = mean(y); let sxy = 0, sxx = 0;
    for (let i = 0; i < x.length; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; }
    const b = sxy / sxx; return { slope: b, intercept: my - b * mx };
  }
  function logspaceInt(a, b, k) { // unique integers 10^a..10^b
    const out = new Set();
    for (let i = 0; i < k; i++) out.add(Math.round(Math.pow(10, a + (b - a) * i / (k - 1))));
    return Array.from(out).sort((x, y) => x - y);
  }

  // ---------------------------------------------------------------- normal distribution
  function erf(x) { // Abramowitz-Stegun 7.1.26 refined via erfc series (|err| < 1.2e-7)
    const t = 1 / (1 + 0.5 * Math.abs(x));
    const y = 1 - t * Math.exp(-x * x - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 +
      t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
    return x >= 0 ? y : -y;
  }
  const normCdf = (x) => 0.5 * (1 + erf(x / Math.SQRT2));
  const normPdf = (x) => Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
  function normPpf(p) { // Acklam's rational approximation
    const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
    const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
    const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
    const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
    const pl = 0.02425;
    if (p < pl) { const q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    if (p > 1 - pl) return -normPpf(1 - p);
    const q = p - 0.5, r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }

  // Kolmogorov-Smirnov distance of a sample from N(0,1)
  function ksNormal(a) {
    const s = sorted(a), n = s.length; let d = 0;
    for (let i = 0; i < n; i++) {
      const F = normCdf(s[i]);
      d = Math.max(d, (i + 1) / n - F, F - i / n);
    }
    return d;
  }

  // exact sup_x |F_n(x) - Phi(x)| for S_n/sqrt(n), Rademacher: (S_n+n)/2 ~ Bin(n, 1/2)
  function lgamma(x) { // Lanczos
    const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
      -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
    x -= 1; let s = c[0]; for (let i = 1; i < g + 2; i++) s += c[i] / (x + i);
    const t = x + g + 0.5;
    return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(s);
  }
  function exactKsRademacher(n) {
    const lgn = lgamma(n + 1); let F = 0, d = 0;
    for (let k = 0; k <= n; k++) {
      const pmf = Math.exp(lgn - lgamma(k + 1) - lgamma(n - k + 1) - n * Math.LN2);
      const z = (2 * k - n) / Math.sqrt(n), Phi = normCdf(z);
      d = Math.max(d, Math.abs(F - Phi)); // left limit
      F += pmf;
      d = Math.max(d, Math.abs(F - Phi)); // right value
    }
    return d;
  }

  // ================================================================= EXPERIMENTS
  // Each returns plain data, used both by the web page and by the Node report.

  // 1. sample trajectories
  function expTrajectories(cfg, rng) {
    const ks = logspaceInt(0, Math.log10(cfg.Nmax), 300);
    const out = { ks, models: {} };
    for (const model of ["Bernoulli", "Rademacher"])
      out.models[model] = trajectories(model, cfg.p, cfg.mTraj, cfg.Nmax, ks, rng);
    return out;
  }

  // 2. samples of S_n for n in NS (shared by distributions, table, CLT)
  function expSamples(cfg, rng) {
    const out = {};
    for (const model of ["Bernoulli", "Rademacher"]) {
      out[model] = {};
      for (const n of cfg.NS) out[model][n] = simulateSn(model, cfg.p, cfg.m, n, rng);
    }
    return out;
  }

  // 3. variance under the three normalizations
  function expVariance(cfg, rng) {
    const NS = logspaceInt(1, Math.log10(cfg.Nmax), 13), M = models(cfg.p), out = { NS, models: {} };
    for (const model of ["Bernoulli", "Rademacher"]) {
      const vS = [], vA = [], vN = [];
      for (const n of NS) {
        const S = simulateSn(model, cfg.p, cfg.mVar, n, rng), v = variance(S);
        vS.push(v); vA.push(v / (n * n)); vN.push(v / n);
      }
      const lx = NS.map(Math.log);
      out.models[model] = {
        vS, vA, vN, theory: M[model].var,
        slopes: [vS, vA, vN].map((v) => linfit(lx, v.map(Math.log)).slope),
      };
    }
    return out;
  }

  // 4. LLN: P(|S_n/n - mu| > eps)
  function expLLN(cfg, rng) {
    const NS = logspaceInt(1, Math.log10(cfg.Nmax), 13), M = models(cfg.p), out = { NS, EPS: cfg.EPS, models: {} };
    for (const model of ["Bernoulli", "Rademacher"]) {
      const { mu, var: v } = M[model], prob = cfg.EPS.map(() => []);
      for (const n of NS) {
        const S = simulateSn(model, cfg.p, cfg.mLLN, n, rng);
        cfg.EPS.forEach((e, i) => prob[i].push(fracWhere(S, (s) => Math.abs(s / n - mu) > e)));
      }
      out.models[model] = {
        prob,
        cheb: cfg.EPS.map((e) => NS.map((n) => Math.min(1, v / (n * e * e)))),
        normal: cfg.EPS.map((e) => NS.map((n) => 2 * (1 - normCdf(e * Math.sqrt(n / v))))),
      };
    }
    return out;
  }

  // 5. CLT: KS distance vs n (Rademacher, and standardized Bernoulli)
  function expKS(cfg, rng) {
    const NS = logspaceInt(1, Math.log10(cfg.Nmax), 10), p = cfg.p;
    const rad = [], exact = [], bern = [];
    for (const n of NS) {
      rad.push(ksNormal(scale(simulateSn("Rademacher", p, cfg.mKS, n, rng), 1 / Math.sqrt(n))));
      exact.push(exactKsRademacher(n));
      const B = simulateSn("Bernoulli", p, cfg.mKS, n, rng), sd = Math.sqrt(n * p * (1 - p));
      bern.push(ksNormal(B.map((s) => (s - n * p) / sd)));
    }
    const slope = linfit(NS.map(Math.log), exact.map(Math.log)).slope;
    return { NS, rad, exact, bern, slope, mcNoise: 1.36 / Math.sqrt(cfg.mKS) };
  }

  // 6. role of m: Monte Carlo precision and best attacker
  function expAttackers(cfg, rng) {
    const n = cfg.nFix, MS = [10, 30, 100, 300, 1000, 3000];
    const errMean = [], ks = [];
    for (const m of MS) {
      const est = [];
      for (let r = 0; r < cfg.reps; r++) est.push(mean(simulateSn("Rademacher", cfg.p, m, n, rng)) / n);
      errMean.push(Math.sqrt(variance(est)));
      let k = 0; for (let r = 0; r < 20; r++) k += ksNormal(scale(simulateSn("Rademacher", cfg.p, m, n, rng), 1 / Math.sqrt(n)));
      ks.push(k / 20);
    }
    const MS2 = logspaceInt(0.5, Math.log10(cfg.mMaxBest), 10), maxMed = [];
    for (const m of MS2) {
      const mx = [];
      for (let r = 0; r < 40; r++) {
        const S = simulateSn("Rademacher", cfg.p, m, n, rng); let best = -Infinity;
        for (let j = 0; j < m; j++) if (S[j] > best) best = S[j];
        mx.push(best / Math.sqrt(n));
      }
      maxMed.push(quantile(sorted(mx), 0.5));
    }
    return {
      n, MS, errMean, ks, MS2, maxMed,
      maxTheory: MS2.map((m) => normPpf(Math.pow(0.5, 1 / m))),
      maxAsym: MS2.map((m) => Math.sqrt(2 * Math.log(m))),
    };
  }

  // aggregate score of all attackers (Bernoulli)
  function expAggregate(cfg, rng) {
    const p = cfg.p, rows = [];
    for (const [n, m] of [[100, 10], [100, 1000], [1000, 1000]]) {
      const T = [];
      for (let r = 0; r < 100; r++) { let t = 0; const S = simulateSn("Bernoulli", p, m, n, rng); for (const s of S) t += s; T.push(t); }
      rows.push({ n, m, mean: mean(T), sd: Math.sqrt(variance(T)), meanTh: m * n * p, sdTh: Math.sqrt(m * n * p * (1 - p)) });
    }
    return rows;
  }

  const DEFAULTS = {
    seed: 2026, p: 0.3,
    NS: [10, 100, 1000, 10000], m: 5000,          // distributions
    Nmax: 10000, mTraj: 30,                       // trajectories
    mVar: 2000, mLLN: 5000, EPS: [0.1, 0.05, 0.02],
    mKS: 10000, nFix: 1000, reps: 100, mMaxBest: 3000,
  };

  const Sim = {
    DEFAULTS, makeRng, models, simulateSn, trajectories,
    mean, variance, moments, sorted, quantile, scale, fracWhere, linfit, logspaceInt,
    normCdf, normPdf, normPpf, ksNormal, exactKsRademacher,
    expTrajectories, expSamples, expVariance, expLLN, expKS, expAttackers, expAggregate,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = Sim;
  else global.Sim = Sim;
})(typeof window !== "undefined" ? window : globalThis);