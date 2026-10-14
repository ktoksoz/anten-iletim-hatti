/* Bölüm 6 (ilk yarı): anten. Açılan iletim hattı (2B FDTD), yarım dalga dipol hesaplayıcı,
   monopol ve ayna görüntüsü (2B FDTD), ışıma deseni (2B kutupsal + 3B), kazanç ve yönlülük. */
(function () {
  const { C, FONT, rgba, mix, h, canvas, loop, clamp, slider, seg, toggle, num, sig, ohm, db, hz, meters, pointer } = L;

  /* ---------------- yerel yardımcılar ---------------- */

  // İndüklenmiş EMK reaktansı ve rezonans boyu rf.js'te (testli)
  const dipoleFeedReactance = RF.dipoleFeedReactance, dipoleResonantLength = RF.dipoleResonantLength;
  // Ekseni etrafında simetrik bir güç deseni U(θ) için yönlülük: D = 4π Umax / ∫U dΩ = 2 Umax / ∫0^π U sinθ dθ (Simpson)
  function directivityOf(U) {
    const N = 1800; let s = 0, umax = 0;
    for (let i = 0; i <= N; i++) {
      const th = (Math.PI * i) / N, u = U(th);
      s += u * Math.sin(th) * (i === 0 || i === N ? 1 : i % 2 ? 4 : 2);
      if (u > umax) umax = u;
    }
    const I = (s * Math.PI) / N / 3;
    return { D: (2 * umax) / I, I, umax };
  }

  // 2B FDTD ızgarasında ince tel: 4-komşulu merdiven çizgi; geçilen her kenarın teğet E'si sıfırlanır
  function wire(g, x0, y0, x1, y1) {
    const nx = g.nx;
    let px = Math.round(x0), py = Math.round(y0);
    const n = 96;
    for (let i = 1; i <= n; i++) {
      const tx = Math.round(x0 + ((x1 - x0) * i) / n), ty = Math.round(y0 + ((y1 - y0) * i) / n);
      while (px !== tx || py !== ty) {
        if (px !== tx && (py === ty || Math.abs(tx - px) >= Math.abs(ty - py))) {
          const q = px + Math.sign(tx - px);
          if (q >= 0 && q < nx && py > 0 && py < g.ny) g.pecX[py * nx + Math.min(px, q)] = 1;
          px = q;
        } else {
          const q = py + Math.sign(ty - py);
          if (px > 0 && px < nx && q >= 0 && q < g.ny) g.pecY[Math.min(py, q) * nx + px] = 1;
          py = q;
        }
      }
    }
  }

  // Alan görüntüsü: |E| (gül) ya da Hz (çivit) + Ψ eş-değer eğrileri (E çizgileri). ch0 ile aynı görsel dil.
  function fieldRenderer(grid) {
    const off = document.createElement("canvas");
    off.width = grid.nx; off.height = grid.ny;
    const offx = off.getContext("2d");
    const img = offx.createImageData(grid.nx, grid.ny);
    const levels = [];
    let gain = 4;
    return function render(ctx, w, hh, mode, { rows = grid.ny, lines = true, target = 2.2, fixed = 0, psiStep = 0, pow2 = false } = {}) {
      let em = 0;
      if (fixed) em = (target / fixed) ** 2; else
      if (mode === "H") { for (let k = 0; k < grid.Hz.length; k += 7) { const a = Math.abs(grid.Hz[k]); if (a > em) em = a; } em = em * em * 0.5; }
      else for (let k = 0; k < grid.E2.length; k += 7) if (grid.E2[k] > em) em = grid.E2[k];
      gain += ((em ? target / Math.sqrt(em) : 4) - gain) * 0.08;
      if (pow2) powerImage(grid, img, mode, mode === "H" ? gain * 0.75 : gain);
      else V.fieldImage(grid, img, mode, mode === "H" ? gain * 0.75 : gain);
      offx.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(off, 0, 0, grid.nx, rows, 0, 0, w, hh);
      if (lines) {
        const ac = grid.psiAC();
        const step = psiStep || Math.max(1e-4, ac.max / 14);
        levels.length = 0;
        for (let i = -13; i <= 13; i++) levels.push((i + 0.5) * step);
        const sx = w / grid.nx, sy = hh / rows;
        ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, hh); ctx.clip();
        V.segments(ctx, grid.contours(levels, ac), sx, sy, 0, 0, mode === "H" ? "#e8ecff" : "#ffc4d6", 1, mode === "H" ? 0.35 : 0.5);
        ctx.restore();
      }
    };
  }

  // V.fieldImage'in kare ölçekli eşi: parlaklık alanın karesiyle (güç yoğunluğu) artar; zayıf sızıntı ile güçlü
  // ışımanın farkı daha iyi görünür. Renk dili aynı (E gül; H çivit, işaretli).
  function powerImage(grid, img, mode, gain) {
    const { nx, ny, Hz, pml } = grid, d = img.data;
    const E = L.hexToRgb(C.E), Hc = L.hexToRgb(C.H), Hn = L.hexToRgb("#cfd5ff"), bg = L.hexToRgb(C.deep);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i, o = k * 4;
      let v, col;
      if (mode === "H") { v = Hz[k] * gain; col = v >= 0 ? Hc : Hn; } else { v = grid.eAt(k) * gain; col = E; }
      v = v * v; v = v / (1 + v);
      const edge = Math.min(i - pml, nx - 1 - pml - i, j - pml, ny - 1 - pml - j);
      if (edge < 0) v *= Math.max(0, 1 + edge / pml) ** 2;
      d[o] = bg[0] + (col[0] - bg[0]) * v; d[o + 1] = bg[1] + (col[1] - bg[1]) * v; d[o + 2] = bg[2] + (col[2] - bg[2]) * v; d[o + 3] = 255;
    }
  }
  // Bakır tel çizimi (parlak)
  function strokeWire(ctx, pts, lw = 3.2) {
    ctx.save();
    ctx.strokeStyle = C.copper; ctx.lineWidth = lw; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.shadowColor = C.copper; ctx.shadowBlur = 8;
    ctx.beginPath();
    for (const p of pts) { ctx.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]); }
    ctx.stroke(); ctx.restore();
  }
  function feedDot(ctx, x, y) {
    ctx.save(); ctx.fillStyle = C.fwd; ctx.shadowColor = C.fwd; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(x, y, 3.2, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  function label(ctx, s, x, y, color = C.ink2, align = "left", size = 12) {
    ctx.save();
    ctx.font = `600 ${size}px ${FONT.display}`;
    const tw = ctx.measureText(s).width;
    const x0 = align === "center" ? x - tw / 2 : align === "right" ? x - tw : x;
    ctx.fillStyle = "rgba(8,23,38,0.72)"; ctx.fillRect(x0 - 4, y - size + 1, tw + 8, size + 5);
    ctx.fillStyle = color; ctx.textBaseline = "alphabetic"; ctx.fillText(s, x0, y + 1);
    ctx.restore();
  }
  const ro = (k, cls) => { const v = h("span.v", "—"); const el = h("div.readout" + (cls ? "." + cls : ""), h("span.k", k), v); el.v = v; return el; };

  /* ---------------- 3B izdüşüm: dönen, gölgelendirilmiş desen yüzeyi ---------------- */
  // rf(ux, uy, uz) → yarıçap (z: anten ekseni, yukarı). yaw: z çevresinde dönüş, pitch: kamera eğimi.
  function surface3D(ctx, cx, cy, R, rf, yaw, pitch, color, { nT = 30, nP = 44, alpha = 0.9, ref = 0, axis = 0, beam = null } = {}) {
    const cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), f = 4.2;
    const P = (x, y, z) => {
      const x1 = x * cyw - y * syw, y1 = x * syw + y * cyw;
      const y2 = y1 * cp + z * sp, z2 = -y1 * sp + z * cp;
      const s = f / (f + y2);
      return [cx + R * x1 * s, cy - R * z2 * s, y2, x1, z2];
    };
    // izotropik başvuru küresi (kesikli çemberler)
    if (ref) {
      ctx.save(); ctx.strokeStyle = rgba(C.ink2, 0.28); ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
      for (const kind of [0, 1, 2]) {
        ctx.beginPath();
        for (let i = 0; i <= 64; i++) {
          const a = (2 * Math.PI * i) / 64;
          const v = kind === 0 ? [Math.cos(a), Math.sin(a), 0] : kind === 1 ? [Math.cos(a), 0, Math.sin(a)] : [0, Math.cos(a), Math.sin(a)];
          const q = P(v[0] * ref, v[1] * ref, v[2] * ref);
          i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
    const V3 = [];
    for (let i = 0; i <= nT; i++) {
      const th = (Math.PI * i) / nT, st = Math.sin(th), ct = Math.cos(th);
      for (let j = 0; j <= nP; j++) {
        const ph = (2 * Math.PI * j) / nP;
        const ux = st * Math.cos(ph), uy = st * Math.sin(ph), uz = ct;
        const r = rf(ux, uy, uz);
        V3.push(P(ux * r, uy * r, uz * r).concat([r]));
      }
    }
    const W = nP + 1, faces = [];
    for (let i = 0; i < nT; i++) for (let j = 0; j < nP; j++) {
      const a = V3[i * W + j], b = V3[i * W + j + 1], c = V3[(i + 1) * W + j + 1], d = V3[(i + 1) * W + j];
      faces.push([a, b, c, d, (a[2] + b[2] + c[2] + d[2]) / 4]);
    }
    faces.sort((p, q) => q[4] - p[4]);
    const col = L.hexToRgb(color), dk = L.hexToRgb(C.deep);
    const axisDraw = () => {
      if (!axis) return;
      const p0 = P(0, 0, -axis), p1 = P(0, 0, axis);
      strokeWire(ctx, [[p0[0], p0[1], p1[0], p1[1]]], 2.6);
    };
    axisDraw();
    ctx.save();
    ctx.lineWidth = 0.6; ctx.lineJoin = "round";
    for (const [a, b, c, d] of faces) {
      // görünüm uzayında normal (köşegenlerin vektörel çarpımı) → ışık
      const ux = c[3] - a[3], uy = c[4] - a[4], uz = c[2] - a[2];
      const vx = d[3] - b[3], vy = d[4] - b[4], vz = d[2] - b[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
      const lit = Math.abs(nx * -0.45 + ny * 0.62 + nz * -0.64);
      const rr = (a[5] + b[5] + c[5] + d[5]) / 4;
      const k = clamp(0.18 + 0.72 * lit, 0, 1) * (0.55 + 0.45 * clamp(rr * 1.2, 0, 1));
      ctx.fillStyle = `rgba(${dk.map((v, i) => Math.round(v + (col[i] - v) * k)).join(",")},${alpha})`;
      ctx.strokeStyle = rgba(color, 0.22 + 0.25 * k);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.closePath();
      ctx.fill(); ctx.stroke();
    }
    ctx.restore();
    // anten (ekseni) üstte de: desenin boşluğundan görünsün
    if (axis) { ctx.save(); ctx.globalAlpha = 0.55; axisDraw(); ctx.restore(); }
    if (beam) { const p0 = P(0, 0, 0), p1 = P(beam[0], beam[1], beam[2]); V.arrow(ctx, p0[0], p0[1], p1[0], p1[1], rgba(C.ink, 0.6), 1.2, 7); }
    return P;
  }
  // Sürükleyerek döndürme + boşta yavaş dönüş
  function orbit(cv, onChange) {
    const o = { yaw: 0.6, pitch: 0.2, auto: true, last: null };
    pointer(cv, {
      down(x, y) { o.last = [x, y]; o.auto = false; },
      move(x, y) {
        if (!o.last) return;
        o.yaw -= (x - o.last[0]) * 0.012; o.pitch = clamp(o.pitch + (y - o.last[1]) * 0.01, -1.3, 1.3);
        o.last = [x, y]; onChange && onChange();
      },
      up() { o.last = null; },
    });
    cv.style.cursor = "grab";
    return o;
  }

  /* =========================================================
     1) Anten nasıl ışır? Açılan iletim hattı (2B FDTD)
     ========================================================= */
  Demos.ch6Open = function (stage) {
    const cv = h("canvas", { "aria-label": "İki paralel telden oluşan iletim hattı; uçtaki kollar açıldıkça elektrik alanı kopup boşluğa yayılır. Sürükleyerek ölçüm sondasını taşıyın." });
    const fill = h("div.fill", cv);
    const scope = h("div.float.tr.ch6-scope");
    const scv = h("canvas", { width: 220, height: 70, "aria-hidden": "true" });
    const sTxt = h("div.ch6-scope-txt");
    scope.append(h("div.ch6-scope-h", "Sonda: ", h("span.c-e", "E"), " ve ", h("span.c-h", "H"), " zamanla"), scv, sTxt);
    fill.append(scope);
    const ctrl = h("div.controls");
    stage.append(fill, ctrl);

    const P = 64, LAM = P / 2;               // dalga boyu 32 hücre
    // sabit parlaklık: verici genliği sabit olduğundan açılma değişince parlaklık da gerçek alanı gösterir
    const GAIN = 15;
    let open = 0, mode = "E", zones = true;
    let grid = null, render = null, geo = null;
    const roRef = ro("Hatta geri dönen (ölçülen)", "c-ref"), roRad = ro("Boşluğa salınan (ölçülen)", "c-fwd");

    const sl = slider({
      label: "Açılma", min: 0, max: 1, step: 0.01, value: 0,
      fmt: (v) => (v < 0.005 ? "paralel hat" : v > 0.995 ? "dipol" : num(v * 90, 0) + "°"),
      oninput: (v) => { open = v; if (grid) setGeometry(); },
    });
    const sg = seg([["E", "E alanı"], ["H", "H alanı"]], mode, (k) => { mode = k; draw(); }, "Görünüm");
    const tz = toggle("Yakın / uzak alan", zones, (v) => { zones = v; draw(); });
    ctrl.append(sl, sg, tz, h("span.spacer"), h("div.readouts", roRef, roRad));
    const st = canvas(cv, build);

    function setGeometry() {
      const { xe, yt, yb, arm } = geo;
      grid.clearPEC();
      grid.addPEC(0, yt, xe, yt); grid.addPEC(0, yb, xe, yb);
      const a = (open * Math.PI) / 2;
      geo.tipT = [xe + arm * Math.cos(a), yt - arm * Math.sin(a)];
      geo.tipB = [xe + arm * Math.cos(a), yb + arm * Math.sin(a)];
      wire(grid, xe, yt, geo.tipT[0], geo.tipT[1]);
      wire(grid, xe, yb, geo.tipB[0], geo.tipB[1]);
    }
    let lockRe, lockIm, xs, probe, pAcc, trace, tIdx;
    function build() {
      const narrow = st.w < 640;
      const CELL = narrow ? 3 : clamp(Math.round(Math.max(st.w / 260, st.h / 175)), 3, 5);
      const nx = Math.min(290, Math.max(80, Math.round(st.w / CELL))), ny = Math.min(195, Math.max(70, Math.round(st.h / CELL)));
      grid = new FDTD2D.Grid(nx, ny, { pml: 16 });
      grid.hp = 1 / (P * 3);
      const cy = Math.round(ny * (narrow ? 0.5 : 0.56)), xe = Math.round(nx * (narrow ? 0.54 : 0.42));
      geo = { cy, xe, yt: cy, yb: cy + 1, arm: 7, src: 19 };
      setGeometry();
      // besleme: hattın sol ucunda yumuşak akım kaynağı; hat sola doğru sönüm katmanına girer (eşlenmiş verici)
      // faz π/2 ve tam sayı periyotluk yükselme: kaynak durağan yük bırakmaz
      grid.sources.push({ kind: "gap", x: geo.src, y: cy, dir: "y", amp: 1.4, period: P, ramp: 2 * P, phase: Math.PI / 2 });
      xs = []; for (let x = geo.src + 6; x <= xe - 4; x++) xs.push(x);
      lockRe = new Float64Array(xs.length); lockIm = new Float64Array(xs.length);
      probe = probe ? [clamp(probe[0], 0, 1), clamp(probe[1], 0, 1)] : null;
      if (!probe) probe = [(xe + 2) / nx, (cy - 5) / ny];
      pAcc = [0, 0, 0, 0]; trace = new Float32Array(2 * P * 2); tIdx = 0;
      render = fieldRenderer(grid);
      grid.step(Math.round(Math.hypot(nx, ny) * 1.6));
      draw();
    }
    // tek adım + kilitli yükselteç (lock-in): hattaki gerilim fazörleri ve sondanın E/H fazörleri
    function stepOnce() {
      grid.step(1);
      const { nx, Ey, Ex, Hz } = grid, w = (2 * Math.PI * grid.t) / P, wh = (2 * Math.PI * (grid.t - 0.5)) / P;
      const cw = Math.cos(w), sw = Math.sin(w), a = 1 / (1.5 * P);
      for (let i = 0; i < xs.length; i++) {
        const v = Ey[geo.cy * nx + xs[i]];
        lockRe[i] += a * (v * cw - lockRe[i]); lockIm[i] += a * (v * sw - lockIm[i]);
      }
      // sonda: antenin merkezine göre teğet E bileşeni ve Hz
      const px = clamp(Math.round(probe[0] * nx), 2, nx - 3), py = clamp(Math.round(probe[1] * grid.ny), 2, grid.ny - 3), k = py * nx + px;
      const ex = 0.5 * (Ex[k] + Ex[k - 1]), ey = 0.5 * (Ey[k] + Ey[k - nx]);
      let dx = px - (geo.xe + 0.5), dy = py - (geo.cy + 0.5); const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
      const et = -dy * ex + dx * ey;
      const hzv = 0.25 * (Hz[k] + Hz[k - 1] + Hz[k - nx] + Hz[k - nx - 1]);
      pAcc[0] += a * (et * cw - pAcc[0]); pAcc[1] += a * (et * sw - pAcc[1]);
      pAcc[2] += a * (hzv * Math.cos(wh) - pAcc[2]); pAcc[3] += a * (hzv * Math.sin(wh) - pAcc[3]);
      trace[tIdx * 2] = et; trace[tIdx * 2 + 1] = hzv; tIdx = (tIdx + 1) % (trace.length / 2);
    }
    // Hattaki duran dalgadan |Γ|: V(x) = A e^{−jβx} + B e^{+jβx} en küçük kareler uydurması
    function measureGamma() {
      if (xs.length < LAM * 0.9) return null;
      const b = (2 * Math.PI) / LAM;
      let s11 = 0, s12r = 0, s12i = 0, s22 = 0, r1r = 0, r1i = 0, r2r = 0, r2i = 0;
      for (let i = 0; i < xs.length; i++) {
        const c = Math.cos(b * xs[i]), s = Math.sin(b * xs[i]), vr = lockRe[i], vi = lockIm[i];
        // f1 = e^{-jbx} = c − js, f2 = c + js
        s11 += 1; s22 += 1;
        s12r += c * c - s * s; s12i += 2 * c * s;        // conj(f1)·f2 = e^{2jbx}
        r1r += c * vr - s * vi; r1i += c * vi + s * vr;  // conj(f1)·v
        r2r += c * vr + s * vi; r2i += c * vi - s * vr;  // conj(f2)·v
      }
      // [s11 s12; conj(s12) s22] [A; B] = [r1; r2]
      const detr = s11 * s22 - (s12r * s12r + s12i * s12i);
      const Ar = (s22 * r1r - (s12r * r2r - s12i * r2i)) / detr, Ai = (s22 * r1i - (s12r * r2i + s12i * r2r)) / detr;
      const Br = (s11 * r2r - (s12r * r1r + s12i * r1i)) / detr, Bi = (s11 * r2i - (s12r * r1i - s12i * r1r)) / detr;
      const a1 = Math.hypot(Ar, Ai), b1 = Math.hypot(Br, Bi);
      // kilitli yükseltecin işaret kuralında kaynaktan uzaklaşan dalga B terimidir
      return b1 > 0 ? Math.min(1, a1 / b1) : null;
    }

    let gS = 0, gN = 0;
    function draw() {
      if (!grid) return;
      const { ctx, w, h: hh } = st;
      ctx.fillStyle = C.deep; ctx.fillRect(0, 0, w, hh);
      render(ctx, w, hh, mode, { fixed: GAIN, psiStep: 0.06, pow2: true });
      const sx = w / grid.nx, sy = hh / grid.ny, X = (i) => (i + 0.5) * sx, Y = (j) => (j + 0.5) * sy;
      const { xe, yt, yb, cy, tipT, tipB, src } = geo;
      const lamPx = LAM * sx;
      // bölgeler: λ/2π (reaktif yakın alan) ve uzak alan (r ≫ λ; burada 2 · max(λ, 2D²/λ))
      if (zones) {
        const F = 145e6, lam = RF.wavelength(F);
        const rNear = (RF.reactiveNearField(F) / lam) * lamPx;
        const D = (0.5 + 1 / LAM) * lam; // açılmış antenin boyu ≈ λ/2
        const rFar = (2 * Math.max(lam, RF.fraunhofer(D, F)) / lam) * lamPx;
        const cx0 = X(xe), cy0 = Y(cy) + sy / 2;
        ctx.save();
        ctx.setLineDash([4, 4]); ctx.lineWidth = 1.2;
        ctx.strokeStyle = rgba(C.ink, 0.75);
        ctx.beginPath(); ctx.arc(cx0, cy0, rNear, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = rgba(C.ink2, 0.45); ctx.setLineDash([2, 6]);
        ctx.beginPath(); ctx.arc(cx0, cy0, rFar, -Math.PI * 0.42, Math.PI * 0.42); ctx.stroke();
        ctx.restore();
        label(ctx, "λ/2π: reaktif yakın alan", cx0 + rNear * 0.7 + 6, cy0 + rNear + 30, C.ink, "left", 11);
        const fx = cx0 + rFar * Math.cos(0.3), fy = cy0 - rFar * Math.sin(0.3);
        if (fx < w - 70) label(ctx, "uzak alan →", fx + 6, fy, C.ink2, "left", 11);
        const ax = cx0 + rFar * Math.cos(-0.36) + 6, ay = cy0 + rFar * Math.sin(0.36) + 4;
        if (ax < w - 70) label(ctx, "r = 2λ", ax, ay, C.muted, "left", 10);
      }
      // teller
      strokeWire(ctx, [
        [0, Y(yt) - sy / 2, X(xe), Y(yt) - sy / 2, X(tipT[0]), Y(tipT[1]) - sy / 2],
        [0, Y(yb) - sy / 2, X(xe), Y(yb) - sy / 2, X(tipB[0]), Y(tipB[1]) - sy / 2],
      ], 2.6);
      // verici tarafı: kaynak simgesi
      feedDot(ctx, X(src), Y(cy));
      label(ctx, "verici", X(src) + 8, Y(cy) - 14, C.fwd, "left", 11);
      // sonda
      const px = probe[0] * w, py = probe[1] * hh;
      ctx.save(); ctx.strokeStyle = C.ink; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(px, py, 7, 0, Math.PI * 2); ctx.moveTo(px - 12, py); ctx.lineTo(px - 4, py); ctx.moveTo(px + 4, py); ctx.lineTo(px + 12, py);
      ctx.moveTo(px, py - 12); ctx.lineTo(px, py - 4); ctx.moveTo(px, py + 4); ctx.lineTo(px, py + 12); ctx.stroke(); ctx.restore();
      V.text(ctx, "yaklaşık model: 2B FDTD (teller sayfaya dik sonsuz şerit)", 14, hh - 12, { color: C.copper, size: 11 });
      drawScope();
      // ölçümler (her 6 karede bir)
      if (++gN % 6 === 0) {
        const G = measureGamma();
        if (G != null) { gS = G; roRef.v.textContent = "%" + num(100 * G * G, 0); roRad.v.textContent = "%" + num(100 * (1 - G * G), 0); }
        else { roRef.v.textContent = "—"; roRad.v.textContent = "—"; }
      }
    }
    function drawScope() {
      const c2 = scv.getContext("2d"), W = scv.width, H = scv.height;
      c2.clearRect(0, 0, W, H);
      V.graticule(c2, 0, 0, W, H, 8, 4);
      const n = trace.length / 2;
      let m = 1e-6; for (let i = 0; i < trace.length; i++) m = Math.max(m, Math.abs(trace[i]));
      for (const [off, col] of [[0, C.E], [1, C.H]]) {
        c2.strokeStyle = col; c2.lineWidth = 1.6; c2.beginPath();
        for (let i = 0; i < n; i++) {
          const v = trace[((tIdx + i) % n) * 2 + off];
          const x = (W * i) / (n - 1), y = H / 2 - (v / m) * H * 0.42;
          i ? c2.lineTo(x, y) : c2.moveTo(x, y);
        }
        c2.stroke();
      }
      // ölçülen faz farkı ve dalga empedansı; aynı uzaklıkta 3B kısa dipol kuramı
      const pe = Math.atan2(pAcc[1], pAcc[0]), ph = Math.atan2(pAcc[3], pAcc[2]);
      let d = ((pe - ph) * 180) / Math.PI; d = ((d + 540) % 360) - 180;
      // 0°: aynı fazda (enerji akar), 90°: çeyrek periyot kayık (enerji gidip gelir); işaret yöne bağlı olduğundan 0–90°'ye katlanır
      const fold = (a) => { a = Math.abs(a); return a > 90 ? 180 - a : a; };
      const ae = Math.hypot(pAcc[0], pAcc[1]), ah = Math.hypot(pAcc[2], pAcc[3]);
      const rCells = Math.hypot(probe[0] * grid.nx - (geo.xe + 0.5), probe[1] * grid.ny - (geo.cy + 1));
      const kr = (2 * Math.PI * rCells) / LAM;
      // Hertz dipolü: Eθ ∝ 1 + 1/(jkr) − 1/(kr)², Hφ ∝ 1 + 1/(jkr)
      const eth = Math.atan2(-1 / kr, 1 - 1 / (kr * kr)), hph = Math.atan2(-1 / kr, 1);
      let d3 = ((eth - hph) * 180) / Math.PI; d3 = ((d3 + 540) % 360) - 180;
      sTxt.innerHTML =
        `<div>uzaklık <b class="num">${num(rCells / LAM, 2)} λ</b></div>` +
        `<div>faz farkı (2B ölçüm) <b class="num">${num(fold(d), 0)}°</b></div>` +
        `<div>E/H (2B ölçüm) <b class="num">${ah > 1e-9 ? sig((ae / ah) * RF.eta0, 3) + " Ω" : "—"}</b></div>` +
        `<div class="note-small">3B kısa dipol kuramı: <span class="num">${num(fold(d3), 0)}°</span></div>`;
    }

    // sonda sönüm katmanına girmesin (orada alan yapay olarak zayıflar)
    const clampProbe = (x, y) => { const m = (grid ? grid.pml + 6 : 22); const fx = m / (grid ? grid.nx : 200), fy = m / (grid ? grid.ny : 150); return [clamp(x / st.w, fx, 1 - fx), clamp(y / st.h, fy, 1 - fy)]; };
    pointer(cv, {
      down(x, y) { probe = clampProbe(x, y); pAcc = [0, 0, 0, 0]; },
      move(x, y) { probe = clampProbe(x, y); },
    });
    cv.style.cursor = "crosshair";
    const lp = loop(() => { if (!grid) return; for (let i = 0; i < 3; i++) stepOnce(); draw(); });
    return { enter() { lp.start(); }, leave() { lp.stop(); } };
  };

  /* =========================================================
     2) Yarım dalga dipol hesaplayıcı
     ========================================================= */
  Demos.ch6Dipole = function (stage) {
    const cv = h("canvas", { "aria-label": "Yarım dalga dipol: tel boyunca akım ve gerilim dağılımı ve ölçülendirilmiş uzunluk" });
    const fill = h("div.fill", cv);
    const ctrl = h("div.controls");
    const ctrl2 = h("div.controls");
    stage.append(fill, ctrl, ctrl2);

    let f = 14.2e6, k = 0.95, dmm = 2, P = 100;
    const BANDS = [[7.1e6, "7,1 MHz"], [14.2e6, "14,2 MHz"], [145e6, "145 MHz"], [433e6, "433 MHz"]];
    const fIn = h("input.ch6-num", { type: "number", min: 0.1, max: 3000, step: "any", value: f / 1e6, "aria-label": "Frekans (MHz)" });
    fIn.addEventListener("input", () => { const v = +fIn.value; if (v >= 0.1 && v <= 3000) { f = v * 1e6; bandSeg.set(null); upd(); } });
    const bandSeg = seg(BANDS.map(([v, s]) => [v, s]), f, (v) => { f = v; fIn.value = v / 1e6; upd(); }, "Örnek bantlar");
    const kSl = slider({ label: "Kısaltma faktörü k", min: 0.9, max: 1, step: 0.001, value: k, fmt: (v) => num(v, 3), oninput: (v) => { k = v; upd(); } });
    const dSl = slider({ label: "Tel çapı", min: 0.5, max: 20, log: true, value: dmm, fmt: (v) => num(v, v < 10 ? 1 : 0) + " mm", oninput: (v) => { dmm = v; upd(); } });
    const pSeg = seg([[10, "10 W"], [100, "100 W"], [1000, "1 kW"]], P, (v) => { P = v; upd(); }, "Verici gücü");
    const resBtn = h("button.btn", { type: "button" }, "Rezonansa getir");
    resBtn.addEventListener("click", () => { const Lr = dipoleResonantLength(dmm / 2000 / RF.wavelength(f)); k = 2 * Lr; kSl.set(k); upd(); });
    ctrl.append(h("label.sl", h("span.lab", "Frekans"), fIn, h("span.lab", "MHz")), bandSeg, kSl, dSl);
    const rL = ro("Kesilecek boy L", "c-cu"), rLam = ro("λ/2 (boşlukta)"), rZ = ro("Besleme empedansı"), rK = ro("Rezonans için k"), rI = ro("Besleme akımı", "c-h"), rV = ro("Uç gerilimi ≈", "c-e");
    ctrl2.append(resBtn, h("span.lab", "Güç"), pSeg, h("span.spacer"), h("div.readouts", rL, rLam, rZ, rK, rI, rV));
    const st = canvas(cv, () => draw(0));
    let calc = null;

    function upd() {
      const lam = RF.wavelength(f), L = RF.halfWaveDipoleLength(f, k), Lwl = L / lam, aWl = dmm / 2000 / lam;
      const R = RF.dipoleFeedResistance(Lwl), X = dipoleFeedReactance(Lwl, aWl);
      const kRes = 2 * dipoleResonantLength(aWl);
      // Ortalama karakteristik empedans (Schelkunoff/Kraus yaklaşımı): Za = 120 (ln(L/a) − 1)
      const Za = 120 * (Math.log(L / (dmm / 2000)) - 1);
      const Iin = Math.sqrt(P / R);                       // besleme akımı (etkin değer)
      const Im = Iin / Math.abs(Math.sin(Math.PI * Lwl)); // akım tepesi
      const Vtip = Za * Im;                               // uçta: Za · Im (yaklaşık, etkin değer)
      calc = { lam, L, Lwl, R, X, Za, Iin, Im, Vtip, kRes };
      rL.v.textContent = meters(L);
      rLam.v.textContent = meters(lam / 2);
      const Xs = Math.abs(X) < 0.05 ? 0 : X;
      rZ.v.innerHTML = `<span class="c-r">${sig(R, 3)}</span> ${Xs < 0 ? "−" : "+"} <span class="${Xs < 0 ? "c-xn" : "c-xp"}">j${Xs ? sig(Math.abs(Xs), 3) : "0"}</span> Ω`;
      rK.v.textContent = num(kRes, 3);
      rI.v.textContent = sig(Iin, 3) + " A";
      rV.v.textContent = Vtip >= 1000 ? sig(Vtip / 1000, 2) + " kV" : sig(Vtip, 2) + " V";
      draw(0);
    }

    function draw(t) {
      if (!calc || !st.w) return;
      const { ctx, w, h: hh } = st;
      ctx.clearRect(0, 0, w, hh);
      V.graticule(ctx, 0, 0, w, hh, Math.round(w / 64), Math.round(hh / 64), { center: false });
      V.corners(ctx, 10, 10, w - 20, hh - 20, 12);
      const { lam, L, Lwl, R, X, Za } = calc;
      const narrow = w < 560;
      const span = w * (narrow ? 0.84 : 0.72);       // λ/2 (boşlukta) bu genişliğe çizilir
      const sc = span / (lam / 2);
      const Lpx = L * sc, cx = w / 2, cy = hh * 0.5;
      const x0 = cx - Lpx / 2, x1 = cx + Lpx / 2;
      const amp = Math.min(hh * 0.2, 90);
      // akım ve gerilim (duran dalga) — z: merkezden uzaklık, ψ = β(L/2 − |z|)
      const beta = (2 * Math.PI) / lam;
      const Iz = (z) => Math.sin(beta * (L / 2 - Math.abs(z)));
      const Vz = (z) => { const ps = beta * (L / 2 - Math.abs(z)); return Math.hypot(Za * Math.cos(ps), R * Math.sin(ps)); };
      const Vmax = Za, wt = t * 2.4;
      const N = 160;
      const curve = (fz, sign, scale, color, inst) => {
        ctx.save();
        ctx.beginPath(); ctx.moveTo(x0, cy);
        for (let i = 0; i <= N; i++) { const z = -L / 2 + (L * i) / N; ctx.lineTo(x0 + (Lpx * i) / N, cy - sign * fz(z) * scale); }
        ctx.lineTo(x1, cy); ctx.closePath();
        ctx.fillStyle = rgba(color, 0.13); ctx.fill();
        ctx.strokeStyle = rgba(color, 0.55); ctx.lineWidth = 1.2; ctx.setLineDash([5, 4]); ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        for (let i = 0; i <= N; i++) { const z = -L / 2 + (L * i) / N; const y = cy - sign * fz(z) * scale * Math.abs(inst); i ? ctx.lineTo(x0 + (Lpx * i) / N, y) : ctx.moveTo(x0 + (Lpx * i) / N, y); }
        ctx.strokeStyle = color; ctx.lineWidth = 2.4; ctx.shadowColor = color; ctx.shadowBlur = 8; ctx.stroke();
        ctx.restore();
      };
      curve(Iz, 1, amp, C.H, Math.cos(wt));
      curve((z) => Vz(z) / Vmax, -1, amp, C.E, Math.sin(wt));
      // tel, izolatörler, ip
      ctx.save(); ctx.strokeStyle = rgba(C.ink2, 0.35); ctx.lineWidth = 1; ctx.setLineDash([2, 3]);
      ctx.beginPath(); ctx.moveTo(14, cy); ctx.lineTo(x0 - 10, cy); ctx.moveTo(x1 + 10, cy); ctx.lineTo(w - 14, cy); ctx.stroke(); ctx.restore();
      strokeWire(ctx, [[x0, cy, cx - 4, cy], [cx + 4, cy, x1, cy]], 3);
      for (const xi of [x0 - 6, x1 + 6]) { ctx.save(); ctx.fillStyle = C.panel; ctx.strokeStyle = C.ink2; ctx.beginPath(); ctx.ellipse(xi, cy, 6, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore(); }
      // koaks besleme
      ctx.save(); ctx.strokeStyle = rgba(C.ink2, 0.6); ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(cx, cy + 4); ctx.lineTo(cx, hh - 22); ctx.stroke();
      ctx.strokeStyle = C.deep; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cx, cy + 4); ctx.lineTo(cx, hh - 22); ctx.stroke(); ctx.restore();
      feedDot(ctx, cx, cy);
      // etiketler
      label(ctx, "akım I (uçta sıfır, ortada tepe)", x0 + 4, cy - amp - 10, C.H, "left", 12);
      label(ctx, "gerilim V (uçta tepe)", x0 + 4, cy + amp + 22, C.E, "left", 12);
      label(ctx, "besleme", cx + 8, hh - 26, C.fwd, "left", 11);
      // ölçü çizgileri: λ/2 (boşlukta) üstte, L altta
      const yTop = Math.max(26, cy - amp - 40), yBot = Math.min(hh - 50, cy + amp + 44);
      ctx.save(); ctx.strokeStyle = rgba(C.ink2, 0.25); ctx.setLineDash([2, 4]);
      ctx.beginPath(); ctx.moveTo(cx - span / 2, yTop); ctx.lineTo(cx - span / 2, cy); ctx.moveTo(cx + span / 2, yTop); ctx.lineTo(cx + span / 2, cy); ctx.stroke(); ctx.restore();
      V.dimension(ctx, cx - span / 2, yTop, cx + span / 2, yTop, `λ/2 boşlukta = ${meters(lam / 2)}`, { color: C.ink2 });
      V.dimension(ctx, x0, yBot, x1, yBot, `L = ${num(k, 3)} · λ/2 = ${meters(L)}`, { color: C.ink, size: 13 });
      if (!narrow) V.dimension(ctx, cx, yBot + 26, x1, yBot + 26, `kol ${meters(L / 2)}`, { color: C.ink2, size: 11 });
      V.text(ctx, `Ø ${num(dmm, dmm < 10 ? 1 : 0)} mm tel · ${hz(f)}`, 18, hh - 16, { color: C.muted, size: 11, font: "num" });
      V.text(ctx, "yaklaşık model: sinüs akım dağılımı, boşlukta", narrow ? 18 : w - 18, narrow ? hh - 32 : hh - 16, { color: C.copper, size: 11, align: narrow ? "left" : "right" });
    }
    const lp = loop((dt, t) => draw(t));
    upd();
    return { enter() { lp.start(); }, leave() { lp.stop(); } };
  };

  /* =========================================================
     3) Monopol ve toprak düzlemi: ayna görüntüsü (2B FDTD)
     ========================================================= */
  Demos.ch6Mono = function (stage) {
    const cv = h("canvas", { "aria-label": "İletken toprak düzlemi üstünde dikey tel; düzlemin altındaki ayna görüntüsü ile tam dipol karşılaştırması" });
    const fill = h("div.fill", cv);
    const ctrl = h("div.controls");
    stage.append(fill, ctrl);
    const P = 96, LAM = P / 2, HH = LAM / 4; // dalga boyu 48 hücre; çeyrek dalga: 12 hücre
    let view = "mono", mirror = false, mono = null, dip = null, rM = null, rD = null, geo = null, diff = null, nD = 0;
    const vSeg = seg([["mono", "Monopol + toprak"], ["dip", "Tam dipol"]], view, (v) => { view = v; draw(); }, "Görünüm");
    const mT = toggle("Ayna görüntüsünü göster", mirror, (v) => { mirror = v; draw(); });
    const rR = ro("Işıma direnci", "c-r"), rDg = ro("Yönlülük"), rDiff = ro("Üst yarıda fark (ölçülen)", "ok");
    ctrl.append(vSeg, mT, h("span.spacer"), h("div.readouts", rR, rDg, rDiff));
    const st = canvas(cv, build);

    function readouts() {
      if (view === "mono") {
        rR.v.textContent = ohm(RF.monopoleRadiationResistance(0.25));
        rDg.v.textContent = db(RF.dB(RF.monopoleDirectivity(0.25)), 2, "dBi");
      } else {
        rR.v.textContent = ohm(RF.dipoleRadiationResistance(0.5));
        rDg.v.textContent = db(RF.dB(RF.dipoleDirectivity(0.5)), 2, "dBi");
      }
    }
    function build() {
      const narrow = st.w < 640;
      const CELL = narrow ? 3 : clamp(Math.round(Math.max(st.w / 250, st.h / 160)), 3, 5);
      const nx = Math.min(280, Math.max(80, Math.round(st.w / CELL))), ny = Math.min(170, Math.max(70, Math.round(st.h / CELL)));
      const yg = Math.round(ny * 0.66), ax = Math.round(nx / 2);
      geo = { nx, ny, yg, ax };
      mono = new FDTD2D.Grid(nx, ny, { pml: 16 });
      mono.addPEC(0, yg, nx - 1, yg);                 // toprak düzlemi (sınırlara kadar: sonsuz düzlem)
      mono.addPEC(ax, yg - HH, ax, yg - 1);           // çeyrek dalga dikey tel
      mono.sources.push({ kind: "gap", x: ax, y: yg - 1, dir: "y", amp: 1.2, period: P, ramp: 2 * P, phase: Math.PI / 2 });
      // tam dipol: düzlemin yerinde simetri ekseni; ızgara düzleme göre simetrik (ny2 = 2·yg + 1)
      const ny2 = 2 * yg + 1;
      dip = new FDTD2D.Grid(nx, ny2, { pml: 16 });
      dip.addPEC(ax, yg - HH, ax, yg - 1);
      dip.addPEC(ax, yg + 1, ax, yg + HH);
      for (const y of [yg - 1, yg]) dip.sources.push({ kind: "gap", x: ax, y, dir: "y", amp: 1.2, period: P, ramp: 2 * P, phase: Math.PI / 2 });
      for (const g of [mono, dip]) g.hp = 1 / (P * 3);
      rM = fieldRenderer(mono); rD = fieldRenderer(dip);
      const warm = Math.round(Math.hypot(nx, ny) * 1.6);
      mono.step(warm); dip.step(warm);
      readouts(); draw();
    }
    function measure() {
      // düzlemin üstündeki iç bölgede |E|² farkı: √(Σ(a−b)² / Σa²)
      const { nx, yg } = geo, p = 18;
      let s = 0, d = 0;
      for (let j = p; j < yg - 1; j++) for (let i = p; i < nx - p; i++) { const k = j * nx + i, a = mono.E2[k], b = dip.E2[k]; s += a * a; d += (a - b) * (a - b); }
      diff = Math.sqrt(d / (s || 1));
      rDiff.v.textContent = "%" + num(100 * diff, diff < 0.1 ? 1 : 0);
    }
    function draw() {
      if (!mono) return;
      readouts();
      const { ctx, w, h: hh } = st;
      const { nx, ny, yg, ax } = geo;
      const sx = w / nx, sy = hh / ny, X = (i) => (i + 0.5) * sx;
      const gy = (yg + 0.5) * sy - sy / 2; // düzlem çizgisi
      ctx.fillStyle = C.deep; ctx.fillRect(0, 0, w, hh);
      if (view === "mono") {
        rM(ctx, w, hh, "E", { target: 3.4 });
        if (mirror) {
          // ayna görüntüsü: üst yarının düzleme göre yansıması, soluk
          ctx.save(); ctx.globalAlpha = 0.42;
          ctx.beginPath(); ctx.rect(0, gy, w, hh - gy); ctx.clip();
          ctx.translate(0, 2 * gy); ctx.scale(1, -1);
          ctx.drawImage(cv, 0, 0, cv.width, Math.round(gy * st.dpr), 0, 0, w, gy);
          ctx.restore();
        }
      } else {
        rD(ctx, w, hh, "E", { rows: ny, target: 3.4 });
      }
      // teller
      const top = (yg - HH + 0.5) * sy - sy / 2;
      strokeWire(ctx, [[X(ax), top, X(ax), gy - 2]], 3.2);
      if (view === "dip") strokeWire(ctx, [[X(ax), gy + 2, X(ax), 2 * gy - top]], 3.2);
      else if (mirror) {
        ctx.save(); ctx.globalAlpha = 0.5; ctx.setLineDash([4, 4]);
        ctx.strokeStyle = C.copper; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(X(ax), gy + 2); ctx.lineTo(X(ax), 2 * gy - top); ctx.stroke(); ctx.restore();
      }
      feedDot(ctx, X(ax), gy - 1);
      // toprak düzlemi: kalın çizgi + taralı bant (mavi baskı toprak simgesi)
      if (view === "mono") {
        ctx.save();
        ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke();
        if (!mirror) {
          ctx.fillStyle = "rgba(8,23,38,0.55)"; ctx.fillRect(0, gy + 1, w, hh - gy);
          ctx.strokeStyle = rgba(C.ink2, 0.35); ctx.lineWidth = 1; ctx.beginPath();
          for (let x = -20; x < w + 20; x += 12) { ctx.moveTo(x, gy + 12); ctx.lineTo(x + 10, gy + 2); }
          ctx.stroke();
          label(ctx, "toprak düzlemi: altında alan yok", 14, gy + 30, C.ink2, "left", 12);
        } else {
          label(ctx, "hayalî yarı (ayna görüntüsü)", X(ax) + 12, gy + (2 * gy - top - gy) * 0.6, C.ink2, "left", 12);
        }
        ctx.restore();
        V.dimension(ctx, X(ax) - 30, top, X(ax) - 30, gy, `λ/4`, { color: C.ink2, size: 11 });
      } else {
        ctx.save(); ctx.strokeStyle = rgba(C.ink, 0.35); ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke(); ctx.restore();
        label(ctx, "düzlemin olduğu yer (kesikli)", 14, gy - 8, C.ink2, "left", 12);
        V.dimension(ctx, X(ax) - 30, top, X(ax) - 30, 2 * gy - top, `λ/2`, { color: C.ink2, size: 11 });
      }
      V.text(ctx, "yaklaşık model: 2B FDTD", w - 14, hh - 12, { color: C.copper, size: 11, align: "right" });
    }
    const lp = loop(() => {
      if (!mono) return;
      mono.step(3); dip.step(3);
      if (++nD % 10 === 0) measure();
      draw();
    });
    return { enter() { lp.start(); }, leave() { lp.stop(); } };
  };

  /* =========================================================
     4) Işıma deseni: 2B kutupsal (dB) ve 3B
     ========================================================= */
  // Desen özellikleri: en büyük F², ana lob açısı, yarım güç hüzme genişliği
  function patternInfo(Lwl) {
    const N = 3600; let fm = 0, im = 0;
    const F2 = (th) => RF.dipolePattern(Lwl, th) ** 2;
    for (let i = 0; i <= N / 2; i++) { const v = F2((Math.PI * i) / N); if (v > fm) { fm = v; im = i; } }
    const thm = (Math.PI * im) / N;
    let a = im, b = im;
    while (a > 0 && F2((Math.PI * a) / N) >= fm / 2) a--;
    while (b < N && F2((Math.PI * b) / N) >= fm / 2) b++;
    let hp = ((b - a) * 180) / N;
    // ana lob yatayda ise hüzme her iki yana simetrik: θ ∈ [a, b] zaten iki tarafı kapsar
    return { fmax: Math.sqrt(fm), thm, hpbw: hp };
  }
  Demos.ch6Pattern = function (stage) {
    const cv = h("canvas", { "aria-label": "Dipolün ışıma deseni: solda kutupsal kesit (dB), sağda sürükleyerek döndürülebilen 3B desen" });
    const fill = h("div.fill", cv);
    const ctrl = h("div.controls");
    stage.append(fill, ctrl);
    let Lw = 0.5, info = patternInfo(Lw);
    const sl = slider({ label: "Dipol uzunluğu", min: 0.1, max: 2, step: 0.01, value: Lw, fmt: (v) => num(v, 2) + " λ", oninput: (v) => setL(v, false), cls: "c-e" });
    const btns = [[0.5, "0,5λ"], [1, "1λ"], [1.25, "1,25λ"], [1.5, "1,5λ"]].map(([v, s]) => {
      const b = h("button.btn", { type: "button" }, s); b.addEventListener("click", () => setL(v, true)); return b;
    });
    const rD = ro("Yönlülük", "c-e"), rDd = ro("dBd"), rR = ro("Işıma direnci", "c-r"), rRin = ro("Besleme direnci", "c-r"), rB = ro("Yarım güç hüzmesi");
    ctrl.append(sl, ...btns, h("span.spacer"), h("div.readouts", rD, rDd, rR, rRin, rB));
    const st = canvas(cv, () => draw());
    const orb = orbit(cv, () => draw());
    let anim = null;
    function setL(v, animate) {
      if (animate) anim = { from: Lw, to: v, t: 0 };
      else { anim = null; Lw = v; upd(); }
      sl.set(v);
    }
    function upd() {
      info = patternInfo(Lw);
      const D = RF.dB(RF.dipoleDirectivity(Lw));
      rD.v.textContent = db(D, 2, "dBi");
      rDd.v.textContent = db(RF.dbiToDbd(D), 2, "dBd");
      rR.v.textContent = ohm(RF.dipoleRadiationResistance(Lw));
      const rin = RF.dipoleFeedResistance(Lw);
      rRin.v.textContent = rin > 5e4 ? "çok yüksek" : ohm(rin);
      rB.v.textContent = num(info.hpbw, 0) + "°";
      btns.forEach((b, i) => b.classList.toggle("on", Math.abs([0.5, 1, 1.25, 1.5][i] - Lw) < 0.005));
    }
    function draw() {
      if (!st.w) return;
      const { ctx, w, h: hh } = st;
      ctx.clearRect(0, 0, w, hh);
      const stack = w < 640;
      const pw = stack ? w : w * 0.5, ph = stack ? hh * 0.5 : hh;
      // --- sol: kutupsal kesit (anten ekseni dikey)
      const cx = pw / 2, cy = ph / 2 + 6, R = Math.min(pw, ph) * 0.4;
      V.polarGrid(ctx, cx, cy, R);
      const fm = info.fmax || 1;
      V.polar(ctx, cx, cy, R, (phi) => {
        const th = Math.acos(clamp(Math.sin(phi), -1, 1));
        return Math.abs(RF.dipolePattern(Lw, th)) / fm;
      }, C.E, { floor: -40 });
      // anten ve akım dağılımı (H rengi) ekseni boyunca
      const Lpx = R * 0.34 * Lw, beta = 2 * Math.PI;
      ctx.save(); ctx.fillStyle = rgba(C.H, 0.3); ctx.strokeStyle = C.H; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(cx, cy - Lpx / 2);
      for (let i = 0; i <= 80; i++) { const z = -Lw / 2 + (Lw * i) / 80; ctx.lineTo(cx + 14 * Math.sin(beta * (Lw / 2 - Math.abs(z))), cy - (z / Lw) * Lpx); }
      ctx.lineTo(cx, cy + Lpx / 2); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
      strokeWire(ctx, [[cx, cy - Lpx / 2, cx, cy - 2], [cx, cy + 2, cx, cy + Lpx / 2]], 2.4);
      V.text(ctx, "kutupsal kesit (dB)", 16, 24, { color: C.ink2, size: 12, weight: 600 });
      V.text(ctx, "anten ekseni ↑ · boşluk (null) eksende", 16, 40, { color: C.muted, size: 11 });
      V.text(ctx, "akım", cx - 8, cy + Lpx / 2 + 16, { color: C.H, size: 11, align: "right" });
      // --- sağ: 3B
      const ox = stack ? 0 : pw, oy = stack ? ph : 0, qw = stack ? w : w - pw, qh = stack ? hh - ph : hh;
      ctx.save(); ctx.strokeStyle = C.line; if (stack) { ctx.beginPath(); ctx.moveTo(16, oy); ctx.lineTo(w - 16, oy); ctx.stroke(); } else { ctx.beginPath(); ctx.moveTo(ox, 16); ctx.lineTo(ox, hh - 16); ctx.stroke(); } ctx.restore();
      const R3 = Math.min(qw, qh) * 0.4;
      surface3D(ctx, ox + qw / 2, oy + qh / 2 + 4, R3, (ux, uy, uz) => Math.abs(RF.dipolePattern(Lw, Math.acos(clamp(uz, -1, 1)))) / fm,
        orb.yaw, orb.pitch, C.E, { axis: Math.min(0.95, 0.3 + 0.25 * Lw) });
      V.text(ctx, "3B desen (doğrusal alan ölçeği)", ox + 16, oy + 24, { color: C.ink2, size: 12, weight: 600 });
      V.text(ctx, "sürükleyerek döndürün", ox + 16, oy + 40, { color: C.muted, size: 11 });
    }
    const lp = loop((dt) => {
      if (anim) { anim.t = Math.min(1, anim.t + dt / 0.6); Lw = anim.from + (anim.to - anim.from) * L.ease(anim.t); upd(); if (anim.t >= 1) anim = null; }
      if (orb.auto) orb.yaw += dt * 0.35;
      draw();
    });
    upd();
    return { enter() { lp.start(); }, leave() { lp.stop(); } };
  };

  /* =========================================================
     5) Kazanç, yönlülük, dBi ve dBd: balon sıkıştırma
     ========================================================= */
  Demos.ch6Gain = function (stage) {
    const cv = h("canvas", { "aria-label": "Işıma deseni bir balon gibi: toplam güç sabit; bir yönde sıkışınca öbür yönde uzar" });
    const fill = h("div.fill", cv);
    const ctrl = h("div.controls");
    const ctrl2 = h("div.controls");
    stage.append(fill, ctrl, ctrl2);
    let kind = "iso", n = 4, eff = 1, mix0 = null;
    // Güç desenleri (eksen: θ = 0). Normalleştirme: ∫U dΩ = 4π (yani D(θ) = U(θ)); dışarıda çarpılır
    const raw = {
      iso: () => 1,
      dip: (th) => RF.dipolePattern(0.5, th) ** 2,
      dir: (th) => (th < Math.PI / 2 ? Math.pow(Math.cos(th), n) : 0),
    };
    const norm = {};
    function normalize() {
      for (const k of Object.keys(raw)) {
        const r = directivityOf(raw[k]);
        norm[k] = { s: 2 / r.I, D: r.D }; // U·s: ∫ = 4π ⇒ D(θ) = s·U(θ)
      }
    }
    normalize();
    // Görüntülenen desen: önceki ve yeni desenin ağırlıklı toplamı (integrali sabit kalır)
    const Dk = (k, th) => norm[k].s * raw[k](th);
    let from = kind, t = 1;
    // Desen yönü: izotropik ve yönlü desen x ekseni (sağa), dipol z ekseni
    const thOf = (k, ux, uy, uz) => Math.acos(clamp(k === "dip" ? uz : ux, -1, 1));
    const Dview = (ux, uy, uz) => (1 - t) * Dk(from, thOf(from, ux, uy, uz)) + t * Dk(kind, thOf(kind, ux, uy, uz));

    const kSeg = seg([["iso", "İzotropik"], ["dip", "Dipol"], ["dir", "Yönlü"]], kind, (k) => { from = kind; kind = k; t = 0; nSl.style.opacity = k === "dir" ? 1 : 0.45; upd(); }, "Desen");
    const nSl = slider({ label: "Sıkıştırma n", min: 1, max: 20, step: 1, value: n, fmt: (v) => "cosⁿ, n = " + v, oninput: (v) => { n = v; normalize(); if (kind !== "dir") { from = kind; kind = "dir"; t = 0; kSeg.set("dir"); nSl.style.opacity = 1; } upd(); } });
    nSl.style.opacity = 0.45;
    const eSl = slider({ label: "Verim", min: 0.1, max: 1, step: 0.01, value: eff, fmt: (v) => "%" + num(v * 100, 0), oninput: (v) => { eff = v; upd(); }, cls: "c-r" });
    const dbiIn = h("input.ch6-num", { type: "number", step: 0.01, "aria-label": "dBi" }), dbdIn = h("input.ch6-num", { type: "number", step: 0.01, "aria-label": "dBd" });
    dbiIn.addEventListener("input", () => { if (dbiIn.value !== "") dbdIn.value = RF.dbiToDbd(+dbiIn.value).toFixed(2); });
    dbdIn.addEventListener("input", () => { if (dbdIn.value !== "") dbiIn.value = RF.dbdToDbi(+dbdIn.value).toFixed(2); });
    ctrl.append(kSeg, nSl, eSl);
    const rD = ro("Yönlülük D", "c-e"), rG = ro("Kazanç G = verim × D", "c-fwd"), rP = ro("Toplam ışınan güç (desen integrali)", "c-r"), rM = ro("En güçlü yönde, izotropiğe göre");
    ctrl2.append(h("label.sl", h("span.lab", "Dönüştürücü"), dbiIn, h("span.lab", "dBi ="), dbdIn, h("span.lab", "dBd")), h("span.spacer"), h("div.readouts", rD, rG, rP, rM));
    const st = canvas(cv, () => draw());
    const orb = orbit(cv, () => draw());
    orb.yaw = -0.5; orb.pitch = 0.38;

    const z0 = (v) => (Math.abs(v) < 0.005 ? 0 : v);
    function upd() {
      const D = norm[kind].D, G = eff * D;
      rD.v.textContent = db(z0(RF.dB(D)), 2, "dBi");
      rG.v.innerHTML = `${num(z0(RF.dB(G)), 2)} dBi <span class="note-small">= ${num(z0(RF.dbiToDbd(RF.dB(G))), 2)} dBd</span>`;
      // desen integrali: ∫ verim·D dΩ / 4π — sayısal hesap (yalnızca verime bağlı kalmalı)
      const chk = directivityOf((th) => eff * Dk(kind, th));
      rP.v.textContent = "%" + num((100 * chk.I) / 2, 1);
      rM.v.textContent = "× " + sig(G, 3);
      if (document.activeElement !== dbiIn && document.activeElement !== dbdIn) {
        dbiIn.value = z0(RF.dB(G)).toFixed(2); dbdIn.value = z0(RF.dbiToDbd(RF.dB(G))).toFixed(2);
      }
    }
    let scale = 1;
    function draw() {
      if (!st.w) return;
      const { ctx, w, h: hh } = st;
      ctx.clearRect(0, 0, w, hh);
      const stack = w < 640;
      const pw = stack ? w : w * 0.56, ph = stack ? hh * 0.55 : hh;
      // ölçek: alan şiddeti (√G) — izotropik küre yarıçapı 1
      let mx = 1;
      for (let i = 0; i <= 90; i++) { const th = (Math.PI * i) / 90; mx = Math.max(mx, eff * ((1 - t) * Dk(from, th) + t * Dk(kind, th))); }
      const target = 1 / Math.max(1.2, Math.sqrt(mx));
      scale += (target - scale) * 0.12;
      const R3 = Math.min(pw, ph) * (stack ? 0.38 : 0.47);
      const rf = (ux, uy, uz) => scale * Math.sqrt(Math.max(0, eff * Dview(ux, uy, uz)));
      surface3D(ctx, pw / 2, ph / 2 + (stack ? 16 : 6), R3, rf, orb.yaw, orb.pitch, C.fwd, { ref: scale, alpha: 0.85, axis: kind === "dip" && t > 0.5 ? 0.25 * scale + 0.1 : 0 });
      V.text(ctx, "3B balon: aynı uzaklıkta alan şiddeti", 16, 24, { color: C.ink2, size: 12, weight: 600 });
      V.text(ctx, "kesikli küre: aynı güçteki izotropik anten", 16, 40, { color: C.muted, size: 11 });
      // sağ: yatay kesit (kutupsal, doğrusal alan), izotropik daire başvuru
      const ox = stack ? 0 : pw, oy = stack ? ph : 0, qw = stack ? w : w - pw, qh = stack ? hh - ph : hh;
      ctx.save(); ctx.strokeStyle = C.line; ctx.beginPath(); if (stack) { ctx.moveTo(16, oy); ctx.lineTo(w - 16, oy); } else { ctx.moveTo(ox, 16); ctx.lineTo(ox, hh - 16); } ctx.stroke(); ctx.restore();
      const cx = ox + qw / 2, cy = oy + qh / 2 + 8, R = Math.min(qw, qh) * 0.4;
      ctx.save(); ctx.strokeStyle = C.grid2; ctx.lineWidth = 1;
      for (let a = 0; a < 180; a += 30) { const tt = (a * Math.PI) / 180; ctx.beginPath(); ctx.moveTo(cx - R * Math.cos(tt), cy - R * Math.sin(tt)); ctx.lineTo(cx + R * Math.cos(tt), cy + R * Math.sin(tt)); ctx.stroke(); }
      ctx.setLineDash([3, 4]); ctx.strokeStyle = rgba(C.ink2, 0.5);
      ctx.beginPath(); ctx.arc(cx, cy, R * scale, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      // kesit düzlemi: x–z (dipol ekseni dikey, yönlü hüzme sağa)
      ctx.save(); ctx.beginPath();
      for (let i = 0; i <= 360; i++) {
        const a = (2 * Math.PI * i) / 360, ux = Math.cos(a), uz = Math.sin(a);
        const r = R * rf(ux, 0, uz);
        const x = cx + r * ux, y = cy - r * uz;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.closePath(); ctx.fillStyle = rgba(C.fwd, 0.14); ctx.fill();
      ctx.strokeStyle = C.fwd; ctx.lineWidth = 2.2; ctx.shadowColor = C.fwd; ctx.shadowBlur = 8; ctx.stroke(); ctx.restore();
      V.text(ctx, "dikey kesit", ox + 16, oy + 24, { color: C.ink2, size: 12, weight: 600 });
      V.text(ctx, "izotropik", cx - R * scale * 0.72 - 4, cy - R * scale * 0.72 - 4, { color: C.ink2, size: 11, align: "right" });
    }
    const lp = loop((dt) => {
      if (t < 1) t = Math.min(1, t + dt / 0.7);
      if (orb.auto) orb.yaw += dt * 0.3;
      draw();
    });
    upd();
    return { enter() { lp.start(); }, leave() { lp.stop(); } };
  };

  /* ---------------- sözlük ve hayalet el ---------------- */
  window.GLOSSARY_EXTRA = (window.GLOSSARY_EXTRA || []).concat([
    { k: ["ayna görüntüsü", "görüntü yöntemi"], t: "Ayna görüntüsü (görüntü yöntemi)", d: "İletken bir düzlemin üstündeki alan, düzlem kaldırılıp altına antenin ayna görüntüsü konmuş gibi hesaplanabilir. Çeyrek dalga monopol bu yüzden yarım dalga dipolün üst yarısı gibi davranır.", u: "https://en.wikipedia.org/wiki/Method_of_image_charges" },
    { k: ["kısaltma faktörü", "uç etkisi"], t: "Kısaltma faktörü", d: "Gerçek bir telin rezonans boyu, boşluktaki yarım dalga boyundan biraz kısadır (tipik 0,95 civarı). Telin uçlarındaki ek sığa ve telin kalınlığı bunun nedenidir; tel kalınlaştıkça kısaltma artar.", u: "https://en.wikipedia.org/wiki/Dipole_antenna" },
    { k: ["radyal"], t: "Radyal", d: "Dikey bir antenin dibinden yıldız gibi yayılan teller; yapay bir toprak düzlemi oluşturur.", u: "https://en.wikipedia.org/wiki/Monopole_antenna" },
  ]);
  window.GUIDE_SCENARIOS = Object.assign(window.GUIDE_SCENARIOS || {}, {
    "anten-nasil-isir": [{ slide: "label:Açılma", to: 1 }, { wait: 900 }, { drag: "css:.fill > canvas", path: [[0.5, 0.45], [0.66, 0.4], [0.86, 0.35]] }],
    dipol: [{ click: "=145 MHz" }, { wait: 600 }, { click: "Rezonansa getir" }],
    monopol: [{ click: "Ayna görüntüsünü göster" }, { wait: 1200 }, { click: "Tam dipol" }],
    "isima-deseni": [{ click: "=1λ" }, { wait: 900 }, { click: "=1,5λ" }],
    kazanc: [{ click: "Dipol" }, { wait: 900 }, { click: "Yönlü" }, { slide: "label:Sıkıştırma n", to: 12 }],
  });
})();
