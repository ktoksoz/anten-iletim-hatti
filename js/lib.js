/* Ortak yardımcılar: renk dili, tuval kurulumu, döngüler, DOM, kontroller */
(function () {
  // Sitenin renk dili: css/style.css'teki değişkenlerle aynı. Anlamlar bütün sitede sabittir.
  const C = {
    bg: "#0b1f33", deep: "#081726", stage: "#0e2740", panel: "#13314f", line: "#21466a", line2: "#2e5a82",
    grid: "rgba(150, 196, 235, 0.10)", grid2: "rgba(150, 196, 235, 0.2)",
    ink: "#eaf1f4", ink2: "#a9bfcf", muted: "#6f8aa2",
    copper: "#ee8f5f",   // arayüz vurgusu: koaks bakırı (rehber, düğmeler)
    fwd: "#ffd257",      // ileri giden dalga: sodyum sarısı
    ref: "#5ad1ff",      // yansıyan dalga: camgöbeği
    tot: "#f7f7f2",      // toplam / duran dalga: beyaz
    E: "#ff5d8f",        // elektrik alanı: gül
    H: "#7d8cff",        // manyetik alan: çivit
    R: "#e6d3a3",        // direnç: kemik
    Xp: "#c58cff",       // endüktif reaktans (+X): mor
    Xn: "#2fd5b5",       // kapasitif reaktans (−X): turkuaz
    ok: "#8fe08a", bad: "#ff6a5c",
  };
  const FONT = {
    display: '"Archivo", "Arial Narrow", sans-serif',
    body: '"Literata", Georgia, serif',
    num: '"JetBrains Mono", ui-monospace, monospace',
  };

  function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function rgba(hex, a) { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; }
  function mix(h1, h2, t) { const a = hexToRgb(h1), b = hexToRgb(h2); return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(",")})`; }

  /* Yüksek çözünürlüklü, kendini yeniden boyutlandıran tuval */
  function canvas(el, onResize) {
    const ctx = el.getContext("2d");
    const state = { ctx, w: 0, h: 0, dpr: 1 };
    function fit() {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (r.width === state.w && r.height === state.h && dpr === state.dpr) return;
      state.w = r.width; state.h = r.height; state.dpr = dpr;
      el.width = Math.round(r.width * dpr);
      el.height = Math.round(r.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ready && onResize && onResize(state);
    }
    // ilk geri çağrı ertelenir: çağıran kod dönüş değerini değişkene atamış olsun
    let ready = false;
    fit();
    ready = true;
    new ResizeObserver(fit).observe(el);
    queueMicrotask(() => { if (state.w && onResize) onResize(state); });
    state.fit = fit;
    return state;
  }

  /* requestAnimationFrame döngüsü: slayt görünürken çalışır */
  function loop(fn) {
    let id = 0, last = 0, running = false;
    function tick(t) {
      if (!running) return;
      const dt = last ? Math.min(0.05, (t - last) / 1000) : 0.016;
      last = t;
      fn(dt, t / 1000);
      id = requestAnimationFrame(tick);
    }
    return {
      start() { if (!running) { running = true; last = 0; id = requestAnimationFrame(tick); } },
      stop() { running = false; cancelAnimationFrame(id); },
      get running() { return running; },
    };
  }

  /* Küçük DOM yardımcısı: h("div.cls#id", {attrs}, ...children) */
  function h(spec, attrs, ...kids) {
    const m = spec.match(/^([a-z0-9]+)?((?:[.#][\w-]+)*)$/i);
    const el = document.createElement(m[1] || "div");
    (m[2].match(/[.#][\w-]+/g) || []).forEach((p) => {
      if (p[0] === ".") el.classList.add(p.slice(1)); else el.id = p.slice(1);
    });
    if (attrs && (typeof attrs !== "object" || attrs instanceof Node || Array.isArray(attrs))) { kids.unshift(attrs); attrs = null; }
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (k === "html") el.innerHTML = v;
      else if (k === "style" && typeof v === "object") for (const [sk, sv] of Object.entries(v)) { if (sk.startsWith("--")) el.style.setProperty(sk, sv); else el.style[sk] = sv; }
      else if (v !== false && v != null) el.setAttribute(k, v === true ? "" : v);
    }
    kids.flat().forEach((k) => k != null && el.append(k.nodeType ? k : document.createTextNode(k)));
    return el;
  }

  /* Kaydırıcı: etiket + input + değer. log=true ise değer üstel ölçekte değişir. */
  function slider({ label, min, max, step = 0.01, value, fmt = (v) => v.toFixed(2), oninput, width, cls, log }) {
    const toPos = (v) => (log ? Math.log(v) : v), fromPos = (p) => (log ? Math.exp(p) : p);
    const val = h("output.val", fmt(value));
    const input = h("input", { type: "range", min: toPos(min), max: toPos(max), step: log ? "any" : step, value: toPos(value), "aria-label": label });
    if (cls) input.classList.add(cls);
    if (width) input.style.width = width;
    input.addEventListener("input", () => { const v = fromPos(+input.value); val.textContent = fmt(v); oninput(v); });
    const wrap = h("label.sl", h("span.lab", label), input, val);
    wrap.set = (v) => { input.value = toPos(v); val.textContent = fmt(v); };
    wrap.get = () => fromPos(+input.value);
    wrap.input = input;
    return wrap;
  }

  /* Segmentli seçim düğmeleri */
  function seg(options, value, onchange, label) {
    const wrap = h("div.seg", { role: "group", "aria-label": label || null });
    const btns = options.map(([k, lab]) => {
      const b = h("button", { type: "button" }, lab);
      b.addEventListener("click", () => { set(k); onchange(k); });
      wrap.append(b); return [k, b];
    });
    function set(k) { btns.forEach(([kk, b]) => { b.classList.toggle("on", kk === k); b.setAttribute("aria-pressed", String(kk === k)); }); }
    set(value);
    wrap.set = set;
    return wrap;
  }

  /* Aç/kapa düğmesi */
  function toggle(label, value, onchange, cls) {
    const b = h("button.tog" + (cls ? "." + cls : ""), { type: "button", "aria-pressed": String(!!value) }, label);
    b.addEventListener("click", () => { value = !value; b.setAttribute("aria-pressed", String(value)); onchange(value); });
    b.set = (v) => { value = !!v; b.setAttribute("aria-pressed", String(value)); };
    return b;
  }

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  /* Türkçe sayı biçimi: 1.234,5 */
  const nf = {};
  function num(v, d = 0) {
    const k = d;
    nf[k] = nf[k] || new Intl.NumberFormat("tr-TR", { minimumFractionDigits: d, maximumFractionDigits: d });
    return nf[k].format(v).replace("-", "−");
  }
  // Frekansı uygun birimle yaz: 1,5 kHz, 100,0 MHz
  function hz(v, d) {
    const a = Math.abs(v);
    if (a >= 1e9) return num(v / 1e9, d ?? 2) + " GHz";
    if (a >= 1e6) return num(v / 1e6, d ?? (a >= 1e8 ? 1 : 2)) + " MHz";
    if (a >= 1e3) return num(v / 1e3, d ?? (a >= 1e5 ? 0 : 1)) + " kHz";
    return num(v, d ?? 0) + " Hz";
  }
  // Anlamlı basamakla yaz: 0,0123 · 1,23 · 123
  function sig(v, n = 3) {
    if (!isFinite(v)) return v > 0 ? "∞" : v < 0 ? "−∞" : "—";
    if (v === 0) return "0";
    const d = Math.max(0, Math.min(6, n - 1 - Math.floor(Math.log10(Math.abs(v)))));
    return num(v, d);
  }
  // Empedans/direnç: 50 Ω, 1,2 kΩ; karmaşık için ohm({re, im})
  function ohm(z, n = 3) {
    if (typeof z === "number") {
      if (!isFinite(z)) return "∞ Ω";
      const a = Math.abs(z);
      if (a >= 1e6) return sig(z / 1e6, n) + " MΩ";
      if (a >= 1e4) return sig(z / 1e3, n) + " kΩ";
      return sig(z, n) + " Ω";
    }
    const re = Math.abs(z.re) < 5e-4 ? 0 : z.re, im = Math.abs(z.im) < 5e-4 ? 0 : z.im;
    if (!isFinite(re) || !isFinite(im)) return "∞ Ω";
    return `${sig(re, n)} ${im < 0 ? "−" : "+"} j${sig(Math.abs(im), n)} Ω`;
  }
  // Desibel: −3,0 dB
  function db(v, d = 1, unit = "dB") { return isFinite(v) ? num(v, d) + " " + unit : (v > 0 ? "∞ " : "−∞ ") + unit; }
  /* Rastgele sayı üreteci (tekrar edilebilir) */
  function rng(seed = 1) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // Uzunluk (metre)
  function meters(v) {
    if (v >= 1000) return num(v / 1000, v >= 1e4 ? 0 : 1) + " km";
    if (v >= 1) return num(v, v >= 10 ? 1 : 2) + " m";
    if (v >= 0.01) return num(v * 100, v >= 0.1 ? 0 : 1) + " cm";
    if (v >= 1e-3) return num(v * 1000, 1) + " mm";
    if (v >= 1e-6) return num(v * 1e6, 1) + " µm";
    if (v >= 1e-9) return num(v * 1e9, 0) + " nm";
    return num(v * 1e12, 0) + " pm";
  }

  /* Harici script'i bir kere yükle (file:// ile de çalışır) */
  const loaded = {};
  function loadScript(src) {
    if (!loaded[src]) loaded[src] = new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = src; s.onload = res; s.onerror = () => rej(new Error(src + " yüklenemedi"));
      document.head.append(s);
    });
    return loaded[src];
  }

  /* İşaretçi konumu (tuvale göre) ve sürükleme */
  function pointer(el, { down, move, up, hover } = {}) {
    let drag = false;
    const pos = (e) => { const r = el.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    el.style.touchAction = "none";
    el.addEventListener("pointerdown", (e) => { drag = true; try { el.setPointerCapture(e.pointerId); } catch (er) {} down && down(...pos(e), e); });
    el.addEventListener("pointermove", (e) => { if (drag) move && move(...pos(e), e); else hover && hover(...pos(e), e); });
    const end = (e) => { if (!drag) return; drag = false; up && up(...pos(e), e); };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
    el.addEventListener("pointerleave", (e) => { if (!drag && hover) hover(-1, -1, e); });
    return { get dragging() { return drag; } };
  }

  window.L = {
    C, FONT, rgba, mix, hexToRgb, canvas, loop, h, slider, seg, toggle,
    clamp, lerp, ease, num, sig, hz, ohm, db, meters, loadScript, pointer, rng,
  };
  window.Demos = window.Demos || {};
})();
