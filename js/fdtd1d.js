/* 1B FDTD iletim hattı simülasyonu (telgrafçı denklemleri, Yee sıçrama düzeni).
   Hat N hücreye bölünür; gerilim düğümlerde (V[0..N]), akım hücre ortalarında (I[0..N-1]).
   Courant sayısı 1 ("sihirli zaman adımı"): kayıpsız hatta dalga her adımda tam bir hücre ilerler,
   sayısal dağılma olmaz. Birimler normalize: dt = 1 adım, dx = 1 hücre.
     I[k] ← I[k] − (V[k+1] − V[k]) / Z0
     V[k] ← V[k] − Z0 (I[k] − I[k−1])
   Kaynak: iç direnci Rs olan gerilim kaynağı (Thevenin) düğüm 0'da, yarım hücre kapasitansıyla.
   Yük: düğüm N'de seri R–L–C dalı (her biri isteğe bağlı), yamuk kuralıyla örtük çözülür.
   İleri ve yansıyan dalgayı ayırmak için aynı kaynakla, uyumlu yüklü ikinci bir hat yan yana koşar:
   ileri = uyumlu hattaki gerilim, yansıyan = toplam − ileri. Böylece ayrım tam (yaklaşıksız) olur.
   Tarayıcıda window.FDTD1D, Node'da module.exports. */
