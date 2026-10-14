# Kablodan Boşluğa: plan

Antenleri, iletim hatlarını ve empedansı anlatan Türkçe, statik, etkileşimli sunum sitesi.
Hazırlayan ve sunan: Koray Toksöz. Yayın: https://anten.koraytoksoz.com

**Hedef kitle:** Teknik merakı olan, belki amatör telsizci ya da SDR meraklısı, ama elektromanyetik teori eğitimi
almamış biri. Önce sezgi (ipte ilerleyen dalga, su borusu, yankı), formül sonra ve isteğe bağlı ("Daha fazla").
Hesap gereken her yerde canlı hesaplayıcı.

## Tasarım: "Mavi baskı + ölçü aleti"

- **Zemin:** Prusya mavisi teknik çizim kâğıdı (`--bg #0b1f33`), ince 80 px / 16 px ızgara.
- **Sahneler:** VNA ekranı gibi: koyu ölçü camı (`--stage #0e2740`), içte ince çerçeve, graticule ızgara (`V.graticule`),
  mavi baskı ölçü çizgileri (`V.dimension`), köşe işaretleri (`V.corners`).
- **Vurgu:** koaks bakırı `--copper #ee8f5f`: düğmeler, kaydırıcı topuzu, "Dene" kutusu, rehber halkası.
  Bakır **bir anlam taşımaz**, arayüz rengidir; dalga ve alan renkleriyle karıştırma.
- **Fontlar:** Archivo (başlık ve arayüz; başlıklarda geniş kesim `font-stretch: 112–125%`), Literata (gövde),
  JetBrains Mono (Ω, dB, VSWR, uzunluk gibi sayısal okumalar; tablo rakamları).
- **İlkeler:** Bütün cesaret deneylerde ve Smith abağında; çevre sakin. Kart ızgarası yok, BÜYÜK HARFLİ etiket yok,
  her başlıkta tek kelimeyi vurgulamak yok. Yapısal çizgiler (ölçü çizgisi, antet kutusu) bilgi taşır.

### Sabit renk kodu (bütün site boyunca aynı anlam)

| Anlam | Renk | CSS değişkeni | JS (`L.C`) | Metin sınıfı |
| --- | --- | --- | --- | --- |
| İleri giden dalga | sodyum sarısı `#ffd257` | `--fwd` | `C.fwd` | `.c-fwd` |
| Yansıyan dalga | camgöbeği `#5ad1ff` | `--ref` | `C.ref` | `.c-ref` |
| Toplam / duran dalga | beyaz `#f7f7f2` | `--tot` | `C.tot` | `.c-tot` |
| Elektrik alanı E | gül `#ff5d8f` | `--e` | `C.E` | `.c-e` |
| Manyetik alan H | çivit `#7d8cff` | `--hf` | `C.H` | `.c-h` |
| Direnç R | kemik `#e6d3a3` | `--r` | `C.R` | `.c-r` |
| Endüktif reaktans +X | mor `#c58cff` | `--xp` | `C.Xp` | `.c-xp` |
| Kapasitif reaktans −X | turkuaz `#2fd5b5` | `--xn` | `C.Xn` | `.c-xn` |

İpte ilerleyen dalga da, Smith abağı da, anten deseni de bu renkleri aynı anlamda kullanır. Akım (I) ve gerilim (V)
için ayrı renk yok: gerilim dalgası yön rengini alır (ileri/yansıyan/toplam); akım gösterilecekse kesikli çizgiyle
aynı yön rengi kullanılır. Anten akım dağılımı = H rengi (akım manyetik alan üretir), gerilim dağılımı = E rengi.

## Slaytlar

Kimlikler sabittir (ses dosyaları `audio/<id>.mp3`).

