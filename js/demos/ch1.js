/* Bölüm 1: Dalga ve kablo.
   ch1Rope     : ipte (hatta) ilerleyen darbe; sabit uç = kısa devre (Γ = −1), serbest uç = açık devre (Γ = +1). 1B FDTD.
   ch1When     : 10 m RG-58 kablo; frekans arttıkça kablonun üstünde dalga belirir, elektriksel uzunluk.
   ch1Velocity : hız faktörü; boşluk ile kablo arasında dalga yarışı, dalga boyu hesaplayıcı. */
(function () {
  const { C, FONT, rgba, h, canvas, loop, clamp, slider, seg, toggle, num, sig, hz, meters } = L;

  // Yazı ölçüsü: dar ekranda biraz küçült
  const fs = (w, base) => (w < 520 ? base - 1.5 : base);

  // Taranmış dikdörtgen (mavi baskı kesit dolgusu)
  function hatch(ctx, x, y, w, hh, gap = 7, color = "rgba(169,191,207,0.22)") {
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, hh); ctx.clip();
    ctx.strokeStyle = color; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let s = -hh; s < w + hh; s += gap) { ctx.moveTo(x + s, y + hh); ctx.lineTo(x + s + hh, y); }
    ctx.stroke();
    ctx.restore();
  }
  // Çok renkli tek satır yazı: parts = [[metin, renk], …]
  function rich(ctx, parts, x, y, size = 12) {
    ctx.save(); ctx.font = `600 ${size}px ${FONT.display}`; ctx.textBaseline = "alphabetic";
    for (const [t, c] of parts) { ctx.fillStyle = c; ctx.fillText(t, x, y); x += ctx.measureText(t).width; }
    ctx.restore();
  }
  // Okuma penceresi
  function readout(k, cls) {
    const v = h("span.v", "—");
    const el = h("div.readout" + (cls ? "." + cls : ""), h("span.k", k), v);
    el.set = (s) => { v.textContent = s; };
    return el;
  }
  // Süreyi uygun birimle yaz
  function secs(t) {
    if (t >= 1) return sig(t, 3) + " s";
    if (t >= 1e-3) return sig(t * 1e3, 3) + " ms";
    if (t >= 1e-6) return sig(t * 1e6, 3) + " µs";
    return sig(t * 1e9, 3) + " ns";
  }

  /* ================= İpte ilerleyen dalga ================= */
  Demos.ch1Rope = function (stage) {
    const cv = h("canvas", { "aria-label": "İpte ilerleyen dalga: ileri (sarı), yansıyan (camgöbeği) ve toplam (beyaz)" });
    const legend = h("div.float.tl", h("div.legend",
      h("span", h("i", { style: { background: "var(--fwd)" } }), "İleri dalga"),
      h("span", h("i", { style: { background: "var(--ref)" } }), "Yansıyan dalga"),
      h("span", h("i", { style: { background: "var(--tot)", height: "4px" } }), "Toplam: ipin şekli")));
    const fill = h("div.fill", cv, legend);
    const rG = readout("Yansıyan / gelen (ölçülen)", "c-ref");
    const rEnd = readout("Uçtaki en büyük gerilim / gelen", "c-tot");
    const ctrl = h("div.controls");
    stage.append(fill, ctrl);

    const N = 320;
    const sim = new FDTD1D.Sim({ N, Z0: 50, Rs: 50 });
    sim.source = { kind: "pulse", width: 34, amp: 1, period: 110 };
    let end = "short", mode = "pulse";
    let acc = 0, inc = 0, refl = 0, endPk = 0;
    const PROBE = N - 60;

    function setEnd(k) { end = k; sim.load = k === "short" ? { R: 0 } : { open: true }; restart(); }
    function restart() {
      sim.source.kind = mode === "pulse" ? "pulse" : "sine";
      sim.reset(); inc = 0; refl = 0; endPk = 0; acc = 0;
      rG.set("—"); rEnd.set("—");
    }
    const endSeg = seg([["short", "Sabit uç (kısa devre)"], ["open", "Serbest uç (açık devre)"]], end, setEnd, "Uç türü");
    const modeSeg = seg([["pulse", "Tek darbe"], ["sine", "Sürekli"]], mode, (k) => { mode = k; restart(); }, "Sallama biçimi");
    const btn = h("button.btn.primary", { type: "button", onclick: () => { if (mode !== "pulse") { mode = "pulse"; modeSeg.set("pulse"); } restart(); } }, "Salla");
    ctrl.append(btn, endSeg, modeSeg, h("span.spacer"), h("div.readouts", rG, rEnd));
    sim.load = { R: 0 };

    const st = canvas(cv, draw);
    function draw() {
      const { ctx, w, h: hh } = st;
      if (!w) return;
      ctx.clearRect(0, 0, w, hh);
      const narrow = w < 560;
      const x0 = narrow ? 34 : 78, x1 = w - (narrow ? 44 : 96);
      const ropeY = hh * 0.3, A = Math.min(hh * 0.095, 76);
      V.graticule(ctx, 10, 10, w - 20, hh - 20, 12, 8);
      V.corners(ctx, 10, 10, w - 20, hh - 20, 14);
      // sıfır çizgisi (ipin durgun konumu)
      ctx.save(); ctx.strokeStyle = rgba(C.ink2, 0.25); ctx.setLineDash([2, 5]);
      ctx.beginPath(); ctx.moveTo(x0, ropeY); ctx.lineTo(x1, ropeY); ctx.stroke(); ctx.restore();
      const W = x1 - x0, ymin = -2.2, ymax = 2.2, top = ropeY - A * 2.2, H2 = A * 4.4;
      // ip: koyu kenarlı kalın beyaz çizgi
      V.trace(ctx, sim.V, x0, top, W, H2, ymin, ymax, "#06121f", 7);
      V.trace(ctx, sim.V, x0, top, W, H2, ymin, ymax, C.tot, 3.6, { glow: 10 });
      const yOf = (v) => top + H2 - ((v - ymin) / (ymax - ymin)) * H2;
      // sol uç: el (kaynak) — dikey ray üstünde kayan topuz
      ctx.save();
      ctx.strokeStyle = C.line2; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x0 - 16, ropeY - A * 1.4); ctx.lineTo(x0 - 16, ropeY + A * 1.4); ctx.stroke();
      const yh = yOf(sim.V[0]);
      ctx.strokeStyle = rgba(C.tot, 0.8); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x0 - 16, yh); ctx.lineTo(x0, yh); ctx.stroke();
      ctx.fillStyle = C.copper; ctx.beginPath(); ctx.arc(x0 - 16, yh, 7, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      V.text(ctx, "el (kaynak)", narrow ? 14 : x0 - 16, ropeY - A * 1.4 - 10, { align: narrow ? "left" : "center", size: fs(w, 12), color: C.ink2 });
      // sağ uç
      const ye = yOf(sim.V[N]);
      if (end === "short") {
        // duvar: taranmış blok, ip bir kelepçeyle sabit
        hatch(ctx, x1 + 8, ropeY - A * 1.5, 22, A * 3, 6, rgba(C.ink2, 0.4));
        ctx.save(); ctx.strokeStyle = C.ink2; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(x1 + 8, ropeY - A * 1.5); ctx.lineTo(x1 + 8, ropeY + A * 1.5); ctx.stroke();
        ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(x1 + 2, ropeY, 5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x1, ropeY); ctx.lineTo(x1 + 8, ropeY); ctx.strokeStyle = C.ink; ctx.lineWidth = 3; ctx.stroke();
        ctx.restore();
      } else {
        // serbest uç: dikey çubukta kayan halka
        ctx.save(); ctx.strokeStyle = C.ink2; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x1 + 12, ropeY - A * 2.2); ctx.lineTo(x1 + 12, ropeY + A * 2.2); ctx.stroke();
        ctx.strokeStyle = C.ink; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.ellipse(x1 + 12, ye, 9, 4, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x1, ye); ctx.lineTo(x1 + 4, ye); ctx.stroke();
        ctx.restore();
      }
      const lab = end === "short" ? ["sabit uç", "≙ kısa devre"] : ["serbest uç", "≙ açık devre"];
      const lx = narrow ? w - 16 : x1 + 14, la = narrow ? "right" : "center";
      V.text(ctx, lab[0], lx, ropeY - A * 2.2 - 22, { align: la, size: fs(w, 12), color: C.ink });
      V.text(ctx, lab[1], lx, ropeY - A * 2.2 - 7, { align: la, size: fs(w, 12), color: C.ink2 });

      // bileşenler şeridi: ileri ve yansıyan dalga ayrı ayrı (toplamları yukarıdaki ip)
      const cY = hh * 0.68, Ac = A * 0.6;
      ctx.save(); ctx.strokeStyle = rgba(C.ink2, 0.25); ctx.setLineDash([2, 5]);
      ctx.beginPath(); ctx.moveTo(x0, cY); ctx.lineTo(x1, cY); ctx.stroke(); ctx.restore();
      rich(ctx, [["bileşenler: ", C.ink2], ["ileri", C.fwd], [" + ", C.ink2], ["yansıyan", C.ref], [" = ", C.ink2], ["toplam", C.tot], [" (yukarıdaki ip)", C.ink2]], x0, cY - Ac * 2.2 - 6, fs(w, 12));
      const cTop = cY - Ac * 2.2, cH = Ac * 4.4;
      V.trace(ctx, sim.fwd, x0, cTop, W, cH, ymin, ymax, C.fwd, 2.2, { glow: 8 });
      V.trace(ctx, sim.rev, x0, cTop, W, cH, ymin, ymax, C.ref, 2.2, { glow: 8 });

      // aynı şey kabloda: iki iletkenli hat şeması, uç bağlantısıyla
      const ly = hh - (narrow ? 46 : 54), gap = 9;
      ctx.save(); ctx.strokeStyle = rgba(C.ink2, 0.7); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x0, ly - gap); ctx.lineTo(x1, ly - gap); ctx.moveTo(x0, ly + gap); ctx.lineTo(x1, ly + gap); ctx.stroke();
      if (end === "short") { ctx.strokeStyle = C.ink; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x1, ly - gap); ctx.lineTo(x1, ly + gap); ctx.stroke(); }
      else { ctx.fillStyle = C.ink2; [ly - gap, ly + gap].forEach((y) => { ctx.beginPath(); ctx.arc(x1, y, 3, 0, Math.PI * 2); ctx.fill(); }); }
      // kaynak simgesi
      ctx.strokeStyle = C.ink2; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x0 - 16, ly, 9, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x0 - 21, ly); ctx.bezierCurveTo(x0 - 18, ly - 6, x0 - 14, ly + 6, x0 - 11, ly); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x0 - 16, ly - 9); ctx.lineTo(x0 - 16, ly - gap); ctx.lineTo(x0, ly - gap); ctx.moveTo(x0 - 16, ly + 9); ctx.lineTo(x0 - 16, ly + gap); ctx.lineTo(x0, ly + gap); ctx.stroke();
      ctx.restore();
      // hattaki darbelerin konumu: iki tel arasında küçük işaretler
      const mark = (arr, col) => {
        let best = 0, bk = -1;
        for (let k = 0; k <= N; k += 2) if (Math.abs(arr[k]) > best) { best = Math.abs(arr[k]); bk = k; }
        if (best < 0.15) return;
        const px = x0 + (W * bk) / N, s = Math.sign(arr[bk]);
        ctx.save(); ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.ellipse(px, ly, 10, 4.5 * Math.min(1.6, best), 0, 0, Math.PI * 2); ctx.globalAlpha = 0.85; ctx.fill();
        ctx.restore();
        V.text(ctx, s > 0 ? "+" : "−", px, ly - gap - 6, { align: "center", size: 13, weight: 700, color: col, font: "num" });
      };
      if (mode === "pulse") { mark(sim.fwd, C.fwd); mark(sim.rev, C.ref); }
      V.text(ctx, "Kabloda aynısı: iki iletkenli hat, ucu " + (end === "short" ? "kısa devre" : "açık"), x0, ly - gap - 22, { size: fs(w, 12), color: C.ink2 });
    }

    const lp = loop((dt) => {
      acc += dt * 170;
      const n = Math.floor(acc); acc -= n;
      for (let i = 0; i < n; i++) {
        sim.step(1);
        // ölçüm: sonda noktasından geçen gelen ve yansıyan darbenin tepe değeri (işaretli)
        const f = sim.fwd[PROBE], r = sim.rev[PROBE];
        if (Math.abs(f) > Math.abs(inc)) inc = f;
        if (Math.abs(r) > Math.abs(refl)) refl = r;
        if (Math.abs(sim.V[N]) > endPk) endPk = Math.abs(sim.V[N]);
      }
      if (mode === "pulse" && Math.abs(inc) > 0.5 && Math.abs(refl) > 0.2 && sim.t > sim.source.width * 3.2 + N + (N - PROBE) + 10) {
        rG.set((refl / inc >= 0 ? "+" : "") + num(refl / inc, 2));
      }
      if (Math.abs(inc) > 0.5 && sim.t > sim.source.width * 3 + N) rEnd.set(num(endPk / Math.abs(inc), 2));
      draw();
    });
    let first = true;
    return {
      enter() { if (first) { first = false; restart(); } lp.start(); },
      leave() { lp.stop(); },
    };
  };

  /* ================= Kablo ne zaman tel değildir ================= */
  Demos.ch1When = function (stage) {
    const cv = h("canvas", { "aria-label": "10 metrelik koaksiyel kablo üzerinde gerilim dalgası ve iki uçtaki faz göstergeleri" });
    const fill = h("div.fill", cv);
    const ctrl = h("div.controls");
    stage.append(fill, ctrl);
    const LEN = 10;                               // kablo boyu (m)
    const VF = RF.CABLES["RG-58"].vf;             // katı PE koaksiyel
    const F10 = RF.c0 * VF / (10 * LEN);           // ℓ = λ/10 olduğu frekans
    const FMIN = 50, FMAX = 1e9;
    let f = 50, ph = 0;
    const rL = readout("Dalga boyu (kabloda)", "c-fwd");
    const rR = readout("Kablo / dalga boyu");
    const rD = readout("Elektriksel uzunluk");
    const rV = readout("Davranış");
    const sl = slider({ label: "Frekans", min: FMIN, max: FMAX, value: f, log: true, fmt: (v) => hz(v), oninput: (v) => { f = v; update(); }, width: "220px" });
    ctrl.append(sl, h("span.spacer"), h("div.readouts", rL, rR, rD, rV));
    // bilinen frekanslar (frekans ekseninde işaret)
    const MARKS = [[50, "şebeke"], [1e3, "ses"], [1e6, "OD radyo"], [7.1e6, "40 m bandı"], [100e6, "FM radyo"], [145e6, "2 m bandı"], [433e6, "433 MHz"]];
    function update() {
      const lam = RF.wavelength(f, VF), deg = RF.electricalLengthDeg(LEN, f, VF);
      rL.set(meters(lam)); rR.set(sig(LEN / lam, 3)); rD.set(sig(deg, 3) + "°");
      const wire = LEN < lam / 10;
      rV.set(wire ? "tel gibi" : "iletim hattı");
      rV.classList.toggle("ok", wire); rV.classList.toggle("c-fwd", !wire);
    }
    update();
    const st = canvas(cv, draw);
    function dial(ctx, cx, cy, R, a, label) {
      ctx.save();
      ctx.strokeStyle = C.line2; ctx.lineWidth = 1.5; ctx.fillStyle = rgba(C.deep, 0.7);
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      for (let i = 0; i < 12; i++) {
        const t = (i * Math.PI) / 6;
        ctx.strokeStyle = i % 3 ? C.grid2 : C.ink2; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(cx + Math.cos(t) * R * 0.82, cy + Math.sin(t) * R * 0.82); ctx.lineTo(cx + Math.cos(t) * R, cy + Math.sin(t) * R); ctx.stroke();
      }
      ctx.restore();
      V.arrow(ctx, cx, cy, cx + Math.cos(a) * R * 0.78, cy - Math.sin(a) * R * 0.78, C.fwd, 2.2, 8);
      ctx.save(); ctx.fillStyle = C.fwd; ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      V.text(ctx, label, cx, cy + R + 16, { align: "center", size: 12, color: C.ink2 });
    }
    function draw() {
      const { ctx, w, h: hh } = st;
      if (!w) return;
      ctx.clearRect(0, 0, w, hh);
      const narrow = w < 560;
      V.graticule(ctx, 10, 10, w - 20, hh - 20, 12, 8);
      V.corners(ctx, 10, 10, w - 20, hh - 20, 14);
      const lam = RF.wavelength(f, VF);
      const beta = (2 * Math.PI) / lam;
      // kablo yerleşimi
      const dR = narrow ? 24 : 40;
      const x0 = narrow ? 24 + dR * 2 + 6 : 60 + dR * 2 + 10, x1 = w - x0;
      const cy = hh * 0.36, A = Math.min(hh * 0.17, 100);
      // dış kılıf ve iç iletken (yan görünüş, kesik)
      ctx.save();
      ctx.fillStyle = rgba(C.deep, 0.8); ctx.strokeStyle = C.line2; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(x0, cy - A - 16, x1 - x0, 2 * A + 32, 12); ctx.fill(); ctx.stroke();
      hatch(ctx, x0, cy - A - 16, x1 - x0, 8, 6, rgba(C.copper, 0.35));
      hatch(ctx, x0, cy + A + 8, x1 - x0, 8, 6, rgba(C.copper, 0.35));
      ctx.strokeStyle = rgba(C.copper, 0.7); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x0, cy); ctx.lineTo(x1, cy); ctx.stroke();
      ctx.restore();
      // anlık gerilim: V(x) = cos(φ − βx), uyumlu yük (yalnız ileri dalga)
      const n = Math.max(200, Math.round((x1 - x0) / 1.5));
      ctx.save(); ctx.strokeStyle = C.fwd; ctx.lineWidth = 2.6; ctx.shadowColor = C.fwd; ctx.shadowBlur = 10;
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const x = (LEN * i) / n, v = Math.cos(ph - beta * x);
        const px = x0 + ((x1 - x0) * i) / n, py = cy - v * A * 0.8;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.stroke(); ctx.restore();
      // ölçü çizgisi: kablo boyu
      V.dimension(ctx, x0, cy - A - 34, x1, cy - A - 34, "ℓ = " + meters(LEN), { size: 12 });
      // dalga boyu ölçüsü ya da ok
      const pxPerM = (x1 - x0) / LEN, lamPx = lam * pxPerM, dy = cy + A + 40;
      if (lamPx <= (x1 - x0)) {
        const lt = "λ = " + meters(lam);
        if (lamPx > 120) V.dimension(ctx, x0, dy, x0 + lamPx, dy, lt, { color: C.fwd, size: 12 });
        else if (lamPx > 14) { V.dimension(ctx, x0, dy, x0 + lamPx, dy, "", { color: C.fwd }); V.text(ctx, lt, x0 + lamPx + 10, dy + 4, { size: 12, color: C.fwd, font: "num" }); }
        else V.text(ctx, lt + " (kablo boyunca " + sig(LEN / lam, 3) + " dalga)", (x0 + x1) / 2, dy + 4, { align: "center", size: 12, color: C.fwd, font: "num" });
      } else {
        V.arrow(ctx, x0, dy, x1 + 4, dy, rgba(C.fwd, 0.8), 1.2, 8);
        V.text(ctx, "λ = " + meters(lam) + " → kablonun " + sig(lam / LEN, 3) + " katı", (x0 + x1) / 2, dy - 6, { align: "center", size: 12, color: C.fwd, font: "num" });
      }
      // uçlardaki faz göstergeleri
      dial(ctx, x0 - dR - 8, cy, dR, ph, "giriş");
      dial(ctx, x1 + dR + 8, cy, dR, ph - beta * LEN, "çıkış");
      // faz farkı
      const deg = RF.electricalLengthDeg(LEN, f, VF);
      V.text(ctx, "iki uç arasındaki faz farkı: " + sig(deg, 3) + "°", (x0 + x1) / 2, cy + A + 78, { align: "center", size: fs(w, 15), color: C.ink, font: "num" });
      // frekans ekseni (log): tel / iletim hattı bölgeleri
      const ax0 = narrow ? 34 : 50, ax1 = w - (narrow ? 34 : 50), ay = hh - (narrow ? 50 : 56);
      const xf = (fr) => ax0 + ((Math.log(fr) - Math.log(FMIN)) / (Math.log(FMAX) - Math.log(FMIN))) * (ax1 - ax0);
      const xt = xf(F10);
      ctx.save();
      ctx.fillStyle = rgba(C.ok, 0.08); ctx.fillRect(ax0, ay - 14, xt - ax0, 28);
      ctx.fillStyle = rgba(C.fwd, 0.09); ctx.fillRect(xt, ay - 14, ax1 - xt, 28);
      ctx.strokeStyle = C.line2; ctx.beginPath(); ctx.moveTo(ax0, ay); ctx.lineTo(ax1, ay); ctx.stroke();
      ctx.strokeStyle = rgba(C.ink2, 0.6); ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(xt, ay - 22); ctx.lineTo(xt, ay + 14); ctx.stroke();
      ctx.restore();
      V.text(ctx, "tel gibi", ax0 + 6, ay - 18, { size: 12, color: C.ok });
      V.text(ctx, "iletim hattı", ax1 - 6, ay - 18, { size: 12, color: C.fwd, align: "right" });
      V.text(ctx, "ℓ = λ/10: " + hz(F10), xt, ay - 26, { size: 11, color: C.ink2, align: "center", font: "num" });
      MARKS.forEach(([fr, name], i) => {
        if (narrow && ![0, 2, 5].includes(i)) return;
        const x = xf(fr);
        ctx.save(); ctx.strokeStyle = rgba(C.ink2, 0.6); ctx.beginPath(); ctx.moveTo(x, ay - 4); ctx.lineTo(x, ay + 4); ctx.stroke(); ctx.restore();
        V.text(ctx, name, x, ay + 18 + (i % 2 && !narrow ? 13 : 0), { size: 11, color: C.muted, align: "center" });
      });
      // geçerli frekans ibresi
      const xc = xf(f);
      ctx.save(); ctx.fillStyle = C.copper; ctx.shadowColor = C.copper; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.moveTo(xc, ay - 2); ctx.lineTo(xc - 6, ay - 12); ctx.lineTo(xc + 6, ay - 12); ctx.closePath(); ctx.fill();
      ctx.restore();
      V.text(ctx, "zaman ağır çekimde", w - 22, 30, { size: 11, color: C.muted, align: "right" });
    }
    const lp = loop((dt) => { ph = (ph + dt * 2 * Math.PI * 0.45) % (2 * Math.PI * 1000); draw(); });
    return { enter() { lp.start(); }, leave() { lp.stop(); } };
  };

  /* ================= Hız faktörü: dalga yarışı ================= */
  Demos.ch1Velocity = function (stage) {
    const cv = h("canvas", { "aria-label": "Boşlukta ve kabloda aynı anda yola çıkan iki dalganın yarışı" });
    const fill = h("div.fill", cv);
    const ctrl = h("div.controls");
    stage.append(fill, ctrl);
    const KEYS = ["hava", "pe", "foam", "ptfe"];
    let key = "pe", f = 145e6, t = 0, running = false;
    const RACE = 2.6; // ışığın pisti bitirme süresi (animasyon saniyesi)
    const rE = readout("εr"), rVF = readout("Hız faktörü"), rV = readout("Kabloda hız");
    const rL0 = readout("λ boşlukta", "c-fwd"), rL1 = readout("λ kabloda", "c-fwd"), rT = readout("Gecikme");
    const dsel = seg(KEYS.map((k) => [k, RF.DIELECTRICS[k].label]), key, (k) => { key = k; update(); start(); }, "Kablo dielektriği");
    const sl = slider({ label: "Frekans", min: 1e6, max: 3e9, value: f, log: true, fmt: (v) => hz(v), oninput: (v) => { f = v; update(); }, width: "180px" });
    const go = h("button.btn.primary", { type: "button", onclick: () => start() }, "Yarıştır");
    ctrl.append(go, dsel, sl, h("div.readouts", rE, rVF, rV, rL0, rL1, rT));
    const er = () => RF.DIELECTRICS[key].er, vf = () => RF.vfFromEr(er());
    function update() {
      rE.set(num(er(), er() < 1.01 ? 4 : 2));
      rVF.set(num(vf(), 3));
      rV.set(num((vf() * RF.c0) / 1000, 0) + " km/s");
      rL0.set(meters(RF.wavelength(f)));
      rL1.set(meters(RF.wavelength(f, vf())));
      rT.set(sig(1e9 / (vf() * RF.c0), 3) + " ns/m");
      draw();
    }
    function start() { t = 0; running = true; }
    const st = canvas(cv, draw);
    function lane(ctx, x0, x1, y, A, label, v, color, isCable) {
      const W = x1 - x0, front = clamp((t / RACE) * v, 0, 1); // pist kesri
      const lam0 = RF.wavelength(f), TRACK = 5 * lam0, lam = RF.wavelength(f, v);
      const lamPx = (lam / TRACK) * W;
      // şerit
      ctx.save();
      if (isCable) {
        ctx.fillStyle = rgba(C.deep, 0.85); ctx.strokeStyle = C.line2;
        ctx.beginPath(); ctx.roundRect(x0, y - A - 14, W, 2 * A + 28, 10); ctx.fill(); ctx.stroke();
        hatch(ctx, x0 + 1, y - A - 7, W - 2, 2 * A + 14, 9, rgba(C.ink2, 0.08));
        ctx.fillStyle = rgba(C.copper, 0.5);
        ctx.fillRect(x0, y - A - 14, W, 4); ctx.fillRect(x0, y + A + 10, W, 4);
      } else {
        ctx.strokeStyle = rgba(C.ink2, 0.35); ctx.setLineDash([4, 6]);
        ctx.beginPath(); ctx.roundRect(x0, y - A - 14, W, 2 * A + 28, 10); ctx.stroke();
      }
      ctx.restore();
      V.text(ctx, label, x0, y - A - 22, { size: 13, color: C.ink, weight: 600 });
      // dalga treni: önü v hızıyla ilerler
      const fx = x0 + front * W;
      if (front > 0) {
        const n = Math.max(80, Math.round((fx - x0) / 1.5));
        ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 2.4; ctx.shadowColor = color; ctx.shadowBlur = 8;
        ctx.beginPath();
        for (let i = 0; i <= n; i++) {
          const px = x0 + ((fx - x0) * i) / n;
          const env = clamp((fx - px) / Math.max(4, lamPx * 0.25), 0, 1);
          const py = y - A * env * Math.sin((2 * Math.PI * (fx - px)) / lamPx);
          i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
        ctx.stroke(); ctx.restore();
        // dalga boyu ölçüsü: girişten başlayan bir tam dalga
        if (fx - x0 > lamPx + 4 && lamPx > 26) V.dimension(ctx, x0, y + A + 30, x0 + lamPx, y + A + 30, "λ = " + meters(lam), { color: C.fwd, size: 11 });
      }
      // varış
      const T = TRACK / (v * RF.c0);
      if (front >= 1) V.text(ctx, "vardı: " + secs(T), x1 - 6, y - A - 22, { size: 12, color: C.fwd, align: "right", font: "num" });
      else V.text(ctx, secs((t / RACE) * (TRACK / RF.c0)), x1 - 6, y - A - 22, { size: 12, color: C.muted, align: "right", font: "num" });
      return T;
    }
    function draw() {
      const { ctx, w, h: hh } = st;
      if (!w) return;
      ctx.clearRect(0, 0, w, hh);
      V.graticule(ctx, 10, 10, w - 20, hh - 20, 12, 8);
      V.corners(ctx, 10, 10, w - 20, hh - 20, 14);
      const narrow = w < 560;
      const x0 = narrow ? 22 : 46, x1 = w - (narrow ? 22 : 46);
      const A = Math.min(hh * 0.085, 42);
      const y1 = hh * 0.27, y2 = hh * 0.63;
      // başlangıç ve bitiş çizgileri
      ctx.save(); ctx.strokeStyle = rgba(C.ink2, 0.55); ctx.setLineDash([2, 4]);
      [x0, x1].forEach((x) => { ctx.beginPath(); ctx.moveTo(x, y1 - A - 40); ctx.lineTo(x, y2 + A + 44); ctx.stroke(); });
      ctx.restore();
      lane(ctx, x0, x1, y1, A, "Boşluk: ışık hızı", 1, C.fwd, false);
      lane(ctx, x0, x1, y2, A, "Kablo: " + RF.DIELECTRICS[key].label, vf(), C.fwd, true);
      const TRACK = 5 * RF.wavelength(f);
      V.dimension(ctx, x0, hh - 34, x1, hh - 34, "pist = 5 λ₀ = " + meters(TRACK), { size: 12 });
    }
    const lp = loop((dt) => {
      if (running) { t += dt; if (t > RACE / vf() + 0.2) running = false; }
      draw();
    });
    update();
    return { enter() { start(); lp.start(); }, leave() { lp.stop(); } };
  };

  window.GLOSSARY_EXTRA = (window.GLOSSARY_EXTRA || []).concat([
    { k: ["kısa devre"], t: "Kısa devre", d: "Hattın iki iletkeninin uçta doğrudan birbirine bağlanması. Uçtaki gerilim sıfırdır; gelen gerilim dalgası ters dönerek yansır (Γ = −1).", u: "https://tr.wikipedia.org/wiki/K%C4%B1sa_devre" },
    { k: ["açık devre"], t: "Açık devre", d: "Hattın ucunun hiçbir yere bağlanmadan bırakılması. Uçtan akım akamaz; gerilim dalgası aynı işaretle yansır (Γ = +1) ve uçtaki gerilim iki katına çıkar.", u: "https://en.wikipedia.org/wiki/Open-circuit_voltage" },
    { k: ["polietilen"], t: "Polietilen (PE)", d: "Koaksiyel kablolarda en yaygın dielektrik. Katı PE'de εr ≈ 2,25 (hız faktörü ≈ 0,66); köpüklü PE'de içindeki hava kabarcıkları sayesinde εr düşer, hız faktörü 0,8'in üstüne çıkar.", u: "https://tr.wikipedia.org/wiki/Polietilen" },
    { k: ["ptfe", "teflon"], t: "PTFE (teflon)", d: "Isıya dayanıklı, kayıpları çok düşük dielektrik (εr ≈ 2,1). Yüksek frekans ve yüksek sıcaklık kablolarında kullanılır.", u: "https://tr.wikipedia.org/wiki/Politetrafloroetilen" },
  ]);

  window.GUIDE_SCENARIOS = Object.assign(window.GUIDE_SCENARIOS || {}, {
    "ip-dalgasi": [{ click: "=Salla" }, { wait: 2600 }, { click: "Serbest uç" }, { click: "=Salla" }],
    "kablo-ne-zaman": [{ slide: "label:Frekans", to: Math.log(2e6) }, { wait: 600 }, { slide: "label:Frekans", to: Math.log(1.5e8) }],
    "hiz-faktoru": [{ click: "=Köpük PE" }, { wait: 300 }, { click: "=Yarıştır" }],
  });
})();