(function (root) {
  class Line {
    constructor(N, Z0 = 50) {
      this.N = N; this.Z0 = Z0;
      this.V = new Float64Array(N + 1);
      this.I = new Float64Array(N);
      this.iL = 0; this.vc = 0; // yük dalının akımı ve kondansatör gerilimi
      this.loss = 0;           // hücre başına zayıflama (Heaviside: bozulmasız kayıp)
      this.Zc = null;          // isteğe bağlı: hücre başına empedans (TDR arızaları); hız her yerde aynı
      this.Zn = null;
    }
    // Hücre empedanslarını ayarla: fn(k) → Ω (k = 0..N−1). null → düzgün hat.
    setProfile(fn) {
      if (!fn) { this.Zc = this.Zn = null; return; }
      const N = this.N;
      this.Zc = new Float64Array(N); this.Zn = new Float64Array(N + 1);
      for (let k = 0; k < N; k++) this.Zc[k] = fn(k);
      // düğüm kapasitansı komşu iki yarım hücreden: 1/Zn = (1/Z[k−1] + 1/Z[k]) / 2
      for (let k = 1; k < N; k++) this.Zn[k] = 2 / (1 / this.Zc[k - 1] + 1 / this.Zc[k]);
      this.Zn[0] = this.Zc[0]; this.Zn[N] = this.Zc[N - 1];
    }
    reset() { this.V.fill(0); this.I.fill(0); this.iL = 0; this.vc = 0; }
    // load: { R, L, C } (L, C sim birimlerinde; C = Infinity → kondansatör yok; open: true → açık devre)
    step(vs, Rs, load) {
      const { N, Z0, V, I } = this;
      // kayıp: R' ve G' = R'/Z0² eşit oranda; her yarım adımda genlik (1 − loss/2) ile çarpılır
      const ka = this.loss ? 1 - this.loss / 2 : 1;
      const Zc = this.Zc, Zn = this.Zn;
      if (Zc) {
        for (let k = 0; k < N; k++) I[k] = ka * I[k] - (V[k + 1] - V[k]) / Zc[k];
        for (let k = 1; k < N; k++) V[k] = ka * V[k] - Zn[k] * (I[k] - I[k - 1]);
      } else {
        for (let k = 0; k < N; k++) I[k] = ka * I[k] - (V[k + 1] - V[k]) / Z0;
        for (let k = 1; k < N; k++) V[k] = ka * V[k] - Z0 * (I[k] - I[k - 1]);
      }
      // kaynak düğümü: (Ch) dV/dt = (vs − V)/Rs − I0, Ch = 1/(2 Z0)
      const b = Z0 / Rs;
      V[0] = ((1 - b) * V[0] + 2 * Z0 * (vs / Rs - I[0])) / (1 + b);
      // yük düğümü
      const Iin = I[N - 1], Ch = 1 / (2 * (Zc ? Zc[N - 1] : Z0)), Vn = V[N];
      if (load.open) { V[N] = Vn + Iin / Ch; this.iL = 0; this.vc = 0; return; }
      const R = load.R || 0, Lh = load.L || 0;
      const invC = load.C && isFinite(load.C) ? 1 / load.C : 0;
      if (!invC) this.vc = 0; // kondansatörsüz yükte eski yükten kalan gerilim olmasın
      const k = R / 2 + invC / 4 + 1 / (4 * Ch);
      const i = this.iL, vc = this.vc;
      const a = (Vn + Iin / (2 * Ch) - vc - (k - Lh) * i) / (k + Lh);
      V[N] = Vn + (Iin - (i + a) / 2) / Ch;
      this.vc = vc + ((i + a) / 2) * invC;
      this.iL = a;
    }
  }

  /* Kaynak + hat + yük; ileri/yansıyan ayrımı için gölge hat */
  class Sim {
    constructor({ N = 400, Z0 = 50, Rs = 50 } = {}) {
      this.N = N; this.Z0 = Z0; this.Rs = Rs;
      this.main = new Line(N, Z0);
      this.ref = new Line(N, Z0);
      this.load = { R: 50 };
      this.t = 0;
      this.source = { kind: "pulse", width: 24, amp: 1, period: 80 }; // period: sinüs periyodu (adım)
      this.fwd = new Float64Array(N + 1);
      this.rev = new Float64Array(N + 1);
      this.loadV = 0; this.loadI = 0;
    }
    setLoss(perCell) { this.main.loss = this.ref.loss = perCell; }
    // Ana hattın empedans profili (ör. TDR arızası); gölge hat düzgün kalır, böylece arızadan
    // dönen yankı "yansıyan" dalgada görünür
    setProfile(fn) { this.main.setProfile(fn); }
    reset() { this.main.reset(); this.ref.reset(); this.t = 0; }
    // R + jX yükünü, sürekli sinüsün açısal frekansında eşdeğer L ya da C ile kur
    setLoadZ(R, X, open) {
      if (open) { this.load = { open: true }; return; }
      const w = (2 * Math.PI) / this.source.period;
      if (X > 0) this.load = { R, L: X / w };
      else if (X < 0) this.load = { R, C: -1 / (w * X) };
      else this.load = { R };
    }
    sourceValue(t) {
      const s = this.source;
      if (s.kind === "sine") {
        const ramp = Math.min(1, t / (2 * s.period)); // yumuşak başlangıç
        return s.amp * ramp * Math.sin((2 * Math.PI * t) / s.period);
      }
      if (s.kind === "step") return t > 0 ? s.amp : 0;
      if (s.kind === "pulse") { // Gauss darbesi, bir kez
        const t0 = 2.2 * s.width, u = (t - t0) / (s.width / 2.5);
        return s.amp * Math.exp(-u * u);
      }
      return 0;
    }
    // darbeyi yeniden ateşle (hat sıfırlanmadan)
    fire() { this.t = 0; }
    step(n = 1) {
      for (let s = 0; s < n; s++) {
        // kaynağın açık devre gerilimi 2·amp: uyumlu kaynakta hatta amp genlikli dalga girer
        const vs = 2 * this.sourceValue(this.t);
        this.main.step(vs, this.Rs, this.load);
        this.ref.step(vs, this.Rs, { R: this.Z0 });
        this.t++;
      }
      const Vm = this.main.V, Vr = this.ref.V;
      for (let k = 0; k <= this.N; k++) { this.fwd[k] = Vr[k]; this.rev[k] = Vm[k] - Vr[k]; }
      this.loadV = Vm[this.N]; this.loadI = this.main.iL;
    }
    get V() { return this.main.V; }
  }

  const FDTD1D = { Line, Sim };
  if (typeof module !== "undefined" && module.exports) module.exports = FDTD1D;
  else root.FDTD1D = FDTD1D;
})(typeof window !== "undefined" ? window : globalThis);