| Bölüm | Dosya | Kimlik | Başlık / deney |
| --- | --- | --- | --- |
| 0 Giriş | ch0 | `kapak` | Kapak: canlı 2B FDTD dipol alanı, tıklayınca yeni kaynak |
| 1 Dalga ve kablo | ch1 | `ip-dalgasi` | İpte ilerleyen dalga; uç sabit (kısa devre) / serbest (açık devre), yansıyanın ters/düz dönüşü |
| | | `kablo-ne-zaman` | Kablo ne zaman "sadece bir tel" değildir: frekans kaydırıcısı, kabloda dalga belirir |
| | | `hiz-faktoru` | Hız faktörü: hava, PE, köpük PE, PTFE; hız ve dalga boyu hesaplayıcı, iki dalga yarışı |
| 2 İletim hattı | ch2 | `lc-merdiven` | Hattın içi: L ve C basamakları; basamak sayısı artınca sürekli hatta yaklaşır |
| | | `karakteristik-empedans` | Z₀ = √(L/C): koaks, çift hat, mikroşerit kesitleri sürüklenir; 50/75/300 Ω; 50 Ω'nun tarihi |
| | | `deri-etkisi` | Deri etkisi: iletken kesitinde akım yoğunluğu, δ hesaplayıcı, kablo kaybı dB/100 m |
| 3 Yansıma | ch3 | `hat-simulasyonu` | **Ana deney:** 1B FDTD kaynak → hat → yük; R ve X; darbe / sinüs; ileri, yansıyan, toplam |
| | | `yansima-katsayisi` | Γ = (ZL − Z0)/(ZL + Z0): kısa, açık, uyumlu, rastgele; Γ düzlemi |
| | | `duran-dalga` | Duran dalga zarfı, VSWR, geri dönüş kaybı, uyumsuzluk kaybı, "antene ulaşan güç" çubuğu |
| | | `tdr` | TDR: darbe gönder, yankıdan arızayı bul; "Arızayı bul" mini oyunu |
| 4 Empedans | ch4 | `empedans-nedir` | R + jX; bobin ve kondansatör reaktansı frekansla; karmaşık düzlemde nokta |
| | | `rezonans` | Seri / paralel LC; reaktansların sıfırlandığı frekans; Q ve bant genişliği |
| | | `hat-donusumu` | Hat boyunca empedans dönüşümü; λ/4 tersine çevirir, λ/2 tekrarlar |
| | | `smith-abagi` | **Ana deney:** Smith abağı nedir: dikdörtgen düzlemden bükülme animasyonu, nokta gir, VSWR dairesi |
| | | `smith-oyun` | Smith'te oyna: seri/paralel L ve C, hat ekle; nokta daireler üzerinde kayar; hedef: merkez |
| 5 Uydurma | ch5 | `neden-uydurma` | Neden uydurma: maksimum güç aktarımı ve verici koruması |
| | | `l-agi` | L-ağı: yük + frekans gir, iki çözüm Smith'te adım adım, pF / nH |
| | | `ceyrek-dalga-stub` | Çeyrek dalga dönüştürücü ve tek stub: Smith'te görsel çözüm |
| | | `balun` | Balun: dengeli / dengesiz, ortak mod akımı, 1:1 ve 4:1 |
| | | `tuner` | Anten tuner: ne yapar, ne yapmaz |
| 6 Anten | ch6 | `anten-nasil-isir` | Açılan iletim hattı (2B FDTD); yakın alan / uzak alan |
| | | `dipol` | Yarım dalga dipol hesaplayıcı; akım/gerilim dağılımı; ≈ 73 Ω |
| | | `monopol` | Monopol ve toprak düzlemi: ayna görüntüsü (2B FDTD); ≈ 36 Ω |
| | | `isima-deseni` | 2B kutupsal + 3B desen; 0,5λ → 1λ → 1,5λ |
| | | `kazanc` | Kazanç, yönlülük, dBi ve dBd; "balon sıkıştırma" |
| | ch6b | `polarizasyon` | Dikey, yatay, dairesel; açıyı değiştir, cos² |
| | | `yagi` | Yagi–Uda: yansıtıcı ve yönlendiriciler (yaklaşık dizi faktörü modeli) |
| | | `faz-dizisi` | Faz dizili anten: N eleman, faz farkıyla hüzme yönlendirme |
| | | `diger-antenler` | Halka, patch, helisel, parabolik çanak: tek cümle + küçük desen |
| 7 Gerçek dünya | ch7 | `baglanti-butcesi` | Friis bağlantı bütçesi: "Bu bağlantı kurulur mu?" |
| | | `olcum` | SWR metre, anten analizörü, NanoVNA ekranı okumak (S11, Smith, VSWR eğrisi) |
| | | `pratik-hatalar` | Pratik hatalar: "ne olur?" senaryoları |
| | | `guvenlik` | RF maruziyeti, yüksek gerilimli uçlar, BTK ve amatör telsizcilik belgesi |
| | ch9 | `son` | Kapanış |
