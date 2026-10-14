/* RF hesap çekirdeği: karmaşık sayılar, empedans ↔ Γ ↔ VSWR dönüşümleri, iletim hattı denklemleri,
   kablo kesitleri, uydurma ağları, anten ve bağlantı bütçesi formülleri.
   Ekranda gösterilen her sayı buradan gelir; tests/rf.test.js bilinen değerlerle doğrular.
   Tarayıcıda window.RF, Node'da module.exports. */
(function (root) {
  const c0 = 299792458;               // ışık hızı (m/s)
  const mu0 = 4e-7 * Math.PI;         // boşluğun geçirgenliği (H/m), 2019 öncesi tanım; fark 1e-10 düzeyinde
  const eps0 = 1 / (mu0 * c0 * c0);   // boşluğun dielektrik sabiti (F/m)
  const eta0 = mu0 * c0;              // boşluğun dalga empedansı ≈ 376,73 Ω
  const SIGMA_CU = 5.8e7;             // bakırın iletkenliği (S/m)

  /* ---------- Karmaşık sayılar ---------- */
  const cx = (re, im = 0) => ({ re, im });
  const C = {
    of: (z) => (typeof z === "number" ? cx(z, 0) : z),
    add: (a, b) => (a = C.of(a), b = C.of(b), cx(a.re + b.re, a.im + b.im)),
    sub: (a, b) => (a = C.of(a), b = C.of(b), cx(a.re - b.re, a.im - b.im)),
    mul: (a, b) => (a = C.of(a), b = C.of(b), cx(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re)),
    div(a, b) {
      a = C.of(a); b = C.of(b);
      const d = b.re * b.re + b.im * b.im;
      if (d === 0) return cx(a.re === 0 && a.im === 0 ? NaN : Infinity, 0);
      return cx((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d);
    },
    scale: (a, k) => cx(a.re * k, a.im * k),
    abs: (a) => Math.hypot(a.re, a.im),
    arg: (a) => Math.atan2(a.im, a.re),
    conj: (a) => cx(a.re, -a.im),
    neg: (a) => cx(-a.re, -a.im),
    inv: (a) => C.div(1, a),
    polar: (r, th) => cx(r * Math.cos(th), r * Math.sin(th)),
    exp: (a) => { const m = Math.exp(a.re); return cx(m * Math.cos(a.im), m * Math.sin(a.im)); },
    sqrt(a) {
      const r = C.abs(a);
      const re = Math.sqrt((r + a.re) / 2), im = Math.sqrt(Math.max(0, (r - a.re) / 2));
      return cx(re, a.im < 0 ? -im : im);
    },
    tanh(a) {
      // tanh(x+jy) = (sinh 2x + j sin 2y) / (cosh 2x + cos 2y)
      const x2 = 2 * a.re, y2 = 2 * a.im;
      if (Math.abs(x2) > 40) return cx(Math.sign(x2), 0);
      const d = Math.cosh(x2) + Math.cos(y2);
      return cx(Math.sinh(x2) / d, Math.sin(y2) / d);
    },
    isInf: (a) => !isFinite(a.re) || !isFinite(a.im),
  };

  /* ---------- Empedans, yansıma, VSWR ---------- */
  // Γ = (ZL − Z0) / (ZL + Z0). ZL sonsuz (açık devre) ise Γ = 1.
  function gamma(ZL, Z0 = 50) {
    ZL = C.of(ZL);
    if (C.isInf(ZL)) return cx(1, 0);
    return C.div(C.sub(ZL, Z0), C.add(ZL, Z0));
  }
  // Z = Z0 (1 + Γ) / (1 − Γ)
  function zFromGamma(G, Z0 = 50) {
    G = C.of(G);
    if (Math.abs(1 - G.re) < 1e-12 && Math.abs(G.im) < 1e-12) return cx(Infinity, 0);
    return C.scale(C.div(C.add(1, G), C.sub(1, G)), Z0);
  }
  const mag = (G) => (typeof G === "number" ? Math.abs(G) : C.abs(G));
  // VSWR = (1 + |Γ|) / (1 − |Γ|)
  function vswr(G) { const g = mag(G); return g >= 1 ? Infinity : (1 + g) / (1 - g); }
  function gammaFromVswr(s) { return isFinite(s) ? (s - 1) / (s + 1) : 1; }
  // Geri dönüş kaybı (dB) = −20 log10 |Γ|  (pozitif sayı: büyük olan iyidir)
  function returnLoss(G) { const g = mag(G); return g === 0 ? Infinity : -20 * Math.log10(g); }
  // Uyumsuzluk kaybı (dB) = −10 log10 (1 − |Γ|²)
  function mismatchLoss(G) { const g = mag(G); return g >= 1 ? Infinity : -10 * Math.log10(1 - g * g); }
  // Yüke ulaşan güç oranı (0..1), kayıpsız hat ve uyumlu kaynak için
  function powerDelivered(G) { const g = mag(G); return Math.max(0, 1 - g * g); }
  const zSeries = (a, b) => C.add(a, b);
  const zParallel = (a, b) => {
    a = C.of(a); b = C.of(b);
    if (C.isInf(a)) return b;
    if (C.isInf(b)) return a;
    return C.div(C.mul(a, b), C.add(a, b));
  };

  /* ---------- Reaktans, rezonans ---------- */
  const omega = (f) => 2 * Math.PI * f;
  const xL = (L, f) => omega(f) * L;                 // +X (endüktif)
  const xC = (Cap, f) => -1 / (omega(f) * Cap);      // −X (kapasitif)
  const zL = (L, f) => cx(0, xL(L, f));
  const zC = (Cap, f) => cx(0, xC(Cap, f));
  const resonance = (L, Cap) => 1 / (2 * Math.PI * Math.sqrt(L * Cap));
  // Seri RLC: Q = (1/R) √(L/C); paralel RLC: Q = R √(C/L); bant genişliği = f0 / Q
  const qSeries = (R, L, Cap) => Math.sqrt(L / Cap) / R;
  const qParallel = (R, L, Cap) => R * Math.sqrt(Cap / L);
  // Değeri reaktanstan bileşene çevir: X > 0 → L (H), X < 0 → C (F)
  function reactanceToPart(X, f) {
    if (X > 0) return { type: "L", value: X / omega(f) };
    if (X < 0) return { type: "C", value: -1 / (omega(f) * X) };
    return { type: "none", value: 0 };
  }
  function susceptanceToPart(B, f) {
    if (B > 0) return { type: "C", value: B / omega(f) };
    if (B < 0) return { type: "L", value: -1 / (omega(f) * B) };
    return { type: "none", value: 0 };
  }

  /* ---------- Dalga boyu, hız faktörü ---------- */
  const wavelength = (f, vf = 1) => (c0 * vf) / f;
  const vfFromEr = (er) => 1 / Math.sqrt(er);
  // Elektriksel uzunluk: derece ve dalga boyu cinsinden
  const electricalLengthDeg = (len, f, vf = 1) => (360 * len) / wavelength(f, vf);
  const electricalLengthWl = (len, f, vf = 1) => len / wavelength(f, vf);
  // Dalganın hatta gidip gelme süresi (TDR): t = 2 l / (vf c)
  const roundTrip = (len, vf = 1) => (2 * len) / (vf * c0);
  const distanceFromRoundTrip = (t, vf = 1) => (t * vf * c0) / 2;

  /* ---------- İletim hattı ---------- */
  // Kayıpsız hat: Zin = Z0 (ZL + j Z0 tan βl) / (Z0 + j ZL tan βl); betaL radyan
  function zin(ZL, Z0, betaL) {
    ZL = C.of(ZL);
    const t = Math.tan(betaL);
    if (C.isInf(ZL)) { // açık devre: Zin = −j Z0 cot βl
      if (Math.abs(t) < 1e-15) return cx(Infinity, 0);
      return cx(0, -Z0 / t);
    }
    if (!isFinite(t)) return C.div(Z0 * Z0, ZL); // tam çeyrek dalga
    const num_ = C.add(ZL, cx(0, Z0 * t));
    const den = C.add(Z0, C.mul(cx(0, t), ZL));
    return C.scale(C.div(num_, den), Z0);
  }
  // Uzunluk dalga boyu cinsinden
  const zinWl = (ZL, Z0, lenWl) => zin(ZL, Z0, 2 * Math.PI * lenWl);
  // Kayıplı hat: γ = α + jβ (Np/m, rad/m); Zin = Z0 (ZL + Z0 tanh γl) / (Z0 + ZL tanh γl)
  function zinLossy(ZL, Z0, alpha, beta, len) {
    ZL = C.of(ZL); Z0 = C.of(Z0);
    const t = C.tanh(cx(alpha * len, beta * len));
    if (C.isInf(ZL)) return C.div(Z0, t);
    return C.mul(Z0, C.div(C.add(ZL, C.mul(Z0, t)), C.add(Z0, C.mul(ZL, t))));
  }
  // Hat boyunca Γ dönüşümü: Γ(d) = ΓL · e^(−2γd)
  // alphaD: α·d (Np), betaD: β·d (rad)
  function gammaAlong(GL, alphaD, betaD) {
    return C.mul(GL, C.exp(cx(-2 * alphaD, -2 * betaD)));
  }
  // Hat boyunca gerilim zarfı (kayıpsız, |V+| = 1): |V(d)| = |1 + Γ e^(−j2βd)|
  function envelope(GL, betaD) { return C.abs(C.add(1, C.mul(GL, C.polar(1, -2 * betaD)))); }

  /* ---------- Kablo kesitleri: karakteristik empedans ---------- */
  // Koaksiyel: Z0 = (η0 / 2π√εr) ln(D/d) ≈ (60 / √εr) ln(D/d) ≈ (138 / √εr) log10(D/d)
  const coaxZ0 = (D, d, er = 1) => (eta0 / (2 * Math.PI * Math.sqrt(er))) * Math.log(D / d);
  const coaxZ0log10 = (D, d, er = 1) => (138 / Math.sqrt(er)) * Math.log10(D / d);
  // Paralel çift hat (twin-lead): Z0 = (120 / √εr) arcosh(s/d); s merkezler arası, d tel çapı
  const twinZ0 = (s, d, er = 1) => (120 / Math.sqrt(er)) * Math.acosh(s / d);
  // Mikroşerit (Hammerstad, kalınlık ihmal): w şerit genişliği, h alt tabaka kalınlığı
  function microstripEeff(w, h, er) {
    const u = w / h;
    let e = (er + 1) / 2 + ((er - 1) / 2) / Math.sqrt(1 + 12 / u);
    if (u < 1) e += ((er - 1) / 2) * 0.04 * (1 - u) * (1 - u);
    return e;
  }
  function microstripZ0(w, h, er) {
    const u = w / h, ee = microstripEeff(w, h, er);
    if (u <= 1) return (60 / Math.sqrt(ee)) * Math.log(8 / u + u / 4);
    return (120 * Math.PI) / (Math.sqrt(ee) * (u + 1.393 + 0.667 * Math.log(u + 1.444)));
  }
  // Birim uzunluk L ve C'den Z0 ve hız
  const z0FromLC = (L, Cap) => Math.sqrt(L / Cap);
  const velocityFromLC = (L, Cap) => 1 / Math.sqrt(L * Cap);
  // Koaksiyel kablonun birim uzunluk değerleri
  const coaxL = (D, d) => (mu0 / (2 * Math.PI)) * Math.log(D / d);
  const coaxC = (D, d, er = 1) => (2 * Math.PI * eps0 * er) / Math.log(D / d);

  /* ---------- Deri etkisi ve kablo kaybı ---------- */
  // δ = 1 / √(π f μ σ)
  const skinDepth = (f, sigma = SIGMA_CU, mur = 1) => 1 / Math.sqrt(Math.PI * f * mu0 * mur * sigma);
  // Yüzey direnci Rs = 1 / (σ δ)
  const surfaceResistance = (f, sigma = SIGMA_CU) => 1 / (sigma * skinDepth(f, sigma));
  // Koaksiyel kablo zayıflaması (dB/m): iletken kaybı + dielektrik kaybı
  //  αc = Rs / (2 η ln(b/a)) · (1/a + 1/b)   (a, b: iç ve dış yarıçap; η = η0/√εr)
  //  αd = π f √εr tanδ / c
  //  D ve d metre cinsinden. İdeal düz iletkenler varsayılır; örgülü dış iletken ve çok telli iç iletken
  //  gerçek kabloda kaybı %20–40 artırır (veri sayfası değerleri bu yüzden biraz daha yüksektir).
  function coaxLoss(f, D, d, er, tand = 0, sigma = SIGMA_CU) {
    const a = d / 2, b = D / 2;
    const eta = eta0 / Math.sqrt(er);
    const ac = (surfaceResistance(f, sigma) / (2 * eta * Math.log(b / a))) * (1 / a + 1 / b);
    const ad = (Math.PI * f * Math.sqrt(er) * tand) / c0;
    const npToDb = 20 / Math.LN10; // 8,686
    return { conductor: ac * npToDb, dielectric: ad * npToDb, total: (ac + ad) * npToDb };
  }
  const dbToNeper = (dB) => dB / (20 / Math.LN10);

  /* ---------- Empedans uydurma ---------- */
  // L-ağı: yükü (ZL) gerçek Z0'a uydurur. Pozar 5.1. İki çözüm döner.
  // Her çözüm: { topology: "shunt-load" | "series-load", X (seri reaktans), B (paralel süseptans),
  //              series: parça, shunt: parça }
  // "shunt-load": paralel eleman yükün yanında, seri eleman kaynağa doğru (RL > Z0 iken).
  // "series-load": seri eleman yükün yanında, paralel eleman kaynak tarafında (RL < Z0 iken).
  function lMatch(ZL, Z0, f) {
    ZL = C.of(ZL);
    const RL = ZL.re, XL = ZL.im, out = [];
    if (RL <= 0) return out;
    if (RL > Z0) {
      const s = Math.sqrt(RL / Z0) * Math.sqrt(RL * RL + XL * XL - Z0 * RL);
      for (const sg of [1, -1]) {
        // XL + sg·s ≈ 0 iken (RL ≈ Z0) çıkarmada basamak kaybolur; eşdeğer kararlı biçim:
        // B = (Z0 − RL) / (Z0 (XL − sg·s)),  X = sg·s·Z0 / RL
        let B, X;
        if (Math.abs(XL + sg * s) >= Math.abs(XL - sg * s)) {
          B = (XL + sg * s) / (RL * RL + XL * XL);
          X = 1 / B + (XL * Z0) / RL - Z0 / (B * RL);
        } else {
          B = (Z0 - RL) / (Z0 * (XL - sg * s));
          X = (sg * s * Z0) / RL;
        }
        out.push({ topology: "shunt-load", X, B, series: reactanceToPart(X, f), shunt: susceptanceToPart(B, f) });
      }
    }
    if (RL < Z0 || out.length === 0) {
      const root_ = Math.sqrt(RL * (Z0 - RL));
      if (isFinite(root_)) for (const sg of [1, -1]) {
        const X = sg * root_ - XL;
        const B = (sg * Math.sqrt((Z0 - RL) / RL)) / Z0;
        out.push({ topology: "series-load", X, B, series: reactanceToPart(X, f), shunt: susceptanceToPart(B, f) });
      }
    }
    return out;
  }
  // L-ağının kaynak tarafından görünen empedansı (doğrulama için)
  function lMatchZin(ZL, sol) {
    ZL = C.of(ZL);
    const Xs = cx(0, sol.X), Yb = cx(0, sol.B);
    if (sol.topology === "shunt-load") {
      const yLoad = C.add(C.inv(ZL), Yb);
      return C.add(C.inv(yLoad), Xs);
    }
    const z1 = C.add(ZL, Xs);
    return C.inv(C.add(C.inv(z1), Yb));
  }
  // Çeyrek dalga dönüştürücü: Z1 = √(Z0 · RL)
  const quarterWaveZ = (Z0, RL) => Math.sqrt(Z0 * RL);
  // Tek paralel kısa devre stub (Pozar 5.2). d: yükten uzaklık (λ), l: stub uzunluğu (λ). İki çözüm.
  function singleStub(ZL, Z0, stubType = "short") {
    ZL = C.of(ZL);
    const RL = ZL.re, XL = ZL.im, out = [];
    let ts;
    if (Math.abs(RL - Z0) < 1e-9) ts = [-XL / (2 * Z0)];
    else {
      const r = Math.sqrt(RL * ((Z0 - RL) * (Z0 - RL) + XL * XL) / Z0);
      ts = [(XL + r) / (RL - Z0), (XL - r) / (RL - Z0)];
    }
    for (const t of ts) {
      let d = t >= 0 ? Math.atan(t) / (2 * Math.PI) : (Math.PI + Math.atan(t)) / (2 * Math.PI);
      const yin = C.inv(zinWl(ZL, Z0, d));
      const Bn = yin.im; // stub −Bn eklemeli
      // kısa devre stub: Y = −j cot(βl)/Z0 ; açık devre stub: Y = j tan(βl)/Z0
      let l;
      if (stubType === "short") { l = Math.atan(1 / (Bn * Z0)) / (2 * Math.PI); }
      else { l = Math.atan(-Bn * Z0) / (2 * Math.PI); }
      if (l < 0) l += 0.5;
      out.push({ d, l, B: Bn, yin });
    }
    return out;
  }
  // Stubun hat üzerine eklediği admitans
  function stubY(Z0, lenWl, stubType = "short") {
    const bl = 2 * Math.PI * lenWl;
    if (stubType === "short") return cx(0, -1 / (Z0 * Math.tan(bl)));
    return cx(0, Math.tan(bl) / Z0);
  }

  /* ---------- Antenler ---------- */
  // İnce, merkezden beslenen dipol, sinüs akım dağılımı. L dalga boyu cinsinden toplam uzunluk.
  // Alan deseni F(θ) = [cos(kL/2 · cosθ) − cos(kL/2)] / sinθ  (θ: telle açı)
  function dipolePattern(Lwl, th) {
    const kl = Math.PI * Lwl; // k·L/2
    const s = Math.sin(th);
    if (Math.abs(s) < 1e-9) return 0;
    return (Math.cos(kl * Math.cos(th)) - Math.cos(kl)) / s;
  }
  const _dipCache = {};
  function _dipoleIntegral(Lwl) {
    const key = Lwl.toFixed(5);
    if (_dipCache[key]) return _dipCache[key];
    // ∫0^π F² sinθ dθ (Simpson) ve F² en büyük değeri
    const N = 2000; let s = 0, fmax = 0;
    for (let i = 0; i <= N; i++) {
      const th = (Math.PI * i) / N;
      const F = dipolePattern(Lwl, th), v = F * F * Math.sin(th);
      s += v * (i === 0 || i === N ? 1 : i % 2 ? 4 : 2);
      if (F * F > fmax) fmax = F * F;
    }
    const r = { I: (s * Math.PI) / N / 3, fmax };
    _dipCache[key] = r;
    return r;
  }
  // Işıma direnci (akım tepesine göre): Rr = η/(2π) ∫ F² sinθ dθ. Yarım dalga → ≈ 73,1 Ω
  function dipoleRadiationResistance(Lwl) {
    // kısa dipolde de aynı integral geçerli; besleme direnci (dipoleFeedResistance) → 20π²(L/λ)²
    return (eta0 / (2 * Math.PI)) * _dipoleIntegral(Lwl).I;
  }
  // Besleme noktası direnci: Rin = Rr / sin²(kL/2) (L = λ'da sonsuza gider: gerilim beslemesi)
  function dipoleFeedResistance(Lwl) {
    const s = Math.sin(Math.PI * Lwl);
    return s * s < 1e-9 ? Infinity : dipoleRadiationResistance(Lwl) / (s * s);
  }
  // Yönlülük D = 2 F²max / ∫ F² sinθ dθ  (doğrusal); dBi için dB()
  function dipoleDirectivity(Lwl) {
    const { I, fmax } = _dipoleIntegral(Lwl);
    return (2 * fmax) / I;
  }
  // Çeyrek dalga monopol (mükemmel toprak): Rr yarım dalga dipolün yarısı, D iki katı
  const monopoleRadiationResistance = (hWl) => dipoleRadiationResistance(2 * hWl) / 2;
  const monopoleDirectivity = (hWl) => 2 * dipoleDirectivity(2 * hWl);
  // Yarım dalga dipol uzunluğu: L = k · λ/2 (k: uç etkisi kısaltma faktörü, tel antenlerde ≈ 0,95)
  const halfWaveDipoleLength = (f, k = 0.95) => (k * c0) / (2 * f);
  const DIPOLE_DBI = 10 * Math.log10(1.6409); // 2,15 dBi
  const dbiToDbd = (dbi) => dbi - DIPOLE_DBI;
  const dbdToDbi = (dbd) => dbd + DIPOLE_DBI;
  const dB = (x) => 10 * Math.log10(x);
  const fromDB = (d) => Math.pow(10, d / 10);
  // Yönlülük → etkin açıklık: Ae = D λ² / (4π)
  const effectiveAperture = (Dlin, f) => (Dlin * wavelength(f) ** 2) / (4 * Math.PI);
  // Parabolik çanak kazancı: G = η (π D / λ)²
  const dishGain = (diam, f, eff = 0.55) => eff * Math.pow((Math.PI * diam) / wavelength(f), 2);

  // Dizi faktörü: elemanlar [{x, y (λ), amp, phase (rad)}], yön açısı φ (düzlemde, x ekseninden)
  function arrayFactor(elems, phi) {
    let re = 0, im = 0;
    const cp = Math.cos(phi), sp = Math.sin(phi);
    for (const e of elems) {
      const ph = 2 * Math.PI * ((e.x || 0) * cp + (e.y || 0) * sp) + (e.phase || 0);
      const a = e.amp == null ? 1 : e.amp;
      re += a * Math.cos(ph); im += a * Math.sin(ph);
    }
    return Math.hypot(re, im);
  }
  // Doğrusal düzgün dizi: N eleman, aralık d (λ), ardışık faz farkı beta (rad); θ dizi eksenine dik yönden sapma
  function ulaFactor(N, d, beta, theta) {
    const psi = 2 * Math.PI * d * Math.sin(theta) + beta;
    const den = N * Math.sin(psi / 2);
    if (Math.abs(den) < 1e-12) return 1;
    return Math.abs(Math.sin((N * psi) / 2) / den);
  }
  // θ0 yönüne hüzme için gereken faz farkı: β = −2π d sin θ0
  const steerPhase = (d, theta0) => -2 * Math.PI * d * Math.sin(theta0);

  // Polarizasyon uyumsuzluğu: alınan güç oranı = cos²(Δ)
  const polarizationLoss = (deltaRad) => Math.cos(deltaRad) ** 2;

  // Yakın / uzak alan sınırları
  const reactiveNearField = (f) => wavelength(f) / (2 * Math.PI);
  const fraunhofer = (D, f) => (2 * D * D) / wavelength(f);

  /* ---------- Bağlantı bütçesi ---------- */
  // Serbest uzay yol kaybı (dB) = 20 log10(4π d f / c)
  const fspl = (d, f) => 20 * Math.log10((4 * Math.PI * d * f) / c0);
  // Friis (dBm): Pr = Pt + Gt + Gr − FSPL − kayıplar
  function friis({ ptDbm, gtDbi = 0, grDbi = 0, d, f, lossDb = 0 }) {
    return ptDbm + gtDbi + grDbi - fspl(d, f) - lossDb;
  }
  // Doğrusal Friis: Pr/Pt = Gt Gr (λ / 4π d)²
  const friisRatio = (gt, gr, d, f) => gt * gr * Math.pow(wavelength(f) / (4 * Math.PI * d), 2);
  const wToDbm = (w) => 10 * Math.log10(w * 1000);
  const dbmToW = (dbm) => Math.pow(10, dbm / 10) / 1000;
  // Isıl gürültü tabanı: −174 dBm/Hz + 10 log10(B) + NF
  const noiseFloorDbm = (bw, nf = 0) => -174 + 10 * Math.log10(bw) + nf;
  // Uzak alanda güç yoğunluğu: S = P G / (4π r²) (W/m²)
  const powerDensity = (pW, gLin, r) => (pW * gLin) / (4 * Math.PI * r * r);

  const RF = {
    c0, mu0, eps0, eta0, SIGMA_CU, cx, C,
    gamma, zFromGamma, vswr, gammaFromVswr, returnLoss, mismatchLoss, powerDelivered, zSeries, zParallel,
    omega, xL, xC, zL, zC, resonance, qSeries, qParallel, reactanceToPart, susceptanceToPart,
    wavelength, vfFromEr, electricalLengthDeg, electricalLengthWl, roundTrip, distanceFromRoundTrip,
    zin, zinWl, zinLossy, gammaAlong, envelope,
    coaxZ0, coaxZ0log10, twinZ0, microstripZ0, microstripEeff, z0FromLC, velocityFromLC, coaxL, coaxC,
    skinDepth, surfaceResistance, coaxLoss, dbToNeper,
    lMatch, lMatchZin, quarterWaveZ, singleStub, stubY,
    dipolePattern, dipoleRadiationResistance, dipoleFeedResistance, dipoleDirectivity,
    monopoleRadiationResistance, monopoleDirectivity, halfWaveDipoleLength, DIPOLE_DBI, dbiToDbd, dbdToDbi,
    dB, fromDB, effectiveAperture, dishGain, arrayFactor, ulaFactor, steerPhase, polarizationLoss,
    reactiveNearField, fraunhofer, fspl, friis, friisRatio, wToDbm, dbmToW, noiseFloorDbm, powerDensity,
  };
  // Yaygın kablolar (üretici veri sayfaları: Belden 9201, 8267, 1694A; Times LMR-400).
  // d: iç iletken çapı, D: dielektrik dış çapı (mm), εr = 1/vf², z0: anma değeri.
  // Örgülü (çok telli) iç iletkenin etkin çapı dış çapının ~%94'üdür (7 telli); dEff bunu hesaba katar.
  RF.CABLES = {
    "RG-58": { d: 0.81, dEff: 0.81, D: 2.95, er: 2.25, vf: 0.66, z0: 50, note: "tek telli iç iletken, katı PE" },
    "RG-213": { d: 2.26, dEff: 2.26 * 0.939, D: 7.24, er: 2.25, vf: 0.66, z0: 50, note: "7 telli iç iletken, katı PE" },
    "RG-6": { d: 1.02, dEff: 1.02, D: 4.57, er: 1 / (0.83 * 0.83), vf: 0.83, z0: 75, note: "köpük PE" },
    "LMR-400": { d: 2.74, dEff: 2.74, D: 7.24, er: 1 / (0.85 * 0.85), vf: 0.85, z0: 50, note: "köpük PE" },
  };
  // Dielektrik malzemeler: εr ve hız faktörü
  RF.DIELECTRICS = {
    hava: { er: 1.0006, label: "Hava" },
    pe: { er: 2.25, label: "Katı PE" },
    foam: { er: 1.45, label: "Köpük PE" },
    ptfe: { er: 2.1, label: "PTFE (teflon)" },
    fr4: { er: 4.4, label: "FR-4 (devre kartı)" },
  };
  if (typeof module !== "undefined" && module.exports) module.exports = RF;
  else root.RF = RF;
})(typeof window !== "undefined" ? window : globalThis);
