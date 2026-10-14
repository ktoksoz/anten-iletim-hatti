/* Smith abağı: sitedeki tek Smith bileşeni. Tuvale çizer; koordinat dönüşümleri ve sürükleme yardımcıları.
   Normalize empedans z = Z / Z0. Γ = (z − 1) / (z + 1).
   Renk dili: sabit direnç daireleri kemik (R), üst yarıdaki sabit reaktans yayları mor (+X, endüktif),
   alt yarıdakiler turkuaz (−X, kapasitif). Admitans ızgarası kesikli ve soluk.
   morph = 1 iken aynı çizgiler düz (dikdörtgen) empedans düzleminde çizilir: 0 → 1 arası geçiş
   "Smith abağı bükülmüş bir düzlemdir" fikrini canlandırır. */
(function () {
  const { C: K, FONT, rgba } = L;
  const RV = [0.2, 0.5, 1, 2, 5];
  const XV = [0.2, 0.5, 1, 2, 5];

  // Geometri: { cx, cy, R, morph } ; morph 0 = Smith, 1 = dikdörtgen düzlem (r 0..RMAX, x −XMAX..XMAX)
  const RMAX = 4, XMAX = 2.6;
  function gammaOf(z) {
    if (!isFinite(z.re) || !isFinite(z.im)) return { re: 1, im: 0 };
    const d = (z.re + 1) ** 2 + z.im ** 2;
    return { re: (z.re * z.re + z.im * z.im - 1) / d, im: (2 * z.im) / d };
  }
  function zOfGamma(g) {
    const d = (1 - g.re) ** 2 + g.im ** 2;
    if (d < 1e-12) return { re: Infinity, im: 0 };
    return { re: (1 - g.re * g.re - g.im * g.im) / d, im: (2 * g.im) / d };
  }
  function rectXY(z, geo) {
    // dikdörtgen düzlem: Smith dairesini çevreleyen kutuya yerleşir
    const w = geo.R * 2, hh = geo.R * 2;
    return [geo.cx - geo.R + (z.re / RMAX) * w, geo.cy - (z.im / XMAX) * (hh / 2)];
  }
  function toXY(z, geo) {
    const g = gammaOf(z);
    const sx = geo.cx + g.re * geo.R, sy = geo.cy - g.im * geo.R;
    const m = geo.morph || 0;
    if (!m) return [sx, sy];
    if (!isFinite(z.re) || !isFinite(z.im)) return [sx, sy];
    const [rx, ry] = rectXY(z, geo);
    const e = m * m * (3 - 2 * m);
    return [sx + (rx - sx) * e, sy + (ry - sy) * e];
  }
  const gammaXY = (g, geo) => [geo.cx + g.re * geo.R, geo.cy - g.im * geo.R];
  // Ekrandaki noktadan normalize z (morph = 0 varsayılır); daire dışına taşarsa kenara çekilir
  function fromXY(px, py, geo) {
    let gr = (px - geo.cx) / geo.R, gi = -(py - geo.cy) / geo.R;
    const m = Math.hypot(gr, gi);
    if (m > 0.999) { gr *= 0.999 / m; gi *= 0.999 / m; }
    return zOfGamma({ re: gr, im: gi });
  }
  // Ekrana sığan geometri (kenar boşluğu pad)
  function fit(w, h, pad = 28) {
    const R = Math.max(10, Math.min(w, h) / 2 - pad);
    return { cx: w / 2, cy: h / 2, R, morph: 0 };
  }

  function polyline(ctx, pts) {
    let started = false;
    for (const p of pts) {
      if (!p) { started = false; continue; }
      if (!started) { ctx.moveTo(p[0], p[1]); started = true; } else ctx.lineTo(p[0], p[1]);
    }
  }
  // Sabit r dairesi örnekleri (x: −∞..∞)
  function rLine(r, geo, n = 160) {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const ph = -Math.PI / 2 + (Math.PI * (i + 0.0001)) / (n + 0.0002);
      const x = Math.tan(ph);
      if (geo.morph > 0.001 && Math.abs(x) > XMAX * 1.02) { pts.push(null); continue; }
      pts.push(toXY({ re: r, im: x }, geo));
    }
    return pts;
  }
  // Sabit x yayı örnekleri (r: 0..∞)
  function xLine(x, geo, n = 120) {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const r = Math.tan((Math.PI / 2) * (i / n) * 0.999);
      if (geo.morph > 0.001 && r > RMAX * 1.02) { pts.push(null); continue; }
      pts.push(toXY({ re: r, im: x }, geo));
    }
    return pts;
  }

  /* Abağı çiz. opts: { labels, admittance, faint, lw } */
  function draw(ctx, geo, opts = {}) {
    const { cx, cy, R } = geo;
    const m = geo.morph || 0;
    const a = opts.faint ? 0.55 : 1;
    ctx.save();
    // zemin: daire içi çok hafif
    if (m < 0.999) {
      ctx.globalAlpha = 1 - m;
      const gr = ctx.createRadialGradient(cx, cy, R * 0.1, cx, cy, R);
      gr.addColorStop(0, "rgba(150,196,235,0.06)"); gr.addColorStop(1, "rgba(150,196,235,0.015)");
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (m > 0.001) {
      ctx.globalAlpha = m;
      ctx.strokeStyle = K.grid2; ctx.lineWidth = 1;
      ctx.strokeRect(cx - R, cy - R, 2 * R, 2 * R);
      ctx.globalAlpha = 1;
    }
    // admitans ızgarası (kesikli): y = 1/z düzleminde sabit g ve b → Γ'nin eksi işaretlisi
    if (opts.admittance && m < 0.01) {
      ctx.setLineDash([3, 4]); ctx.lineWidth = 0.8;
      ctx.strokeStyle = rgba("#a9bfcf", 0.22 * a);
      for (const g of RV) {
        const c = -g / (1 + g), rr = 1 / (1 + g);
        ctx.beginPath(); ctx.arc(cx + c * R, cy, rr * R, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
      for (const b of XV) for (const s of [1, -1]) {
        const ccx = cx - R, ccy = cy + (s * R) / b;
        ctx.beginPath(); ctx.arc(ccx, ccy, R / b, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
      ctx.setLineDash([]);
    }
    // sabit reaktans yayları: üst +X mor, alt −X turkuaz
    ctx.lineWidth = opts.lw || 1;
    for (const x of XV) for (const s of [1, -1]) {
      ctx.strokeStyle = rgba(s > 0 ? K.Xp : K.Xn, (x === 1 ? 0.62 : 0.4) * a);
      ctx.beginPath(); polyline(ctx, xLine(s * x, geo)); ctx.stroke();
    }
    // sabit direnç daireleri (kemik)
    for (const r of RV) {
      ctx.strokeStyle = rgba(K.R, (r === 1 ? 0.7 : 0.42) * a);
      ctx.beginPath(); polyline(ctx, rLine(r, geo)); ctx.stroke();
    }
    // r = 0 (dış çember) ve gerçek eksen
    ctx.strokeStyle = rgba(K.R, 0.9 * a); ctx.lineWidth = 1.6;
    ctx.beginPath(); polyline(ctx, rLine(0, geo, 240)); ctx.stroke();
    ctx.strokeStyle = rgba(K.R, 0.55 * a); ctx.lineWidth = 1;
    ctx.beginPath(); polyline(ctx, xLine(0, geo)); ctx.stroke();
    // etiketler
    if (opts.labels !== false && R > 90) {
      const fs = Math.max(9, Math.min(12, R / 16));
      ctx.font = `500 ${fs}px ${FONT.num}`;
      ctx.textAlign = "center"; ctx.textBaseline = "bottom";
      ctx.fillStyle = rgba(K.R, 0.85 * a);
      // düz düzlemde 0,2 sola sıkışır ve 5 dışarıda kalır: yalnızca sığanları yaz
      const rl = m > 0.5 ? [0, 0.5, 1, 2, 3, 4] : [0, ...RV];
      for (const r of rl) {
        const [x, y] = toXY({ re: r, im: 0 }, geo);
        ctx.fillText(String(r).replace(".", ","), x + (r === 0 ? (m > 0.5 ? 6 : 8) : 0), y - 3);
      }
      ctx.textBaseline = "middle";
      for (const x of XV) for (const s of [1, -1]) {
        let px, py;
        if (m < 0.5) {
          const g = gammaOf({ re: 0, im: s * x });
          px = cx + g.re * (R + fs * 1.3); py = cy - g.im * (R + fs * 1.3);
        } else { [px, py] = toXY({ re: 0, im: s * x }, geo); px -= fs * 1.6; }
        ctx.fillStyle = rgba(s > 0 ? K.Xp : K.Xn, 0.9 * a);
        ctx.fillText((s > 0 ? "+" : "−") + String(x).replace(".", ","), px, py);
      }
      if (m < 0.5) {
        ctx.fillStyle = rgba(K.ink2, 0.7 * a);
        ctx.textAlign = "left";
        ctx.fillText("∞", cx + R + 5, cy);
      }
    }
    ctx.restore();
  }

  // Merkezde, |Γ| yarıçaplı sabit VSWR dairesi
  function vswrCircle(ctx, geo, gmag, color = K.tot) {
    ctx.save();
    ctx.setLineDash([5, 5]); ctx.strokeStyle = rgba(color, 0.75); ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.arc(geo.cx, geo.cy, gmag * geo.R, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  // Nokta (normalize z) ve isteğe bağlı etiket
  function point(ctx, geo, z, color = K.copper, label, r = 6) {
    const [x, y] = toXY(z, geo);
    ctx.save();
    ctx.fillStyle = color; ctx.strokeStyle = K.deep; ctx.lineWidth = 2;
    ctx.shadowColor = color; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0; ctx.stroke();
    if (label) {
      ctx.font = `600 12px ${FONT.display}`; ctx.fillStyle = K.ink;
      ctx.textAlign = "left"; ctx.textBaseline = "bottom";
      ctx.fillText(label, x + r + 4, y - 3);
    }
    ctx.restore();
    return [x, y];
  }
  // Normalize z dizisinden iz çizgisi
  function path(ctx, geo, zs, color = K.copper, lw = 2.2, dash) {
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineJoin = "round"; ctx.lineCap = "round";
    if (dash) ctx.setLineDash(dash);
    ctx.beginPath(); polyline(ctx, zs.map((z) => toXY(z, geo))); ctx.stroke();
    ctx.restore();
  }
  // Γ değerlerinden iz çizgisi
  function gammaPath(ctx, geo, gs, color = K.copper, lw = 2.2) {
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineJoin = "round";
    ctx.beginPath(); polyline(ctx, gs.map((g) => gammaXY(g, geo))); ctx.stroke();
    ctx.restore();
  }

  // Bir eleman eklenince z'nin izlediği yol (normalize, Z0 = 1):
  //  seri X: z + j·x (sabit r dairesi üzerinde), paralel B: y + j·b (sabit g dairesi üzerinde),
  //  hat: z'yi Γ düzleminde merkez etrafında saat yönünde döndürür (λ cinsinden uzunluk).
  const cmul = (a, b) => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
  const cinv = (a) => { const d = a.re * a.re + a.im * a.im; return { re: a.re / d, im: -a.im / d }; };
  function trace(z, op, amount, n = 40) {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const k = (amount * i) / n;
      if (op === "series") out.push({ re: z.re, im: z.im + k });
      else if (op === "shunt") { const y = cinv(z); out.push(cinv({ re: y.re, im: y.im + k })); }
      else if (op === "line") {
        const g = gammaOf(z), th = -4 * Math.PI * k;
        out.push(zOfGamma(cmul(g, { re: Math.cos(th), im: Math.sin(th) })));
      }
    }
    return out;
  }

  window.Smith = { draw, fit, toXY, fromXY, gammaOf, zOfGamma, gammaXY, vswrCircle, point, path, gammaPath, trace, RV, XV, RMAX, XMAX };
})();
