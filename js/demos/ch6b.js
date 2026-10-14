/* Bölüm 6 (ikinci yarı): polarizasyon, Yagi–Uda, faz dizisi, diğer antenler.
   Ekrandaki her sayı RF.* ile (ya da burada yazılmış, kaynağı belirtilmiş yerel formüllerle) hesaplanır. */
(function () {
  const { C, FONT, rgba, h, canvas, loop, clamp, slider, seg, toggle, num, db } = L;
  const TAU = Math.PI * 2, DEG = Math.PI / 180;

  // Okuma penceresi: .readout > .k + .v
  function readout(k, cls) {
    const v = h("span.v", "—");
    const el = h("div.readout" + (cls ? "." + cls : ""), h("span.k", k), v);
    return { el, set(s) { v.textContent = s; }, cls(c) { el.className = "readout" + (c ? " " + c : ""); } };
  }
  const deg = (v, d = 0) => num(v, d) + "°";

  /* =====================================================================
     1. Polarizasyon
     Jones vektörleri (x: yatay, y: dikey; dalga +z yönünde, e^{j(ωt − kz)}).
     Sağ el (IEEE): (x̂ − jŷ)/√2; sol el: (x̂ + jŷ)/√2. Doğrusal, dikeyden a açısı: (−sin a, cos a).
     Polarizasyon uyum oranı PLF = |ê_t · ê_r*|² (doğrusal–doğrusal durumda RF.polarizationLoss(Δ) = cos²Δ ile aynı).
     ===================================================================== */
  // Jones vektörleri ve polarizasyon uyum oranı rf.js'te (testli)
  const jones = RF.jones, plf = RF.polarizationMatch;

  Demos.ch6bPol = function (stage) {
    const cv = h("canvas", { "aria-label": "İlerleyen elektromanyetik dalga: elektrik alanı vektörü ve ona dik manyetik alan; verici ve alıcı antenler" });
    const fill = h("div.fill", cv);
    const S = { tx: "v", rx: "lin", rxAng: 0, showH: true, t: 0 };
    const txAng = () => (S.tx === "h" ? 90 : 0);
    const isCirc = (k) => k === "r" || k === "l";

    const txSeg = seg([["v", "Dikey"], ["h", "Yatay"], ["r", "Sağ el"], ["l", "Sol el"]], S.tx, (k) => { S.tx = k; update(); }, "Verici polarizasyonu");
    const rxSeg = seg([["lin", "Doğrusal"], ["r", "Sağ el"], ["l", "Sol el"]], S.rx, (k) => { S.rx = k; update(); }, "Alıcı polarizasyonu");
    const angSl = slider({ label: "Alıcı açısı", min: 0, max: 180, step: 1, value: 0, fmt: (v) => deg(v), oninput: (v) => { S.rxAng = v; update(); } });
    const hTog = toggle("H alanı", true, (v) => { S.showH = v; }, "c-h");
    const rDelta = readout("Açı farkı"), rP = readout("Alınan güç", "c-e"), rL = readout("Polarizasyon kaybı", "c-e");
    const meter = h("div.meter", h("i"));
    meter.style.width = "110px";
    const ctrl = h("div.controls",
      h("span.lab", "Verici"), txSeg, h("span.lab", "Alıcı"), rxSeg, angSl, hTog,
      h("div.spacer"),
      h("div.readouts", rDelta.el, rP.el, rL.el, h("div.readout", h("span.k", "Güç çubuğu"), meter)));
    const note = h("div.float.tl.ch6b-pnote");
    fill.append(note);
    stage.append(fill, ctrl);
    const st = canvas(cv, draw);

    function update() {
      const et = jones(S.tx, txAng() * DEG), er = jones(S.rx, S.rxAng * DEG);
      const p = plf(et, er);
      angSl.style.opacity = S.rx === "lin" ? 1 : 0.4;
      angSl.input.disabled = S.rx !== "lin";
      const both = !isCirc(S.tx) && S.rx === "lin";
      if (both) {
        let d = Math.abs(S.rxAng - txAng()); if (d > 90) d = 180 - d;
        rDelta.set(deg(d));
        // doğrusal–doğrusal: rf.js'teki cos² kuralıyla aynı olmalı
        const pc = RF.polarizationLoss(d * DEG);
        if (Math.abs(pc - p) > 1e-9) console.warn("PLF tutarsız", pc, p);
      } else rDelta.set(isCirc(S.tx) && isCirc(S.rx) ? (S.tx === S.rx ? "aynı el" : "zıt el") : "—");
      rP.set(p < 1e-9 ? "0 %" : num(p * 100, p > 0.995 ? 0 : 1) + " %");
      const lossDb = -RF.dB(Math.max(p, 1e-300));
      rL.set(p < 1e-9 ? "∞ dB (kuramda)" : db(Math.abs(lossDb) < 0.05 ? 0 : lossDb, 1));
      meter.firstChild.style.width = (p * 100).toFixed(1) + "%";
      let msg = "";
      if (p < 1e-9) msg = "Kuramda hiç güç alınmaz. Pratikte sonsuz kayıp yoktur: çapraz polarizasyon, yansımalar ve hizalama hatası yüzünden ayrım çoğunlukla 20–30 dB civarında kalır.";
      else if (isCirc(S.tx) !== isCirc(S.rx)) msg = "Dairesel ↔ doğrusal: alıcı hangi açıda durursa dursun gücün yarısı (" + db(-RF.dB(p), 1) + ") kaybolur.";
      else if (p < 0.01) msg = "Güç " + db(-RF.dB(p), 1) + " düştü. Tam 90°'de kuramda sıfır.";
      note.textContent = msg;
      note.style.display = msg ? "" : "none";
    }

    // eğik izdüşüm: x (yatay, ekrana doğru içeri), y (yukarı), z (ilerleme, sağa)
    function proj(geo, x, y, z) {
      return [geo.ox + z * geo.sz + x * geo.kx, geo.oy - y * geo.sy + x * geo.ky];
    }
    function E(kind, a, psi) {
      const j = jones(kind, a); // Re{ê e^{jψ}}
      return [j[0].re * Math.cos(psi) - j[0].im * Math.sin(psi), j[1].re * Math.cos(psi) - j[1].im * Math.sin(psi)];
    }
    function antenna(ctx, geo, kind, a, z, label) {
      const [cx0, cy0] = proj(geo, 0, 0, z);
      ctx.save();
      ctx.strokeStyle = C.copper; ctx.lineCap = "round"; ctx.shadowColor = C.copper; ctx.shadowBlur = 8;
      if (isCirc(kind)) {
        // helis: z boyunca birkaç tur, el yönüne göre sarılır
        const s = kind === "r" ? 1 : -1, turns = 3, len = 0.5;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i <= 120; i++) {
          const u = i / 120, ph = u * turns * TAU;
          const [px, py] = proj(geo, 0.32 * Math.cos(ph), 0.32 * s * Math.sin(ph), z + (z < 0.5 ? -len + u * len : len - u * len));
          i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
        ctx.stroke();
      } else {
        const ex = -Math.sin(a), ey = Math.cos(a), r = 0.62;
        const [x0, y0] = proj(geo, ex * r, ey * r, z), [x1, y1] = proj(geo, -ex * r, -ey * r, z);
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(cx0 + (x0 - cx0) * 0.08, cy0 + (y0 - cy0) * 0.08);
        ctx.moveTo(cx0 + (x1 - cx0) * 0.08, cy0 + (y1 - cy0) * 0.08); ctx.lineTo(x1, y1); ctx.stroke();
      }
      ctx.restore();
      ctx.save(); ctx.fillStyle = C.fwd; ctx.shadowColor = C.fwd; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(cx0, cy0, 3, 0, TAU); ctx.fill(); ctx.restore();
      V.text(ctx, label, cx0, geo.oy + geo.sy * 1.22, { size: 12, align: "center", color: C.ink2 });
    }

    function draw() {
      const { ctx, w, h: H } = st;
      if (!w) return;
      ctx.clearRect(0, 0, w, H);
      V.graticule(ctx, 0, 0, w, H, 12, 8);
      const narrow = w < 560;
      const insetR = narrow ? 52 : Math.min(78, H * 0.16);
      const top = narrow ? insetR * 2 + 34 : 30;
      const Ldraw = 2.5; // dalga boyu sayısı (z ekseni)
      const avail = narrow ? w - 40 : w - 90;
      const sz = avail / (Ldraw + 1.0);
      const sy = Math.min((H - top - 40) * 0.36, sz * 0.62);
      const geo = { ox: (narrow ? 22 : 50) + sz * 0.45, oy: top + (H - top) * 0.52, sz, sy, kx: -sy * 0.42, ky: -sy * 0.3 };
      const zR = Ldraw; // alıcının konumu (λ)
      const psi0 = S.t * TAU;
      // ilerleme ekseni
      const [ax0, ay0] = proj(geo, 0, 0, -0.35), [ax1, ay1] = proj(geo, 0, 0, zR + 0.45);
      ctx.save(); ctx.strokeStyle = C.line2; ctx.setLineDash([4, 5]); ctx.beginPath(); ctx.moveTo(ax0, ay0); ctx.lineTo(ax1, ay1); ctx.stroke(); ctx.restore();
      // titreşim düzlemi (doğrusal ise): yarı saydam şerit
      const kind = isCirc(S.tx) ? S.tx : "lin", a = txAng() * DEG;
      if (kind === "lin") {
        const ex = -Math.sin(a), ey = Math.cos(a);
        const p = [proj(geo, ex, ey, 0), proj(geo, ex, ey, zR), proj(geo, -ex, -ey, zR), proj(geo, -ex, -ey, 0)];
        ctx.save(); ctx.fillStyle = rgba(C.E, 0.06); ctx.strokeStyle = rgba(C.E, 0.18);
        ctx.beginPath(); p.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
      }
      // alan vektörleri: E (gül) ve H (çivit); dalga z yönünde ilerler: ψ = ωt − kz
      const n = 64;
      const tipsE = [], tipsH = [];
      for (let i = 0; i <= n; i++) {
        const z = (i / n) * zR, psi = psi0 - TAU * z;
        const [ex, ey] = E(kind === "lin" ? "lin" : kind, a, psi);
        tipsE.push([z, ex, ey]); tipsH.push([z, -ey, ex]);
      }
      function stems(tips, col, alpha, lw) {
        ctx.save(); ctx.strokeStyle = rgba(col, alpha); ctx.lineWidth = lw;
        ctx.beginPath();
        for (let i = 0; i < tips.length; i += 2) {
          const [z, x, y] = tips[i];
          const [bx, by] = proj(geo, 0, 0, z), [tx, ty] = proj(geo, x, y, z);
          ctx.moveTo(bx, by); ctx.lineTo(tx, ty);
        }
        ctx.stroke(); ctx.restore();
      }
      function curve(tips, col, lw) {
        ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.shadowColor = col; ctx.shadowBlur = 8; ctx.lineJoin = "round";
        ctx.beginPath();
        tips.forEach(([z, x, y], i) => { const [px, py] = proj(geo, x, y, z); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
        ctx.stroke(); ctx.restore();
      }
      if (S.showH) { stems(tipsH, C.H, 0.35, 1); curve(tipsH, C.H, 1.6); }
      stems(tipsE, C.E, 0.5, 1.2); curve(tipsE, C.E, 2.4);
      // vericideki anlık E oku
      {
        const [ex, ey] = E(kind === "lin" ? "lin" : kind, a, psi0);
        const [bx, by] = proj(geo, 0, 0, 0.0001), [tx, ty] = proj(geo, ex, ey, 0.0001);
        if (Math.hypot(tx - bx, ty - by) > 6) V.arrow(ctx, bx, by, tx, ty, C.E, 2.4, 9);
      }
      antenna(ctx, geo, S.tx === "v" || S.tx === "h" ? "lin" : S.tx, a, 0, "verici");
      antenna(ctx, geo, S.rx === "lin" ? "lin" : S.rx, S.rxAng * DEG, zR, "alıcı");
      // ilerleme yönü oku
      const [qx, qy] = proj(geo, 0, 0, zR + 0.45);
      V.arrow(ctx, qx - 26, qy, qx, qy, C.ink2, 1.2, 7);
      // dalga boyu ölçü çizgisi
      const [d0x] = proj(geo, 0, 0, 0.5), [d1x] = proj(geo, 0, 0, 1.5);
      const dy = Math.min(H - 30, geo.oy + geo.sy * 1.55);
      V.dimension(ctx, d0x, dy, d1x, dy, "λ", { size: 12 });
      // lejant
      V.text(ctx, "E", 14 + (narrow ? 0 : 0), H - 12, { color: C.E, size: 13, weight: 700, font: "num" });
      V.text(ctx, "elektrik alanı", 28, H - 12, { color: C.ink2, size: 12 });
      if (S.showH) { V.text(ctx, "H", 120, H - 12, { color: C.H, size: 13, weight: 700, font: "num" }); V.text(ctx, "manyetik alan", 134, H - 12, { color: C.ink2, size: 12 }); }

      // uç görünüm: dalgaya arkasından (vericinin tarafından) bakış; ekran sağı = −x
      const icx = w - insetR - 18, icy = insetR + 18;
      ctx.save();
      ctx.fillStyle = rgba(C.deep, 0.8); ctx.strokeStyle = C.line2;
      ctx.beginPath(); ctx.arc(icx, icy, insetR + 8, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = C.grid2; ctx.beginPath();
      ctx.moveTo(icx - insetR, icy); ctx.lineTo(icx + insetR, icy); ctx.moveTo(icx, icy - insetR); ctx.lineTo(icx, icy + insetR); ctx.stroke();
      // E ucunun izi (elips/çember/çizgi)
      ctx.strokeStyle = rgba(C.E, 0.55); ctx.lineWidth = 1.5; ctx.beginPath();
      for (let i = 0; i <= 64; i++) { const [ex, ey] = E(kind === "lin" ? "lin" : kind, a, (i / 64) * TAU); const px = icx - ex * insetR * 0.8, py = icy - ey * insetR * 0.8; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      ctx.stroke();
      // alıcı anteninin doğrultusu
      if (S.rx === "lin") {
        const rx = -Math.sin(S.rxAng * DEG), ry = Math.cos(S.rxAng * DEG);
        ctx.strokeStyle = C.copper; ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.globalAlpha = 0.85;
        ctx.beginPath(); ctx.moveTo(icx + rx * insetR, icy - ry * insetR); ctx.lineTo(icx - rx * insetR, icy + ry * insetR); ctx.stroke();
        ctx.globalAlpha = 1;
      }
      const [ex, ey] = E(kind === "lin" ? "lin" : kind, a, psi0);
      if (Math.hypot(ex, ey) > 0.08) V.arrow(ctx, icx, icy, icx - ex * insetR * 0.8, icy - ey * insetR * 0.8, C.E, 2.2, 8);
      ctx.restore();
      V.text(ctx, "arkadan bakış", icx, icy + insetR + 24, { size: 11, align: "center", color: C.muted });
      if (isCirc(S.tx)) V.text(ctx, S.tx === "r" ? "saat yönünde döner" : "saatin tersine döner", w - 14, icy + insetR + 38, { size: 11, align: "right", color: C.E });
      V.corners(ctx, 6, 6, w - 12, H - 12);
    }

    const lp = loop((dt) => { S.t += dt * 0.45; draw(); });
    update();
    return { enter() { lp.start(); }, leave() { lp.stop(); } };
  };

  /* =====================================================================
     2. Yagi–Uda: YAKLAŞIK dizi faktörü modeli
     Elemanlar x ekseni (bom) boyunca, kendileri y doğrultusunda (yatay Yagi, üstten bakış = E düzlemi).
     Sürülen eleman: genlik 1, faz 0. Yansıtıcı: x = −sr; yönlendirici k: x = k·sd.
     Ardışık faz gecikmesi 2π·aralık + π/N (Hansen–Woodyard'a benzer ilerleyen dalga fazlaması).
     Genlikler: parazitik eleman ne kadar uzaktaysa o kadar az akım kapar (cpl), yönlendiricilerde sırayla azalır.
     Kazanç: 3B desenin küre üzerinde sayısal integrali; kayıpsız varsayım (kazanç = yönlülük).
     Bu bir öğretim modelidir; gerçek Yagi karşılıklı empedanslarla (NEC, moment yöntemi) hesaplanır.
     ===================================================================== */
  const cpl = (s) => Math.exp(-(((s - 0.15) / 0.45) ** 2));
  function yagiElems(N, sr, sd) {
    if (N < 2) return [{ x: 0, amp: 1, phase: 0 }];
    const dl = Math.PI / N;
    const e = [{ x: -sr, amp: 0.85 * cpl(sr), phase: TAU * sr + dl, kind: "R" }, { x: 0, amp: 1, phase: 0, kind: "D" }];
    for (let k = 1; k <= N - 2; k++) e.push({ x: k * sd, amp: cpl(sd) * 0.8 * Math.pow(0.92, k - 1), phase: -k * (TAU * sd + dl), kind: "Y" });
    return e;
  }
  const acos1 = (v) => Math.acos(clamp(v, -1, 1));
  // 3B alan: θ (z'den), φ (x'ten); eleman deseni y doğrultusundaki yarım dalga dipol
  function yagiF(el, th, ph) {
    const u = Math.sin(th) * Math.cos(ph), cy = Math.sin(th) * Math.sin(ph);
    return RF.arrayFactor(el, acos1(u)) * Math.abs(RF.dipolePattern(0.5, acos1(cy)));
  }
  // yatay düzlem (θ = 90°)
  const yagiH = (el, ph) => yagiF(el, Math.PI / 2, ph);
  function yagiDirectivity(el) {
    const nt = 72, np = 144;
    let s = 0, m = 0;
    for (let i = 0; i < nt; i++) {
      const th = ((i + 0.5) * Math.PI) / nt, sn = Math.sin(th);
      for (let j = 0; j < np; j++) {
        const f = yagiF(el, th, (j * TAU) / np); const f2 = f * f;
        s += f2 * sn; if (f2 > m) m = f2;
      }
    }
    s *= (Math.PI / nt) * (TAU / np);
    return (4 * Math.PI * m) / s;
  }

  Demos.ch6bYagi = function (stage) {
    const cv = h("canvas", { "aria-label": "Yagi–Uda anteninin üstten mavi baskı çizimi ve yatay düzlemdeki ışıma deseni" });
    const fill = h("div.fill", cv);
    const S = { N: 3, sr: 0.2, sd: 0.25, cmp: true, t: 0 };
    let el = [], peak = 1, D = 1, dip = 1;
    const nSl = slider({ label: "Eleman sayısı", min: 2, max: 10, step: 1, value: S.N, fmt: (v) => num(v), oninput: (v) => { S.N = Math.round(v); calc(); } });
    const dSl = slider({ label: "Yönlendirici aralığı", min: 0.1, max: 0.45, step: 0.01, value: S.sd, fmt: (v) => num(v, 2) + " λ", oninput: (v) => { S.sd = v; calc(); } });
    const rSl = slider({ label: "Yansıtıcı aralığı", min: 0.1, max: 0.35, step: 0.01, value: S.sr, fmt: (v) => num(v, 2) + " λ", oninput: (v) => { S.sr = v; calc(); } });
    const cTog = toggle("Dipolle karşılaştır", true, (v) => { S.cmp = v; draw(); });
    const rG = readout("Kazanç ≈"), rFB = readout("Ön/arka ≈"), rB = readout("Bom boyu");
    const approx = h("span.approx", "yaklaşık model");
    const flt = h("div.float.tl", approx, " ", h("span", "dizi faktörü × dipol deseni; gerçek Yagi NEC ile hesaplanır"));
    fill.append(flt);
    const ctrl = h("div.controls", nSl, dSl, rSl, cTog, h("div.spacer"), h("div.readouts", rG.el, rFB.el, rB.el));
    stage.append(fill, ctrl);
    const st = canvas(cv, draw);
    dip = RF.dipoleDirectivity(0.5);

    function calc() {
      dSl.style.opacity = S.N >= 3 ? 1 : 0.4;
      el = yagiElems(S.N, S.sr, S.sd);
      peak = 0; for (let i = 0; i < 360; i++) peak = Math.max(peak, yagiH(el, (i * TAU) / 360));
      D = yagiDirectivity(el);
      const fb = 20 * Math.log10(yagiH(el, 0) / Math.max(1e-9, yagiH(el, Math.PI)));
      rG.set(db(RF.dB(D), 1, "dBi"));
      rFB.set(db(fb, 1));
      const boom = S.sr + Math.max(0, S.N - 2) * S.sd;
      rB.set(num(boom, 2) + " λ");
      draw();
    }

    function draw() {
      const { ctx, w, h: H } = st;
      if (!w || !el.length) return;
      ctx.clearRect(0, 0, w, H);
      V.graticule(ctx, 0, 0, w, H, 12, 8);
      const narrow = w < 640;
      // yerleşim: çizim solda (ya da üstte), desen sağda (ya da altta)
      const top = narrow ? 56 : 64;
      let dr, pc;
      if (narrow) { dr = { x: 14, y: top, w: w - 28, h: (H - top) * 0.42 }; const R = Math.min(w * 0.42, (H - top) * 0.27); pc = { x: w / 2, y: top + (H - top) * 0.42 + R + 22, R }; }
      else { dr = { x: 20, y: top, w: w * 0.5 - 30, h: H - top - 30 }; const R = Math.min(w * 0.2, (H - top) * 0.42); pc = { x: w * 0.74, y: top + (H - top) / 2, R }; }

      // --- mavi baskı üstten görünüş ---
      const xs = el.map((e) => e.x), xmin = Math.min(...xs), xmax = Math.max(...xs);
      const spanL = Math.max(0.8, xmax - xmin + 0.3);
      const sc = Math.min(dr.w / (spanL + 0.25), dr.h / 0.75);
      const cx0 = dr.x + (dr.w - (xmax - xmin) * sc) / 2 - xmin * sc, cy = dr.y + dr.h * 0.48;
      const X = (x) => cx0 + x * sc;
      // bom
      ctx.save();
      ctx.strokeStyle = C.ink2; ctx.lineWidth = 3; ctx.globalAlpha = 0.55;
      ctx.beginPath(); ctx.moveTo(X(xmin) - 12, cy); ctx.lineTo(X(xmax) + 12, cy); ctx.stroke();
      ctx.restore();
      // elemanlar: yansıtıcı uzun, yönlendiriciler kısa (yalnızca çizim)
      el.forEach((e, i) => {
        const L = e.kind === "R" ? 0.5 : e.kind === "D" || !e.kind ? 0.47 : 0.44 - 0.006 * (i - 2);
        const half = (L / 2) * sc, x = X(e.x);
        ctx.save(); ctx.strokeStyle = C.copper; ctx.lineWidth = 3.2; ctx.lineCap = "round"; ctx.shadowColor = C.copper; ctx.shadowBlur = 6;
        ctx.beginPath();
        if (e.kind === "D" || !e.kind) { ctx.moveTo(x, cy - half); ctx.lineTo(x, cy - 4); ctx.moveTo(x, cy + 4); ctx.lineTo(x, cy + half); }
        else { ctx.moveTo(x, cy - half); ctx.lineTo(x, cy + half); }
        ctx.stroke(); ctx.restore();
        // eleman akımı: H rengiyle, genlik × cos(ωt + faz)
        const I = e.amp * Math.cos(S.t * TAU + e.phase);
        ctx.save(); ctx.strokeStyle = rgba(C.H, 0.25 + 0.6 * Math.abs(I)); ctx.lineWidth = 7; ctx.lineCap = "round"; ctx.globalCompositeOperation = "lighter";
        ctx.beginPath(); ctx.moveTo(x + 7, cy); ctx.lineTo(x + 7, cy - I * half * 0.9); ctx.stroke(); ctx.restore();
      });
      // besleme noktası
      ctx.save(); ctx.fillStyle = C.fwd; ctx.shadowColor = C.fwd; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(X(0), cy, 3.5, 0, TAU); ctx.fill(); ctx.restore();
      // etiketler
      const lab = (x, s, below) => V.text(ctx, s, x, below ? cy + 0.3 * sc + 18 : cy - 0.3 * sc - 10, { size: 11, align: "center", color: C.ink2 });
      if (el.length > 1) { lab(X(-S.sr), "yansıtıcı", false); lab(X(0), "sürülen", true); }
      if (el.length > 2) lab(X(el.length > 3 ? (el[2].x + el[el.length - 1].x) / 2 : el[2].x), el.length > 3 ? "yönlendiriciler" : "yönlendirici", false);
      // ölçü çizgileri
      const dimY = cy + 0.3 * sc + 38;
      if (el.length > 1 && S.sr * sc > 54) V.dimension(ctx, X(-S.sr), dimY, X(0), dimY, num(S.sr, 2) + " λ", { size: 11 });
      if (el.length > 2 && S.sd * sc > 54) V.dimension(ctx, X(0), dimY, X(S.sd), dimY, num(S.sd, 2) + " λ", { size: 11 });
      const bomY = dimY + 26;
      if (el.length > 2) V.dimension(ctx, X(xmin), bomY, X(xmax), bomY, "bom " + num(xmax - xmin, 2) + " λ", { size: 11 });
      // ışıma yönü
      V.arrow(ctx, X(xmax) + 20, cy - 0.3 * sc - 30, X(xmax) + 60, cy - 0.3 * sc - 30, C.ink2, 1.2, 7);
      V.text(ctx, "ileri", X(xmax) + 40, cy - 0.3 * sc - 38, { size: 11, align: "center", color: C.muted });

      // --- kutupsal desen ---
      V.polarGrid(ctx, pc.x, pc.y, pc.R);
      if (S.cmp) V.polar(ctx, pc.x, pc.y, pc.R, (ph) => Math.abs(RF.dipolePattern(0.5, acos1(Math.sin(ph)))) / Math.sqrt(D / dip) , C.muted, { fill: 0, lw: 1.2 });
      V.polar(ctx, pc.x, pc.y, pc.R, (ph) => yagiH(el, ph) / peak, C.E, { fill: 0.14 });
      V.text(ctx, "ileri →", pc.x + pc.R, pc.y - pc.R - 6, { size: 11, align: "right", color: C.muted });
      V.text(ctx, "yatay düzlem, dB", pc.x, pc.y + pc.R + 18, { size: 11, align: "center", color: C.muted });
      if (S.cmp) V.text(ctx, "gri: tek dipol (aynı ölçekte)", pc.x, pc.y + pc.R + 32, { size: 11, align: "center", color: C.muted });
      V.corners(ctx, 6, 6, w - 12, H - 12);
    }
    const lp = loop((dt) => { S.t += dt * 0.5; draw(); });
    calc();
    return { enter() { lp.start(); }, leave() { lp.stop(); } };
  };

  /* =====================================================================
     3. Faz dizisi: N elemanlı doğrusal dizi, RF.ulaFactor ve RF.steerPhase.
     θ: dizinin dik doğrultusundan (karşıdan) sapma, sağa pozitif. Eleman deseni cos θ (arkada yansıtıcı levha varsayımı).
     ===================================================================== */
  Demos.ch6bPA = function (stage) {
    const cv = h("canvas", { "aria-label": "Faz dizili anten: elemanlardan yayılan halkalar, birleşen dalga cephesi, fazörler ve kutupsal desen" });
    const fill = h("div.fill", cv);
    const S = { N: 8, d: 0.5, th0: 0, t: 0 };
    const nSl = slider({ label: "Eleman sayısı", min: 2, max: 16, step: 1, value: S.N, fmt: (v) => num(v), oninput: (v) => { S.N = Math.round(v); calc(); } });
    const dSl = slider({ label: "Aralık", min: 0.1, max: 1.0, step: 0.01, value: S.d, fmt: (v) => num(v, 2) + " λ", oninput: (v) => { S.d = v; calc(); } });
    const aSl = slider({ label: "Yönlendirme açısı", min: -60, max: 60, step: 1, value: 0, fmt: (v) => deg(v), oninput: (v) => { S.th0 = v; calc(); } });
    const rB = readout("Faz farkı β"), rW = readout("Hüzme genişliği"), rGL = readout("Izgara lobu");
    const ctrl = h("div.controls", nSl, dSl, aSl, h("div.spacer"), h("div.readouts", rB.el, rW.el, rGL.el));
    stage.append(fill, ctrl);
    const st = canvas(cv, draw);
    let beta = 0, grating = [];

    const pat = (th) => (Math.abs(th) >= Math.PI / 2 ? 0 : RF.ulaFactor(S.N, S.d, beta, th) * Math.cos(th));
    function calc() {
      const th0 = S.th0 * DEG;
      beta = RF.steerPhase(S.d, th0);
      let bd = ((beta / DEG) % 360 + 540) % 360 - 180;
      rB.set(deg(bd));
      // −3 dB hüzme genişliği: ana hüzme çevresinde ölç
      const p0 = pat(th0);
      let a = th0, b = th0;
      const target = p0 * Math.SQRT1_2, stp = 0.02 * DEG;
      while (a > -Math.PI / 2 && pat(a) > target) a -= stp;
      while (b < Math.PI / 2 && pat(b) > target) b += stp;
      rW.set(deg((b - a) / DEG, 1));
      // ızgara lobları: sin θ = sin θ0 + m λ/d (|.| < 1)
      grating = [];
      for (let m = -3; m <= 3; m++) {
        if (!m) continue;
        const s = Math.sin(th0) + m / S.d;
        if (Math.abs(s) < 1) grating.push(Math.asin(s));
      }
      if (grating.length) { rGL.set("var: " + grating.map((g) => deg(g / DEG)).join(", ")); rGL.cls("bad"); }
      else { rGL.set("yok"); rGL.cls("ok"); }
      draw();
    }

    function draw() {
      const { ctx, w, h: H } = st;
      if (!w) return;
      ctx.clearRect(0, 0, w, H);
      V.graticule(ctx, 0, 0, w, H, 12, 8);
      const narrow = w < 640;
      let wp, pc;
      if (narrow) { wp = { x: 0, y: 0, w, h: H * 0.58 }; const R = Math.min(w * 0.42, H * 0.3); pc = { x: w / 2, y: Math.min(H * 0.58 + R + 14, H - 40), R }; }
      else { wp = { x: 0, y: 0, w: w * 0.6, h: H }; const R = Math.min(w * 0.185, H * 0.56); pc = { x: w * 0.8, y: Math.min(H * 0.5 + R * 0.45, H - R - 28), R }; }
      const N = S.N, d = S.d;
      const lam = Math.min(narrow ? 46 : 64, (wp.w * 0.8) / Math.max(1, (N - 1) * d));
      const baseY = wp.y + wp.h - 74, cxm = wp.x + wp.w / 2;
      const xn = (n) => cxm + (n - (N - 1) / 2) * d * lam;
      const tau = S.t;
      // halkalar: her elemandan; tepe noktaları r = λ (τ + φn/2π − m)
      ctx.save();
      ctx.beginPath(); ctx.rect(wp.x + 4, wp.y + 4, wp.w - 8, baseY - wp.y - 4); ctx.clip();
      const Rmax = Math.hypot(wp.w, wp.h);
      ctx.lineWidth = 1;
      for (let n = 0; n < N; n++) {
        const off = tau + (n * beta) / TAU;
        const fr = off - Math.floor(off);
        for (let m = 0; ; m++) {
          const r = lam * (fr + m);
          if (r > Rmax) break;
          ctx.strokeStyle = rgba(C.E, Math.max(0.04, 0.32 - r / Rmax * 0.4));
          ctx.beginPath(); ctx.arc(xn(n), baseY, r, Math.PI, TAU); ctx.stroke();
        }
      }
      // birleşen düz cephe: û·p = λ(τ − m), orijin 0. eleman
      const th0 = S.th0 * DEG, ux = Math.sin(th0), uy = -Math.cos(th0);
      const ox = xn(0), oy = baseY;
      ctx.strokeStyle = C.fwd; ctx.lineWidth = 2.2; ctx.shadowColor = C.fwd; ctx.shadowBlur = 8;
      const fr0 = tau - Math.floor(tau);
      const half = Math.max(lam, (N - 1) * d * lam) * 0.6 + 10;
      const mid = (N - 1) / 2 * d * lam; // dizinin ortasının û'ya izdüşümü
      for (let m = 0; m < 40; m++) {
        const s = lam * (fr0 + m) - 0; // û boyunca uzaklık (0. elemana göre)
        // çizginin ortası: dizinin merkezinden û yönünde gidilen nokta
        const along = s - mid * ux;
        if (along < 0) continue;
        const px = cxm + ux * along, py = oy + uy * along;
        if (py < wp.y - 40) break;
        ctx.globalAlpha = Math.max(0.15, 1 - along / Rmax * 1.4);
        ctx.beginPath(); ctx.moveTo(px - uy * half * -1 * 1, py + ux * half * -1); ctx.lineTo(px + uy * half * -1, py - ux * half * -1); ctx.stroke();
      }
      ctx.restore();
      // yön çizgisi
      ctx.save(); ctx.setLineDash([5, 6]); ctx.strokeStyle = rgba(C.copper, 0.7);
      ctx.beginPath(); ctx.moveTo(cxm, baseY); ctx.lineTo(cxm + ux * wp.h * 0.85, baseY + uy * wp.h * 0.85); ctx.stroke(); ctx.restore();
      // zemin (yansıtıcı levha) ve elemanlar
      ctx.save(); ctx.strokeStyle = C.line2; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(xn(0) - 30, baseY + 10); ctx.lineTo(xn(N - 1) + 30, baseY + 10); ctx.stroke();
      for (let x = xn(0) - 30; x < xn(N - 1) + 30; x += 8) { ctx.beginPath(); ctx.moveTo(x, baseY + 10); ctx.lineTo(x - 6, baseY + 16); ctx.stroke(); }
      ctx.restore();
      const pr = clamp(d * lam * 0.42, 5, 11);
      for (let n = 0; n < N; n++) {
        const x = xn(n);
        ctx.save(); ctx.fillStyle = C.copper; ctx.shadowColor = C.copper; ctx.shadowBlur = 8;
        ctx.fillRect(x - 5, baseY - 2, 10, 5); ctx.restore();
        // fazör: ωt + n β (kendi faz farkını gösteren dönen ok)
        const ph = tau * TAU + n * beta;
        const py = baseY + 26 + pr;
        ctx.save(); ctx.strokeStyle = C.line2; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, py, pr, 0, TAU); ctx.stroke(); ctx.restore();
        V.arrow(ctx, x, py, x + pr * Math.cos(ph), py - pr * Math.sin(ph), C.copper, 1.4, Math.min(6, pr * 0.6));
      }
      if (N > 1 && d * lam > 26) V.dimension(ctx, xn(0), baseY - 18, xn(1), baseY - 18, num(d, 2) + " λ", { size: 10 });
      // kutupsal desen
      V.polarGrid(ctx, pc.x, pc.y, pc.R);
      V.polar(ctx, pc.x, pc.y, pc.R, (ph) => pat(Math.PI / 2 - ph), C.E, { fill: 0.14, n: 720 });
      ctx.save(); ctx.setLineDash([4, 5]); ctx.strokeStyle = rgba(C.copper, 0.8);
      ctx.beginPath(); ctx.moveTo(pc.x, pc.y); ctx.lineTo(pc.x + Math.sin(th0) * pc.R * 1.08, pc.y - Math.cos(th0) * pc.R * 1.08); ctx.stroke(); ctx.restore();
      for (const g of grating) {
        if (Math.abs(g) >= Math.PI / 2 - 1e-6) continue;
        const gx = pc.x + Math.sin(g) * pc.R * 1.1, gy = pc.y - Math.cos(g) * pc.R * 1.1;
        V.text(ctx, "ızgara lobu", gx, gy - 4, { size: 11, align: "center", color: C.bad, weight: 600 });
      }
      V.text(ctx, "arka: yansıtıcı levha", pc.x, pc.y + 18, { size: 10, align: "center", color: C.muted });
      V.text(ctx, "desen, dB", pc.x, pc.y + 32, { size: 11, align: "center", color: C.muted });
      if (!narrow) V.text(ctx, "fazlar", xn(0) - pr - 8, baseY + 30 + pr, { size: 10, align: "right", color: C.muted });
      V.corners(ctx, 6, 6, w - 12, H - 12);
    }
    const lp = loop((dt) => { S.t += dt * 0.6; draw(); });
    calc();
    return { enter() { lp.start(); }, leave() { lp.stop(); } };
  };

  /* =====================================================================
     4. Diğer antenler: teknik çizim paftası (2 × 2).
     Desenler: küçük halka = sin θ (kuramsal, kısa dipolle aynı); patch = temsilî;
     helisel = RF.ulaFactor ile uç-ateşlemeli Hansen–Woodyard dizisi × cos θ (yaklaşık, Kraus);
     çanak = düzgün aydınlatılmış dairesel açıklık 2 J1(u)/u (yaklaşık).
     ===================================================================== */
  // J1, çanak hüzme genişliği ve helis yönlülüğü rf.js'te (testli)
  const besselJ1 = RF.besselJ1, dishBeamwidthDeg = RF.dishBeamwidthDeg, helixDirectivity = RF.helixDirectivity;
  const HELIX = { N: 6, C: 1, S: 0.25 };

  const ANT = [
    { k: "loop", name: "Halka", cell: "A1", tag: "kuramsal", line: "Küçük bir tel halka, ekseni boyunca hiç ışımaz, halka düzleminde her yöne eşit ışır: yön bulmada keskin sıfırı işe yarar." },
    { k: "patch", name: "Patch", cell: "A2", tag: "temsilî", line: "Devre kartına basılmış yarım dalga boyunda bir bakır levha; tek yöne, kartın önüne ışır ve GPS'ten telefonlara her yerdedir." },
    { k: "helix", name: "Helisel", cell: "B1", tag: "yaklaşık", line: "Çevresi bir dalga boyu olan sarmal tel, ekseni yönünde dar bir hüzmeyle dairesel polarizasyonlu dalga yayar." },
    { k: "dish", name: "Çanak", cell: "B2", tag: "yaklaşık", line: "Parabolik yansıtıcı, odaktaki küçük besleyicinin dalgasını toplayıp düz bir cepheye çevirir: ağız büyüdükçe hüzme iğne gibi incelir." },
  ];

  Demos.ch6bOther = function (stage) {
    const cv = h("canvas", { "aria-label": "Teknik çizim paftası: halka, patch, helisel ve parabolik çanak antenler ve ışıma desenleri" });
    const fill = h("div.fill", cv);
    const S = { sel: "dish", D: 0.6, f: 11e9 };
    const pick = seg(ANT.map((a) => [a.k, a.name]), S.sel, (k) => { S.sel = k; update(); }, "Anten seçimi");
    const dSl = slider({ label: "Çanak çapı", min: 0.3, max: 3, step: 0.01, value: S.D, log: true, fmt: (v) => L.meters(v), oninput: (v) => { S.D = v; update(); } });
    const fSl = slider({ label: "Frekans", min: 1e9, max: 12e9, value: S.f, log: true, fmt: (v) => L.hz(v), oninput: (v) => { S.f = v; update(); } });
    const rG = readout("Çanak kazancı"), rW = readout("Hüzme genişliği ≈"), rL = readout("Dalga boyu");
    const cap = h("p.ch6b-cap");
    const ctrl = h("div.controls", pick, dSl, fSl, h("div.spacer"), h("div.readouts", rG.el, rW.el, rL.el));
    stage.append(fill, h("div.ch6b-capbar", cap), ctrl);
    const st = canvas(cv, draw);
    let cells = [];

    function update() {
      const a = ANT.find((x) => x.k === S.sel);
      cap.innerHTML = "";
      cap.append(h("b", a.name + ": "), a.line);
      const G = RF.dishGain(S.D, S.f, 0.55);
      rG.set(db(RF.dB(G), 1, "dBi"));
      rW.set(deg(dishBeamwidthDeg(S.D, S.f), dishBeamwidthDeg(S.D, S.f) < 10 ? 1 : 0));
      rL.set(L.meters(RF.wavelength(S.f)));
      draw();
    }

    function pattern(k) {
      if (k === "loop") return (ph) => Math.abs(Math.sin(ph)); // eksen yatay (0° ve 180°)
      if (k === "patch") return (ph) => { const c = Math.cos(ph); return c > 0 ? 0.1 + 0.9 * Math.pow(c, 1.2) : 0.1; };
      if (k === "helix") {
        const { N, S: d } = HELIX, beta = -TAU * d - Math.PI / N; // uç-ateşleme + Hansen–Woodyard
        const pk = RF.ulaFactor(N, d, beta, Math.PI / 2);
        return (ph) => { const c = Math.cos(ph); return c > 0 ? (RF.ulaFactor(N, d, beta, Math.PI / 2 - ph) * c) / pk : 0.02 * RF.ulaFactor(N, d, beta, Math.PI / 2 - ph) / pk; };
      }
      const ka = (Math.PI * S.D) / RF.wavelength(S.f);
      return (ph) => {
        const c = Math.cos(ph); if (c <= 0) return 0.004;
        const u = ka * Math.sin(ph);
        const f = Math.abs(u) < 1e-6 ? 1 : (2 * besselJ1(u)) / u;
        return Math.max(0.004, Math.abs(f) * (1 + c) / 2);
      };
    }

    function drawAntenna(ctx, k, x, y, w, hh) {
      const cx = x + w / 2, cy = y + hh / 2, s = Math.min(w, hh);
      ctx.save();
      ctx.strokeStyle = C.copper; ctx.lineWidth = 2.4; ctx.lineCap = "round"; ctx.lineJoin = "round";
      const thin = () => { ctx.strokeStyle = C.ink2; ctx.lineWidth = 1; ctx.globalAlpha = 0.7; };
      const cu = () => { ctx.strokeStyle = C.copper; ctx.lineWidth = 2.4; ctx.globalAlpha = 1; };
      if (k === "loop") {
        const ry = s * 0.36, rx = ry * 0.45;
        ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, Math.PI / 2 + 0.12, Math.PI * 2.5 - 0.12); ctx.stroke();
        thin(); ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(x + 6, cy); ctx.lineTo(x + w - 6, cy); ctx.stroke(); ctx.setLineDash([]);
        V.text(ctx, "eksen", x + 6, cy - 5, { size: 10, color: C.muted });
        V.dimension(ctx, cx + rx + 14, cy - ry, cx + rx + 14, cy + ry, "≪ λ", { size: 10 });
        ctx.fillStyle = C.fwd; ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(cx, cy + ry, 3, 0, TAU); ctx.fill();
      } else if (k === "patch") {
        // eğik görünüş: kart dikey duruyor, ön yüzü sağa bakıyor
        const bw = s * 0.16, bh = s * 0.72, sk = s * 0.2;
        const x0 = cx - bw / 2 - sk / 2, y0 = cy - bh / 2;
        thin(); ctx.globalAlpha = 0.9;
        ctx.beginPath(); ctx.moveTo(x0, y0 + sk * 0.5); ctx.lineTo(x0 + sk, y0); ctx.lineTo(x0 + sk, y0 + bh); ctx.lineTo(x0, y0 + bh + sk * 0.5); ctx.closePath(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x0 + sk, y0); ctx.lineTo(x0 + sk + bw * 0.25, y0 + 2); ctx.lineTo(x0 + sk + bw * 0.25, y0 + bh + 2); ctx.lineTo(x0 + sk, y0 + bh); ctx.stroke();
        cu(); ctx.fillStyle = rgba(C.copper, 0.25);
        const px0 = x0 + sk * 0.2, pw = sk * 0.6, py0 = y0 + bh * 0.25, ph = bh * 0.4;
        ctx.beginPath(); ctx.moveTo(px0, py0 + sk * 0.4); ctx.lineTo(px0 + pw, py0 + sk * 0.1); ctx.lineTo(px0 + pw, py0 + ph + sk * 0.1); ctx.lineTo(px0, py0 + ph + sk * 0.4); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(px0 + pw / 2, py0 + ph + sk * 0.25); ctx.lineTo(px0 + pw / 2, y0 + bh + sk * 0.2); ctx.stroke();
        V.arrow(ctx, cx + bw, cy, cx + s * 0.42, cy, C.ink2, 1, 6);
        V.dimension(ctx, px0 - 12, py0 + sk * 0.4, px0 - 12, py0 + ph + sk * 0.4, "≈ λ/2", { size: 10 });
      } else if (k === "helix") {
        const { N } = HELIX;
        const L0 = s * 0.7, r = s * 0.14, xs = cx - L0 / 2 + 6;
        thin(); ctx.globalAlpha = 0.9;
        ctx.beginPath(); ctx.moveTo(xs - 6, cy - r * 2.1); ctx.lineTo(xs - 6, cy + r * 2.1); ctx.stroke();
        for (let yy = cy - r * 2.1; yy < cy + r * 2.1; yy += 7) { ctx.beginPath(); ctx.moveTo(xs - 6, yy); ctx.lineTo(xs - 11, yy + 5); ctx.stroke(); }
        ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(xs, cy); ctx.lineTo(xs + L0 + 16, cy); ctx.stroke(); ctx.setLineDash([]);
        cu();
        ctx.beginPath();
        for (let i = 0; i <= 240; i++) { const u = i / 240, a = u * N * TAU; const px = xs + u * L0 + Math.sin(a) * r * 0.25, py = cy - Math.cos(a) * r; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
        ctx.stroke();
        V.dimension(ctx, xs + L0 / N * 2, cy + r + 14, xs + L0 / N * 3, cy + r + 14, "λ/4", { size: 10 });
        V.text(ctx, "çevre ≈ λ", xs + L0 * 0.55, cy - r - 10, { size: 10, align: "center", color: C.muted });
      } else {
        // parabol: x = y²/(4F); odak F
        const Hh = s * 0.4, depth = s * 0.16, F = (Hh * Hh) / (4 * depth);
        const vx = cx - s * 0.14;
        const P = (yy) => vx + (yy * yy) / (4 * F);
        thin(); ctx.setLineDash([3, 5]); ctx.globalAlpha = 0.45;
        for (let i = -3; i <= 3; i++) { const yy = (i / 3.4) * Hh; ctx.beginPath(); ctx.moveTo(vx + F, cy); ctx.lineTo(P(yy), cy + yy); ctx.lineTo(cx + s * 0.44, cy + yy); ctx.stroke(); }
        ctx.setLineDash([]);
        cu(); ctx.beginPath();
        for (let i = 0; i <= 60; i++) { const yy = -Hh + (2 * Hh * i) / 60; i ? ctx.lineTo(P(yy), cy + yy) : ctx.moveTo(P(yy), cy + yy); }
        ctx.stroke();
        ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(P(Hh * 0.7), cy + Hh * 0.7); ctx.lineTo(vx + F, cy + 4); ctx.stroke();
        ctx.fillStyle = C.fwd; ctx.beginPath(); ctx.arc(vx + F, cy, 3.2, 0, TAU); ctx.fill();
        V.dimension(ctx, vx - 16, cy - Hh, vx - 16, cy + Hh, "D = " + L.meters(S.D), { size: 10 });
        V.text(ctx, "odak", vx + F, cy + Hh + 16, { size: 10, align: "center", color: C.muted });
        ctx.globalAlpha = 0.5; ctx.strokeStyle = C.muted; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(vx + F, cy + Hh + 5); ctx.lineTo(vx + F, cy + 6); ctx.stroke();
      }
      ctx.restore();
    }

    function drawCell(ctx, a, x, y, w, hh, sel) {
      // pafta hücresi: ince çerçeve, sol üstte pafta kodu, altta antet şeridi
      ctx.save();
      ctx.strokeStyle = sel ? C.copper : C.line2; ctx.lineWidth = sel ? 1.5 : 1;
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, hh - 1);
      ctx.restore();
      if (sel) V.corners(ctx, x + 4, y + 4, w - 8, hh - 8, 12, C.copper);
      const tb = 26; // antet şeridi
      ctx.save(); ctx.strokeStyle = C.line; ctx.beginPath(); ctx.moveTo(x, y + hh - tb); ctx.lineTo(x + w, y + hh - tb); ctx.moveTo(x + 40, y + hh - tb); ctx.lineTo(x + 40, y + hh); ctx.stroke(); ctx.restore();
      V.text(ctx, a.cell, x + 20, y + hh - 9, { size: 11, align: "center", color: C.copper, font: "num", weight: 600 });
      V.text(ctx, a.name, x + 50, y + hh - 9, { size: 13, weight: 700, color: sel ? C.ink : C.ink2 });
      V.text(ctx, "desen, 10 dB/halka: " + a.tag, x + w - 10, y + hh - 9, { size: 10, align: "right", color: a.tag === "kuramsal" ? C.muted : C.copper });
      const inner = { x: x + 8, y: y + 8, w: w - 16, h: hh - tb - 14 };
      let R, pcx, pcy;
      if (inner.h > inner.w * 1.1) { // dar ekran: çizim üstte, desen altta
        const dh = inner.h * 0.45;
        drawAntenna(ctx, a.k, inner.x, inner.y, inner.w, dh);
        R = Math.min(inner.w * 0.42, (inner.h - dh) * 0.44);
        pcx = inner.x + inner.w / 2; pcy = inner.y + dh + (inner.h - dh) / 2;
      } else {
        const dw = inner.w * 0.5;
        drawAntenna(ctx, a.k, inner.x, inner.y, dw, inner.h);
        R = Math.min((inner.w - dw) * 0.42, inner.h * 0.42);
        pcx = inner.x + dw + (inner.w - dw) / 2; pcy = inner.y + inner.h / 2;
      }
      V.polarGrid(ctx, pcx, pcy, R, { labels: false });
      V.polar(ctx, pcx, pcy, R, pattern(a.k), C.E, { fill: 0.14, lw: 1.8, n: a.k === "dish" ? 8000 : 360 });
    }

    function draw() {
      const { ctx, w, h: H } = st;
      if (!w) return;
      ctx.clearRect(0, 0, w, H);
      V.graticule(ctx, 0, 0, w, H, 12, 8);
      const m = 10;
      cells = [];
      if (w < 560) {
        const a = ANT.find((x) => x.k === S.sel);
        cells.push({ a, x: m, y: m, w: w - 2 * m, h: H - 2 * m });
      } else {
        const cw = (w - 2 * m) / 2, ch = (H - 2 * m) / 2;
        ANT.forEach((a, i) => cells.push({ a, x: m + (i % 2) * cw, y: m + Math.floor(i / 2) * ch, w: cw, h: ch }));
      }
      for (const c of cells) drawCell(ctx, c.a, c.x, c.y, c.w, c.h, c.a.k === S.sel && cells.length > 1);
    }
    L.pointer(cv, {
      down(x, y) {
        const c = cells.find((c) => x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h);
        if (c && c.a.k !== S.sel) { S.sel = c.a.k; pick.set(S.sel); update(); }
      },
    });
    update();
    return { enter() { draw(); }, leave() {} };
  };

  window.GUIDE_SCENARIOS = Object.assign(window.GUIDE_SCENARIOS || {}, {
    polarizasyon: [{ slide: "label:Alıcı açısı", to: 45 }, { wait: 700 }, { slide: "label:Alıcı açısı", to: 90 }, { wait: 900 }, { click: "=Sağ el" }],
    yagi: [{ slide: "label:Eleman sayısı", to: 6 }, { wait: 600 }, { slide: "label:Eleman sayısı", to: 10 }],
    "faz-dizisi": [{ slide: "label:Yönlendirme açısı", to: 30 }, { wait: 900 }, { slide: "label:Aralık", to: 0.9 }],
    "diger-antenler": [{ click: "=Halka" }, { wait: 800 }, { click: "=Çanak" }, { slide: "label:Çanak çapı", to: Math.log(2) }],
  });
})();
