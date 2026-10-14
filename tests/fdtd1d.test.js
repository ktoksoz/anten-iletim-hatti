/* 1B FDTD doğrulaması: yansıma katsayısını darbe genliklerinden ölçer. Çalıştırma: node tests/fdtd1d.test.js */
const { Sim } = require("../js/fdtd1d.js");
const RF = require("../js/rf.js");
let pass = 0, fail = 0;
function near(name, got, want, tol) {
  const ok = Math.abs(got - want) <= tol; ok ? pass++ : fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}: ${+got.toFixed(5)} (beklenen ${+want.toFixed(5)} ± ${tol})`);
}
// Darbe yüke çarpıp döndükten sonra, hattın ortasında yansıyan darbenin tepe değeri / gelen tepe
function measure(loadFn, Z0 = 50) {
  const N = 400, s = new Sim({ N, Z0, Rs: Z0 });
  s.source = { kind: "pulse", width: 20, amp: 1 };
  loadFn(s);
  let inc = 0, refl = 0, reflSigned = 0;
  for (let t = 0; t < 2 * N + 60; t++) {
    s.step(1);
    const vf = s.fwd[N / 2], vr = s.rev[N / 2];
    if (Math.abs(vf) > Math.abs(inc)) inc = vf;
    if (Math.abs(vr) > Math.abs(refl)) { refl = Math.abs(vr); reflSigned = vr; }
  }
  return { inc, refl, g: reflSigned / inc };
}
const m = measure((s) => (s.load = { R: 50 }));
near("Gelen darbe genliği (uyumlu kaynak)", m.inc, 1, 0.01);
near("Uyumlu yük (50 Ω): yansıma", m.g, 0, 1e-3);
near("Kısa devre: Γ = −1", measure((s) => (s.load = { R: 0 })).g, -1, 0.01);
near("Açık devre: Γ = +1", measure((s) => (s.load = { open: true })).g, 1, 0.01);
near("100 Ω yük: Γ = +1/3", measure((s) => (s.load = { R: 100 })).g, 1 / 3, 0.005);
near("25 Ω yük: Γ = −1/3", measure((s) => (s.load = { R: 25 })).g, -1 / 3, 0.005);
near("75 Ω hatta 75 Ω yük: yansıma", measure((s) => (s.load = { R: 75 }), 75).g, 0, 1e-3);

// Sürekli sinüs, karmaşık yük: kararlı durumda yük gerilimi/akımı → ölçülen Γ, rf.js ile karşılaştır
function sineGamma(R, X) {
  const N = 300, s = new Sim({ N, Z0: 50, Rs: 50 });
  s.source = { kind: "sine", period: 60, amp: 1 };
  s.setLoadZ(R, X);
  for (let t = 0; t < 3000; t++) s.step(1);
  // fazör kuralı e^(jωt): X = Σ x·e^(−jωt). Bir periyot boyunca ileri ve yansıyan dalganın düğüm N/2'deki karmaşık genliği (DFT)
  let fr = 0, fi = 0, rr = 0, ri = 0;
  for (let t = 0; t < 60; t++) {
    s.step(1);
    const ph = (2 * Math.PI * t) / 60;
    fr += s.fwd[N] * Math.cos(ph); fi -= s.fwd[N] * Math.sin(ph);
    rr += s.rev[N] * Math.cos(ph); ri -= s.rev[N] * Math.sin(ph);
  }
  return RF.C.div(RF.cx(rr, ri), RF.cx(fr, fi));
}
for (const [R, X] of [[50, 50], [25, -40], [100, 0], [10, 80]]) {
  const g = sineGamma(R, X), want = RF.gamma(RF.cx(R, X), 50);
  near(`Sinüs, ZL = ${R}${X >= 0 ? "+" : "−"}j${Math.abs(X)}: |Γ|`, RF.C.abs(g), RF.C.abs(want), 0.02);
  near(`Sinüs, ZL = ${R}${X >= 0 ? "+" : "−"}j${Math.abs(X)}: ∠Γ (°)`, (RF.C.arg(g) * 180) / Math.PI, (RF.C.arg(want) * 180) / Math.PI, 3);
}
// TDR: hattın ortasında 50 → 25 Ω basamağı; yankı Γ = −1/3 ve doğru zamanda dönmeli
{
  const N = 400, s = new Sim({ N, Z0: 50, Rs: 50 });
  s.source = { kind: "pulse", width: 16, amp: 1 };
  s.load = { R: 25 };
  s.setProfile((k) => (k < 200 ? 50 : 25));
  let best = 0, bt = 0;
  for (let t = 0; t < 2 * N; t++) { s.step(1); const v = s.rev[0 + 1]; if (Math.abs(v) > Math.abs(best)) { best = v; bt = t; } }
  near("TDR: 50→25 Ω basamağından yankı genliği", best, -1 / 3, 0.01);
  // darbe tepesi t0 = 2,2·16 ≈ 35 adımda girer; 200 hücre gidiş-dönüş 400 adım
  near("TDR: yankının dönüş zamanı (adım)", bt, 35 + 400, 2);
}
// Hız: adım/sn
const s = new Sim({ N: 600 }); s.source = { kind: "sine", period: 60 };
const t0 = process.hrtime.bigint(); for (let i = 0; i < 20000; i++) s.step(1);
const us = Number(process.hrtime.bigint() - t0) / 1e3 / 20000;
console.log(`hız: 600 hücre için adım başına ${us.toFixed(2)} µs (kare başına 4 adımda ${(us * 4 / 1000).toFixed(3)} ms)`);
console.log(`\n${pass} geçti, ${fail} kaldı`);
process.exit(fail ? 1 : 0);
