"""Anlatım metinlerini parçalardan tools/narration.json'a toplar (slayt sırasıyla) ve denetler.
Kullanım: python3 tools/narration.py            → birleştir, kelime/süre raporu
          python3 tools/narration.py --missing  → sesi henüz üretilmemiş (audio/<id>.mp3 yok ya da metni değişmiş) slaytlar
Metin değişince ses yeniden üretilmeli: tools/narration.hash.json her sesin üretildiği metnin özetini tutar."""
import glob, json, os, re, sys, hashlib
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
os.chdir(root)
ids = re.findall(r'<section class="slide[^"]*"[^>]*\sid="([^"]+)"', open("index.html", encoding="utf-8").read())
texts = {}
for p in glob.glob("tools/parts/*.narration.json"):
    texts.update(json.load(open(p, encoding="utf-8")))
out = {i: texts[i] for i in ids if i in texts}
missing = [i for i in ids if i not in texts]
json.dump(out, open("tools/narration.json", "w", encoding="utf-8"), ensure_ascii=False, indent=2)
hp = "tools/narration.hash.json"
hashes = json.load(open(hp)) if os.path.exists(hp) else {}
h = lambda s: hashlib.sha1(s.encode()).hexdigest()[:12]
if "--missing" in sys.argv:
    for i, t in out.items():
        if not os.path.exists(f"audio/{i}.mp3") or hashes.get(i) != h(t): print(i)
    sys.exit(0)
if "--mark" in sys.argv:  # üretilen seslerin metin özetini kaydet
    for i in sys.argv[sys.argv.index("--mark") + 1:]:
        hashes[i] = h(out[i])
    json.dump(hashes, open(hp, "w"), indent=1)
    sys.exit(0)
total = 0
for i, t in out.items():
    w = len(t.split()); total += w
    digits = re.findall(r"\d", t)
    flag = (" ⚠ rakam" if digits else "") + (" ⚠ kısa" if w < 45 else "") + (" ⚠ uzun" if w > 105 else "")
    print(f"{i:28s} {w:4d} kelime ≈ {w / 2.0:5.0f} sn{flag}")
print(f"{len(out)} metin, {total} kelime ≈ {total / 2.0 / 60:.1f} dk; eksik: {', '.join(missing) or 'yok'}")
