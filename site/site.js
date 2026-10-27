// Inner site pages: the footer section iframe takes the height of its content (and drops its review label);
// links to #anchors land again once that height is known.
document.querySelectorAll("iframe.foot").forEach(f => {
  const fit = () => {
    const d = f.contentDocument; if (!d || !d.body || f.dataset.fit || d.location.href === "about:blank") return; f.dataset.fit = 1;
    d.querySelectorAll(".variant-tag").forEach(e => e.remove());
    const h = () => { f.style.height = Math.ceil(d.body.getBoundingClientRect().height) + "px" };
    h(); new ResizeObserver(h).observe(d.body);
  };
  f.addEventListener("load", fit); fit();
});
const toHash = () => { const t = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1))); if (t) t.scrollIntoView() };
addEventListener("load", () => { toHash(); setTimeout(toHash, 500) });
