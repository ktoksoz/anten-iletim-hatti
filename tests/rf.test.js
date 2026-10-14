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

// Bölümlerden taşınan yardımcılar
near("Si(π) (A–S 5.1)", RF.Si(Math.PI), 1.851937, 1e-6);
near("Ci(π) (A–S 5.1)", RF.Ci(Math.PI), 0.073668, 1e-6);
near("Si(25) (asimptotik dal)", RF.Si(25), 1.531477, 1e-5);
near("Si / Ci 20'de dallar arası süreklilik", RF.Si(19.9999) - RF.Si(20.0001), 0, 1e-4);
near("J1(1)", RF.besselJ1(1), 0.4400506, 1e-6);
near("J1'in ilk sıfırı 3,8317", RF.besselJ1(3.8317), 0, 1e-4);
near("J1(10) (polinom dalı)", RF.besselJ1(10), 0.0434727, 1e-6);
near("Dairesel açıklık: 2J1(u)/u, u → 0", RF.circularAperture(1e-12), 1, 1e-12);
near("Yarım dalga dipol reaktansı (Ω, Balanis +42,5)", RF.dipoleFeedReactance(0.5, 1e-3), 42.5, 0.1);
const lr = RF.dipoleResonantLength(1e-3);
near("İnce dipol rezonans boyu (λ) 0,47–0,49 aralığında", lr > 0.47 && lr < 0.49 ? 1 : 0, 1, 0);
near("Rezonans boyunda reaktans ≈ 0", RF.dipoleFeedReactance(lr, 1e-3), 0, 0.01);
cnear("Karşılıklı empedans d = 0,5λ (Balanis)", RF.mutualZ(0.5), cx(-12.53, -29.93), 0.05);
cnear("Karşılıklı empedans d → 0 = öz empedans", RF.mutualZ(1e-4), cx(73.1, 42.5), 0.1);
near("Seri RLC dipol: rezonansta X = 0", RF.dipoleSeriesRLC(145e6, 145e6, 10).im, 0, 1e-9);
// deri etkisi: kalın telde R_ac/R_dc ≈ a/(2δ) + 1/4; ince telde ≈ 1
const dS = RF.skinDepth(100e6);
near("AC/DC oranı 2 mm tel, 100 MHz ≈ a/2δ + 1/4", RF.acDcRatio(1e-3, dS), 1e-3 / (2 * dS) + 0.25, 0.3);
near("AC/DC oranı 2 mm tel, 50 Hz ≈ 1", RF.acDcRatio(1e-3, RF.skinDepth(50)), 1, 0.01);
near("Akım yoğunluğu yüzeyde 1", RF.C.abs(RF.currentDensityRatio(1e-3, 1e-3, dS)), 1, 1e-12);
near("Akım yoğunluğu bir δ içeride ≈ 1/e", RF.C.abs(RF.currentDensityRatio(1e-3 - dS, 1e-3, dS)), Math.exp(-1), 0.01);
// koaks optimumları (hava): en az kayıp ≈ 76,7 Ω, en çok güç ≈ 30 Ω
const co = RF.coaxOptimum(1);
near("Koaks en düşük kayıp Z0 (hava)", co.lossZ0, 76.7, 0.2);
near("Koaks en yüksek güç Z0 (hava)", co.powerZ0, 30.0, 0.2);
near("Koaks en yüksek güç D/d = √e", co.powerDd, Math.sqrt(Math.E), 1e-3);
// çanak ve helis
near("Çanak hüzmesi 1 m, 10 GHz (°)", RF.dishBeamwidthDeg(1, 10e9), 2.098, 0.01);
near("Helis yönlülüğü N=6, C=1λ, S=0,25λ", RF.helixDirectivity(6, 1, 0.25), 22.5, 1e-12);
// polarizasyon (Jones)
near("Dikey–yatay uyum", RF.polarizationMatch(RF.jones("v", 0), RF.jones("v", Math.PI / 2)), 0, 1e-12);
near("Doğrusal 30° = cos²", RF.polarizationMatch(RF.jones("v", 0), RF.jones("v", Math.PI / 6)), RF.polarizationLoss(Math.PI / 6), 1e-12);
near("Dairesel–doğrusal = 1/2 (3 dB)", RF.polarizationMatch(RF.jones("r"), RF.jones("v", 0.7)), 0.5, 1e-12);
near("Sağ el–sağ el = 1", RF.polarizationMatch(RF.jones("r"), RF.jones("r")), 1, 1e-12);
near("Sağ el–sol el = 0", RF.polarizationMatch(RF.jones("r"), RF.jones("l")), 0, 1e-12);
// ICNIRP 2020 genel halk
near("ICNIRP 145 MHz (W/m²)", RF.icnirpPublicDensity(145e6), 2, 0);
near("ICNIRP 1 GHz (W/m²)", RF.icnirpPublicDensity(1e9), 5, 0);
near("ICNIRP 5 GHz (W/m²)", RF.icnirpPublicDensity(5e9), 10, 0);
near("ICNIRP 10 MHz tanımsız", isNaN(RF.icnirpPublicDensity(10e6)) ? 1 : 0, 1, 0);

console.log(`\n${pass} geçti, ${fail} kaldı`);
process.exit(fail ? 1 : 0);
