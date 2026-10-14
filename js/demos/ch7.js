/* Bölüm 7: gerçek dünyada. Bağlantı bütçesi (Friis), NanoVNA ekranı okumak, pratik hatalar, güvenlik.
   Ekrandaki her sayı RF.* ile ya da bu dosyadaki (kaynağı belirtilmiş) yerel formüllerle hesaplanır. */
(function () {
  const { C, FONT, rgba, h, canvas, slider, seg, toggle, clamp, num, sig, ohm, db, hz, meters } = L;

  /* ---------- ortak yardımcılar ---------- */
  const dbm = (v, d = 1) => db(v, d, "dBm");
  function watt(p) {
    if (p >= 1) return sig(p, 3) + " W";
    if (p >= 1e-3) return sig(p * 1e3, 3) + " mW";
    return sig(p * 1e6, 3) + " µW";
  }
  // mesafe etiketi: 1 m, 10 m, 1 km …
  const dist = (d) => (d < 1 ? meters(d) : d < 1000 ? num(d, 0) + " m" : num(d / 1000, 0) + " km");
  // gereksiz sıfırları at: "5,00 W" → "5 W", "63,10 mW" → "63,1 mW"
  const trim0 = (t) => t.replace(/,(\d*?)0+ /, (m, a) => (a ? "," + a + " " : " "));
  const sgn = (v, d = 1) => (v >= 0 ? "+" : "−") + num(Math.abs(v), d);
  function readout(k, cls) {
    const v = h("span.v", "—");
    const el = h("div.readout" + (cls ? "." + cls : ""), h("span.k", k), v);
    el.set = (s, c) => { v.textContent = s; if (c !== undefined) { el.className = "readout" + (c ? " " + c : ""); } };
    return el;
  }
  const show = (el, on) => { el.style.display = on ? "" : "none"; };
  // Kablo kaybı (dB/m): RF.coaxLoss, ideal iletken; katı/köpük PE için tanδ ≈ 2·10⁻⁴
  const TAND = 2e-4;
  function cableDbPerM(type, f) {
    const c = RF.CABLES[type];
    return RF.coaxLoss(f, c.D / 1e3, c.dEff / 1e3, c.er, TAND).total;
  }
  function yTicks(ymin, ymax, px) {
    const span = ymax - ymin, steps = [5, 10, 20, 25, 50];
    let st = 50;
    for (const s of steps) if ((px * s) / span >= 26) { st = s; break; }
    const out = [];
    for (let v = Math.ceil(ymin / st) * st; v <= ymax + 1e-9; v += st) out.push(v);
    return out;
  }

  /* =====================================================================
     1. Bağlantı bütçesi: seviye merdiveni (dBm), Friis
     ===================================================================== */
  const BUDGET_SCEN = {
    // El telsizi 2 m: BTK teknik ölçütleri 144–146 MHz el telsizi FM en çok 5 W. Antenler 0 dBi varsayım.
    hand: { pW: 5, gt: 0, gr: 0, d: 10e3, f: 145.5e6, sens: -120, cab: [{ type: "none", len: 0, db: 0 }, { type: "none", len: 0, db: 0 }] },
    // Wi-Fi 2,4 GHz: 100 mW e.i.r.p. sınırı (18 dBm + 2 dBi); hassasiyet 54 Mbit/s için tipik −72 dBm
    wifi: { pW: 0.0631, gt: 2, gr: 2, d: 100, f: 2.437e9, sens: -72, cab: [{ type: "none", len: 0, db: 0 }, { type: "none", len: 0, db: 0 }] },
    // LoRa 868: 25 mW e.r.p. (= 14 dBm + 2,15 dBi), SX1276 SF12/125 kHz hassasiyeti −136 dBm; ağ geçidinde 10 m RG-58
    lora: { pW: 0.0251, gt: 2.15, gr: 2.15, d: 15e3, f: 868.3e6, sens: -136, cab: [{ type: "none", len: 0, db: 0 }, { type: "RG-58", len: 10, db: 0 }] },
    // Yer–ISS: 145,8 MHz iniş; ISS telsizi en çok 25 W (ARISS). Yerde dikey anten + 15 m RG-58
    iss: { pW: 25, gt: 0, gr: 2.15, d: 1000e3, f: 145.8e6, sens: -120, cab: [{ type: "none", len: 0, db: 0 }, { type: "RG-58", len: 15, db: 0 }] },
  };

  Demos.ch7Budget = function (stage) {
    const S = JSON.parse(JSON.stringify(BUDGET_SCEN.hand));
    const cv = h("canvas", { "aria-label": "Bağlantı bütçesi: vericiden alıcıya sinyal seviyesi merdiveni, dBm ekseninde" });
    const fill = h("div.fill.ch7-fill", cv);
    const scen = seg([["hand", "El telsizi 2 m"], ["wifi", "Wi-Fi 2,4 GHz"], ["lora", "LoRa 868 MHz"], ["iss", "Yer–ISS"]], "hand", load, "Hazır senaryo");
    const top = h("div.controls.top.ch7-top", h("span.lab", "Senaryo"), scen);

    const verdict = h("div.ch7-verdict");
    const vText = h("b.ch7-big", "—");
    const rEirp = readout("e.i.r.p.", "c-fwd"), rFspl = readout("Yol kaybı"), rPr = readout("Alınan güç", "c-fwd"), rMar = readout("Marj"), rMax = readout("Serbest uzayda menzil");
    verdict.append(vText, h("div.readouts", rEirp, rFspl, rPr, rMar, rMax));

    const mod = () => { scen.set(null); update(); };
    const sP = slider({ label: "Verici gücü", min: 1e-3, max: 100, value: S.pW, log: true, fmt: (v) => trim0(watt(v)) + " · " + dbm(RF.wToDbm(v)), oninput: (v) => { S.pW = v; mod(); } });
    const sGt = slider({ label: "Verici anteni", min: -5, max: 30, step: 0.5, value: S.gt, fmt: (v) => num(v, 1) + " dBi", oninput: (v) => { S.gt = v; mod(); } });
    const sGr = slider({ label: "Alıcı anteni", min: -5, max: 30, step: 0.5, value: S.gr, fmt: (v) => num(v, 1) + " dBi", oninput: (v) => { S.gr = v; mod(); } });
    const sD = slider({ label: "Mesafe", min: 10, max: 5e6, value: S.d, log: true, fmt: meters, oninput: (v) => { S.d = v; mod(); } });
    const sF = slider({ label: "Frekans", min: 30e6, max: 6e9, value: S.f, log: true, fmt: (v) => hz(v), oninput: (v) => { S.f = v; mod(); } });
    const sS = slider({ label: "Alıcı hassasiyeti", min: -145, max: -50, step: 1, value: S.sens, fmt: (v) => dbm(v, 0), oninput: (v) => { S.sens = v; mod(); } });

    function cableRow(i, name) {
      const c = S.cab[i];
      const sg = seg([["none", "Yok"], ["RG-58", "RG-58"], ["RG-213", "RG-213"], ["LMR-400", "LMR-400"], ["db", "dB"]], c.type, (k) => { S.cab[i].type = k; sync(); mod(); }, name);
      const sl = slider({ label: name + " uzunluğu", min: 0, max: 60, step: 0.5, value: c.len, fmt: (v) => num(v, 1) + " m", oninput: (v) => { S.cab[i].len = v; mod(); } });
      const sd = slider({ label: name + " kaybı", min: 0, max: 20, step: 0.1, value: c.db, fmt: (v) => num(v, 1) + " dB", oninput: (v) => { S.cab[i].db = v; mod(); } });
      const out = h("output.val.ch7-cabloss", "");
      function sync() {
        const t = S.cab[i].type;
        sg.set(t); sl.set(S.cab[i].len); sd.set(S.cab[i].db);
        show(sl, t !== "none" && t !== "db"); show(sd, t === "db");
      }
      const row = h("div.ch7-cab", h("span.lab", name), sg, sl, sd, out);
      row.sync = sync; row.out = out;
      sync();
      return row;
    }
    const cab0 = cableRow(0, "Verici kablosu"), cab1 = cableRow(1, "Alıcı kablosu");
    const ctrl = h("div.controls.ch7-grid", sP, sF, sGt, sGr, sD, sS, cab0, cab1);
    stage.append(top, verdict, fill, ctrl);

    function load(k) {
      Object.assign(S, JSON.parse(JSON.stringify(BUDGET_SCEN[k])));
      sP.set(S.pW); sGt.set(S.gt); sGr.set(S.gr); sD.set(S.d); sF.set(S.f); sS.set(S.sens);
      cab0.sync(); cab1.sync();
      update();
    }
    function cableLoss(c) {
      if (c.type === "none") return 0;
      if (c.type === "db") return c.db;
      return cableDbPerM(c.type, S.f) * c.len;
    }
    let B = null;
    function calc() {
      const Pt = RF.wToDbm(S.pW), Lt = cableLoss(S.cab[0]), Lr = cableLoss(S.cab[1]);
      const fspl = RF.fspl(S.d, S.f);
      const Pr = RF.friis({ ptDbm: Pt, gtDbi: S.gt, grDbi: S.gr, d: S.d, f: S.f, lossDb: Lt + Lr });
      const lv = [Pt, Pt - Lt, Pt - Lt + S.gt, Pt - Lt + S.gt - fspl, Pt - Lt + S.gt - fspl + S.gr, Pr];
      const margin = Pr - S.sens;
      return { Pt, Lt, Lr, fspl, Pr, lv, margin, eirp: lv[2], dmax: S.d * Math.pow(10, margin / 20) };
    }
    function update() {
      B = calc();
      const ok = B.margin >= 0;
      vText.textContent = ok ? (B.margin < 6 ? "Kurulur, ama kıl payı" : "Bağlantı kurulur") : "Bağlantı kurulmaz";
      vText.className = "ch7-big " + (ok ? (B.margin < 6 ? "warn" : "ok") : "bad");
      rEirp.set(dbm(B.eirp)); rFspl.set(db(-B.fspl)); rPr.set(dbm(B.Pr));
      rMar.set(sgn(B.margin) + " dB", ok ? "ok" : "bad");
      rMax.set(B.dmax > 4e7 ? "> 40.000 km" : meters(B.dmax));
      const lossTxt = (c, v) => (c.type === "none" ? "" : v < 0.05 ? "0 dB" : "−" + num(v, 1) + " dB");
      cab0.out.textContent = lossTxt(S.cab[0], B.Lt); cab1.out.textContent = lossTxt(S.cab[1], B.Lr);
      draw();
    }

    const st = canvas(cv, draw);
    function draw() {
      if (!B) return;
      const { ctx, w, h: H } = st;
      if (!w) return;
      ctx.clearRect(0, 0, w, H);
      const narrow = w < 520;
      const padL = narrow ? 44 : 64, padR = narrow ? 10 : 22, padT = 26, padB = narrow ? 52 : 44;
      const x0 = padL, x1 = w - padR, y0 = padT, y1 = H - padB;
      const { lv, Pr } = B;
      let ymax = Math.max(lv[0], lv[2], lv[1]) + 8, ymin = Math.min(Pr, S.sens, lv[3]) - 14;
      ymax = Math.ceil(ymax / 5) * 5; ymin = Math.floor(ymin / 5) * 5;
      const Y = (v) => y1 - ((v - ymin) / (ymax - ymin)) * (y1 - y0);
      // ızgara + eksen
      const ticks = yTicks(ymin, ymax, y1 - y0);
      ctx.save();
      ctx.lineWidth = 1;
      for (const t of ticks) {
        const yy = Math.round(Y(t)) + 0.5;
        ctx.strokeStyle = t === 0 ? C.grid2 : C.grid;
        ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x1, yy); ctx.stroke();
        V.text(ctx, num(t, 0), x0 - 6, yy + 4, { size: narrow ? 10 : 11, font: "num", align: "right", color: C.muted });
      }
      ctx.restore();
      V.text(ctx, "dBm", x0 - 6, y0 - 10, { size: 11, font: "num", align: "right", color: C.ink2 });
      // sütunlar
      const wts = [1, 1, 1, 3.4, 1, 1, 1.3], sum = wts.reduce((a, b) => a + b, 0);
      const cols = []; let cx = x0;
      for (const wt of wts) { const cw = ((x1 - x0) * wt) / sum; cols.push([cx, cx + cw]); cx += cw; }
      const names = narrow ? ["Verici", "Kablo", "Anten", "Yol", "Anten", "Kablo", "Alıcı"] : ["Verici", "Kablo", "Anten", "Boşlukta yol", "Anten", "Kablo", "Alıcı"];
      cols.forEach(([a, b], i) => {
        if (i) { ctx.strokeStyle = rgba(C.line2, 0.5); ctx.setLineDash([2, 4]); ctx.beginPath(); ctx.moveTo(a + 0.5, y0); ctx.lineTo(a + 0.5, y1); ctx.stroke(); ctx.setLineDash([]); }
        V.text(ctx, names[i], (a + b) / 2, y1 + 18, { size: narrow ? 10 : 12, align: "center", color: C.ink2, weight: 600 });
      });
      V.text(ctx, meters(S.d) + " · " + hz(S.f), (cols[3][0] + cols[3][1]) / 2, y1 + 34, { size: narrow ? 10 : 11, align: "center", color: C.muted, font: "num" });
      // duyulmaz bölge ve hassasiyet çizgisi
      const ys = Y(S.sens);
      ctx.fillStyle = rgba(C.bad, 0.07); ctx.fillRect(x0, ys, x1 - x0, y1 - ys);
      ctx.save(); ctx.setLineDash([6, 5]); ctx.strokeStyle = rgba(C.bad, 0.85); ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(x0, ys); ctx.lineTo(x1, ys); ctx.stroke(); ctx.restore();
      V.text(ctx, "alıcı hassasiyeti " + dbm(S.sens, 0), cols[3][0] + 6, ys + 15, { size: narrow ? 10 : 12, color: rgba(C.bad, 0.95), font: "num" });
      // seviye çizgisi
      const pts = [];
      const ramp = (i, a, b) => { const [ca, cb] = cols[i], m = (ca + cb) / 2, r = (cb - ca) * 0.18; pts.push([m - r, Y(a)], [m + r, Y(b)]); };
      pts.push([cols[0][0] + 6, Y(lv[0])]);
      ramp(1, lv[0], lv[1]); ramp(2, lv[1], lv[2]);
      // yol: logaritmik mesafe ekseninde FSPL düz bir çizgidir. d₀ = λ/4π'de FSPL = 0.
      const [pa, pb] = cols[3], d0 = RF.c0 / (4 * Math.PI * S.f), lgA = Math.log10(d0), lgB = Math.log10(Math.max(S.d, d0 * 1.01));
      const px = (d) => pa + 8 + ((Math.log10(d) - lgA) / (lgB - lgA)) * (pb - pa - 16);
      pts.push([pa + 8, Y(lv[2])], [pb - 8, Y(lv[3])]);
      ramp(4, lv[3], lv[4]); ramp(5, lv[4], lv[5]);
      pts.push([cols[6][1] - 6, Y(lv[5])]);
      // mesafe on katları: yol çizgisi üzerinde küçük çentikler
      ctx.save();
      for (let e = Math.ceil(lgA); e <= lgB; e++) {
        const d = Math.pow(10, e), xx = px(d), yy = Y(lv[2] - RF.fspl(d, S.f));
        ctx.strokeStyle = rgba(C.ink2, 0.5); ctx.beginPath(); ctx.moveTo(xx, yy - 5); ctx.lineTo(xx, yy + 5); ctx.stroke();
        if (!narrow || e % 2 === 0) V.text(ctx, dist(d), xx - 5, yy + 14, { size: 9.5, font: "num", color: C.muted, align: "right" });
      }
      ctx.restore();
      ctx.save();
      ctx.strokeStyle = C.fwd; ctx.lineWidth = 2.6; ctx.lineJoin = "round"; ctx.shadowColor = C.fwd; ctx.shadowBlur = 10;
      ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
      ctx.restore();
      // basamak etiketleri
      const lab = (x, y, s, col, al = "center", dy = -9) => V.text(ctx, s, x, y + dy, { size: narrow ? 10 : 12, font: "num", align: al, color: col, weight: 600 });
      const mid = (i) => (cols[i][0] + cols[i][1]) / 2;
      lab(mid(0), Y(lv[0]), dbm(lv[0]), C.fwd);
      if (B.Lt > 0.05) lab(mid(1), Math.min(Y(lv[0]), Y(lv[1])), "−" + num(B.Lt, 1), C.ink2);
      if (Math.abs(S.gt) > 0.05) lab(mid(2), Math.min(Y(lv[1]), Y(lv[2])), sgn(S.gt, 1), C.ink2);
      if (!narrow) V.text(ctx, "e.i.r.p. " + dbm(lv[2]), pa + 8, Y(lv[2]) - 9, { size: 12, font: "num", color: C.fwd, weight: 600 });
      // yol kaybı: çizginin ortasında
      const mx = (pa + pb) / 2, my = (Y(lv[2]) + Y(lv[3])) / 2;
      V.text(ctx, "yol kaybı −" + num(B.fspl, 1) + " dB", mx + 14, my - 22, { size: narrow ? 11 : 13, font: "num", color: C.ink, weight: 600 });
      if (!narrow) V.text(ctx, "her 10 kat mesafe: −20 dB", mx + 14, my - 5, { size: 11, color: C.muted });
      if (Math.abs(S.gr) > 0.05) lab(mid(4), Math.min(Y(lv[3]), Y(lv[4])), sgn(S.gr, 1), C.ink2);
      if (B.Lr > 0.05) lab(mid(5), Math.min(Y(lv[4]), Y(lv[5])), "−" + num(B.Lr, 1), C.ink2);
      lab(cols[6][1] - 26, Y(Pr), dbm(Pr), C.fwd, "right", Pr >= S.sens ? -9 : 18);
      // marj ölçü çizgisi
      const okc = B.margin >= 0 ? C.ok : C.bad;
      const dx = cols[6][1] - 14;
      if (Math.abs(Y(Pr) - ys) > 30) V.dimension(ctx, dx, Y(Pr), dx, ys, "marj " + sgn(B.margin, 1) + " dB", { color: okc, size: narrow ? 10 : 11 });
      // noktalar
      ctx.save(); ctx.fillStyle = C.fwd; ctx.shadowColor = C.fwd; ctx.shadowBlur = 8;
      for (const p of [pts[0], pts[pts.length - 1]]) { ctx.beginPath(); ctx.arc(p[0], p[1], 3.5, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
      V.corners(ctx, 6, 6, w - 12, H - 12);
    }
    update();
    return { enter() { st.fit(); draw(); }, leave() {} };
  };

  /* =====================================================================
     2. NanoVNA ekranı: dipol (seri RLC yaklaşık modeli) + RG-58 kablo
     ===================================================================== */
  const FA = 120e6, FB = 170e6, NS = 301;
  const RG58 = RF.CABLES["RG-58"];
  // Dipol yaklaşık modeli: seri RLC, R sabit, X = Q·R·(f/f0 − f0/f)
  const dipoleZ = RF.dipoleSeriesRLC;
  function cableZ(Z, f, len, lossy) {
    if (len <= 0) return Z;
    const beta = (2 * Math.PI * f) / (RF.c0 * RG58.vf);
    if (!lossy) return RF.zin(Z, 50, beta * len);
    const alpha = RF.dbToNeper(cableDbPerM("RG-58", f));
    return RF.zinLossy(Z, 50, alpha, beta, len);
  }

  Demos.ch7Vna = function (stage) {
    const S = { f0: 145e6, Q: 10, len: 0, lossy: false, fm: 140e6 };
    const cv = h("canvas", { "aria-label": "Simüle NanoVNA ekranı: S11 dB, VSWR ve Smith abağı; imleç sürüklenebilir" });
    const fill = h("div.fill.ch7-fill.ch7-tall.ch7-vna", cv);
    const rF = readout("İmleç", "c-cu"), rR = readout("R", "c-r"), rX = readout("X", "c-xp"), rS = readout("VSWR", "c-tot"), rRL = readout("Geri dönüş kaybı", "c-ref");
    const sF0 = slider({ label: "Rezonans frekansı", min: 130e6, max: 160e6, value: S.f0, step: 0.1e6, fmt: (v) => hz(v, 1), oninput: (v) => { S.f0 = v; update(); } });
    const sQ = slider({ label: "Q (keskinlik)", min: 3, max: 30, step: 0.5, value: S.Q, fmt: (v) => num(v, 1), oninput: (v) => { S.Q = v; update(); } });
    const sL = slider({ label: "Kablo uzunluğu", min: 0, max: 10, step: 0.05, value: S.len, fmt: (v) => num(v, 2) + " m", oninput: (v) => { S.len = v; update(); } });
    const tL = toggle("Kablo kaybı", S.lossy, (v) => { S.lossy = v; update(); }, "c-ref");
    const ctrl = h("div.controls", sF0, sQ, sL, tL, h("div.readouts.ch7-vna-ro", rF, rR, rX, rS, rRL));
    stage.append(fill, ctrl);

    let sweep = [], bare = [];
    function update() {
      sweep = []; bare = [];
      for (let i = 0; i < NS; i++) {
        const f = FA + ((FB - FA) * i) / (NS - 1);
        const za = dipoleZ(f, S.f0, S.Q), z = cableZ(za, f, S.len, S.lossy), g = RF.gamma(z, 50);
        sweep.push({ f, z, g, s11: 20 * Math.log10(Math.max(1e-6, RF.C.abs(g))), vswr: RF.vswr(g) });
        bare.push(RF.C.scale(za, 1 / 50));
      }
      const m = at(S.fm);
      rF.set(hz(m.f, 3)); rR.set(sig(m.z.re, 3) + " Ω");
      rX.set((m.z.im < 0 ? "−" : "+") + "j" + sig(Math.abs(m.z.im), 3) + " Ω", m.z.im < 0 ? "c-xn" : "c-xp");
      rS.set(isFinite(m.vswr) ? num(m.vswr, 2) : "∞"); rRL.set(db(RF.returnLoss(m.g), 1));
      draw();
    }
    function at(f) {
      const za = dipoleZ(f, S.f0, S.Q), z = cableZ(za, f, S.len, S.lossy), g = RF.gamma(z, 50);
      return { f, z, g, s11: 20 * Math.log10(Math.max(1e-6, RF.C.abs(g))), vswr: RF.vswr(g) };
    }

    let lay = null;
    const st = canvas(cv, draw);
    function layout(w, H) {
      const narrow = w < 640;
      if (!narrow) {
        const lw = Math.round(w * 0.54), ph = (H - 30) / 2;
        const p1 = { x: 46, y: 30, w: lw - 60, h: ph - 50 };
        const p2 = { x: 46, y: 30 + ph, w: lw - 60, h: ph - 50 };
        const sm = Smith.fit(w - lw, H, 30); sm.cx += lw; sm.cy += 6;
        return { narrow, p1, p2, sm };
      }
      const a = H * 0.26, b = H * 0.22;
      const p1 = { x: 40, y: 26, w: w - 54, h: a - 48 };
      const p2 = { x: 40, y: 26 + a, w: w - 54, h: b - 48 };
      const sm = Smith.fit(w, H - a - b, 26); sm.cy += a + b;
      return { narrow, p1, p2, sm };
    }
    const fx = (p, f) => p.x + ((f - FA) / (FB - FA)) * p.w;

    function plot(ctx, p, key, ymin, ymax, ny, color, title, unitFmt, markerVal) {
      ctx.save();
      ctx.fillStyle = rgba(C.deep, 0.55); ctx.fillRect(p.x, p.y, p.w, p.h);
      V.graticule(ctx, p.x, p.y, p.w, p.h, 10, ny, { center: false });
      for (let j = 0; j <= ny; j++) {
        const v = ymax - ((ymax - ymin) * j) / ny;
        V.text(ctx, num(v, 0), p.x - 5, p.y + (p.h * j) / ny + 4, { size: 10, font: "num", align: "right", color: C.muted });
      }
      // iz
      ctx.beginPath();
      ctx.rect(p.x, p.y - 2, p.w, p.h + 4); ctx.clip();
      const arr = sweep.map((s) => clamp(s[key], ymin - 1, ymax + 1));
      V.trace(ctx, arr, p.x, p.y, p.w, p.h, ymin, ymax, color, 2, { glow: 8 });
      ctx.restore();
      V.text(ctx, title, p.x + 2, p.y - 9, { size: 11, font: "num", color, weight: 600 });
      V.text(ctx, "1: " + hz(S.fm, 3) + "  " + unitFmt(markerVal), p.x + p.w, p.y - 9, { size: 11, font: "num", align: "right", color: C.copper });
      // frekans ekseni
      V.text(ctx, hz(FA, 0), p.x, p.y + p.h + 13, { size: 9.5, font: "num", color: C.muted });
      V.text(ctx, hz(FB, 0), p.x + p.w, p.y + p.h + 13, { size: 9.5, font: "num", color: C.muted, align: "right" });
      V.text(ctx, hz((FA + FB) / 2, 0), p.x + p.w / 2, p.y + p.h + 13, { size: 9.5, font: "num", color: C.muted, align: "center" });
      // imleç
      const mx = fx(p, S.fm), my = p.y + p.h - ((clamp(markerVal, ymin, ymax) - ymin) / (ymax - ymin)) * p.h;
      ctx.save();
      ctx.strokeStyle = rgba(C.copper, 0.6); ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(mx + 0.5, p.y); ctx.lineTo(mx + 0.5, p.y + p.h); ctx.stroke();
      ctx.setLineDash([]); ctx.fillStyle = C.copper;
      ctx.beginPath(); ctx.moveTo(mx, my - 2); ctx.lineTo(mx - 6, my - 12); ctx.lineTo(mx + 6, my - 12); ctx.closePath(); ctx.fill();
      V.text(ctx, "1", mx, my - 15, { size: 10, font: "num", align: "center", color: C.copper, weight: 700 });
      ctx.restore();
    }

    function draw() {
      const { ctx, w, h: H } = st;
      if (!w || !sweep.length) return;
      ctx.clearRect(0, 0, w, H);
      lay = layout(w, H);
      const m = at(S.fm);
      plot(ctx, lay.p1, "s11", -30, 0, 6, C.ref, "S11 LOGMAG 5 dB/", (v) => db(v, 2), m.s11);
      plot(ctx, lay.p2, "vswr", 1, 6, 5, C.tot, "S11 SWR 1/", (v) => (isFinite(v) ? num(v, 2) : "∞"), m.vswr);
      // Smith
      const g = lay.sm;
      Smith.draw(ctx, g, { labels: true, faint: true });
      if (S.len > 0) Smith.path(ctx, g, bare, rgba(C.ink2, 0.45), 1.4, [4, 4]);
      Smith.vswrCircle(ctx, g, RF.C.abs(m.g));
      Smith.path(ctx, g, sweep.map((s) => RF.C.scale(s.z, 1 / 50)), C.ref, 2.2);
      Smith.point(ctx, g, RF.C.scale(m.z, 1 / 50), C.copper, "1", 5.5);
      V.text(ctx, S.len > 0 ? "S11 SMITH · " + num(S.len, 2) + " m RG-58" : "S11 SMITH", g.cx - g.R, g.cy - g.R - 8, { size: 11, font: "num", color: C.ref, weight: 600 });
      if (S.len > 0) V.text(ctx, "kesikli: kablosuz anten", g.cx + g.R, g.cy + g.R + 18, { size: 10.5, color: C.muted, align: "right" });
      V.text(ctx, "yaklaşık model: seri RLC dipol", lay.narrow ? 10 : g.cx - g.R, lay.narrow ? H - 8 : g.cy + g.R + 18, { size: 10.5, color: C.copper });
      V.corners(ctx, 6, 6, w - 12, H - 12);
    }
    function pick(x, y) {
      if (!lay) return;
      for (const p of [lay.p1, lay.p2]) {
        if (x >= p.x - 10 && x <= p.x + p.w + 10 && y >= p.y - 20 && y <= p.y + p.h + 20) {
          S.fm = clamp(FA + ((x - p.x) / p.w) * (FB - FA), FA, FB); update(); return;
        }
      }
      const g = lay.sm;
      if (Math.hypot(x - g.cx, y - g.cy) <= g.R * 1.05) {
        let best = 0, bd = Infinity;
        sweep.forEach((s, i) => { const [px, py] = Smith.toXY(RF.C.scale(s.z, 1 / 50), g); const d = (px - x) ** 2 + (py - y) ** 2; if (d < bd) { bd = d; best = i; } });
        S.fm = sweep[best].f; update();
      }
    }
    L.pointer(cv, { down: pick, move: pick });
    cv.style.cursor = "crosshair";
    update();
    return { enter() { st.fit(); draw(); }, leave() {} };
  };

  /* =====================================================================
     3. Pratik hatalar
     ===================================================================== */
  // Yan yana iki yarım dalga dipolün karşılıklı empedansı rf.js'te (Balanis 8-68, testli)
  const mutualZ = RF.mutualZ;
  const Z11 = mutualZ(1e-4); // ince telin öz empedansı (≈ 73,1 + j42,5 Ω)

  Demos.ch7Pitfalls = function (stage) {
    const S = { mode: "lossy", l75: 0.43, lenL: 30, vswrL: 3, fL: 145e6, h: 0.15, cut: 0.98 };
    const F = 145e6;
    const cv = h("canvas", { "aria-label": "Pratik hata senaryosu: seçilen hatanın canlı hesabı ve görseli" });
    const fill = h("div.fill.ch7-fill.ch7-tall", cv);
    const modeSeg = seg([["coax75", "75 Ω ↔ 50 Ω"], ["lossy", "Uzun, kayıplı kablo"], ["metal", "Metal yüzeye yakın"], ["length", "Yanlış boy"]], S.mode, (k) => { S.mode = k; sync(); update(); }, "Hata senaryosu");
    const top = h("div.controls.top.ch7-top", modeSeg);

    const lam75 = RF.wavelength(F, RF.CABLES["RG-6"].vf);
    const p75 = h("div.ch7-pane",
      slider({ label: "75 Ω kablo uzunluğu", min: 0, max: 3, step: 0.01, value: S.l75, fmt: (v) => num(v, 2) + " m", oninput: (v) => { S.l75 = v; update(); } }));
    const pLossy = h("div.ch7-pane",
      slider({ label: "Kablo uzunluğu", min: 0, max: 100, step: 1, value: S.lenL, fmt: (v) => num(v, 0) + " m RG-58", oninput: (v) => { S.lenL = v; update(); } }),
      slider({ label: "Antendeki VSWR", min: 1, max: 20, value: S.vswrL, log: true, fmt: (v) => num(v, 2), cls: "c-tot", oninput: (v) => { S.vswrL = v; update(); } }),
      seg([[14e6, "14 MHz"], [145e6, "145 MHz"], [435e6, "435 MHz"]], S.fL, (k) => { S.fL = k; update(); }, "Frekans"));
    const pMetal = h("div.ch7-pane",
      slider({ label: "Metal düzleme uzaklık", min: 0.02, max: 1, step: 0.005, value: S.h, fmt: (v) => num(v, 3) + " λ · " + meters(v * RF.wavelength(F)), oninput: (v) => { S.h = v; update(); } }));
    const pLen = h("div.ch7-pane",
      slider({ label: "Kesilen boy", min: 0.85, max: 1.15, step: 0.005, value: S.cut, fmt: (v) => meters(v), oninput: (v) => { S.cut = v; update(); } }));
    const panes = { coax75: p75, lossy: pLossy, metal: pMetal, length: pLen };
    const ro = [readout("a"), readout("b"), readout("c"), readout("d")];
    const ctrl = h("div.controls", p75, pLossy, pMetal, pLen, h("div.readouts", ...ro));
    stage.append(top, fill, ctrl);
    function sync() { for (const [k, p] of Object.entries(panes)) show(p, k === S.mode); }
    const setRo = (list) => ro.forEach((r, i) => { const it = list[i]; show(r, !!it); if (it) { r.querySelector(".k").textContent = it[0]; r.set(it[1], it[2] || ""); } });

    let R = null;
    const st = canvas(cv, draw);
    function update() {
      if (S.mode === "coax75") {
        const z = RF.zinWl(50, 75, S.l75 / lam75), g = RF.gamma(z, 50);
        R = { z, vswr: RF.vswr(g) };
        setRo([["Telsizin gördüğü Z", ohm(z)], ["VSWR (telsizde)", num(R.vswr, 2), "c-tot"], ["Kabloda λ/4", meters(lam75 / 4)], ["Kablo / λ", num(S.l75 / lam75, 3)]]);
      } else if (S.mode === "lossy") {
        const lossDb = cableDbPerM("RG-58", S.fL) * S.lenL, A = Math.pow(10, -lossDb / 10);
        const gL = RF.gammaFromVswr(S.vswrL), gIn = gL * Math.sqrt(A) * Math.sqrt(A); // genlik: tek yön √A, gidiş-dönüş A
        const delivered = A * (1 - gL * gL), back = A * A * gL * gL, heat = 1 - delivered - back;
        R = { lossDb, A, gL, gIn, delivered, back, heat, vin: RF.vswr(gIn) };
        setRo([["Kablo kaybı (tek yön)", db(lossDb, 1)], ["Vericide görülen VSWR", num(R.vin, 2), "c-tot"], ["Antene ulaşan güç", "%" + num(delivered * 100, 0), "c-fwd"], ["Kabloda ısı", "%" + num(heat * 100, 0)]]);
      } else if (S.mode === "metal") {
        const z = RF.C.sub(RF.C.sub(Z11, mutualZ(2 * S.h)), RF.cx(0, Z11.im)); // serbest uzayda rezonansa kısaltılmış dipol
        const g = RF.gamma(z, 50);
        let best = 0, pk = -1;
        for (let a = 0; a <= 90; a += 0.5) { const v = Math.abs(Math.sin(2 * Math.PI * S.h * Math.sin((a * Math.PI) / 180))); if (v > pk + 1e-9) { pk = v; best = a; } }
        R = { z, vswr: RF.vswr(g), best };
        setRo([["Besleme empedansı", ohm(z)], ["VSWR (50 Ω)", isFinite(R.vswr) ? num(R.vswr, 2) : "∞", "c-tot"], ["Düzleme uzaklık", meters(S.h * RF.wavelength(F))], ["Ana hüzme yükselişi", num(best, 0) + "°"]]);
      } else {
        const fr = (RF.halfWaveDipoleLength(1, 0.95)) / S.cut; // L = 0,95·c/(2f) → f = 0,95·c/(2L)
        const fr1 = RF.halfWaveDipoleLength(1, 0.95) / (S.cut + 0.01);
        const g = RF.gamma(dipoleZ(F, fr, 10), 50);
        R = { fr, vswr: RF.vswr(g), target: RF.halfWaveDipoleLength(F, 0.95) };
        setRo([["Rezonans", hz(fr, 2)], ["Kayma", sgn((fr - F) / 1e6, 2) + " MHz"], ["145 MHz'de VSWR", num(R.vswr, 2), "c-tot"], ["1 cm uzatınca", sgn((fr1 - fr) / 1e6, 2) + " MHz"]]);
      }
      draw();
    }

    function draw() {
      const { ctx, w, h: H } = st;
      if (!w || !R) return;
      ctx.clearRect(0, 0, w, H);
      ({ coax75: draw75, lossy: drawLossy, metal: drawMetal, length: drawLen })[S.mode](ctx, w, H);
      V.corners(ctx, 6, 6, w - 12, H - 12);
    }
    // kutu çizimi (telsiz / anten blokları)
    function box(ctx, x, y, bw, bh, label, sub) {
      ctx.save(); ctx.fillStyle = C.panel; ctx.strokeStyle = C.line2; ctx.lineWidth = 1;
      ctx.fillRect(x, y, bw, bh); ctx.strokeRect(x + 0.5, y + 0.5, bw, bh); ctx.restore();
      V.text(ctx, label, x + bw / 2, y + bh / 2 - (sub ? 2 : -4), { size: 12, align: "center", color: C.ink, weight: 600 });
      if (sub) V.text(ctx, sub, x + bw / 2, y + bh / 2 + 13, { size: 11, align: "center", color: C.ink2, font: "num" });
    }
    function cableLine(ctx, xa, xb, y, color, lw = 6) {
      ctx.save(); ctx.lineCap = "round";
      ctx.strokeStyle = C.deep; ctx.lineWidth = lw + 4; ctx.beginPath(); ctx.moveTo(xa, y); ctx.lineTo(xb, y); ctx.stroke();
      ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(xa, y); ctx.lineTo(xb, y); ctx.stroke();
      ctx.strokeStyle = rgba("#ffffff", 0.18); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(xa, y - lw / 4); ctx.lineTo(xb, y - lw / 4); ctx.stroke();
      ctx.restore();
    }
    function frame(ctx, p, xmin, xmax, ymin, ymax, nx, ny, xf, yf) {
      ctx.save(); ctx.fillStyle = rgba(C.deep, 0.5); ctx.fillRect(p.x, p.y, p.w, p.h); ctx.restore();
      V.graticule(ctx, p.x, p.y, p.w, p.h, nx, ny, { center: false });
      for (let j = 0; j <= ny; j++) V.text(ctx, yf(ymax - ((ymax - ymin) * j) / ny), p.x - 5, p.y + (p.h * j) / ny + 4, { size: 10, font: "num", align: "right", color: C.muted });
      for (let i = 0; i <= nx; i += nx / 2) V.text(ctx, xf(xmin + ((xmax - xmin) * i) / nx), p.x + (p.w * i) / nx, p.y + p.h + 14, { size: 10, font: "num", align: i === 0 ? "left" : i === nx ? "right" : "center", color: C.muted });
    }
    const marker = (ctx, x, y, col = C.copper) => { ctx.save(); ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(x, y, 5.5, 0, Math.PI * 2); ctx.fill(); ctx.restore(); };

    function draw75(ctx, w, H) {
      const pad = w < 520 ? 14 : 30, bw = w < 520 ? 74 : 104, top = 34;
      box(ctx, pad, top, bw, 50, "Telsiz", "50 Ω");
      box(ctx, w - pad - bw, top, bw, 50, "Anten", "50 Ω");
      const xa = pad + bw, xb = w - pad - bw;
      cableLine(ctx, xa, xb, top + 25, "#6c7f8f", 7);
      V.text(ctx, "75 Ω TV kablosu (RG-6)", (xa + xb) / 2, top + 10, { size: 12, align: "center", color: C.ink2, weight: 600 });
      V.dimension(ctx, xa, top + 72, xb, top + 72, meters(S.l75) + " = " + num(S.l75 / lam75, 3) + " λ");
      // VSWR – uzunluk eğrisi
      const p = { x: 48, y: top + 120, w: w - 48 - pad, h: H - top - 160 };
      frame(ctx, p, 0, 3, 1, 2.5, 10, 6, (v) => num(v, 1) + " m", (v) => num(v, 2));
      V.text(ctx, "Telsizde görülen VSWR, 75 Ω kablonun boyuna göre (145 MHz)", p.x, p.y - 10, { size: 12, color: C.tot, weight: 600 });
      V.fn(ctx, (l) => RF.vswr(RF.gamma(RF.zinWl(50, 75, l / lam75), 50)), 0, 3, p.x, p.y, p.w, p.h, 1, 2.5, C.tot, 2, { glow: 6 });
      // doğrudan 75 Ω yükün VSWR'si (başvuru)
      const v15 = RF.vswr(RF.gamma(75, 50)), yy = p.y + p.h - ((v15 - 1) / 1.5) * p.h;
      ctx.save(); ctx.setLineDash([4, 4]); ctx.strokeStyle = rgba(C.ink2, 0.5); ctx.beginPath(); ctx.moveTo(p.x, yy); ctx.lineTo(p.x + p.w, yy); ctx.stroke(); ctx.restore();
      V.text(ctx, "75 Ω'luk yük doğrudan: " + num(v15, 2), p.x + p.w - 4, yy - 6, { size: 10.5, align: "right", color: C.ink2 });
      marker(ctx, p.x + (S.l75 / 3) * p.w, p.y + p.h - ((R.vswr - 1) / 1.5) * p.h);
    }

    function drawLossy(ctx, w, H) {
      const narrow = w < 520, pad = narrow ? 14 : 30, bw = narrow ? 66 : 96, top = 30;
      box(ctx, pad, top, bw, 56, "Verici", "VSWR " + num(R.vin, 2));
      box(ctx, w - pad - bw, top, bw, 56, "Anten", "VSWR " + num(S.vswrL, 2));
      const xa = pad + bw + 4, xb = w - pad - bw - 4, yc = top + 28;
      cableLine(ctx, xa, xb, yc, "#4a5d6e", 8);
      // ileri dalga (sarı) ve yansıyan dalga (camgöbeği) okları: kalınlık güçle orantılı
      const n = narrow ? 4 : 6;
      for (let i = 0; i < n; i++) {
        const u0 = i / n, u1 = (i + 0.8) / n;
        const pf = Math.pow(R.A, (u0 + u1) / 2);
        V.arrow(ctx, xa + (xb - xa) * u0, yc - 26, xa + (xb - xa) * u1, yc - 26, rgba(C.fwd, 0.35 + 0.65 * pf), 1 + 6 * pf, 7 + 5 * pf);
        const pr = R.A * R.gL * R.gL * Math.pow(R.A, 1 - (u0 + u1) / 2);
        if (pr > 0.004) V.arrow(ctx, xa + (xb - xa) * u1, yc + 26, xa + (xb - xa) * u0, yc + 26, rgba(C.ref, 0.35 + 0.65 * Math.sqrt(pr)), 1 + 6 * Math.sqrt(pr), 7 + 5 * Math.sqrt(pr));
      }
      V.text(ctx, "ileri dalga", xa, yc - 40, { size: 11, color: C.fwd, weight: 600 });
      V.text(ctx, "yansıyan dalga", xb, yc + 50, { size: 11, color: C.ref, weight: 600, align: "right" });
      V.text(ctx, num(S.lenL, 0) + " m RG-58 · " + hz(S.fL, 0) + " · " + db(R.lossDb, 1) + " tek yön", (xa + xb) / 2, yc + 66, { size: 11.5, align: "center", color: C.ink2, font: "num" });
      // güç dağılımı çubuğu
      const by = top + 120, bh = 30, bx = pad, bW = w - 2 * pad;
      V.text(ctx, "Vericinin gönderdiği güç nereye gidiyor?", bx, by - 10, { size: 12.5, color: C.ink, weight: 600 });
      const parts = [[R.delivered, C.fwd, "antenden ışır"], [R.heat, "#8a6a52", "kabloda ısı"], [R.back, C.ref, "vericiye döner"]];
      let x = bx;
      for (const [v, col] of parts) { const ww = bW * Math.max(0, v); ctx.fillStyle = col; ctx.fillRect(x, by, ww, bh); x += ww; }
      ctx.strokeStyle = C.line2; ctx.strokeRect(bx + 0.5, by + 0.5, bW, bh);
      parts.forEach(([v, col, lab], i) => V.text(ctx, "■ " + lab + " %" + num(v * 100, 0), bx + (narrow ? 0 : i * (bW / 3)), by + bh + 18 + (narrow ? i * 16 : 0), { size: 11.5, color: col === "#8a6a52" ? C.R : col, font: "num" }));
      // VSWR karşılaştırma: kablo uzunluğuna göre giriş VSWR'si
      const p = { x: 48, y: by + (narrow ? 110 : 80), w: w - 48 - pad, h: H - by - (narrow ? 140 : 110) };
      if (p.h < 60) return;
      const vmax = Math.max(2, Math.min(20, Math.ceil(S.vswrL)));
      frame(ctx, p, 0, 100, 1, vmax, 10, 4, (v) => num(v, 0) + " m", (v) => num(v, 1));
      V.text(ctx, "Vericide görülen VSWR, kablo uzadıkça", p.x, p.y - 10, { size: 12, color: C.tot, weight: 600 });
      const dbm1 = cableDbPerM("RG-58", S.fL);
      V.fn(ctx, (l) => RF.vswr(R.gL * Math.pow(10, (-dbm1 * l) / 10)), 0, 100, p.x, p.y, p.w, p.h, 1, vmax, C.tot, 2, { glow: 6 });
      marker(ctx, p.x + (S.lenL / 100) * p.w, p.y + p.h - ((Math.min(R.vin, vmax) - 1) / (vmax - 1)) * p.h);
    }

    function drawMetal(ctx, w, H) {
      const narrow = w < 560;
      // sol: yandan görünüş (dipol, düzlem, ayna görüntüsü)
      const sw = narrow ? w : w * 0.42, sh = narrow ? H * 0.42 : H;
      const gy = sh * 0.62, lam = Math.min(sw * 0.8, sh * 0.5); // 1 λ'nın piksel karşılığı (görsel ölçek)
      const scale = Math.min(lam, (gy - 40) / Math.max(S.h, 0.3));
      const cx0 = sw / 2, dy = S.h * scale, dl = Math.min(sw * 0.36, scale * 0.25);
      ctx.save();
      ctx.strokeStyle = C.ink2; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(20, gy); ctx.lineTo(sw - 20, gy); ctx.stroke();
      ctx.strokeStyle = rgba(C.ink2, 0.35); ctx.lineWidth = 1;
      for (let x = 24; x < sw - 20; x += 10) { ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x - 8, gy + 8); ctx.stroke(); }
      ctx.restore();
      V.text(ctx, "metal yüzey", 22, gy + 24, { size: 11, color: C.ink2 });
      // dipol
      ctx.save(); ctx.lineCap = "round"; ctx.strokeStyle = C.copper; ctx.lineWidth = 4; ctx.shadowColor = C.copper; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.moveTo(cx0 - dl, gy - dy); ctx.lineTo(cx0 - 3, gy - dy); ctx.moveTo(cx0 + 3, gy - dy); ctx.lineTo(cx0 + dl, gy - dy); ctx.stroke();
      ctx.restore();
      // ayna görüntüsü (ters akım), kesikli
      if (gy + dy < sh - 6) {
        ctx.save(); ctx.setLineDash([5, 4]); ctx.strokeStyle = rgba(C.copper, 0.5); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(cx0 - dl, gy + dy); ctx.lineTo(cx0 + dl, gy + dy); ctx.stroke(); ctx.restore();
        V.text(ctx, "ayna görüntüsü (ters akım)", cx0, Math.min(sh - 8, gy + dy + 16), { size: 10.5, align: "center", color: rgba(C.copper, 0.8) });
      }
      if (dy > 18) V.dimension(ctx, cx0 + dl + 16, gy - dy, cx0 + dl + 16, gy, "h = " + num(S.h, 2) + " λ", { size: 11 });
      // sağ: yükseliş açısı deseni (dipole dik düzlemde), yarım kutupsal
      const px = narrow ? w / 2 : sw + (w - sw) / 2, py = narrow ? H - 30 : H * 0.7;
      const PR = narrow ? Math.min(w * 0.42, H * 0.46) : Math.min((w - sw) * 0.44, H * 0.58);
      ctx.save();
      ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
      for (const rr of [0.25, 0.5, 0.75, 1]) { ctx.beginPath(); ctx.arc(px, py, PR * rr, Math.PI, 0); ctx.stroke(); }
      for (let a = 0; a <= 180; a += 30) { const t = (a * Math.PI) / 180; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + PR * Math.cos(t), py - PR * Math.sin(t)); ctx.stroke(); }
      ctx.strokeStyle = C.ink2; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(px - PR - 8, py); ctx.lineTo(px + PR + 8, py); ctx.stroke();
      // serbest uzay (düzlemsiz): bu düzlemde her yöne eşit, başvuru dairesi
      ctx.setLineDash([4, 4]); ctx.strokeStyle = rgba(C.ink2, 0.45); ctx.beginPath(); ctx.arc(px, py, PR * 0.5, Math.PI, 0); ctx.stroke(); ctx.setLineDash([]);
      // dizi faktörü |sin(kh sinψ)|; düzlemsiz dipolün alanına göre 0..2 (ölçek: 2 → PR)
      ctx.beginPath();
      for (let i = 0; i <= 180; i++) {
        const t = (i * Math.PI) / 180, af = Math.abs(2 * Math.sin(2 * Math.PI * S.h * Math.sin(t)));
        const r = (af / 2) * PR, x = px + r * Math.cos(t), y = py - r * Math.sin(t);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.closePath(); ctx.fillStyle = rgba(C.E, 0.14); ctx.fill();
      ctx.strokeStyle = C.E; ctx.lineWidth = 2.2; ctx.shadowColor = C.E; ctx.shadowBlur = 8; ctx.stroke();
      ctx.restore();
      V.text(ctx, "Işıma deseni (yukarı yarım düzlem, alan genliği)", px, py - PR - 14, { size: 11.5, align: "center", color: C.ink, weight: 600 });
      V.text(ctx, "kesikli: metal yokken", px + PR, py + 16, { size: 10.5, align: "right", color: C.muted });
      V.text(ctx, "yaklaşık model: sonsuz iletken düzlem", narrow ? 12 : sw + 12, 22, { size: 10.5, color: C.copper });
    }

    function drawLen(ctx, w, H) {
      const narrow = w < 520, pad = narrow ? 16 : 40, top = 50;
      const maxL = 1.15, span = w - 2 * pad - 40, ppm = span / maxL;
      const L0 = S.cut * ppm, cx0 = w / 2, y = top + 20;
      ctx.save(); ctx.lineCap = "round"; ctx.strokeStyle = C.copper; ctx.lineWidth = 5; ctx.shadowColor = C.copper; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.moveTo(cx0 - L0 / 2, y); ctx.lineTo(cx0 - 4, y); ctx.moveTo(cx0 + 4, y); ctx.lineTo(cx0 + L0 / 2, y); ctx.stroke(); ctx.restore();
      ctx.fillStyle = C.fwd; ctx.beginPath(); ctx.arc(cx0, y, 3, 0, Math.PI * 2); ctx.fill();
      // hedef boy (145 MHz için), kesikli
      const Lt = R.target * ppm;
      ctx.save(); ctx.setLineDash([3, 4]); ctx.strokeStyle = rgba(C.ink2, 0.6);
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx0 + (s * Lt) / 2, y - 16); ctx.lineTo(cx0 + (s * Lt) / 2, y + 16); ctx.stroke(); }
      ctx.restore();
      V.text(ctx, "145 MHz için doğru boy: " + meters(R.target), cx0, y - 24, { size: 11.5, align: "center", color: C.ink2 });
      V.dimension(ctx, cx0 - L0 / 2, y + 30, cx0 + L0 / 2, y + 30, "kesilen: " + meters(S.cut));
      // VSWR – frekans
      const p = { x: 48, y: top + 110, w: w - 48 - pad / 2 - 8, h: H - top - 150 };
      frame(ctx, p, 130e6, 160e6, 1, 6, 10, 5, (v) => hz(v, 0), (v) => num(v, 0));
      V.text(ctx, "VSWR, frekansa göre", p.x, p.y - 10, { size: 12, color: C.tot, weight: 600 });
      ctx.save(); ctx.beginPath(); ctx.rect(p.x, p.y, p.w, p.h); ctx.clip();
      V.fn(ctx, (f) => Math.min(7, RF.vswr(RF.gamma(dipoleZ(f, R.fr, 10), 50))), 130e6, 160e6, p.x, p.y, p.w, p.h, 1, 6, C.tot, 2, { glow: 6 });
      ctx.restore();
      const X = (f) => p.x + ((f - 130e6) / 30e6) * p.w;
      ctx.save(); ctx.setLineDash([5, 4]); ctx.strokeStyle = rgba(C.copper, 0.8);
      ctx.beginPath(); ctx.moveTo(X(F), p.y); ctx.lineTo(X(F), p.y + p.h); ctx.stroke(); ctx.restore();
      V.text(ctx, "hedef 145 MHz", X(F) + 5, p.y + 14, { size: 11, color: C.copper });
      if (R.fr > 130e6 && R.fr < 160e6) V.text(ctx, "rezonans " + hz(R.fr, 1), X(R.fr), p.y + p.h - 8, { size: 11, align: "center", color: C.tot });
      marker(ctx, X(F), p.y + p.h - ((Math.min(R.vswr, 6) - 1) / 5) * p.h);
      V.text(ctx, "yaklaşık model: seri RLC dipol, Q = 10", p.x + p.w, p.y - 10, { size: 10.5, align: "right", color: C.copper });
    }

    sync(); update();
    return { enter() { st.fit(); draw(); }, leave() {} };
  };

  /* =====================================================================
     4. Güvenlik: ICNIRP 2020 genel halk referans seviyeleri, güvenli mesafe; uç gerilimi
     ===================================================================== */
  // ICNIRP 2020 genel halk güç yoğunluğu sınırı rf.js'te (Tablo 5, testli)
  const icnirpPublicS = RF.icnirpPublicDensity;
  const EFHW_Z = 50 * 49; // 49:1 dönüştürücüyle beslenen uçtan beslemeli yarım dalga: ≈ 2,45 kΩ

  Demos.ch7Safety = function (stage) {
    const S = { P: 50, G: 6, f: 145e6, duty: 50 };
    const cv = h("canvas", { "aria-label": "Uzak alan güç yoğunluğu mesafeyle; ICNIRP genel halk sınırı ve yaklaşık güvenli mesafe" });
    const fill = h("div.fill.ch7-fill", cv);
    const rLim = readout("ICNIRP sınırı"), rD = readout("Yaklaşık güvenli mesafe", "c-cu"), rNF = readout("Yakın alan (λ/2π)"), rV1 = readout("Dipol beslemesi (73 Ω)", "c-e"), rV2 = readout("Uçtan besleme (≈ 2,45 kΩ)", "c-e");
    const ctrl = h("div.controls.ch7-grid",
      slider({ label: "Verici gücü", min: 0.1, max: 1000, value: S.P, log: true, fmt: watt, oninput: (v) => { S.P = v; update(); } }),
      slider({ label: "Anten kazancı", min: -3, max: 20, step: 0.5, value: S.G, fmt: (v) => num(v, 1) + " dBi", oninput: (v) => { S.G = v; update(); } }),
      slider({ label: "Frekans", min: 30.5e6, max: 6e9, value: S.f, log: true, fmt: (v) => hz(v), oninput: (v) => { S.f = v; update(); } }),
      slider({ label: "Gönderme oranı", min: 5, max: 100, step: 5, value: S.duty, fmt: (v) => "%" + num(v, 0), oninput: (v) => { S.duty = v; update(); } }),
      h("div.readouts.ch7-span", rLim, rD, rNF, rV1, rV2));
    stage.append(fill, ctrl);

    let R = null;
    function update() {
      const Slim = icnirpPublicS(S.f), Peff = S.P * (S.duty / 100), gl = RF.fromDB(S.G);
      const r = Math.sqrt((Peff * gl) / (4 * Math.PI * Slim));
      const nf = RF.reactiveNearField(S.f);
      // gerilim mertebesi: V = √(P·Z) (rms), tepe = √2 · rms
      const v1 = Math.sqrt(S.P * 73), v2 = Math.sqrt(S.P * EFHW_Z);
      R = { Slim, Peff, gl, r, nf, v1, v2 };
      rLim.set(sig(Slim, 3) + " W/m²");
      rD.set("≈ " + meters(r));
      rNF.set(meters(nf), r < nf ? "bad" : "");
      rV1.set(num(v1, 0) + " V rms");
      rV2.set(num(v2, 0) + " V rms · " + num(v2 * Math.SQRT2, 0) + " V tepe");
      draw();
    }
    const st = canvas(cv, draw);
    function draw() {
      const { ctx, w, h: H } = st;
      if (!w || !R) return;
      ctx.clearRect(0, 0, w, H);
      const narrow = w < 520;
      const p = { x: narrow ? 52 : 70, y: 40, w: w - (narrow ? 64 : 96), h: H - (narrow ? 120 : 110) };
      // güzel eksen: 1-2-5 adımlarıyla, güvenli mesafenin ~3 katı
      const raw = Math.max(0.3, R.r * 3) / 6, e10 = Math.pow(10, Math.floor(Math.log10(raw)));
      const stp = [1, 2, 5, 10].map((k) => k * e10).find((v) => v >= raw), rmax = stp * 6;
      // y: log10 güç yoğunluğu, sınırın 2 kat altı ve 3 kat üstü onluk
      const lgL = Math.log10(R.Slim), ylo = Math.floor(lgL) - 2, yhi = Math.floor(lgL) + 3;
      const X = (r) => p.x + (r / rmax) * p.w, Y = (s) => p.y + p.h - ((Math.log10(s) - ylo) / (yhi - ylo)) * p.h;
      ctx.save(); ctx.fillStyle = rgba(C.deep, 0.5); ctx.fillRect(p.x, p.y, p.w, p.h); ctx.restore();
      // ızgara: y onluklar
      for (let e = ylo; e <= yhi; e++) {
        const yy = Math.round(Y(Math.pow(10, e))) + 0.5;
        ctx.strokeStyle = C.grid; ctx.beginPath(); ctx.moveTo(p.x, yy); ctx.lineTo(p.x + p.w, yy); ctx.stroke();
        V.text(ctx, sig(Math.pow(10, e), 1), p.x - 6, yy + 4, { size: 10, font: "num", align: "right", color: C.muted });
      }
      V.text(ctx, "W/m²", p.x - 6, p.y - 12, { size: 10.5, font: "num", align: "right", color: C.ink2 });
      for (let i = 0; i <= 6; i++) {
        const xx = Math.round(p.x + (p.w * i) / 6) + 0.5;
        ctx.strokeStyle = C.grid; ctx.beginPath(); ctx.moveTo(xx, p.y); ctx.lineTo(xx, p.y + p.h); ctx.stroke();
        if (!narrow || i % 2 === 0) V.text(ctx, i ? meters(stp * i) : "0", xx, p.y + p.h + 14, { size: 10, font: "num", align: "center", color: C.muted });
      }
      V.text(ctx, "antenden uzaklık", p.x + p.w, p.y + p.h + 30, { size: 11, align: "right", color: C.ink2 });
      // yakın alan bölgesi
      if (R.nf > 0) {
        const xn = Math.min(X(R.nf), p.x + p.w);
        ctx.save(); ctx.fillStyle = rgba(C.ink2, 0.08); ctx.fillRect(p.x, p.y, xn - p.x, p.h);
        ctx.beginPath(); ctx.rect(p.x, p.y, xn - p.x, p.h); ctx.clip();
        ctx.strokeStyle = rgba(C.ink2, 0.16);
        for (let k = -p.h; k < xn - p.x; k += 9) { ctx.beginPath(); ctx.moveTo(p.x + k, p.y + p.h); ctx.lineTo(p.x + k + p.h, p.y); ctx.stroke(); }
        ctx.restore();
        if (xn - p.x > 70) V.text(ctx, "yakın alan: formül geçersiz", p.x + 6, p.y + p.h - 8, { size: 10.5, color: C.ink2 });
      }
      // aşım bölgesi (sınırın üstü, güvenli mesafenin içi)
      const xr = X(R.r), yl = Y(R.Slim);
      ctx.fillStyle = rgba(C.bad, 0.08); ctx.fillRect(p.x, p.y, xr - p.x, yl - p.y);
      // sınır çizgisi
      ctx.save(); ctx.setLineDash([6, 5]); ctx.strokeStyle = rgba(C.bad, 0.9); ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(p.x, yl); ctx.lineTo(p.x + p.w, yl); ctx.stroke(); ctx.restore();
      V.text(ctx, "ICNIRP 2020 genel halk sınırı: " + sig(R.Slim, 3) + " W/m²", p.x + p.w - 4, yl - 7, { size: narrow ? 10 : 11.5, align: "right", color: C.bad, weight: 600 });
      // güç yoğunluğu eğrisi S(r) = P·G/(4πr²)
      ctx.save(); ctx.beginPath(); ctx.rect(p.x, p.y, p.w, p.h); ctx.clip();
      ctx.strokeStyle = C.fwd; ctx.lineWidth = 2.4; ctx.shadowColor = C.fwd; ctx.shadowBlur = 8;
      ctx.beginPath();
      for (let i = 1; i <= 300; i++) {
        const r = (rmax * i) / 300, s = RF.powerDensity(R.Peff, R.gl, r);
        const yy = Math.max(p.y - 50, Y(s)); i > 1 ? ctx.lineTo(X(r), yy) : ctx.moveTo(X(r), yy);
      }
      ctx.stroke(); ctx.restore();
      V.text(ctx, "güç yoğunluğu (uzak alan, zaman ortalaması)", p.x + p.w - 8, p.y + 18, { size: 11.5, color: C.fwd, weight: 600, align: "right" });
      // kesişme noktası + ölçü çizgisi
      ctx.save(); ctx.fillStyle = C.copper; ctx.shadowColor = C.copper; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(xr, yl, 5.5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      ctx.save(); ctx.strokeStyle = rgba(C.copper, 0.5); ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(xr, yl); ctx.lineTo(xr, p.y + p.h); ctx.stroke(); ctx.restore();
      if (xr - p.x > 40) V.dimension(ctx, p.x, p.y + p.h - 22, xr, p.y + p.h - 22, "≈ " + meters(R.r), { color: C.copper, size: 11.5 });
      // anten simgesi
      ctx.save(); ctx.strokeStyle = C.copper; ctx.lineWidth = 3; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(p.x, p.y + p.h); ctx.lineTo(p.x, p.y + p.h - 26); ctx.stroke(); ctx.restore();
      V.text(ctx, "yaklaşık, uzak alan varsayımı; resmî değerlendirme yerine geçmez", p.x, H - 10, { size: narrow ? 9.5 : 11, color: C.copper });
      V.corners(ctx, 6, 6, w - 12, H - 12);
    }
    update();
    return { enter() { st.fit(); draw(); }, leave() {} };
  };

  /* ---------- sözlük ---------- */
  window.GLOSSARY_EXTRA = (window.GLOSSARY_EXTRA || []).concat([
    { k: ["marj"], t: "Bağlantı marjı", d: "Alıcıya ulaşan sinyal ile alıcının duyabildiği en zayıf sinyal (hassasiyet) arasındaki fark, dB cinsinden. Sönümlenme, yağmur ve engellere karşı güvenlik payıdır.", u: "https://en.wikipedia.org/wiki/Link_margin" },
    { k: ["kalibrasyon"], t: "Kalibrasyon (VNA)", d: "Ölçümden önce bilinen kısa devre, açık devre ve 50 Ω yük (SOL) takılarak cihazın ve kablosunun kendi hatalarının ölçülüp hesaptan çıkarılması.", u: "https://en.wikipedia.org/wiki/Network_analyzer_(electrical)#Calibration" },
    { k: ["çağrı işaret"], t: "Çağrı işareti", d: "Her amatör telsizciye verilen benzersiz kimlik (Türkiye'de TA, YM gibi öneklerle başlar). Yayında istasyonu tanıtmak için söylenir.", u: "https://tr.wikipedia.org/wiki/%C3%87a%C4%9Fr%C4%B1_i%C5%9Fareti" },
    { k: ["görev çevrimi", "gönderme oranı"], t: "Görev çevrimi", d: "Vericinin zamanın yüzde kaçında gönderme yaptığı. Kısa menzilli cihaz kuralları (ör. %1) ve zaman ortalamalı maruziyet hesapları bunu kullanır.", u: "https://en.wikipedia.org/wiki/Duty_cycle" },
    { k: ["e.i.r.p.", "eirp"], t: "e.i.r.p.", d: "Eşdeğer izotropik ışınım gücü: verici gücü − kablo kaybı + anten kazancı (dBi). Yasal güç sınırları çoğu zaman bununla verilir.", u: "https://en.wikipedia.org/wiki/Effective_radiated_power" },
  ]);

  /* ---------- hayalet el senaryoları ---------- */
  window.GUIDE_SCENARIOS = Object.assign(window.GUIDE_SCENARIOS || {}, {
    "baglanti-butcesi": [{ click: "=Wi-Fi 2,4 GHz" }, { wait: 900 }, { slide: "label:Mesafe", to: Math.log(300) }, { wait: 700 }, { slide: "label:Mesafe", to: Math.log(900) }],
    olcum: [{ drag: "css:canvas", path: [[0.1, 0.25], [0.2, 0.25], [0.27, 0.27]] }, { wait: 600 }, { slide: "label:Kablo uzunluğu", to: 2.5 }],
    "pratik-hatalar": [{ click: "=Uzun, kayıplı kablo" }, { wait: 500 }, { slide: "label:Kablo uzunluğu", to: 90 }, { wait: 500 }, { slide: "label:Antendeki VSWR", to: Math.log(10) }],
    guvenlik: [{ slide: "label:Verici gücü", to: Math.log(400) }, { wait: 600 }, { slide: "label:Frekans", to: Math.log(1.2e9) }],
  });
})();
