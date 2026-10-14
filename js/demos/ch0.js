/* Bölüm 0: kapak ve kapanış. Canlı 2B FDTD: bir dipolün etrafında kopup boşluğa yayılan elektrik alanı.
   Tıklanan yerde kısa bir dalga paketi ateşlenir; dalgalar girişim yapar. */
(function () {
  const { C, h, canvas, loop, pointer } = L;

  function fieldScene(stage, slide, { outro = false } = {}) {
    const cv = h("canvas", { "aria-label": "Dipol anten çevresindeki elektrik alanı; tıklayınca yeni bir dalga kaynağı ateşlenir" });
    stage.append(cv);
    const CELL = 4, PERIOD = 64; // dalga boyu = PERIOD · 0,5 = 32 hücre
    let gain = 4, grid = null, img = null, off = null, offx = null, geo = null, levels = [];
    const st = canvas(cv, build);

    function build() {
      const nx = Math.max(60, Math.round(st.w / CELL)), ny = Math.max(60, Math.round(st.h / CELL));
      grid = new FDTD2D.Grid(nx, ny, { pml: 16 });
      grid.hp = 1 / (PERIOD * 3);
      // dipol: geniş ekranda sağ tarafta, dar ekranda üstte; yarım dalga boyu (16 hücre) uzunluğunda
      const narrow = st.w < 700;
      const ax = Math.round(nx * (narrow ? 0.5 : outro ? 0.74 : 0.68)), ay = Math.round(ny * (narrow ? 0.3 : 0.44));
      const half = 8;
      grid.addPEC(ax, ay - half, ax, ay - 1);
      grid.addPEC(ax, ay + 1, ax, ay + half);
      grid.sources.push({ kind: "gap", x: ax, y: ay, dir: "y", amp: 1.2, period: PERIOD, ramp: PERIOD * 2 });
      geo = { ax, ay, half };
      off = document.createElement("canvas"); off.width = nx; off.height = ny;
      offx = off.getContext("2d");
      img = offx.createImageData(nx, ny);
      // ısınma: alan, sayfa açıldığında zaten yayılmış olsun
      grid.step(Math.round(Math.hypot(nx, ny) * 1.6));
      draw();
    }

    function draw() {
      if (!grid) return;
      const { ctx, w, h: hh } = st;
      // parlaklık: alanın tipik genliğine göre kendini ayarlar
      let em = 0; for (let k = 0; k < grid.E2.length; k += 11) if (grid.E2[k] > em) em = grid.E2[k];
      gain += ((em ? 2.2 / Math.sqrt(em) : 4) - gain) * 0.05;
      V.fieldImage(grid, img, "E", gain);
      offx.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.fillStyle = C.deep; ctx.fillRect(0, 0, w, hh);
      const sx = w / grid.nx, sy = hh / grid.ny;
      ctx.drawImage(off, 0, 0, w, hh);
      // elektrik alan çizgileri: Ψ eş-değer eğrileri
      const ac = grid.psiAC();
      const step = Math.max(1e-4, ac.max / 14);
      levels.length = 0;
      for (let i = -13; i <= 13; i++) levels.push((i + 0.5) * step);
      V.segments(ctx, grid.contours(levels, ac), sx, sy, 0, 0, "#ffc4d6", 1, 0.5);
      // dipol: bakır kollar, besleme noktasında sarı nokta
      const { ax, ay, half } = geo;
      const X = (ax + 0.5) * sx;
      ctx.save();
      ctx.strokeStyle = C.copper; ctx.lineWidth = 3.5; ctx.lineCap = "round";
      ctx.shadowColor = C.copper; ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(X, (ay - half + 0.5) * sy); ctx.lineTo(X, (ay - 0.2) * sy);
      ctx.moveTo(X, (ay + 1.2) * sy); ctx.lineTo(X, (ay + half + 0.5) * sy);
      ctx.stroke();
      ctx.fillStyle = C.fwd; ctx.shadowColor = C.fwd; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(X, (ay + 0.5) * sy, 3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    const lp = loop(() => { if (!grid) return; grid.step(3); draw(); });
    // tıklama: kısa dalga paketi
    pointer(cv, {
      down(x, y) {
        if (!grid) return;
        grid.sources.push({ kind: "burst", x: Math.round(x / st.w * grid.nx), y: Math.round(y / st.h * grid.ny), t0: grid.t + 40, width: 22, period: PERIOD, amp: 2.2 });
      },
    });
    return { enter() { lp.start(); }, leave() { lp.stop(); } };
  }

  Demos.cover = (stage, slide) => fieldScene(stage, slide);
  Demos.outro = (stage, slide) => fieldScene(stage, slide, { outro: true });

  window.GUIDE_SCENARIOS = Object.assign(window.GUIDE_SCENARIOS || {}, {
    kapak: [{ tap: "css:canvas", at: [0.4, 0.3] }, { wait: 700 }, { tap: "css:canvas", at: [0.85, 0.75] }],
  });
})();
