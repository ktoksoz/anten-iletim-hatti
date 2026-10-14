# Bölüm yazım kılavuzu

"Kablodan Boşluğa" (anten, iletim hattı ve empedans üzerine Türkçe, etkileşimli sunum) için bölüm yazanların uyacağı
kurallar. Önce `PLAN.md` dosyasını (tasarım ve slayt listesi) oku. Sonra şu dosyaları oku:
`js/lib.js`, `js/viz.js`, `js/rf.js`, `js/fdtd1d.js`, `js/fdtd2d.js`, `js/smith.js`, `js/demos/ch0.js` (örnek demo),
`tools/parts/ch0.html` (örnek slayt), `css/style.css`, `css/demos.css`.

## Dosya sahipliği (paralel çalışılıyor: başkasının dosyasına dokunma)

Her bölüm yalnızca kendi dosyalarını yazar (N = bölüm dosya adı: `ch1`, `ch6b` …):
- `tools/parts/N.html`: slaytlar (`<section class="slide" ...>`)
- `js/demos/N.js`: demolar + hayalet el senaryoları + (gerekirse) ek sözlük terimleri
- `css/demos-N.css`: bölüme özel stiller (gerekirse)
- `tools/parts/N.narration.json`: anlatım metinleri `{ "slayt-id": "metin", ... }`

**Ortak dosyaları değiştirme:** `index.html`, `tools/index.template.html`, `js/lib.js`, `js/viz.js`, `js/rf.js`,
`js/fdtd1d.js`, `js/fdtd2d.js`, `js/smith.js`, `js/app.js`, `js/guide.js`, `js/glossary.js`, `js/narrator.js`,
`css/style.css`, `css/demos.css`, `tests/*`. Bunlarda eksik ya da hata görürsen raporunda yaz; gerekirse kendi
dosyanda yerel bir yardımcı yaz. `rf.js`'te olmayan bir formüle ihtiyacın olursa kendi dosyanda yaz, yorumda kaynağını
belirt ve raporda "rf.js'e taşınmalı" diye bildir. `index.html`'i elle düzenleme; `python3 tools/assemble.py` kurar.

## Slayt HTML'i

```html
<section class="slide" data-chapter="3" data-demo="hatSim" id="hat-simulasyonu">
  <div class="text">
    <h2>Kablodaki yankı</h2>
    <p class="lead">Tek cümlelik, merak uyandıran giriş.</p>
    <p>Açıklama: önce sezgi (ip, su borusu, yankı), formül değil.</p>
    <details class="more"><summary>Daha fazla: formül</summary>
      <p>Formüller ve ayrıntılar yalnızca burada.</p>
      <span class="formula">Γ = (Z_L − Z₀) / (Z_L + Z₀)</span>
    </details>
    <p class="try">Kullanıcının ilk yapacağı hamle, tek cümle.</p>
  </div>
  <div class="stage"></div>
  <aside class="notes"><ul>
    <li>Sunucu notu: sunarken söylenecek ek bilgi, olası soru ve cevaplar.</li>
  </ul></aside>
</section>
```

- `data-chapter`: bölüm numarası (0–7; ch6b de 6). Bölüm etiketi otomatik eklenir, sen yazma.
- `data-demo`: `Demos.<ad>` fonksiyonunun adı (bütün sitede benzersiz olmalı; bölüm önekiyle adlandır: `ch3Line`).
  `id`: PLAN.md'deki slayt kimliği (değiştirme).
- Tüm genişliği kaplayan sahne gerekiyorsa `class="slide wide"` (metin üstte, sahne altta).
- Metin sütunu kısa: bir `lead` ve 2–4 kısa paragraf ya da liste, en fazla 1–2 `details.more`, ardından bir `.try`.
  1440×860'ta kaydırma gerektirmemeli; 1180×820'de en fazla az bir kaydırma.
- Renk dili metinde de geçerli: `<span class="c-fwd">ileri dalga</span>`, `.c-ref`, `.c-tot`, `.c-e`, `.c-h`, `.c-r`,
  `.c-xp`, `.c-xn`. Ekrandaki bir rengi metinde anıyorsan aynı sınıfla yaz.
- Yaklaşık modeller (Yagi dizi faktörü, basitleştirilmiş 2B FDTD, ideal bileşenler) ekranda `<span class="approx">yaklaşık model</span>`
  ya da açık bir cümleyle etiketlenir.
