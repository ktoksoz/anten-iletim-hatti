/* 2B FDTD doğrulaması (dalga boyu başına 20 hücre): kararlılık, sönümleyici sınırın yansıması, dalga hızı. Çalıştırma: node tests/fdtd2d.test.js */
const { Grid } = require("../js/fdtd2d.js");
let pass = 0, fail = 0;
function check(name, ok, info) { ok ? pass++ : fail++; console.log(`${ok ? "✓" : "✗"} ${name}: ${info}`); }
const energy = (g) => { let e = 0; for (let k = 0; k < g.Hz.length; k++) e += g.Hz[k] ** 2 + g.Ex[k] ** 2 + g.Ey[k] ** 2; return e; };

// 1) Kısa dalga paketi ortadan yayılsın; sınıra çarpıp geri dönen enerji küçük olmalı
{
  const g = new Grid(240, 240, { pml: 24 });
  g.sources.push({ kind: "burst", x: 120, y: 120, t0: 40, width: 12, period: 16, amp: 1 });
  let peak = 0;
  for (let t = 0; t < 220; t++) { g.step(1); peak = Math.max(peak, energy(g)); }
  // bu noktada paket sınıra ulaştı ve emildi; kalan enerji / tepe
  for (let t = 0; t < 400; t++) g.step(1);
  const rest = energy(g) / peak;
  check("Sönümleyici sınır: 600 adım sonra kalan enerji oranı < %0,5", rest < 5e-3, rest.toExponential(2));
}
// 2) Dalga hızı: düzlem dalga paketi (bütün sütun boyunca kaynak), tepe c·t kadar ilerler (S = 0,5 → 0,5 hücre/adım)
{
  const nx = 500, ny = 80, g = new Grid(nx, ny, { pml: 10 });
  for (let y = 0; y < ny; y++) g.sources.push({ kind: "burst", x: 40, y, t0: 60, width: 25, period: 40, amp: 1 });
  const arr = { 150: [0, 0], 350: [0, 0] };
  for (let t = 0; t < 1000; t++) {
    g.step(1);
    for (const x of [150, 350]) { const v = Math.abs(g.Hz[40 * nx + x]); if (v > arr[x][0]) arr[x] = [v, t]; }
  }
  const v = 200 / (arr[350][1] - arr[150][1]);
  check("Dalga hızı, λ = 20 hücre (hücre/adım, beklenen 0,5)", Math.abs(v - 0.5) < 0.01, v.toFixed(4));
}
// 3) Mükemmel iletken duvar: arkasına alan geçmez
{
  const g = new Grid(200, 200, { pml: 20 });
  g.addPEC(120, 20, 122, 180);
  g.sources.push({ kind: "gap", x: 80, y: 100, dir: "y", amp: 1, period: 20, ramp: 40 });
  for (let t = 0; t < 600; t++) g.step(1);
  const front = g.E2[100 * 200 + 100], behind = g.E2[100 * 200 + 150];
  check("PEC duvarın arkası gölgede (|E|² oranı < %2)", behind / front < 0.02, (behind / front).toExponential(2));
}
// 4) Hız
{
  const g = new Grid(300, 200, { pml: 20 });
  g.sources.push({ kind: "gap", x: 150, y: 100, dir: "y", amp: 1, period: 24 });
  const t0 = process.hrtime.bigint(); for (let i = 0; i < 400; i++) g.step(1);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6 / 400;
  const t1 = process.hrtime.bigint(); let segs = 0; for (let i = 0; i < 20; i++) segs = g.contours([-0.4, -0.2, 0, 0.2, 0.4, 0.6]).n * 4;
  const cms = Number(process.hrtime.bigint() - t1) / 1e6 / 20;
  console.log(`hız: 300×200 ızgara, adım başına ${ms.toFixed(3)} ms; 6 eş-değer eğrisi ${cms.toFixed(2)} ms (${segs / 4} parça)`);
}
console.log(`\n${pass} geçti, ${fail} kaldı`);
process.exit(fail ? 1 : 0);
