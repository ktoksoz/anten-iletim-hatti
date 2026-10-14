/* Bölüm 5: Empedans uydurma.
   neden-uydurma (ch5Why), l-agi (ch5LMatch), ceyrek-dalga-stub (ch5Stub), balun (ch5Balun), tuner (ch5Tuner).
   Ekrandaki her sayı RF.* ile hesaplanır. Smith çizimleri yalnızca js/smith.js ile yapılır. */
(function () {
  const { C, FONT, rgba, h, canvas, loop, clamp, slider, seg, toggle, num, sig, ohm, db, hz, meters, pointer, ease } = L;
  const X = RF.C, cx = RF.cx;
  const Z0 = 50;
  const INK = "rgba(206, 224, 238, 0.82)";

  /* ---------- küçük yardımcılar ---------- */
  function readout(k, cls) {
    const v = h("span.v", "—");
    const el = h("div.readout" + (cls ? "." + cls : ""), h("span.k", k), v);
    el.set = (s, state) => {
      v.textContent = s;
      if (state !== undefined) { el.classList.toggle("ok", state === "ok"); el.classList.toggle("bad", state === "bad"); }
    };
    return el;
  }
  // Bileşen değeri: pF / nF, nH / µH
  function fmtPart(p) {
    if (!p || p.type === "none" || !isFinite(p.value)) return "—";
    const v = p.value;
    if (p.type === "L") return v >= 1e-6 ? sig(v * 1e6, 3) + " µH" : sig(v * 1e9, 3) + " nH";
    return v >= 1e-9 ? sig(v * 1e9, 3) + " nF" : sig(v * 1e12, 3) + " pF";
  }
  const partColor = (p) => (!p || p.type === "none" ? INK : p.type === "L" ? C.Xp : C.Xn);
  const partName = (p) => (!p || p.type === "none" ? "eleman yok" : p.type === "L" ? "bobin" : "kondansatör");
  // Normalize susceptans ekleyen paralel eleman: b < 0 endüktif, b > 0 kapasitif
  const susColor = (b) => (b < 0 ? C.Xp : C.Xn);
  const wl = (v) => num(v, 3) + " λ";
  const deg = (v) => num(v * 360, 1) + "°";
  const zn = (Z, z0 = Z0) => (X.isInf(Z) ? { re: 1e9, im: 0 } : X.scale(Z, 1 / z0));

  // Smith abağını dikdörtgen bir bölgeye yerleştir
  function smithIn(x, y, w, hh, pad) {
    const g = Smith.fit(w, hh, pad);
    g.cx += x; g.cy += y;
    return g;
  }

  /* ---------- mavi baskı şema çizimi ---------- */
  function wire(ctx, pts, color = INK, lw = 1.6) {
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); ctx.restore();
  }
  function dot(ctx, x, y, color = INK, r = 2.6) { ctx.save(); ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.restore(); }
  // Bir doğru parçası üzerinde bileşen: "R" | "L" | "C" | "none"
  function part(ctx, kind, x0, y0, x1, y1, color, lw = 2.2) {
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
    if (kind === "none" || !kind) { wire(ctx, [[x0, y0], [x1, y1]]); return; }
    const bl = kind === "C" ? Math.min(12, len * 0.3) : Math.min(len * 0.62, 46);
    const a = (len - bl) / 2;
    const P = (s, n) => [x0 + ux * (a + s) + nx * n, y0 + uy * (a + s) + ny * n];
    wire(ctx, [[x0, y0], P(0, 0)]); wire(ctx, [P(bl, 0), [x1, y1]]);
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.shadowColor = color; ctx.shadowBlur = 8;
    ctx.beginPath();
    if (kind === "R") {
      const n = 6, amp = 6;
      ctx.moveTo(...P(0, 0));
      for (let i = 0; i < n; i++) ctx.lineTo(...P(((i + 0.5) * bl) / n, i % 2 ? -amp : amp));
      ctx.lineTo(...P(bl, 0));
    } else if (kind === "L") {
      const n = 4, r = bl / n / 2;
      ctx.moveTo(...P(0, 0));
      for (let i = 0; i < n; i++) for (let k = 0; k <= 14; k++) {
        const t = k / 14, c0 = (i + 0.5) * 2 * r;
        ctx.lineTo(...P(c0 - r * Math.cos(Math.PI * t), -r * 1.35 * Math.sin(Math.PI * t)));
      }
    } else if (kind === "C") {
      const pw = 11;
      ctx.moveTo(...P(0, -pw)); ctx.lineTo(...P(0, pw));
      ctx.moveTo(...P(bl, -pw)); ctx.lineTo(...P(bl, pw));
    }
    ctx.stroke(); ctx.restore();
  }
  function ground(ctx, x, y, color = INK) {
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 1.6; ctx.beginPath();
    for (let i = 0; i < 3; i++) { const w = 10 - i * 3.5; ctx.moveTo(x - w, y + i * 4); ctx.lineTo(x + w, y + i * 4); }
    ctx.stroke(); ctx.restore();
  }
  function source(ctx, x, y, r = 13) {
    ctx.save(); ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke();
    ctx.strokeStyle = C.fwd; ctx.beginPath();
    for (let i = 0; i <= 20; i++) { const t = i / 20; const px = x - r * 0.6 + t * r * 1.2, py = y - Math.sin(t * 2 * Math.PI) * r * 0.38; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    ctx.stroke(); ctx.restore();
  }
  // Koaksiyel hat parçası: dış iletken iki çizgi, iç iletken orta çizgi
  function coax(ctx, x0, y0, x1, y1, w = 9, color = INK, fillA = 0.12) {
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
    ctx.save();
    ctx.fillStyle = rgba(C.line2, fillA * 3);
    ctx.beginPath();
    ctx.moveTo(x0 + nx * w, y0 + ny * w); ctx.lineTo(x1 + nx * w, y1 + ny * w);
    ctx.lineTo(x1 - nx * w, y1 - ny * w); ctx.lineTo(x0 - nx * w, y0 - ny * w); ctx.closePath(); ctx.fill();
    ctx.restore();
    wire(ctx, [[x0 + nx * w, y0 + ny * w], [x1 + nx * w, y1 + ny * w]], color, 1.3);
    wire(ctx, [[x0 - nx * w, y0 - ny * w], [x1 - nx * w, y1 - ny * w]], color, 1.3);
    wire(ctx, [[x0, y0], [x1, y1]], rgba(C.copper, 0.85), 1.4);
  }
  // Kutu (verici, tuner): mavi baskı çizgisi
  function box(ctx, x, y, w, hh, label, dashed) {
    ctx.save(); ctx.strokeStyle = INK; ctx.lineWidth = 1.3;
    if (dashed) ctx.setLineDash([5, 4]);
    ctx.fillStyle = rgba(C.deep, 0.65);
    ctx.fillRect(x, y, w, hh); ctx.strokeRect(x + 0.5, y + 0.5, w, hh);
    ctx.restore();
    if (label) V.text(ctx, label, x + 6, y - 6, { size: 12, color: C.ink2, weight: 600 });
  }

  /* ======================================================================
     1) Neden uydurma: maksimum güç aktarımı
     ====================================================================== */
  Demos.ch5Why = function (stage) {
    const cv = h("canvas", { "aria-label": "İç direnci 50 ohm olan kaynak ve yük direnci; yükte harcanan ve geri dönen güç eğrisi" });
    const fill = h("div.fill", cv);
    const PAV = 100;                       // kaynağın verebileceği en büyük güç (W)
    const RS = Z0;                         // kaynağın iç direnci
    const VS = 2 * Math.sqrt(PAV * RS);    // açık devre gerilimi (rms): PAV = VS² / 4RS
    let RL = 200;
    const ro = {
      pl: readout("Yükte harcanan", "c-fwd"), pr: readout("Geri dönen (yansıyan)", "c-ref"),
      g: readout("|Γ|"), s: readout("VSWR (vericinin gördüğü)"), k: readout("Aktarılan oran"),
    };
    const sl = slider({ label: "Yük direnci RL", min: 5, max: 500, log: true, value: RL, fmt: (v) => ohm(v), cls: "c-r", oninput: (v) => { RL = v; draw(); } });
    const ctrl = h("div.controls", sl, h("div.readouts", Object.values(ro)));
    stage.append(fill, ctrl);

    // P = V² RL / (Rs + RL)²  (gerilim bölücü); RF.powerDelivered ile aynı sonucu verir: 1 − |Γ|²
    const pLoad = (r) => (VS * VS * r) / ((RS + r) * (RS + r));
    let phase = 0;
    const st = canvas(cv, draw);
    function calc() {
      const G = RF.gamma(RL, RS), g = X.abs(G);
      const pl = pLoad(RL), pr = PAV - pl;
      return { G, g, pl, pr, chk: PAV * RF.powerDelivered(G), s: RF.vswr(G) };
    }
    function draw() {
      const { ctx, w, h: hh } = st;
      if (!w) return;
      ctx.clearRect(0, 0, w, hh);
      const c = calc();
      ro.pl.set(num(c.pl, 1) + " W");
      ro.pr.set(num(c.pr, 1) + " W");
      ro.g.set(num(c.g, 3));
      ro.s.set(isFinite(c.s) ? num(c.s, 2) + " : 1" : "∞", c.s <= 1.5 ? "ok" : c.s >= 3 ? "bad" : "");
      ro.k.set("%" + num((100 * c.pl) / PAV, 1));

      // --- şema (üst) ---
      const narrow = w < 560;
      const sh = clamp(hh * 0.36, 130, 200);
      const sx0 = 18, sx1 = w - 18, top = 34, bot = sh - 18;
      const boxW = Math.min(250, (sx1 - sx0) * 0.46);
      box(ctx, sx0, top - 12, boxW, bot - top + 24, "Verici (kaynak)", true);
      const srcX = sx0 + 34, rsX0 = sx0 + 64, rsX1 = sx0 + boxW - 18;
      const loadX = sx1 - 40;
      // kaynak, Rs, hat, RL
      wire(ctx, [[srcX, bot], [srcX, top], [rsX0, top]]);
      source(ctx, srcX, (top + bot) / 2);
      part(ctx, "R", rsX0, top, rsX1, top, C.R);
      V.text(ctx, "Rs = " + ohm(RS), (rsX0 + rsX1) / 2, top + 26, { size: 12, color: C.R, align: "center", font: "num" });
      wire(ctx, [[rsX1, top], [loadX, top], [loadX, top + 6]]);
      wire(ctx, [[srcX, bot], [loadX, bot], [loadX, bot - 6]]);
      // yükte ısınma parıltısı: harcanan güçle orantılı
      const heat = c.pl / PAV;
      ctx.save();
      const gr = ctx.createRadialGradient(loadX, (top + bot) / 2, 2, loadX, (top + bot) / 2, 30 + 30 * heat);
      gr.addColorStop(0, rgba(C.fwd, 0.45 * heat)); gr.addColorStop(1, rgba(C.fwd, 0));
      ctx.fillStyle = gr; ctx.fillRect(loadX - 70, top - 20, 140, bot - top + 40);
      ctx.restore();
      part(ctx, "R", loadX, top + 6, loadX, bot - 6, C.R);
      V.text(ctx, "RL = " + ohm(RL), loadX - 16, (top + bot) / 2 + 4, { size: 13, color: C.R, align: "right", font: "num", weight: 600 });
      // güç akışı: sarı noktalar yüke gider, camgöbeği noktalar geri döner
      const wx0 = sx0 + boxW + 6, wx1 = loadX - 14, span = wx1 - wx0;
      if (span > 30) {
        const nF = Math.round(6 * c.pl / PAV) + (c.pl > 0.5 ? 1 : 0), nR = Math.round(6 * c.pr / PAV) + (c.pr > 0.5 ? 1 : 0);
        for (let i = 0; i < nF; i++) {
          const u = (phase * 0.35 + i / Math.max(1, nF)) % 1;
          dot(ctx, wx0 + u * span, top - 7, C.fwd, 3);
        }
        for (let i = 0; i < nR; i++) {
          const u = (phase * 0.35 + i / Math.max(1, nR)) % 1;
          dot(ctx, wx1 - u * span, top + 7, C.ref, 3);
        }
        V.text(ctx, "giden güç →", wx0, top - 16, { size: 11, color: C.fwd });
        if (!narrow) V.text(ctx, "← geri dönen", wx1, top + 22, { size: 11, color: C.ref, align: "right" });
      }
      // verici koruması: yüksek VSWR'de lamba (örnek eşik)
      const ledOn = c.s >= 2;
      const lx = sx0 + boxW - 14, ly = bot - 6;
      ctx.save(); ctx.fillStyle = ledOn ? C.bad : rgba(C.ink2, 0.25); if (ledOn) { ctx.shadowColor = C.bad; ctx.shadowBlur = 12; }
      ctx.beginPath(); ctx.arc(lx, ly, 4.5, 0, 7); ctx.fill(); ctx.restore();
      V.text(ctx, ledOn ? "koruma: güç kısılır" : "koruma", lx - 9, ly + 4, { size: 11, color: ledOn ? C.bad : C.muted, align: "right" });

      // --- grafik ---
      const px0 = narrow ? 44 : 60, px1 = w - 22, py0 = sh + 30, py1 = hh - 34;
      const pw = px1 - px0, ph = py1 - py0;
      if (ph < 40) return;
      V.graticule(ctx, px0, py0, pw, ph, 10, 4, { center: false });
      const lx0 = Math.log(5), lx1 = Math.log(500);
      const X_ = (r) => px0 + ((Math.log(r) - lx0) / (lx1 - lx0)) * pw;
      const Y_ = (p) => py1 - (p / PAV) * ph;
      // eksenler
      for (const r of [5, 10, 20, 50, 100, 200, 500]) V.text(ctx, num(r), X_(r), py1 + 15, { size: 11, color: r === 50 ? C.ink : C.muted, align: "center", font: "num" });
      V.text(ctx, "RL (Ω, log)", px1, py1 + 29, { size: 11, color: C.muted, align: "right" });
      for (const p of [0, 25, 50, 75, 100]) V.text(ctx, num(p) + " W", px0 - 6, Y_(p) + 4, { size: 10.5, color: C.muted, align: "right", font: "num" });
      // eğriler
      V.fn(ctx, (u) => pLoad(Math.exp(u)), lx0, lx1, px0, py0, pw, ph, 0, PAV, C.fwd, 2.4, { glow: 8 });
      V.fn(ctx, (u) => PAV - pLoad(Math.exp(u)), lx0, lx1, px0, py0, pw, ph, 0, PAV, C.ref, 2, { dash: [6, 5] });
      // tepe: RL = Rs
      const xp = X_(RS);
      ctx.save(); ctx.strokeStyle = rgba(C.R, 0.5); ctx.setLineDash([2, 4]); ctx.beginPath(); ctx.moveTo(xp, py0); ctx.lineTo(xp, py1); ctx.stroke(); ctx.restore();
      V.text(ctx, "RL = Rs: tepe (" + num(pLoad(RS), 0) + " W)", xp, py0 - 6, { size: 11.5, color: C.R, align: "center" });
      // işaretçi
      const xm = X_(RL);
      ctx.save(); ctx.strokeStyle = rgba(C.copper, 0.8); ctx.beginPath(); ctx.moveTo(xm, py0); ctx.lineTo(xm, py1); ctx.stroke(); ctx.restore();
      dot(ctx, xm, Y_(c.pl), C.fwd, 5.5);
      dot(ctx, xm, Y_(c.pr), C.ref, 4.5);
      // gösterge açıklaması
      const lg = narrow ? py1 - 30 : py1 - 14;
      V.text(ctx, "— yükte harcanan", px0 + 8, lg, { size: 11.5, color: C.fwd });
      V.text(ctx, "- - geri dönen", px0 + 8, lg + 15, { size: 11.5, color: C.ref });
    }
    const lp = loop((dt) => { phase += dt; draw(); });
    return { enter() { lp.start(); }, leave() { lp.stop(); } };
  };

  /* ======================================================================
     2) L-ağı: iki çözüm, Smith'te adım adım
     ====================================================================== */
  Demos.ch5LMatch = function (stage) {
    const cv = h("canvas", { "aria-label": "Smith abağında L-ağı ile yük empedansını merkeze getirme ve devre şeması" });
    const fill = h("div.fill", cv);
    let R = 150, Xl = 75, f = 14.2e6, sel = 0, t = 2, playing = false;
    const ro = {
      ser: readout("Seri eleman"), sh: readout("Paralel eleman"), kind: readout("Süzgeç türü"),
      zin: readout("Kaynaktan görünen Zin", "ok"), s: readout("VSWR"),
    };
    const sR = slider({ label: "Yük direnci R", min: 5, max: 500, log: true, value: R, fmt: (v) => ohm(v), cls: "c-r", oninput: (v) => { R = v; t = 2; update(); } });
    const sX = slider({ label: "Yük reaktansı X", min: -300, max: 300, step: 1, value: Xl, fmt: (v) => (v < 0 ? "−j" : "+j") + num(Math.abs(v), 0) + " Ω", cls: "c-xp", oninput: (v) => { Xl = v; t = 2; update(); } });
    const sF = slider({ label: "Frekans", min: 1e6, max: 500e6, log: true, value: f, fmt: (v) => hz(v), oninput: (v) => { f = v; update(); } });
    const sg = seg([[0, "Çözüm 1"], [1, "Çözüm 2"]], sel, (k) => { sel = k; t = 0; playing = true; update(); }, "L-ağı çözümü");
    const play = h("button.btn.primary", { type: "button" }, "Adım adım göster");
    play.addEventListener("click", () => { t = 0; playing = true; });
    const ctrl = h("div.controls", sR, sX, sF, sg, play, h("div.readouts", Object.values(ro)));
    stage.append(fill, ctrl);

    let S = null; // hesaplanan çözüm
    function update() {
      sX.input.classList.toggle("c-xp", Xl >= 0); sX.input.classList.toggle("c-xn", Xl < 0);
      // RL ≈ Z0 iken RF.lMatch'in "shunt-load" kolu sayısal olarak hassaslaşır (1/B − Z0/(B·RL) farkı);
      // %0,2'lik bölgede yükü tam 50 Ω kabul edip tek elemanlı (seri) çözümü kullan.
      const Ru = Math.abs(R / Z0 - 1) < 2e-3 ? Z0 : R;
      const ZL = cx(Ru, Xl);
      const sols = RF.lMatch(ZL, Z0, f);
      if (!sols.length) { S = null; return; }
      if (sel >= sols.length) sel = 0;
      const type = (s) => {
        const a = s.series.type, b = s.shunt.type;
        if (a === "none" || b === "none") return "tek eleman";
        if (a === "L" && b === "C") return "alçak geçiren";
        if (a === "C" && b === "L") return "yüksek geçiren";
        return a === "L" ? "iki bobin (ne alçak ne yüksek)" : "iki kondansatör (ne alçak ne yüksek)";
      };
      const btns = sg.querySelectorAll("button");
      sols.forEach((s, i) => { if (btns[i]) btns[i].textContent = `Çözüm ${i + 1} · ${type(s).split(" (")[0]}`; });
      const sol = sols[sel];
      const zL = zn(ZL);
      let st1, st2, e1, e2;
      if (sol.topology === "shunt-load") {
        st1 = Smith.trace(zL, "shunt", sol.B * Z0, 80); st2 = Smith.trace(st1[st1.length - 1], "series", sol.X / Z0, 80);
        e1 = { p: sol.shunt, how: "paralel" }; e2 = { p: sol.series, how: "seri" };
      } else {
        st1 = Smith.trace(zL, "series", sol.X / Z0, 80); st2 = Smith.trace(st1[st1.length - 1], "shunt", sol.B * Z0, 80);
        e1 = { p: sol.series, how: "seri" }; e2 = { p: sol.shunt, how: "paralel" };
      }
      const Zin = RF.lMatchZin(ZL, sol);
      S = { ZL, zL, sol, st1, st2, e1, e2, Zin, kind: type(sol) };
      ro.ser.set(fmtPart(sol.series) + (sol.series.type !== "none" ? " " + (sol.series.type === "L" ? "(L)" : "(C)") : ""));
      ro.ser.querySelector(".v").style.color = partColor(sol.series);
      ro.sh.set(fmtPart(sol.shunt) + (sol.shunt.type !== "none" ? " " + (sol.shunt.type === "L" ? "(L)" : "(C)") : ""));
      ro.sh.querySelector(".v").style.color = partColor(sol.shunt);
      ro.kind.set(S.kind);
      ro.zin.set(ohm(Zin));
      const s = RF.vswr(RF.gamma(Zin, Z0));
      ro.s.set(num(s, 2) + " : 1", s < 1.01 ? "ok" : "bad");
    }

    let geo = null, narrow = false, drag = false;
    const st = canvas(cv, () => draw());
    function partial(arr, k) { const n = Math.max(1, Math.round(clamp(k, 0, 1) * (arr.length - 1))); return arr.slice(0, n + 1); }
    function draw() {
      const { ctx, w, h: hh } = st;
      if (!w || !S) return;
      ctx.clearRect(0, 0, w, hh);
      narrow = w < 640 || w / hh < 1.2;
      const ss = narrow ? Math.min(w, hh * 0.62) : Math.min(hh, w * 0.56);
      geo = narrow ? smithIn((w - ss) / 2, 0, ss, ss, 26) : smithIn(0, 0, ss, hh, 30);
      Smith.draw(ctx, geo, { admittance: true });
      V.corners(ctx, 8, 8, w - 16, hh - 16);
      // hedef: merkez (50 Ω)
      const [mx, my] = Smith.toXY({ re: 1, im: 0 }, geo);
      ctx.save(); ctx.strokeStyle = rgba(C.ok, 0.8); ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(mx, my, 11, 0, 7); ctx.stroke(); ctx.restore();
      // adım 1: üzerinde kaydığımız daire (soluk), sonra iz
      const k1 = clamp(t, 0, 1), k2 = clamp(t - 1, 0, 1);
      const circ = (z, how) => {
        const pts = [];
        if (how === "seri") for (let i = 1; i < 200; i++) pts.push({ re: z.re, im: Math.tan(Math.PI * (i / 200 - 0.5)) });
        else { const y = X.inv(z); for (let i = 1; i < 200; i++) pts.push(X.inv(cx(y.re, Math.tan(Math.PI * (i / 200 - 0.5))))); }
        return pts;
      };
      const c1 = S.st1[0], c2 = S.st2[0];
      if (t < 1.05) Smith.path(ctx, geo, circ(c1, S.e1.how), rgba(partColor(S.e1.p), 0.35), 1.2, [4, 4]);
      else Smith.path(ctx, geo, circ(c2, S.e2.how), rgba(partColor(S.e2.p), 0.35), 1.2, [4, 4]);
      Smith.path(ctx, geo, partial(S.st1, k1), partColor(S.e1.p), 3);
      if (t > 1) Smith.path(ctx, geo, partial(S.st2, k2), partColor(S.e2.p), 3);
      // noktalar
      Smith.point(ctx, geo, S.zL, C.copper, "ZL", 7);
      const mid = S.st1[S.st1.length - 1];
      if (t >= 1) Smith.point(ctx, geo, mid, C.ink, "1", 4.5);
      const cur = t <= 1 ? partial(S.st1, k1).pop() : partial(S.st2, k2).pop();
      if (t < 2) Smith.point(ctx, geo, cur, C.tot, null, 5);
      else Smith.point(ctx, geo, { re: S.Zin.re / Z0, im: S.Zin.im / Z0 }, C.ok, "50 Ω", 6);
      // adım açıklaması
      const step = t < 1 ? 1 : 2;
      const e = step === 1 ? S.e1 : S.e2;
      const msg = `Adım ${step}: ${e.how} ${partName(e.p)}` + (e.how === "seri" ? " → sabit direnç dairesinde kayar" : " → sabit iletkenlik dairesinde kayar");
      const tx = narrow ? 14 : geo.cx - geo.R, ty = narrow ? geo.cy + geo.R + 22 : hh - 14;
      V.text(ctx, t >= 2 ? "Merkeze ulaşıldı: kaynak 50 Ω görüyor" : msg, tx, ty, { size: 12.5, color: t >= 2 ? C.ok : partColor(e.p), weight: 600 });

      // --- şema ---
      const sx0 = narrow ? 18 : ss + 18, sx1 = w - 22;
      const sy0 = narrow ? geo.cy + geo.R + 68 : hh * 0.2, sy1 = narrow ? hh - 26 : hh * 0.62;
      if (sx1 - sx0 > 200 && sy1 - sy0 > 70) schematic(ctx, sx0, sy0, sx1, sy1);
    }
    function schematic(ctx, x0, y0, x1, y1) {
      const { sol } = S;
      const top = y0 + 20, bot = y1 - 14;
      const srcX = x0 + 18, loadX = x1 - 30;
      const span = loadX - srcX;
      const aX = srcX + span * 0.3, bX = srcX + span * 0.68;
      V.text(ctx, "Devre", x0, y0 - 22, { size: 12, color: C.muted, weight: 600 });
      // kaynak terminali
      wire(ctx, [[srcX, top], [srcX, bot]], rgba(C.ink2, 0.0));
      dot(ctx, srcX, top, C.ok, 3.5); dot(ctx, srcX, bot, C.ok, 3.5);
      V.text(ctx, "Zin", srcX, top - 10, { size: 12, color: C.ok, align: "center", weight: 600 });
      V.text(ctx, "verici", srcX, bot + 18, { size: 11, color: C.muted, align: "center" });
      wire(ctx, [[srcX, bot], [loadX, bot]]);
      const serKind = sol.series.type, shKind = sol.shunt.type;
      const lab = (p, x, y, al = "center") => V.text(ctx, fmtPart(p), x, y, { size: 12.5, color: partColor(p), align: al, font: "num", weight: 600 });
      if (sol.topology === "shunt-load") {
        // seri eleman kaynak tarafında, paralel eleman yük tarafında
        wire(ctx, [[srcX, top], [aX - 26, top]]);
        part(ctx, serKind, aX - 26, top, aX + 34, top, partColor(sol.series));
        wire(ctx, [[aX + 34, top], [loadX, top]]);
        lab(sol.series, aX + 4, top - 14);
        if (shKind !== "none") {
          part(ctx, shKind, bX, top, bX, bot, partColor(sol.shunt));
          dot(ctx, bX, top); dot(ctx, bX, bot);
          lab(sol.shunt, bX - 12, (top + bot) / 2 + 4, "right");
        }
      } else {
        if (shKind !== "none") {
          part(ctx, shKind, aX - 30, top, aX - 30, bot, partColor(sol.shunt));
          dot(ctx, aX - 30, top); dot(ctx, aX - 30, bot);
          lab(sol.shunt, aX - 42, (top + bot) / 2 + 4, "right");
        }
        wire(ctx, [[srcX, top], [bX - 34, top]]);
        part(ctx, serKind, bX - 34, top, bX + 26, top, partColor(sol.series));
        wire(ctx, [[bX + 26, top], [loadX, top]]);
        lab(sol.series, bX - 4, top - 14);
      }
      // yük: R ve X seri
      const midY = (top + bot) / 2;
      part(ctx, "R", loadX, top, loadX, midY, C.R);
      const xk = Math.abs(S.ZL.im) < 0.5 ? "none" : S.ZL.im > 0 ? "L" : "C";
      part(ctx, xk, loadX, midY, loadX, bot, S.ZL.im > 0 ? C.Xp : C.Xn);
      V.text(ctx, "Yük", loadX + 12, top + 4, { size: 11, color: C.muted });
      V.text(ctx, ohm(S.ZL), loadX + 2, bot + 18, { size: 11.5, color: C.copper, align: "right", font: "num" });
    }

    const DUR = 1.6; // her adım (s)
    const lp = loop((dt) => {
      if (playing) { t += dt / DUR; if (t >= 2) { t = 2; playing = false; } }
      draw();
    });
    pointer(cv, {
      down(px, py) {
        if (!geo || !S) return;
        const [lx, ly] = Smith.toXY(S.zL, geo);
        drag = Math.hypot(px - lx, py - ly) < 22;
      },
      move(px, py) {
        if (!drag || !geo) return;
        const z = Smith.fromXY(px, py, geo);
        R = clamp(z.re * Z0, 5, 500); Xl = clamp(z.im * Z0, -300, 300);
        sR.set(R); sX.set(Xl); t = 2; playing = false; update();
      },
      up() { drag = false; },
    });
    update();
    return { enter() { lp.start(); }, leave() { lp.stop(); } };
  };

  /* ======================================================================
     3) Çeyrek dalga dönüştürücü ve tek stub
     ====================================================================== */
  Demos.ch5Stub = function (stage) {
    const cv = h("canvas", { "aria-label": "Smith abağında çeyrek dalga dönüştürücü ve tek stub ile uydurma" });
    const fill = h("div.fill", cv);
    let mode = "qw", RL = 250, len = 0.25, R = 60, Xl = -80, sel = 0, t = 2, playing = false;
    const ro = {
      a: readout("Z1"), b: readout("Uzunluk"), c: readout("Zin", "ok"), s: readout("VSWR"),
    };
    const sRL = slider({ label: "Yük direnci RL", min: 5, max: 500, log: true, value: RL, fmt: (v) => ohm(v), cls: "c-r", oninput: (v) => { RL = v; update(); } });
    const sLen = slider({ label: "Dönüştürücü uzunluğu", min: 0, max: 0.5, step: 0.001, value: len, fmt: (v) => num(v, 3) + " λ", oninput: (v) => { len = v; playing = false; update(); } });
    const sR = slider({ label: "Yük direnci R", min: 5, max: 300, log: true, value: R, fmt: (v) => ohm(v), cls: "c-r", oninput: (v) => { R = v; t = 2; update(); } });
    const sX = slider({ label: "Yük reaktansı X", min: -200, max: 200, step: 1, value: Xl, fmt: (v) => (v < 0 ? "−j" : "+j") + num(Math.abs(v), 0) + " Ω", cls: "c-xn", oninput: (v) => { Xl = v; t = 2; update(); } });
    const sSol = seg([[0, "Çözüm 1"], [1, "Çözüm 2"]], sel, (k) => { sel = k; t = 0; playing = true; update(); }, "Stub çözümü");
    const play = h("button.btn.primary", { type: "button" }, "Oynat");
    play.addEventListener("click", () => { if (mode === "qw") { len = 0; } else t = 0; playing = true; });
    const sMode = seg([["qw", "Çeyrek dalga"], ["stub", "Tek stub"]], mode, (k) => { mode = k; t = 2; playing = false; update(); }, "Yöntem");
    const qwBox = h("span", { style: { display: "contents" } }, sRL, sLen);
    const stBox = h("span", { style: { display: "contents" } }, sR, sX, sSol);
    const ctrl = h("div.controls", sMode, qwBox, stBox, play, h("div.readouts", Object.values(ro)));
    stage.append(fill, ctrl);

    let Q = null, T = null;
    function update() {
      qwBox.style.display = mode === "qw" ? "contents" : "none";
      stBox.style.display = mode === "stub" ? "contents" : "none";
      if (mode === "qw") {
        const Z1 = RF.quarterWaveZ(Z0, RL);
        const N = 120, full = [], tr = [];
        for (let i = 0; i <= N; i++) full.push(RF.zinWl(RL, Z1, (0.5 * i) / N));
        for (let i = 0; i <= N; i++) tr.push(RF.zinWl(RL, Z1, (len * i) / N));
        const Zin = RF.zinWl(RL, Z1, len);
        Q = { Z1, full, tr, Zin };
        ro.a.querySelector(".k").textContent = "Dönüştürücü Z1 = √(50·RL)";
        ro.a.set(ohm(Z1));
        ro.b.querySelector(".k").textContent = "Hat uzunluğu";
        ro.b.set(wl(len) + " · " + deg(len));
        ro.c.querySelector(".k").textContent = "Girişte Zin";
        ro.c.set(ohm(Zin));
        const s = RF.vswr(RF.gamma(Zin, Z0));
        ro.s.set(isFinite(s) ? num(s, 2) + " : 1" : "∞", s < 1.01 ? "ok" : "bad");
        ro.c.classList.toggle("ok", s < 1.01);
      } else {
        sX.input.classList.toggle("c-xp", Xl >= 0); sX.input.classList.toggle("c-xn", Xl < 0);
        const ZL = cx(R, Xl);
        const sols = RF.singleStub(ZL, Z0, "short");
        const s = sols[Math.min(sel, sols.length - 1)];
        const N = 90, line = [];
        for (let i = 0; i <= N; i++) line.push(zn(RF.zinWl(ZL, Z0, (s.d * i) / N)));
        const z1 = line[N];
        const bAdd = -s.B * Z0; // stubun eklediği normalize susceptans
        const shunt = Smith.trace(z1, "shunt", bAdd, 90);
        const Y = X.add(X.inv(RF.zinWl(ZL, Z0, s.d)), RF.stubY(Z0, s.l, "short"));
        const Zin = X.inv(Y);
        const stubB = RF.stubY(Z0, s.l, "short").im * Z0;
        T = { ZL, s, line, shunt, z1, bAdd, Zin, stubB };
        const btns = sSol.querySelectorAll("button");
        sols.forEach((o, i) => { if (btns[i]) btns[i].textContent = `Çözüm ${i + 1} · d = ${num(o.d, 3)} λ`; });
        ro.a.querySelector(".k").textContent = "Yükten uzaklık d";
        ro.a.set(wl(s.d) + " · " + deg(s.d));
        ro.b.querySelector(".k").textContent = "Kısa devre stub ℓ";
        ro.b.set(wl(s.l) + " · " + deg(s.l));
        ro.c.querySelector(".k").textContent = "Girişte Zin";
        ro.c.set(ohm(Zin));
        const sw = RF.vswr(RF.gamma(Zin, Z0));
        ro.s.set(num(sw, 2) + " : 1", sw < 1.01 ? "ok" : "bad");
      }
    }

    let geo = null;
    const st = canvas(cv, () => draw());
    const partial = (arr, k) => arr.slice(0, Math.max(1, Math.round(clamp(k, 0, 1) * (arr.length - 1))) + 1);
    function draw() {
      const { ctx, w, h: hh } = st;
      if (!w) return;
      ctx.clearRect(0, 0, w, hh);
      const narrow = w < 640 || w / hh < 1.2;
      const ss = narrow ? Math.min(w, hh * 0.58) : Math.min(hh, w * 0.56);
      geo = narrow ? smithIn((w - ss) / 2, 0, ss, ss, 24) : smithIn(0, 0, ss, hh, 30);
      Smith.draw(ctx, geo, { admittance: mode === "stub" });
      V.corners(ctx, 8, 8, w - 16, hh - 16);
      const [mx, my] = Smith.toXY({ re: 1, im: 0 }, geo);
      ctx.save(); ctx.strokeStyle = rgba(C.ok, 0.8); ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(mx, my, 11, 0, 7); ctx.stroke(); ctx.restore();
      const rx0 = narrow ? 14 : ss + 16, rx1 = w - 18;
      const ry0 = narrow ? geo.cy + geo.R + 36 : 24, ry1 = hh - 18;
      if (mode === "qw") drawQW(ctx, rx0, ry0, rx1, ry1, narrow);
      else drawStub(ctx, rx0, ry0, rx1, ry1, narrow);
    }
    function drawQW(ctx, x0, y0, x1, y1, narrow) {
      const { Z1, full, tr, Zin } = Q;
      // 50 Ω abağında: yörünge merkezde değil (soluk tam daire), iz her adımda RF.zinWl ile
      Smith.path(ctx, geo, full.map((z) => zn(z)), rgba(C.ink, 0.28), 1.2, [4, 4]);
      Smith.path(ctx, geo, tr.map((z) => zn(z)), C.ink, 3);
      // Z1 noktası: Z1 abağının merkezi bu abakta buraya düşer
      const [zx, zy] = Smith.toXY({ re: Z1 / Z0, im: 0 }, geo);
      ctx.save(); ctx.strokeStyle = C.copper; ctx.lineWidth = 1.6; ctx.beginPath();
      ctx.moveTo(zx - 6, zy - 6); ctx.lineTo(zx + 6, zy + 6); ctx.moveTo(zx + 6, zy - 6); ctx.lineTo(zx - 6, zy + 6); ctx.stroke(); ctx.restore();
      V.text(ctx, "Z1", zx, zy + 20, { size: 11.5, color: C.copper, align: "center", weight: 600 });
      Smith.point(ctx, geo, { re: RL / Z0, im: 0 }, C.R, "RL", 6);
      Smith.point(ctx, geo, zn(Zin), C.tot, null, 5);
      V.text(ctx, "50 Ω abağı: yay merkez etrafında dönmez", narrow ? 14 : geo.cx - geo.R, narrow ? geo.cy + geo.R + 16 : 26, { size: 12, color: C.ink2 });
      // küçük abak: Z1'e göre normalize; dönüş tam merkez etrafında
      const avail = y1 - y0;
      const schH = narrow ? 92 : Math.min(130, avail * 0.38);
      const insetS = Math.min(x1 - x0, avail - schH - 30);
      if (insetS > 110) {
        const ix = narrow ? x0 + (x1 - x0 - insetS) / 2 : x0 + (x1 - x0 - insetS) / 2, iy = y0 + schH + 26;
        const g2 = smithIn(ix, iy, insetS, insetS, 16);
        Smith.draw(ctx, g2, { labels: false, faint: true });
        Smith.vswrCircle(ctx, g2, Math.abs((RL - Z1) / (RL + Z1)), C.ink2);
        Smith.path(ctx, g2, tr.map((z) => zn(z, Z1)), C.ink, 2.4);
        Smith.point(ctx, g2, { re: RL / Z1, im: 0 }, C.R, null, 4.5);
        Smith.point(ctx, g2, { re: Z0 / Z1, im: 0 }, C.ok, null, 4);
        Smith.point(ctx, g2, zn(Zin, Z1), C.tot, null, 4);
        ctx.save(); ctx.fillStyle = C.copper; ctx.beginPath(); ctx.arc(g2.cx, g2.cy, 2.5, 0, 7); ctx.fill(); ctx.restore();
        V.text(ctx, "Z1'e göre normalize abak: dönüş merkez etrafında", g2.cx, iy + 4, { size: 11.5, color: C.ink2, align: "center" });
      }
      // şema: kaynak — 50 Ω hat — Z1 (λ/4) — RL
      const top = y0 + 26, mid = top + 22, bot = top + 44;
      const a = x0 + 8, b = x1 - 26;
      const s0 = a + (b - a) * 0.28, s1 = b - 12;
      V.text(ctx, "Devre", x0, y0 + 4, { size: 12, color: C.muted, weight: 600 });
      dot(ctx, a, mid, C.ok, 3.5);
      coax(ctx, a + 4, mid, s0, mid, 7);
      V.text(ctx, "50 Ω", (a + s0) / 2, mid - 12, { size: 11, color: C.muted, align: "center", font: "num" });
      coax(ctx, s0, mid, s0 + (s1 - s0) * clamp(len / 0.25, 0, 2) * 0.5 + 0.0001, mid, 11, C.copper);
      V.text(ctx, "Z1 = " + ohm(Z1), s0 + 4, mid - 16, { size: 11.5, color: C.copper, font: "num" });
      const sEnd = s0 + (s1 - s0) * clamp(len / 0.25, 0, 2) * 0.5;
      wire(ctx, [[sEnd, mid], [b, mid]]);
      part(ctx, "R", b, mid - 18, b, mid + 18, C.R);
      wire(ctx, [[b, mid - 18], [b, mid]]);
      V.text(ctx, ohm(RL), b + 10, mid + 4, { size: 11, color: C.R, font: "num" });
      if (sEnd - s0 > 30) V.dimension(ctx, s0, bot + 6, sEnd, bot + 6, wl(len), { size: 11 });
    }
    function drawStub(ctx, x0, y0, x1, y1, narrow) {
      const { line, shunt, s, Zin, bAdd, stubB } = T;
      const k1 = clamp(t, 0, 1), k2 = clamp(t - 1, 0, 1);
      // g = 1 dairesi: hedef çember (kemik, kesikli)
      const gC = []; for (let i = 1; i < 240; i++) gC.push(X.inv(cx(1, Math.tan(Math.PI * (i / 240 - 0.5)))));
      Smith.path(ctx, geo, gC, rgba(C.R, 0.75), 1.6, [6, 4]);
      V.text(ctx, "g = 1", geo.cx - geo.R * 0.5, geo.cy + geo.R * 0.5 + 15, { size: 11.5, color: C.R, align: "center", weight: 600 });
      Smith.vswrCircle(ctx, geo, X.abs(Smith.gammaOf(line[0])), C.ink2);
      Smith.path(ctx, geo, partial(line, k1), C.ink, 3);
      if (t > 1) Smith.path(ctx, geo, partial(shunt, k2), susColor(bAdd), 3);
      Smith.point(ctx, geo, line[0], C.copper, "ZL", 7);
      if (t >= 1) Smith.point(ctx, geo, line[line.length - 1], C.ink, "1", 4.5);
      if (t < 2) Smith.point(ctx, geo, t <= 1 ? partial(line, k1).pop() : partial(shunt, k2).pop(), C.tot, null, 5);
      else Smith.point(ctx, geo, zn(Zin), C.ok, "50 Ω", 6);
      const msg = t < 1 ? "Adım 1: hat → merkez etrafında döner, g = 1 dairesine varır"
        : t < 2 ? "Adım 2: paralel stub → g = 1 dairesinde merkeze kayar" : "Merkeze ulaşıldı: Zin = 50 Ω";
      const ty = narrow ? geo.cy + geo.R + 18 : st.h - 14;
      V.text(ctx, msg, narrow ? 14 : geo.cx - geo.R, ty, { size: 12.5, color: t >= 2 ? C.ok : t < 1 ? C.ink : susColor(bAdd), weight: 600 });
      // şema: kaynak — hat — (stub) — d — yük
      const top = y0 + (narrow ? 40 : 60);
      const a = x0 + 10, b = x1 - 60;
      const scale = (b - a - 20) / 0.5; // yatay: 0,5 λ
      const xs = b - s.d * scale;
      const vScale = Math.max(40, (narrow ? y1 - top - 30 : Math.min(y1 - top - 60, 300))) / 0.5;
      const stubLen = Math.max(14, s.l * vScale);
      const stubCol = susColor(stubB);
      V.text(ctx, "Devre", x0, y0 + 6, { size: 12, color: C.muted, weight: 600 });
      dot(ctx, a, top, C.ok, 3.5);
      V.text(ctx, "Zin", a, top - 12, { size: 11.5, color: C.ok, align: "center", weight: 600 });
      coax(ctx, a + 4, top, b, top, 7);
      wire(ctx, [[b, top], [b + 16, top]]);
      part(ctx, "R", b + 16, top - 4, b + 16, top + 40, C.R);
      V.text(ctx, "ZL", b + 28, top + 14, { size: 11.5, color: C.copper, weight: 600 });
      V.text(ctx, ohm(T.ZL, 2), b + 16, top + 58, { size: 11, color: C.copper, align: "center", font: "num" });
      coax(ctx, xs, top + 8, xs, top + 8 + stubLen, 6, stubCol);
      ctx.save(); ctx.strokeStyle = stubCol; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(xs - 10, top + 8 + stubLen); ctx.lineTo(xs + 10, top + 8 + stubLen); ctx.stroke(); ctx.restore();
      dot(ctx, xs, top, C.ink, 3.2);
      V.dimension(ctx, xs, top - 24, b, top - 24, "d = " + wl(s.d), { size: 11 });
      if (stubLen > 36) V.dimension(ctx, xs - 22, top + 8, xs - 22, top + 8 + stubLen, "ℓ = " + wl(s.l), { size: 11, color: stubCol });
      const al = xs > (a + b) / 2 ? "right" : "left";
      const tx = al === "right" ? xs - 34 : xs + 14;
      V.text(ctx, "kısa devre stub, ℓ = " + wl(s.l), tx, top + 8 + stubLen + 4, { size: 11, color: stubCol, align: al });
      V.text(ctx, s.l < 0.25 ? "λ/4'ten kısa: bobin gibi" : "λ/4'ten uzun: kondansatör gibi", tx, top + 8 + stubLen + 19, { size: 11, color: stubCol, align: al });
    }

    const lp = loop((dt) => {
      if (playing) {
        if (mode === "qw") { len = Math.min(0.25, len + dt * 0.12); sLen.set(len); update(); if (len >= 0.25) playing = false; }
        else { t += dt / 1.6; if (t >= 2) { t = 2; playing = false; } }
      }
      draw();
    });
    update();
    return { enter() { lp.start(); }, leave() { lp.stop(); } };
  };

  /* ======================================================================
     4) Balun: dengeli / dengesiz, ortak mod akımı
     ====================================================================== */
  Demos.ch5Balun = function (stage) {
    const cv = h("canvas", { "aria-label": "Dipol ve koaksiyel besleme hattında akımlar; balunsuz, akım balunu ve 4:1 balun" });
    const fill = h("div.fill", cv);
    let mode = "none", zch = 1000;
    // Yaklaşık model: dipolün her kolu besleme direncinin yarısını görür; kılıfın dış yüzü
    // besleme noktasından yere giden üçüncü bir yol gibidir (örnek değer, kablo boyuna göre çok değişir).
    const ZARM = RF.dipoleFeedResistance(0.5) / 2;
    const ZOUT = 150;
    const ro = { i1: readout("Sol kol (iç iletken)", "c-h"), i2: readout("Sağ kol (örgü)", "c-h"), i3: readout("Kılıfın dışı (ortak mod)", "c-h"), z: readout("Empedans dönüşümü") };
    const sm = seg([["none", "Balunsuz"], ["choke", "1:1 akım balunu"], ["b41", "4:1 balun"]], mode, (k) => { mode = k; calc(); }, "Balun");
    const sZ = slider({ label: "Boğucunun ortak mod empedansı", min: 100, max: 5000, log: true, value: zch, fmt: (v) => ohm(v, 2), oninput: (v) => { zch = v; calc(); } });
    const ctrl = h("div.controls", sm, sZ, h("div.readouts", Object.values(ro)));
    stage.append(fill, ctrl);
    let I1 = 1, I2 = 1, I3 = 0;
    function calc() {
      const zc = mode === "none" ? 0 : zch;
      sZ.input.disabled = mode === "none"; sZ.style.opacity = mode === "none" ? 0.45 : 1;
      // Akım bölücü: örgüden dönen akım sağ kol ile kılıfın dışı arasında paylaşılır
      const zo = ZOUT + zc;
      I1 = 1; I3 = ZARM / (ZARM + zo); I2 = 1 - I3;
      ro.i1.set("%" + num(100 * I1, 0)); ro.i2.set("%" + num(100 * I2, 0));
      ro.i3.set("%" + num(100 * I3, 1), I3 > 0.1 ? "bad" : I3 < 0.05 ? "ok" : "");
      const n = mode === "b41" ? 2 : 1;
      ro.z.set(ohm(Z0) + " → " + ohm(Z0 * n * n) + " (sarım 1:" + n + ")");
    }
    let ph = 0;
    const st = canvas(cv, () => draw());
    function arrowsAlong(ctx, x0, y0, x1, y1, amp, color, n) {
      // akım okları: genlik kalınlığı belirler, yön zamanla salınır
      const c = Math.cos(ph);
      if (Math.abs(amp) < 0.01) return;
      const s = Math.sign(c) || 1, a = Math.abs(c) * amp;
      for (let i = 0; i < n; i++) {
        const u = (i + 0.5) / n;
        const mx = x0 + (x1 - x0) * u, my = y0 + (y1 - y0) * u;
        const L_ = 16 + 10 * a, dx = (x1 - x0), dy = (y1 - y0), d = Math.hypot(dx, dy);
        const ux = (dx / d) * s, uy = (dy / d) * s;
        ctx.save(); ctx.globalAlpha = 0.25 + 0.75 * a;
        V.arrow(ctx, mx - ux * L_ / 2, my - uy * L_ / 2, mx + ux * L_ / 2, my + uy * L_ / 2, color, 1 + 3 * a, 6 + 4 * a);
        ctx.restore();
      }
    }
    function draw() {
      const { ctx, w, h: hh } = st;
      if (!w) return;
      ctx.clearRect(0, 0, w, hh);
      V.corners(ctx, 8, 8, w - 16, hh - 16);
      const narrow = w < 560;
      const cxm = narrow ? w * 0.5 : w * 0.42;
      const yd = Math.max(70, hh * 0.22), armL = Math.min(cxm - 24, narrow ? w * 0.42 : w * 0.34), gap = 9;
      const yb = hh * 0.86;
      const c = Math.cos(ph);
      // dipol akım dağılımı (H rengi): uçta sıfır, beslemede tepe
      const env = (amp, xA, xB) => {
        const shape = (x) => amp * 40 * Math.cos((Math.PI / 2) * Math.min(1, Math.abs(x - cxm) / armL));
        ctx.save();
        // zarf (genlik dağılımı): soluk dolgu, iki yanda
        ctx.fillStyle = rgba(C.H, 0.12); ctx.beginPath(); ctx.moveTo(xA, yd);
        for (let i = 0; i <= 40; i++) { const x = xA + ((xB - xA) * i) / 40; ctx.lineTo(x, yd - shape(x)); }
        for (let i = 40; i >= 0; i--) { const x = xA + ((xB - xA) * i) / 40; ctx.lineTo(x, yd + shape(x)); }
        ctx.closePath(); ctx.fill();
        // anlık akım
        ctx.strokeStyle = rgba(C.H, 0.95); ctx.lineWidth = 2; ctx.shadowColor = C.H; ctx.shadowBlur = 8;
        ctx.beginPath();
        for (let i = 0; i <= 40; i++) { const x = xA + ((xB - xA) * i) / 40; i ? ctx.lineTo(x, yd - c * shape(x)) : ctx.moveTo(x, yd - c * shape(x)); }
        ctx.stroke(); ctx.restore();
      };
      env(I1, cxm - armL, cxm - gap);
      env(I2, cxm + gap, cxm + armL);
      // dipol kolları
      ctx.save(); ctx.strokeStyle = C.copper; ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.shadowColor = C.copper; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.moveTo(cxm - armL, yd); ctx.lineTo(cxm - gap, yd); ctx.moveTo(cxm + gap, yd); ctx.lineTo(cxm + armL, yd); ctx.stroke(); ctx.restore();
      V.text(ctx, "Dipol (dengeli yük): akım dağılımı çivit", cxm - armL, yd - 50, { size: 12.5, color: C.ink2, weight: 600 });
      arrowsAlong(ctx, cxm - gap - 8, yd + 14, cxm - armL + 10, yd + 14, I1, C.H, 3);
      arrowsAlong(ctx, cxm + armL - 10, yd + 14, cxm + gap + 8, yd + 14, I2, C.H, 3);
      // koaksiyel iniş
      const cw = 11, cy0 = yd + 26;
      let feedY = cy0;
      if (mode === "b41") {
        // 4:1 balun kutusu: 1:2 sarım
        const bx = cxm - 34, by = yd + 18, bw = 68, bh = 56;
        box(ctx, bx, by, bw, bh, null);
        part(ctx, "L", bx + 18, by + bh - 6, bx + 18, by + 8, C.Xp, 1.8);
        part(ctx, "L", bx + 48, by + bh - 4, bx + 48, by + 4, C.Xp, 1.8);
        V.text(ctx, "1 : 2", bx + bw / 2, by + bh + 14, { size: 11, color: C.Xp, align: "center", font: "num" });
        V.text(ctx, ohm(Z0 * 4), bx + bw + 8, by + 14, { size: 11.5, color: C.ink, font: "num" });
        V.text(ctx, ohm(Z0), bx + bw + 8, by + bh, { size: 11.5, color: C.ink, font: "num" });
        wire(ctx, [[cxm - gap, yd], [cxm - 14, by]]); wire(ctx, [[cxm + gap, yd], [cxm + 14, by]]);
        feedY = by + bh + 22;
        wire(ctx, [[cxm, by + bh], [cxm, feedY]]);
      } else {
        wire(ctx, [[cxm - gap, yd], [cxm - 3, cy0]], rgba(C.copper, 0.9), 1.6);
        wire(ctx, [[cxm + gap, yd], [cxm + cw, cy0]], INK, 1.6);
      }
      coax(ctx, cxm, feedY, cxm, yb, cw);
      // ferrit boğucu
      if (mode !== "none") {
        const n = 5, fy0 = feedY + 18, fh = 15;
        for (let i = 0; i < n; i++) {
          const y = fy0 + i * (fh + 4);
          ctx.save(); ctx.fillStyle = "#2a3542"; ctx.strokeStyle = "#5c6b7a"; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.roundRect ? ctx.roundRect(cxm - cw - 7, y, (cw + 7) * 2, fh, 4) : ctx.rect(cxm - cw - 7, y, (cw + 7) * 2, fh); ctx.fill(); ctx.stroke(); ctx.restore();
        }
        V.text(ctx, "ferrit boğucu", cxm - cw - 14, fy0 + 12, { size: 11.5, color: C.ink2, align: "right" });
        V.text(ctx, "Zcm = " + ohm(zch, 2), cxm - cw - 14, fy0 + 27, { size: 11, color: C.ink2, align: "right", font: "num" });
      }
      // iç iletken (yukarı), örgünün iç yüzü (aşağı), örgünün dış yüzü (ortak mod)
      arrowsAlong(ctx, cxm, yb - 20, cxm, feedY + 30, 1, C.copper, 3);
      arrowsAlong(ctx, cxm - cw + 3, feedY + 30, cxm - cw + 3, yb - 20, 1, rgba(C.H, 0.9), 2);
      // dışarı sızan akım: kılıfın dış yüzünde, H renginde parıltı
      if (I3 > 0.004) {
        const showLbl = I3 > 0.06;
        ctx.save(); ctx.strokeStyle = rgba(C.H, Math.min(0.9, 0.2 + I3 * 3 * Math.abs(c))); ctx.lineWidth = 2 + 10 * I3;
        ctx.shadowColor = C.H; ctx.shadowBlur = 16;
        ctx.beginPath(); ctx.moveTo(cxm + cw + 3, mode === "none" ? feedY + 4 : feedY + 120); ctx.lineTo(cxm + cw + 3, yb); ctx.stroke(); ctx.restore();
        arrowsAlong(ctx, cxm + cw + 16, yb - 20, cxm + cw + 16, feedY + 40, I3 * 4, C.H, 3);
        const ly_ = (feedY + yb) / 2 + 30;
        if (!showLbl) {} else if (narrow) { V.text(ctx, "kılıfın dışında akan akım:", cxm + cw + 30, ly_, { size: 12, color: C.H, weight: 600 }); V.text(ctx, "kablo da ışır", cxm + cw + 30, ly_ + 15, { size: 12, color: C.H, weight: 600 }); }
        else V.text(ctx, "kılıfın dışında akan akım: kablo da ışır", cxm - cw - 16, ly_, { size: 12, color: C.H, weight: 600, align: "right" });
      }
      box(ctx, cxm - 46, yb, 92, 24, null);
      V.text(ctx, "verici", cxm, yb + 16, { size: 12, color: C.ink2, align: "center" });
      // koaks kesiti: üç yüzey
      if (!narrow || hh > 520) {
        const R = Math.min(58, w * 0.08, hh * 0.1);
        const kx = narrow ? w - R - 30 : w - R - 46, ky = narrow ? hh * 0.42 : hh * 0.5;
        ctx.save();
        ctx.fillStyle = rgba(C.line2, 0.35); ctx.beginPath(); ctx.arc(kx, ky, R, 0, 7); ctx.fill();
        ctx.strokeStyle = "#9fb3c3"; ctx.lineWidth = R * 0.14; ctx.beginPath(); ctx.arc(kx, ky, R, 0, 7); ctx.stroke();
        ctx.fillStyle = C.copper; ctx.beginPath(); ctx.arc(kx, ky, R * 0.2, 0, 7); ctx.fill();
        // akım katmanları (deri etkisi): iç iletkenin yüzü, örgünün iç yüzü, örgünün dış yüzü
        ctx.lineWidth = 3; ctx.strokeStyle = C.copper; ctx.beginPath(); ctx.arc(kx, ky, R * 0.2, 0, 7); ctx.stroke();
        ctx.strokeStyle = C.H; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(kx, ky, R * 0.92, 0, 7); ctx.stroke();
        ctx.globalAlpha = Math.min(1, 0.15 + I3 * 4); ctx.lineWidth = 1.5 + 8 * I3; ctx.shadowColor = C.H; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(kx, ky, R * 1.1, 0, 7); ctx.stroke();
        ctx.restore();
        V.text(ctx, "Kesit", kx, ky - R - 30, { size: 12, color: C.ink2, align: "center", weight: 600 });
        V.text(ctx, "iç yüz: dönüş akımı", kx, ky + R + 20, { size: 11, color: C.H, align: "center" });
        V.text(ctx, "dış yüz: ortak mod", kx, ky + R + 35, { size: 11, color: C.H, align: "center" });
        V.text(ctx, "deri etkisi ayırır", kx, ky - R - 14, { size: 11, color: C.muted, align: "center" });
      }
      V.text(ctx, "yaklaşık model", 18, hh - 16, { size: 11, color: C.copper, weight: 600 });
    }
    const lp = loop((dt) => { ph += dt * 2.2; draw(); });
    calc();
    return { enter() { lp.start(); }, leave() { lp.stop(); } };
  };

  /* ======================================================================
     5) Anten tuner: ne yapar, ne yapmaz
     ====================================================================== */
  Demos.ch5Tuner = function (stage) {
    const cv = h("canvas", { "aria-label": "Verici, tuner, uzun koaksiyel ve uyumsuz anten zinciri; hat boyunca duran dalga" });
    const fill = h("div.fill", cv);
    const P0 = 100;           // vericinin çıkış gücü (W)
    const TAND = 2e-4;        // katı PE dielektrik kayıp tanjantı (yaklaşık)
    const ANTS = [cx(50, 0), cx(150, 0), cx(15, -120), cx(600, 250)];
    let ai = 2, len = 30, f = 14.2e6, cab = "RG-58", tun = "tx";
    const ro = {
      tx: readout("Vericinin gördüğü VSWR"), line: readout("Hattaki VSWR (anten ucu)", "c-tot"),
      ml: readout("Uyumlu hat kaybı"), tl: readout("Toplam hat kaybı"), ex: readout("Uyumsuzluktan ek kayıp", "c-ref"),
      pa: readout("Antene ulaşan", "c-fwd"),
    };
    const short = (z) => (Math.abs(z.im) < 0.5 ? num(z.re, 0) + " Ω" : num(z.re, 0) + (z.im < 0 ? " − j" : " + j") + num(Math.abs(z.im), 0) + " Ω");
    const sA = seg(ANTS.map((z, i) => [i, short(z)]), ai, (k) => { ai = k; calc(); }, "Anten empedansı");
    const sT = seg([["off", "Tuner yok"], ["tx", "Verici yanında"], ["ant", "Anten yanında"]], tun, (k) => { tun = k; calc(); }, "Tuner");
    const sC = seg(["RG-58", "RG-213", "LMR-400"].map((k) => [k, k]), cab, (k) => { cab = k; calc(); }, "Kablo");
    const sLn = slider({ label: "Kablo boyu", min: 2, max: 60, step: 0.5, value: len, fmt: (v) => meters(v), oninput: (v) => { len = v; calc(); } });
    const sF = slider({ label: "Frekans", min: 1.8e6, max: 150e6, log: true, value: f, fmt: (v) => hz(v), oninput: (v) => { f = v; calc(); } });
    const grp = (lab, el) => h("span", { style: { display: "inline-flex", alignItems: "center", gap: "8px", flexWrap: "wrap" } }, h("span.lab", lab), el);
    const ctrl = h("div.controls", grp("Anten", sA), grp("Tuner", sT), sC, sLn, sF, h("div.readouts", Object.values(ro)));
    stage.append(fill, ctrl);

    let M = null;
    function calc() {
      const c = RF.CABLES[cab];
      const dbm = RF.coaxLoss(f, c.D * 1e-3, c.dEff * 1e-3, c.er, TAND).total; // dB/m (ideal iletken modeli)
      const alpha = RF.dbToNeper(dbm), beta = (2 * Math.PI * f) / (c.vf * RF.c0);
      const ZL = ANTS[ai];
      const GL = RF.gamma(ZL, Z0), rho = X.abs(GL);
      const ML = dbm * len;                       // uyumlu hat kaybı (dB)
      const a = Math.pow(10, ML / 10);
      // ARRL "additional loss due to SWR": TL = 10 log[(a² − ρ²) / (a (1 − ρ²))]
      const TLarrl = 10 * Math.log10((a * a - rho * rho) / (a * (1 - rho * rho)));
      // Aynı şey güç akışıyla: hat girişindeki Zin (RF.zinLossy) → P_giriş / P_yük
      const Zin = RF.zinLossy(ZL, Z0, alpha, beta, len);
      const Gin = RF.gamma(Zin, Z0), gin = X.abs(Gin);
      const TLflow = 10 * Math.log10((1 - gin * gin) / (Math.exp(-2 * alpha * len) * (1 - rho * rho)));
      let txS, lineS, pAnt, loss;
      if (tun === "off") {
        txS = RF.vswr(Gin); lineS = RF.vswr(GL);
        loss = TLflow;
        pAnt = P0 * (1 - gin * gin) * Math.pow(10, -loss / 10); // ideal kaynak, uyumsuzluk kaybı + hat kaybı
      } else if (tun === "tx") {
        txS = 1; lineS = RF.vswr(GL); loss = TLflow; pAnt = P0 * Math.pow(10, -loss / 10);
      } else {
        txS = 1; lineS = 1; loss = ML; pAnt = P0 * Math.pow(10, -loss / 10);
      }
      M = { c, dbm, alpha, beta, ZL, GL, rho, ML, TLarrl, TLflow, Zin, Gin, txS, lineS, pAnt, loss, matchedLine: tun === "ant" };
      ro.tx.set(isFinite(txS) ? num(txS, 2) + " : 1" : "∞", txS < 1.2 ? "ok" : txS > 3 ? "bad" : "");
      ro.line.set(isFinite(lineS) ? num(lineS, 2) + " : 1" : "∞");
      ro.ml.set(db(ML, 2));
      ro.tl.set(db(loss, 2));
      ro.ex.set(db(loss - ML, 2));
      ro.pa.set(num(pAnt, 1) + " W");
      window.__ch5Tuner = M; // doğrulama için
    }

    let ph = 0;
    const st = canvas(cv, () => draw());
    function antenna(ctx, x, y, s) {
      ctx.save(); ctx.strokeStyle = C.copper; ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.shadowColor = C.copper; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - s);
      ctx.moveTo(x - s * 0.45, y - s * 0.72); ctx.lineTo(x, y - s); ctx.lineTo(x + s * 0.45, y - s * 0.72); ctx.stroke(); ctx.restore();
    }
    function tunerBox(ctx, x, y, w_, h_) {
      box(ctx, x, y, w_, h_, null);
      // içinde değişken L ve C sembolleri
      part(ctx, "L", x + 8, y + h_ * 0.38, x + w_ - 8, y + h_ * 0.38, C.Xp, 1.6);
      part(ctx, "C", x + w_ / 2, y + h_ * 0.56, x + w_ / 2, y + h_ - 4, C.Xn, 1.6);
      V.text(ctx, "tuner", x + w_ / 2, y - 6, { size: 12, color: C.ink, align: "center", weight: 600 });
    }
    function meter(ctx, x, y, s, swr) {
      // VSWR göstergesi: ibreli ölçü aleti
      ctx.save(); ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.fillStyle = rgba(C.deep, 0.7);
      ctx.beginPath(); ctx.arc(x, y, s, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      const val = isFinite(swr) ? swr : 99;
      const u = clamp(Math.log(val) / Math.log(10), 0, 1); // 1 → 10 log ölçek
      const an = Math.PI + u * Math.PI;
      ctx.strokeStyle = val < 1.2 ? C.ok : val > 3 ? C.bad : C.fwd; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(an) * s * 0.85, y + Math.sin(an) * s * 0.85); ctx.stroke();
      ctx.restore();
      V.text(ctx, "VSWR " + (isFinite(swr) ? num(swr, 1) : "∞"), x, y + 14, { size: 11, color: C.ink, align: "center", font: "num" });
    }
    function draw() {
      const { ctx, w, h: hh } = st;
      if (!w || !M) return;
      ctx.clearRect(0, 0, w, hh);
      V.corners(ctx, 8, 8, w - 16, hh - 16);
      const narrow = w < 560;
      // --- zincir şeması ---
      const ly = narrow ? 70 : 76;
      const x0 = 20, x1 = w - 40;
      const txW = narrow ? 48 : 64, tW = narrow ? 46 : 58;
      box(ctx, x0, ly - 20, txW, 40, null);
      V.text(ctx, "verici", x0 + txW / 2, ly + 4, { size: 11.5, color: C.ink2, align: "center" });
      const mX = x0 + txW + (narrow ? 26 : 40);
      let tX, lineA, lineB;
      if (tun === "ant") { tX = x1 - tW - 26; lineA = mX + 30; lineB = tX; }
      else { tX = mX + (narrow ? 32 : 44); lineA = tX + tW; lineB = x1 - 10; }
      // kısa 50 Ω parça + ölçer
      wire(ctx, [[x0 + txW, ly], [tun === "ant" ? lineA : tX, ly]]);
      meter(ctx, mX, ly - 28, 18, M.txS);
      if (tun !== "off") tunerBox(ctx, tX, ly - 22, tW, 44);
      else { V.text(ctx, "(tuner yok)", tX + tW / 2, ly - 10, { size: 11, color: C.muted, align: "center" }); wire(ctx, [[tX, ly], [tX + tW, ly]]); }
      coax(ctx, lineA, ly, lineB, ly, 6);
      V.dimension(ctx, lineA, ly + 26, lineB, ly + 26, `${meters(len)} ${cab}`, { size: 11 });
      if (tun === "ant") wire(ctx, [[tX + tW, ly], [x1 + 4, ly]]);
      wire(ctx, [[x1 + 4, ly], [x1 + 4, ly - 4]]);
      antenna(ctx, x1 + 4, ly - 4, narrow ? 28 : 40);
      V.text(ctx, short(M.ZL), x1 + 4, narrow || tun === "ant" ? ly + 44 : ly + 24, { size: 11, color: C.copper, align: "right", font: "num" });

      // --- hat boyunca dalgalar: sol = hat girişi, sağ = anten ucu ---
      const gx0 = narrow ? 14 : 30, gx1 = w - 22, gy0 = ly + 70, gy1 = hh - (narrow ? 80 : 34);
      const gw = gx1 - gx0, gh = gy1 - gy0;
      if (gh < 60) return;
      V.graticule(ctx, gx0, gy0, gw, gh, 10, 6, { center: false });
      const { alpha, beta, GL } = M;
      const G = M.matchedLine ? cx(0, 0) : GL;
      const A = Math.exp(-alpha * len); // girişte |V+| = 1
      const N = Math.max(200, Math.round(gw));
      const fw = new Float64Array(N), rv = new Float64Array(N), tot = new Float64Array(N), inst = new Float64Array(N);
      let vmax = 0;
      for (let i = 0; i < N; i++) {
        const zp = len * (1 - i / (N - 1)); // yükten uzaklık
        const Vp = X.polar(A * Math.exp(alpha * zp), beta * zp);
        const Vm = X.mul(X.polar(A * Math.exp(-alpha * zp), -beta * zp), G);
        const V_ = X.add(Vp, Vm);
        fw[i] = X.abs(Vp); rv[i] = X.abs(Vm); tot[i] = X.abs(V_);
        inst[i] = X.mul(V_, X.polar(1, ph)).re;
        vmax = Math.max(vmax, tot[i], fw[i]);
      }
      const ym = Math.max(1.2, vmax * 1.08);
      // toplam zarf (±), anlık dalga
      const neg = tot.map((v) => -v);
      V.trace(ctx, tot, gx0, gy0, gw, gh, -ym, ym, rgba(C.tot, 0.9), 1.6);
      V.trace(ctx, neg, gx0, gy0, gw, gh, -ym, ym, rgba(C.tot, 0.9), 1.6);
      V.trace(ctx, inst, gx0, gy0, gw, gh, -ym, ym, rgba(C.tot, 0.45), 1.2);
      V.trace(ctx, fw, gx0, gy0, gw, gh, -ym, ym, C.fwd, 2, { glow: 6 });
      if (!M.matchedLine && M.rho > 0.001) V.trace(ctx, rv, gx0, gy0, gw, gh, -ym, ym, C.ref, 2, { glow: 6 });
      V.text(ctx, tun === "ant" ? "tuner girişi" : "hat girişi (tuner tarafı)", gx0 + 4, gy1 + 16, { size: 11, color: C.muted });
      V.text(ctx, "anten ucu", gx1, gy1 + 16, { size: 11, color: C.muted, align: "right" });
      const lg = (s, col, k) => V.text(ctx, s, gx0 + 2 + k * (narrow ? 0 : 130), narrow ? gy1 + 30 + k * 15 : gy0 - 8, { size: 11.5, color: col });
      lg("— ileri dalga", C.fwd, 0); lg("— yansıyan dalga", C.ref, 1); lg("— toplam zarf", C.tot, 2);
      V.text(ctx, "kablo kaybı: ideal iletken modeli", gx1, gy0 - 8, { size: 10.5, color: C.copper, align: "right" });
    }
    const lp = loop((dt) => { ph += dt * 3; draw(); });
    calc();
    return { enter() { lp.start(); }, leave() { lp.stop(); } };
  };

  /* ---------- sözlük ---------- */
  window.GLOSSARY_EXTRA = (window.GLOSSARY_EXTRA || []).concat([
    { k: ["maksimum güç aktarım", "en büyük güç aktarım"], t: "Maksimum güç aktarımı", d: "İç direnci olan bir kaynaktan yüke en çok güç, yük direnci kaynağın iç direncine eşit olduğunda (karmaşık durumda eşleniğine) aktarılır.", u: "https://en.wikipedia.org/wiki/Maximum_power_transfer_theorem" },
    { k: ["ferrit boğucu", "ortak mod boğucu"], t: "Ferrit boğucu", d: "Koaksiyel kablonun geçtiği ferrit halka ya da boncuk dizisi. Hattın içindeki dengeli akımı etkilemez; kılıfın dışındaki ortak mod akımına yüksek empedans gösterir.", u: "https://en.wikipedia.org/wiki/Ferrite_bead" },
    { k: ["dengeli hat", "dengesiz hat"], t: "Dengeli / dengesiz hat", d: "Dengeli hatta (çift hat, dipol) iki iletken toprağa göre simetriktir; dengesiz hatta (koaksiyel) bir iletken (örgü) toprak tarafıdır.", u: "https://en.wikipedia.org/wiki/Balanced_line" },
    { k: ["alçak geçiren", "yüksek geçiren"], t: "Alçak / yüksek geçiren süzgeç", d: "Seri bobin ve paralel kondansatörlü devre alçak frekansları geçirir, yükseklerini zayıflatır; seri kondansatör ve paralel bobinli devre tersini yapar.", u: "https://tr.wikipedia.org/wiki/Alçak_geçiren_süzgeç" },
  ]);

  /* ---------- hayalet el senaryoları ---------- */
  window.GUIDE_SCENARIOS = Object.assign(window.GUIDE_SCENARIOS || {}, {
    "neden-uydurma": [{ slide: "label:Yük direnci RL", to: Math.log(15) }, { wait: 700 }, { slide: "label:Yük direnci RL", to: Math.log(50) }],
    "l-agi": [{ click: "Adım adım" }, { wait: 3400 }, { click: "Çözüm 2" }],
    "ceyrek-dalga-stub": [{ click: "=Oynat" }, { wait: 2400 }, { click: "Tek stub" }, { wait: 400 }, { click: "=Oynat" }],
    balun: [{ click: "Balunsuz" }, { wait: 1500 }, { click: "1:1 akım" }, { wait: 800 }, { slide: "label:Boğucunun ortak mod empedansı", to: Math.log(3000) }],
    tuner: [{ click: "Tuner yok" }, { wait: 1200 }, { click: "Verici yanında" }, { wait: 1500 }, { click: "Anten yanında" }],
  });
})();
