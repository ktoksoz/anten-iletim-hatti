/* Bölüm 2: İletim hattı.
   ch2Ladder : L–C merdiveninde darbe yayılımı; basamak sayısı artınca sürekli hatta yaklaşır (devre denklemleriyle çözülür).
   ch2Z0     : koaksiyel, çift hat ve mikroşerit kesitleri; boyutlar sürüklenir, Z₀ canlı hesaplanır; 50 Ω'un kökeni.
   ch2Skin   : deri etkisi; iletken kesitinde akım yoğunluğu (Bessel çözümü), δ, AC/DC direnç oranı, kablo kaybı. */
(function () {
  const { C, FONT, rgba, mix, h, canvas, loop, clamp, slider, seg, toggle, num, sig, hz, ohm, meters, pointer } = L;
  const CX = RF.C;

  /* ---------- küçük yardımcılar ---------- */
  function readout(k, cls) {
    const v = h("span.v", "—");
    const el = h("div.readout" + (cls ? "." + cls : ""), h("span.k", k), v);
    el.set = (s) => { v.textContent = s; };
    return el;
  }
  function hatchPath(ctx, pathFn, gap = 7, color = "rgba(169,191,207,0.24)") {
    ctx.save();
    pathFn(); ctx.clip("evenodd");
    const { width, height } = ctx.canvas;
    ctx.strokeStyle = color; ctx.lineWidth = 1;
    ctx.beginPath();
    const W = width, H = height; // CSS pikselinden büyük; güvenli
    for (let s = -H; s < W + H; s += gap) { ctx.moveTo(s, H); ctx.lineTo(s + H, 0); }
    ctx.stroke();
    ctx.restore();
  }
  function copperFill(ctx, x, y, r) {
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r * 1.1);
    g.addColorStop(0, "#ffc39f"); g.addColorStop(0.45, C.copper); g.addColorStop(1, "#8a4a2b");
    return g;
  }
  // Dar aralıkta oklar dışarıdan gelen ölçü çizgisi
  function dim(ctx, x0, y0, x1, y1, label, color = C.ink2, at = null) {
    const len = Math.hypot(x1 - x0, y1 - y0);
    ctx.save(); ctx.font = `500 12px ${FONT.num}`;
    const tw = ctx.measureText(label).width; ctx.restore();
    if (len > tw + 26) { V.dimension(ctx, x0, y0, x1, y1, label, { color }); return; }
    const ux = (x1 - x0) / (len || 1), uy = (y1 - y0) / (len || 1);
    ctx.save(); ctx.strokeStyle = rgba(color, 0.55); ctx.lineWidth = 1;
    const nx = -uy, ny = ux;
    ctx.beginPath();
    [[x0, y0], [x1, y1]].forEach(([x, y]) => { ctx.moveTo(x - nx * 8, y - ny * 8); ctx.lineTo(x + nx * 4, y + ny * 4); });
    ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
    ctx.stroke(); ctx.restore();
    V.arrow(ctx, x0 - ux * 18, y0 - uy * 18, x0, y0, rgba(color, 0.85), 1, 6);
    V.arrow(ctx, x1 + ux * 18, y1 + uy * 18, x1, y1, rgba(color, 0.85), 1, 6);
    if (at) V.text(ctx, label, at[0], at[1], { font: "num", size: 12, color, align: at[2] || "left" });
    else V.text(ctx, label, x1 + ux * 24 + 2, y1 + uy * 24 + 4, { font: "num", size: 12, color });
  }
  const mm = (v) => (v >= 10 ? num(v, 1) : v >= 1 ? num(v, 2) : num(v, 3)) + " mm";

  /* ================= L–C merdiveni ================= */
  Demos.ch2Ladder = function (stage) {
    const cv = h("canvas", { "aria-label": "Bobin ve kondansatör merdiveninde ilerleyen darbe ve çıkıştaki gerilim" });
    const fill = h("div.fill", cv);
    const ctrl = h("div.controls");
    stage.append(fill, ctrl);
    // 1 m RG-58 boyutlarında koaksiyel: birim uzunluk L′ ve C′ kesitten
    const cab = RF.CABLES["RG-58"];
    const Lp = RF.coaxL(cab.D, cab.d), Cp = RF.coaxC(cab.D, cab.d, cab.er);
    const LEN = 1, Z0 = RF.z0FromLC(Lp, Cp), T = LEN / RF.velocityFromLC(Lp, Cp);
    const SIG = T / 12, T0 = 4 * SIG, TW = T0 + T * 1.6; // darbe genişliği, tepe anı, ekran penceresi
    const g = (t) => Math.exp(-0.5 * ((t - T0) / SIG) ** 2); // hatta giren (ileri) darbe
    let N = 6, sim = null, played = 0, running = false;
    const rL = readout("Basamak başına L", "c-xp"), rC = readout("Basamak başına C", "c-xn");
    const rZ = readout("√(L/C)"), rF = readout("Kesim frekansı"), rD = readout("Gecikme (ölçülen)"), rB = readout("Bozulma (ölçülen)");
    const sl = slider({ label: "Basamak sayısı", min: 2, max: 100, step: 1, value: N, fmt: (v) => String(Math.round(v)), oninput: (v) => { N = Math.round(v); build(); start(); } });
    const btn = h("button.btn.primary", { type: "button", onclick: () => start() }, "Darbe gönder");
    ctrl.append(btn, sl, h("div.readouts", rL, rC, rZ, rF, rD, rB));

    function build() {
      const Ls = (Lp * LEN) / N, Cs = (Cp * LEN) / N;
      const dt = 0.25 * Math.sqrt(Ls * Cs);
      sim = { Ls, Cs, dt, I: new Float64Array(N + 2), V: new Float64Array(N + 2), t: 0, out: [], inp: [] };
      rL.set(sig(Ls * 1e9, 3) + " nH"); rC.set(sig(Cs * 1e12, 3) + " pF");
      rZ.set(ohm(RF.z0FromLC(Ls, Cs)));
      rF.set(hz(1 / (Math.PI * Math.sqrt(Ls * Cs))));
      rD.set("—"); rB.set("—");
    }
    function stepSim(tEnd) {
      const s = sim, { Ls, Cs, dt, I, V } = s;
      while (s.t < tEnd) {
        const vs = 2 * g(s.t);
        I[1] = (I[1] + (dt / Ls) * (vs - V[1])) / (1 + (dt * Z0) / Ls);      // kaynak iç direnci Z0
        for (let k = 2; k <= N; k++) I[k] += (dt / Ls) * (V[k - 1] - V[k]);
        for (let k = 1; k < N; k++) V[k] += (dt / Cs) * (I[k] - I[k + 1]);
        V[N] = (V[N] + (dt / Cs) * I[N]) / (1 + dt / (Z0 * Cs));             // uyumlu yük Z0
        s.t += dt;
        s.out.push([s.t, V[N]]);
      }
    }
    function finish() {
      // ölç: çıkış tepe anı − giriş tepe anı; ideal gecikmeli darbeden sapma (rms)
      let pk = -1, tp = 0, e2 = 0, r2 = 0;
      for (const [t, v] of sim.out) {
        if (v > pk) { pk = v; tp = t; }
        const id = g(t - T); e2 += (v - id) ** 2; r2 += id * id;
      }
      rD.set(sig((tp - T0) * 1e9, 3) + " ns");
      rB.set("%" + num(100 * Math.sqrt(e2 / r2), 0));
    }
    function start() { if (!sim) build(); build(); played = 0; running = true; }
    build();

    const st = canvas(cv, draw);
    function coil(ctx, xa, xb, y, n) {
      const len = xb - xa, r = len / (2 * n);
      ctx.beginPath(); ctx.moveTo(xa, y);
      for (let i = 0; i < n; i++) ctx.arc(xa + r * (2 * i + 1), y, r, Math.PI, 0, false);
      ctx.stroke();
    }
    function draw() {
      const { ctx, w, h: hh } = st;
      if (!w) return;
      ctx.clearRect(0, 0, w, hh);
      const narrow = w < 560;
      const x0 = narrow ? 46 : 92, x1 = w - (narrow ? 40 : 84);
      const vTop = hh * 0.06, vH = hh * 0.17, railY = hh * 0.33, gndY = hh * 0.45;
      V.corners(ctx, 10, 10, w - 20, hh - 20, 14);
      const sw = (x1 - x0) / N;
      // düğüm gerilimleri bandı
      ctx.save(); ctx.strokeStyle = rgba(C.ink2, 0.22); ctx.setLineDash([2, 5]);
      ctx.beginPath(); ctx.moveTo(x0, vTop + vH); ctx.lineTo(x1, vTop + vH); ctx.stroke(); ctx.restore();
      V.text(ctx, "düğüm gerilimleri", x0, vTop - 2, { size: 12, color: C.ink2 });
      const pts = [];
      for (let k = 1; k <= N; k++) pts.push([x0 + sw * k, vTop + vH - (sim.V[k] / 1.15) * vH]);
      ctx.save(); ctx.strokeStyle = C.tot; ctx.lineWidth = 2.2; ctx.shadowColor = C.tot; ctx.shadowBlur = 8; ctx.lineJoin = "round";
      ctx.beginPath(); ctx.moveTo(x0, vTop + vH);
      pts.forEach(([x, y]) => ctx.lineTo(x, y)); ctx.stroke(); ctx.restore();
      if (sw > 7) pts.forEach(([x, y]) => { ctx.save(); ctx.fillStyle = C.tot; ctx.beginPath(); ctx.arc(x, y, 2.4, 0, Math.PI * 2); ctx.fill(); ctx.restore(); });
      // merdiven şeması
      ctx.save(); ctx.lineWidth = 1.6; ctx.lineCap = "round";
      ctx.strokeStyle = C.ink2;
      ctx.beginPath(); ctx.moveTo(x0 - 30, gndY); ctx.lineTo(x1 + 30, gndY); ctx.stroke();
      const humps = clamp(Math.round(sw / 9), 1, 4);
      for (let k = 0; k < N; k++) {
        const xa = x0 + sw * k, xb = xa + sw, cl = sw * 0.62, ca = xa + (sw - cl) / 2;
        ctx.strokeStyle = C.ink2; ctx.beginPath(); ctx.moveTo(xa, railY); ctx.lineTo(ca, railY); ctx.moveTo(ca + cl, railY); ctx.lineTo(xb, railY); ctx.stroke();
        ctx.strokeStyle = C.Xp; coil(ctx, ca, ca + cl, railY, humps);
        // kondansatör düğümde
        const pw = Math.min(16, sw * 0.7), my = (railY + gndY) / 2, gap = Math.max(2, Math.min(5, sw * 0.12));
        ctx.strokeStyle = C.ink2; ctx.beginPath(); ctx.moveTo(xb, railY); ctx.lineTo(xb, my - gap); ctx.moveTo(xb, my + gap); ctx.lineTo(xb, gndY); ctx.stroke();
        ctx.strokeStyle = C.Xn; ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.moveTo(xb - pw / 2, my - gap); ctx.lineTo(xb + pw / 2, my - gap); ctx.moveTo(xb - pw / 2, my + gap); ctx.lineTo(xb + pw / 2, my + gap); ctx.stroke();
        ctx.lineWidth = 1.6;
        if (sw > 7) { ctx.fillStyle = C.ink2; ctx.beginPath(); ctx.arc(xb, railY, 2, 0, Math.PI * 2); ctx.fill(); }
      }
      // kaynak (iç direnç Z0) ve yük (Z0)
      const sx = x0 - (narrow ? 26 : 50), my = (railY + gndY) / 2;
      ctx.strokeStyle = C.ink2; ctx.beginPath(); ctx.arc(sx, my, 10, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx - 5, my); ctx.bezierCurveTo(sx - 2, my - 7, sx + 2, my + 7, sx + 5, my); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx, my - 10); ctx.lineTo(sx, railY); ctx.lineTo(x0 - 18, railY); ctx.moveTo(sx, my + 10); ctx.lineTo(sx, gndY); ctx.stroke();
      const zig = (xa, xb, y) => { ctx.beginPath(); ctx.moveTo(xa, y); const n = 6; for (let i = 1; i < n; i++) ctx.lineTo(xa + ((xb - xa) * i) / n, y + (i % 2 ? -4 : 4)); ctx.lineTo(xb, y); ctx.stroke(); };
      ctx.strokeStyle = C.R; zig(x0 - 18, x0, railY);
      ctx.strokeStyle = C.ink2; ctx.beginPath(); ctx.moveTo(x1, railY); ctx.lineTo(x1 + 22, railY); ctx.lineTo(x1 + 22, railY + 8); ctx.moveTo(x1 + 22, gndY - 8); ctx.lineTo(x1 + 22, gndY); ctx.stroke();
      ctx.strokeStyle = C.R; ctx.save(); ctx.translate(x1 + 22, railY + 8); ctx.rotate(Math.PI / 2); zig(0, gndY - railY - 16, 0); ctx.restore();
      ctx.restore();
      if (!narrow) {
        V.text(ctx, "kaynak", sx, gndY + 18, { align: "center", size: 11, color: C.muted });
        V.text(ctx, "yük " + ohm(Z0, 3), x1 + 22, gndY + 18, { align: "center", size: 11, color: C.R });
      }
      V.text(ctx, N + " basamak · her biri " + meters(LEN / N), (x0 + x1) / 2, gndY + 20, { align: "center", size: 12, color: C.ink2, font: "num" });
      // osiloskop: zamana karşı gerilim
      const sx0 = x0 - (narrow ? 26 : 40), sx1 = x1 + 22, sy0 = hh * 0.56, sy1 = hh - 22, sH = sy1 - sy0;
      V.graticule(ctx, sx0, sy0, sx1 - sx0, sH, 10, 6);
      const tx = (t) => sx0 + (t / TW) * (sx1 - sx0), vy = (v) => sy0 + sH * 0.82 - (v / 1.25) * sH * 0.75;
      // ideal sürekli hat: gecikmeli darbe
      V.fn(ctx, (t) => g(t - T), 0, TW, sx0, vy(1.25), sx1 - sx0, vy(0) - vy(1.25), 0, 1.25, rgba(C.ink2, 0.8), 1.4);
      V.fn(ctx, (t) => g(t), 0, Math.min(TW, played || 0), sx0, vy(1.25), tx(Math.min(TW, played || 0)) - sx0, vy(0) - vy(1.25), 0, 1.25, C.fwd, 2, { glow: 6 });
      if (sim.out.length > 1) {
        ctx.save(); ctx.strokeStyle = C.tot; ctx.lineWidth = 2.2; ctx.shadowColor = C.tot; ctx.shadowBlur = 8; ctx.beginPath();
        const stepI = Math.max(1, Math.floor(sim.out.length / 900));
        for (let i = 0; i < sim.out.length; i += stepI) { const [t, v] = sim.out[i]; i ? ctx.lineTo(tx(t), vy(v)) : ctx.moveTo(tx(t), vy(v)); }
        ctx.stroke(); ctx.restore();
      }
      // eksen etiketleri
      for (let ns = 0; ns <= TW * 1e9; ns += 1) {
        if (narrow && ns % 2) continue;
        V.text(ctx, num(ns, 0), tx(ns * 1e-9), sy1 + 14, { align: "center", size: 10, color: C.muted, font: "num" });
      }
      V.text(ctx, "ns", sx1, sy1 + 14, { align: "right", size: 10, color: C.muted, font: "num" });
      const ly = sy0 + 16;
      V.text(ctx, "giren darbe", sx0 + 10, ly, { size: 12, color: C.fwd, weight: 600 });
      V.text(ctx, "yükteki gerilim", sx0 + 10, ly + 16, { size: 12, color: C.tot, weight: 600 });
      V.text(ctx, "sürekli hat (ideal)", sx0 + 10, ly + 32, { size: 12, color: C.ink2 });
    }
    const lp = loop((dt) => {
      if (running) {
        played += (dt * TW) / 3.2;
        if (played >= TW) { played = TW; stepSim(TW); running = false; finish(); }
        else stepSim(played);
      }
      draw();
    });
    let first = true;
    return { enter() { if (first) { first = false; start(); } lp.start(); }, leave() { lp.stop(); } };
  };

  /* ================= Karakteristik empedans ================= */
  // Hava koaksiyelde en düşük kayıp ve en yüksek güç için D/d oranı (aynı dış çap, sayısal optimum)
  function golden(f, a, b, maxim) {
    const r = (Math.sqrt(5) - 1) / 2; let c = b - r * (b - a), d = a + r * (b - a);
    for (let i = 0; i < 80; i++) {
      const fc = f(c), fd = f(d);
      if (maxim ? fc > fd : fc < fd) { b = d; d = c; c = b - r * (b - a); } else { a = c; c = d; d = a + r * (b - a); }
    }
    return (a + b) / 2;
  }
  const lossOf = (x) => RF.coaxLoss(1e8, 0.01, 0.01 / x, 1).conductor;                     // D = 10 mm sabit
  const powerOf = (x) => { const a = 0.005 / x, v = a * Math.log(x); return (v * v) / RF.coaxZ0(x, 1, 1); }; // E_max sabit: V = E·a·ln(D/d)
  const X_LOSS = golden(lossOf, 1.2, 10, false), X_POW = golden(powerOf, 1.05, 10, true);
  const Z_LOSS = RF.coaxZ0(X_LOSS, 1, 1), Z_POW = RF.coaxZ0(X_POW, 1, 1);

  Demos.ch2Z0 = function (stage, slide) {
    slide.querySelectorAll("[data-z0]").forEach((el) => { el.textContent = "≈ " + ohm(el.dataset.z0 === "loss" ? Z_LOSS : Z_POW, 3); });
    const cv = h("canvas", { "aria-label": "Kablo kesiti: boyutları sürükleyerek karakteristik empedansı değiştirin" });
    const leg = h("span.z0-leg", h("div.legend",
      h("span", h("i", { style: { background: "var(--e)" } }), "E alanı"),
      h("span", h("i", { style: { background: "var(--hf)" } }), "H alanı")));
    const fill = h("div.fill", cv);
    const ctrl = h("div.controls");
    const ctrl2 = h("div.controls.z0-row");
    stage.append(fill, ctrl2, ctrl);

    const P = {
      coax: { D: 2.95, d: 0.81, er: 2.25, key: "pe" },
      twin: { s: 8, d: 1.0, er: RF.DIELECTRICS.hava.er, key: "hava" },
      micro: { w: 3.0, h: 1.6, er: RF.DIELECTRICS.fr4.er, key: "fr4" },
    };
    const SL = {
      coax: [["D", "Dış çap D", 0.5, 25], ["d", "İç çap d", 0.1, 10]],
      twin: [["s", "Teller arası s", 0.5, 40], ["d", "Tel çapı d", 0.1, 6]],
      micro: [["w", "Şerit genişliği w", 0.05, 12], ["h", "Alt tabaka kalınlığı h", 0.1, 3.2]],
    };
    let type = "coax", fields = true, scale = 0, drag = null, hover = null, handles = [];
    const rZ = readout("Karakteristik empedans Z₀"), rLp = readout("L′ (birim uzunluk)", "c-xp"), rCp = readout("C′ (birim uzunluk)", "c-xn");
    const rVF = readout("Hız faktörü"), rEr = readout("εr");
    const typeSeg = seg([["coax", "Koaksiyel"], ["twin", "Çift hat"], ["micro", "Mikroşerit"]], type, (k) => { type = k; scale = 0; rebuild(); }, "Hat türü");
    const dielSeg = seg(Object.keys(RF.DIELECTRICS).map((k) => [k, RF.DIELECTRICS[k].label]), P[type].key, (k) => { P[type].er = RF.DIELECTRICS[k].er; P[type].key = k; update(); }, "Dielektrik");
    const fTog = toggle("Alan çizgileri", fields, (v) => { fields = v; leg.style.visibility = v ? "" : "hidden"; draw(); });
    const slWrap = h("span.z0-sliders"), preWrap = h("span.z0-presets");
    ctrl2.append(typeSeg, dielSeg, fTog, leg);
    ctrl.append(slWrap, preWrap, h("span.spacer"), h("div.readouts", rZ, rLp, rCp, rVF, rEr));
    let sliders = {};

    const z0 = (p = P[type], t = type) => t === "coax" ? RF.coaxZ0(p.D, p.d, p.er) : t === "twin" ? RF.twinZ0(p.s, p.d, p.er) : RF.microstripZ0(p.w, p.h, p.er);
    const eeff = () => type === "micro" ? RF.microstripEeff(P.micro.w, P.micro.h, P.micro.er) : P[type].er;
    function constrain(k) {
      const p = P[type];
      if (type === "coax") { if (k === "d") p.d = Math.min(p.d, p.D * 0.95); else p.D = Math.max(p.D, p.d / 0.95); }
      if (type === "twin") { if (k === "d") p.d = Math.min(p.d, p.s / 1.05); else p.s = Math.max(p.s, p.d * 1.05); }
    }
    // hedef Z₀ için birinci boyutu ikiye bölme yöntemiyle çöz
    function solveFor(target) {
      const p = P[type], [k, , lo, hi] = SL[type][0];
      // alt sınır: iç iletken / tel dışarıda kalmasın
      let a = type === "coax" ? Math.max(lo, p.d / 0.95) : type === "twin" ? Math.max(lo, p.d * 1.05) : lo, b = hi;
      const f = (v) => z0(Object.assign({}, p, { [k]: v })) - target;
      const inc = f(b) > f(a);
      for (let i = 0; i < 80; i++) { const m = (a + b) / 2; (f(m) > 0) === inc ? (b = m) : (a = m); }
      p[k] = (a + b) / 2; constrain(k); scale = 0; update();
    }
    function rebuild() {
      slWrap.innerHTML = ""; preWrap.innerHTML = ""; sliders = {};
      for (const [k, lab, lo, hi] of SL[type]) {
        const s = slider({ label: lab, min: lo, max: hi, value: P[type][k], log: true, fmt: mm, width: "130px",
          oninput: (v) => { P[type][k] = v; constrain(k); scaleHold(); update(); } });
        sliders[k] = s; slWrap.append(s);
      }
      const pre = type === "coax" ? ["RG-58", "RG-213", "RG-6", "LMR-400"] : [];
      pre.forEach((n) => preWrap.append(h("button.btn", { type: "button", onclick: () => {
        const c = RF.CABLES[n]; Object.assign(P.coax, { D: c.D, d: c.dEff, er: c.er, key: keyOf(c.er) }); scale = 0; update();
      } }, n)));
      const tg = type === "coax" ? [50, 75] : type === "twin" ? [300, 450] : [50];
      tg.forEach((z) => preWrap.append(h("button.btn", { type: "button", onclick: () => solveFor(z) }, ohm(z, 3) + " yap")));
      fTog.style.display = "";
      update();
    }
    const keyOf = (er) => Object.keys(RF.DIELECTRICS).find((k) => Math.abs(RF.DIELECTRICS[k].er - er) < 0.01) || null;
    let holdT = 0;
    function scaleHold() { holdT = 1.2; }
    function update() {
      const p = P[type];
      for (const k in sliders) sliders[k].set(p[k]);
      dielSeg.set(keyOf(p.er));
      const Z = z0(), ee = eeff(), v = RF.c0 / Math.sqrt(ee);
      let Lp, Cp;
      if (type === "coax") { Lp = RF.coaxL(p.D, p.d); Cp = RF.coaxC(p.D, p.d, p.er); }
      else { Lp = Z / v; Cp = 1 / (Z * v); }
      rZ.set(ohm(Z, 3)); rLp.set(sig(Lp * 1e9, 3) + " nH/m"); rCp.set(sig(Cp * 1e12, 3) + " pF/m");
      rVF.set(num(RF.vfFromEr(ee), 3));
      rEr.set(num(p.er, 2) + (type === "micro" ? " (etkin " + num(ee, 2) + ")" : ""));
      draw();
    }

    const st = canvas(cv, draw);
    function layout() {
      const { w, h: hh } = st, narrow = w < 620;
      const inset = type === "coax";
      if (narrow) return { ax: 0, ay: 0, aw: w, ah: inset ? hh * 0.62 : hh, ix: 16, iy: hh * 0.66, iw: w - 32, ih: hh * 0.34 - 56, narrow };
      return { ax: 0, ay: 0, aw: inset ? w * 0.6 : w, ah: hh, ix: w * 0.6 + 4, iy: hh * 0.14, iw: w * 0.4 - 26, ih: hh * 0.62, narrow };
    }
    function fitScale(Lo) {
      const p = P[type], { aw, ah } = Lo;
      if (type === "coax") return (Math.min(aw * 0.8, ah) * 0.3) / (p.D / 2);
      if (type === "twin") return Math.min((aw * 0.62) / (p.s + p.d), (ah * 0.34) / p.d);
      const span = Math.max(p.w * 2.2, p.w + 6 * p.h);
      return Math.min((aw * 0.78) / span, (ah * 0.36) / (p.h * 1.4));
    }
    function draw() {
      const { ctx, w, h: hh } = st;
      if (!w) return;
      ctx.clearRect(0, 0, w, hh);
      const Lo = layout();
      V.corners(ctx, 10, 10, w - 20, hh - 20, 14);
      const target = fitScale(Lo);
      if (!scale) scale = target;
      handles = [];
      const cx = Lo.ax + Lo.aw / 2, cy = Lo.ay + Lo.ah * (type === "coax" ? 0.45 : 0.5) + (Lo.narrow ? 6 : 10);
      if (type === "coax") drawCoax(ctx, cx, cy, Lo);
      else if (type === "twin") drawTwin(ctx, cx, cy, Lo);
      else drawMicro(ctx, cx, cy, Lo);
      // tutamaçlar
      for (const hd of handles) {
        ctx.save();
        const act = drag === hd.id || hover === hd.id;
        ctx.fillStyle = C.copper; ctx.strokeStyle = C.deep; ctx.lineWidth = 3;
        ctx.shadowColor = C.copper; ctx.shadowBlur = act ? 14 : 6;
        ctx.beginPath(); ctx.arc(hd.x, hd.y, act ? 8 : 6.5, 0, Math.PI * 2); ctx.stroke(); ctx.fill();
        ctx.restore();
      }
      // büyük Z₀ okuması tuvalde
      V.text(ctx, "Z₀ = " + ohm(z0(), 3), Lo.ax + 26, 44, { size: Lo.narrow ? 22 : 30, weight: 700, color: C.ink, font: "num" });
      if (type === "coax") drawInset(ctx, Lo);
      if (type === "twin") V.text(ctx, "dielektrik tellerin çevresini tamamen dolduruyor varsayılır", Lo.ax + 26, 64, { size: 11, color: C.muted });
      if (type === "micro") V.text(ctx, "Hammerstad formülü, iletken kalınlığı ihmal · alan çizgileri şematik", Lo.ax + 26, 64, { size: 11, color: C.muted });
    }
    function drawCoax(ctx, cx, cy, Lo) {
      const p = P.coax, R = (p.D / 2) * scale, r = (p.d / 2) * scale, t = Math.max(5, R * 0.1);
      // dış kılıf
      ctx.save(); ctx.fillStyle = rgba(C.deep, 0.9); ctx.strokeStyle = C.line2;
      ctx.beginPath(); ctx.arc(cx, cy, R + t + Math.max(4, R * 0.08), 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
      // dielektrik (taralı halka)
      ctx.save(); ctx.fillStyle = rgba(C.ink2, p.er > 1.01 ? 0.08 : 0.02);
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.arc(cx, cy, r, 0, Math.PI * 2, true); ctx.fill("evenodd"); ctx.restore();
      if (p.er > 1.01) hatchPath(ctx, () => { ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.arc(cx, cy, r, 0, Math.PI * 2, true); }, p.er > 2 ? 6 : 10);
      // alanlar: E ışınsal, H çembersel
      if (fields) {
        ctx.save(); ctx.strokeStyle = rgba(C.E, 0.55); ctx.lineWidth = 1.2;
        for (let i = 0; i < 16; i++) {
          const a = (i * Math.PI) / 8 + Math.PI / 16;
          ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * (r + 3), cy + Math.sin(a) * (r + 3)); ctx.lineTo(cx + Math.cos(a) * (R - 3), cy + Math.sin(a) * (R - 3)); ctx.stroke();
        }
        ctx.strokeStyle = rgba(C.H, 0.7);
        // H halkaları: 1/r yoğunluğu → logaritmik aralık
        for (let i = 1; i <= 3; i++) { const rr = r * Math.pow(R / r, i / 4); ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.stroke(); }
        ctx.restore();
      }
      // dış iletken (örgü) ve iç iletken
      ctx.save();
      ctx.fillStyle = copperFill(ctx, cx, cy, R + t);
      ctx.beginPath(); ctx.arc(cx, cy, R + t, 0, Math.PI * 2); ctx.arc(cx, cy, R, 0, Math.PI * 2, true); ctx.fill("evenodd");
      ctx.strokeStyle = rgba("#2a1205", 0.35); ctx.lineWidth = 1;
      for (let i = 0; i < 48; i++) { const a = (i * Math.PI) / 24; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); ctx.lineTo(cx + Math.cos(a + 0.06) * (R + t), cy + Math.sin(a + 0.06) * (R + t)); ctx.stroke(); }
      ctx.fillStyle = copperFill(ctx, cx, cy, r);
      ctx.beginPath(); ctx.arc(cx, cy, Math.max(r, 1.5), 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      // ölçüler
      const off = R + t + Math.max(4, R * 0.08) + 22;
      V.dimension(ctx, cx - R, cy + off, cx + R, cy + off, "D = " + mm(p.D));
      ctx.save(); ctx.strokeStyle = rgba(C.ink2, 0.35); ctx.setLineDash([2, 3]);
      ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx - R, cy + off + 6); ctx.moveTo(cx + R, cy); ctx.lineTo(cx + R, cy + off + 6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - r, cy); ctx.lineTo(cx - r, cy + off + 32); ctx.moveTo(cx + r, cy); ctx.lineTo(cx + r, cy + off + 32); ctx.stroke(); ctx.restore();
      dim(ctx, cx - r, cy + off + 26, cx + r, cy + off + 26, "d = " + mm(p.d));
      const a1 = -Math.PI / 4, a2 = (3 * Math.PI) / 4;
      handles.push({ id: "D", x: cx + Math.cos(a1) * R, y: cy + Math.sin(a1) * R, set: (x, y) => { P.coax.D = clamp((2 * Math.hypot(x - cx, y - cy)) / scale, 0.5, 25); constrain("D"); } });
      handles.push({ id: "d", x: cx + Math.cos(a2) * r, y: cy + Math.sin(a2) * r, set: (x, y) => { P.coax.d = clamp((2 * Math.hypot(x - cx, y - cy)) / scale, 0.1, 10); constrain("d"); } });
    }
    function drawTwin(ctx, cx, cy, Lo) {
      const p = P.twin, s2 = (p.s / 2) * scale, r = (p.d / 2) * scale;
      const xl = cx - s2, xr = cx + s2;
      if (p.er > 1.01) {
        const rr = r * 1.9 + 4;
        const web = () => { ctx.beginPath(); ctx.roundRect(xl - rr, cy - rr, xr - xl + 2 * rr, 2 * rr, rr); ctx.arc(xl, cy, r, 0, Math.PI * 2); ctx.arc(xr, cy, r, 0, Math.PI * 2); };
        ctx.save(); ctx.fillStyle = rgba(C.ink2, 0.08); web(); ctx.fill("evenodd"); ctx.strokeStyle = C.line2; ctx.stroke(); ctx.restore();
        hatchPath(ctx, web, 7);
      }
      if (fields) {
        const b = Math.sqrt(Math.max(1e-9, s2 * s2 - r * r)); // hat yüklerinin konumu (px)
        ctx.save(); ctx.beginPath(); ctx.ellipse(cx, cy, Math.min(Lo.aw * 0.47, s2 * 2.4), Math.min(Lo.ah * 0.36, s2 * 1.5), 0, 0, Math.PI * 2); ctx.clip();
        ctx.lineWidth = 1.2; ctx.strokeStyle = rgba(C.E, 0.5);
        ctx.beginPath(); ctx.moveTo(xl + r, cy); ctx.lineTo(xr - r, cy); ctx.stroke();
        for (const k of [0.35, 0.8, 1.7]) for (const sg of [-1, 1]) {
          const yc = sg * k * b, R = Math.hypot(b, yc);
          ctx.beginPath(); ctx.arc(cx, cy + yc, R, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.strokeStyle = rgba(C.H, 0.65);
        for (const m of [1.15, 1.5, 2.2]) for (const sg of [-1, 1]) {
          const xc = Math.max(s2, b) * m, R = Math.sqrt(Math.max(0, xc * xc - b * b));
          ctx.beginPath(); ctx.arc(cx + sg * xc, cy, R, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.restore();
      }
      for (const x of [xl, xr]) { ctx.save(); ctx.fillStyle = copperFill(ctx, x, cy, r); ctx.beginPath(); ctx.arc(x, cy, Math.max(r, 1.5), 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
      const off = Math.max(r * 2.2 + 30, 60);
      ctx.save(); ctx.strokeStyle = rgba(C.ink2, 0.35); ctx.setLineDash([2, 3]);
      ctx.beginPath(); ctx.moveTo(xl, cy); ctx.lineTo(xl, cy - off - 6); ctx.moveTo(xr, cy); ctx.lineTo(xr, cy - off - 6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(xr - r, cy); ctx.lineTo(xr - r, cy + off + 6); ctx.moveTo(xr + r, cy); ctx.lineTo(xr + r, cy + off + 6); ctx.stroke(); ctx.restore();
      V.dimension(ctx, xl, cy - off, xr, cy - off, "s = " + mm(p.s));
      dim(ctx, xr - r, cy + off, xr + r, cy + off, "d = " + mm(p.d));
      handles.push({ id: "s", x: xr, y: cy, set: (x) => { P.twin.s = clamp((2 * Math.abs(x - cx)) / scale, 0.5, 40); constrain("s"); } });
      handles.push({ id: "d", x: xl - r * Math.SQRT1_2, y: cy - r * Math.SQRT1_2, set: (x, y) => { P.twin.d = clamp((2 * Math.hypot(x - xl, y - cy)) / scale, 0.1, 6); constrain("d"); } });
    }
    function drawMicro(ctx, cx, cy, Lo) {
      const p = P.micro, W = p.w * scale, H = p.h * scale;
      const span = Math.max(p.w * 2.2, p.w + 6 * p.h) * scale;
      const gy = cy + H / 2 + 10, ty = gy - H, tw = 5;
      // alt tabaka
      const sub = () => { ctx.beginPath(); ctx.rect(cx - span / 2, ty, span, H); };
      ctx.save(); ctx.fillStyle = rgba(C.ink2, p.er > 1.01 ? 0.09 : 0.02); sub(); ctx.fill(); ctx.strokeStyle = C.line2; ctx.stroke(); ctx.restore();
      if (p.er > 1.01) hatchPath(ctx, sub, p.er > 3 ? 5 : 8);
      if (fields) {
        ctx.save(); ctx.lineWidth = 1.2; ctx.strokeStyle = rgba(C.E, 0.55);
        const n = Math.max(3, Math.round(W / 14));
        for (let i = 0; i <= n; i++) { const x = cx - W / 2 + (W * i) / n; ctx.beginPath(); ctx.moveTo(x, ty); ctx.lineTo(x, gy); ctx.stroke(); }
        // saçaklanan alan: şerit kenarından toprağa çeyrek elipsler
        for (const sg of [-1, 1]) for (const k of [0.6, 1.3, 2.2]) {
          ctx.beginPath(); ctx.ellipse(cx + sg * W / 2, gy, k * H, H + tw / 2, 0, sg > 0 ? -Math.PI / 2 : Math.PI, sg > 0 ? 0 : -Math.PI / 2); ctx.stroke();
        }
        // H: şeridi saran halkalar (altta alt tabakanın içinden geçer)
        ctx.strokeStyle = rgba(C.H, 0.6);
        for (const k of [0.8, 1.6, 2.6]) {
          const rx = W / 2 + k * H * 0.6, ru = k * H * 0.6 + 4, rl = Math.min(ru, H * 0.8), yc = ty - tw / 2;
          ctx.beginPath(); ctx.ellipse(cx, yc, rx, ru, 0, Math.PI, 2 * Math.PI); ctx.ellipse(cx, yc, rx, rl, 0, 0, Math.PI); ctx.stroke();
        }
        ctx.restore();
      }
      // toprak düzlemi ve şerit
      ctx.save();
      ctx.fillStyle = copperFill(ctx, cx, gy + 4, span / 2); ctx.fillRect(cx - span / 2, gy, span, 7);
      ctx.fillStyle = copperFill(ctx, cx, ty - tw / 2, Math.max(W / 2, 4)); ctx.fillRect(cx - W / 2, ty - tw, W, tw);
      ctx.restore();
      V.text(ctx, "toprak düzlemi", cx + span / 2, gy + 24, { size: 11, color: C.muted, align: "right" });
      const offT = ty - tw - 26;
      ctx.save(); ctx.strokeStyle = rgba(C.ink2, 0.35); ctx.setLineDash([2, 3]);
      ctx.beginPath(); ctx.moveTo(cx - W / 2, ty - tw); ctx.lineTo(cx - W / 2, offT - 6); ctx.moveTo(cx + W / 2, ty - tw); ctx.lineTo(cx + W / 2, offT - 6); ctx.stroke(); ctx.restore();
      dim(ctx, cx - W / 2, offT, cx + W / 2, offT, "w = " + mm(p.w));
      const hx = cx - span / 2 - 18;
      dim(ctx, hx, gy, hx, ty, "h = " + mm(p.h));
      handles.push({ id: "w", x: cx + W / 2, y: ty - tw / 2, set: (x) => { P.micro.w = clamp((2 * Math.abs(x - cx)) / scale, 0.05, 12); } });
      handles.push({ id: "h", x: cx - span / 2 + 10, y: ty, set: (x, y) => { P.micro.h = clamp((gy - y) / scale, 0.1, 3.2); } });
    }
    // Hava dielektrikli koaksiyel, aynı dış çap: kayıp ve güç taşıma (normalize), Z₀'a karşı
    function drawInset(ctx, Lo) {
      const { ix, iy, iw, ih } = Lo, er = P.coax.er;
      const zx0 = 10, zx1 = 150, X = (z) => ix + ((z - zx0) / (zx1 - zx0)) * iw, Y = (v) => iy + ih - v * (ih - 20);
      ctx.save(); ctx.fillStyle = rgba(C.deep, 0.55); ctx.strokeStyle = C.line; ctx.fillRect(ix - 8, iy - 30, iw + 16, ih + 76); ctx.strokeRect(ix - 8, iy - 30, iw + 16, ih + 76); ctx.restore();
      V.graticule(ctx, ix, iy, iw, ih, 7, 4, { center: false });
      V.text(ctx, "Hava dielektrikli koaksiyel, aynı dış çap", ix, iy - 12, { size: 12, color: C.ink, weight: 600 });
      const xs = [], n = 240;
      for (let i = 0; i <= n; i++) xs.push(Math.exp(Math.log(1.02) + (i / n) * (Math.log(400) - Math.log(1.02))));
      const lmin = lossOf(X_LOSS), pmax = powerOf(X_POW);
      const curve = (fn, col, lw) => {
        ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.shadowColor = col; ctx.shadowBlur = 5; ctx.beginPath(); let started = false;
        for (const x of xs) {
          const z = RF.coaxZ0(x, 1, 1); if (z < zx0 || z > zx1) continue;
          const px = X(z), py = Y(fn(x)); started ? ctx.lineTo(px, py) : (ctx.moveTo(px, py), started = true);
        }
        ctx.stroke(); ctx.restore();
      };
      const cLoss = C.ok, cPow = C.ink;
      curve((x) => lmin / lossOf(x), cLoss, 2.2);
      curve((x) => powerOf(x) / pmax, cPow, 1.6);
      const mark = (z, lab, col, right) => {
        ctx.save(); ctx.strokeStyle = rgba(col, 0.6); ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(X(z), Y(1) - 4); ctx.lineTo(X(z), iy + ih); ctx.stroke(); ctx.restore();
        const yy = iy + ih - (right ? 12 : 40);
        V.text(ctx, lab, X(z) + 6, yy - 14, { size: 11, color: col, weight: 600 });
        V.text(ctx, ohm(z, 3), X(z) + 6, yy, { size: 11, color: col, font: "num" });
      };
      mark(Z_POW, "en çok güç", cPow, false);
      mark(Z_LOSS, "en az kayıp", cLoss, true);
      // 50 Ω uzlaşması
      ctx.save(); ctx.fillStyle = rgba(C.copper, 0.12); ctx.fillRect(X(Z_POW), iy, X(Z_LOSS) - X(Z_POW), ih); ctx.restore();
      V.text(ctx, "50", X(50), iy + 14, { size: 11, color: C.copper, align: "center", font: "num", weight: 700 });
      [25, 50, 75, 100, 125].forEach((z) => V.text(ctx, String(z), X(z), iy + ih + 14, { size: 10, color: z === 50 || z === 75 ? C.ink : C.muted, align: "center", font: "num" }));
      V.text(ctx, "Z₀ (Ω)", ix + iw, iy + ih + 14, { size: 10, color: C.muted, align: "right" });
      // bu dielektrikle en az kayıp: aynı D/d, Z₀ ölçeği 1/√εr
      if (er > 1.01) V.text(ctx, "Bu dielektrikle (εr " + num(er, 2) + ") en az kayıp: " + ohm(RF.coaxZ0(X_LOSS, 1, er), 3), ix, iy + ih + 36, { size: 11, color: C.ink2 });
      // geçerli kablo
      const zc = z0(P.coax, "coax");
      if (zc >= zx0 && zc <= zx1 && er < 1.01) {
        ctx.save(); ctx.fillStyle = C.copper; ctx.beginPath(); ctx.moveTo(X(zc), iy + ih); ctx.lineTo(X(zc) - 5, iy + ih + 8); ctx.lineTo(X(zc) + 5, iy + ih + 8); ctx.closePath(); ctx.fill(); ctx.restore();
      }
    }
    pointer(cv, {
      down(x, y) {
        let best = null, bd = 22;
        for (const hd of handles) { const d = Math.hypot(x - hd.x, y - hd.y); if (d < bd) { bd = d; best = hd; } }
        drag = best ? best.id : null;
      },
      move(x, y) {
        if (!drag) return;
        const hd = handles.find((q) => q.id === drag); if (!hd) return;
        hd.set(x, y); holdT = 1.2; update();
      },
      up() { drag = null; draw(); },
      hover(x, y) {
        let best = null;
        for (const hd of handles) if (Math.hypot(x - hd.x, y - hd.y) < 22) best = hd.id;
        if (best !== hover) { hover = best; cv.style.cursor = best ? "grab" : ""; draw(); }
      },
    });
    // ölçek: sürükleme bitince yumuşakça yeniden sığdır
    const lp = loop((dt) => {
      if (drag) return;
      if (holdT > 0) { holdT -= dt; return; }
      const t = fitScale(layout());
      if (scale && Math.abs(t - scale) / t > 0.002) { scale += (t - scale) * Math.min(1, dt * 6); draw(); }
    });
    rebuild();
    return { enter() { lp.start(); }, leave() { lp.stop(); } };
  };

  /* ================= Deri etkisi ================= */
  // J0(z) karmaşık Bessel: |z| < 16 seri açılım, üstünde asimptotik açılım (Im z < 0 için baskın terim).
  // Dönüş: { lm: ln|J0|, ph: arg J0 }
  function logJ0(z) {
    const az = CX.abs(z);
    if (az < 16) {
      const q = CX.scale(CX.mul(z, z), -0.25);
      let term = RF.cx(1, 0), sum = RF.cx(1, 0);
      for (let k = 1; k < 120; k++) {
        term = CX.scale(CX.mul(term, q), 1 / (k * k));
        sum = CX.add(sum, term);
        if (CX.abs(term) < 1e-17 * CX.abs(sum)) break;
      }
      return { lm: Math.log(CX.abs(sum)), ph: CX.arg(sum) };
    }
    // J0(z) ≈ √(2/πz) · e^{iχ}/2 · (P + iQ), χ = z − π/4, P = 1 − 9/(128 z²), Q = −1/(8z) + 75/(1024 z³)
    const zi = CX.inv(z), zi2 = CX.mul(zi, zi), zi3 = CX.mul(zi2, zi);
    const Pp = CX.sub(1, CX.scale(zi2, 9 / 128));
    const Qq = CX.add(CX.scale(zi, -1 / 8), CX.scale(zi3, 75 / 1024));
    const PQ = CX.add(Pp, CX.mul(RF.cx(0, 1), Qq));
    const chiRe = z.re - Math.PI / 4, chiIm = z.im;
    return {
      lm: 0.5 * Math.log(2 / (Math.PI * az)) - chiIm - Math.LN2 + Math.log(CX.abs(PQ)),
      ph: -CX.arg(z) / 2 + chiRe + CX.arg(PQ),
    };
  }
  // J(r)/J(a) karmaşık oran; k = (1 − j)/δ
  function jRatio(r, a, delta, la) {
    const lr = logJ0(RF.cx(r / delta, -r / delta));
    la = la || logJ0(RF.cx(a / delta, -a / delta));
    return CX.polar(Math.exp(lr.lm - la.lm), lr.ph - la.ph);
  }
  // AC/DC direnç oranı: R_ac/R_dc = πa² ∫|J|² dA / |∫J dA|², yüzeye sıkışan ızgarayla sayısal integral
  function acdc(a, delta) {
    const la = logJ0(RF.cx(a / delta, -a / delta));
    const M = 2400;
    let Ire = 0, Iim = 0, Pw = 0, prev = null;
    for (let i = 0; i <= M; i++) {
      const s = a * Math.pow(i / M, 3), r = a - s; // derinlik s, yüzeyde sık
      const J = jRatio(r, a, delta, la), mag2 = J.re * J.re + J.im * J.im;
      const cur = { r, re: J.re * r, im: J.im * r, p: mag2 * r };
      if (prev) { const ds = prev.r - r; Ire += 0.5 * (cur.re + prev.re) * ds; Iim += 0.5 * (cur.im + prev.im) * ds; Pw += 0.5 * (cur.p + prev.p) * ds; }
      prev = cur;
    }
    // ∫…2πr dr: 2π katsayıları oranda sadeleşir → πa²·2π·Pw / (2π)²|I|² = a² Pw / (2|I|²)
    return (a * a * Pw) / (2 * (Ire * Ire + Iim * Iim));
  }
  // Veri sayfası noktaları (dB/100 ft → dB/100 m çarpı 3,2808):
  //  Belden 9201 (RG-58) nominal: 1 MHz 0,3 · 50 MHz 2,5 · 100 MHz 3,8 · 1000 MHz 14,5 dB/100 ft
  //  Belden 8267 (RG-213) nominal: 100 MHz 1,9 · 400 MHz 4,1 dB/100 ft
  const FT = 100 / 30.48;
  const SHEET = {
    "RG-58": [[1e6, 0.3], [50e6, 2.5], [100e6, 3.8], [1e9, 14.5]].map(([f, v]) => [f, v * FT]),
    "RG-213": [[100e6, 1.9], [400e6, 4.1]].map(([f, v]) => [f, v * FT]),
  };
  const TAND = 2e-4; // polietilen kayıp tanjantı (tipik)
  const cableLoss = (n, f) => { const c = RF.CABLES[n]; return RF.coaxLoss(f, c.D * 1e-3, c.dEff * 1e-3, c.er, TAND).total * 100; };

  Demos.ch2Skin = function (stage) {
    const cv = h("canvas", { "aria-label": "İletken kesitinde akım yoğunluğu, yarıçap boyunca profil ve kablo kaybı grafiği" });
    const fill = h("div.fill", cv);
    const ctrl = h("div.controls");
    stage.append(fill, ctrl);
    let f = 50, dia = 2; // Hz, mm
    const rD = readout("Deri derinliği δ", "c-h"), rA = readout("R_AC / R_DC"), r58 = readout("RG-58 kaybı"), r213 = readout("RG-213 kaybı");
    const sl = slider({ label: "Frekans", min: 50, max: 1e10, value: f, log: true, fmt: (v) => hz(v), oninput: (v) => { f = v; update(); }, width: "200px" });
    const sd = slider({ label: "Tel çapı", min: 0.2, max: 5, value: dia, step: 0.1, fmt: (v) => mm(v), oninput: (v) => { dia = v; update(); }, width: "110px" });
    ctrl.append(sl, sd, h("span.spacer"), h("div.readouts", rD, rA, r58, r213));
    let prof = null, img = null, off = null;
    function update() {
      const a = dia / 2000, delta = RF.skinDepth(f);
      rD.set(meters(delta));
      rA.set(num(acdc(a, delta), 2));
      if (f >= 1e6) { r58.set(num(cableLoss("RG-58", f), 1) + " dB/100 m"); r213.set(num(cableLoss("RG-213", f), 1) + " dB/100 m"); }
      else { r58.set("—"); r213.set("—"); }
      prof = null; draw();
    }
    const st = canvas(cv, draw);
    // akım yoğunluğu renk ölçeği: koyu → çivit (H) → açık çivit
    const cDeep = L.hexToRgb(C.deep), cH = L.hexToRgb(C.H), cHi = L.hexToRgb("#c3cbff");
    function col(v) {
      const t = clamp(v, 0, 1);
      const [A, B, k] = t < 0.75 ? [cDeep, cH, t / 0.75] : [cH, cHi, (t - 0.75) / 0.25];
      return [A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k, A[2] + (B[2] - A[2]) * k];
    }
    function layout() {
      const { w, h: hh } = st, narrow = w < 620;
      if (narrow) {
        const R = Math.min(w * 0.28, hh * 0.15);
        return { narrow, cx: 30 + R, cy: 34 + R, R, px: 2 * R + 70, py: 34, pw: w - 2 * R - 90, ph: 2 * R - 10, lx: 50, ly: 2 * R + 140, lw: w - 74, lh: hh - 2 * R - 190 };
      }
      const top = hh * 0.5, R = Math.min(w * 0.14, top * 0.3);
      return { narrow, cx: 44 + R, cy: 44 + R, R, px: 2 * R + 120, py: 46, pw: w - 2 * R - 150, ph: top - 86, lx: 70, ly: top + 40, lw: w - 110, lh: hh - top - 84 };
    }
    function draw() {
      const { ctx, w, h: hh } = st;
      if (!w) return;
      ctx.clearRect(0, 0, w, hh);
      V.corners(ctx, 10, 10, w - 20, hh - 20, 14);
      const Lo = layout(), a = dia / 2000, delta = RF.skinDepth(f);
      const la = logJ0(RF.cx(a / delta, -a / delta));
      const mag = (r) => CX.abs(jRatio(r, a, delta, la));
      // kesit ısı haritası (her halka piksel, halkadaki en büyük değer: yüzeydeki ince deri de görünsün)
      const Rp = Math.max(8, Math.round(Lo.R)), S = 2 * Rp + 2;
      if (!prof || prof.Rp !== Rp) {
        const tab = new Float64Array(Rp + 1);
        for (let j = 0; j <= Rp; j++) tab[j] = mag(a * Math.min(1, (j + 1) / Rp));
        tab[Rp] = 1;
        off = document.createElement("canvas"); off.width = S; off.height = S;
        const ox = off.getContext("2d"); img = ox.createImageData(S, S);
        const d = img.data;
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
          const rr = Math.hypot(x + 0.5 - S / 2, y + 0.5 - S / 2), o = (y * S + x) * 4;
          if (rr > Rp) { d[o + 3] = 0; continue; }
          const j = Math.min(Rp, Math.floor(rr)), c = col(tab[j]);
          d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
        }
        ox.putImageData(img, 0, 0);
        prof = { Rp };
      }
      ctx.drawImage(off, Lo.cx - S / 2, Lo.cy - S / 2);
      ctx.save(); ctx.strokeStyle = rgba(C.copper, 0.9); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(Lo.cx, Lo.cy, Rp, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      // δ: kesitte kesikli çember (görünecek kadar kalınsa)
      const dpx = (delta / a) * Rp;
      if (dpx >= 4 && dpx < Rp) {
        ctx.save(); ctx.strokeStyle = rgba("#ffffff", 0.55); ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.arc(Lo.cx, Lo.cy, Rp - dpx, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      }
      V.text(ctx, "bakır tel, çap " + mm(dia), Lo.cx, Lo.cy - Rp - 12, { align: "center", size: 12, color: C.ink2 });
      // büyüteç şeridi: yüzeyin son Z kadarı (Z = en çok 6δ), yüzey sağda
      const Z = Math.min(a, 6 * delta), bx0 = Lo.cx - Rp, bx1 = Lo.cx + Rp, by = Lo.cy + Rp + 22, bh = 14;
      for (let x = bx0; x < bx1; x++) {
        const u = (x + 0.5 - bx0) / (bx1 - bx0), c = col(mag(a - Z * (1 - u)));
        ctx.fillStyle = `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`; ctx.fillRect(x, by, 1.2, bh);
      }
      ctx.save(); ctx.strokeStyle = C.line2; ctx.strokeRect(bx0 - 0.5, by - 0.5, bx1 - bx0 + 1, bh + 1);
      ctx.fillStyle = C.copper; ctx.fillRect(bx1, by - 2, 2, bh + 4); ctx.restore();
      V.text(ctx, Z < a ? "yüzeyin son " + meters(Z) + "'si, büyütülmüş" : "merkezden yüzeye", bx0, by - 5, { size: 11, color: C.muted });
      const dX = bx1 - (delta / Z) * (bx1 - bx0);
      if (delta < Z) dim(ctx, dX, by + bh + 12, bx1, by + bh + 12, "δ = " + meters(delta), C.H, [dX - 24, by + bh + 16, "right"]);
      else V.text(ctx, "δ = " + meters(delta) + ": telden kalın", Lo.cx, by + bh + 16, { align: "center", size: 12, color: C.H, font: "num" });
      // yarıçap boyunca profil (çap kesiti)
      const { px, py, pw, ph } = Lo;
      V.graticule(ctx, px, py, pw, ph, 8, 4);
      V.text(ctx, Lo.narrow ? "akım yoğunluğu" : "akım yoğunluğu, çap boyunca (yüzeydekine göre)", px, py - 10, { size: 12, color: C.ink2 });
      const n = Math.max(200, Math.round(pw));
      const exact = new Float64Array(n + 1), appr = new Float64Array(n + 1);
      for (let i = 0; i <= n; i++) {
        const u = -1 + (2 * i) / n, r = Math.abs(u) * a;
        exact[i] = mag(r); appr[i] = Math.exp(-(a - r) / delta);
      }
      exact[0] = exact[n] = 1; appr[0] = appr[n] = 1;
      // dolgu
      ctx.save(); ctx.fillStyle = rgba(C.H, 0.18); ctx.beginPath(); ctx.moveTo(px, py + ph);
      for (let i = 0; i <= n; i++) ctx.lineTo(px + (pw * i) / n, py + ph - exact[i] * ph);
      ctx.lineTo(px + pw, py + ph); ctx.closePath(); ctx.fill(); ctx.restore();
      V.trace(ctx, exact, px, py, pw, ph, 0, 1, C.H, 2.4, { glow: 8 });
      V.trace(ctx, appr, px, py, pw, ph, 0, 1, rgba(C.ink, 0.7), 1);
      V.text(ctx, "−a", px, py + ph + 14, { size: 10, color: C.muted, align: "center", font: "num" });
      V.text(ctx, "0", px + pw / 2, py + ph + 14, { size: 10, color: C.muted, align: "center", font: "num" });
      V.text(ctx, "+a", px + pw, py + ph + 14, { size: 10, color: C.muted, align: "center", font: "num" });
      V.text(ctx, "kalın: tam çözüm (Bessel)", px, py + ph + 30, { size: 11, color: C.H, weight: 600 });
      if (Lo.narrow) V.text(ctx, "ince: yaklaşık e^(−(a−r)/δ)", px, py + ph + 44, { size: 11, color: C.ink2 });
      else V.text(ctx, "ince: yaklaşık e^(−(a−r)/δ)", px + pw, py + ph + 30, { size: 11, color: C.ink2, align: "right" });
      // kablo kaybı grafiği: log-log
      const { lx, ly, lw, lh } = Lo, F0 = 1e6, F1 = 1e10, D0 = 0.3, D1 = 300;
      const X = (fr) => lx + (Math.log10(fr / F0) / Math.log10(F1 / F0)) * lw, Y = (v) => ly + lh - (Math.log10(v / D0) / Math.log10(D1 / D0)) * lh;
      V.graticule(ctx, lx, ly, lw, lh, 4, 3, { center: false });
      V.text(ctx, Lo.narrow ? "kablo kaybı (dB/100 m)" : "kablo kaybı (dB/100 m), kuramsal eğri ve veri sayfası noktaları", lx, ly - 10, { size: 12, color: C.ink2 });
      [1e6, 1e7, 1e8, 1e9, 1e10].forEach((fr) => V.text(ctx, hz(fr, 0), X(fr), ly + lh + 14, { size: 10, color: C.muted, align: "center", font: "num" }));
      [1, 10, 100].forEach((v) => V.text(ctx, String(v), lx - 6, Y(v) + 4, { size: 10, color: C.muted, align: "right", font: "num" }));
      const cols = { "RG-58": C.ink, "RG-213": C.ink2 };
      for (const nm of ["RG-58", "RG-213"]) {
        V.fn(ctx, (u) => Math.log10(cableLoss(nm, Math.pow(10, u))), 6, 10, lx, ly, lw, lh, Math.log10(D0), Math.log10(D1), cols[nm], nm === "RG-58" ? 2 : 1.6);
        for (const [fr, v] of SHEET[nm]) {
          ctx.save(); ctx.strokeStyle = cols[nm]; ctx.lineWidth = 1.5; ctx.fillStyle = C.stage;
          ctx.beginPath(); ctx.arc(X(fr), Y(v), 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
        }
        const fl = 4e9;
        V.text(ctx, nm, X(fl) + 6, Y(cableLoss(nm, fl)) + (nm === "RG-58" ? -6 : 14), { size: 12, color: cols[nm], weight: 600 });
      }
      // geçerli frekans
      if (f >= F0) {
        ctx.save(); ctx.strokeStyle = rgba(C.copper, 0.8); ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(X(f), ly); ctx.lineTo(X(f), ly + lh); ctx.stroke(); ctx.restore();
        for (const nm of ["RG-58", "RG-213"]) { ctx.save(); ctx.fillStyle = C.copper; ctx.beginPath(); ctx.arc(X(f), Y(cableLoss(nm, f)), 3.5, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
      } else V.text(ctx, "← " + hz(f) + ": grafiğin solunda", lx + 8, ly + lh - 8, { size: 11, color: C.copper });
    }
    update();
    return { enter() {}, leave() {} };
  };

  window.GLOSSARY_EXTRA = (window.GLOSSARY_EXTRA || []).concat([
    { k: ["kesim frekansı"], t: "Kesim frekansı", d: "Bir süzgecin (burada sonlu L–C merdiveninin) sinyali geçirmeyi bıraktığı frekans. Merdivende basamak başına f_c = 1/(π√(LC)).", u: "https://en.wikipedia.org/wiki/Cutoff_frequency" },
    { k: ["mikrometre"], t: "Mikrometre (µm)", d: "Metrenin milyonda biri; bir saç teli yaklaşık 50–100 µm kalınlığındadır.", u: "https://tr.wikipedia.org/wiki/Mikrometre" },
  ]);

  window.GUIDE_SCENARIOS = Object.assign(window.GUIDE_SCENARIOS || {}, {
    "lc-merdiven": [{ slide: "label:Basamak sayısı", to: 4 }, { wait: 3600 }, { slide: "label:Basamak sayısı", to: 60 }],
    "karakteristik-empedans": [{ slide: "label:Dış çap D", to: Math.log(9) }, { wait: 500 }, { click: "=RG-6" }],
    "deri-etkisi": [{ slide: "label:Frekans", to: Math.log(1e5) }, { wait: 400 }, { slide: "label:Frekans", to: Math.log(1e9) }],
  });
})();