- Sözlük terimleri (`js/glossary.js`) otomatik işaretlenir. Listede olmayan önemli bir terim kullanırsan kendi demo
  dosyanda ekle:
  `window.GLOSSARY_EXTRA = (window.GLOSSARY_EXTRA || []).concat([{ k: ["kök"], t: "Başlık", d: "Tanım", u: "https://tr.wikipedia.org/..." }]);`
  (`k`: küçük harfli kökler; Türkçe ekler otomatik kapsanır.)

## Türkçe yazım

- Hedef kitle: teknik merakı olan ama elektromanyetik eğitimi almamış biri. Önce sezgi, sonra (isteğe bağlı) formül.
- Sade, etken çatılı cümleler; günlük Türkçe. Yerleşik İngilizce terim (VSWR, balun, Yagi, NanoVNA, S11) ilk geçtiği
  yerde Türkçe açıklamasıyla: "VSWR (duran dalga oranı)".
- Ondalık ayırıcı virgül: 2,15 dBi; 145,5 MHz. Binlik ayırıcı nokta. Birimle sayı arasında boşluk: 50 Ω, 73 Ω.
  Karmaşık empedans: `25 − j40 Ω`. Eksi işareti için "−" (U+2212).
- Başlıklar cümle düzeninde; BÜYÜK HARFLİ etiket yok; "X — Y" etiket kalıbı yok.
- **Doğruluk zorunlu.** Tarih, kablo değeri, standart ve yasal bilgi yazmadan önce web'de doğrula
  (WebSearch/WebFetch araçlarını ToolSearch ile yükle). Emin olmadığını yazma ya da "yaklaşık" de ve kaynağını sunucu
  notuna ekle. Raporunda kullandığın kaynakları listele.
- **Ölç, tahmin etme.** Ekranda gösterilen her sayı (empedans, Γ, VSWR, dB, uzunluk, kazanç, pF/nH) `RF.*` ile
  hesaplanır ya da simülasyondan ölçülür; HTML'e elle sayı yazma. Metinde geçen bilinen sabitler (73 Ω, 2,15 dBi,
  RG-58'in hız faktörü) `rf.js` testleriyle doğrulanmış değerlerle tutarlı olmalı.

## Demo API

```js
(function () {
  const { C, FONT, rgba, h, canvas, loop, clamp, slider, seg, toggle, num, sig, ohm, db, hz, meters, pointer } = L;
  Demos.ch3Line = function (stage, slide) {
    const cv = h("canvas", { "aria-label": "…" });
    const fill = h("div.fill", cv);
    const ctrl = h("div.controls");
    stage.append(fill, ctrl);
    const st = canvas(cv, draw);             // yeniden boyutlanınca draw(st) çağrılır (ilk çağrı ertelenir)
    function draw() { const { ctx, w, h } = st; /* … */ }
    const lp = loop((dt, t) => { /* güncelle */ draw(); });
    return { enter() { lp.start(); }, leave() { lp.stop(); } };
  };
  window.GUIDE_SCENARIOS = Object.assign(window.GUIDE_SCENARIOS || {}, {
    "hat-simulasyonu": [{ click: "Darbe gönder" }, { wait: 1500 }, { slide: "label:Yük direnci R", to: 50 }],
  });
  window.GUIDE_TARGETS = Object.assign(window.GUIDE_TARGETS || {}, { /* "slayt-id": "css:seçici" */ });
})();
```

- Demo slayta ilk girişte bir kez kurulur; `enter`/`leave` görünürlükte çağrılır. Döngüler yalnızca `enter` ile
  `leave` arasında çalışır (bir sonraki slayt 400 ms sonra önceden kurulur; `leave` gelmeden döngü başlatma).
