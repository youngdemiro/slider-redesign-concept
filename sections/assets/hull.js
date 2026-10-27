/* Live hull repaint shared by the configurator teasers.
   Real SLIDER paint zones (window.PAINT from paint-data.js) are laid over the side profile.
   A new colour washes along the hull from stern to bow in 0.7 s instead of switching. */
window.COLORS = [
  ["#F5FF00", "Жёлтый"], ["#FFAB00", "Оранжевый"], ["#F70000", "Красный"], ["#992572", "Пурпурный"],
  ["#2B2C7C", "Тёмно-синий"], ["#2874B2", "Синий"], ["#1B542C", "Зелёный"], ["#555D61", "Графит"],
  ["#5A3A29", "Коричневый"], ["#000", "Чёрный"]
].map(([hex, name]) => ({ hex, name }));

window.ZONES = { none: "Без окраски", below: "Ниже бруса", above: "Выше бруса", full: "Весь корпус" };
window.rub = n => n.toLocaleString("ru-RU").replace(/ |,/g, " ") + " ₽";

(function () {
  const css = `
.hull{position:relative}
.hull-sizer{width:100%}
.hull-img,.hull-paint{position:absolute;inset:0;width:100%;height:100%}
.hull-img{transition:opacity .35s}
.hull-paint{pointer-events:none}
.hull-paint .gl path{fill:var(--hull-gloss)}
.hull-paint.p1{-webkit-mask-image:linear-gradient(90deg,#000 40%,transparent 60%);mask-image:linear-gradient(90deg,#000 40%,transparent 60%);
  -webkit-mask-size:250% 100%;mask-size:250% 100%;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:100% 0;mask-position:100% 0}
.hull-paint.p1.wash{transition:-webkit-mask-position .7s cubic-bezier(.65,0,.35,1),mask-position .7s cubic-bezier(.65,0,.35,1);-webkit-mask-position:0 0;mask-position:0 0}`;
  const st = document.createElement("style");
  st.textContent = css;
  document.head.appendChild(st);
})();

let hullCount = 0;
window.Hull = function (el, opts = {}) {
  const assets = opts.assets || "../directions/assets/";
  const state = { model: opts.model || "210", zone: opts.zone || "full", color: opts.color || "#2B2C7C" };
  const id = "hg" + (++hullCount);
  const layer = cls => `<svg class="hull-paint ${cls}" aria-hidden="true"><g class="fl"></g><g class="gl"></g></svg>`;
  el.classList.add("hull");
  el.innerHTML = `<div class="hull-sizer"></div><img class="hull-img" alt="">${layer("p0")}${layer("p1")}
    <svg width="0" height="0" style="position:absolute"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".22" stop-color="#fff" stop-opacity=".12"/>
    <stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset=".78" stop-color="#000" stop-opacity=".18"/>
    <stop offset="1" stop-color="#000" stop-opacity=".42"/></linearGradient></defs></svg>`;
  el.style.setProperty("--hull-gloss", `url(#${id})`);
  const img = el.querySelector(".hull-img"), sizer = el.querySelector(".hull-sizer");
  const [p0, p1] = el.querySelectorAll(".hull-paint");

  function paint(svg, color) { svg.querySelectorAll(".fl path").forEach(p => p.style.fill = color); }
  function build() {
    const d = PAINT[state.model], vb = d.viewBox.split(" ").map(Number);
    img.src = `${assets}profile-${state.model}.svg`;
    img.alt = `Slider ${state.model}, вид сбоку`;
    sizer.style.paddingTop = (vb[3] / vb[2] * 100) + "%";
    const paths = state.zone === "none" ? "" : d.zones[state.zone].map(p => `<path d="${p}"/>`).join("");
    [p0, p1].forEach(s => { s.setAttribute("viewBox", d.viewBox); s.querySelector(".fl").innerHTML = paths; s.querySelector(".gl").innerHTML = paths; });
    paint(p0, state.color); p1.classList.remove("wash"); p1.style.visibility = "hidden";
  }
  let timer;
  function wash(color) {
    clearTimeout(timer);
    paint(p1, color); p1.style.visibility = "visible";
    p1.classList.remove("wash"); void p1.getBoundingClientRect(); p1.classList.add("wash");
    timer = setTimeout(() => { paint(p0, color); p1.style.visibility = "hidden"; p1.classList.remove("wash"); }, 720);
  }
  build();
  return {
    state,
    set(next) {
      const reshape = (next.model && next.model !== state.model) || (next.zone && next.zone !== state.zone);
      const recolor = next.color && next.color !== state.color;
      Object.assign(state, next);
      if (reshape) build(); else if (recolor) wash(state.color);
    },
    // review mode: a frozen frame of the wash from one colour to another, t = 0..1
    frame(from, to, t) {
      clearTimeout(timer); p1.classList.remove("wash");
      const e = t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      paint(p0, from); paint(p1, to); p1.style.visibility = "visible";
      p1.style.webkitMaskPosition = p1.style.maskPosition = `${(1 - e) * 100}% 0`;
    }
  };
};
