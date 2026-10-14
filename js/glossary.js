/* Sözlük: metindeki anahtar kelimelerin üzerine gelince açılan tanım balonları.
   Her terim slayt başına yalnızca ilk geçtiği yerde işaretlenir. */
(function () {
  const trw = (q) => "https://tr.wikipedia.org/w/index.php?search=" + encodeURIComponent(q);
  const enw = (t) => "https://en.wikipedia.org/wiki/" + t;

  // k: aranacak kökler (küçük harf, Türkçe ekler otomatik kapsanır), t: başlık, d: tanım, u: bağlantı
  const TERMS = [
    { k: ["iletim hatt"], t: "İletim hattı", d: "Elektrik enerjisini ya da sinyali bir yerden başka bir yere taşıyan, boyu dalga boyuna göre ihmal edilemeyecek kadar uzun iletken çifti: koaksiyel kablo, çift hat, mikroşerit.", u: trw("İletim hattı") },
    { k: ["koaksiyel", "koaks"], t: "Koaksiyel kablo", d: "İç iletken, onu saran yalıtkan (dielektrik), örgü ya da folyo dış iletken ve kılıftan oluşan, alanı içinde tutan ortak eksenli kablo.", u: trw("Eş eksenli kablo") },
    { k: ["çift hat", "twin-lead", "merdiven hat"], t: "Çift hat (twin-lead)", d: "Birbirine paralel iki telden oluşan dengeli iletim hattı. Tipik empedansı 300 Ω (televizyon şeridi) ya da 450–600 Ω (merdiven hat).", u: enw("Twin-lead") },
    { k: ["mikroşerit", "microstrip"], t: "Mikroşerit (microstrip)", d: "Devre kartında, bir toprak düzleminin üstünde dielektrik tabakayla ayrılmış bakır şeritten oluşan iletim hattı.", u: enw("Microstrip") },
    { k: ["karakteristik empedans"], t: "Karakteristik empedans (Z₀)", d: "Sonsuz uzun bir hattın girişinde görülen gerilim/akım oranı. Hattın kesitine ve dielektriğine bağlıdır, uzunluğuna bağlı değildir: Z₀ = √(L/C).", u: enw("Characteristic_impedance") },
    { k: ["empedans"], t: "Empedans (Z)", d: "Alternatif akıma karşı toplam zorluk: direnç (R) ile reaktansın (X) karmaşık toplamı, Z = R + jX. Birimi ohm (Ω).", u: trw("Empedans") },
    { k: ["reaktans"], t: "Reaktans (X)", d: "Bobin ve kondansatörün alternatif akıma gösterdiği, enerjiyi harcamayıp depolayıp geri veren direnç. Bobinde pozitif (endüktif), kondansatörde negatif (kapasitif).", u: trw("Reaktans") },
    { k: ["endüktif", "endüktans"], t: "Endüktans ve endüktif reaktans", d: "Akımın değişimine karşı koyan, enerjiyi manyetik alanda depolayan özellik (henry). Reaktansı XL = 2πfL frekansla artar.", u: trw("İndüktans") },
    { k: ["kapasitif", "kapasitans", "sığa"], t: "Kapasitans ve kapasitif reaktans", d: "Enerjiyi elektrik alanında depolayan özellik (farad). Reaktansı XC = −1/(2πfC) frekans arttıkça küçülür.", u: trw("Sığa") },
    { k: ["direnç"], t: "Direnç (R)", d: "Enerjiyi ısıya (ya da antende ışımaya) çeviren, akım ile gerilimi aynı fazda tutan kısım. Empedansın gerçek bileşeni.", u: trw("Elektriksel direnç") },
    { k: ["admitans", "süseptans"], t: "Admitans (Y)", d: "Empedansın tersi: Y = 1/Z = G + jB. Paralel bağlı elemanlar admitans olarak toplanır. Birimi siemens (S).", u: trw("Admitans") },
    { k: ["yansıma katsayısı"], t: "Yansıma katsayısı (Γ)", d: "Yükten geri dönen dalganın gelen dalgaya oranı: Γ = (Z_L − Z₀)/(Z_L + Z₀). Uyumlu yükte 0, kısa devrede −1, açık devrede +1.", u: enw("Reflection_coefficient") },
    { k: ["duran dalga oranı", "vswr", "swr"], t: "VSWR (gerilim duran dalga oranı)", d: "Hat boyunca gerilim zarfının en büyük değerinin en küçüğüne oranı: (1 + |Γ|)/(1 − |Γ|). Uyumda 1:1, tam yansımada sonsuz.", u: enw("Standing_wave_ratio") },
    { k: ["duran dalga"], t: "Duran dalga", d: "İleri ve yansıyan dalganın üst üste binmesiyle oluşan, yerinde sayıyormuş gibi görünen desen. Tepe ve çukurlar yarım dalga boyu aralıkla dizilir.", u: trw("Duran dalga") },
    { k: ["geri dönüş kaybı"], t: "Geri dönüş kaybı (return loss)", d: "Yansıyan gücün gelen güce göre kaç desibel aşağıda olduğu: −20 log₁₀|Γ|. Büyük sayı iyidir: 20 dB, gücün yalnızca %1'inin yansıdığı anlamına gelir.", u: enw("Return_loss") },
    { k: ["uyumsuzluk kaybı"], t: "Uyumsuzluk kaybı", d: "Yansıma yüzünden yüke ulaşamayan gücün desibel karşılığı: −10 log₁₀(1 − |Γ|²).", u: enw("Mismatch_loss") },
    { k: ["smith abağ", "smith diyagram"], t: "Smith abağı", d: "Phillip Smith'in 1939'da yayımladığı, bütün pasif empedansları bir dairenin içine sığdıran grafik. Empedans, yansıma katsayısı ve hat dönüşümleri aynı çizimde okunur.", u: enw("Smith_chart") },
    { k: ["phillip smith"], t: "Phillip H. Smith", d: "Bell Laboratuvarları'nda çalışan Amerikalı mühendis (1905–1987). Kendi adıyla anılan abağı 1939'da Electronics dergisinde yayımladı.", u: enw("Phillip_Hagar_Smith") },
    { k: ["deri etkisi"], t: "Deri etkisi (skin effect)", d: "Yüksek frekanslı akımın iletkenin içine girmeyip yüzeyine yakın ince bir katmanda akması. Etkin kesit daralır, direnç ve kayıp artar.", u: trw("Deri etkisi") },
    { k: ["deri derinliği"], t: "Deri derinliği (δ)", d: "Akım yoğunluğunun yüzeydekinin 1/e'sine (≈ %37) düştüğü derinlik: δ = 1/√(πfμσ). Bakırda 1 MHz'de ≈ 66 µm.", u: enw("Skin_effect") },
    { k: ["dielektrik"], t: "Dielektrik", d: "Elektriği iletmeyen ama elektrik alanını taşıyan yalıtkan malzeme (hava, polietilen, teflon). Dielektrik sabiti (εr) dalgayı yavaşlatır.", u: trw("Dielektrik") },
    { k: ["hız faktörü"], t: "Hız faktörü (VF)", d: "Dalganın kablodaki hızının ışık hızına oranı: VF = 1/√εr. Katı polietilen kabloda ≈ 0,66, köpük dielektrikte ≈ 0,8–0,88.", u: enw("Velocity_factor") },
    { k: ["dalga boyu"], t: "Dalga boyu (λ)", d: "Dalganın bir periyotta aldığı yol: λ = v/f. Boşlukta 145 MHz için yaklaşık 2,07 m.", u: trw("Dalga boyu") },
    { k: ["elektriksel uzunluk"], t: "Elektriksel uzunluk", d: "Bir hattın uzunluğunun dalga boyu (ya da derece) cinsinden ifadesi. Kısa bir kablo yüksek frekansta \"uzun\" bir hat olabilir.", u: enw("Electrical_length") },
    { k: ["telgrafçı denklem"], t: "Telgrafçı denklemleri", d: "Oliver Heaviside'ın 1880'lerde yazdığı, iletim hattı boyunca gerilim ve akımın nasıl ilerlediğini anlatan denklem çifti.", u: enw("Telegrapher%27s_equations") },
    { k: ["heaviside"], t: "Oliver Heaviside", d: "İngiliz fizikçi ve mühendis (1850–1925). Maxwell denklemlerini bugünkü biçimine getirdi, iletim hattı kuramını kurdu, koaksiyel kablonun patentini aldı.", u: trw("Oliver Heaviside") },
    { k: ["fdtd"], t: "FDTD (zaman alanında sonlu farklar)", d: "Alanları küçük hücrelere ve zaman adımlarına bölüp Maxwell denklemlerini adım adım çözen sayısal yöntem (Yee, 1966).", u: enw("Finite-difference_time-domain_method") },
    { k: ["tdr", "zaman alanında yansıma"], t: "TDR (zaman alanında yansıma ölçümü)", d: "Kabloya kısa bir darbe gönderip yankıların dönüş süresinden arızanın yerini ve türünü bulan ölçüm yöntemi.", u: enw("Time-domain_reflectometer") },
    { k: ["rezonans"], t: "Rezonans", d: "Endüktif ve kapasitif reaktansların birbirini sıfırladığı frekans: f₀ = 1/(2π√LC). Devre bu frekansta saf direnç gibi davranır.", u: trw("Rezonans") },
    { k: ["q faktörü", "kalite faktörü"], t: "Q faktörü", d: "Bir rezonans devresinin ne kadar \"sivri\" olduğunu gösteren sayı: depolanan enerji / döngü başına kaybedilen enerji. Bant genişliği ≈ f₀/Q.", u: trw("Q faktörü") },
    { k: ["bant genişliği"], t: "Bant genişliği", d: "Bir devrenin ya da antenin istenen davranışı (ör. VSWR < 2) gösterdiği frekans aralığı.", u: trw("Bant genişliği") },
    { k: ["empedans uydurma", "uydurma ağ"], t: "Empedans uydurma", d: "Kaynak ile yük arasına eleman ekleyerek kaynağın gördüğü empedansı istenen değere (çoğunlukla 50 Ω) getirmek; böylece yansıma kaybolur.", u: enw("Impedance_matching") },
    { k: ["l-ağı", "l ağı"], t: "L-ağı", d: "Bir seri ve bir paralel reaktif elemandan (bobin, kondansatör) oluşan en basit uydurma devresi. Her yük için genellikle iki çözümü vardır.", u: enw("L_network") },
    { k: ["çeyrek dalga dönüştürücü"], t: "Çeyrek dalga dönüştürücü", d: "Çeyrek dalga boyu uzunluğunda, empedansı √(Z₀·R_L) olan hat parçası. Gerçek bir yükü başka bir gerçek değere dönüştürür.", u: enw("Quarter-wave_impedance_transformer") },
    { k: ["stub"], t: "Stub (saplama hat)", d: "Ucu kısa devre ya da açık bırakılmış kısa hat parçası. Uzunluğuna göre bobin ya da kondansatör gibi davranır; uydurmada kullanılır.", u: enw("Stub_(electronics)") },
    { k: ["balun"], t: "Balun", d: "\"Balanced–unbalanced\": dengeli bir yükü (dipol) dengesiz bir hatta (koaksiyel) bağlayan, kablo dışında akan ortak mod akımını bastıran düzenek.", u: trw("Balun") },
    { k: ["ortak mod"], t: "Ortak mod akımı", d: "İki iletkende aynı yönde akan, koaksiyelin dış yüzeyinden geri dönen istenmeyen akım. Kabloyu da antenin parçası yapar.", u: enw("Common-mode_signal") },
    { k: ["anten tuner", "tuner", "atu"], t: "Anten tuner (ATU)", d: "Verici ile hat arasına konan ayarlı uydurma devresi. Vericinin 50 Ω görmesini sağlar; antenin kendisini ya da hattaki duran dalgayı düzeltmez.", u: enw("Antenna_tuner") },
    { k: ["dipol"], t: "Dipol anten", d: "Ortadan beslenen iki eşit kollu tel anten. Yarım dalga dipolün besleme empedansı ≈ 73 Ω, kazancı 2,15 dBi'dir.", u: trw("Dipol anten") },
    { k: ["monopol", "çeyrek dalga dikey"], t: "Monopol anten", d: "Bir toprak düzleminin üstünde duran tek kollu anten. Toprak düzlemi ayna gibi davranıp dipolün öbür yarısını oluşturur; çeyrek dalga monopol ≈ 36 Ω.", u: enw("Monopole_antenna") },
    { k: ["toprak düzlemi", "ground plane"], t: "Toprak düzlemi", d: "Monopol antenin altındaki iletken yüzey ya da radyal teller. Elektrik alanını yansıtarak antenin \"ayna görüntüsünü\" oluşturur.", u: enw("Ground_plane") },
    { k: ["ışıma direnci"], t: "Işıma direnci", d: "Antenin boşluğa yaydığı gücü, sanki bir dirençte harcanıyormuş gibi gösteren eşdeğer direnç. Isıya değil, ışımaya giden gücü temsil eder.", u: enw("Radiation_resistance") },
    { k: ["ışıma deseni"], t: "Işıma deseni", d: "Antenin yaydığı gücün (ya da alanın) yöne göre dağılımı. Kutupsal grafik ya da 3B yüzey olarak çizilir.", u: enw("Radiation_pattern") },
    { k: ["yönlülük"], t: "Yönlülük (directivity)", d: "Antenin en güçlü yöndeki ışımasının, bütün yönlere eşit ışıyan (izotropik) bir kaynağa oranı. Kayıpları hesaba katmaz.", u: enw("Directivity") },
    { k: ["kazanç"], t: "Anten kazancı", d: "Yönlülüğün antenin verimiyle çarpımı. Anten enerji üretmez; gücü bazı yönlerden alıp başka yönlere toplar.", u: enw("Antenna_gain") },
    { k: ["dbi"], t: "dBi", d: "Kazancın izotropik (her yöne eşit ışıyan, hayalî) antene göre desibel cinsinden değeri.", u: enw("Decibel#Antenna_measurements") },
    { k: ["dbd"], t: "dBd", d: "Kazancın yarım dalga dipole göre desibel değeri. Dipol 2,15 dBi olduğu için dBd = dBi − 2,15.", u: enw("Antenna_gain") },
    { k: ["dbm"], t: "dBm", d: "Gücün 1 miliwatta göre desibel değeri: 0 dBm = 1 mW, 30 dBm = 1 W, −100 dBm = 0,1 pikowatt.", u: trw("DBm") },
    { k: ["desibel"], t: "Desibel (dB)", d: "İki gücün oranının logaritmik ölçüsü: 10 log₁₀(P₁/P₂). +3 dB iki kat, +10 dB on kat, −20 dB yüzde bir.", u: trw("Desibel") },
    { k: ["izotropik"], t: "İzotropik anten", d: "Bütün yönlere eşit ışıyan, gerçekte yapılamayan kuramsal anten. Kazançlar ona göre (dBi) verilir.", u: enw("Isotropic_radiator") },
    { k: ["polarizasyon", "kutuplanma"], t: "Polarizasyon", d: "Elektrik alanının titreşim yönü. Dikey, yatay ya da dairesel olabilir; alıcı ve verici aynı polarizasyonda olmalıdır.", u: trw("Polarizasyon") },
    { k: ["yakın alan"], t: "Yakın alan", d: "Antene çok yakın, enerjinin büyük kısmının ışımadan anten çevresinde depolanıp geri döndüğü bölge. Yaklaşık λ/2π'den yakın.", u: enw("Near_and_far_field") },
    { k: ["uzak alan"], t: "Uzak alan", d: "Alanların düzlem dalga gibi davrandığı, desenin uzaklıkla değişmediği bölge. Işıma deseni burada ölçülür.", u: enw("Near_and_far_field") },
    { k: ["yagi"], t: "Yagi–Uda anteni", d: "Bir beslenen dipol, arkasında bir yansıtıcı ve önünde yönlendiricilerden oluşan yönlü anten. Uda ve Yagi, Tohoku Üniversitesi, 1926.", u: enw("Yagi%E2%80%93Uda_antenna") },
    { k: ["yansıtıcı"], t: "Yansıtıcı (reflector)", d: "Yagi anteninde beslenen elemanın arkasındaki, biraz daha uzun parazitik eleman. Işımayı öne doğru iter.", u: enw("Yagi%E2%80%93Uda_antenna") },
    { k: ["yönlendirici"], t: "Yönlendirici (director)", d: "Yagi anteninde beslenen elemanın önündeki, biraz daha kısa parazitik elemanlar. Işımayı kendi yönlerine çeker.", u: enw("Yagi%E2%80%93Uda_antenna") },
    { k: ["dizi faktörü"], t: "Dizi faktörü (array factor)", d: "Birden çok anten elemanının konum ve fazlarından doğan girişim deseni. Toplam desen ≈ eleman deseni × dizi faktörü.", u: enw("Antenna_array") },
    { k: ["faz dizili", "faz dizisi"], t: "Faz dizili anten", d: "Elemanlarının fazı elektronik olarak ayarlanan anten dizisi. Anten kıpırdamadan hüzme yönlendirilir: radarlar, 5G, uydu terminalleri.", u: enw("Phased_array") },
    { k: ["hüzme"], t: "Hüzme (beam)", d: "Bir antenin ışımasının yoğunlaştığı dar yön bölgesi; ana lob.", u: enw("Main_lobe") },
    { k: ["yan lob"], t: "Yan lob", d: "Işıma deseninde ana hüzmenin dışında kalan küçük, istenmeyen tepeler.", u: enw("Side_lobe") },
    { k: ["patch"], t: "Patch (mikroşerit) anten", d: "Toprak düzlemi üstündeki dikdörtgen bakır yamadan oluşan düz anten. GPS alıcıları ve telefonlarda yaygın.", u: enw("Patch_antenna") },
    { k: ["helisel"], t: "Helisel anten", d: "Yay biçiminde sarılmış tel anten. Eksen kipinde dairesel polarizasyonlu, yönlü ışıma yapar; uydu iletişiminde kullanılır.", u: enw("Helical_antenna") },
    { k: ["parabolik", "çanak"], t: "Parabolik çanak", d: "Paraboloit yansıtıcının odağındaki küçük bir besleyiciyle çalışan yüksek kazançlı anten. Kazanç ≈ η(πD/λ)².", u: trw("Parabolik anten") },
    { k: ["halka anten", "loop"], t: "Halka (loop) anten", d: "Kapalı bir tel halkadan oluşan anten. Küçük halkalar manyetik alana duyarlıdır ve ekseninde sıfır, düzleminde tepe yapar.", u: enw("Loop_antenna") },
    { k: ["friis"], t: "Friis iletim denklemi", d: "Harald Friis'in 1946'da yayımladığı, iki anten arasındaki alınan gücü veren denklem: P_r = P_t G_t G_r (λ/4πd)².", u: enw("Friis_transmission_equation") },
    { k: ["serbest uzay yol kaybı", "yol kaybı"], t: "Serbest uzay yol kaybı (FSPL)", d: "Engelsiz ortamda gücün uzaklıkla yayılması sonucu azalması: 20 log₁₀(4πdf/c). Mesafe iki katına çıkınca 6 dB artar.", u: enw("Free-space_path_loss") },
    { k: ["bağlantı bütçesi"], t: "Bağlantı bütçesi", d: "Verici gücünden başlayıp kazançları ekleyen, kayıpları çıkaran hesap. Sonuç alıcı hassasiyetinden büyükse bağlantı kurulur.", u: enw("Link_budget") },
    { k: ["alıcı hassasiyeti"], t: "Alıcı hassasiyeti", d: "Alıcının sinyali istenen kalitede çözebildiği en düşük güç (ör. −120 dBm).", u: enw("Sensitivity_(electronics)") },
    { k: ["vektör ağ analizörü", "vna"], t: "VNA (vektör ağ analizörü)", d: "Bir devreye bilinen sinyal gönderip yansıyan ve geçen sinyalin genliğini ve fazını ölçen cihaz. S parametrelerini verir.", u: enw("Network_analyzer_(electrical)") },
    { k: ["nanovna"], t: "NanoVNA", d: "Açık kaynaklı, cep boyutunda, düşük maliyetli vektör ağ analizörü (2019). Amatörler arasında anten ölçümü için çok yaygın.", u: enw("NanoVNA") },
    { k: ["s11"], t: "S11", d: "Bir kapıdan gönderilen sinyalin aynı kapıdan geri yansıyan kısmı; yansıma katsayısının (Γ) ölçülmüş hâli.", u: enw("Scattering_parameters") },
    { k: ["swr metre", "swr ölçer"], t: "SWR metre", d: "Verici ile anten arasına takılan, ileri ve yansıyan gücü ayrı ayrı ölçüp duran dalga oranını gösteren cihaz.", u: enw("SWR_meter") },
    { k: ["anten analizörü"], t: "Anten analizörü", d: "Kendi küçük sinyalini gönderip antenin empedansını ve SWR'sini frekansa göre ölçen cihaz; verici gerektirmez.", u: enw("Antenna_analyzer") },
    { k: ["btk"], t: "BTK", d: "Bilgi Teknolojileri ve İletişim Kurumu: Türkiye'de telsiz frekanslarını ve amatör telsizcilik belgelerini düzenleyen kurum.", u: trw("Bilgi Teknolojileri ve İletişim Kurumu") },
    { k: ["amatör telsiz"], t: "Amatör telsizcilik", d: "Ticari olmayan, deneysel ve kişisel amaçlı telsiz yayıncılığı. Türkiye'de BTK sınavıyla alınan belge ve çağrı işaretiyle yapılır.", u: trw("Amatör telsizcilik") },
    { k: ["maxwell"], t: "James Clerk Maxwell", d: "İskoç fizikçi (1831–1879). Elektrik ve manyetizmayı tek bir kuramda birleştirdi, ışığın elektromanyetik dalga olduğunu öngördü.", u: trw("James Clerk Maxwell") },
    { k: ["heinrich hertz"], t: "Heinrich Hertz", d: "Alman fizikçi (1857–1894). 1886–1888'de radyo dalgalarını ilk kez üretip algıladı; frekans birimi onun adını taşır.", u: trw("Heinrich Hertz") },
    { k: ["dalga empedansı", "boşluğun empedansı"], t: "Boşluğun dalga empedansı", d: "Düzlem dalgada elektrik alanının manyetik alana oranı: η₀ = √(μ₀/ε₀) ≈ 376,7 Ω.", u: enw("Impedance_of_free_space") },
    { k: ["rf maruziyet", "maruziyet"], t: "RF maruziyeti", d: "İnsanın radyo frekanslı elektromanyetik alanlara maruz kalması. Sınırlar ICNIRP gibi kuruluşların kılavuzlarıyla belirlenir.", u: enw("Electromagnetic_radiation_and_health") },
    { k: ["icnirp"], t: "ICNIRP", d: "Uluslararası İyonlaştırıcı Olmayan Radyasyondan Korunma Komisyonu. RF maruziyet sınırları için uluslararası kılavuz yayımlar (son: 2020).", u: enw("International_Commission_on_Non-Ionizing_Radiation_Protection") },
  ];  // bölüm dosyaları ek terim tanımlayabilir: window.GLOSSARY_EXTRA = [{ k, t, d, u }]
  (window.GLOSSARY_EXTRA || []).forEach((x) => { if (!TERMS.some((t) => t.t === x.t)) TERMS.push(x); });


  // her kök için: kelime başında başlayan, ardından Türkçe ekler gelebilen düzenli ifade
  const L_ = "a-zçğıöşüâîûA-ZÇĞİÖŞÜÂÎÛ";
  // karşılaştırma için: Türkçe küçük harf + ı/i ayrımını kaldır (MYCIN → mycin, ama uzunluk değişmez)
  const lower = (s) => s.toLocaleLowerCase("tr").replace(/ı/g, "i");
  // "xx!" tam kelime demek: yalnızca kesme işaretinden sonra ek alabilir (AM'de evet, "ama" hayır)
  TERMS.forEach((term) => {
    term.re = term.k.map((k) => {
      const exact = k.endsWith("!"), body = lower(exact ? k.slice(0, -1) : k).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return exact
        ? new RegExp(`(^|[^${L_}])(${body}(?:['’][${L_}]*)?)(?![${L_}])`)
        : new RegExp(`(^|[^${L_}])(${body}[${L_}'’]*)`);
    });
  });
  const SKIP = "h1, h2, h3, .chapter-tag, .num, summary, a, .term, .try, button, .license, .cover-meta";

  function markSlide(root) {
    const sid = root.closest(".slide").id;
    // yalnızca belirli slaytlarda anlamlı olan terimleri (ör. "sıcaklık") diğerlerinde atla
    const done = new Set(TERMS.map((t, i) => (t.only && !t.only.includes(sid) ? i : -1)).filter((i) => i >= 0));
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.parentElement.closest(SKIP) || !n.nodeValue.trim() ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      let text = node.nodeValue;
      let parts = null;
      // düğümde geçen ilk uygun terimi bul, böl, tekrarla
      for (;;) {
        let best = null;
        const low = lower(text);
        TERMS.forEach((term, ti) => {
          if (done.has(ti)) return;
          term.re.forEach((re) => {
            const m = re.exec(low);
            const i = m && m.index + m[1].length;
            // aynı yerden başlayan eşleşmelerde uzun olan kazanır ("genlik modülasyonu" > "genlik")
            if (m && (!best || i < best.i || (i === best.i && m[2].length > best.len))) best = { i, len: m[2].length, ti };
          });
        });
        if (!best) break;
        done.add(best.ti);
        parts = parts || [];
        parts.push(text.slice(0, best.i));
        const span = document.createElement("span");
        span.className = "term"; span.tabIndex = 0; span.dataset.ti = best.ti;
        span.textContent = text.slice(best.i, best.i + best.len);
        parts.push(span);
        text = text.slice(best.i + best.len);
      }
      if (parts) { parts.push(text); node.replaceWith(...parts); }
    });
  }
  document.querySelectorAll(".slide .text, .slide .cover-text").forEach(markSlide);

  /* --- balon --- */
  const pop = document.createElement("div");
  pop.id = "gloss"; pop.setAttribute("role", "tooltip");
  document.body.append(pop);
  let cur = null, hideT = 0;
  function show(el) {
    clearTimeout(hideT);
    if (cur === el && pop.classList.contains("open")) return;
    cur = el;
    const t = TERMS[+el.dataset.ti];
    pop.innerHTML = "";
    const h4 = document.createElement("h4"); h4.textContent = t.t;
    const p = document.createElement("p"); p.textContent = t.d;
    const a = document.createElement("a");
    a.href = t.u; a.target = "_blank"; a.rel = "noopener";
    a.textContent = t.u.includes("tr.wikipedia") ? "Vikipedi'de oku ↗" : "Wikipedia'da oku (İngilizce) ↗";
    pop.append(h4, p, a);
    pop.classList.add("open");
    const r = el.getBoundingClientRect();
    const pw = pop.offsetWidth, ph = pop.offsetHeight;
    let x = Math.min(Math.max(12, r.left + r.width / 2 - pw / 2), window.innerWidth - pw - 12);
    let y = r.top - ph - 10;
    pop.classList.toggle("below", y < 8);
    if (y < 8) y = r.bottom + 10;
    pop.style.left = x + "px"; pop.style.top = y + "px";
  }
  function hide(delay = 180) {
    clearTimeout(hideT);
    hideT = setTimeout(() => { pop.classList.remove("open"); cur = null; }, delay);
  }
  document.addEventListener("mouseover", (e) => {
    const el = e.target.closest && e.target.closest(".term");
    if (el) show(el);
    else if (e.target.closest && e.target.closest("#gloss")) clearTimeout(hideT);
    else if (cur) hide();
  });
  document.addEventListener("focusin", (e) => { if (e.target.classList && e.target.classList.contains("term")) show(e.target); });
  document.addEventListener("focusout", (e) => { if (e.target.classList && e.target.classList.contains("term")) hide(250); });
  // dokunmatik: dokununca aç/kapa
  document.addEventListener("click", (e) => {
    const el = e.target.closest(".term");
    if (el) { e.preventDefault(); cur === el && pop.classList.contains("open") ? hide(0) : show(el); }
    else if (!e.target.closest("#gloss")) hide(0);
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") hide(0); });
  document.getElementById("deck").addEventListener("scroll", () => hide(0), true);
})();
