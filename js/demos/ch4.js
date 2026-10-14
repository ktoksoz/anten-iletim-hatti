/* Bölüm 4: Empedans ve Smith abağı.
   empedans-nedir (ch4Imp)  : seri R-L-C, karmaşık düzlemde nokta, X_L ve X_C eğrileri
   rezonans       (ch4Res)  : seri / paralel LC, |Z| eğrisi (log-log), Q, bant genişliği, salıncak
   hat-donusumu   (ch4Line) : hat boyunca giriş empedansı, λ/4 ve λ/2, küçük Smith önizlemesi
   smith-abagi    (ch4Smith): ana deney; nokta gir, düz düzlem ↔ Smith bükülmesi, VSWR dairesi, hat dönüşü
   smith-oyun     (ch4Game) : seri/paralel L ve C, hat ekleyerek yükü merkeze getir
   Ekrandaki her sayı RF.* ile hesaplanır; Smith çizimi yalnızca js/smith.js bileşeniyle yapılır. */
(function () {
  const { C, FONT, rgba, h, canvas, loop, clamp, slider, seg, toggle, num, sig, ohm, db, pointer, lerp, rng } = L;
  const CX = RF.C;
  const Z0 = 50;

  /* ---------- biçim yardımcıları ---------- */
  function partStr(p) {
    if (!p || p.type === "none") return "—";
    const v = p.value;
    if (p.type === "L") return v < 1e-6 ? sig(v * 1e9, 3) + " nH" : sig(v * 1e6, 3) + " µH";
    if (v < 1e-9) return sig(v * 1e12, 3) + " pF";
    if (v < 1e-6) return sig(v * 1e9, 3) + " nF";
    return sig(v * 1e6, 3) + " µF";
  }
  const henry = (v) => partStr({ type: "L", value: v });
  const farad = (v) => partStr({ type: "C", value: v });
  const mhz = (f) => num(f / 1e6, f >= 1e8 ? 0 : f >= 1e7 ? 1 : 2) + " MHz";
  const jx = (X, unit = " Ω") => (X < 0 ? "−" : "+") + "j" + sig(Math.abs(X), 3) + unit;
  const ohmTick = (v) => (v >= 1000 ? num(v / 1000, 0) + " kΩ" : num(v, 0) + " Ω");
  const zn = (z) => `${sig(z.re, 3)} ${z.im < 0 ? "−" : "+"} j${sig(Math.abs(z.im), 3)}`;
  const deg = (r) => num((r * 180) / Math.PI, 0) + "°";
  const wl = (v, d = 3) => num(v, d) + " λ";
  // dalga boyu cinsinden uzunluğun elektriksel açısı (derece); frekans seçimi sonucu değiştirmez
  const degWl = (x) => RF.electricalLengthDeg(x * RF.wavelength(1e8), 1e8);

  function readout(k, cls) {
    const v = h("span.v", "—");
    const kk = h("span.k", { html: k.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/_([A-Za-zçğıöşüÇĞİÖŞÜ0-9]+)/g, "<sub>$1</sub>") });
    const el = h("div.readout" + (cls ? "." + cls : ""), kk, v);
    el.set = (s) => { v.textContent = s; };
    el.v = v;
    return el;
  }
  // alt simgeli yazı: "X_L", "Z_giriş" → X ve küçük, aşağıda L
  const SUB = /_([A-Za-zçğıöşüÇĞİÖŞÜ0-9]+)/g;
  function richParts(s) {
    const out = []; let i = 0, m;
    SUB.lastIndex = 0;
    while ((m = SUB.exec(s))) { if (m.index > i) out.push([s.slice(i, m.index), 0]); out.push([m[1], 1]); i = m.index + m[0].length; }
    if (i < s.length) out.push([s.slice(i), 0]);
    return out;
  }
  function richWidth(ctx, s, size, weight, fam) {
    let w = 0;
    for (const [t, sub] of richParts(s)) { ctx.font = `${weight} ${sub ? Math.round(size * 0.74) : size}px ${fam}`; w += ctx.measureText(t).width; }
    return w;
  }
  function rich(ctx, s, x, y, { color = C.ink2, size = 12, weight = 500, font = "display", align = "left", base = "alphabetic" } = {}) {
    const fam = FONT[font] || font;
    ctx.save();
    const w = richWidth(ctx, s, size, weight, fam);
    let px = align === "center" ? x - w / 2 : align === "right" ? x - w : x;
    ctx.fillStyle = color; ctx.textAlign = "left"; ctx.textBaseline = base;
    for (const [t, sub] of richParts(s)) {
      ctx.font = `${weight} ${sub ? Math.round(size * 0.74) : size}px ${fam}`;
      ctx.fillText(t, px, y + (sub ? size * 0.3 : 0));
      px += ctx.measureText(t).width;
    }
    ctx.restore();
    return w;
  }
  function label(ctx, s, x, y, o = {}) { rich(ctx, s, x, y, Object.assign({ size: 12, color: C.ink2 }, o)); }
  // yazının arkasına koyu kutu: eğrilerin üstünde okunur kalsın
  function tag(ctx, s, x, y, color, { align = "left", size = 12, font = "num", base = "middle" } = {}) {
    ctx.save();
    const tw = richWidth(ctx, s, size, 500, FONT[font]);
    const x0 = align === "center" ? x - tw / 2 : align === "right" ? x - tw : x;
    const yc = base === "middle" ? y : base === "bottom" ? y - size * 0.6 : y + size * 0.6;
    ctx.fillStyle = "rgba(8,23,38,0.82)";
    ctx.fillRect(x0 - 4, yc - size * 0.72, tw + 8, size * 1.5);
    ctx.restore();
    rich(ctx, s, x0, yc + 0.5, { color, size, font, base: "middle" });
  }
  function dot(ctx, x, y, color, r = 4.5) {
    ctx.save(); ctx.fillStyle = color; ctx.strokeStyle = C.deep; ctx.lineWidth = 2;
    ctx.shadowColor = color; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; ctx.stroke(); ctx.restore();
  }

  /* ---------- devre şeması parçaları (bobin mor, kondansatör turkuaz, direnç kemik) ---------- */
  function resistorH(ctx, x0, x1, y, col = C.R) {
    const n = 6, a = 5, w = x1 - x0;
    ctx.strokeStyle = col; ctx.beginPath(); ctx.moveTo(x0, y);
    for (let i = 0; i < n; i++) ctx.lineTo(x0 + (w * (i + 0.5)) / n, y + (i % 2 ? a : -a));
    ctx.lineTo(x1, y); ctx.stroke();
  }
  function coilH(ctx, x0, x1, y, col = C.Xp) {
    const n = 4, r = (x1 - x0) / (2 * n);
    ctx.strokeStyle = col; ctx.beginPath(); ctx.moveTo(x0, y);
    for (let i = 0; i < n; i++) ctx.arc(x0 + r + 2 * r * i, y, r, Math.PI, 0);
    ctx.stroke();
  }
  function capH(ctx, x0, x1, y, col = C.Xn) {
    const m = (x0 + x1) / 2, g = 3.5, hh = 9;
    ctx.strokeStyle = col; ctx.beginPath();
    ctx.moveTo(x0, y); ctx.lineTo(m - g, y); ctx.moveTo(m + g, y); ctx.lineTo(x1, y);
    ctx.moveTo(m - g, y - hh); ctx.lineTo(m - g, y + hh); ctx.moveTo(m + g, y - hh); ctx.lineTo(m + g, y + hh);
    ctx.stroke();
  }
  // seri R-L-C: kaynaktan gelen iki uç arasında tek sıra
  function seriesRLC(ctx, x, y, w, labels) {
    ctx.save(); ctx.lineWidth = 1.6; ctx.lineCap = "round";
    const s = w / 6;
    ctx.strokeStyle = C.ink2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + s * 0.6, y); ctx.stroke();
    resistorH(ctx, x + s * 0.6, x + s * 2, y);
    ctx.strokeStyle = C.ink2; ctx.beginPath(); ctx.moveTo(x + s * 2, y); ctx.lineTo(x + s * 2.3, y); ctx.stroke();
    coilH(ctx, x + s * 2.3, x + s * 3.7, y);
    ctx.strokeStyle = C.ink2; ctx.beginPath(); ctx.moveTo(x + s * 3.7, y); ctx.lineTo(x + s * 4.2, y); ctx.stroke();
    capH(ctx, x + s * 4.2, x + s * 5.4, y);
    ctx.strokeStyle = C.ink2; ctx.beginPath(); ctx.moveTo(x + s * 5.4, y); ctx.lineTo(x + w, y); ctx.stroke();
    ctx.fillStyle = C.ink2; for (const px of [x, x + w]) { ctx.beginPath(); ctx.arc(px, y, 2.6, 0, 7); ctx.fill(); }
    if (labels) {
      label(ctx, labels[0], x + s * 1.3, y + 22, { color: C.R, align: "center", font: "num", size: 11 });
      label(ctx, labels[1], x + s * 3, y + 22, { color: C.Xp, align: "center", font: "num", size: 11 });
      label(ctx, labels[2], x + s * 4.8, y + 22, { color: C.Xn, align: "center", font: "num", size: 11 });
    }
    ctx.restore();
  }
  // paralel R ∥ L ∥ C: üç kol iki bara arasında
  function parallelRLC(ctx, x, y, w, hh, labels) {
    ctx.save(); ctx.lineWidth = 1.6; ctx.lineCap = "round";
    const yt = y, yb = y + hh, cols = [x + w * 0.2, x + w * 0.5, x + w * 0.8];
    ctx.strokeStyle = C.ink2; ctx.beginPath();
    ctx.moveTo(x, yt); ctx.lineTo(cols[2], yt); ctx.moveTo(x, yb); ctx.lineTo(cols[2], yb); ctx.stroke();
    const part = [resistorH, coilH, capH], col = [C.R, C.Xp, C.Xn];
    cols.forEach((cx_, i) => {
      ctx.save(); ctx.translate(cx_, yt); ctx.rotate(Math.PI / 2);
      ctx.strokeStyle = C.ink2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(hh * 0.18, 0); ctx.moveTo(hh * 0.82, 0); ctx.lineTo(hh, 0); ctx.stroke();
      part[i](ctx, hh * 0.18, hh * 0.82, 0, col[i]);
      ctx.restore();
      if (labels) label(ctx, labels[i], cx_ + 13, yt + hh / 2 + 4, { color: col[i], font: "num", size: 11 });
    });
    ctx.fillStyle = C.ink2; for (const py of [yt, yb]) { ctx.beginPath(); ctx.arc(x, py, 2.6, 0, 7); ctx.fill(); }
    ctx.restore();
  }

  /* =====================================================================
     1) Empedans nedir: seri R-L-C
     ===================================================================== */
  Demos.ch4Imp = function (stage) {
    let f = 7e6, R = 50, Lh = 1e-6, Cf = 100e-12;
    const XS = 400; // düzlemin dikey yarı aralığı (Ω)
    const FMIN = 1e6, FMAX = 1e8;
    const cv = h("canvas", { "aria-label": "Karmaşık empedans düzlemi ve frekansa göre reaktans eğrileri" });
    const fill = h("div.fill", cv);
    const ro = { xl: readout("X_L (bobin)", "c-xp"), xc: readout("X_C (kondansatör)", "c-xn"), x: readout("Toplam X"), z: readout("Z = R + jX", "c-tot"), m: readout("|Z|"), f0: readout("Rezonans f₀") };
    const roRow = h("div.readouts.ch4-ro", Object.values(ro));
    const sF = slider({ label: "Frekans", min: FMIN, max: FMAX, value: f, log: true, fmt: mhz, oninput: (v) => { f = v; draw(); } });
    const sR = slider({ label: "Direnç R", min: 0, max: 200, step: 1, value: R, cls: "c-r", fmt: (v) => ohm(v), oninput: (v) => { R = v; draw(); } });
    const sL = slider({ label: "Bobin L", min: 0.1e-6, max: 10e-6, value: Lh, log: true, cls: "c-xp", fmt: henry, oninput: (v) => { Lh = v; draw(); } });
    const sC = slider({ label: "Kondansatör C", min: 10e-12, max: 1000e-12, value: Cf, log: true, cls: "c-xn", fmt: farad, oninput: (v) => { Cf = v; draw(); } });
    const ctrl = h("div.controls", sF, sR, sL, sC);
    stage.append(fill, roRow, ctrl);
    let B = null;
    const st = canvas(cv, draw);

    pointer(cv, {
      down: (x, y) => setF(x, y), move: (x, y) => setF(x, y),
    });
    function setF(x, y) {
      if (!B || x < B.x || x > B.x + B.w || y < B.y - 10 || y > B.y + B.h + 10) return;
      f = FMIN * Math.pow(FMAX / FMIN, clamp((x - B.x) / B.w, 0, 1));
      sF.set(f); draw();
    }

    function draw() {
      const { ctx, w, h: H } = st;
      if (!w) return;
      ctx.clearRect(0, 0, w, H);
      const XL = RF.xL(Lh, f), XC = RF.xC(Cf, f), X = XL + XC;
      const Z = RF.cx(R, X), f0 = RF.resonance(Lh, Cf);
      ro.xl.set(jx(XL)); ro.xc.set(jx(XC)); ro.x.set(jx(X));
      ro.x.className = "readout " + (X >= 0 ? "c-xp" : "c-xn");
      ro.z.set(ohm(Z)); ro.m.set(ohm(CX.abs(Z))); ro.f0.set(mhz(f0));
      const wide = w >= 620;
      let A;
      if (wide) { A = { x: 12, y: 12, w: w * 0.44 - 18, h: H - 24 }; B = { x: w * 0.44 + 26, y: 34, w: w * 0.56 - 44, h: H - 70 }; }
      else { A = { x: 10, y: 10, w: w - 20, h: H * 0.55 - 14 }; B = { x: 36, y: H * 0.55 + 22, w: w - 50, h: H * 0.45 - 48 }; }

      /* --- karmaşık düzlem --- */
      const ox = A.x + 46, oy = A.y + A.h / 2;
      const s = (A.h / 2 - 22) / XS;
      const rVis = (A.x + A.w - 10 - ox) / s;
      ctx.save();
      ctx.lineWidth = 1;
      for (let v = -XS; v <= XS; v += 50) {
        ctx.strokeStyle = v % 100 ? "rgba(150,196,235,0.05)" : C.grid;
        ctx.beginPath(); ctx.moveTo(ox, oy - v * s + 0.5); ctx.lineTo(A.x + A.w - 10, oy - v * s + 0.5); ctx.stroke();
        if (v && !(v % 100) && s * 100 > 22) label(ctx, (v > 0 ? "+" : "−") + num(Math.abs(v)), ox - 6, oy - v * s + 4, { align: "right", size: 10, font: "num", color: v > 0 ? rgba(C.Xp, 0.8) : rgba(C.Xn, 0.8) });
      }
      const rStep = [50, 100, 200, 250, 500, 1000].find((v) => rVis / v <= 5) || 2000;
      for (let v = rStep; v < rVis; v += rStep) {
        ctx.strokeStyle = C.grid; ctx.beginPath(); ctx.moveTo(ox + v * s + 0.5, oy - XS * s); ctx.lineTo(ox + v * s + 0.5, oy + XS * s); ctx.stroke();
        label(ctx, num(v), ox + v * s, oy + 14, { align: "center", size: 10, font: "num", color: rgba(C.R, 0.75) });
      }
      // eksenler
      ctx.strokeStyle = rgba(C.R, 0.7); ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(A.x + A.w - 10, oy); ctx.stroke();
      ctx.strokeStyle = C.line2; ctx.beginPath(); ctx.moveTo(ox, oy - XS * s); ctx.lineTo(ox, oy + XS * s); ctx.stroke();
      label(ctx, "R (direnç) →", A.x + A.w - 12, oy - 8, { align: "right", color: C.R, size: 12, weight: 600 });
      label(ctx, "+X endüktif ↑", A.x + A.w - 12, oy - XS * s + 12, { color: C.Xp, weight: 600, align: "right" });
      label(ctx, "−X kapasitif ↓", A.x + A.w - 12, oy + XS * s - 4, { color: C.Xn, weight: 600, align: "right" });
      label(ctx, "Ω", ox - 6, oy + 4, { align: "right", size: 10, font: "num", color: C.muted });
      ctx.restore();

      const yOf = (v) => oy - clamp(v, -XS, XS) * s;
      const xR = ox + Math.min(R, rVis) * s;
      // frekans değişince noktanın gezdiği çizgi: seri devrede R sabit, yalnızca X değişir
      ctx.save(); ctx.setLineDash([3, 5]); ctx.strokeStyle = rgba(C.tot, 0.22); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(xR, oy - XS * s); ctx.lineTo(xR, oy + XS * s); ctx.stroke(); ctx.restore();
      // |Z| doğrusu
      ctx.save(); ctx.setLineDash([5, 4]); ctx.strokeStyle = rgba(C.tot, 0.6); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(xR, yOf(X)); ctx.stroke(); ctx.restore();
      // R çubuğu
      ctx.save(); ctx.strokeStyle = C.R; ctx.lineWidth = 5; ctx.lineCap = "round"; ctx.shadowColor = C.R; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(xR, oy); ctx.stroke(); ctx.restore();
      // X_L oku (yukarı) ve ucundan X_C oku (aşağı): uç uca toplama
      const yL = yOf(XL), yT = yOf(X);
      if (Math.abs(oy - yL) > 6) V.arrow(ctx, xR - 6, oy, xR - 6, yL, C.Xp, 3, 9);
      if (Math.abs(yL - yT) > 6) V.arrow(ctx, xR + 6, yL, xR + 6, yT, C.Xn, 3, 9);
      // etiketler: X_L okun solunda (yer yoksa sağında), X_C sağında; üst üste binmesinler
      const top = oy - XS * s + 30, bot = oy + XS * s - 28;
      const sL = "X_L " + jx(XL), sC_ = "X_C " + jx(XC), sZ = "Z = " + ohm(Z);
      const wL = richWidth(ctx, sL, 11, 500, FONT.num);
      const leftOK = xR - 14 - wL > A.x + 4;
      const items = [
        { s: sL, y: clamp((oy + yL) / 2, top, bot), x: leftOK ? xR - 14 : xR + 16, al: leftOK ? "right" : "left", col: C.Xp, size: 11 },
        { s: sC_, y: clamp((yL + yT) / 2, top, bot), x: xR + 16, al: "left", col: C.Xn, size: 11 },
        { s: sZ, y: clamp(yT + (X >= 0 ? -18 : 18), top, bot), x: xR + 16, al: "left", col: C.tot, size: 12 },
      ];
      const right = items.filter((it) => it.al === "left").sort((p, q) => p.y - q.y);
      for (let k = 1; k < right.length; k++) if (right[k].y - right[k - 1].y < 20) right[k].y = right[k - 1].y + 20;
      for (const it of items) tag(ctx, it.s, it.x, it.y, it.col, { align: it.al, size: it.size });
      if (R > rVis) tag(ctx, "R → " + ohm(R), xR - 6, oy + 26, C.R, { align: "right", size: 11 });
      dot(ctx, xR, yT, C.tot, 6.5);
      // ölçek dışı: nokta kenarda, ok yönü gösterir
      if (Math.abs(X) > XS) V.arrow(ctx, xR, yT + (X > 0 ? 14 : -14), xR, yT + (X > 0 ? -2 : 2), C.tot, 2, 8);
      V.corners(ctx, A.x, A.y, A.w, A.h, 10);

      /* --- reaktans eğrileri --- */
      ctx.save();
      V.graticule(ctx, B.x, B.y, B.w, B.h, 10, 8);
      const u = (fr) => Math.log(fr / FMIN) / Math.log(FMAX / FMIN);
      const xOfF = (fr) => B.x + u(fr) * B.w;
      ctx.beginPath(); ctx.rect(B.x, B.y, B.w, B.h); ctx.clip();
      const fAt = (t) => FMIN * Math.pow(FMAX / FMIN, t);
      V.fn(ctx, (t) => RF.xL(Lh, fAt(t)), 0, 1, B.x, B.y, B.w, B.h, -XS, XS, C.Xp, 2.2, { glow: 6 });
      V.fn(ctx, (t) => RF.xC(Cf, fAt(t)), 0, 1, B.x, B.y, B.w, B.h, -XS, XS, C.Xn, 2.2, { glow: 6 });
      V.fn(ctx, (t) => RF.xL(Lh, fAt(t)) + RF.xC(Cf, fAt(t)), 0, 1, B.x, B.y, B.w, B.h, -XS, XS, C.tot, 1.6, { dash: [6, 4] });
      ctx.restore();
      const yB = (v) => B.y + B.h / 2 - (clamp(v, -XS, XS) / XS) * (B.h / 2);
      // frekans eksen etiketleri
      for (const fr of [1e6, 2e6, 5e6, 1e7, 2e7, 5e7, 1e8]) {
        const x = xOfF(fr), major = fr === 1e6 || fr === 1e7 || fr === 1e8;
        ctx.strokeStyle = major ? C.grid2 : C.grid; ctx.beginPath(); ctx.moveTo(x, B.y + B.h); ctx.lineTo(x, B.y + B.h + 5); ctx.stroke();
        if (major || B.w > 300) label(ctx, num(fr / 1e6, 0) + (fr === 1e8 ? " MHz" : ""), x, B.y + B.h + 16, { align: fr === 1e8 ? "right" : "center", size: 10, font: "num", color: C.muted });
      }
      label(ctx, "0", B.x - 4, B.y + B.h / 2 + 4, { align: "right", size: 10, font: "num", color: C.muted });
      // rezonans: toplam X sıfırdan geçer
      if (f0 > FMIN && f0 < FMAX) {
        const x0 = xOfF(f0);
        ctx.save(); ctx.setLineDash([2, 4]); ctx.strokeStyle = rgba(C.tot, 0.4);
        ctx.beginPath(); ctx.moveTo(x0, B.y); ctx.lineTo(x0, B.y + B.h); ctx.stroke(); ctx.restore();
        tag(ctx, "f₀ " + mhz(f0), x0 + 6, B.y + B.h / 2 + 14, C.tot, { size: 11 });
      }
      // imleç
      const xc = xOfF(f);
      ctx.save(); ctx.strokeStyle = rgba(C.copper, 0.85); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(xc, B.y - 6); ctx.lineTo(xc, B.y + B.h); ctx.stroke(); ctx.restore();
      dot(ctx, xc, yB(XL), C.Xp, 4); dot(ctx, xc, yB(XC), C.Xn, 4); dot(ctx, xc, yB(X), C.tot, 4);
      tag(ctx, mhz(f), xc, B.y - 14, C.copper, { align: "center", size: 11 });
      // eğri adları
      label(ctx, "X_L = 2πfL", B.x + B.w - 6, B.y + 16, { align: "right", color: C.Xp, font: "num", size: 11 });
      label(ctx, "X_C = −1/(2πfC)", B.x + B.w - 6, B.y + B.h - 8, { align: "right", color: C.Xn, font: "num", size: 11 });
      // şema
      if (B.w > 300) {
        seriesRLC(ctx, B.x + 12, B.y + 22, Math.min(170, B.w * 0.4), ["R", "L", "C"]);
      }
      V.corners(ctx, B.x - 4, B.y - 4, B.w + 8, B.h + 8, 8);
    }
    return { enter() {}, leave() {} };
  };

  /* =====================================================================
     2) Rezonans: seri / paralel LC, |Z| eğrisi, Q ve bant genişliği, salıncak
     ===================================================================== */
  Demos.ch4Res = function (stage) {
    let mode = "series", f = 11e6, Rs = 10, Rp = 2000, Cf = 100e-12, phase = 0;
    const Lh = 1e-6, FMIN = 5e6, FMAX = 50e6, ZMIN = 1, ZMAX = 1e5;
    const cv = h("canvas", { "aria-label": "Frekansa göre empedans büyüklüğü, rezonans tepesi ve salıncak benzetmesi" });
    const fill = h("div.fill", cv);
    const ro = { f0: readout("Rezonans f₀", "c-tot"), q: readout("Q"), bw: readout("Bant genişliği f₀/Q"), z: readout("|Z| imleçte"), a: readout("Salınım (tepeye göre)", "c-cu") };
    const roRow = h("div.readouts.ch4-ro", Object.values(ro));
    const sF = slider({ label: "Frekans", min: FMIN, max: FMAX, value: f, log: true, fmt: mhz, oninput: (v) => { f = v; draw(); } });
    const sRs = slider({ label: "Direnç R (seri)", min: 1, max: 100, value: Rs, log: true, cls: "c-r", fmt: (v) => ohm(v), oninput: (v) => { Rs = v; draw(); } });
    const sRp = slider({ label: "Direnç R (paralel)", min: 200, max: 20000, value: Rp, log: true, cls: "c-r", fmt: (v) => ohm(v), oninput: (v) => { Rp = v; draw(); } });
    const sC = slider({ label: "Kondansatör C", min: 30e-12, max: 300e-12, value: Cf, log: true, cls: "c-xn", fmt: farad, oninput: (v) => { Cf = v; draw(); } });
    sRp.style.display = "none";
    const sg = seg([["series", "Seri LC"], ["parallel", "Paralel LC"]], mode, (k) => {
      mode = k; sRs.style.display = k === "series" ? "" : "none"; sRp.style.display = k === "parallel" ? "" : "none"; draw();
    }, "Devre türü");
    const ctrl = h("div.controls", sg, sF, sRs, sRp, sC);
    stage.append(fill, roRow, ctrl);
    let P = null;
    const st = canvas(cv, draw);
    pointer(cv, { down: (x, y) => setF(x), move: (x, y) => setF(x) });
    function setF(x) {
      if (!P || x < P.x || x > P.x + P.w) return;
      f = FMIN * Math.pow(FMAX / FMIN, (x - P.x) / P.w); sF.set(f); draw();
    }
    const R = () => (mode === "series" ? Rs : Rp);
    function zAt(fr) {
      const zl = RF.zL(Lh, fr), zc = RF.zC(Cf, fr);
      if (mode === "series") return CX.add(CX.add(RF.cx(Rs, 0), zl), zc);
      return RF.zParallel(RF.zParallel(RF.cx(Rp, 0), zl), zc);
    }
    const magAt = (fr) => CX.abs(zAt(fr));
    // yarım güç noktaları: seri |Z| = √2·R, paralel |Z| = R/√2 (ikiye bölmeyle ölçülür)
    function halfPower(f0) {
      const lvl = mode === "series" ? Math.SQRT2 * Rs : Rp / Math.SQRT2;
      const side = (a, b) => {
        for (let i = 0; i < 80; i++) {
          const m = Math.sqrt(a * b), far = mode === "series" ? magAt(m) > lvl : magAt(m) < lvl;
          const aFar = mode === "series" ? magAt(a) > lvl : magAt(a) < lvl;
          if (far === aFar) a = m; else b = m;
        }
        return Math.sqrt(a * b);
      };
      return { lvl, f1: side(f0 / 100, f0), f2: side(f0 * 100, f0) };
    }
    // salıncak: kalıcı durumda sürücünün ritminde salınır; genlik = tepeye göre tepki
    function response(fr) { return mode === "series" ? Rs / magAt(fr) : magAt(fr) / Rp; }

    function draw() {
      const { ctx, w, h: H } = st;
      if (!w) return;
      ctx.clearRect(0, 0, w, H);
      const f0 = RF.resonance(Lh, Cf);
      const Q = mode === "series" ? RF.qSeries(Rs, Lh, Cf) : RF.qParallel(Rp, Lh, Cf);
      const BW = f0 / Q, hp = halfPower(f0), A = response(f);
      ro.f0.set(mhz(f0)); ro.q.set(sig(Q, 3)); ro.bw.set(BW >= 1e6 ? mhz(BW) : num(BW / 1e3, 0) + " kHz");
      ro.z.set(ohm(magAt(f))); ro.a.set("%" + num(A * 100, 0));
      const narrow = w < 560;
      P = { x: narrow ? 50 : 64, y: 26, w: w - (narrow ? 66 : 90), h: H - 62 };
      const u = (fr) => Math.log(fr / FMIN) / Math.log(FMAX / FMIN);
      const xOf = (fr) => P.x + u(fr) * P.w;
      const yOf = (z) => P.y + P.h - (Math.log10(clamp(z, ZMIN, ZMAX) / ZMIN) / Math.log10(ZMAX / ZMIN)) * P.h;
      // ızgara: on yıllar
      ctx.save(); ctx.lineWidth = 1;
      for (let k = 0; k <= 5; k++) {
        const y = Math.round(yOf(Math.pow(10, k))) + 0.5;
        ctx.strokeStyle = C.grid; ctx.beginPath(); ctx.moveTo(P.x, y); ctx.lineTo(P.x + P.w, y); ctx.stroke();
        label(ctx, ohmTick(Math.pow(10, k)), P.x - 6, y + 4, { align: "right", size: 10, font: "num", color: C.muted });
      }
      for (const fr of [5e6, 1e7, 2e7, 3e7, 5e7]) {
        const x = Math.round(xOf(fr)) + 0.5;
        ctx.strokeStyle = C.grid; ctx.beginPath(); ctx.moveTo(x, P.y); ctx.lineTo(x, P.y + P.h); ctx.stroke();
        label(ctx, num(fr / 1e6, 0) + (fr === FMAX ? " MHz" : ""), x, P.y + P.h + 16, { align: fr === FMAX ? "right" : "center", size: 10, font: "num", color: C.muted });
      }
      ctx.restore();
      label(ctx, "|Z|", P.x - 6, P.y - 10, { align: "right", size: 11, color: C.ink2, weight: 600 });
      ctx.save(); ctx.beginPath(); ctx.rect(P.x, P.y, P.w, P.h); ctx.clip();
      const fAt = (t) => FMIN * Math.pow(FMAX / FMIN, t);
      const yv = (z) => Math.log10(clamp(z, ZMIN * 0.5, ZMAX * 2)); // log ölçek için fn() aralığı
      const lo = Math.log10(ZMIN), hi = Math.log10(ZMAX);
      // reaktans asimptotları: X_L ve |X_C| log-log'da düz çizgi; f₀'da kesişirler
      V.fn(ctx, (t) => yv(RF.xL(Lh, fAt(t))), 0, 1, P.x, P.y, P.w, P.h, lo, hi, rgba(C.Xp, 0.55), 1.4, { dash: [5, 4] });
      V.fn(ctx, (t) => yv(-RF.xC(Cf, fAt(t))), 0, 1, P.x, P.y, P.w, P.h, lo, hi, rgba(C.Xn, 0.55), 1.4, { dash: [5, 4] });
      // direnç düzeyi
      ctx.strokeStyle = rgba(C.R, 0.45); ctx.setLineDash([2, 4]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(P.x, yOf(R())); ctx.lineTo(P.x + P.w, yOf(R())); ctx.stroke(); ctx.setLineDash([]);
      // |Z| eğrisi (sivri tepeyi kaçırmamak için sık örnek)
      V.fn(ctx, (t) => yv(magAt(fAt(t))), 0, 1, P.x, P.y, P.w, P.h, lo, hi, C.tot, 2.6, { glow: 10, samples: Math.round(P.w * 3) });
      ctx.restore();
      label(ctx, "X_L", xOf(FMAX) - 6, yOf(RF.xL(Lh, FMAX)) - 8, { align: "right", color: C.Xp, font: "num", size: 11 });
      label(ctx, "|X_C|", xOf(FMIN) + 6, yOf(-RF.xC(Cf, FMIN)) - 8, { color: C.Xn, font: "num", size: 11 });
      label(ctx, "R = " + ohm(R()), P.x + 6, yOf(R()) + (mode === "series" ? -6 : 14), { color: C.R, font: "num", size: 11 });
      // yarım güç noktaları ve bant genişliği ölçü çizgisi
      const y3 = yOf(hp.lvl);
      if (xOf(hp.f2) - xOf(hp.f1) > 3) {
        dot(ctx, xOf(hp.f1), y3, C.copper, 3.5); dot(ctx, xOf(hp.f2), y3, C.copper, 3.5);
      }
      const yd = mode === "series" ? Math.min(P.y + P.h - 14, y3 + 34) : Math.max(P.y + 12, y3 - 34);
      const x1 = xOf(hp.f1), x2 = xOf(hp.f2);
      if (x2 - x1 > 26) V.dimension(ctx, x1, yd, x2, yd, "BW " + (BW >= 1e6 ? mhz(BW) : num(BW / 1e3, 0) + " kHz"), { color: C.copper, size: 11 });
      else tag(ctx, "BW " + (BW >= 1e6 ? mhz(BW) : num(BW / 1e3, 0) + " kHz"), (x1 + x2) / 2 + 10, yd, C.copper, { size: 11 });
      // f₀
      const x0 = xOf(f0);
      tag(ctx, "f₀ " + mhz(f0), x0 + 8, P.y + P.h - 12, C.tot, { size: 11 });
      // imleç
      const xc = xOf(f);
      ctx.save(); ctx.strokeStyle = rgba(C.copper, 0.8); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(xc, P.y); ctx.lineTo(xc, P.y + P.h); ctx.stroke(); ctx.restore();
      dot(ctx, xc, yOf(magAt(f)), C.copper, 5);
      // salıncak kutusu
      const sw = narrow ? 124 : 170, sh = narrow ? 118 : 144;
      const bx = mode === "series" && !narrow ? P.x + P.w - sw - 8 : P.x + 8, by = P.y + 8;
      ctx.save();
      ctx.fillStyle = "rgba(8,23,38,0.78)"; ctx.strokeStyle = C.line; ctx.lineWidth = 1;
      ctx.fillRect(bx, by, sw, sh); ctx.strokeRect(bx + 0.5, by + 0.5, sw, sh);
      const px = bx + sw / 2, py = by + 14, rope = sh - 66;
      ctx.strokeStyle = C.line2; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(bx + 14, py); ctx.lineTo(bx + sw - 14, py); ctx.stroke();
      const amax = 0.95, th = amax * A * Math.sin(phase);
      // genlik yayı
      ctx.strokeStyle = rgba(C.copper, 0.25); ctx.lineWidth = 6; ctx.lineCap = "round";
      ctx.beginPath(); ctx.arc(px, py, rope + 4, Math.PI / 2 - amax * A, Math.PI / 2 + amax * A); ctx.stroke();
      const sx = px + rope * Math.sin(th), sy = py + rope * Math.cos(th);
      ctx.strokeStyle = C.ink2; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(px - 6, py); ctx.lineTo(sx - 6 * Math.cos(th), sy + 6 * Math.sin(th));
      ctx.moveTo(px + 6, py); ctx.lineTo(sx + 6 * Math.cos(th), sy - 6 * Math.sin(th)); ctx.stroke();
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(-th);
      ctx.fillStyle = C.copper; ctx.fillRect(-12, -2, 24, 5);
      ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(0, -15, 5, 0, 7); ctx.fill();
      ctx.strokeStyle = C.ink; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(0, -2); ctx.stroke();
      ctx.restore();
      label(ctx, "itme ritmi " + mhz(f), bx + 8, by + sh - 18, { size: 10, font: "num", color: C.copper });
      label(ctx, "kendi ritmi " + mhz(f0), bx + 8, by + sh - 6, { size: 10, font: "num", color: C.tot });
      ctx.restore();
      // şema
      if (!narrow) {
        const sx0 = mode === "series" ? P.x + 12 : P.x + P.w - 150, sy0 = P.y + 18;
        if (mode === "series") seriesRLC(ctx, sx0, sy0 + 4, 150, ["R", "L", "C"]);
        else parallelRLC(ctx, sx0, sy0, 120, 48, ["R", "L", "C"]);
      }
      V.corners(ctx, P.x - 4, P.y - 4, P.w + 8, P.h + 8, 8);
    }
    const lp = loop((dt) => {
      // görsel ritim: f₀'da 1,4 s'lik periyot, sürücü frekansıyla orantılı
      phase += dt * (2 * Math.PI / 1.4) * (f / RF.resonance(Lh, Cf));
      draw();
    });
    return { enter() { lp.start(); }, leave() { lp.stop(); } };
  };

  /* =====================================================================
     3) Hat dönüşümü: giriş empedansı hat boyunca
     ===================================================================== */
  Demos.ch4Line = function (stage) {
    const LOADS = {
      a: RF.cx(100, 0), b: RF.cx(20, 0), c: RF.cx(30, -40), sc: RF.cx(0, 0), oc: RF.cx(Infinity, 0),
    };
    let key = "a", ZL = LOADS.a, d = 0.1, anim = null;
    const cv = h("canvas", { "aria-label": "Yükten uzaklığa göre giriş empedansı; hat çizimi ve küçük Smith önizlemesi" });
    const fill = h("div.fill", cv);
    const ro = { d: readout("Hat uzunluğu"), zin: readout("Girişte görülen Z_giriş", "c-tot"), zl: readout("Yük Z_L", "c-cu"), inv: readout("Z₀²/Z_L (λ/4'te beklenen)") };
    const roRow = h("div.readouts.ch4-ro", Object.values(ro));
    const sD = slider({ label: "Hat uzunluğu", min: 0, max: 1, step: 0.002, value: d, fmt: (v) => wl(v), oninput: (v) => { anim = null; d = v; draw(); } });
    const lbl = (z) => (z.re === Infinity ? "Açık devre" : z.re === 0 && z.im === 0 ? "Kısa devre" : ohm(z, 2));
    const sg = seg(Object.keys(LOADS).map((k) => [k, lbl(LOADS[k])]), key, (k) => { key = k; ZL = LOADS[k]; draw(); }, "Yük");
    const go = (t) => { anim = { from: d, to: t, t: 0 }; };
    const bQ = h("button.btn", { type: "button", onclick: () => go(0.25) }, "λ/4");
    const bH = h("button.btn", { type: "button", onclick: () => go(0.5) }, "λ/2");
    const ctrl = h("div.controls", sD, bQ, bH, sg);
    stage.append(fill, roRow, ctrl);
    let G = null;
    const st = canvas(cv, draw);
    pointer(cv, { down: (x) => setD(x), move: (x) => setD(x) });
    function setD(x) {
      if (!G) return;
      anim = null;
      d = clamp((G.x1 - x) / (G.x1 - G.x0), 0, 1);
      d = Math.round(d / 0.002) * 0.002; sD.set(d); draw();
    }
    const zinAt = (dd) => RF.zinWl(ZL, Z0, dd);

    function draw() {
      const { ctx, w, h: H } = st;
      if (!w) return;
      ctx.clearRect(0, 0, w, H);
      const zin = zinAt(d);
      ro.d.set(wl(d) + " · " + num(degWl(d), 0) + "°");
      ro.zin.set(ohm(zin)); ro.zl.set(lbl(ZL));
      ro.inv.set(ZL.re === Infinity ? "0 Ω (kısa devre)" : ZL.re === 0 && ZL.im === 0 ? "∞ (açık devre)" : ohm(CX.div(Z0 * Z0, ZL)));
      const narrow = w < 560;
      const top = narrow ? 112 : Math.min(170, H * 0.3);
      const ms = narrow ? 0 : Math.min(top - 20, 150); // küçük Smith boyu
      const x0 = narrow ? 30 : 46, x1 = w - (ms ? ms + 64 : 70);
      G = { x0, x1 };
      const xOfD = (dd) => x1 - dd * (x1 - x0);
      /* --- hat çizimi --- */
      const ly = top * 0.42;
      ctx.save();
      // iki iletken
      ctx.strokeStyle = rgba(C.ink2, 0.55); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x0 - 16, ly - 7); ctx.lineTo(x1, ly - 7); ctx.moveTo(x0 - 16, ly + 7); ctx.lineTo(x1, ly + 7); ctx.stroke();
      // yük ile imleç arasındaki kısım parlak
      const xm = xOfD(d);
      ctx.strokeStyle = C.copper; ctx.shadowColor = C.copper; ctx.shadowBlur = 8; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.moveTo(xm, ly - 7); ctx.lineTo(x1, ly - 7); ctx.moveTo(xm, ly + 7); ctx.lineTo(x1, ly + 7); ctx.stroke();
      ctx.shadowBlur = 0;
      // yük kutusu
      ctx.fillStyle = C.deep; ctx.strokeStyle = C.copper; ctx.lineWidth = 1.5;
      ctx.fillRect(x1, ly - 16, 30, 32); ctx.strokeRect(x1 + 0.5, ly - 15.5, 30, 32);
      label(ctx, "Z_L", x1 + 15, ly + 4, { align: "center", font: "num", size: 11, color: C.copper });
      // çeyrek dalga işaretleri
      for (let k = 1; k <= 4; k++) {
        const x = xOfD(k / 4);
        ctx.strokeStyle = C.line2; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, ly - 14); ctx.lineTo(x, ly + 14); ctx.stroke();
        label(ctx, ["λ/4", "λ/2", "3λ/4", "λ"][k - 1], x, ly - 20, { align: "center", size: 10, font: "num", color: C.muted });
      }
      // imleç (ölçüm noktası)
      ctx.strokeStyle = C.tot; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(xm, ly - 22); ctx.lineTo(xm, ly + 22); ctx.stroke();
      dot(ctx, xm, ly - 7, C.tot, 4); dot(ctx, xm, ly + 7, C.tot, 4);
      ctx.restore();
      if (x1 - xm > 30) V.dimension(ctx, xm, ly + 36, x1, ly + 36, "d = " + wl(d), { size: 11 });
      label(ctx, "← kaynağa doğru", x0 - 14, ly + 32, { size: 11, color: C.muted });
      tag(ctx, "Z_giriş " + ohm(zin), clamp(xm, x0 + 60, x1 - 60), ly - 34, C.tot, { align: "center", size: 11 });

      /* --- küçük Smith önizlemesi --- */
      if (ms > 70) {
        const geo = { cx: w - ms / 2 - 18, cy: top / 2 + 4, R: ms / 2 - 6, morph: 0 };
        Smith.draw(ctx, geo, { labels: false, faint: true });
        const zl = { re: ZL.re / Z0, im: ZL.im / Z0 };
        const g = Smith.gammaOf(zl), gm = Math.hypot(g.re, g.im);
        ctx.save(); ctx.setLineDash([3, 4]); ctx.strokeStyle = rgba(C.ref, 0.6);
        ctx.beginPath(); ctx.arc(geo.cx, geo.cy, gm * geo.R, 0, 7); ctx.stroke(); ctx.restore();
        // Γ, hat boyunca saat yönünde döner: Γ(d) = Γ_L e^(−j4πd)
        const n = Math.max(2, Math.round(d * 200)), gs = [];
        for (let i = 0; i <= n; i++) gs.push(CX.mul(g, CX.polar(1, (-4 * Math.PI * d * i) / n)));
        Smith.gammaPath(ctx, geo, gs, C.tot, 2);
        const pl = Smith.gammaXY(g, geo), pi = Smith.gammaXY(gs[gs.length - 1], geo);
        dot(ctx, pl[0], pl[1], C.copper, 4); dot(ctx, pi[0], pi[1], C.tot, 4.5);
        label(ctx, "Smith önizlemesi", geo.cx, geo.cy + geo.R + 14, { align: "center", size: 10, color: C.muted });
      }

      /* --- R ve X eğrileri --- */
      const P = { x: x0, y: top + 18, w: x1 - x0, h: H - top - 46 };
      const vals = [];
      let vmax = 60;
      for (let i = 0; i <= 200; i++) { const z = zinAt(i / 200); if (isFinite(z.re)) vmax = Math.max(vmax, z.re, Math.abs(z.im)); }
      const Y = Math.min(400, Math.ceil((vmax * 1.12) / 50) * 50);
      V.graticule(ctx, P.x, P.y, P.w, P.h, 8, 8);
      const yOf = (v) => P.y + P.h / 2 - (v / Y) * (P.h / 2);
      for (const v of [Y, Y / 2, 0, -Y / 2, -Y]) label(ctx, (v > 0 ? "+" : v < 0 ? "−" : "") + num(Math.abs(v)) + (v ? "" : " Ω"), P.x - 6, yOf(v) + 4, { align: "right", size: 10, font: "num", color: v > 0 ? rgba(C.Xp, 0.75) : v < 0 ? rgba(C.Xn, 0.75) : C.muted });
      // Z₀ düzeyi
      ctx.save(); ctx.setLineDash([2, 5]); ctx.strokeStyle = rgba(C.R, 0.35);
      ctx.beginPath(); ctx.moveTo(P.x, yOf(Z0)); ctx.lineTo(P.x + P.w, yOf(Z0)); ctx.stroke(); ctx.restore();
      label(ctx, "Z₀ = " + ohm(Z0), P.x + 4, yOf(Z0) - 5, { size: 10, font: "num", color: rgba(C.R, 0.7) });
      ctx.save(); ctx.beginPath(); ctx.rect(P.x, P.y, P.w, P.h); ctx.clip();
      const N = Math.round(P.w);
      let prev = null;
      // R (kemik)
      ctx.strokeStyle = C.R; ctx.lineWidth = 2.4; ctx.shadowColor = C.R; ctx.shadowBlur = 6; ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const dd = i / N, z = zinAt(dd), x = xOfD(dd);
        const ok = isFinite(z.re);
        const y = yOf(ok ? clamp(z.re, -Y * 1.2, Y * 1.2) : Y * 1.2);
        if (prev && ok) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        prev = ok;
      }
      ctx.stroke();
      // X: işaretine göre mor ya da turkuaz; sonsuza sıçradığı yerde kopar
      ctx.lineWidth = 2.4;
      let last = null;
      for (let i = 0; i <= N; i++) {
        const dd = i / N, z = zinAt(dd), x = xOfD(dd);
        const v = isFinite(z.re) && isFinite(z.im) ? z.im : NaN;
        if (last && isFinite(v) && isFinite(last.v) && Math.abs(v - last.v) < Y * 1.5) {
          ctx.strokeStyle = (v + last.v) / 2 >= 0 ? C.Xp : C.Xn; ctx.shadowColor = ctx.strokeStyle;
          ctx.beginPath(); ctx.moveTo(last.x, yOf(clamp(last.v, -Y * 1.3, Y * 1.3))); ctx.lineTo(x, yOf(clamp(v, -Y * 1.3, Y * 1.3))); ctx.stroke();
        }
        last = { x, v };
      }
      ctx.restore();
      // imleç
      ctx.save(); ctx.strokeStyle = rgba(C.tot, 0.7); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(xm, ly + 22); ctx.lineTo(xm, P.y + P.h); ctx.stroke(); ctx.restore();
      if (isFinite(zin.re)) {
        dot(ctx, xm, yOf(clamp(zin.re, -Y, Y)), C.R, 5);
        dot(ctx, xm, yOf(clamp(zin.im, -Y, Y)), zin.im >= 0 ? C.Xp : C.Xn, 5);
      }
      for (let k = 1; k <= 4; k++) label(ctx, ["λ/4", "λ/2", "3λ/4", "λ"][k - 1], xOfD(k / 4), P.y + P.h + 16, { align: "center", size: 10, font: "num", color: C.muted });
      label(ctx, "yük", xOfD(0), P.y + P.h + 16, { align: "center", size: 10, color: C.copper });
      label(ctx, "R_giriş", P.x + P.w - 4, P.y + 14, { align: "right", color: C.R, font: "num", size: 11 });
      label(ctx, "−X_giriş", P.x + P.w - 4, P.y + 30, { align: "right", color: C.Xn, font: "num", size: 11 });
      label(ctx, "+X_giriş /", P.x + P.w - 4 - richWidth(ctx, "−X_giriş ", 11, 500, FONT.num), P.y + 30, { align: "right", color: C.Xp, font: "num", size: 11 });
      V.corners(ctx, P.x - 4, P.y - 4, P.w + 8, P.h + 8, 8);
    }
    const lp = loop((dt) => {
      if (!anim) return;
      anim.t = Math.min(1, anim.t + dt / 0.9);
      d = lerp(anim.from, anim.to, L.ease(anim.t));
      sD.set(d);
      if (anim.t >= 1) { d = anim.to; anim = null; }
      draw();
    });
    return { enter() { lp.start(); }, leave() { lp.stop(); } };
  };

  /* =====================================================================
     4) Smith abağı: ana deney
     ===================================================================== */
  // Smith düzeninde dış "dalga boyu, kaynağa doğru" ölçeği (0 solda, saat yönünde 0,5 λ'da tam tur).
  // Γ açısı θ iken ölçek okuması t = (π − θ) / 4π (mod 0,5).
  function wlScale(ctx, geo, alpha, marks) {
    const { cx: x0, cy: y0, R } = geo;
    const fs = Math.max(9, Math.min(12, R / 16));
    const r0 = R + fs * 2.5;
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.strokeStyle = C.line2; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x0, y0, r0, 0, 7); ctx.stroke();
    ctx.font = `500 ${fs - 1}px ${FONT.num}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (let i = 0; i < 50; i++) {
      const t = i / 100, th = Math.PI - 4 * Math.PI * t, big = i % 5 === 0;
      const c = Math.cos(th), s = Math.sin(th);
      ctx.strokeStyle = big ? C.ink2 : C.line2;
      ctx.beginPath(); ctx.moveTo(x0 + c * r0, y0 - s * r0); ctx.lineTo(x0 + c * (r0 + (big ? 7 : 4)), y0 - s * (r0 + (big ? 7 : 4))); ctx.stroke();
      if (big) { ctx.fillStyle = C.muted; ctx.fillText(num(t, 2), x0 + c * (r0 + fs * 1.5), y0 - s * (r0 + fs * 1.5)); }
    }
    for (const [g, col] of marks) {
      const th = Math.atan2(g.im, g.re), c = Math.cos(th), s = Math.sin(th);
      ctx.fillStyle = col; ctx.beginPath();
      ctx.moveTo(x0 + c * (r0 - 1), y0 - s * (r0 - 1));
      ctx.lineTo(x0 + c * (r0 - 9) - s * 4.5, y0 - s * (r0 - 9) - c * 4.5);
      ctx.lineTo(x0 + c * (r0 - 9) + s * 4.5, y0 - s * (r0 - 9) + c * 4.5);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  // Γ fazından ölçek okuması (λ, kaynağa doğru)
  const wlRead = (g) => { let t = (Math.PI - Math.atan2(g.im, g.re)) / (4 * Math.PI); t = ((t % 0.5) + 0.5) % 0.5; return t; };

  Demos.ch4Smith = function (stage) {
    let R = 25, X = 40, len = 0, u = 0, uT = 0, showV = true, dragging = false;
    const cv = h("canvas", { "aria-label": "Etkileşimli Smith abağı: noktayı sürükleyin; düz düzlem ile abak arasında geçiş" });
    const fill = h("div.fill", cv);
    const ro = {
      zl: readout("Yük Z_L", "c-cu"), z: readout("Normalize z = Z/Z₀"), g: readout("|Γ| ∠ faz", "c-ref"),
      s: readout("VSWR (duran dalga oranı)", "c-ref"), rl: readout("Geri dönüş kaybı"), ml: readout("Yüke giden güç"),
      l: readout("Hat"), zin: readout("Girişte görülen Z_giriş", "c-tot"),
    };
    const side = h("div.ch4-side", h("div.ch4-h", "Ölçüm (Z₀ = " + ohm(Z0) + ")"), h("div.readouts", Object.values(ro)));
    const row = h("div.ch4-row", fill, side);
    const sR = slider({ label: "Direnç R", min: 0, max: 500, step: 1, value: R, cls: "c-r", fmt: (v) => ohm(v), oninput: (v) => { R = v; dirty = true; } });
    const sX = slider({ label: "Reaktans X", min: -500, max: 500, step: 1, value: X, cls: "c-xp", fmt: (v) => jx(v), oninput: (v) => { X = v; dirty = true; } });
    const sLen = slider({ label: "Hat uzunluğu", min: 0, max: 0.5, step: 0.002, value: len, fmt: (v) => wl(v), oninput: (v) => { len = v; dirty = true; } });
    const sg = seg([["s", "Smith abağı"], ["d", "Düz düzlem"]], "s", (k) => { uT = k === "d" ? 1 : 0; }, "Görünüm");
    const tV = toggle("VSWR dairesi", showV, (v) => { showV = v; dirty = true; }, "c-ref");
    const ctrl = h("div.controls", sg, tV, sR, sX, sLen);
    stage.classList.add("ch4-big");
    stage.append(row, ctrl);
    let dirty = true, geo = null;
    const st = canvas(cv, () => { dirty = true; draw(); });

    function pick(px, py) {
      if (!geo || (u > 0.02 && u < 0.98)) return;
      let z;
      if (u >= 0.98) z = { re: ((px - geo.cx + geo.R) / (2 * geo.R)) * Smith.RMAX, im: ((geo.cy - py) / geo.R) * Smith.XMAX };
      else z = Smith.fromXY(px, py, { cx: geo.cx, cy: geo.cy, R: geo.R, morph: 0 });
      R = clamp(Math.round(z.re * Z0), 0, 500); X = clamp(Math.round(z.im * Z0), -500, 500);
      sR.set(R); sX.set(X); dirty = true;
    }
    pointer(cv, { down: (x, y) => { dragging = true; pick(x, y); }, move: (x, y) => pick(x, y), up: () => { dragging = false; dirty = true; } });

    function draw() {
      const { ctx, w, h: H } = st;
      if (!w) return;
      ctx.clearRect(0, 0, w, H);
      const big = Math.min(w, H) > 430;
      geo = Smith.fit(w, H, big ? 62 : 36);
      geo.morph = u;
      const m = u, sm = 1 - m;
      const ZL = RF.cx(R, X), zl = { re: R / Z0, im: X / Z0 };
      const G = RF.gamma(ZL, Z0), gm = CX.abs(G);
      const Zin = RF.zinWl(ZL, Z0, len), zin = { re: Zin.re / Z0, im: Zin.im / Z0 };
      const Gin = RF.gamma(Zin, Z0);
      // okumalar
      ro.zl.set(ohm(ZL)); ro.z.set(zn(zl));
      ro.g.set(num(gm, 3) + " ∠ " + deg(CX.arg(G)));
      ro.s.set(isFinite(RF.vswr(G)) ? sig(RF.vswr(G), 3) : "∞");
      ro.rl.set(db(RF.returnLoss(G), 1));
      ro.ml.set("%" + num(RF.powerDelivered(G) * 100, 1));
      ro.l.set(wl(len) + " · " + num(degWl(len), 0) + "°");
      ro.zin.set(ohm(Zin));

      // ölçü camı: köşe işaretleri
      V.corners(ctx, 8, 8, w - 16, H - 16, 12);
      if (big && sm > 0.01) wlScale(ctx, geo, sm, [[G, C.copper], [Gin, C.tot]]);
      Smith.draw(ctx, geo, { labels: true, lw: big ? 1.1 : 1 });

      // düz düzlem açıklamaları
      if (m > 0.02) {
        ctx.save(); ctx.globalAlpha = m;
        label(ctx, "R (direnç) → sonsuza uzanır", geo.cx + geo.R, geo.cy + geo.R + 18, { align: "right", color: C.R, weight: 600 });
        label(ctx, "+X ↑ sonsuza", geo.cx - geo.R + 6, geo.cy - geo.R - 8, { color: C.Xp, weight: 600 });
        label(ctx, "−X ↓ sonsuza", geo.cx - geo.R + 6, geo.cy + geo.R + 18, { color: C.Xn, weight: 600 });
        ctx.restore();
      }
      // Smith düzeni açıklamaları
      if (sm > 0.02) {
        ctx.save(); ctx.globalAlpha = sm;
        label(ctx, "kısa devre", geo.cx - geo.R + 6, geo.cy + 15, { size: 11, color: C.ink2 });
        label(ctx, "açık devre", geo.cx + geo.R - 6, geo.cy + 15, { size: 11, color: C.ink2, align: "right" });
        label(ctx, "uyum", geo.cx, geo.cy + 26, { size: 11, color: C.ok, align: "center", weight: 600 });
        if (big) {
          label(ctx, "dış ölçek: dalga boyu, kaynağa doğru ↻", 14, H - 14, { size: 11, color: C.muted });
        }
        ctx.restore();
      }
      const [mx, my] = Smith.toXY({ re: 1, im: 0 }, geo);
      ctx.beginPath(); ctx.fillStyle = C.ok; ctx.arc(mx, my, 3, 0, 7); ctx.fill();

      // görünür bölge: düz düzlemde kutunun dışını kırp
      ctx.save();
      const ex = sm * Math.max(w, H);
      ctx.beginPath(); ctx.rect(geo.cx - geo.R - ex, geo.cy - geo.R - ex, 2 * geo.R + 2 * ex, 2 * geo.R + 2 * ex); ctx.clip();
      // Γ vektörü (yalnızca abakta anlamlı)
      const [lx, ly] = Smith.toXY(zl, geo);
      if (sm > 0.05 && gm > 0.01) {
        ctx.save(); ctx.globalAlpha = sm; V.arrow(ctx, mx, my, lx, ly, rgba(C.ref, 0.9), 1.8, 9); ctx.restore();
      }
      // sabit VSWR dairesi: |Γ| sabit noktalar; düz düzlemde bükülmüş hâli görünür
      if (showV && gm > 0.005 && gm < 0.999) {
        const zs = [];
        for (let i = 0; i <= 240; i++) zs.push(Smith.zOfGamma(CX.polar(gm, (2 * Math.PI * i) / 240)));
        Smith.path(ctx, geo, zs, rgba(C.ref, 0.85), 1.6, [6, 5]);
        const [vx, vy] = Smith.toXY(Smith.zOfGamma(CX.polar(gm, Math.PI * 0.75)), geo);
        if (sm > 0.5) tag(ctx, "VSWR " + sig(RF.vswr(G), 3), vx - 6, vy - 12, C.ref, { align: "right", size: 11 });
      }
      // hat: nokta kaynağa doğru saat yönünde döner
      if (len > 0.0005) {
        const tr = Smith.trace(zl, "line", len, Math.max(8, Math.round(len * 300)));
        Smith.path(ctx, geo, tr, C.tot, 2.6);
        const a = Smith.toXY(tr[tr.length - 2], geo), b = Smith.toXY(tr[tr.length - 1], geo);
        if (Math.hypot(b[0] - a[0], b[1] - a[1]) > 0.5) V.arrow(ctx, a[0], a[1], b[0], b[1], C.tot, 2.6, 11);
        Smith.point(ctx, geo, zin, C.tot, "giriş", 6);
      }
      Smith.point(ctx, geo, zl, C.copper, "yük", dragging ? 9 : 7.5);
      ctx.restore();
      // ölçek okuması
      if (big && sm > 0.5 && len > 0.0005) {
        tag(ctx, "yük " + num(wlRead(G), 3) + " λ → giriş " + num(wlRead(Gin), 3) + " λ", w - 14, H - 14, C.ink2, { align: "right", size: 11 });
      }
      dirty = false;
    }
    const lp = loop((dt) => {
      if (u !== uT) { u = uT > u ? Math.min(uT, u + dt / 1.5) : Math.max(uT, u - dt / 1.5); dirty = true; }
      if (dirty) draw();
    });
    return { enter() { dirty = true; lp.start(); }, leave() { lp.stop(); } };
  };

  /* =====================================================================
     5) Smith'te oyna: yükü merkeze getir
     ===================================================================== */
  const OPS = {
    sL: { name: "Seri L", col: C.Xp, dash: null, kind: "series", sign: 1, max: 4 },
    sC: { name: "Seri C", col: C.Xn, dash: null, kind: "series", sign: -1, max: 4 },
    pL: { name: "Paralel L", col: C.Xp, dash: [7, 5], kind: "shunt", sign: -1, max: 4 },
    pC: { name: "Paralel C", col: C.Xn, dash: [7, 5], kind: "shunt", sign: 1, max: 4 },
    ln: { name: "Hat", col: C.tot, dash: [1, 5], kind: "line", sign: 1, max: 0.5 },
  };
  const FREQS = [7.1e6, 14.2e6, 145e6, 435e6];
  const VSWR_GOAL = 1.2;
  // bir adımın uç noktası (normalize): RF ile hesaplanır
  function applyOp(z, op, amt) {
    const o = OPS[op];
    if (o.kind === "series") return { re: z.re, im: z.im + o.sign * amt };
    if (o.kind === "shunt") { const y = CX.inv(RF.cx(z.re, z.im)); const r = CX.inv(RF.cx(y.re, y.im + o.sign * amt)); return { re: r.re, im: r.im }; }
    const zi = RF.zinWl(RF.cx(z.re * Z0, z.im * Z0), Z0, amt);
    return { re: zi.re / Z0, im: zi.im / Z0 };
  }

  Demos.ch4Game = function (stage) {
    let zL = { re: 15 / Z0, im: -25 / Z0 }, steps = [], f = FREQS[0];
    const rand = rng(1939);
    const cv = h("canvas", { "aria-label": "Smith abağında yükü merkeze getirme oyunu" });
    const fill = h("div.fill", cv);
    const goal = h("div.ch4-goal");
    const list = h("ol.ch4-steps");
    const roZ = readout("Şu anki Z", "c-tot"), roS = readout("VSWR", "c-ref");
    const side = h("div.ch4-side", h("div.ch4-h", "Eklenenler (yükten kaynağa)"), list, h("div.readouts", roZ, roS), goal);
    const row = h("div.ch4-row", fill, side);
    const btns = Object.entries(OPS).map(([k, o]) => {
      const b = h("button.btn.ch4-op", { type: "button", style: { "--opc": o.col }, onclick: () => add(k) }, o.name);
      if (o.dash) b.classList.add(k === "ln" ? "dot" : "dash");
      return b;
    });
    const sA = slider({ label: "Miktar", min: 0, max: 4, step: 0.01, value: 0, fmt: amtFmt, oninput: (v) => { if (steps.length) { steps[steps.length - 1].amt = v; render(); } } });
    const bUndo = h("button.btn", { type: "button", onclick: () => { steps.pop(); syncSlider(); render(); } }, "Geri al");
    const bNew = h("button.btn", { type: "button", onclick: newLoad }, "Yeni yük");
    const fSeg = seg(FREQS.map((fr, i) => [i, mhz(fr)]), 0, (i) => { f = FREQS[i]; render(); }, "Frekans");
    const ctrl = h("div.controls", h("div.ch4-ops", btns), sA, bUndo, bNew, h("span.ch4-fq", h("span.lab", "Frekans"), fSeg));
    stage.classList.add("ch4-big");
    stage.append(row, ctrl);
    const st = canvas(cv, draw);

    function amtFmt(v) {
      const s = steps[steps.length - 1];
      if (!s) return "—";
      const o = OPS[s.op];
      if (o.kind === "line") return wl(v, 3);
      if (o.kind === "series") return jx(o.sign * v * Z0);
      return (o.sign > 0 ? "+" : "−") + "j" + sig((v / Z0) * 1000, 3) + " mS";
    }
    function syncSlider() {
      const s = steps[steps.length - 1];
      const inp = sA.input;
      if (!s) { inp.disabled = true; sA.set(0); return; }
      inp.disabled = false;
      inp.max = OPS[s.op].max; inp.step = OPS[s.op].kind === "line" ? 0.002 : 0.01;
      sA.set(s.amt);
    }
    function add(op) {
      // son adım boşsa onun türünü değiştir
      const last = steps[steps.length - 1];
      if (last && last.amt === 0) last.op = op; else steps.push({ op, amt: 0 });
      syncSlider(); render();
    }
    function newLoad() {
      // |Γ| 0,45..0,8 arası rastgele bir yük; Ω cinsinden tam sayıya yuvarlanır
      let Z;
      do {
        const g = CX.polar(0.45 + rand() * 0.35, rand() * 2 * Math.PI);
        Z = RF.zFromGamma(g, Z0);
        Z = RF.cx(Math.round(Z.re), Math.round(Z.im));
      } while (Z.re < 5 || Z.re > 400 || Math.abs(Z.im) > 400);
      zL = { re: Z.re / Z0, im: Z.im / Z0 }; steps = []; syncSlider(); render();
    }
    function chain() {
      const pts = [zL];
      for (const s of steps) pts.push(applyOp(pts[pts.length - 1], s.op, s.amt));
      return pts;
    }
    function render() {
      const pts = chain(), end = pts[pts.length - 1];
      const Zend = RF.cx(end.re * Z0, end.im * Z0), G = RF.gamma(Zend, Z0), s = RF.vswr(G);
      roZ.set(ohm(Zend)); roS.set(isFinite(s) ? sig(s, 3) : "∞");
      sA.querySelector("output").textContent = amtFmt(sA.get());
      list.replaceChildren(h("li", h("i.ch4-sw", { style: { "--opc": C.copper } }), h("div", h("b", "Yük"), h("span", ohm(RF.cx(zL.re * Z0, zL.im * Z0))))));
      steps.forEach((st_, i) => {
        const o = OPS[st_.op];
        let val;
        if (o.kind === "series") { const Xo = o.sign * st_.amt * Z0; val = partStr(RF.reactanceToPart(Xo, f)) + " · " + jx(Xo); }
        else if (o.kind === "shunt") { const Bs = (o.sign * st_.amt) / Z0; val = partStr(RF.susceptanceToPart(Bs, f)) + " · " + (Bs < 0 ? "−" : "+") + "j" + sig(Math.abs(Bs) * 1000, 3) + " mS"; }
        else { const cab = RF.CABLES["RG-58"]; val = wl(st_.amt, 3) + " · RG-58'de " + L.meters(st_.amt * RF.wavelength(f, cab.vf)); }
        if (st_.amt === 0) val = "miktarı artırın";
        list.append(h("li" + (i === steps.length - 1 ? ".cur" : ""), h("i.ch4-sw" + (o.dash ? (st_.op === "ln" ? ".dot" : ".dash") : ""), { style: { "--opc": o.col } }), h("div", h("b", (i + 1) + ". " + o.name), h("span", val))));
      });
      const win = s <= VSWR_GOAL;
      goal.className = "ch4-goal" + (win ? " win" : "");
      goal.textContent = win ? `Merkezde! VSWR ${sig(s, 3)}, ${steps.filter((x) => x.amt > 0).length} adımda.` : `Hedef: VSWR ${num(VSWR_GOAL, 1)} altı (yeşil halka)`;
      draw();
    }

    function draw() {
      const { ctx, w, h: H } = st;
      if (!w) return;
      ctx.clearRect(0, 0, w, H);
      const geo = Smith.fit(w, H, Math.min(w, H) > 430 ? 40 : 30);
      V.corners(ctx, 8, 8, w - 16, H - 16, 12);
      Smith.draw(ctx, geo, { labels: true, admittance: true });
      // g = 1 dairesi: merkezden geçen iletkenlik dairesi (kesikli, biraz belirgin)
      ctx.save(); ctx.setLineDash([4, 5]); ctx.strokeStyle = rgba(C.R, 0.5); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(geo.cx - geo.R / 2, geo.cy, geo.R / 2, 0, 7); ctx.stroke(); ctx.restore();
      if (geo.R > 120) {
        const [gx, gy] = Smith.gammaXY({ re: -0.5, im: -0.5 }, geo);
        label(ctx, "g = 1", gx, gy + 14, { align: "center", size: 11, font: "num", color: rgba(C.R, 0.85) });
        const [rx, ry] = Smith.gammaXY({ re: 0.5, im: 0.5 }, geo);
        label(ctx, "r = 1", rx, ry - 6, { align: "center", size: 11, font: "num", color: rgba(C.R, 0.85) });
      }
      // hedef halkası
      const gGoal = RF.gammaFromVswr(VSWR_GOAL);
      const pts = chain(), end = pts[pts.length - 1];
      const win = RF.vswr(RF.gamma(RF.cx(end.re * Z0, end.im * Z0), Z0)) <= VSWR_GOAL;
      ctx.save();
      ctx.fillStyle = rgba(C.ok, win ? 0.28 : 0.12); ctx.strokeStyle = rgba(C.ok, 0.8); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(geo.cx, geo.cy, gGoal * geo.R, 0, 7); ctx.fill(); ctx.stroke();
      ctx.restore();
      // adımların izi
      steps.forEach((s, i) => {
        const o = OPS[s.op];
        if (s.amt <= 0) return;
        const tr = Smith.trace(pts[i], o.kind, o.kind === "line" ? s.amt : o.sign * s.amt, 90);
        ctx.save(); ctx.shadowColor = o.col; ctx.shadowBlur = 6;
        Smith.path(ctx, geo, tr, o.col, 3, o.dash);
        ctx.restore();
        const [x, y] = Smith.toXY(pts[i + 1], geo);
        dot(ctx, x, y, o.col, 3.5);
      });
      Smith.point(ctx, geo, zL, C.copper, "yük", 7);
      if (steps.length) Smith.point(ctx, geo, end, win ? C.ok : C.tot, null, 6);
    }
    syncSlider();
    queueMicrotask(render);
    return { enter() {}, leave() {} };
  };

  /* ---------- sözlük ---------- */
  window.GLOSSARY_EXTRA = (window.GLOSSARY_EXTRA || []).concat([
    { k: ["iletkenlik"], t: "İletkenlik (G)", d: "Admitansın gerçek kısmı: Y = G + jB. Paralel bağlı bir direncin akımı ne kadar kolay geçirdiğini gösterir; birimi siemens (S).", u: "https://en.wikipedia.org/wiki/Electrical_resistance_and_conductance" },
    { k: ["normalize empedans"], t: "Normalize empedans", d: "Empedansın karakteristik empedansa bölünmüş hâli: z = Z/Z₀. Smith abağı bu birimsiz sayıyla çalışır; 50 Ω'luk sistemde z = 1 merkezdir.", u: "https://en.wikipedia.org/wiki/Smith_chart" },
  ]);

  /* ---------- hayalet el ---------- */
  window.GUIDE_SCENARIOS = Object.assign(window.GUIDE_SCENARIOS || {}, {
    "empedans-nedir": [{ slide: "label:Frekans", to: Math.log(30e6) }, { wait: 500 }, { slide: "label:Frekans", to: Math.log(3e6) }],
    rezonans: [{ slide: "label:Frekans", to: Math.log(15.9e6) }, { wait: 900 }, { slide: "label:Direnç R (seri)", to: Math.log(2) }],
    "hat-donusumu": [{ slide: "label:Hat uzunluğu", to: 0.25 }, { wait: 700 }, { click: "=λ/2" }],
    "smith-abagi": [{ click: "=Düz düzlem" }, { wait: 2000 }, { click: "=Smith abağı" }, { wait: 1600 }, { slide: "label:Hat uzunluğu", to: 0.15 }],
    "smith-oyun": [{ click: "=Seri L" }, { slide: "label:Miktar", to: 0.96 }, { wait: 500 }, { click: "=Paralel C" }, { slide: "label:Miktar", to: 1.53 }],
  });
})();
