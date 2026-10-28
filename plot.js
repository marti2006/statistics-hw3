/*
 * plot.js — Minimal canvas plotting (no external libraries).
 * Supports line / points / bars series, linear or log axes, legend,
 * HiDPI rendering and redraw on resize / theme change.
 */
(function (global) {
  "use strict";

  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const PALETTE = () => [1, 2, 3, 4, 5, 6].map((i) => css("--c" + i));
  const charts = [];

  // "nice" linear ticks
  function niceTicks(lo, hi, count) {
    const span = hi - lo || 1, raw = span / count, mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map((s) => s * mag).find((s) => span / s <= count) || 10 * mag;
    const ticks = [];
    for (let t = Math.ceil(lo / step) * step; t <= hi + 1e-9 * span; t += step) ticks.push(+t.toPrecision(12));
    return ticks;
  }
  function logTicks(lo, hi) { // lo, hi in log10 units
    const t = [];
    for (let e = Math.ceil(lo - 1e-9); e <= hi + 1e-9; e++) t.push(e);
    return t;
  }
  function fmt(v) {
    if (v === 0) return "0";
    const a = Math.abs(v);
    if (a >= 1e5 || a < 1e-3) return v.toExponential(0).replace("e+", "e");
    return +v.toPrecision(4) + "";
  }
  function supNum(e) {
    const map = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
    return "10" + String(e).split("").map((c) => map[c]).join("");
  }

  class Chart {
    constructor(container, opts) {
      this.opts = Object.assign({ height: 300, legend: true }, opts);
      this.series = [];
      this.canvas = document.createElement("canvas");
      this.canvas.setAttribute("role", "img");
      this.canvas.setAttribute("aria-label", opts.title || "grafico");
      container.appendChild(this.canvas);
      charts.push(this);
    }
    add(s) { this.series.push(s); return this; }

    draw() {
      const o = this.opts, cv = this.canvas, dpr = window.devicePixelRatio || 1;
      const W = cv.parentElement.clientWidth, H = o.height;
      if (!W) return;
      cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + "px"; cv.style.height = H + "px";
      const g = cv.getContext("2d");
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      const fg = css("--fg"), muted = css("--muted"), grid = css("--grid"), pal = PALETTE();
      const font = "12px " + css("--font-ui");
      // a color can be a CSS color, a theme token like "var-fg" (-> --fg), or omitted (palette by index)
      const color = (c, k) => (!c ? pal[k % pal.length] : c.startsWith("var-") ? css("--" + c.slice(4)) : c);

      // ---- data ranges (in transformed units)
      const tx = (v) => (o.xlog ? Math.log10(v) : v), ty = (v) => (o.ylog ? Math.log10(v) : v);
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const s of this.series) {
        for (let i = 0; i < s.x.length; i++) {
          const xs = s.type === "bars" ? [s.x[i], s.x[i] + s.w] : [s.x[i]];
          for (const xv of xs) { if (o.xlog && xv <= 0) continue; const X = tx(xv); x0 = Math.min(x0, X); x1 = Math.max(x1, X); }
          const yv = s.y[i];
          if (o.ylog && yv <= 0) continue;
          if (!isFinite(yv)) continue;
          const Y = ty(yv); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y);
          if (s.type === "bars" && !o.ylog) y0 = Math.min(y0, 0);
        }
      }
      if (o.xmin !== undefined) x0 = tx(o.xmin); if (o.xmax !== undefined) x1 = tx(o.xmax);
      if (o.ymin !== undefined) y0 = ty(o.ymin); if (o.ymax !== undefined) y1 = ty(o.ymax);
      if (!o.xlog && o.xmin === undefined && o.xmax === undefined) { const pad = (x1 - x0) * 0.02; x0 -= pad; x1 += pad; }
      if (o.ymin === undefined || o.ymax === undefined) {
        const pad = (y1 - y0 || 1) * 0.06;
        if (o.ymin === undefined && !(y0 === 0 && !o.ylog)) y0 -= pad;
        if (o.ymax === undefined) y1 += pad;
      }

      // ---- layout
      const L = 58, R = 12, T = o.title ? 30 : 12, B = 44;
      const pw = W - L - R, ph = H - T - B;
      const px = (X) => L + ((X - x0) / (x1 - x0)) * pw, py = (Y) => T + ph - ((Y - y0) / (y1 - y0)) * ph;

      // ---- grid & ticks
      g.font = font; g.strokeStyle = grid; g.fillStyle = muted; g.lineWidth = 1;
      const xt = o.xlog ? logTicks(x0, x1) : niceTicks(x0, x1, Math.max(3, Math.floor(pw / 80)));
      const yt = o.ylog ? logTicks(y0, y1) : niceTicks(y0, y1, Math.max(3, Math.floor(ph / 45)));
      g.textAlign = "center"; g.textBaseline = "top";
      for (const t of xt) {
        const X = px(t); g.beginPath(); g.moveTo(X, T); g.lineTo(X, T + ph); g.stroke();
        g.fillText(o.xlog ? supNum(t) : fmt(t), X, T + ph + 6);
      }
      g.textAlign = "right"; g.textBaseline = "middle";
      for (const t of yt) {
        const Y = py(t); g.beginPath(); g.moveTo(L, Y); g.lineTo(L + pw, Y); g.stroke();
        g.fillText(o.ylog ? supNum(t) : fmt(t), L - 6, Y);
      }
      g.strokeStyle = muted; g.strokeRect(L, T, pw, ph);

      // ---- labels
      g.fillStyle = fg; g.textAlign = "center"; g.textBaseline = "alphabetic";
      if (o.title) { g.font = "600 13px " + css("--font-ui"); g.fillText(o.title, L + pw / 2, 18); }
      g.font = font; g.fillStyle = muted;
      if (o.xlabel) g.fillText(o.xlabel, L + pw / 2, H - 6);
      if (o.ylabel) { g.save(); g.translate(13, T + ph / 2); g.rotate(-Math.PI / 2); g.fillText(o.ylabel, 0, 0); g.restore(); }

      // ---- series (clipped)
      g.save(); g.beginPath(); g.rect(L, T, pw, ph); g.clip();
      this.series.forEach((s, k) => {
        const col = color(s.color, k);
        g.strokeStyle = col; g.fillStyle = col; g.globalAlpha = s.alpha ?? 1;
        g.lineWidth = s.width || 1.6; g.setLineDash(s.dash || []);
        if (s.type === "bars") {
          for (let i = 0; i < s.x.length; i++) {
            const a = px(tx(s.x[i])), b = px(tx(s.x[i] + s.w)), top = py(ty(s.y[i])), base = py(Math.max(y0, 0));
            g.fillRect(a, top, Math.max(1, b - a - (s.gap ?? 0.5)), base - top);
          }
        } else if (s.type === "points") {
          const r = s.r || 2.6;
          for (let i = 0; i < s.x.length; i++) {
            if ((o.xlog && s.x[i] <= 0) || (o.ylog && s.y[i] <= 0)) continue;
            g.beginPath(); g.arc(px(tx(s.x[i])), py(ty(s.y[i])), r, 0, 2 * Math.PI); g.fill();
          }
          if (s.connect) drawLine(s);
        } else drawLine(s);
        function drawLine(s) {
          g.beginPath(); let started = false;
          for (let i = 0; i < s.x.length; i++) {
            if ((o.xlog && s.x[i] <= 0) || (o.ylog && s.y[i] <= 0) || !isFinite(s.y[i])) { started = false; continue; }
            const X = px(tx(s.x[i])), Y = py(ty(s.y[i]));
            started ? g.lineTo(X, Y) : g.moveTo(X, Y); started = true;
          }
          g.stroke();
        }
      });
      g.restore(); g.globalAlpha = 1; g.setLineDash([]);

      // ---- legend
      const items = this.series.map((s, k) => ({ s, col: color(s.color, k) })).filter((d) => d.s.label);
      if (o.legend && items.length) {
        g.font = "11px " + css("--font-ui");
        const lw = Math.max(...items.map((d) => g.measureText(d.s.label).width)) + 34, lh = 16;
        const lx = o.legendPos === "right" ? L + pw - lw - 6 : L + 6, ly = T + 6;
        g.fillStyle = css("--panel"); g.globalAlpha = 0.88; g.fillRect(lx, ly, lw, items.length * lh + 6); g.globalAlpha = 1;
        items.forEach((d, i) => {
          const yy = ly + 11 + i * lh;
          g.strokeStyle = d.col; g.fillStyle = d.col; g.lineWidth = 2; g.setLineDash(d.s.dash || []);
          if (d.s.type === "bars") g.fillRect(lx + 6, yy - 5, 18, 10);
          else if (d.s.type === "points" && !d.s.connect) { g.beginPath(); g.arc(lx + 15, yy, 3, 0, 7); g.fill(); }
          else { g.beginPath(); g.moveTo(lx + 6, yy); g.lineTo(lx + 24, yy); g.stroke(); }
          g.setLineDash([]); g.fillStyle = fg; g.textAlign = "left"; g.textBaseline = "middle";
          g.fillText(d.s.label, lx + 30, yy);
        });
      }
    }
  }

  function redrawAll() { charts.forEach((c) => c.canvas.isConnected && c.draw()); }
  let pending = 0;
  window.addEventListener("resize", () => { cancelAnimationFrame(pending); pending = requestAnimationFrame(redrawAll); });
  if (window.matchMedia) window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", redrawAll);

  global.Plot = { Chart, redrawAll, palette: PALETTE };
})(window);