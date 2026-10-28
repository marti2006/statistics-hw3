/*
 * main.js — Runs the experiments of sim.js and renders charts/tables.
 * Experiments run in the same order as in the report, so with the default
 * seed and parameters the numbers on the page match README.md.
 */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const { Chart } = Plot;
  const MODELS = ["Bernoulli", "Rademacher"];
  const f = (x, d = 4) => (isFinite(x) ? x.toFixed(d) : "—");
  const tick = () => new Promise((r) => setTimeout(r, 0));

  // ------------------------------------------------------------ helpers
  // histogram of integer-valued S, bins aligned to the lattice (step 1 or 2),
  // x transformed by `div` (1, n or sqrt n). Returns density bars.
  function latticeHist(S, lattice, div, maxBins = 60) {
    let lo = Infinity, hi = -Infinity;
    for (const s of S) { if (s < lo) lo = s; if (s > hi) hi = s; }
    const w = lattice * Math.max(1, Math.ceil((hi - lo) / lattice / maxBins)); // multiple of lattice step
    const start = lo - lattice / 2, nb = Math.floor((hi - start) / w) + 1, c = new Array(nb).fill(0);
    for (const s of S) c[Math.floor((s - start) / w)]++;
    const x = [], y = [], wd = w / div;
    for (let i = 0; i < nb; i++) { x.push((start + i * w) / div); y.push(c[i] / (S.length * wd)); }
    return { x, y, w: wd };
  }
  // outline of a histogram, as a line series
  function stepLine(h, norm = 1) {
    const x = [], y = [];
    h.x.forEach((xi, i) => { x.push(xi, xi + h.w); y.push(h.y[i] / norm, h.y[i] / norm); });
    return { x: [h.x[0], ...x, h.x[h.x.length - 1] + h.w], y: [0, ...y, 0] };
  }
  function grid(id, cols) { const el = $(id); el.innerHTML = ""; el.style.setProperty("--cols", cols); return el; }
  function cell(parent) { const d = document.createElement("div"); d.className = "chart"; parent.appendChild(d); return d; }
  function chart(parent, opts) { return new Chart(cell(parent), opts); }
  function table(id, head, rows) {
    $(id).innerHTML = "<thead><tr>" + head.map((h) => `<th>${h}</th>`).join("") + "</tr></thead><tbody>" +
      rows.map((r) => "<tr>" + r.map((c) => `<td>${c}</td>`).join("") + "</tr>").join("") + "</tbody>";
  }
  const range = (a, b, k) => Array.from({ length: k }, (_, i) => a + (b - a) * i / (k - 1));

  // ------------------------------------------------------------ renderers
  function renderTrajectories(T, cfg) {
    const M = Sim.models(cfg.p), el = grid("traj-grid", 3), ks = T.ks;
    for (const model of MODELS) {
      const { mu, var: v } = M[model], sd = Math.sqrt(v), paths = T.models[model];
      const views = [
        { t: "S_k", tr: (s, k) => s, c: (k) => mu * k, b: (k) => 2 * sd * Math.sqrt(k), cl: "kμ", bl: "kμ ± 2σ√k" },
        { t: "S_k / k", tr: (s, k) => s / k, c: () => mu, b: (k) => 2 * sd / Math.sqrt(k), cl: "μ", bl: "μ ± 2σ/√k", ylim: [mu - Math.max(sd, 0.5), mu + Math.max(sd, 0.5)] },
        { t: "S_k / √k", tr: (s, k) => s / Math.sqrt(k), c: (k) => mu * Math.sqrt(k), b: () => 2 * sd, cl: "√k μ", bl: "√k μ ± 2σ" },
      ];
      for (const vw of views) {
        const ch = chart(el, { title: `${model}: ${vw.t}`, xlabel: "k = sistemi attaccati", xlog: true, height: 270,
          ymin: vw.ylim?.[0], ymax: vw.ylim?.[1] });
        paths.forEach((p, j) => ch.add({ x: ks, y: Array.from(p, (s, i) => vw.tr(s, ks[i])), width: 0.8, alpha: 0.55,
          color: `hsl(${(j * 47) % 360} 60% 55%)` }));
        ch.add({ x: ks, y: ks.map(vw.c), color: "var-fg", width: 1.8, dash: [6, 4], label: vw.cl });
        ch.add({ x: ks, y: ks.map((k) => vw.c(k) + vw.b(k)), color: "var-accent", width: 1.6, dash: [2, 3], label: vw.bl });
        ch.add({ x: ks, y: ks.map((k) => vw.c(k) - vw.b(k)), color: "var-accent", width: 1.6, dash: [2, 3] });
        ch.draw();
      }
    }
  }
  function renderDistributions(SAMP, cfg) {
    const M = Sim.models(cfg.p), el = grid("dist-grid", 3);
    for (const model of MODELS) {
      const lat = model === "Bernoulli" ? 1 : 2, { mu } = M[model];
      const cS = chart(el, { title: `${model}: S_n`, xlabel: "S_n", ylabel: "densità / picco", xlog: model === "Bernoulli", ymin: 0, height: 260, legendPos: "right" });
      const cA = chart(el, { title: `${model}: S_n / n`, xlabel: "S_n / n", ylabel: "densità", ymin: 0, height: 260, legendPos: "right" });
      const cN = chart(el, { title: `${model}: S_n / √n`, xlabel: "S_n / √n", ylabel: "densità", ymin: 0, height: 260, legendPos: "right" });
      cfg.NS.forEach((n, i) => {
        const S = SAMP[model][n];
        const h1 = latticeHist(S, lat, 1), peak = Math.max(...h1.y);
        cS.add(Object.assign(stepLine(h1, peak), { label: "n=" + n }));
        cA.add(Object.assign(stepLine(latticeHist(S, lat, n)), { label: "n=" + n }));
        cN.add(Object.assign(stepLine(latticeHist(S, lat, Math.sqrt(n))), { label: "n=" + n }));
      });
      cA.add({ x: [mu, mu], y: [0, 1e9], color: "var-fg", dash: [5, 4], width: 1.2, label: "μ" });
      if (model === "Rademacher") { const x = range(-4, 4, 200); cN.add({ x, y: x.map(Sim.normPdf), color: "var-fg", dash: [5, 4], width: 1.6, label: "N(0,1)" }); }
      // S_n/n: the μ marker is tall, so cut the y-axis at the tallest histogram
      cA.opts.ymax = Math.max(...cA.series.slice(0, cfg.NS.length).flatMap((s) => s.y)) * 1.05;
      for (const c of [cS, cA, cN]) c.draw();
    }
  }

  function renderTable(SAMP, cfg) {
    const M = Sim.models(cfg.p), rows = [];
    for (const model of MODELS) {
      const { mu, var: v } = M[model];
      for (const n of cfg.NS) {
        const S = SAMP[model][n], vs = Sim.variance(S);
        rows.push([model, n, f(Sim.mean(S) / n), f(mu, 3), f(vs, 1), f(n * v, 1), (vs / n / n).toExponential(2), (v / n).toExponential(2), f(vs / n), f(v, 3)]);
      }
    }
    table("var-table", ["modello", "n", "media S<sub>n</sub>/n", "μ", "Var S<sub>n</sub>", "nσ²", "Var S<sub>n</sub>/n", "σ²/n", "Var S<sub>n</sub>/√n", "σ²"], rows);
  }

  function renderVariance(V, cfg) {
    const el = grid("varplot-grid", 2), slopes = [];
    for (const model of MODELS) {
      const d = V.models[model], ch = chart(el, { title: model + " (tratteggio = teoria)", xlabel: "n", ylabel: "varianza", xlog: true, ylog: true, height: 300 });
      const pal = Plot.palette();
      [["Var(S_n)", d.vS, (n) => d.theory * n], ["Var(S_n/n)", d.vA, (n) => d.theory / n], ["Var(S_n/√n)", d.vN, () => d.theory]].forEach(([lab, v, th], i) => {
        ch.add({ type: "points", x: V.NS, y: v, color: pal[i], label: lab + " empirica", r: 3.2 });
        ch.add({ x: V.NS, y: V.NS.map(th), color: pal[i], dash: [5, 4], width: 1.2 });
      });
      ch.draw();
      slopes.push(`<b>${model}</b>: ${d.slopes.map((s) => (s >= 0 ? "+" : "") + s.toFixed(3)).join(", ")}`);
    }
    $("var-slopes").innerHTML = "Pendenze stimate in scala log-log (teoria +1, −1, 0) — " + slopes.join(" · ");
  }

  function renderLLN(L, SAMP, cfg) {
    const el = grid("lln-grid", 2), pal = Plot.palette(), M = Sim.models(cfg.p);
    for (const model of MODELS) {
      const d = L.models[model];
      const ch = chart(el, { title: `${model}: P(|S_n/n − μ| > ε)`, xlabel: "n", ylabel: "probabilità", xlog: true, ymin: 0, ymax: 1.02, height: 300, legendPos: "right" });
      L.EPS.forEach((e, i) => {
        ch.add({ type: "points", connect: true, x: L.NS, y: d.prob[i], color: pal[i], label: `simulata, ε=${e}`, width: 1.4 });
        ch.add({ x: L.NS, y: d.cheb[i], color: pal[i], dash: [2, 3], width: 1.3 });
        ch.add({ x: L.NS, y: d.normal[i], color: pal[i], dash: [6, 4], width: 1, alpha: 0.7 });
      });
      ch.draw();
    }
    const rows = MODELS.map((model) => [model, ...cfg.NS.map((n) => f(Sim.fracWhere(SAMP[model][n], (s) => Math.abs(s / n - M[model].mu) > 0.05)))]);
    table("lln-table", ["modello", ...cfg.NS.map((n) => "n = " + n)], rows);
  }

  function renderCLT(SAMP, cfg) {
    const el = grid("clt-grid", cfg.NS.length), x = range(-4, 4, 200), q = range(0.005, 0.995, 199), zq = q.map(Sim.normPpf), rows = [];
    for (const n of cfg.NS) {
      const ch = chart(el, { title: `S_n/√n, n=${n}`, xmin: -4, xmax: 4, ymin: 0, height: 230, legend: false });
      const h = latticeHist(SAMP.Rademacher[n], 2, Math.sqrt(n), 45);
      ch.add({ type: "bars", x: h.x, y: h.y, w: h.w, alpha: 0.55, gap: n <= 10 ? 4 : 0.5 });
      ch.add({ x, y: x.map(Sim.normPdf), color: "var-fg", width: 1.6 });
      ch.draw();
    }
    for (const n of cfg.NS) {
      const z = Sim.scale(SAMP.Rademacher[n], 1 / Math.sqrt(n)), s = Sim.sorted(z);
      const ch = chart(el, { title: `QQ-plot, n=${n}`, xlabel: "quantili N(0,1)", xmin: -3, xmax: 3, ymin: -3.2, ymax: 3.2, height: 230, legend: false });
      ch.add({ x: [-3, 3], y: [-3, 3], color: "var-fg", dash: [5, 4], width: 1 });
      ch.add({ type: "points", x: zq, y: q.map((p) => Sim.quantile(s, p)), r: 1.8 });
      ch.draw();
      const mo = Sim.moments(z);
      rows.push([n, f(mo.mean), f(mo.var), f(mo.skew), f(mo.exkurt), f(-2 / n), f(Sim.fracWhere(z, (v) => Math.abs(v) > 1.96)), f(Sim.ksNormal(z)), f(Sim.exactKsRademacher(n))]);
    }
    table("clt-table", ["n", "media", "varianza", "asimmetria", "curtosi ecc.", "esatta −2/n", "P(|Z|>1.96)", "dist. KS (sim.)", "dist. KS (esatta)"], rows);
  }

  function renderKS(K, cfg) {
    const el = grid("ks-grid", 1), pal = Plot.palette();
    const ch = chart(el, { title: "Distanza di Kolmogorov dalla N(0,1)", xlabel: "n", ylabel: "sup |F_n − Φ|", xlog: true, ylog: true, height: 340, legendPos: "right" });
    ch.add({ type: "points", connect: true, x: K.NS, y: K.rad, color: pal[0], label: "Rademacher S_n/√n — simulazione" });
    ch.add({ type: "points", connect: true, x: K.NS, y: K.exact, color: "var-fg", label: "Rademacher — distanza esatta", r: 2 });
    ch.add({ type: "points", connect: true, x: K.NS, y: K.bern, color: pal[1], label: "Bernoulli standardizzato — simulazione" });
    ch.add({ x: K.NS, y: K.NS.map((n) => 0.4748 / Math.sqrt(n)), color: "var-accent", dash: [6, 4], label: "Berry–Esseen 0.4748/√n" });
    ch.add({ x: K.NS, y: K.NS.map(() => K.mcNoise), color: "var-muted", dash: [2, 3], label: `rumore Monte Carlo 1.36/√m (m=${cfg.mKS})` });
    ch.draw();
    $("ks-slope").textContent = `Pendenza log-log della distanza esatta: ${K.slope.toFixed(3)} (teoria −0.5).`;
  }

  function renderAttackers(A, G, cfg) {
    const el = grid("att-grid", 2), pal = Plot.palette();
    const c1 = chart(el, { title: `Precisione Monte Carlo (Rademacher, n=${A.n})`, xlabel: "m = numero di attaccanti", xlog: true, ylog: true, height: 300, legendPos: "right" });
    c1.add({ type: "points", connect: true, x: A.MS, y: A.errMean, color: pal[0], label: "dev. std. stima di E[S_n/n]" });
    c1.add({ x: A.MS, y: A.MS.map((m) => 1 / Math.sqrt(m * A.n)), color: pal[0], dash: [5, 4], label: "teoria σ/√(nm)" });
    c1.add({ type: "points", connect: true, x: A.MS, y: A.ks, color: pal[1], label: "distanza KS media dalla N(0,1)" });
    c1.add({ x: A.MS, y: A.MS.map((m) => 0.87 / Math.sqrt(m)), color: pal[1], dash: [2, 3], label: "≈ 0.87/√m" });
    c1.draw();
    const c2 = chart(el, { title: `Miglior attaccante: max_j S_n/√n (Rademacher, n=${A.n})`, xlabel: "m = numero di attaccanti", xlog: true, height: 300 });
    c2.add({ type: "points", connect: true, x: A.MS2, y: A.maxMed, color: pal[0], label: "mediana simulata" });
    c2.add({ x: A.MS2, y: A.maxTheory, color: "var-fg", dash: [5, 4], label: "mediana del max di m N(0,1)" });
    c2.add({ x: A.MS2, y: A.maxAsym, color: "var-accent", dash: [2, 3], label: "√(2 ln m)" });
    c2.draw();
    table("agg-table", ["n", "m", "E[T] sim.", "mnp", "dev. std. T sim.", "√(mnp(1−p))", "T/(mn)"],
      G.map((r) => [r.n, r.m, f(r.mean, 1), f(r.meanTh, 1), f(r.sd, 1), f(r.sdTh, 1), f(r.mean / (r.n * r.m))]));
  }

  // ------------------------------------------------------------ run
  let running = false;
  async function run() {
    if (running) return;
    running = true; $("run").disabled = true;
    const cfg = Object.assign({}, Sim.DEFAULTS, {
      seed: parseInt($("seed").value, 10) || 0,
      p: Math.min(0.99, Math.max(0.01, parseFloat($("p").value) || 0.3)),
      m: Math.max(100, parseInt($("m").value, 10) || 5000),
    });
    document.querySelectorAll(".p-value").forEach((e) => (e.textContent = cfg.p));
    document.querySelectorAll(".m-value").forEach((e) => (e.textContent = cfg.m));
    const rng = Sim.makeRng(cfg.seed), steps = 7;
    const status = (i, txt) => { $("status").textContent = txt; $("progress").value = i / steps; };
    const t0 = performance.now();

    status(0, "Simulazione delle traiettorie…"); await tick();
    renderTrajectories(Sim.expTrajectories(cfg, rng), cfg);
    status(1, "Distribuzioni per n = 10 … 10 000…"); await tick();
    const SAMP = Sim.expSamples(cfg, rng);
    renderDistributions(SAMP, cfg); renderTable(SAMP, cfg); renderCLT(SAMP, cfg);
    status(2, "Studio della varianza…"); await tick();
    renderVariance(Sim.expVariance(cfg, rng), cfg);
    status(3, "Legge dei Grandi Numeri…"); await tick();
    renderLLN(Sim.expLLN(cfg, rng), SAMP, cfg);
    status(4, "Velocità di convergenza nel CLT…"); await tick();
    renderKS(Sim.expKS(cfg, rng), cfg);
    status(5, "Ruolo del numero di attaccanti…"); await tick();
    const A = Sim.expAttackers(cfg, rng);
    status(6, "Punteggio aggregato…"); await tick();
    renderAttackers(A, Sim.expAggregate(cfg, rng), cfg);

    status(7, `Completato in ${((performance.now() - t0) / 1000).toFixed(1)} s (seed ${cfg.seed}).`);
    running = false; $("run").disabled = false;
  }

  $("controls").addEventListener("submit", (e) => { e.preventDefault(); run(); });
  window.addEventListener("load", run);
})();