- Tuvaller `L.canvas` ile kurulur (yüksek DPI, kendini boyutlar). `canvas()`'ın ilk `onResize` çağrısı mikro göreve
  ertelenir; bunu bozacak bir şey yapma (`const st = canvas(...)` atanmadan `st`'yi kullanan kod yazma).
- Statik çizimlerde de `loop` kullanabilirsin ama gereksiz yere her kare ağır hesap yapma. 60 fps hedef.
- **Kontroller:** `L.slider({label, min, max, step, value, fmt, oninput, cls, log})` (aria-label = label;
  `cls: "c-r" | "c-xp" | "c-xn" | "c-fwd" | "c-ref" | "c-e" | "c-h"` renkli topuz), `L.seg([[key, "Etiket"], …], value, onchange)`,
  `L.toggle("Etiket", value, onchange, "c-fwd")`, `h("button.btn", …)`. Kontroller `div.controls` içinde (sahnenin altında;
  üstte olacaksa `div.controls.top`). Sayısal okumalar `.readouts > .readout.c-ref > .k + .v`. Yüzen bilgi `.float.tl`.
- **Biçimlendirme:** `L.num(v, d)` Türkçe sayı, `L.sig(v, 3)` anlamlı basamak, `L.ohm(50)` / `L.ohm({re, im})`,
  `L.db(v, 1)`, `L.hz(v)`, `L.meters(v)`.
- **Çizim (`V`):** `V.graticule(ctx,x,y,w,h,nx,ny)`, `V.trace(ctx, arr, x,y,w,h, ymin,ymax, color, lw, {glow, dash})`,
  `V.fn(ctx, f, u0,u1, x,y,w,h, ymin,ymax, color)`, `V.text(ctx, s, x, y, {color,size,weight,font:"display"|"num"|"body",align,base})`,
  `V.arrow`, `V.dimension(ctx,x0,y0,x1,y1,"λ/2 = 1,03 m")` (mavi baskı ölçü çizgisi), `V.polarGrid`, `V.polar(ctx,cx,cy,R,g(φ),color)`
  (dB ölçekli kutupsal desen), `V.corners`, `V.fieldImage(grid, imageData, "E"|"H", gain)`, `V.segments` (eş-değer çizgileri).
- **RF hesapları (`RF`):** karmaşık sayılar `RF.cx(re, im)`, `RF.C.add/sub/mul/div/abs/arg/inv/polar/exp/tanh`;
  `RF.gamma(ZL, Z0)`, `RF.zFromGamma`, `RF.vswr(Γ)`, `RF.returnLoss`, `RF.mismatchLoss`, `RF.powerDelivered`,
  `RF.zin(ZL, Z0, βl)`, `RF.zinWl(ZL, Z0, l/λ)`, `RF.zinLossy`, `RF.envelope`, `RF.coaxZ0(D,d,εr)`, `RF.twinZ0(s,d,εr)`,
  `RF.microstripZ0(w,h,εr)`, `RF.coaxL/coaxC`, `RF.skinDepth(f)`, `RF.coaxLoss(f, D, d, εr, tanδ)` (metre),
  `RF.xL/xC/resonance/qSeries/qParallel`, `RF.reactanceToPart/susceptanceToPart`, `RF.lMatch(ZL, Z0, f)` (iki çözüm),
  `RF.lMatchZin`, `RF.quarterWaveZ`, `RF.singleStub(ZL, Z0)`, `RF.stubY`, `RF.wavelength(f, vf)`, `RF.vfFromEr`,
  `RF.electricalLengthDeg`, `RF.roundTrip`, `RF.distanceFromRoundTrip`, `RF.dipolePattern(L/λ, θ)`,
  `RF.dipoleRadiationResistance`, `RF.dipoleFeedResistance`, `RF.dipoleDirectivity`, `RF.monopole*`,
  `RF.halfWaveDipoleLength(f, k)`, `RF.DIPOLE_DBI`, `RF.dbiToDbd`, `RF.dB/fromDB`, `RF.arrayFactor(elems, φ)`,
  `RF.ulaFactor(N, d, β, θ)`, `RF.steerPhase`, `RF.polarizationLoss`, `RF.reactiveNearField`, `RF.fraunhofer`,
  `RF.fspl(d, f)`, `RF.friis({...})`, `RF.wToDbm/dbmToW`, `RF.noiseFloorDbm`, `RF.powerDensity`, `RF.dishGain`,
  `RF.CABLES` (RG-58, RG-213, RG-6, LMR-400), `RF.DIELECTRICS`. Ayrıca: `RF.Si/Ci/siCi`, `RF.besselJ1`, `RF.logJ0`,
  `RF.currentDensityRatio(r, a, δ)` ve `RF.acDcRatio(a, δ)` (deri etkisi, tam Bessel çözümü), `RF.coaxOptimum(εr)`
  (en az kayıp / en çok güç), `RF.dipoleFeedReactance(L/λ, a/λ)`, `RF.dipoleResonantLength(a/λ)`, `RF.mutualZ(d/λ)`,
  `RF.dipoleSeriesRLC(f, f0, Q, R)`, `RF.dishBeamwidthDeg`, `RF.circularAperture`, `RF.helixDirectivity`,
  `RF.jones(tür, açı)` ve `RF.polarizationMatch(et, er)`, `RF.icnirpPublicDensity(f)`. Testler: `node tests/rf.test.js`.
- **1B FDTD (`FDTD1D.Sim`):** `new FDTD1D.Sim({ N, Z0, Rs })`; `sim.source = { kind: "pulse"|"sine"|"step", width, period, amp }`;
  `sim.load = { R, L, C }` ya da `{ open: true }` ya da `sim.setLoadZ(R, X)` (sinüs periyodunda eşdeğer L/C);
  `sim.setProfile(k => Ω)` (hat boyunca empedans; TDR arızası); `sim.setLoss(perCell)`; `sim.step(n)`; `sim.fire()`;
  `sim.V` (toplam), `sim.fwd` (ileri), `sim.rev` (yansıyan) dizileri (N+1 düğüm), `sim.loadV`, `sim.loadI`.
  Dalga her adımda tam 1 hücre ilerler (Courant 1). Doğrulama: `node tests/fdtd1d.test.js`.
- **2B FDTD (`FDTD2D.Grid`):** TE kipi (Hz, Ex, Ey). `new FDTD2D.Grid(nx, ny, { pml })`; dalga adım başına 0,5 hücre
  ilerler, dalga boyu = periyot·0,5 hücre (en az 20 hücre/λ öner). `grid.addPEC(x0,y0,x1,y1)` (ince tel x0 = x1),
  `grid.sources.push({ kind: "gap", x, y, dir: "y", amp, period, phase, ramp })` (dipol besleme boşluğu),
  `{ kind: "burst", x, y, t0, width, period, amp }`; `grid.step(n)`; `grid.E2` (zaman ortalamalı |E|²),
  `grid.psiAC()` + `grid.contours(levels, field)` (elektrik alan çizgileri), `grid.ring(cx, cy, r, n)` (çember üstünde |E|²).
  Görselleştirme örneği `js/demos/ch0.js`. Izgara boyutu ~300×200'ü aşmasın (adım ~0,7 ms).
- **Smith abağı (`Smith`):** sitedeki tek Smith bileşeni, başka Smith çizimi yazma. `const geo = Smith.fit(w, h, pad)`
  (`geo.morph` 0..1: dikdörtgen düzleme geçiş), `Smith.draw(ctx, geo, { labels, admittance, faint })`,
  `Smith.toXY(z, geo)` (z normalize: Z/Z0, `{re, im}`), `Smith.fromXY(px, py, geo)`, `Smith.gammaOf(z)`,
  `Smith.vswrCircle(ctx, geo, |Γ|)`, `Smith.point(ctx, geo, z, color, label)`, `Smith.path(ctx, geo, zs, color)`,
  `Smith.trace(z, "series"|"shunt"|"line", miktar)` (seri x, paralel b ya da hat uzunluğu λ boyunca z'nin izlediği yol).
- **Sürükleme:** `L.pointer(cv, {down, move, up, hover})` (hayalet elin sentetik olaylarıyla da çalışır).
- **3B:** Harici kütüphane yükleme; gerekirse küçük izdüşüm kodunu kendin yaz (file:// uyumu).

## Hayalet el senaryosu

Her slaytın bir senaryosu olmalı: deneyin **ilk hamlesini** gerçek kontrollerle bir kez oynar (2–4 adım, ~3–5 sn).
Bulucular: `"=Metin"` tam eşleşen düğme, `"Metin"` ile başlayan düğme (yalnızca `.stage` içindeki
`button`/`[role=button]`), `"label:x"` aria-label'ı x olan `input`, `"aria:x"` aria-label'ı x olan öğe, `"css:x"` seçici.
Adımlar: `{click}`, `{slide, to}` (kaydırıcı; log kaydırıcıda `to` input'un ham değeri, yani ln(değer)), `{tap, at:[fx,fy]}`
(tuvale dokunma), `{drag, path:[[fx,fy],…]}` (öğe dikdörtgenine göre sürükleme), `{move}` (yalnızca gösterir), `{wait: ms}`.
Senaryolardaki her hedef sayfada gerçekten bulunmalı; otomatik denetlenir (`tools/check-guide.js`).

## Anlatım metni (`tools/parts/N.narration.json`)

Her slayt için 20–40 saniyelik (≈ 55–90 kelime) Türkçe anlatım. Ekrandaki metni okumaz; aynı fikri konuşur gibi anlatır
ve deneyde neye bakılacağını söyler. ElevenLabs Türkçe sesiyle okunacak: kısaltma, sayı ve birimler **okunduğu gibi**
yazılır. Rakam kullanma; sayıları yazıyla yaz. Yunan harflerini yazıyla yaz.

| Yazılış | Okunuş |
| --- | --- |
| 50 Ω, 73 Ω | elli ohm, yetmiş üç ohm |
| Z₀, Z0 | "karakteristik empedans" ya da "zed sıfır" |
| Z_L | "yük empedansı" |
| Γ | gama |
| λ, λ/2, λ/4 | lamda, yarım dalga boyu, çeyrek dalga boyu |
| εr | epsilon ar ya da "dielektrik sabiti" |
| δ | "deri derinliği" |
| VSWR, SWR | "duran dalga oranı" (tercih) ya da vi es dabılyu ar |
| dB, dBi, dBd, dBm | desibel, de be i, de be de, de be em |
| Hz, kHz, MHz, GHz | hertz, kilohertz, megahertz, gigahertz |
| 145 MHz | yüz kırk beş megahertz |
| 4,2 dB | dört virgül iki desibel |
| 2,15 dBi | iki virgül on beş de be i |
| pF, nH, µH | pikofarad, nanohenri, mikrohenri |
| RG-58, RG-213 | ar ge elli sekiz, ar ge iki yüz on üç |
| S11 | es on bir |
| TDR | te de re ya da "zaman alanında yansıma ölçümü" |
| VNA, NanoVNA | vi en ey, nano vi en ey |
| FDTD | ef de te de |
| L-ağı | el ağı |
| balun, Yagi, Uda | balun, yagi, uda |
| Smith abağı | smit abağı |
| Friis, Heaviside, Hertz, Maxwell | friis, hevisayd, herts, maksvel |
| BTK, ICNIRP | be te ka, ay si en ay ar pi |
| PE, PTFE | polietilen, teflon |
| 5G | beş ge |

## Doğrulama (bitirmeden önce zorunlu)

1. `node --check js/demos/N.js` ve `node tests/rf.test.js` (değiştirmediğin halde geçtiğini gör).
2. `python3 tools/assemble.py`
3. Ekran görüntüleri (yalnızca kendi slaytların, üç boyut; file:// üzerinden, yerel sunucu gerekmez):
   `NODE_PATH=/Users/koraytoksoz/Projects/Games/PlayForge/node_modules node tools/shoot.js <SCRATCH>/shots-N <id1,id2,…>`
   Görüntüleri Read ile aç ve incele: taşma, üst üste binme, okunmayan yazı, boş tuval, kırpılan kontrol olmasın.
   390 genişlikte sahne metnin altında, kontroller sarılarak sığmalı. Konsolda hata kalmasın.
   (`<SCRATCH>`: kendi geçici klasörün; proje klasörüne görüntü koyma.)
4. Etkileşimi dene: kendi küçük playwright betiğinle (aynı NODE_PATH; `tools/shoot.js` örnek) kaydırıcıları değiştir,
   düğmelere bas, hayalet el senaryosunu `window.__rehber.find` ile denetle; sonra yeniden ekran görüntüsü al.
5. Ekranda gösterilen sayıları `RF` ile çapraz kontrol et; ölçülmesi gerekenleri (FDTD'de yansıma, desen) ölç; raporla.

## Rapor

Bitince kısa bir rapor ver: yazdığın slaytlar ve deneyleri, doğruladığın olgular ve kaynakları, ölçtüğün değerler,
eklediğin sözlük terimleri, ortak dosyalarda gördüğün sorunlar, test edemediklerin.
