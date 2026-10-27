/* Scroll-scrubbed frame sequence (the Apple product-page technique).
   A tall section drives progress 0..1 while a sticky canvas draws the matching frame, cover-fit.
   Frames are JPGs, so seeking is instant and identical in every browser.
   Review mode: add #p=0.5 to the URL to freeze the first scrub section at 50%. */
window.Scrub = function ({ section, canvas, count, src, onProgress }) {
  const ctx = canvas.getContext("2d");
  const frames = Array.from({ length: count }, (_, i) => {
    const im = new Image();
    im.src = src(i + 1);
    return im;
  });
  let last = -1;

  function size() {
    const r = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    last = -1;
  }
  function draw(i) {
    const im = frames[i];
    if (!im || !im.complete || !im.naturalWidth) return false;   // progress is NaN while the page has no height (hidden tab)
    const cw = canvas.width, ch = canvas.height, s = Math.max(cw / im.naturalWidth, ch / im.naturalHeight);
    const w = im.naturalWidth * s, h = im.naturalHeight * s;
    ctx.drawImage(im, (cw - w) / 2, (ch - h) / 2, w, h);
    return true;
  }
  let progress = function () {
    const r = section.getBoundingClientRect(), total = r.height - innerHeight;
    return Math.min(1, Math.max(0, -r.top / total));
  };
  function tick() {
    const p = progress(), i = Math.round(p * (count - 1));
    if (i !== last && draw(i)) last = i;
    onProgress && onProgress(p);
  }
  addEventListener("scroll", () => requestAnimationFrame(tick), { passive: true });
  addEventListener("resize", () => { size(); tick(); });
  frames[0].onload = () => { size(); tick(); };

  const m = location.hash.match(/p=([\d.]+)/);
  if (m) {                       // review mode: freeze progress instead of scrolling
    const fixed = parseFloat(m[1]);
    progress = () => fixed;
    frames.forEach(im => im.addEventListener("load", () => { last = -1; tick(); }));
  }
  size();
  return { tick };
};

/* small helpers for the variants */
window.seg = (p, a, b) => Math.min(1, Math.max(0, (p - a) / (b - a)));   // 0..1 inside [a,b]
window.ease = t => 1 - Math.pow(1 - t, 3);
