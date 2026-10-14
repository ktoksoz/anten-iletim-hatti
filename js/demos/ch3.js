/* Bölüm 3: yansıma ve duran dalga.
   ch3Line  : ana deney, 1B FDTD kaynak → hat → yük; ileri / yansıyan / toplam; ölçülen ve hesaplanan Γ
   ch3Gamma : Γ düzlemi (Smith abağının zemini), sürüklenen ok
   ch3Swr   : duran dalga zarfı, VSWR, geri dönüş ve uyumsuzluk kaybı, antene ulaşan güç
   ch3Tdr   : TDR osiloskobu ve "Arızayı bul" oyunu (1B FDTD, empedans profili) */
(function () {
  const { C, FONT, rgba, h, canvas, loop, clamp, slider, seg, toggle, num, sig, ohm, db, meters, pointer } = L;
  const Z0 = 50;
  const cx = RF.cx;
  const DEG = 180 / Math.PI;

  /* ---------- küçük yardımcılar ---------- */
  function readout(k, cls) {
    const v = h("span.v", "—"), kk = h("span.k", k);
    const el = h("div.readout" + (cls ? "." + cls : ""), kk, v);
    el.set = (s) => { if (v.textContent !== s) v.textContent = s; };
    el.label = (s) => { if (kk.textContent !== s) kk.textContent = s; };
    return el;
  }
  const nz = (v) => (Math.abs(v - Math.round(v)) < 1e-6 ? num(v, 0) : sig(v, 3));
  const xStr = (x) => `${x < 0 ? "−" : "+"}j${num(Math.abs(x), 0)} Ω`;
  function zStr(R, X, open) {
    if (open) return "∞ (açık devre)";
    if (Math.abs(X) < 1e-9) return nz(R) + " Ω";
    return `${nz(R)} ${X < 0 ? "−" : "+"} j${nz(Math.abs(X))} Ω`;
  }
  function gPolar(g) {
    const m = RF.C.abs(g);
    if (m < 5e-4) return "0,000";
    let a = RF.C.arg(g) * DEG;
    if (a <= -179.95) a = 180;           // −180° ile 180° aynı yön; tek biçimde yaz
    if (Math.abs(a) < 0.05) a = 0;       // "−0,0°" yazmasın
    return `${num(m, 3)} ∠ ${num(a, 1)}°`;
  }
  const pct = (v, d = 1) => "%" + num(v * 100, d);
  const gammaOfLoad = (R, X, open) => (open ? cx(1, 0) : RF.gamma(cx(R, X), Z0));
  // Kaydırıcının topuz rengi X'in işaretine göre: +X mor, −X turkuaz
  function xClass(sl, X) { sl.input.classList.toggle("c-xp", X >= 0); sl.input.classList.toggle("c-xn", X < 0); }

  /* ---------- mavi baskı şema parçaları ---------- */
  function line(ctx, pts, color, lw = 1.6) {
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); ctx.restore();
  }
  // direnç: zikzak (x0,y0)→(x1,y1)
  function zig(ctx, x0, y0, x1, y1, color, n = 4, amp = 5) {
    const dx = x1 - x0, dy = y1 - y0, Lg = Math.hypot(dx, dy) || 1, nx = -dy / Lg, ny = dx / Lg;
    const pts = [[x0, y0]];
    for (let i = 0; i < 2 * n; i++) {
      const t = (i + 0.5) / (2 * n), s = (i % 2 ? -1 : 1) * amp;
      pts.push([x0 + dx * t + nx * s, y0 + dy * t + ny * s]);
    }
    pts.push([x1, y1]);
    line(ctx, pts, color, 1.7);
  }
  // bobin: yan yana yaylar
  function coil(ctx, x0, y0, x1, y1, color, n = 4, amp = 6) {
    const dx = x1 - x0, dy = y1 - y0, Lg = Math.hypot(dx, dy) || 1, nx = -dy / Lg, ny = dx / Lg;
    const pts = [], M = 64;
    for (let i = 0; i <= M; i++) {
      const t = i / M, s = Math.abs(Math.sin(Math.PI * n * t)) * amp;
      pts.push([x0 + dx * t + nx * s, y0 + dy * t + ny * s]);
    }
    line(ctx, pts, color, 1.7);
  }
  // dikey kondansatör: iki yatay plaka
  function capV(ctx, x, y0, y1, color, wPlate = 18) {
    const m = (y0 + y1) / 2, g = Math.min(4, (y1 - y0) / 4);
    line(ctx, [[x, y0], [x, m - g]], color, 1.7);
    line(ctx, [[x, m + g], [x, y1]], color, 1.7);
    line(ctx, [[x - wPlate / 2, m - g], [x + wPlate / 2, m - g]], color, 2.4);
    line(ctx, [[x - wPlate / 2, m + g], [x + wPlate / 2, m + g]], color, 2.4);
  }
  // Yük: yA (üst ray) ile yB (alt ray) arasında dikey seri R + jX
  function drawLoad(ctx, x, yA, yB, R, X, open) {
    const wc = rgba(C.ink2, 0.85), span = yB - yA;
    if (open) {
      const a = yA + span * 0.32, b = yB - span * 0.32;
      line(ctx, [[x, yA], [x, a]], wc); line(ctx, [[x, b], [x, yB]], wc);
      ctx.save(); ctx.strokeStyle = wc; ctx.lineWidth = 1.4;
      for (const y of [a, b]) { ctx.beginPath(); ctx.arc(x, y + (y === a ? 2.5 : -2.5), 2.5, 0, 7); ctx.stroke(); }
      ctx.restore();
      return;
    }
    const parts = [];
    if (R > 0.5) parts.push("R");
    if (Math.abs(X) > 0.5) parts.push(X > 0 ? "L" : "C");
    if (!parts.length) { line(ctx, [[x, yA], [x, yB]], C.ink, 2.2); return; }
    const body = span * 0.7, sg = body / parts.length, y0 = yA + (span - body) / 2;
    line(ctx, [[x, yA], [x, y0]], wc);
    parts.forEach((p, i) => {
      const a = y0 + i * sg, b = a + sg, m = 2;
      line(ctx, [[x, a], [x, a + m]], wc); line(ctx, [[x, b - m], [x, b]], wc);
      if (p === "R") zig(ctx, x, a + m, x, b - m, C.R, Math.max(2, Math.round(sg / 8)), 5);
      else if (p === "L") coil(ctx, x, a + m, x, b - m, C.Xp, Math.max(2, Math.round(sg / 7)), 6);
      else capV(ctx, x, a + m, b - m, C.Xn);
    });
    line(ctx, [[x, y0 + body], [x, yB]], wc);
  }
  // Kaynak: dairesel üreteç + seri iç direnç; üst ve alt raya bağlanır
  function drawSource(ctx, sx, xs, yA, yB, kind, rsLabel) {
    const wc = rgba(C.ink2, 0.85), ym = (yA + yB) / 2, r = Math.min(13, (yB - yA) / 3.2);
    line(ctx, [[sx, ym - r], [sx, yA], [sx + 8, yA]], wc);
    zig(ctx, sx + 8, yA, xs - 6, yA, rgba(C.ink2, 0.9), 3, 4);
    line(ctx, [[xs - 6, yA], [xs, yA]], wc);
    line(ctx, [[sx, ym + r], [sx, yB], [xs, yB]], wc);
    ctx.save(); ctx.strokeStyle = wc; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(sx, ym, r, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = C.fwd; ctx.lineWidth = 1.6; ctx.beginPath();
    for (let i = 0; i <= 24; i++) {
      const u = i / 24, px = sx - r * 0.6 + u * r * 1.2;
      const py = kind === "sine" ? ym - Math.sin(u * Math.PI * 2) * r * 0.4 : ym + r * 0.35 - Math.exp(-((u - 0.5) ** 2) / 0.02) * r * 0.75;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.stroke(); ctx.restore();
    if (rsLabel) V.text(ctx, rsLabel, (sx + 8 + xs - 6) / 2, yA + 15, { size: 10, font: "num", align: "center", color: C.muted });
  }

  /* =====================================================================
     1) Ana deney: kaynak → hat → yük
     ===================================================================== */
  Demos.ch3Line = function (stage) {
    stage.classList.add("ch3");
    const N = 400, PERIOD = 80, W = 22, P = N / 2;
    const T0 = 2.2 * W;                                 // darbe tepesinin kaynaktan çıktığı adım
    const T_DONE = Math.ceil(T0 + 1.5 * N + 3 * W);     // yankı ölçüm noktasını geçti
    const REP = Math.ceil(2 * N + T0 + 4 * W);          // otomatik yeni darbe
    const sim = new FDTD1D.Sim({ N, Z0, Rs: Z0 });
    sim.source = { kind: "pulse", width: W, amp: 1, period: PERIOD };
    let mode = "pulse", R = 100, X = 0, open = false, slow = false;
    const show = { fwd: true, ref: true, tot: true };
    const ringF = new Float64Array(PERIOD), ringR = new Float64Array(PERIOD);
    let since = 0, settle = 3 * PERIOD, pk = { inc: 0, ref: 0, ok: false }, meas = null;

    const cv = h("canvas", { "aria-label": "Kaynak, iletim hattı ve yükten oluşan devrede ileri giden, yansıyan ve toplam gerilim dalgaları" });
    const fill = h("div.fill", cv);
    const rZ = readout("Yük empedansı Z_L"), rM = readout("Γ ölçülen (FDTD)", "c-ref");
    const rC = readout("Γ hesaplanan (RF)", "c-ref"), rP = readout("Yansıyan güç", "c-ref");
    const top = h("div.controls.top", h("div.readouts", rZ, rM, rC, rP));

    const modeSeg = seg([["pulse", "Darbe"], ["sine", "Sinüs"]], mode, setMode, "Kaynak türü");
    const fireBtn = h("button.btn.primary", { type: "button", onclick: () => fire(false) }, "Darbe gönder");
    const tF = toggle("İleri", true, (v) => (show.fwd = v), "c-fwd");
    const tR = toggle("Yansıyan", true, (v) => (show.ref = v), "c-ref");
    const tT = toggle("Toplam", true, (v) => (show.tot = v), "c-tot");
    const tS = toggle("Yavaş", false, (v) => (slow = v));
    const sR = slider({ label: "Yük direnci R", min: 0, max: 300, step: 1, value: R, fmt: (v) => nz(v) + " Ω", cls: "c-r",
      oninput: (v) => { R = v; open = false; applyLoad(false); } });
    const sX = slider({ label: "Yük reaktansı X", min: -150, max: 150, step: 1, value: X, fmt: xStr, cls: "c-xp",
      oninput: (v) => { X = v; if (open) { open = false; sR.set(R); } xClass(sX, X); applyLoad(false); } });
    const presets = [["Kısa devre", 0, 0, false], ["Açık devre", R, 0, true], ["50 Ω", 50, 0, false], ["100 Ω", 100, 0, false], ["25 Ω", 25, 0, false]];
    const pre = h("div.ch3-presets", { role: "group", "aria-label": "Hazır yükler" }, presets.map(([lab, r, x, o]) =>
      h("button.btn", { type: "button", onclick: () => setLoad(o ? R : r, x, o) }, lab)));
    const ctrl = h("div.controls", modeSeg, fireBtn, h("span.spacer"), tF, tR, tT, tS);
    const ctrl2 = h("div.controls.ch3-tight", sR, sX, pre);
    stage.append(top, fill, ctrl, ctrl2);

    function setLoad(r, x, o) {
      R = r; X = x; open = o;
      sR.set(R); sX.set(X); xClass(sX, X);
      if (open) sR.querySelector("output").textContent = "∞ Ω";
      applyLoad(true);
    }
    function applyLoad(restart) {
      sim.setLoadZ(R, X, open);
      // FDTD1D, yük değişince kondansatör gerilimini (vc) korur; kondansatörsüz yükte bu, hatta sahte bir
      // DC gerilim kaynağı gibi kalır. Kondansatör yoksa sıfırla.
      if (!sim.load.C) sim.main.vc = 0;
      since = 0; meas = null; pk.ok = false;
      // reaktif yükün geçici rejimi: seri RL için τ = L/(R+Z0), seri RC için τ = (R+Z0)·C
      const w = (2 * Math.PI) / PERIOD;
      let tau = 0;
      if (!open && X > 0) tau = X / w / (R + Z0);
      else if (!open && X < 0) tau = (R + Z0) / (w * -X);
      settle = Math.min(4000, 3 * PERIOD + 6 * tau);
      if (restart && mode === "pulse") { sim.reset(); fire(true); }
      statics();
    }
    function fire() { sim.fire(); pk = { inc: 0, ref: 0, ok: true }; }
    function setMode(m) {
      mode = m; sim.reset(); sim.source.kind = m; since = 0; meas = null; pk.ok = false;
      fireBtn.disabled = m !== "pulse";
      if (m === "pulse") fire();
      statics();
    }
    function statics() {
      const g = gammaOfLoad(R, X, open);
      rZ.set(zStr(R, X, open));
      const reactivePulse = mode === "pulse" && !open && Math.abs(X) > 0.5;
      rC.label(reactivePulse ? "Γ hesaplanan (RF, sinüs frekansında)" : "Γ hesaplanan (RF)");
      rC.set(mode === "pulse" && !reactivePulse ? num(g.re, 3) : gPolar(g));
      rP.set(pct(1 - RF.powerDelivered(g)));
      rM.label(mode === "pulse" ? "Yankı / gelen, tepe (FDTD)" : "Γ ölçülen (FDTD, yükte)");
    }

    function stepSim(n) {
      for (let i = 0; i < n; i++) {
        sim.step(1); since++;
        if (mode === "sine") {
          const j = sim.t % PERIOD; ringF[j] = sim.fwd[N]; ringR[j] = sim.rev[N];
        } else {
          const f = sim.fwd[P], r = sim.rev[P];
          if (Math.abs(f) > Math.abs(pk.inc)) pk.inc = f;
          if (Math.abs(r) > Math.abs(pk.ref)) pk.ref = r;
          if (sim.t === T_DONE && pk.ok && pk.inc) meas = pk.ref / pk.inc;
          if (sim.t >= REP) fire();
        }
      }
      if (mode === "sine") {
        if (since >= settle && sim.t > N + 4 * PERIOD) {
          // bir periyotluk Fourier toplamı (fazör kuralı e^(jωt)); oran zaman başlangıcından bağımsız
          let fr = 0, fi = 0, rr = 0, ri = 0;
          for (let j = 0; j < PERIOD; j++) {
            const ph = (2 * Math.PI * j) / PERIOD, c = Math.cos(ph), s = Math.sin(ph);
            fr += ringF[j] * c; fi -= ringF[j] * s; rr += ringR[j] * c; ri -= ringR[j] * s;
          }
          meas = RF.C.div(cx(rr, ri), cx(fr, fi));
        } else meas = null;
      }
      if (meas == null) rM.set(mode === "pulse" ? "sonraki yankıda…" : "oturuyor…");
      else rM.set(typeof meas === "number" ? num(Math.abs(meas) < 5e-4 ? 0 : meas, 3) : gPolar(meas));
    }

    const st = canvas(cv, draw);
    function draw() {
      const { ctx, w, h: H } = st;
      if (!w) return;
      ctx.clearRect(0, 0, w, H);
      const narrow = w < 560, pad = 16;
      const sx = pad + (narrow ? 12 : 18), xs = pad + (narrow ? 62 : 96), xe = w - pad - (narrow ? 26 : 44);
      const railGap = clamp(H * 0.12, 46, 74);
      const yA = pad + 30, yB = yA + railGap;
      const py = yB + 40, ph = Math.max(60, H - py - 36), pw = xe - xs;
      const X_ = (k) => xs + (k / N) * pw;
      const YR = 2.2, Y_ = (v) => py + ph / 2 - (v / YR) * (ph / 2);

      // yoğunluk şeridi: hattaki anlık |V|
      const Vt = sim.V;
      for (let x = xs; x < xe; x += 2) {
        const v = Math.abs(Vt[Math.round(((x - xs) / pw) * N)]);
        if (v < 0.02) continue;
        ctx.fillStyle = rgba(C.tot, Math.min(0.5, v * 0.32));
        ctx.fillRect(x, yA + 2, 2, railGap - 4);
      }
      // raylar, kaynak, yük
      line(ctx, [[xs, yA], [xe, yA]], rgba(C.ink2, 0.9), 2);
      line(ctx, [[xs, yB], [xe, yB]], rgba(C.ink2, 0.9), 2);
      drawSource(ctx, sx, xs, yA, yB, mode, narrow ? "Rs" : "Rs " + nz(sim.Rs) + " Ω");
      drawLoad(ctx, xe, yA, yB, R, X, open);
      ctx.save(); ctx.fillStyle = C.ink2;
      [[xs, yA], [xs, yB], [xe, yA], [xe, yB]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 2.4, 0, 7); ctx.fill(); });
      ctx.restore();
      // etiketler
      V.text(ctx, "Kaynak", pad, yA - 12, { size: 12, weight: 600, color: C.ink2 });
      V.text(ctx, `hat, Z₀ = ${nz(Z0)} Ω`, (xs + xe) / 2, yB + 17, { size: 11, font: "num", align: "center", color: C.muted });
      const zl = open ? "Z_L = ∞" : `Z_L = ${zStr(R, X, false)}`;
      ctx.save(); ctx.font = `500 12px ${FONT.num}`;
      const zw = ctx.measureText(zl).width; ctx.restore();
      const zx = w - pad;
      V.text(ctx, "Yük", zx - zw - 8, yA - 12, { size: 12, weight: 600, color: C.ink2, align: "right" });
      V.text(ctx, zl, zx, yA - 12, { size: 12, font: "num", align: "right", color: open ? C.ink : Math.abs(X) > 0.5 ? (X > 0 ? C.Xp : C.Xn) : C.R });
      // bağlantı kılavuz çizgileri
      ctx.save(); ctx.setLineDash([2, 4]); ctx.strokeStyle = rgba(C.ink2, 0.25); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(xs + 0.5, yB + 4); ctx.lineTo(xs + 0.5, py); ctx.moveTo(xe + 0.5, yB + 4); ctx.lineTo(xe + 0.5, py); ctx.stroke();
      ctx.restore();

      // grafik
      ctx.save(); ctx.fillStyle = rgba(C.deep, 0.45); ctx.fillRect(xs, py, pw, ph); ctx.restore();
      V.graticule(ctx, xs, py, pw, ph, 10, 8);
      for (const v of [1, 0, -1]) V.text(ctx, v === 0 ? "0" : v > 0 ? "+1" : "−1", xs - 6, Y_(v) + 4, { size: 10, font: "num", align: "right", color: C.muted });
      ctx.save(); ctx.beginPath(); ctx.rect(xs, py, pw, ph); ctx.clip();
      if (show.ref) V.trace(ctx, sim.rev, xs, py, pw, ph, -YR, YR, C.ref, 1.8, { glow: 6 });
      if (show.fwd) V.trace(ctx, sim.fwd, xs, py, pw, ph, -YR, YR, C.fwd, 1.8, { glow: 6 });
      if (show.tot) V.trace(ctx, Vt, xs, py, pw, ph, -YR, YR, C.tot, 2.6, { glow: 10 });
      ctx.restore();
      if (mode === "pulse") {
        const x = X_(P);
        ctx.save(); ctx.fillStyle = rgba(C.ink2, 0.8);
        ctx.beginPath(); ctx.moveTo(x - 5, py); ctx.lineTo(x + 5, py); ctx.lineTo(x, py + 7); ctx.fill(); ctx.restore();
        V.text(ctx, "ölçüm noktası", x + 8, py + 12, { size: 10, color: C.muted });
      } else {
        const yy = py + ph + 16;
        V.dimension(ctx, X_(N - PERIOD), yy, X_(N), yy, "λ", { size: 11 });
      }
      // yorum
      let msg = "";
      if (mode === "pulse" && !open && Math.abs(X) > 0.5) msg = "reaktif yük: yankının biçimi değişir";
      else if (meas != null) {
        const a = typeof meas === "number" ? Math.abs(meas) : RF.C.abs(meas);
        if (a < 0.01) msg = "yankı yok: dalga yükte emildi";
        else if (typeof meas === "number") msg = meas < 0 ? "yankı ters döndü" : "yankı düz döndü";
        else msg = `yankı, gelenin ${pct(a, 0)} genliğinde`;
      }
      if (msg) V.text(ctx, msg, xe - 8, py + 18, { size: 12, weight: 600, align: "right", color: C.ink });
    }

    const lp = loop(() => { stepSim(slow ? 1 : 4); draw(); });
    setMode("pulse");
    applyLoad(true);
    return { enter() { lp.start(); }, leave() { lp.stop(); } };
  };

  /* =====================================================================
     2) Γ düzlemi
     ===================================================================== */
  Demos.ch3Gamma = function (stage) {
    stage.classList.add("ch3");
    let R = 100, X = 50, open = false;
    let g = gammaOfLoad(R, X, open), gd = { ...g }, drag = false, geo = null, panel = null, t = 0;

    const cv = h("canvas", { "aria-label": "Yansıma katsayısı düzlemi: Γ bir ok olarak gösterilir; ok ucundan sürüklenebilir" });
    const fill = h("div.fill", cv);
    const rZ = readout("Yük empedansı Z_L"), rG = readout("Γ", "c-ref"), rA = readout("|Γ|", "c-ref");
    const rD = readout("Açı ∠Γ", "c-ref"), rP = readout("Yansıyan güç", "c-ref");
    const top = h("div.controls.top", h("div.readouts", rZ, rG, rA, rD, rP));
    const sR = slider({ label: "Yük direnci R", min: 0, max: 500, step: 1, value: R, fmt: (v) => nz(v) + " Ω", cls: "c-r",
      oninput: (v) => { R = v; open = false; update(); } });
    const sX = slider({ label: "Yük reaktansı X", min: -500, max: 500, step: 1, value: X, fmt: xStr, cls: "c-xp",
      oninput: (v) => { X = v; if (open) { open = false; sR.set(R); } update(); } });
    const btn = (lab, f) => h("button.btn", { type: "button", onclick: f }, lab);
    const pre = h("div.ch3-presets", { role: "group", "aria-label": "Hazır yükler" },
      btn("Kısa devre", () => set(0, 0, false)), btn("Açık devre", () => set(R, 0, true)),
      btn("Uyumlu yük", () => set(Z0, 0, false)),
      btn("Rastgele", () => set(Math.round(5 + Math.random() * 245), Math.round(-200 + Math.random() * 400), false)));
    const ctrl = h("div.controls", sR, sX, pre);
    stage.append(top, fill, ctrl);

    function set(r, x, o) { R = r; X = x; open = o; syncSliders(); update(); }
    function syncSliders() {
      sR.set(clamp(R, 0, 500)); sX.set(clamp(X, -500, 500));
      if (open) sR.querySelector("output").textContent = "∞ Ω";
      else { sR.querySelector("output").textContent = ohm(R); sX.querySelector("output").textContent = `${X < 0 ? "−" : "+"}j${sig(Math.abs(X), 3)} Ω`; }
    }
    function update() {
      g = gammaOfLoad(R, X, open);
      xClass(sX, open ? 0 : X);
      const m = RF.C.abs(g);
      rZ.set(open ? "∞ (açık devre)" : zStr(R, X, false));
      rG.set(m < 5e-4 ? "0" : `${num(g.re, 3)} ${g.im < 0 ? "−" : "+"} j${num(Math.abs(g.im), 3)}`);
      rA.set(num(m, 3));
      rD.set(m < 5e-4 ? "tanımsız" : num(RF.C.arg(g) * DEG, 1) + "°");
      rP.set(pct(1 - RF.powerDelivered(g)));
    }

    const st = canvas(cv, draw);
    function layout() {
      const { w, h: H } = st, pad = 14;
      if (w >= 620) {
        const S = Math.min(H - 2 * pad, w * 0.56);
        geo = { cx: pad + S / 2, cy: H / 2, R: S / 2 - 34, morph: 0 };
        panel = { x: pad + S + 18, y: pad + 8, w: w - pad * 2 - S - 18, h: H - 2 * pad - 8 };
      } else {
        const S = Math.min(w - 2 * pad, H * 0.58);
        geo = { cx: w / 2, cy: pad + S / 2, R: S / 2 - 30, morph: 0 };
        panel = { x: pad, y: pad + S + 6, w: w - 2 * pad, h: H - S - 2 * pad - 6 };
      }
    }
    function draw() {
      const { ctx, w, h: H } = st;
      if (!w) return;
      layout();
      ctx.clearRect(0, 0, w, H);
      const { cx: ox, cy: oy, R: Rr } = geo;
      Smith.draw(ctx, geo, { faint: true, labels: false });
      // eksenler
      ctx.save(); ctx.strokeStyle = rgba(C.ink2, 0.35); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(ox - Rr - 10, oy); ctx.lineTo(ox + Rr + 10, oy); ctx.moveTo(ox, oy - Rr - 10); ctx.lineTo(ox, oy + Rr + 10); ctx.stroke();
      ctx.restore();
      V.text(ctx, "−1", ox - Rr - 6, oy - 6, { size: 10, font: "num", align: "right", color: C.muted });
      V.text(ctx, "+1", ox + Rr + 6, oy - 6, { size: 10, font: "num", color: C.muted });
      V.text(ctx, "+j", ox + 5, oy - Rr - 6, { size: 10, font: "num", color: C.muted });
      V.text(ctx, "−j", ox + 5, oy + Rr + 14, { size: 10, font: "num", color: C.muted });
      const fs = Rr > 140 ? 12 : 9.5;
      V.text(ctx, "kısa devre", ox - Rr + 6, oy + 16, { size: fs, weight: 600, color: C.ink2 });
      V.text(ctx, "açık devre", ox + Rr - 6, oy + 16, { size: fs, weight: 600, color: C.ink2, align: "right" });
      V.text(ctx, Rr > 185 ? `uyumlu (${nz(Z0)} Ω)` : "uyumlu", ox + 6, oy + 16, { size: fs, weight: 600, color: C.ink2 });
      V.text(ctx, "+X endüktif", ox, oy - Rr * 0.62, { size: fs, weight: 600, color: C.Xp, align: "center" });
      V.text(ctx, "−X kapasitif", ox, oy + Rr * 0.62 + 4, { size: fs, weight: 600, color: C.Xn, align: "center" });
      // |Γ| dairesi, açı yayı, ok
      const m = RF.C.abs(gd), a = Math.atan2(gd.im, gd.re);
      if (m > 0.01) {
        Smith.vswrCircle(ctx, geo, m, C.ref);
        const ar = Math.min(Rr * 0.2, m * Rr * 0.6);
        if (ar > 8) {
          ctx.save(); ctx.strokeStyle = rgba(C.ref, 0.7); ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.arc(ox, oy, ar, 0, -a, a > 0); ctx.stroke(); ctx.restore();
        }
      }
      const px = ox + gd.re * Rr, py = oy - gd.im * Rr;
      if (m > 0.02) {
        ctx.save(); ctx.shadowColor = C.ref; ctx.shadowBlur = 10;
        V.arrow(ctx, ox, oy, px, py, C.ref, 3, 12); ctx.restore();
      }
      ctx.save(); ctx.fillStyle = C.copper; ctx.strokeStyle = C.deep; ctx.lineWidth = 2; ctx.shadowColor = C.copper; ctx.shadowBlur = drag ? 16 : 8;
      ctx.beginPath(); ctx.arc(px, py, drag ? 8 : 6.5, 0, 7); ctx.fill(); ctx.shadowBlur = 0; ctx.stroke(); ctx.restore();
      ctx.save(); ctx.fillStyle = C.ink2; ctx.beginPath(); ctx.arc(ox, oy, 2.5, 0, 7); ctx.fill(); ctx.restore();
      V.text(ctx, "Γ", px + (gd.re >= 0 ? 10 : -10), py - 10, { size: 15, weight: 700, color: C.ref, align: gd.re >= 0 ? "left" : "right" });

      drawPanel(ctx);
    }
    function drawPanel(ctx) {
      const { x, y, w: pw, h: ph } = panel;
      if (pw < 120 || ph < 120) return;
      const gm = RF.C.abs(g), ga = RF.C.arg(g);
      V.text(ctx, "Yükte gelen ve yansıyan dalga", x, y + 12, { size: 12.5, weight: 600, color: C.ink });
      const wy = y + 26, wh = Math.min(ph * 0.5, 190);
      ctx.save(); ctx.fillStyle = rgba(C.deep, 0.45); ctx.fillRect(x, wy, pw, wh); ctx.restore();
      V.graticule(ctx, x, wy, pw, wh, 8, 4);
      const ph0 = t * 2 * Math.PI * 0.6;
      V.fn(ctx, (u) => Math.cos(2 * Math.PI * u - ph0), 0, 2, x, wy, pw, wh, -1.25, 1.25, C.fwd, 2, { glow: 6 });
      if (gm > 1e-3) V.fn(ctx, (u) => gm * Math.cos(2 * Math.PI * u - ph0 + ga), 0, 2, x, wy, pw, wh, -1.25, 1.25, C.ref, 2, { glow: 6 });
      V.text(ctx, "gelen", x + 6, wy + 14, { size: 11, weight: 600, color: C.fwd });
      V.text(ctx, "yansıyan", x + 52, wy + 14, { size: 11, weight: 600, color: C.ref });
      // güç çubukları
      const rows = [["Gelen güç", 1, C.fwd], ["Yansıyan güç (|Γ|²)", 1 - RF.powerDelivered(g), C.ref], ["Yükte harcanan", RF.powerDelivered(g), C.R]];
      let by = wy + wh + 30;
      const bh = 10, gap = Math.min(42, (y + ph - by) / 3);
      if (gap < 26) return;
      for (const [lab, v, col] of rows) {
        V.text(ctx, lab, x, by - 6, { size: 11.5, weight: 500, color: C.ink2 });
        V.text(ctx, pct(v), x + pw, by - 6, { size: 11.5, font: "num", color: col, align: "right" });
        ctx.save(); ctx.fillStyle = C.deep; ctx.strokeStyle = C.line; ctx.fillRect(x, by, pw, bh); ctx.strokeRect(x + 0.5, by + 0.5, pw - 1, bh - 1);
        ctx.fillStyle = col; ctx.globalAlpha = 0.85; ctx.fillRect(x + 1, by + 1, Math.max(0, (pw - 2) * v), bh - 2); ctx.restore();
        by += gap;
      }
    }
    function setFromXY(px, py) {
      let gr = (px - geo.cx) / geo.R, gi = -(py - geo.cy) / geo.R;
      const m = Math.hypot(gr, gi);
      if (m > 1) { gr /= m; gi /= m; }
      if (Math.hypot(gr - 1, gi) < 0.02) { open = true; R = 0; X = 0; }
      else {
        const z = RF.zFromGamma(cx(gr, gi), Z0);
        open = false; R = Math.max(0, z.re); X = z.im;
        if (R < 0.05) R = 0;
      }
      g = gammaOfLoad(R, X, open); gd = { ...g };
      syncSliders(); update();
    }
    pointer(cv, {
      down(x, y) { if (!geo) return; if (Math.hypot(x - geo.cx, y - geo.cy) <= geo.R * 1.08) { drag = true; setFromXY(x, y); } },
      move(x, y) { if (drag) setFromXY(x, y); },
      up() { drag = false; },
    });
    const lp = loop((dt) => {
      t += dt;
      const k = Math.min(1, dt * 9);
      gd = { re: gd.re + (g.re - gd.re) * k, im: gd.im + (g.im - gd.im) * k };
      draw();
    });
    update();
    return { enter() { lp.start(); }, leave() { lp.stop(); } };
  };

  /* =====================================================================
     3) Duran dalga
     ===================================================================== */
  Demos.ch3Swr = function (stage, slide) {
    stage.classList.add("ch3");
    const F = 145e6, VF = RF.CABLES["RG-58"].vf, LAM = RF.wavelength(F, VF), LENW = 2.25; // hat uzunluğu (λ)
    const fillSpan = (k, s) => slide.querySelectorAll(`[data-ch3="${k}"]`).forEach((e) => (e.textContent = s));
    fillSpan("swr-f", L.hz(F, 0)); fillSpan("swr-vf", num(VF, 2)); fillSpan("swr-half", meters(LAM / 2));
    let R = 100, X = 0, open = false, t = 0, g = gammaOfLoad(R, X, open);
    const show = { fwd: false, ref: false };

    const cv = h("canvas", { "aria-label": "Hat boyunca duran dalga: toplam gerilim, zarf, en yüksek ve en düşük gerilim noktaları" });
    const fill = h("div.fill", cv);
    const rA = readout("|Γ|", "c-ref"), rS = readout("VSWR", "c-tot"), rRL = readout("Geri dönüş kaybı"), rML = readout("Uyumsuzluk kaybı");
    const rV = readout("Vmax / Vmin (zarftan)", "c-tot");
    const top = h("div.controls.top", h("div.readouts", rA, rS, rRL, rML, rV));
    const sR = slider({ label: "Yük direnci R", min: 0, max: 300, step: 1, value: R, fmt: (v) => nz(v) + " Ω", cls: "c-r",
      oninput: (v) => { R = v; open = false; update(); } });
    const sX = slider({ label: "Yük reaktansı X", min: -150, max: 150, step: 1, value: X, fmt: xStr, cls: "c-xp",
      oninput: (v) => { X = v; if (open) { open = false; sR.set(R); } update(); } });
    const btn = (lab, f) => h("button.btn", { type: "button", onclick: f }, lab);
    const set = (r, x, o) => { R = r; X = x; open = o; sR.set(R); sX.set(X); if (o) sR.querySelector("output").textContent = "∞ Ω"; update(); };
    const pre = h("div.ch3-presets", { role: "group", "aria-label": "Hazır yükler" },
      btn("50 Ω", () => set(50, 0, false)), btn("75 Ω", () => set(75, 0, false)), btn("150 Ω", () => set(150, 0, false)), btn("Açık devre", () => set(R, 0, true)));
    const tF = toggle("İleri", false, (v) => (show.fwd = v), "c-fwd"), tR = toggle("Yansıyan", false, (v) => (show.ref = v), "c-ref");
    const pctEl = h("b"), barA = h("i.ant"), barR = h("i.back");
    const power = h("div.ch3-power",
      h("div.head", h("span", "Verici çıkışındaki gücün antene ulaşan kısmı"), pctEl),
      h("div.ch3-meter", { role: "img", "aria-label": "Antene ulaşan güç çubuğu" }, barA, barR),
      h("div.foot", h("span.c-fwd", "antene"), h("span.c-ref", "geri döner"), h("span.note-small", "kayıpsız hat, uyumlu verici")));
    const ctrl = h("div.controls", sR, sX, pre, tF, tR, power);
    stage.append(top, fill, ctrl);

    // zarf örnekleri (yükten uzaklık d/λ: 0 … LENW)
    const NS = 900, env = new Float64Array(NS + 1);
    let ext = null;
    function update() {
      g = gammaOfLoad(R, X, open);
      xClass(sX, open ? 0 : X);
      for (let i = 0; i <= NS; i++) env[i] = RF.envelope(g, 2 * Math.PI * (i / NS) * LENW);
      // yerel tepe ve çukurlar (yüke en yakın olanlar)
      const maxs = [], mins = [];
      for (let i = 1; i < NS; i++) {               // yalnızca iç noktalar: uçlar gerçek tepe değil
        const a = env[i - 1], b = env[i + 1];
        if (env[i] >= a && env[i] >= b) maxs.push(i);
        if (env[i] <= a && env[i] <= b) mins.push(i);
      }
      let vmax = -1, vmin = 9;
      for (let i = 0; i <= NS; i++) { vmax = Math.max(vmax, env[i]); vmin = Math.min(vmin, env[i]); }
      ext = { maxs, mins, vmax, vmin };
      const m = RF.C.abs(g), s = RF.vswr(g);
      rA.set(num(m, 3));
      rS.set(isFinite(s) ? num(s, 2) + " : 1" : "∞");
      rRL.set(db(RF.returnLoss(g) + 0, 1));
      rML.set(db(RF.mismatchLoss(g) + 0, 2));
      rV.set(vmin > 1e-6 ? num(vmax / vmin, 2) + " : 1" : "∞");
      const p = RF.powerDelivered(g);
      pctEl.textContent = pct(p);
      barA.style.width = (p * 100).toFixed(2) + "%";
      barR.style.width = ((1 - p) * 100).toFixed(2) + "%";
    }

    const st = canvas(cv, draw);
    function draw() {
      const { ctx, w, h: H } = st;
      if (!w) return;
      ctx.clearRect(0, 0, w, H);
      const pad = 16, narrow = w < 560;
      const xs = pad + (narrow ? 26 : 34), xe = w - pad - (narrow ? 34 : 54);
      const py = pad + 26, ph = Math.max(80, H - py - 46), pw = xe - xs;
      const YR = 2.2, Y_ = (v) => py + ph / 2 - (v / YR) * (ph / 2);
      const xOf = (dWl) => xe - (dWl / LENW) * pw;                // d: yükten uzaklık (λ)
      ctx.save(); ctx.fillStyle = rgba(C.deep, 0.45); ctx.fillRect(xs, py, pw, ph); ctx.restore();
      V.graticule(ctx, xs, py, pw, ph, 9, 8);
      for (const v of [2, 1, 0, -1, -2]) V.text(ctx, v === 0 ? "0" : (v > 0 ? "+" : "−") + Math.abs(v), xs - 6, Y_(v) + 4, { size: 10, font: "num", align: "right", color: C.muted });
      // verici ve yük
      V.text(ctx, "verici", xs, py - 9, { size: 11.5, weight: 600, color: C.ink2 });
      V.text(ctx, "yük", xe, py - 9, { size: 11.5, weight: 600, color: C.ink2, align: "right" });
      drawLoad(ctx, xe + (narrow ? 18 : 28), Y_(0.9), Y_(-0.9), R, X, open);
      line(ctx, [[xe, Y_(0.9)], [xe + (narrow ? 18 : 28), Y_(0.9)]], rgba(C.ink2, 0.7));
      line(ctx, [[xe, Y_(-0.9)], [xe + (narrow ? 18 : 28), Y_(-0.9)]], rgba(C.ink2, 0.7));

      // zarf: dolgu + kesikli kenarlar
      ctx.save();
      ctx.beginPath();
      for (let i = 0; i <= NS; i++) { const x = xOf((i / NS) * LENW), y = Y_(env[i]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      for (let i = NS; i >= 0; i--) ctx.lineTo(xOf((i / NS) * LENW), Y_(-env[i]));
      ctx.closePath(); ctx.fillStyle = rgba(C.tot, 0.06); ctx.fill();
      ctx.restore();
      const envArr = Array.from(env).reverse(); // soldan sağa: verici → yük
      V.trace(ctx, envArr, xs, py, pw, ph, -YR, YR, rgba(C.tot, 0.75), 1.3, { dash: [5, 4] });
      V.trace(ctx, envArr.map((v) => -v), xs, py, pw, ph, -YR, YR, rgba(C.tot, 0.75), 1.3, { dash: [5, 4] });
      // anlık dalgalar: V(d,t) = Re{(e^(jβd) + Γ e^(−jβd)) e^(jωt)}
      const wt = t * 2 * Math.PI * 0.7, gm = RF.C.abs(g), ga = RF.C.arg(g);
      const fwd = (u) => Math.cos(wt + 2 * Math.PI * u);
      const rev = (u) => gm * Math.cos(wt - 2 * Math.PI * u + ga);
      const dOfU = (u) => (1 - u) * LENW; // u: 0 (verici) … 1 (yük)
      ctx.save(); ctx.beginPath(); ctx.rect(xs, py, pw, ph); ctx.clip();
      if (show.ref) V.fn(ctx, (u) => rev(dOfU(u)), 0, 1, xs, py, pw, ph, -YR, YR, C.ref, 1.6, { glow: 5 });
      if (show.fwd) V.fn(ctx, (u) => fwd(dOfU(u)), 0, 1, xs, py, pw, ph, -YR, YR, C.fwd, 1.6, { glow: 5 });
      V.fn(ctx, (u) => fwd(dOfU(u)) + rev(dOfU(u)), 0, 1, xs, py, pw, ph, -YR, YR, C.tot, 2.6, { glow: 10, samples: Math.round(pw) });
      ctx.restore();

      // tepe / çukur işaretleri ve λ/2 ölçüsü
      if (ext && ext.vmax - ext.vmin > 0.02) {
        const { maxs, mins } = ext;
        const mk = (i, lab, val, up) => {
          const x = xOf((i / NS) * LENW), y = Y_(up ? env[i] : env[i]);
          ctx.save(); ctx.setLineDash([2, 3]); ctx.strokeStyle = rgba(C.tot, 0.5); ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(x + 0.5, Y_(0)); ctx.lineTo(x + 0.5, y); ctx.stroke(); ctx.restore();
          ctx.save(); ctx.fillStyle = C.tot; ctx.beginPath(); ctx.arc(x, y, 3.5, 0, 7); ctx.fill(); ctx.restore();
          V.text(ctx, `${lab} ${num(val, 2)}`, x, up ? y - 9 : y + 17, { size: 11, font: "num", align: "center", color: C.tot });
        };
        if (maxs.length) mk(maxs[0], "Vmax", env[maxs[0]], true);
        if (mins.length) mk(mins[0], "Vmin", env[mins[0]], false);
        if (maxs.length >= 2) {
          const x0 = xOf((maxs[0] / NS) * LENW), x1 = xOf((maxs[1] / NS) * LENW), yy = py + ph + 22;
          const dl = ((maxs[1] - maxs[0]) / NS) * LENW * LAM; // ölçülen tepe aralığı (m)
          V.dimension(ctx, x1, yy, x0, yy, `λ/2 = ${meters(dl)}`, { size: 11.5 });
        }
      } else {
        V.text(ctx, "zarf düz: duran dalga yok, VSWR 1 : 1", (xs + xe) / 2, py + 22, { size: 12.5, weight: 600, align: "center", color: C.ink });
      }
      V.text(ctx, `${L.hz(F, 0)}, RG-58`, xs, py + ph + 26, { size: 10.5, color: C.muted, font: "num" });
    }
    const lp = loop((dt) => { t += dt; draw(); });
    update();
    return { enter() { lp.start(); }, leave() { lp.stop(); } };
  };

  /* =====================================================================
     4) TDR: osiloskop + "Arızayı bul"
     ===================================================================== */
  Demos.ch3Tdr = function (stage, slide) {
    stage.classList.add("ch3");
    const VF = RF.CABLES["RG-58"].vf, LEN = 25, DX = 0.05, N = Math.round(LEN / DX);
    const DT = DX / (VF * RF.c0);                 // bir adımın süresi (s): dalga bir hücre ilerler
    const W = 12, T0 = 2.2 * W;                    // darbe tepesi kaynaktan T0 adımda çıkar
    const TA = -30e-9, TB = 270e-9;                // osiloskop penceresi
    const S = Math.ceil(T0 + TB / DT) + 2, SPF = 9;
    const CRUSH = { Z: 35, n: Math.round(1.0 / DX) }, CONN = { Z: 120, n: Math.round(0.15 / DX) };
    const NAMES = { open: "Kopuk", short: "Kısa devre", crush: "Ezik", conn: "Kötü konektör" };
    const fillSpan = (k, s) => slide.querySelectorAll(`[data-ch3="${k}"]`).forEach((e) => (e.textContent = s));
    fillSpan("tdr-vf", num(VF, 2)); fillSpan("tdr-cm1", meters(VF * RF.c0 * 1e-9)); fillSpan("tdr-cm2", meters(RF.distanceFromRoundTrip(1e-9, VF)));

    const sim = new FDTD1D.Sim({ N, Z0, Rs: Z0 });
    sim.source = { kind: "pulse", width: W, amp: 1 };
    sim.load = { R: Z0 };
    let mode = "free", free = { type: "crush", k: Math.round(12 / DX) }, guessType = "open";
    const game = { type: "open", k: 0, guessK: null, revealed: false, n: 0, sum: 0, hits: 0, last: null };
    let cur = new Float64Array(S), curF = new Float64Array(S), curR = new Float64Array(S), prev = null, idx = 0;
    let cursor = null, echo = null, region = null;
    const fault = () => (mode === "free" ? free : game);

    const cv = h("canvas", { "aria-label": "TDR: osiloskopta kaynak ucundaki gerilim, altta kablo ve arıza yeri" });
    const fill = h("div.fill", cv);
    const rCur = readout("İmleç"), rEcho = readout("Yankı zamanı (FDTD)", "c-ref"), rDist = readout("Uzaklık (RF)", "c-ref"), rTrue = readout("Gerçek yer");
    const rLast = readout("Son hata"), rAvg = readout("Ortalama hata"), rType = readout("Tür tahmini");
    const top = h("div.controls.top", h("div.readouts", rCur, rEcho, rDist, rTrue, rLast, rAvg, rType));
    const modeSeg = seg([["free", "Serbest"], ["game", "Arızayı bul"]], mode, setMode, "Kip");
    const typeLab = h("span.lab", "Arıza türü");
    const typeSeg = seg(Object.entries(NAMES), free.type, (k) => {
      if (mode === "free") { free.type = k; applyFault(); } else guessType = k;
    }, "Arıza türü");
    const newBtn = h("button.btn.primary", { type: "button", onclick: () => newFault() }, "Yeni arıza");
    const ctrl = h("div.controls", modeSeg, newBtn, h("span.ch3-group", typeLab, typeSeg));
    stage.append(top, fill, ctrl);

    function applyFault() {
      const f = fault(), k0 = f.k;
      const fn = {
        open: (k) => (k >= k0 ? 1e5 : Z0),
        short: (k) => (k >= k0 ? 0.02 : Z0),
        crush: (k) => (k >= k0 && k < k0 + CRUSH.n ? CRUSH.Z : Z0),
        conn: (k) => (k >= k0 && k < k0 + CONN.n ? CONN.Z : Z0),
      }[f.type];
      sim.setProfile(fn);
      prev = null; echo = null;
      restart();
      ui();
    }
    function restart() { sim.reset(); sim.fire(); idx = 0; }
    function newFault() {
      game.type = Object.keys(NAMES)[Math.floor(Math.random() * 4)];
      game.k = Math.round((3 + Math.random() * 19) / DX);
      game.guessK = null; game.revealed = false;
      applyFault();
    }
    function setMode(m) {
      mode = m;
      typeLab.textContent = m === "free" ? "Arıza türü" : "Tahmininiz";
      typeSeg.set(m === "free" ? free.type : guessType);
      if (m === "game") newFault(); else applyFault();
    }
    function ui() {
      const g = mode === "game";
      newBtn.style.display = g ? "" : "none";
      [rEcho, rDist, rTrue].forEach((r) => (r.style.display = g ? "none" : ""));
      [rLast, rAvg, rType].forEach((r) => (r.style.display = g ? "" : "none"));
      if (g) {
        rLast.set(game.last ? meters(game.last.err) : "—");
        rAvg.set(game.n ? `${meters(game.sum / game.n)} (${game.n} tur)` : "—");
        rType.set(game.last ? (game.last.ok ? "doğru" : `yanlış: ${NAMES[game.last.type].toLocaleLowerCase("tr")}`) + (game.n ? ` · ${game.hits}/${game.n}` : "") : "—");
      } else {
        rTrue.set(meters(free.k * DX));
        rEcho.set(echo ? num(echo.t * 1e9, 1) + " ns" : "ölçülüyor…");
        rDist.set(echo ? meters(echo.d) : "—");
      }
      rCur.set(cursor == null ? "osiloskopa dokunun" : num(cursor * 1e9, 1) + " ns" + (g && !game.revealed ? "" : " → " + meters(Math.max(0, RF.distanceFromRoundTrip(cursor, VF)))));
    }
    // Yankıyı ölç: gelen darbenin kaynaktaki tepesi ile ilk büyük yankı tepesi arasındaki süre
    function analyze() {
      let ti = 0; for (let i = 1; i < S; i++) if (curF[i] > curF[ti]) ti = i;
      let mx = 0; for (let i = ti; i < S; i++) mx = Math.max(mx, Math.abs(curR[i]));
      if (mx < 0.02) { echo = null; return; }
      let j = ti; while (j < S - 1 && Math.abs(curR[j]) < 0.5 * mx) j++;
      while (j < S - 1 && Math.abs(curR[j + 1]) > Math.abs(curR[j])) j++;
      const t = (j - ti) * DT;
      echo = { t, v: curR[j], d: RF.distanceFromRoundTrip(t, VF) };
    }
    function tick() {
      for (let i = 0; i < SPF; i++) {
        if (idx < S) { sim.step(1); cur[idx] = sim.V[0]; curF[idx] = sim.fwd[0]; curR[idx] = sim.rev[0]; idx++; }
        else { analyze(); prev = cur.slice(); ui(); restart(); }
      }
    }

    const st = canvas(cv, draw);
    let lay = null;
    function layout() {
      const { w, h: H } = st, pad = 14;
      const sh = Math.round((H - 2 * pad) * 0.68);
      const scope = { x: pad, y: pad, w: w - 2 * pad, h: sh };
      const by = pad + sh + 8;
      const cy = by + Math.max(52, (H - by - pad) * 0.4);
      const cxs = pad + (w < 560 ? 44 : 64), cxe = w - pad - (w < 560 ? 30 : 46);
      lay = { pad, scope, by, cy, cxs, cxe };
    }
    const tOfX = (x) => TA + ((x - lay.scope.x) / lay.scope.w) * (TB - TA);
    const xOfT = (t) => lay.scope.x + ((t - TA) / (TB - TA)) * lay.scope.w;
    const kOfX = (x) => Math.round(clamp((x - lay.cxs) / (lay.cxe - lay.cxs), 0, 1) * N);
    const xOfK = (k) => lay.cxs + (k / N) * (lay.cxe - lay.cxs);
    const tOfStep = (i) => (i - T0) * DT;

    function scopeTrace(ctx, arr, n, color, lw, glow, alpha) {
      const { x, y, w, h: hh } = lay.scope, YR = 1.2;
      ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, hh); ctx.clip();
      ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineJoin = "round"; ctx.globalAlpha = alpha;
      if (glow) { ctx.shadowColor = color; ctx.shadowBlur = glow; }
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < n; i++) {
        const px = xOfT(tOfStep(i)); if (px < x - 2) continue;
        const py = y + hh / 2 - (arr[i] / YR) * (hh / 2);
        started ? ctx.lineTo(px, py) : (ctx.moveTo(px, py), (started = true));
      }
      ctx.stroke(); ctx.restore();
    }
    function draw() {
      const { ctx, w, h: H } = st;
      if (!w) return;
      layout();
      ctx.clearRect(0, 0, w, H);
      const { scope: sc, cy, cxs, cxe, pad } = lay;
      const gameHidden = mode === "game" && !game.revealed;
      // osiloskop ekranı
      ctx.save(); ctx.fillStyle = rgba(C.deep, 0.7); ctx.fillRect(sc.x, sc.y, sc.w, sc.h); ctx.restore();
      V.graticule(ctx, sc.x, sc.y, sc.w, sc.h, 10, 8);
      V.corners(ctx, sc.x, sc.y, sc.w, sc.h, 10, C.line2);
      const per = (TB - TA) / 10;
      for (let i = 1; i <= 9; i += 2) {
        const tt = TA + i * per;
        V.text(ctx, `${num(tt * 1e9, 0)} ns`, sc.x + (i / 10) * sc.w, sc.y + sc.h - 6, { size: 10, font: "num", align: "center", color: C.muted });
      }
      V.text(ctx, "Kaynak ucundaki gerilim", sc.x + 10, sc.y + 18, { size: 12, weight: 600, color: C.ink });
      V.text(ctx, `${num(per * 1e9, 0)} ns / bölme`, sc.x + sc.w - 10, sc.y + 18, { size: 10.5, font: "num", align: "right", color: C.muted });
      if (mode === "game") V.text(ctx, `1 ns ↔ ${meters(RF.distanceFromRoundTrip(1e-9, VF))} kablo (gidiş-dönüş)`, sc.x + sc.w - 10, sc.y + 34, { size: 10.5, font: "num", align: "right", color: C.ink2 });
      // eski tarama (kalıcılık) ve yeni tarama
      if (prev) scopeTrace(ctx, prev, S, C.tot, 1.4, 0, 0.22);
      scopeTrace(ctx, cur, idx, C.tot, 2.2, 9, 1);
      if (idx > 0 && idx < S) {
        const px = xOfT(tOfStep(idx - 1)), py = sc.y + sc.h / 2 - (cur[idx - 1] / 1.2) * (sc.h / 2);
        if (px > sc.x) { ctx.save(); ctx.fillStyle = C.tot; ctx.shadowColor = C.tot; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(px, py, 2.6, 0, 7); ctx.fill(); ctx.restore(); }
      }
      V.text(ctx, "giden darbe", xOfT(0) + 8, sc.y + sc.h * 0.12 + 14, { size: 11, weight: 600, color: C.fwd });
      if (!gameHidden && echo) {
        const ex = xOfT(echo.t), ey = sc.y + sc.h / 2 - (echo.v / 1.2) * (sc.h / 2);
        V.text(ctx, "yankı", ex + 8, ey + (echo.v > 0 ? -6 : 16), { size: 11, weight: 600, color: C.ref });
      }
      // imleç
      if (cursor != null) {
        const x = xOfT(cursor);
        ctx.save(); ctx.setLineDash([4, 4]); ctx.strokeStyle = C.copper; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(x + 0.5, sc.y); ctx.lineTo(x + 0.5, sc.y + sc.h); ctx.stroke(); ctx.restore();
        const lab = num(cursor * 1e9, 1) + " ns";
        ctx.save(); ctx.font = `500 11px ${FONT.num}`; const tw = ctx.measureText(lab).width; ctx.restore();
        const lx = clamp(x - tw / 2 - 5, sc.x + 2, sc.x + sc.w - tw - 12);
        ctx.save(); ctx.fillStyle = C.copper; ctx.fillRect(lx, sc.y + 42, tw + 10, 17); ctx.restore();
        V.text(ctx, lab, lx + 5, sc.y + 54, { size: 11, font: "num", color: "#1f0d03" });
      }

      // kablo
      const ch = 12;
      V.text(ctx, "TDR", pad + 4, cy + 4, { size: 11, weight: 700, color: C.ink });
      ctx.save(); ctx.strokeStyle = rgba(C.ink2, 0.8); ctx.lineWidth = 1.4; ctx.strokeRect(pad + 0.5, cy - 15.5, cxs - pad - 10, 31); ctx.restore();
      line(ctx, [[cxs - 10, cy], [cxs, cy]], rgba(C.ink2, 0.8));
      const f = fault(), showFault = !gameHidden;
      const cut = (f.type === "open" || f.type === "short") && showFault ? xOfK(f.k) : cxe;
      // kılıf
      ctx.save();
      ctx.fillStyle = "#1c3c5c"; ctx.strokeStyle = C.line2; ctx.lineWidth = 1;
      ctx.fillRect(cxs, cy - ch / 2, cxe - cxs, ch); ctx.strokeRect(cxs + 0.5, cy - ch / 2 + 0.5, cxe - cxs - 1, ch - 1);
      ctx.strokeStyle = rgba(C.copper, 0.55); ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(cxs, cy); ctx.lineTo(cxe, cy); ctx.stroke();
      ctx.restore();
      // uçtaki anten / 50 Ω yük
      const ax = cxe + 12;
      line(ctx, [[cxe, cy], [ax, cy], [ax, cy - 26]], rgba(C.ink2, 0.85));
      line(ctx, [[ax - 9, cy - 34], [ax, cy - 26], [ax + 9, cy - 34]], rgba(C.ink2, 0.85));
      V.text(ctx, `${nz(Z0)} Ω`, ax - 12, cy - 18, { size: 10, font: "num", align: "right", color: C.muted });
      // cetvel
      const ry = cy + 20;
      ctx.save(); ctx.strokeStyle = rgba(C.ink2, 0.5); ctx.lineWidth = 1; ctx.beginPath();
      for (let m = 0; m <= LEN; m++) { const x = Math.round(xOfK(m / DX)) + 0.5, l = m % 5 ? 4 : 8; ctx.moveTo(x, ry); ctx.lineTo(x, ry + l); }
      ctx.moveTo(cxs, ry + 0.5); ctx.lineTo(cxe, ry + 0.5); ctx.stroke(); ctx.restore();
      for (let m = 0; m <= LEN; m += 5) V.text(ctx, `${m} m`, xOfK(m / DX), ry + 20, { size: 10, font: "num", align: "center", color: C.muted });
      // kablodaki dalga (serbest kipte ya da sonuç gösterilince)
      if (showFault) {
        const kmax = f.type === "open" || f.type === "short" ? f.k : N, wy = cy - 46, wh = 30;
        const ww = (kmax / N) * (cxe - cxs);
        blip(ctx, sim.rev, kmax, wy, wh, C.ref);
        blip(ctx, sim.fwd, kmax, wy, wh, C.fwd);
        drawFault(ctx, f, cy, ch);
      }
      // oyun: tahmin ve sonuç
      if (mode === "game" && game.guessK != null) {
        const gx = xOfK(game.guessK);
        ctx.save(); ctx.fillStyle = C.copper; ctx.beginPath(); ctx.moveTo(gx, cy - ch / 2 - 2); ctx.lineTo(gx - 7, cy - ch / 2 - 14); ctx.lineTo(gx + 7, cy - ch / 2 - 14); ctx.fill(); ctx.restore();
        const fx = xOfK(game.k);
        V.text(ctx, "tahmin", gx, cy - ch / 2 - 18, { size: 10.5, weight: 600, align: "center", color: C.copper });
        if (Math.abs(fx - gx) > 4) V.dimension(ctx, Math.min(gx, fx), cy + 60, Math.max(gx, fx), cy + 60, meters(game.last.err), { size: 10.5 });
      }
      if (gameHidden) V.text(ctx, game.guessK == null ? "Arıza nerede? Kabloya tıklayın." : "", (cxs + cxe) / 2, cy - 22, { size: 12, weight: 600, align: "center", color: C.ink2 });
    }
    // kablonun üstünde yalnızca dalganın olduğu parçaları çiz (düz sıfır çizgisi yerine)
    function blip(ctx, arr, kmax, y, hh, color) {
      ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 1.6; ctx.shadowColor = color; ctx.shadowBlur = 6; ctx.beginPath();
      let on = false;
      for (let k = 0; k <= kmax; k++) {
        const v = arr[k];
        if (Math.abs(v) < 0.004) { on = false; continue; }
        const x = xOfK(k), yy = y + hh / 2 - (v / 1.2) * (hh / 2);
        on ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); on = true;
      }
      ctx.stroke(); ctx.restore();
    }
    function drawFault(ctx, f, cy, ch) {
      const x = xOfK(f.k);
      let lab = NAMES[f.type].toLocaleLowerCase("tr");
      ctx.save();
      if (f.type === "open") {
        ctx.fillStyle = C.stage; ctx.fillRect(x - 1, cy - ch / 2 - 2, 7, ch + 4);
        line(ctx, [[x - 1, cy - ch / 2], [x + 1, cy - 2], [x - 2, cy + 2], [x, cy + ch / 2]], C.ink, 1.4);
      } else if (f.type === "short") {
        ctx.shadowColor = C.ink; ctx.shadowBlur = 8;
        line(ctx, [[x - 4, cy - ch / 2 - 6], [x + 3, cy - 2], [x - 3, cy + 2], [x + 4, cy + ch / 2 + 6]], C.ink, 2);
      } else if (f.type === "crush") {
        const x1 = xOfK(f.k + CRUSH.n);
        ctx.fillStyle = C.stage; ctx.fillRect(x, cy - ch / 2 - 1, x1 - x, 4); ctx.fillRect(x, cy + ch / 2 - 3, x1 - x, 4);
        ctx.strokeStyle = C.ink; ctx.lineWidth = 1.2; ctx.strokeRect(x + 0.5, cy - ch / 2 + 3.5, Math.max(2, x1 - x - 1), ch - 7);
      } else {
        const x1 = Math.max(x + 6, xOfK(f.k + CONN.n));
        ctx.fillStyle = "#5c7088"; ctx.strokeStyle = C.ink; ctx.lineWidth = 1.2;
        ctx.fillRect(x - 2, cy - ch / 2 - 4, x1 - x + 4, ch + 8); ctx.strokeRect(x - 1.5, cy - ch / 2 - 3.5, x1 - x + 3, ch + 7);
      }
      ctx.restore();
      V.text(ctx, `${lab} · ${meters(f.k * DX)}`, clamp(x, lay.cxs + 50, lay.cxe - 50), cy + 58 + (mode === "game" ? 20 : 0), { size: 11, weight: 600, align: "center", color: C.ink });
    }

    function handle(x, y, first) {
      if (!lay) return;
      if (first) region = y < lay.scope.y + lay.scope.h + 4 ? "scope" : "cable";
      if (region === "scope") { cursor = clamp(tOfX(x), TA, TB); ui(); return; }
      if (mode === "free") {
        const k = clamp(kOfX(x), Math.round(1 / DX), N - Math.round(1.2 / DX));
        if (k !== free.k) { free.k = k; applyFault(); }
      } else if (first && !game.revealed) {
        game.guessK = kOfX(x);
        const err = Math.abs(game.guessK - game.k) * DX, ok = guessType === game.type;
        game.n++; game.sum += err; game.hits += ok ? 1 : 0;
        game.last = { err, ok, type: game.type };
        game.revealed = true; ui();
      }
    }
    pointer(cv, {
      down: (x, y) => handle(x, y, true),
      move: (x, y) => handle(x, y, false),
      up: () => { region = null; },
      hover: (x, y) => { if (x >= 0 && lay && y < lay.scope.y + lay.scope.h) { cursor = clamp(tOfX(x), TA, TB); ui(); } },
    });

    const lp = loop(() => { tick(); draw(); });
    setMode("free");
    return { enter() { lp.start(); }, leave() { lp.stop(); } };
  };

  window.GLOSSARY_EXTRA = (window.GLOSSARY_EXTRA || []).concat([
    { k: ["osiloskop"], t: "Osiloskop", d: "Bir gerilimin zamanla nasıl değiştiğini ekranda çizen ölçü aleti.", u: "https://tr.wikipedia.org/wiki/Osiloskop" },
  ]);

  window.GUIDE_SCENARIOS = Object.assign(window.GUIDE_SCENARIOS || {}, {
    "hat-simulasyonu": [{ click: "=Kısa devre" }, { wait: 2200 }, { click: "=Açık devre" }, { wait: 2200 }, { click: "=50 Ω" }],
    "yansima-katsayisi": [{ click: "=Kısa devre" }, { wait: 800 }, { click: "=Açık devre" }, { wait: 800 }, { slide: "label:Yük reaktansı X", to: 120 }],
    "duran-dalga": [{ slide: "label:Yük direnci R", to: 200 }, { wait: 1200 }, { slide: "label:Yük direnci R", to: 50 }],
    tdr: [{ click: "=Kopuk" }, { wait: 1800 }, { drag: "css:canvas", path: [[0.35, 0.8], [0.55, 0.8], [0.75, 0.8]] }],
  });
})();
