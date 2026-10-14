/* rf.js birim testleri. Çalıştırma: node tests/rf.test.js */
const RF = require("../js/rf.js");
const { C, cx } = RF;
let pass = 0, fail = 0;
function near(name, got, want, tol) {
  const ok = Math.abs(got - want) <= tol;
  ok ? pass++ : fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}: ${+got.toFixed(6)} (beklenen ${want} ± ${tol})`);
}
function cnear(name, got, want, tol) {
  near(name + " (gerçek)", got.re, want.re, tol);
  near(name + " (sanal)", got.im, want.im, tol);
}

// Γ, VSWR, geri dönüş kaybı
near("50 Ω hatta 50 Ω yük: |Γ|", C.abs(RF.gamma(50, 50)), 0, 1e-12);
near("50 Ω hatta 50 Ω yük: VSWR", RF.vswr(RF.gamma(50, 50)), 1, 1e-12);
near("50 Ω hatta 100 Ω yük: Γ", RF.gamma(100, 50).re, 1 / 3, 1e-12);
near("50 Ω hatta 100 Ω yük: VSWR", RF.vswr(RF.gamma(100, 50)), 2, 1e-12);
near("50 Ω hatta 25 Ω yük: Γ", RF.gamma(25, 50).re, -1 / 3, 1e-12);
near("Kısa devre: Γ", RF.gamma(0, 50).re, -1, 1e-12);
near("Açık devre: Γ", RF.gamma(Infinity, 50).re, 1, 1e-12);
near("VSWR 2 → geri dönüş kaybı (dB)", RF.returnLoss(1 / 3), 9.542, 1e-3);
near("VSWR 2 → uyumsuzluk kaybı (dB)", RF.mismatchLoss(1 / 3), 0.512, 1e-3);
near("VSWR 2 → yüke ulaşan güç", RF.powerDelivered(1 / 3), 8 / 9, 1e-12);
cnear("Γ → Z geri dönüşü", RF.zFromGamma(RF.gamma(cx(30, -40), 50), 50), cx(30, -40), 1e-9);

// Hat dönüşümleri
near("Çeyrek dalga: Zin = Z0²/ZL (50 Ω, 100 Ω)", RF.zinWl(100, 50, 0.25).re, 25, 1e-6);
near("Çeyrek dalga: Zin = Z0²/ZL (75 Ω, 50 Ω)", RF.zinWl(50, 75, 0.25).re, 112.5, 1e-6);
cnear("Yarım dalga hat empedansı aynen tekrarlar", RF.zinWl(cx(30, 20), 50, 0.5), cx(30, 20), 1e-9);
near("Çeyrek dalga kısa devre → açık devre", Math.abs(RF.zinWl(0, 50, 0.2499999).im) > 1e5 ? 1 : 0, 1, 0);
near("λ/8 kısa devre stub: +j50", RF.zinWl(0, 50, 0.125).im, 50, 1e-9);
near("λ/8 açık devre stub: −j50", RF.zinWl(Infinity, 50, 0.125).im, -50, 1e-9);
cnear("Kayıplı hat α=0 kayıpsızla aynı", RF.zinLossy(cx(30, 20), 50, 0, 2 * Math.PI, 0.13), RF.zinWl(cx(30, 20), 50, 0.13), 1e-9);
near("Çok kayıplı uzun hat girişte Z0 görünür", RF.zinLossy(0, 50, 1, 2 * Math.PI, 10).re, 50, 1e-6);
near("Çeyrek dalga dönüştürücü Z1 (50 → 100 Ω)", RF.quarterWaveZ(50, 100), 70.7107, 1e-4);

// Kablo kesitleri
near("Koaks formülleri tutarlı (60 ln ↔ 138 log10)", RF.coaxZ0(7.24, 2.26, 2.25), RF.coaxZ0log10(7.24, 2.26, 2.25), 0.1);
for (const name of ["RG-58", "RG-213", "LMR-400"]) {
  const k = RF.CABLES[name];
  near(`${name} Z0 (Ω)`, RF.coaxZ0log10(k.D, k.dEff, k.er), 50, 2.5);
}
near("RG-6 Z0 (Ω)", RF.coaxZ0(RF.CABLES["RG-6"].D, RF.CABLES["RG-6"].dEff, RF.CABLES["RG-6"].er), 75, 2.5);
near("Koaks L ve C'den Z0 = √(L/C)", RF.z0FromLC(RF.coaxL(7.24, 2.26), RF.coaxC(7.24, 2.26, 2.25)), RF.coaxZ0(7.24, 2.26, 2.25), 1e-6);
near("Koaks L ve C'den hız faktörü (PE)", RF.velocityFromLC(RF.coaxL(7, 2), RF.coaxC(7, 2, 2.25)) / RF.c0, 1 / 1.5, 1e-6);
near("300 Ω çift hat (s/d ≈ 6,13, hava)", RF.twinZ0(6.13, 1), 300, 3);
near("Mikroşerit FR-4 (εr 4,4; w/h = 1,9) ≈ 50 Ω", RF.microstripZ0(1.9, 1, 4.4), 50, 1.5);
near("Mikroşerit FR-4 εeff", RF.microstripEeff(1.9, 1, 4.4), 3.33, 0.05);

// Dalga boyu
near("145 MHz dalga boyu (m)", RF.wavelength(145e6), 2.0675, 1e-3);
near("PE kabloda hız faktörü", RF.vfFromEr(2.25), 0.6667, 1e-4);
near("Elektriksel uzunluk: 1 m RG-58, 50 MHz (°)", RF.electricalLengthDeg(1, 50e6, 0.66), 90.95, 0.05);
near("TDR: 100 ns gidiş-dönüş, vf 0,66 → mesafe (m)", RF.distanceFromRoundTrip(100e-9, 0.66), 9.893, 1e-3);

// Deri etkisi ve kayıp
near("Bakırda deri derinliği 1 MHz (µm)", RF.skinDepth(1e6) * 1e6, 66.1, 0.3);
near("Bakırda deri derinliği 100 MHz (µm)", RF.skinDepth(100e6) * 1e6, 6.61, 0.03);
near("Bakırda deri derinliği 50 Hz (mm)", RF.skinDepth(50) * 1e3, 9.35, 0.05);
// RG-213 kuramsal kaybı 100 MHz: iletken ≈ 4,5 + dielektrik ≈ 0,27 dB/100 m. Belden 8267 veri sayfası 6,2 dB/100 m
// (örgü ve çok telli iletken kaybı artırır); kuramsal değer bundan düşük ama aynı mertebede olmalı.
const l213 = RF.coaxLoss(100e6, 7.24e-3, 2.26e-3, 2.25, 2e-4).total * 100;
near("RG-213 kuramsal kaybı 100 MHz (dB/100 m)", l213, 4.77, 0.05);
near("Kayıp frekansın karekökü gibi artar (iletken kaybı, 400/100 MHz oranı)", RF.coaxLoss(400e6, 7.24e-3, 2.26e-3, 2.25, 0).total / RF.coaxLoss(100e6, 7.24e-3, 2.26e-3, 2.25, 0).total, 2, 1e-9);

// Rezonans
near("Rezonans 1 µH, 100 pF (MHz)", RF.resonance(1e-6, 100e-12) / 1e6, 15.915, 1e-3);
near("Seri RLC Q (R=10, 1 µH, 100 pF)", RF.qSeries(10, 1e-6, 100e-12), 10, 1e-9);
near("XL 1 µH @ 10 MHz", RF.xL(1e-6, 10e6), 62.83, 0.01);
near("XC 100 pF @ 10 MHz", RF.xC(100e-12, 10e6), -159.15, 0.01);

// L-ağı: her çözüm 50 Ω'a uydurmalı
for (const ZL of [cx(200, -100), cx(10, 15), cx(100, 50), cx(25, 0), cx(50.0000001, 80), cx(50.001, -30)]) {
  const sols = RF.lMatch(ZL, 50, 14e6);
  near(`L-ağı çözüm sayısı ZL=${ZL.re}${ZL.im >= 0 ? "+" : ""}${ZL.im}j`, sols.length, 2, 0);
  sols.forEach((s, i) => cnear(`  çözüm ${i + 1} Zin`, RF.lMatchZin(ZL, s), cx(50, 0), 1e-6));
}
// Tek stub
for (const ZL of [cx(60, -80), cx(25, 0), cx(150, 40)]) {
  RF.singleStub(ZL, 50, "short").forEach((s, i) => {
    const y = C.add(C.inv(RF.zinWl(ZL, 50, s.d)), RF.stubY(50, s.l, "short"));
    cnear(`Tek stub ZL=${ZL.re}${ZL.im >= 0 ? "+" : ""}${ZL.im}j çözüm ${i + 1} Y·Z0`, C.scale(y, 50), cx(1, 0), 1e-6);
  });
}

// Antenler
near("Yarım dalga dipol ışıma direnci (Ω)", RF.dipoleRadiationResistance(0.5), 73.1, 0.2);
near("Yarım dalga dipol yönlülüğü (dBi)", RF.dB(RF.dipoleDirectivity(0.5)), 2.15, 0.01);
near("Kısa dipol besleme direnci 0,05λ (Ω) ≈ 20π²(L/λ)²", RF.dipoleFeedResistance(0.05), 20 * Math.PI ** 2 * 0.0025, 0.01);
near("Besleme direnci 0,1λ civarında sürekli", RF.dipoleFeedResistance(0.0999) / RF.dipoleFeedResistance(0.1001), 1, 0.01);
near("Kısa dipol yönlülüğü (dBi)", RF.dB(RF.dipoleDirectivity(0.05)), 1.76, 0.01);
near("Tam dalga dipol ışıma direnci (Ω, Balanis ≈ 199)", RF.dipoleRadiationResistance(1), 199, 0.5);
near("Tam dalga dipol yönlülüğü (Kraus 2,41)", RF.dipoleDirectivity(1), 2.41, 0.01);
near("1,25λ dipol yönlülüğü (dBi, ≈ 5,2)", RF.dB(RF.dipoleDirectivity(1.25)), 5.16, 0.05);
near("Çeyrek dalga monopol ışıma direnci (Ω)", RF.monopoleRadiationResistance(0.25), 36.5, 0.2);
near("Çeyrek dalga monopol yönlülüğü (dBi)", RF.dB(RF.monopoleDirectivity(0.25)), 5.16, 0.02);
near("dBi → dBd", RF.dbiToDbd(8.15), 6.0, 0.01);
near("Yarım dalga dipol 145 MHz, k=0,95 (cm)", RF.halfWaveDipoleLength(145e6) * 100, 98.2, 0.1);
near("Dipol deseni ekseninde sıfır", RF.dipolePattern(0.5, 0), 0, 1e-12);
near("2 elemanlı yayın yönü dizisi, λ/2: yan tarafta tepe", RF.ulaFactor(2, 0.5, 0, 0), 1, 1e-12);
near("2 elemanlı λ/2 dizi: eksende sıfır", RF.ulaFactor(2, 0.5, 0, Math.PI / 2), 0, 1e-9);
near("Hüzme yönlendirme: 30° için faz ve tepe", RF.ulaFactor(8, 0.5, RF.steerPhase(0.5, Math.PI / 6), Math.PI / 6), 1, 1e-9);
near("Polarizasyon 45° → güç oranı", RF.polarizationLoss(Math.PI / 4), 0.5, 1e-12);
near("Polarizasyon 90° → güç oranı", RF.polarizationLoss(Math.PI / 2), 0, 1e-12);

// Bağlantı bütçesi
near("FSPL 1 km, 2,4 GHz (dB)", RF.fspl(1000, 2.4e9), 100.05, 0.02);
near("FSPL 10 km, 145 MHz (dB)", RF.fspl(10e3, 145e6), 95.67, 0.02);
// Friis örneği: 1 W (30 dBm), iki dipol (2,15 dBi), 10 km, 145 MHz → 30 + 4,3 − 95,67 = −61,37 dBm
near("Friis örneği (dBm)", RF.friis({ ptDbm: 30, gtDbi: 2.15, grDbi: 2.15, d: 10e3, f: 145e6 }), -61.37, 0.02);
near("Friis doğrusal ve dB tutarlı", RF.wToDbm(1 * RF.friisRatio(RF.fromDB(2.15), RF.fromDB(2.15), 10e3, 145e6)), -61.37, 0.02);
near("1 W = 30 dBm", RF.wToDbm(1), 30, 1e-12);
near("Gürültü tabanı 12,5 kHz, NF 0 (dBm)", RF.noiseFloorDbm(12.5e3), -133.03, 0.01);

console.log(`\n${pass} geçti, ${fail} kaldı`);
process.exit(fail ? 1 : 0);
