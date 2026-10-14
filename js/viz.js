/* Ortak çizim yardımcıları: ölçü aleti ızgarası, eğriler, kutupsal desen, mavi baskı ölçü çizgisi.
   Hepsi L.canvas ile kurulmuş (CSS pikseli koordinatlı) bağlamlara çizer. */
(function () {
  const { C, FONT, rgba } = L;

  // Graticule: VNA ekranı gibi ince ızgara; nx × ny bölme, orta çizgiler biraz daha belirgin
  function graticule(ctx, x, y, w, h, nx = 10, ny = 8, opts = {}) {
    ctx.save();
    ctx.lineWidth = 1;
    for (let i = 0; i <= nx; i++) {
      const px = Math.round(x + (w * i) / nx) + 0.5;
      ctx.strokeStyle = i === nx / 2 && opts.center !== false ? C.grid2 : C.grid;
      ctx.beginPath(); ctx.moveTo(px, y); ctx.lineTo(px, y + h); ctx.stroke();
    }
    for (let j = 0; j <= ny; j++) {
      const py = Math.round(y + (h * j) / ny) + 0.5;
      ctx.strokeStyle = j === ny / 2 && opts.center !== false ? C.grid2 : C.grid;
      ctx.beginPath(); ctx.moveTo(x, py); ctx.lineTo(x + w, py); ctx.stroke();
    }
    ctx.restore();
  }

  // Değer dizisini çiz: arr[i] → x ekseninde eşit aralık, [ymin, ymax] → [y+h, y]
  function trace(ctx, arr, x, y, w, h, ymin, ymax, color, lw = 2, opts = {}) {
    const n = opts.n ?? arr.length, i0 = opts.i0 || 0;
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineJoin = "round"; ctx.lineCap = "round";
    if (opts.glow) { ctx.shadowColor = color; ctx.shadowBlur = opts.glow; }
    if (opts.dash) ctx.setLineDash(opts.dash);
    if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const v = arr[i0 + i];
      const px = x + (w * i) / Math.max(1, n - 1);
      const py = y + h - ((v - ymin) / (ymax - ymin)) * h;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
  }
  // Fonksiyon çiz: f(u), u ∈ [u0, u1]
  function fn(ctx, f, u0, u1, x, y, w, h, ymin, ymax, color, lw = 2, opts = {}) {
    const n = opts.samples || Math.max(60, Math.round(w / 2));
    const arr = new Float64Array(n);
    for (let i = 0; i < n; i++) arr[i] = f(u0 + ((u1 - u0) * i) / (n - 1));
    trace(ctx, arr, x, y, w, h, ymin, ymax, color, lw, opts);
  }

  function text(ctx, s, x, y, { color = C.ink2, size = 12, weight = 500, font = "display", align = "left", base = "alphabetic" } = {}) {
    ctx.save();
    ctx.font = `${weight} ${size}px ${FONT[font] || font}`;
    ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = base;
    ctx.fillText(s, x, y);
    ctx.restore();
  }

  function arrow(ctx, x0, y0, x1, y1, color, lw = 2, head = 8) {
    const a = Math.atan2(y1 - y0, x1 - x0);
    ctx.save();
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = lw; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 - Math.cos(a) * head * 0.6, y1 - Math.sin(a) * head * 0.6); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - head * Math.cos(a - 0.4), y1 - head * Math.sin(a - 0.4));
    ctx.lineTo(x1 - head * Math.cos(a + 0.4), y1 - head * Math.sin(a + 0.4));
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // Mavi baskı ölçü çizgisi: iki uçta oklar, ortada etiket (ör. "λ/2 = 1,03 m")
  function dimension(ctx, x0, y0, x1, y1, label, { color = C.ink2, ext = 8, size = 12 } = {}) {
    const a = Math.atan2(y1 - y0, x1 - x0), nx = -Math.sin(a), ny = Math.cos(a);
    ctx.save();
    ctx.strokeStyle = rgba(color, 0.55); ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0 - nx * ext, y0 - ny * ext); ctx.lineTo(x0 + nx * ext * 0.5, y0 + ny * ext * 0.5);
    ctx.moveTo(x1 - nx * ext, y1 - ny * ext); ctx.lineTo(x1 + nx * ext * 0.5, y1 + ny * ext * 0.5);
    ctx.stroke();
    arrow(ctx, (x0 + x1) / 2, (y0 + y1) / 2, x0, y0, rgba(color, 0.8), 1, 7);
    arrow(ctx, (x0 + x1) / 2, (y0 + y1) / 2, x1, y1, rgba(color, 0.8), 1, 7);
    if (label) {
      ctx.font = `500 ${size}px ${FONT.num}`;
      const tw = ctx.measureText(label).width;
      const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
      ctx.translate(mx, my); ctx.rotate(Math.abs(a) > Math.PI / 2 ? a + Math.PI : a);
      ctx.fillStyle = C.stage; ctx.fillRect(-tw / 2 - 5, -size * 0.65, tw + 10, size * 1.3);
      ctx.fillStyle = color; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(label, 0, 1);
    }
    ctx.restore();
  }

  // Kutupsal ızgara: dB halkaları (0, −10, −20, −30 dB) ve 30°'lik açı çizgileri
  function polarGrid(ctx, cx, cy, R, { rings = [0, -10, -20, -30], floor = -40, labels = true, zeroUp = true } = {}) {
    ctx.save();
    ctx.lineWidth = 1;
    for (const d of rings) {
      const r = R * (1 - d / floor);
      ctx.strokeStyle = d === 0 ? C.grid2 : C.grid;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
      if (labels && d < 0) text(ctx, `${String(d).replace("-", "−")} dB`, cx + 3, cy - r + 11, { size: 10, color: C.muted, font: "num" });
    }
    ctx.strokeStyle = C.grid;
    for (let a = 0; a < 180; a += 30) {
      const t = (a * Math.PI) / 180;
      ctx.beginPath(); ctx.moveTo(cx - R * Math.cos(t), cy - R * Math.sin(t)); ctx.lineTo(cx + R * Math.cos(t), cy + R * Math.sin(t)); ctx.stroke();
    }
    ctx.restore();
  }
  // Kutupsal desen: g(φ) doğrusal genlik (0..1), dB ölçekte çizilir. φ: 0 = sağ, saat yönü tersine.
  function polar(ctx, cx, cy, R, g, color, { floor = -40, lw = 2.2, fill = 0.14, n = 360, power = false } = {}) {
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const ph = (2 * Math.PI * i) / n;
      const v = Math.max(1e-9, g(ph));
      const d = power ? 10 * Math.log10(v) : 20 * Math.log10(v);
      const r = R * Math.max(0, 1 - d / floor);
      const x = cx + r * Math.cos(ph), y = cy - r * Math.sin(ph);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
    if (fill) { ctx.fillStyle = rgba(color, fill); ctx.fill(); }
    ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineJoin = "round";
    ctx.shadowColor = color; ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.restore();
  }

  // Mavi baskı köşe işaretleri: sahnenin köşelerinde ince L çizgileri
  function corners(ctx, x, y, w, h, s = 10, color = C.line2) {
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y + s); ctx.lineTo(x, y); ctx.lineTo(x + s, y);
    ctx.moveTo(x + w - s, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + s);
    ctx.moveTo(x + w, y + h - s); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - s, y + h);
    ctx.moveTo(x + s, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - s);
    ctx.stroke(); ctx.restore();
  }

  // Bir 2B FDTD ızgarasını görüntüye dönüştür. mode: "E" (|E|, gül), "H" (Hz işaretli: koyu çivit + / açık çivit −),
  // gain: parlaklık. img: ImageData (nx × ny). Sönüm katmanı karartılır.
  function fieldImage(grid, img, mode = "E", gain = 2.5) {
    const { nx, ny, Hz, pml } = grid, d = img.data;
    const E = L.hexToRgb(C.E), Hc = L.hexToRgb(C.H), Hn = L.hexToRgb("#cfd5ff");
    const bg = L.hexToRgb(C.deep);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i, o = k * 4;
      let v, col;
      if (mode === "H") { v = Hz[k] * gain; col = v >= 0 ? Hc : Hn; v = Math.abs(v); }
      else { v = grid.eAt(k) * gain; col = E; }
      v = v / (1 + v); // yumuşak doyma
      const edge = Math.min(i - pml, nx - 1 - pml - i, j - pml, ny - 1 - pml - j);
      const fade = edge < 0 ? Math.max(0, 1 + edge / pml) ** 2 : 1;
      v *= fade;
      d[o] = bg[0] + (col[0] - bg[0]) * v;
      d[o + 1] = bg[1] + (col[1] - bg[1]) * v;
      d[o + 2] = bg[2] + (col[2] - bg[2]) * v;
      d[o + 3] = 255;
    }
    return img;
  }
  // Eş-değer eğrisi parçalarını (grid.contours çıktısı) ölçekleyerek çiz
  function segments(ctx, res, sx, sy, ox, oy, color, lw = 1, alpha = 0.8) {
    const { seg, n } = res;
    ctx.save(); ctx.strokeStyle = color; ctx.globalAlpha = alpha; ctx.lineWidth = lw;
    ctx.beginPath();
    for (let i = 0; i < n * 4; i += 4) {
      ctx.moveTo(ox + seg[i] * sx, oy + seg[i + 1] * sy);
      ctx.lineTo(ox + seg[i + 2] * sx, oy + seg[i + 3] * sy);
    }
    ctx.stroke(); ctx.restore();
  }

  window.V = { graticule, trace, fn, text, arrow, dimension, polarGrid, polar, corners, fieldImage, segments };
})();
