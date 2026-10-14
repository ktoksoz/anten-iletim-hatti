/* 2B FDTD alan simülasyonu (TE kipi: Hz düzleme dik, Ex ve Ey düzlemde; Yee ızgarası).
   Normalize birimler: ışık hızı 1, hücre 1, ε = μ = 1, dt = S (Courant sayısı 0,5 < 1/√2).
     Hz ← Hz − S (∂Ey/∂x − ∂Ex/∂y)
     Ex ← Ex + S ∂Hz/∂y,  Ey ← Ey − S ∂Hz/∂x
   Kenarlarda kademeli iletkenlikli sönümleyici katman (eşlenmiş elektrik ve manyetik kayıp,
   σ* = σ: dik gelişte yansımasız; basit bir PML benzeri). Mükemmel iletkenler (PEC) için
   Ex/Ey sıfırlanır. Elektrik alan çizgileri: Ψ = ∫Hz dt eş-değer eğrileri (kaynaksız bölgede
   E = ∇×(Ψ ẑ), yani E çizgileri Ψ'nin eş-değer eğrileridir; yaklaşım değil, tanım).
   DOM kullanmaz: Web Worker içinde de çalışabilir. Tarayıcıda window.FDTD2D, Node'da module.exports. */
(function (root) {
  class Grid {
    constructor(nx, ny, { pml = 18, S = 0.5 } = {}) {
      this.nx = nx; this.ny = ny; this.S = S; this.pml = pml; this.t = 0;
      const n = nx * ny;
      this.Hz = new Float32Array(n); this.Ex = new Float32Array(n); this.Ey = new Float32Array(n);
      this.Psi = new Float32Array(n);   // ∫Hz dt: E çizgileri
      this.PsiM = new Float32Array(n);  // Ψ'nin yavaş ortalaması (durağan bileşen); çizgiler Ψ − PsiM ile çizilir
      this.PsiAC = new Float32Array(n);
      this.hp = 0.004;                  // ortalama hızı (adım başına); kaynak periyoduna göre ayarlanabilir
      this.E2 = new Float32Array(n);    // zaman ortalamalı |E|² (üstel ortalama)
      this.pecX = new Uint8Array(n); this.pecY = new Uint8Array(n);
      // sönüm katsayıları (ca: kendi çarpanı, cb: rotasyonel çarpanı); x ve y bileşenleri ayrı
      this.da = new Float32Array(n); this.db = new Float32Array(n);
      const smax = 0.8 / S; // katman içi en büyük iletkenlik (normalize)
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const d = Math.max(pml - i, i - (nx - 1 - pml), pml - j, j - (ny - 1 - pml), 0) / pml;
        const s = smax * d * d * d * S / 2;
        this.da[j * nx + i] = (1 - s) / (1 + s);
        this.db[j * nx + i] = S / (1 + s);
      }
      this.sources = [];
      this.avgK = 0.02;
    }
    reset() {
      [this.Hz, this.Ex, this.Ey, this.Psi, this.PsiM, this.E2].forEach((a) => a.fill(0));
      this.t = 0;
    }
    idx(i, j) { return j * this.nx + i; }
    // Dikdörtgen mükemmel iletken (hücre koordinatları, uçlar dahil)
    addPEC(x0, y0, x1, y1) {
      const { nx, ny } = this;
      x0 = Math.max(0, Math.round(Math.min(x0, x1))); x1 = Math.min(nx - 1, Math.round(Math.max(x0, x1)));
      y0 = Math.max(0, Math.round(Math.min(y0, y1))); y1 = Math.min(ny - 1, Math.round(Math.max(y0, y1)));
      // Ex(i,j) düğüm (i,j)–(i+1,j) kenarında, Ey(i,j) düğüm (i,j)–(i,j+1) kenarında.
      // İki ucu da iletkenin içinde kalan kenarlardaki teğet E sıfırdır. İnce tel (x0 = x1) yalnızca Ey'yi sıfırlar.
      for (let j = y0; j <= y1; j++) for (let i = x0; i < x1; i++) this.pecX[j * nx + i] = 1;
      for (let j = y0; j < y1; j++) for (let i = x0; i <= x1; i++) this.pecY[j * nx + i] = 1;
    }
    clearPEC() { this.pecX.fill(0); this.pecY.fill(0); }
    // Kaynaklar:
    //  {kind: "gap", x, y, dir: "x"|"y", amp, period, phase, ramp}: yumuşak akım kaynağı (Ex/Ey'ye eklenir)
    //  {kind: "burst", x, y, t0, width, period, amp}: Gauss zarflı kısa dalga paketi (Hz'e eklenir)
    sourceValue(s, t) {
      if (s.kind === "burst") {
        const u = (t - s.t0) / s.width;
        if (u < -4 || u > 4) return 0;
        return s.amp * Math.exp(-u * u) * Math.sin((2 * Math.PI * (t - s.t0)) / s.period);
      }
      const ramp = s.ramp ? Math.min(1, t / s.ramp) : 1;
      return s.amp * ramp * Math.sin((2 * Math.PI * t) / s.period + (s.phase || 0));
    }
    step(n = 1) {
      const { nx, ny, Hz, Ex, Ey, Psi, da, db, pecX, pecY, S } = this;
      for (let it = 0; it < n; it++) {
        // H yarım adım
        for (let j = 0; j < ny - 1; j++) {
          let k = j * nx;
          for (let i = 0; i < nx - 1; i++, k++) {
            Hz[k] = da[k] * Hz[k] - db[k] * (Ey[k + 1] - Ey[k] - Ex[k + nx] + Ex[k]);
            Psi[k] += S * Hz[k];
          }
        }
        // kaynaklar (H)
        const tH = this.t + 0.5;
        for (const s of this.sources) if (s.kind === "burst") {
          const v = this.sourceValue(s, tH);
          if (v) Hz[(s.y | 0) * nx + (s.x | 0)] += v;
        }
        // E tam adım
        for (let j = 1; j < ny; j++) {
          let k = j * nx + 1;
          for (let i = 1; i < nx; i++, k++) {
            Ex[k] = pecX[k] ? 0 : da[k] * Ex[k] + db[k] * (Hz[k] - Hz[k - nx]);
            Ey[k] = pecY[k] ? 0 : da[k] * Ey[k] - db[k] * (Hz[k] - Hz[k - 1]);
          }
        }
        this.t++;
        for (const s of this.sources) if (s.kind === "gap") {
          const v = this.sourceValue(s, this.t) * S;
          const k = (s.y | 0) * nx + (s.x | 0);
          if (s.dir === "x") Ex[k] -= v; else Ey[k] -= v;
        }
        // zamanla eski "burst" kaynaklarını at
        if (this.sources.length && this.t % 64 === 0)
          this.sources = this.sources.filter((s) => s.kind !== "burst" || this.t < s.t0 + 5 * s.width);
      }
      // |E|² ortalaması ve Ψ'nin durağan bileşeni (n adımlık toplu güncelleme)
      const K = 1 - Math.pow(1 - this.avgK, n), E2 = this.E2;
      const hp = 1 - Math.pow(1 - this.hp, n), PsiM = this.PsiM;
      for (let k = 0; k < E2.length; k++) {
        const ex = Ex[k], ey = Ey[k];
        E2[k] += K * (ex * ex + ey * ey - E2[k]);
        PsiM[k] += hp * (Psi[k] - PsiM[k]);
      }
    }
    // Hücre merkezinde |E| (Ex, Ey komşu ortalaması)
    eAt(k) {
      const { Ex, Ey, nx } = this;
      const ex = 0.5 * (Ex[k] + Ex[k + nx] || 0), ey = 0.5 * (Ey[k] + Ey[k + 1] || 0);
      return Math.hypot(ex, ey);
    }
    // Ψ'nin salınan bileşeni: kaynağın bıraktığı durağan yük alanı ve yavaş kayma çıkarılır
    // (yalnızca çizgileri çizmek için; alan değerlerine dokunmaz). Dönen dizinin en büyük |değeri| .max'ta.
    psiAC() {
      const { Psi, PsiM, PsiAC } = this;
      let mx = 0;
      for (let k = 0; k < Psi.length; k++) { const v = Psi[k] - PsiM[k]; PsiAC[k] = v; const a = v < 0 ? -v : v; if (a > mx) mx = a; }
      PsiAC.max = mx;
      return PsiAC;
    }
    // Eş-değer eğrileri (marching squares). İç bölge [pml, n−pml]. Dönen: { seg: Float32Array (x0,y0,x1,y1…), n: parça sayısı }
    // Koordinatlar hücre merkezlerine göre (x + 0,5). Bellek her çağrıda yeniden kullanılır.
    contours(levels, field = this.Psi) {
      const { nx, ny, pml } = this;
      const lo = Math.max(1, pml - 2), hix = nx - lo - 1, hiy = ny - lo - 1;
      let buf = this._cbuf || (this._cbuf = new Float32Array(1 << 16)), n = 0;
      const push = (x0, y0, x1, y1) => {
        if (n + 4 > buf.length) { const nb = new Float32Array(buf.length * 2); nb.set(buf); buf = this._cbuf = nb; }
        buf[n++] = x0 + 0.5; buf[n++] = y0 + 0.5; buf[n++] = x1 + 0.5; buf[n++] = y1 + 0.5;
      };
      for (let li = 0; li < levels.length; li++) {
        const L = levels[li];
        for (let j = lo; j < hiy; j++) {
          let k = j * nx + lo;
          for (let i = lo; i < hix; i++, k++) {
            const a = field[k] - L, b = field[k + 1] - L, c = field[k + nx + 1] - L, d = field[k + nx] - L;
            const code = (a > 0 ? 1 : 0) | (b > 0 ? 2 : 0) | (c > 0 ? 4 : 0) | (d > 0 ? 8 : 0);
            if (code === 0 || code === 15) continue;
            // kenar kesişimleri: üst (a-b), sağ (b-c), alt (d-c), sol (a-d)
            const tx = i + a / (a - b), ry = j + b / (b - c), bx = i + d / (d - c), ly = j + a / (a - d);
            switch (code) {
              case 1: case 14: push(i, ly, tx, j); break;
              case 2: case 13: push(tx, j, i + 1, ry); break;
              case 3: case 12: push(i, ly, i + 1, ry); break;
              case 4: case 11: push(i + 1, ry, bx, j + 1); break;
              case 6: case 9: push(tx, j, bx, j + 1); break;
              case 7: case 8: push(i, ly, bx, j + 1); break;
              case 5: push(i, ly, tx, j); push(i + 1, ry, bx, j + 1); break;
              case 10: push(tx, j, i + 1, ry); push(bx, j + 1, i, ly); break;
            }
          }
        }
      }
      return { seg: buf, n: n / 4 };
    }
    // Bir çember üzerinde zaman ortalamalı |E|² (uzak alan deseni yaklaşımı). n açı, açı 0 = +x, saat yönü tersine (y yukarı)
    ring(cx, cy, r, n = 180) {
      const out = new Float32Array(n);
      for (let a = 0; a < n; a++) {
        const th = (2 * Math.PI * a) / n;
        const x = Math.round(cx + r * Math.cos(th)), y = Math.round(cy - r * Math.sin(th));
        if (x < 0 || y < 0 || x >= this.nx || y >= this.ny) continue;
        out[a] = this.E2[y * this.nx + x];
      }
      return out;
    }
  }

  const FDTD2D = { Grid };
  if (typeof module !== "undefined" && module.exports) module.exports = FDTD2D;
  else root.FDTD2D = FDTD2D;
})(typeof window !== "undefined" ? window : globalThis);
