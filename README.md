# Kablodan Boşluğa

**Canlı site: https://egitim.koraytoksoz.com/anten/** (eski adres https://anten.koraytoksoz.com buraya yönlendirilir; bütün eğitimler: https://egitim.koraytoksoz.com)

Antenleri, iletim hatlarını ve empedansı; kabloda ilerleyip yansıyan dalgadan karakteristik empedansa, duran dalgaya, Smith abağına, empedans uydurmaya ve antenin dalgayı boşluğa salmasına kadar slayt slayt anlatan, Türkçe, etkileşimli bir sunum sitesi. Her slaytta oynanabilen bir deney ya da canlı bir hesaplayıcı var; bütün simülasyonlar tarayıcıda çalışır.

Hazırlayan: **Koray Toksöz**

*An interactive, Turkish-language explainer on antennas, transmission lines and impedance, with live in-browser FDTD simulations and an interactive Smith chart. Code: MIT · Content: CC BY 4.0.*

## İçerik

| Bölüm | Deneyler |
| --- | --- |
| 0. Giriş | Canlı 2B FDTD: dipolün çevresinde kopup yayılan elektrik alan çizgileri; tıklayınca yeni dalga kaynağı |
| 1. Dalga ve kablo | İpte ilerleyen dalga (sabit / serbest uç = kısa / açık devre), kablo ne zaman iletim hattı olur, hız faktörü yarışı |
| 2. İletim hattı | LC merdiveni (basamak sayısı ve darbe bozulması), koaksiyel / çift hat / mikroşerit kesitleriyle Z₀ ve "neden 50 Ω?", deri etkisi (Bessel çözümü) ve kablo kaybı |
| 3. Yansıma ve duran dalga | 1B FDTD hat simülasyonu (ileri, yansıyan, toplam), Γ oku, duran dalga ve VSWR, TDR ile "Arızayı bul" oyunu |
| 4. Empedans ve Smith abağı | R + jX düzlemi, rezonans ve Q, hat boyunca empedans dönüşümü, düz düzlemden bükülen Smith abağı, Smith'te bileşen ekleyerek uyum oyunu |
| 5. Empedans uydurma | Maksimum güç aktarımı, L-ağı (iki çözüm, pF/nH, Smith'te adım adım), çeyrek dalga dönüştürücü ve tek stub, balun ve ortak mod akımı, anten tuner |
| 6. Anten | Açılan iletim hattı ve yakın/uzak alan (2B FDTD), yarım dalga dipol hesaplayıcı, monopol ve ayna görüntüsü, 2B/3B ışıma deseni, kazanç–dBi–dBd, polarizasyon, Yagi (yaklaşık model), faz dizili anten, halka/patch/helisel/çanak |
| 7. Gerçek dünyada | Friis bağlantı bütçesi ("Bu bağlantı kurulur mu?"), NanoVNA ekranı okumak, sık yapılan hatalar, RF güvenliği ve Türkiye'de yasal çerçeve |

Ek olarak:
- Yaklaşık 20 dakikalık Türkçe **sesli anlatım** ("Bitince sonraki slayta geç" ile kendiliğinden ilerler)
- Deneyin ilk hamlesini oynayan **hayalet el** ve "Göster" düğmeleri
- Terimlerin üzerine gelince açılan **tanım balonları** (yaklaşık 100 terim, Vikipedi bağlantılı)
- **Sunucu notları**
- **Sabit renk kodu:** ileri dalga sarı, yansıyan camgöbeği, toplam beyaz; E alanı gül, H alanı çivit; direnç kemik, +X mor, −X turkuaz

## Çalıştırma

Derleme adımı yok, bağımlılık yok. `index.html` dosyasına çift tıklamak yeterli (file:// ile de çalışır). Ya da önbelleksiz yerel sunucuyla:

```sh
python3 tools/serve.py 8000   # http://localhost:8000
```

## Kısayollar

| Tuş | İşlev |
| --- | --- |
| → / Boşluk, ← | İleri / geri |
| A | Sesli anlatımı aç/kapat (P: duraklat) |
| G | Deney gösterimlerini (hayalet el) aç/kapat |
| N | Sunucu notları |
| T | Açıklama metnini gizle (sunum modu) |
| O | Tüm slaytlar |
| F | Tam ekran |

Her slaytın bağlantısı adres çubuğunda durur (ör. `#smith-abagi`).

## Yapı

- `index.html`: `tools/parts/ch*.html` parçalarından `python3 tools/assemble.py` ile kurulur. Slaytları parçalarda düzenleyin.
- `js/rf.js`: RF hesap çekirdeği: karmaşık sayılar, Z ↔ Γ ↔ VSWR ↔ geri dönüş kaybı ↔ uyumsuzluk kaybı, kayıplı/kayıpsız hat dönüşümü, koaks / çift hat / mikroşerit Z₀ ve koaks optimumları, deri derinliği, akım yoğunluğu profili ve kablo kaybı, L-ağı, çeyrek dalga, tek stub, dipol ve monopol (ışıma direnci, reaktans, yönlülük, karşılıklı empedans), dizi faktörü, polarizasyon, Friis ve yol kaybı, ICNIRP sınırları; sitedeki bütün sayılar buradan gelir
- `js/fdtd1d.js`: 1B FDTD iletim hattı (telgrafçı denklemleri, Courant 1; Thevenin kaynak, seri R-L-C yük, hat boyunca empedans profili; ileri/yansıyan dalga ayrımı için gölge hat)
- `js/fdtd2d.js`: 2B FDTD alan simülasyonu (TE kipi, Yee ızgarası, kademeli sönümleyici sınır, mükemmel iletkenler; elektrik alan çizgileri için Ψ = ∫Hz dt eş-değer eğrileri)
- `js/smith.js`: sitedeki tek Smith abağı bileşeni (düz düzleme geçiş, admitans ızgarası, VSWR dairesi, bileşen ekleme izleri)
- `js/lib.js`, `js/viz.js`: ortak yardımcılar, renk dili, ölçü aleti çizimleri (graticule, mavi baskı ölçü çizgisi, kutupsal desen)
- `js/app.js`: slayt motoru (ilerleme çubuğu bir iletim hattıdır; geçerli slayt sarı bir darbe)
- `js/narrator.js`: sesli anlatım (`audio/<slayt-id>.mp3`), `js/guide.js`: hayalet el, `js/glossary.js`: sözlük balonları
- `js/demos/ch*.js`, `css/demos-ch*.css`: bölüm bölüm deneyler
- `tests/`: `rf.js`, 1B ve 2B FDTD birim testleri
- `tools/`: yerel sunucu, yayın betiği, parçalardan kurma, ekran görüntüsü ve hayalet el denetimi, anlatım metinleri (`narration.json`), yazım kuralları (`AUTHORING.md`)
- `PLAN.md`: tasarım planı (renk kodu, tipografi) ve slayt listesi

## Testler

```sh
node tests/rf.test.js       # 146 test: Γ/VSWR, λ/4 ve λ/2 dönüşümü, RG-58/RG-213/LMR-400/RG-6 Z₀, mikroşerit,
                            # deri derinliği ve AC/DC oranı, koaks optimumları (76,7 Ω / 30 Ω), L-ağı ve stub,
                            # dipol 73 + j42,5 Ω ve 2,15 dBi, karşılıklı empedans, monopol, Si/Ci ve J1,
                            # Jones polarizasyonu, ICNIRP sınırları, Friis, FSPL
node tests/fdtd1d.test.js   # 17 test: uyumlu yükte yansıma 0, kısa devre −1, açık devre +1, 100 Ω → 1/3,
                            # karmaşık yüklerde |Γ| ve açı, TDR yankı genliği ve dönüş zamanı
node tests/fdtd2d.test.js   # 3 test: sönümleyici sınır, dalga hızı, iletken duvarın gölgesi
```

Ekran görüntüleri ve hayalet el hedefleri (playwright-core ve Chromium gerekir):

```sh
NODE_PATH=<node_modules> node tools/shoot.js shots all
NODE_PATH=<node_modules> node tools/check-guide.js
```

## Yeniden üretme

- **Simülasyonlar ve hesaplar:** Hepsi tarayıcıda, kodla yapılır; projede ölçüm verisi ya da kayıt yoktur. Yaklaşık modeller (2B FDTD'nin 3B'ye göre basitleştirmesi, Yagi dizi faktörü modeli, dipolün seri RLC eşdeğeri, ICNIRP mesafe tahmini) ekranda "yaklaşık" diye etiketlidir.
- **Anlatım sesleri:** Metinler `tools/parts/*.narration.json` dosyalarındadır ve `python3 tools/narration.py` ile `tools/narration.json`'a toplanır. Sesler ElevenLabs ile "İrem" sesi (`eleven_multilingual_v2`, Türkçe) kullanılarak üretildi ve `audio/<slayt-id>.mp3` olarak kaydedildi. Sayılar, birimler ve kısaltmalar metinde okunduğu gibi yazılıdır ("elli ohm", "es on bir", "smit abağı"). `python3 tools/narration.py --missing`, metni değişen ya da sesi olmayan slaytları listeler.

## Yayınlama

```sh
tools/deploy.sh   # varsayılan koray@koraytoksoz.com → ~/egitim.koraytoksoz.com/anten/
```

Betik önce `index.html`'i parçalardan kurar ve CSS/JS bağlantılarındaki `?v=` sürüm etiketini yeniler, sonra `rsync` ile yalnızca değişen dosyaları gönderir (geliştirme dosyaları gönderilmez, sunucudaki dosyalar silinmez). `.htaccess` HTTPS yönlendirmesi, sıkıştırma ve önbellek ayarlarını içerir.

## Kaynaklar ve ileri okuma

### Konuyu derinleştirmek için

- **The ARRL Antenna Book for Radio Communications**, 25. baskı, ARRL, 2023. Amatör telsizcinin anten başucu kitabı: dipolden Yagi'ye, hatlardan baluna. https://www.arrl.org/arrl-antenna-book
- Constantine A. Balanis, **Antenna Theory: Analysis and Design**, 4. baskı, Wiley, 2016. Dipol ışıma direnci (73 + j42,5 Ω), yönlülük, karşılıklı empedans, diziler.
- David M. Pozar, **Microwave Engineering**, 4. baskı, Wiley, 2012. İletim hattı kuramı, Smith abağı, L-ağı (bölüm 5.1), tek stub (5.2), çeyrek dalga dönüştürücü, kayıplar.
- John D. Kraus, Ronald J. Marhefka, **Antennas for All Applications**, 3. baskı, McGraw-Hill, 2002. Helisel anten, dipol yönlülükleri.
- Allen Taflove, Susan C. Hagness, **Computational Electrodynamics: The Finite-Difference Time-Domain Method**, 3. baskı, Artech House, 2005. Sitedeki FDTD simülasyonlarının yöntemi.
- **Microwaves101**, "Why fifty ohms?" (77 Ω en düşük kayıp, 30 Ω en yüksek güç). https://www.microwaves101.com/encyclopedias/why-fifty-ohms

### Tarih ve özgün yayınlar

- P. H. Smith, "Transmission Line Calculator", *Electronics*, c. 12, s. 1, Ocak 1939, s. 29–31. https://en.wikipedia.org/wiki/Smith_chart
- H. Yagi, "Beam Transmission of Ultra Short Waves", *Proceedings of the IRE*, c. 16, s. 6, 1928. https://en.wikipedia.org/wiki/Yagi%E2%80%93Uda_antenna
- H. T. Friis, "A Note on a Simple Transmission Formula", *Proceedings of the IRE*, c. 34, s. 5, 1946. https://en.wikipedia.org/wiki/Friis_transmission_equation
- K. S. Yee, "Numerical solution of initial boundary value problems involving Maxwell's equations in isotropic media", *IEEE Transactions on Antennas and Propagation*, c. 14, s. 3, 1966. https://en.wikipedia.org/wiki/Finite-difference_time-domain_method
- Oliver Heaviside ve telgrafçı denklemleri. https://en.wikipedia.org/wiki/Telegrapher%27s_equations

### Teknik

- E. O. Hammerstad, "Equations for Microstrip Circuit Design", 5. Avrupa Mikrodalga Konferansı, 1975 (mikroşerit Z₀ formülü). https://en.wikipedia.org/wiki/Microstrip
- Deri etkisi. https://en.wikipedia.org/wiki/Skin_effect
- Belden 9201 (RG-58/U), 8267 (RG-213/U) veri sayfaları: iletken çapları ve kayıp noktaları. https://www.belden.com
- Balun. https://en.wikipedia.org/wiki/Balun
- Dipol anten. https://en.wikipedia.org/wiki/Dipole_antenna
- Faz dizili anten. https://en.wikipedia.org/wiki/Phased_array
- Semtech SX1276 veri sayfası (LoRa hassasiyeti, SF12/125 kHz). https://www.semtech.com/products/wireless-rf/lora-connect/sx1276
- ARISS (Uluslararası Uzay İstasyonu'nda amatör telsiz). https://www.ariss.org
- ITU-R S.727 (çapraz polarizasyon ayrımı). https://www.itu.int/rec/R-REC-S.727
- NanoVNA. https://nanovna.com/

### Güvenlik ve Türkiye'de mevzuat

- ICNIRP, "Guidelines for Limiting Exposure to Electromagnetic Fields (100 kHz to 300 GHz)", *Health Physics* 118(5), 2020 (Tablo 5, genel halk). https://www.icnirp.org/cms/upload/publications/ICNIRPrfgdl2020.pdf
- BTK, amatör telsizcilik. https://www.btk.gov.tr/amator-telsizcilik
- BTK, "Frekans Tahsisinden Muaf Telsiz Cihaz ve Sistemlerine İlişkin Teknik Ölçütler" (868 MHz, 2,4 GHz güç sınırları). https://www.btk.gov.tr
- Kıyı Emniyeti Genel Müdürlüğü, amatör telsizcilik sınavı ve belgesi (SSS). https://www.kiyiemniyeti.gov.tr/faq
- Türkiye Radyo Amatörleri Cemiyeti (TRAC). https://www.trac.org.tr/

Sitedeki güvenlik ve yasal bilgiler genel bilgilendirme amaçlıdır; sağlık ya da hukuki tavsiye değildir, resmî ölçüm ve değerlendirmenin yerine geçmez.

## Lisans

| Ne | Lisans |
| --- | --- |
| Kaynak kod (`js/`, `css/`, `tools/`, `tests/`, `index.html` içindeki kod) | [MIT](LICENSE) |
| İçerik (slayt metinleri, sunucu notları, sözlük, anlatım metinleri ve sesleri) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.tr) |
| Yazı tipleri: Archivo, Literata, JetBrains Mono (Google Fonts'tan yüklenir) | SIL Open Font License 1.1 |
| Creative Commons simgeleri, GitHub simgesi | CC marka kuralları; Octicons MIT |

Simülasyonların, hesapların ve görsellerin tamamı bu projede üretilir; üçüncü taraf veri kullanılmaz. Ayrıntılar [LICENSE](LICENSE) dosyasında. GitHub bu çift lisansı "Other" olarak gösterir.

Önerilen atıf:

> Koray Toksöz, Kablodan Boşluğa, https://egitim.koraytoksoz.com/anten/
